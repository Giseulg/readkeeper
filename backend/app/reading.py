"""Persistent API for the reading-fun UI, alongside the legacy EPUB API."""
from __future__ import annotations

import json
import os
import re
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, Form, Header, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field
from .book_analysis import analyze
from .config import ENV_FILE
from .reading_identity import production, reader_identity, production_settings
from .curated_activities import CURATED, curated_analysis
from .genre_analysis import GENRES
from .genre_jobs import JOB_SCHEMA, anchor_id, enqueue, evidence_end, job_status, jobs_enabled
from .imported_activities import imported_analysis
from .reading_graph import MINSEO_ID, STORY_CAST, story_graph
from .game import claim_request, get_pref, set_pref, study

router = APIRouter(prefix="/api/reading", tags=["reading"])
STORY = "rain-return-box"
LEGACY_REWARD_ID = "rain-frog"
ANALYSIS_VERSION = 4
CATALOG_CPU = "public-cpu-scheduling"
CATALOG_SOLAR_PAPER = "paper-solar-overlap-2026"
CASE_CARDS = [
    {"id": "key", "text": "민서가 손수건 아래에 열쇠를 뒀어요."},
    {"id": "note", "text": "민서가 반납함에 잠깐 넣지 말라는 쪽지를 붙였어요."},
    {"id": "rain", "text": "복도 창밖에서 천둥이 울렸어요."},
    {"id": "crush", "text": "다른 책을 더 넣으면 안에 있는 책이 눌릴 수 있었어요."},
    {"id": "wet", "text": "반납함 안의 책이 젖어서 부풀어 있었어요."},
    {"id": "closed", "text": "도서실은 시설 점검으로 일찍 문을 닫았어요."},
]
CASE_SLOTS = [
    {"id": "situation", "label": "어떤 문제가 있었지?"},
    {"id": "reason", "label": "민서는 무슨 일이 생길까 걱정했지?"},
    {"id": "action", "label": "그래서 민서는 어떻게 했지?"},
]
CASE_ANSWER = {"situation": "wet", "reason": "crush", "action": "note"}
CASE_EXPLANATION = "반납함 안에 젖은 책이 있었어요. 민서는 다른 책에 눌릴까 걱정해서 잠깐 넣지 말라는 쪽지를 붙였어요."
SAMPLE = Path(__file__).with_name("reading_sample.json")
UNREAD = {"chapter": 0, "paragraph": -1}


@lru_cache(maxsize=1)
def sample_story():
    return json.loads(SAMPLE.read_text(encoding="utf-8"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS catalog_publications (
    book_id TEXT PRIMARY KEY REFERENCES books ON DELETE CASCADE,
    author_name TEXT NOT NULL, description TEXT NOT NULL, license TEXT NOT NULL,
    representative_name TEXT NOT NULL, representative_sprite TEXT NOT NULL,
    published_at TEXT NOT NULL,
    added_at TEXT,
    in_library INTEGER NOT NULL DEFAULT 0 CHECK (in_library IN (0, 1))
);
CREATE VIEW IF NOT EXISTS library_books AS
    SELECT b.* FROM books b LEFT JOIN catalog_publications p ON p.book_id = b.id
    WHERE p.book_id IS NULL OR p.in_library = 1;
CREATE TABLE IF NOT EXISTS passages (
    book_id TEXT REFERENCES books ON DELETE CASCADE, ordinal INTEGER,
    chapter INTEGER NOT NULL, paragraph INTEGER NOT NULL, title TEXT NOT NULL, text TEXT NOT NULL,
    PRIMARY KEY (book_id, ordinal), UNIQUE (book_id, chapter, paragraph)
);
CREATE TABLE IF NOT EXISTS reading_progress (
    book_id TEXT PRIMARY KEY REFERENCES books ON DELETE CASCADE,
    current INTEGER NOT NULL DEFAULT 0, confirmed INTEGER NOT NULL DEFAULT -1, last_read_at TEXT
);
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books ON DELETE CASCADE,
    ordinal INTEGER NOT NULL, prompt TEXT NOT NULL, answer TEXT NOT NULL, aliases TEXT NOT NULL,
    FOREIGN KEY (book_id, ordinal) REFERENCES passages
);
CREATE TABLE IF NOT EXISTS book_analysis (
    book_id TEXT PRIMARY KEY REFERENCES books ON DELETE CASCADE, result TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS question_choices (
    question_id TEXT PRIMARY KEY REFERENCES questions ON DELETE CASCADE, options TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books ON DELETE CASCADE,
    confirmed INTEGER NOT NULL, mode TEXT NOT NULL, started_at TEXT NOT NULL, finished_at TEXT
);
CREATE TABLE IF NOT EXISTS session_questions (
    session_id TEXT REFERENCES quiz_sessions ON DELETE CASCADE,
    question_id TEXT REFERENCES questions ON DELETE CASCADE, position INTEGER NOT NULL,
    PRIMARY KEY (session_id, question_id)
);
CREATE TABLE IF NOT EXISTS quiz_attempts (
    session_id TEXT, question_id TEXT, response TEXT NOT NULL, result TEXT NOT NULL,
    PRIMARY KEY (session_id, question_id),
    FOREIGN KEY (session_id, question_id) REFERENCES session_questions ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY, book_id TEXT NOT NULL REFERENCES books ON DELETE CASCADE,
    ordinal INTEGER NOT NULL, type TEXT NOT NULL, content TEXT NOT NULL, quote TEXT NOT NULL,
    created_at TEXT NOT NULL, evidence TEXT, confidence INTEGER, review_at INTEGER,
    written_confirmed INTEGER NOT NULL,
    FOREIGN KEY (book_id, ordinal) REFERENCES passages,
    FOREIGN KEY (book_id, review_at) REFERENCES passages
);
CREATE TABLE IF NOT EXISTS revisions (
    id INTEGER PRIMARY KEY, memo_id TEXT NOT NULL REFERENCES memos ON DELETE CASCADE,
    content TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS revision_evidence (
    revision_id INTEGER NOT NULL REFERENCES revisions ON DELETE CASCADE,
    book_id TEXT NOT NULL, ordinal INTEGER NOT NULL, stance TEXT NOT NULL, quote TEXT NOT NULL,
    PRIMARY KEY (revision_id, ordinal, stance, quote),
    FOREIGN KEY (book_id, ordinal) REFERENCES passages
);
CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS game_requests (
    scope TEXT, key TEXT, digest TEXT NOT NULL, resource TEXT NOT NULL, PRIMARY KEY(scope, key)
);
CREATE TABLE IF NOT EXISTS collectibles (id TEXT PRIMARY KEY, earned_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS character_cards (
    id TEXT PRIMARY KEY REFERENCES collectibles ON DELETE CASCADE, name TEXT NOT NULL, sprite TEXT NOT NULL,
    book_id TEXT NOT NULL, book_title TEXT NOT NULL, is_public INTEGER NOT NULL DEFAULT 0,
    x REAL, y REAL
);
CREATE TABLE IF NOT EXISTS minigame_rewards (id TEXT PRIMARY KEY REFERENCES collectibles ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS clue_game_rewards (id TEXT PRIMARY KEY REFERENCES collectibles ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS revision_outcomes (
    revision_id INTEGER PRIMARY KEY REFERENCES revisions ON DELETE CASCADE, outcome TEXT NOT NULL
);
"""


def now():
    return datetime.now(timezone.utc).isoformat()


def open_db(account_id=None):
    url = os.getenv("READING_DATABASE_URL")
    if url:
        from .reading_postgres import ReadingPostgres

        certificate = os.getenv("READING_DATABASE_SSLROOTCERT")
        if certificate and certificate != "system":
            path = ENV_FILE.parent / certificate
            if os.name == "nt" and path.drive.casefold() == Path.cwd().drive.casefold():
                # libpq on Windows may not open an absolute path with non-ASCII characters.
                certificate = os.path.relpath(path)
            else:
                certificate = str(path)
        conn = ReadingPostgres(url, certificate)
        if account_id is not None:
            try:
                conn.select_reader(account_id, seed_reader)
            except BaseException:
                conn.close()
                raise
        return conn

    if production():
        raise RuntimeError("READING_DATABASE_URL is required in production")

    legacy_path = Path("spokeeper-reading.db")
    default_path = legacy_path if legacy_path.is_file() and not Path("reading.db").exists() else Path("reading.db")
    path = os.environ.get("SPO_READING_DB", default_path)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def write_transaction(conn):
    if isinstance(conn, sqlite3.Connection):
        with conn:
            conn.execute("BEGIN IMMEDIATE")
            yield
    else:
        with conn.write_transaction():
            yield


def init_reading_db():
    if production():
        production_settings()
    conn = open_db()
    try:
        if isinstance(conn, sqlite3.Connection):
            conn.executescript(SCHEMA + JOB_SCHEMA)
        if production():
            conn.check_installation()
        else:
            seed_reader(conn)
    finally:
        conn.close()


def seed_reader(conn):
    with write_transaction(conn):
        if get_pref(conn, "presentation_only", False):
            return
        if conn.execute("SELECT 1 FROM preferences WHERE key = 'sample_seeded'").fetchone():
            migrate_story_rewards(conn)
            for book in rows(conn, "SELECT id, category FROM books WHERE id != ?", STORY):
                stored = analysis_for(conn, book["id"])
                if stored.get("source") != "provided" and stored.get("version") != ANALYSIS_VERSION:
                    prepare_book_analysis(conn, book["id"], book["category"])
                case = analysis_for(conn, book["id"]).get("case")
                if case:
                    save_earned_cards(conn, book["id"], case["cast"])
            seed_catalog(conn)
            return
        sample = sample_story()
        insert_book(conn, STORY, sample["title"], "novel", sample["chapters"])
        passages = rows(conn, "SELECT * FROM passages WHERE book_id = ?", STORY)
        for question in sample["questions"]:
            proof = next(p for p in passages if p["chapter"] == question["chapter"] and question["evidence"] in p["text"])
            conn.execute(
                "INSERT INTO questions VALUES (?, ?, ?, ?, ?, ?)",
                (question["id"], STORY, proof["ordinal"], question["prompt"], question["answer"], json.dumps(question["aliases"])),
            )
        set_pref(conn, "sample_seeded", True)
        seed_catalog(conn)


def connection(account_id: Annotated[str | None, Depends(reader_identity)]):
    conn = open_db(account_id)
    try:
        yield conn
    finally:
        conn.close()


Db = Annotated[Any, Depends(connection)]
Category = Literal["major", "paper", "novel", "general", "poetry", "cs_book"]
RequestKey = Annotated[str | None, Header(alias="Idempotency-Key", min_length=1, max_length=128)]
MemoType = Literal["memo", "hypothesis"]
Text = Annotated[str, Field(min_length=1, max_length=10000)]


class Location(BaseModel):
    chapter: int = Field(ge=0)
    paragraph: int = Field(ge=0)


class Quote(BaseModel):
    text: Text
    location: Location


class HypothesisInput(BaseModel):
    evidence: Text
    confidence: int = Field(ge=1, le=5)
    reviewAt: Location | None = None


class MemoInput(BaseModel):
    bookId: str
    type: MemoType
    content: Text
    quote: Quote
    hypothesis: HypothesisInput | None = None


class RevisionInput(BaseModel):
    content: Text
    outcome: Literal["changed", "same", "unsure"] | None = None
    evidenceFor: list[Quote] = Field(default_factory=list, max_length=20)
    evidenceAgainst: list[Quote] = Field(default_factory=list, max_length=20)


class QuizStart(BaseModel):
    mode: Literal["recall", "check"]
    count: int | None = Field(default=None, ge=1, le=20)


class AnswerInput(BaseModel):
    questionId: str
    response: str = Field(max_length=10000)
    giveUp: Literal["forgot", "skipped"] | None = None


class ProfilePatch(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=80)
    interests: list[Category] | None = None
    onboarded: bool | None = None


def rows(conn, sql, *params):
    return conn.execute(sql, params).fetchall()


def one(conn, sql, *params):
    row = conn.execute(sql, params).fetchone()
    if row is None:
        raise HTTPException(404, "항목을 찾을 수 없어요.")
    return row


def clean(text):
    value = text.strip()
    if not value:
        raise HTTPException(422, "내용을 입력해 주세요.")
    return value


def insert_book(conn, book_id, title, category, chapters):
    conn.execute("INSERT INTO books VALUES (?, ?, ?, ?)", (book_id, title, category, now()))
    ordinal = 0
    for chapter, item in enumerate(chapters):
        for paragraph, text in enumerate(item["paragraphs"]):
            conn.execute(
                "INSERT INTO passages VALUES (?, ?, ?, ?, ?, ?)",
                (book_id, ordinal, chapter, paragraph, item["title"], text),
            )
            ordinal += 1
    conn.execute("INSERT INTO reading_progress(book_id) VALUES (?)", (book_id,))


def location(row):
    return {"chapter": row["chapter"], "paragraph": row["paragraph"]}


def passage_at(conn, book_id, ordinal):
    return one(conn, "SELECT * FROM passages WHERE book_id = ? AND ordinal = ?", book_id, ordinal)


def resolve_location(conn, book_id, loc):
    row = conn.execute(
        "SELECT * FROM passages WHERE book_id = ? AND chapter = ? AND paragraph = ?",
        (book_id, loc.chapter, loc.paragraph),
    ).fetchone()
    if row is None:
        raise HTTPException(422, "이 책의 유효한 문단 위치를 선택해 주세요.")
    return row


def quote_from(row, text=None):
    return {"location": location(row), "text": row["text"] if text is None else text}


def validate_quote(conn, book_id, quote, max_ordinal=None):
    row = resolve_location(conn, book_id, quote.location)
    if max_ordinal is not None and row["ordinal"] > max_ordinal:
        raise HTTPException(409, "읽음으로 확정한 구간의 근거만 사용할 수 있어요.")
    text = clean(quote.text)
    if text not in row["text"]:
        raise HTTPException(422, "선택한 문단에서 인용문을 찾을 수 없어요.")
    return row, quote_from(row, text)


def progress(conn, book_id):
    return one(conn, "SELECT p.* FROM reading_progress p JOIN library_books b ON b.id = p.book_id WHERE p.book_id = ?", book_id)


def confirmed_location(conn, state):
    if state["confirmed"] < 0:
        return UNREAD
    return location(passage_at(conn, state["book_id"], state["confirmed"]))


def prepare_book_analysis(conn, book_id, category):
    passages = rows(conn, "SELECT * FROM passages WHERE book_id = ? ORDER BY ordinal", book_id)
    curated = book_id in CURATED
    if curated:
        questions, result = curated_analysis(book_id, passages, CASE_ANSWER)
    else:
        questions, result = analyze(book_id, category, passages)
    kind = 'understand' if curated else 'blank'
    identified = [(f"{book_id}-{kind}-{q[0]}", *q) for q in questions]
    save_book_analysis(conn, book_id, identified, result)


def save_book_analysis(conn, book_id, questions, result):
    result["version"] = ANALYSIS_VERSION
    for question_id, ordinal, prompt, answer, choices in questions:
        conn.execute("INSERT INTO questions VALUES (?, ?, ?, ?, ?, '[]') ON CONFLICT(id) DO NOTHING",
                     (question_id, book_id, ordinal, prompt, answer))
        conn.execute("INSERT INTO question_choices VALUES (?, ?) ON CONFLICT(question_id) DO NOTHING", (question_id, json.dumps(choices)))
    conn.execute("INSERT INTO book_analysis VALUES (?, ?) ON CONFLICT(book_id) DO UPDATE SET result=excluded.result",
                 (book_id, json.dumps(result)))


def analysis_for(conn, book_id):
    row = conn.execute("SELECT result FROM book_analysis WHERE book_id = ?", (book_id,)).fetchone()
    return json.loads(row["result"]) if row else {}


def book_view(conn, book_id):
    book = one(conn, "SELECT * FROM books WHERE id = ?", book_id)
    state = progress(conn, book_id)
    count = one(conn, "SELECT COUNT(*) total, COUNT(DISTINCT chapter) chapters FROM passages WHERE book_id = ?", book_id)
    analysis = analysis_for(conn, book_id)
    case = analysis.get("case")
    reward_cast = STORY_CAST if book_id == STORY else case.get("cast", []) if isinstance(case, dict) else []
    return {
        "id": book_id, "title": book["title"], "category": book["category"], "fileType": "txt",
        "status": "ready", "coverColor": {"novel": "berry", "major": "green", "poetry": "berry", "cs_book": "green", "paper": "sky", "general": "amber"}.get(book["category"], "wood"), "chapterCount": count["chapters"],
        "createdAt": book["created_at"],
        "graphAvailable": book["category"] in GENRES or bool(analysis.get("nodes")) or bool(analysis.get("studyMap")),
        "caseAvailable": book_id == STORY or isinstance(analysis.get("case"), dict),
        "characterDesignAvailable": bool((analysis.get("characterDesigns") or {}).get("selected")),
        "completionRewards": cast_collectibles(conn, book_id, reward_cast),
        "progress": {
            "current": location(passage_at(conn, book_id, state["current"])),
            "confirmed": confirmed_location(conn, state),
            "percent": 100 * (state["confirmed"] + 1) // count["total"],
            "lastReadAt": state["last_read_at"],
        },
    }


def seed_catalog(conn):
    if conn.execute("SELECT 1 FROM catalog_publications WHERE book_id = ?", (CATALOG_CPU,)).fetchone():
        return
    sample = json.loads(Path(__file__).with_name("catalog_cpu_scheduling.json").read_text(encoding="utf-8"))
    title = "CPU 스케줄링 실습 노트"
    insert_book(conn, CATALOG_CPU, title, "major", [{"title": title, "paragraphs": sample["paragraphs"]}])
    questions, analysis = imported_analysis(CATALOG_CPU, sample["paragraphs"], json.dumps(sample["activities"]))
    save_book_analysis(conn, CATALOG_CPU, questions, analysis)
    conn.execute("""
        INSERT INTO catalog_publications
        (book_id, author_name, description, license, representative_name, representative_sprite, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (CATALOG_CPU, "프로젝트 실습 자료",
          "FCFS와 SJF를 비교하고, 어떤 작업을 먼저 실행하는지 짧은 사례로 연습해요.",
          "이 앱에서 무료로 읽을 수 있는 실습 자료예요.",
          "스케줄러", "d_sched", now()))


def publication_view(conn, book_id):
    item = one(conn, """
        SELECT p.*, b.title, b.category,
               (SELECT COUNT(DISTINCT chapter) FROM passages WHERE book_id = b.id) chapter_count
        FROM catalog_publications p JOIN books b ON b.id = p.book_id WHERE p.book_id = ?
    """, book_id)
    return {
        "id": book_id, "title": item["title"], "authorName": item["author_name"], "authorVerified": False,
        "category": item["category"], "description": item["description"], "chapterCount": item["chapter_count"],
        "price": 0, "character": {"name": item["representative_name"], "sprite": item["representative_sprite"]},
        "coverColor": "green", "license": item["license"], "registeredAt": item["published_at"],
        "purchased": False, "libraryBookId": book_id if item["in_library"] else None,
    }


@router.get("/explore/contents")
def publications(conn: Db):
    return [publication_view(conn, item["book_id"]) for item in rows(
        conn, "SELECT book_id FROM catalog_publications ORDER BY published_at DESC, book_id"
    )]


@router.get("/explore/contents/{content_id}")
def publication(content_id: str, conn: Db):
    return publication_view(conn, content_id)


@router.post("/explore/contents/{content_id}/claim")
def claim_publication(content_id: str, conn: Db):
    with write_transaction(conn):
        updated = conn.execute("""
            UPDATE catalog_publications SET added_at = COALESCE(added_at, ?), in_library = TRUE
            WHERE book_id = ?
        """, (now(), content_id))
        if not updated.rowcount:
            raise HTTPException(404, "공개 자료를 찾을 수 없어요.")
        return {"content": publication_view(conn, content_id), "book": book_view(conn, content_id)}


@router.get("/books")
def books(conn: Db):
    return [book_view(conn, row["id"]) for row in rows(conn, "SELECT id FROM library_books ORDER BY created_at DESC")]


@router.get("/books/{book_id}")
def book(book_id: str, conn: Db):
    return book_view(conn, book_id)


@router.get("/books/{book_id}/content")
def content(book_id: str, conn: Db):
    progress(conn, book_id)
    layout = (analysis_for(conn, book_id).get("sourceCleanup") or {}).get("layout", {})
    chapters = []
    for passage in rows(conn, "SELECT * FROM passages WHERE book_id = ? ORDER BY ordinal", book_id):
        if passage["chapter"] == len(chapters):
            chapters.append({"title": passage["title"], "paragraphs": [], "layout": []})
        chapters[-1]["paragraphs"].append(passage["text"])
        chapters[-1]["layout"].append(layout.get(str(passage["ordinal"])))
    return {"bookId": book_id, "chapters": chapters}


@router.post("/books", status_code=201)
def create_book(file: UploadFile, conn: Db, title: Annotated[str, Form(max_length=200)], category: Annotated[Category, Form()], activities: UploadFile | None = None):
    if not (file.filename or "").lower().endswith(".txt"):
        raise HTTPException(415, "현재 TXT 파일을 가져올 수 있어요.")
    raw = file.file.read(2_000_001)
    if len(raw) > 2_000_000:
        raise HTTPException(413, "TXT 파일은 최대 2MB까지 가져올 수 있어요.")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise HTTPException(422, "UTF-8 TXT 파일을 선택해 주세요.") from error
    paragraphs = [p.strip() for p in re.split(r"\r?\n\s*\r?\n", text) if p.strip()]
    if not paragraphs:
        raise HTTPException(422, "본문이 비어 있어요.")
    book_id = uuid4().hex
    imported = None
    if activities is not None:
        payload = activities.file.read(256_001)
        if len(payload) > 256_000:
            raise HTTPException(413, "활동 파일은 최대 256KB까지 올릴 수 있어요.")
        try:
            imported = imported_analysis(book_id, paragraphs, payload.decode("utf-8-sig"))
        except (ValueError, UnicodeError) as error:
            raise HTTPException(422, str(error)) from error
    with write_transaction(conn):
        insert_book(conn, book_id, clean(title), category, [{"title": title.strip(), "paragraphs": paragraphs}])
        if imported:
            save_book_analysis(conn, book_id, *imported)
        elif not production() and category in GENRES and os.getenv("READING_OPENAI_MODEL") and jobs_enabled(conn):
            save_book_analysis(conn, book_id, [], {})
            enqueue(conn, book_id, now())
        else:
            prepare_book_analysis(conn, book_id, category)
        return book_view(conn, book_id)


@router.delete("/books/{book_id}", status_code=204)
def delete_book(book_id: str, conn: Db):
    with write_transaction(conn):
        publication = conn.execute("SELECT in_library FROM catalog_publications WHERE book_id = ?", (book_id,)).fetchone()
        if publication is not None:
            if not publication["in_library"]:
                raise HTTPException(404, "서재에서 책을 찾을 수 없어요.")
            conn.execute("UPDATE catalog_publications SET in_library = FALSE WHERE book_id = ?", (book_id,))
        elif not conn.execute("DELETE FROM books WHERE id = ?", (book_id,)).rowcount:
            raise HTTPException(404, "책을 찾을 수 없어요.")
    return Response(status_code=204)


@router.put("/books/{book_id}/progress/current")
def save_current(book_id: str, loc: Location, conn: Db):
    with write_transaction(conn):
        ordinal = resolve_location(conn, book_id, loc)["ordinal"]
        conn.execute("UPDATE reading_progress SET current = ?, last_read_at = ? WHERE book_id = ?", (ordinal, now(), book_id))
        return book_view(conn, book_id)


@router.put("/books/{book_id}/progress/confirmed")
def confirm(book_id: str, loc: Location, conn: Db):
    with write_transaction(conn):
        ordinal = resolve_location(conn, book_id, loc)["ordinal"]
        changed = conn.execute("UPDATE reading_progress SET confirmed = ? WHERE book_id = ? AND confirmed < ?",
                               (ordinal, book_id, ordinal)).rowcount
        if changed:
            study(conn, 10, "읽음 확정")
        return book_view(conn, book_id)


@router.get("/books/{book_id}/graph")
def graph(book_id: str, conn: Db):
    state = progress(conn, book_id)
    stored = analysis_for(conn, book_id)
    genre = stored.get("genre")
    poetry = stored.get("poetryDictionary")
    if isinstance(poetry, dict) and poetry.get("source") == "gemini":
        genre = {"category": "poetry", "sections": [
            {"imagery": poetry["imagery"], "summary": [], "personas": []},
            {"complete_only": True, "summary": poetry["overview"], "personas": []},
        ]}
    study = stored.get("studyMap")
    if isinstance(study, dict) and study.get("source") == "gemini":
        genre = {"category": "cs_book", "sections": [
            {"flow": study["flow"], "summary": [], "personas": []},
        ]}
    if book_id == CATALOG_SOLAR_PAPER:
        research_map = stored.get("researchMap") or {}
        logic = research_map.get("logic", []) if research_map.get("source") in {"gemini", "openai"} else []
        sections = [{key: value for key, value in section.items() if key != "logic"}
                    for section in (genre or {}).get("sections", [])]
        genre = {"category": "paper", "sections": [{"logic": logic, "summary": [], "personas": []}, *sections]}
        total = one(conn, "SELECT MAX(ordinal) AS ordinal FROM passages WHERE book_id = ?", book_id)["ordinal"]
        nodes, edges, analysis = visible_genre(conn, book_id, genre, state["confirmed"], state["confirmed"] == total)
        return {"bookId": book_id, "until": confirmed_location(conn, state), "nodes": nodes, "edges": edges,
                "analysis": analysis, "researchMapPending": not logic}
    if genre:
        total = one(conn, "SELECT MAX(ordinal) AS ordinal FROM passages WHERE book_id = ?", book_id)["ordinal"]
        nodes, edges, analysis = visible_genre(conn, book_id, genre, state["confirmed"], state["confirmed"] == total)
        return {"bookId": book_id, "until": confirmed_location(conn, state),
                "nodes": nodes, "edges": edges, "analysis": analysis, "analysisStatus": "ready"}
    nodes, edges = [], []
    if book_id == STORY:
        passages = rows(conn, "SELECT * FROM passages WHERE book_id = ? AND ordinal <= ? ORDER BY ordinal",
                        book_id, state["confirmed"])
        nodes, edges = story_graph(book_id, passages)
    else:
        analysis = stored
        def visible(items):
            for item in items:
                if item["ordinal"] <= state["confirmed"]:
                    row = passage_at(conn, book_id, item["ordinal"])
                    yield item, row
        nodes = [
            {**{k: v for k, v in item.items() if k != "ordinal"}, "bookId": book_id, "firstSeen": location(row)}
            for item, row in visible(analysis.get("nodes", []))
        ]
        edges = [
            {**{k: v for k, v in item.items() if k not in {"ordinal", "quote"}}, "bookId": book_id,
             "firstSeen": location(row), "quotes": [quote_from(row, item.get("quote"))]}
            for item, row in visible(analysis.get("edges", [])) if item.get("explanation")
        ]
    return {"bookId": book_id, "until": confirmed_location(conn, state), "nodes": nodes, "edges": edges,
            "analysisStatus": job_status(conn, book_id)}


def visible_genre(conn, book_id, genre, boundary, complete):
    sections, nodes, edges = [], {}, []
    locations = {}

    def passage(ordinal):
        if ordinal not in locations:
            locations[ordinal] = passage_at(conn, book_id, ordinal)
        return locations[ordinal]

    def public(item):
        return {**item, "evidence": [quote_from(passage(proof["ordinal"]), proof["quote"])
                                     for proof in item["evidence"]]}

    for number, section in enumerate(genre["sections"]):
        if section.get("complete_only") and not complete:
            continue
        visible = {"id": number, "wholeWork": bool(section.get("complete_only"))}
        for key in ("summary", "personas", "imagery", "flow", "logic"):
            if key in section:
                visible[key] = [public(item) | {"index": index} for index, item in enumerate(section[key])
                                if evidence_end(item) <= boundary
                                and all(evidence_end(comparison) <= boundary for comparison in item.get("comparisons", []))]
        if "logic" in visible:
            visible_indexes = {item["index"] for item in visible["logic"]}
            for item in visible["logic"]:
                item["prior_stage_indexes"] = [index for index in item["prior_stage_indexes"] if index in visible_indexes]
                item["connections"] = [public(link) for link in item.get("connections", [])
                                       if link["prior_index"] in visible_indexes and evidence_end(link) <= boundary]
                item["comparisons"] = [public(comparison) for comparison in item.get("comparisons", [])
                                       if evidence_end(comparison) <= boundary]
        if "flow" in visible:
            visible_indexes = {item["index"] for item in visible["flow"]}
            for item in visible["flow"]:
                previous = item.get("prior_stage_indexes", [])
                if any(index not in visible_indexes for index in previous):
                    item["connection_reason"] = ""
                item["prior_stage_indexes"] = [index for index in previous if index in visible_indexes]
        sections.append(visible)
        item_ids = {}
        for index, item in enumerate(section.get("items", [])):
            end = evidence_end(item)
            if end > boundary:
                continue
            node_id = anchor_id(book_id, item["kind"], item["name"])
            item_ids[index] = node_id
            nodes.setdefault(node_id, {
                "id": node_id, "bookId": book_id, "name": item["name"],
                "kind": "object" if item["kind"] == "symbol" else item["kind"],
                "attributes": {"설명": item["description"]}, "firstSeen": location(passage(end)),
            })
        for index, edge in enumerate(section.get("links", [])):
            source, target = item_ids.get(edge["source_index"]), item_ids.get(edge["target_index"])
            end = evidence_end(edge)
            if end <= boundary and source and target and source != target:
                edges.append({"id": f"{book_id}-genre-link-{number}-{index}", "bookId": book_id,
                              "source": source, "target": target, "relation": edge["relation"],
                              "explanation": edge["explanation"], "firstSeen": location(passage(end)),
                              "quotes": public(edge)["evidence"]})
    return list(nodes.values()), edges, {"category": genre["category"], "sections": sections}


@router.post("/books/{book_id}/analysis/retry", status_code=202)
def retry_genre_analysis(book_id: str, conn: Db):
    with write_transaction(conn):
        one(conn, "SELECT id FROM books WHERE id = ?", book_id)
        if job_status(conn, book_id) != "failed":
            raise HTTPException(409, "실패한 분석만 다시 요청할 수 있어요.")
        if production():
            category = one(conn, "SELECT category FROM books WHERE id = ?", book_id)["category"]
            prepare_book_analysis(conn, book_id, category)
            conn.execute("UPDATE genre_analysis_jobs SET status = 'ready', token = NULL, updated_at = ? WHERE book_id = ?", (now(), book_id))
            return {"status": "ready"}
        enqueue(conn, book_id, now())
    return {"status": "queued"}


@router.post("/books/{book_id}/progress/restart")
def restart_reading(book_id: str, conn: Db):
    with write_transaction(conn):
        conn.execute(
            "UPDATE reading_progress SET current = 0, confirmed = -1, last_read_at = NULL WHERE book_id = ?",
            (book_id,),
        )
        return book_view(conn, book_id)


def session_at_current_progress(conn, session_id):
    session = one(conn, "SELECT * FROM quiz_sessions WHERE id = ?", session_id)
    if session["confirmed"] > progress(conn, session["book_id"])["confirmed"]:
        raise HTTPException(409, "다시 읽는 중이에요. 지금까지 읽은 범위에서 새 퀴즈를 시작해 주세요.")
    return session


def session_view(conn, session_id):
    session = session_at_current_progress(conn, session_id)
    questions = []
    attempts = []
    choices = {q["id"]: q["choices"] for q in sample_story()["questions"]} if session["book_id"] == STORY else {}
    activity = analysis_for(conn, session["book_id"])
    explanations = activity.get("explanations", {})
    details = activity.get("questionDetails", {})
    for row in rows(conn, """
        SELECT q.*, a.response, a.result, qc.options FROM session_questions sq
        JOIN questions q ON q.id = sq.question_id
        LEFT JOIN question_choices qc ON qc.question_id = q.id
        LEFT JOIN quiz_attempts a ON a.session_id = sq.session_id AND a.question_id = sq.question_id
        WHERE sq.session_id = ? ORDER BY sq.position
    """, session_id):
        detail = details.get(row["id"], {})
        question = {"id": row["id"], "bookId": row["book_id"], "kind": "recall", "prompt": row["prompt"], "relatedNodeIds": detail.get("relatedNodeIds", [])}
        if row["options"]:
            question["choices"] = json.loads(row["options"])
        elif row["id"] in choices:
            question["choices"] = choices[row["id"]]
        if row["result"] is not None or session["finished_at"]:
            question["answer"] = row["answer"]
            if row["id"] in explanations:
                question["explanation"] = explanations[row["id"]]
            elif detail.get("explanation"):
                question["explanation"] = detail["explanation"]
            question["evidence"] = quote_from(passage_at(conn, row["book_id"], row["ordinal"]), detail.get("quote"))
        if row["result"] is not None:
            attempts.append({"questionId": row["id"], "response": row["response"], "result": row["result"]})
        questions.append(question)
    return {
        "id": session_id, "bookId": session["book_id"], "mode": session["mode"], "questions": questions,
        "attempts": attempts, "confusedNodeIds": [], "startedAt": session["started_at"], "finishedAt": session["finished_at"],
    }


@router.post("/books/{book_id}/quiz-sessions", status_code=201)
def start_quiz(book_id: str, body: QuizStart, conn: Db):
    session_id = uuid4().hex
    with write_transaction(conn):
        boundary = progress(conn, book_id)["confirmed"]
        has_genre = bool(analysis_for(conn, book_id).get("genre"))
        prefix = f"{book_id}-genre-" if has_genre else f"{book_id}-understand-"
        questions = rows(conn, """
            SELECT id FROM questions WHERE book_id = ? AND ordinal <= ?
              AND (? = 0 OR substr(id, 1, length(?)) = ?) ORDER BY ordinal DESC LIMIT ?
        """, book_id, boundary, int(has_genre or book_id in CURATED), prefix, prefix, body.count or (2 if body.mode == "recall" else 5))
        conn.execute("INSERT INTO quiz_sessions VALUES (?, ?, ?, ?, ?, NULL)", (session_id, book_id, boundary, body.mode, now()))
        conn.executemany(
            "INSERT INTO session_questions VALUES (?, ?, ?)",
            [(session_id, q["id"], i) for i, q in enumerate(questions)],
        )
        return session_view(conn, session_id)


@router.get("/quiz-sessions/{session_id}")
def get_session(session_id: str, conn: Db):
    return session_view(conn, session_id)


def normalized(text):
    return re.sub(r"[\W_]+", "", text.casefold())


@router.post("/quiz-sessions/{session_id}/attempts")
def answer_quiz(session_id: str, body: AnswerInput, conn: Db):
    with write_transaction(conn):
        session = session_at_current_progress(conn, session_id)
        question = one(conn, """
            SELECT q.* FROM session_questions sq JOIN questions q ON q.id = sq.question_id
            WHERE sq.session_id = ? AND q.id = ?
        """, session_id, body.questionId)
        if rows(conn, "SELECT 1 FROM quiz_attempts WHERE session_id = ? AND question_id = ?", session_id, body.questionId):
            return session_view(conn, session_id)
        if session["finished_at"]:
            raise HTTPException(409, "이미 끝난 퀴즈예요.")
        response = "" if body.giveUp else clean(body.response)
        accepted = [question["answer"], *json.loads(question["aliases"])]
        result = body.giveUp or ("correct" if normalized(response) in map(normalized, accepted) else "wrong")
        conn.execute("INSERT INTO quiz_attempts VALUES (?, ?, ?, ?)", (session_id, question["id"], response, result))
        if result == "correct":
            study(conn, 6, "점검 문항 정답")
        return session_view(conn, session_id)


@router.post("/quiz-sessions/{session_id}/finish")
def finish_quiz(session_id: str, conn: Db):
    with write_transaction(conn):
        session_at_current_progress(conn, session_id)
        finished = conn.execute("UPDATE quiz_sessions SET finished_at = ? WHERE id = ? AND finished_at IS NULL",
                                (now(), session_id)).rowcount
        if finished and rows(conn, "SELECT 1 FROM quiz_attempts WHERE session_id = ? LIMIT 1", session_id):
            study(conn, 10, "점검 완료")
        return session_view(conn, session_id)


class CaseSolution(BaseModel):
    situation: str = Field(max_length=24)
    reason: str = Field(max_length=24)
    action: str = Field(max_length=24)


def require_completed_case(conn, book_id):
    progress(conn, book_id)
    generated = analysis_for(conn, book_id).get("case") if book_id != STORY else None
    if book_id != STORY and not isinstance(generated, dict):
        raise HTTPException(404, "이 책에는 아직 완독 활동이 없어요.")
    final = one(conn, "SELECT MAX(ordinal) AS ordinal FROM passages WHERE book_id = ?", book_id)["ordinal"]
    if progress(conn, book_id)["confirmed"] != final:
        raise HTTPException(409, "책을 끝까지 읽으면 단서 게임이 열려요.")
    return generated


def case_evidence(conn, book_id):
    return [
        quote_from(one(conn, "SELECT * FROM passages WHERE book_id = ? AND text LIKE ? ORDER BY ordinal LIMIT 1", book_id, f"%{text}%"))
        for text in ("책장 아래쪽이 울퉁불퉁하게 부풀어", "이 책이 눌릴 것 같아서", "잠깐만. 넣지 말아 줘.")
    ]


def curated_case_view(conn, book_id, case):
    return {
        **{key: case[key] for key in ("title", "prompt", "cast", "cards", "slots", "verdictMood", "mode") if key in case},
        "evidence": [quote_from(passage_at(conn, book_id, ordinal)) for ordinal in case["evidence"]],
        "slotEvidence": {key: [quote_from(passage_at(conn, book_id, ordinal)) for ordinal in ordinals]
                         for key, ordinals in case.get("evidenceBySlot", {}).items()},
    }


@router.get("/books/{book_id}/case")
def read_case(book_id: str, conn: Db):
    generated = require_completed_case(conn, book_id)
    if generated:
        return curated_case_view(conn, book_id, generated)
    return {
        "prompt": "민서는 왜 반납함에 쪽지를 붙였을까?",
        "cast": STORY_CAST,
        "cards": CASE_CARDS, "slots": CASE_SLOTS, "evidence": case_evidence(conn, book_id),
    }


@router.get("/books/{book_id}/character-design")
def character_design(book_id: str, conn: Db):
    state = progress(conn, book_id)
    last = one(conn, "SELECT MAX(ordinal) AS ordinal FROM passages WHERE book_id = ?", book_id)["ordinal"]
    if state["confirmed"] != last:
        raise HTTPException(409, "완독 후 캐릭터 설계를 확인할 수 있어요.")
    draft = analysis_for(conn, book_id).get("characterDesigns") or {}
    selected = draft.get("selected")
    if not selected:
        raise HTTPException(404, "캐릭터 설계 미리보기가 아직 준비되지 않았어요.")
    character = selected["character"]
    return {**selected, "status": draft.get("status"), "character": {
        **character, "evidence": [quote_from(passage_at(conn, book_id, proof["ordinal"]), proof["quote"])
                                 for proof in character["evidence"]]}}


@router.post("/books/{book_id}/case/solve")
def solve_case(book_id: str, body: CaseSolution, conn: Db):
    with write_transaction(conn):
        generated = require_completed_case(conn, book_id)
        cards = generated["cards"] if generated else CASE_CARDS
        answer = generated["answer"] if generated else CASE_ANSWER
        solution = body.model_dump()
        choices = set(solution.values())
        if len(choices) != 3 or not choices <= {card["id"] for card in cards}:
            raise HTTPException(422, "서로 다른 단서 카드 세 장을 골라 주세요.")
        if generated and generated.get("mode") == "poetry_exam":
            if any(solution[slot["id"]] not in slot["choiceIds"] for slot in generated["slots"]):
                raise HTTPException(422, "각 문제에 해당하는 보기를 골라 주세요.")
        if solution != answer:
            return {
                "solved": False,
                "checks": {slot: card == answer[slot] for slot, card in solution.items()},
                "hint": ("다시 확인할 문제의 보기를 바꿔 보세요. 원문에서 힌트도 볼 수 있어요."
                         if generated and generated.get("mode") == "poetry_exam"
                         else "×가 표시된 칸을 바꿔 보세요. 필요하면 원문에서 힌트를 볼 수 있어요."),
            }
        cast = generated["cast"] if generated else STORY_CAST
        new_ids = award_cast(conn, cast, now())
        save_earned_cards(conn, book_id, cast)
        return {
            "solved": True, "explanation": generated["explanation"] if generated else CASE_EXPLANATION,
            "score": len(answer), "maxScore": len(answer),
            "slotExplanations": generated.get("slotExplanations", {}) if generated else {},
            "rewards": [
                {**item, "newlyEarned": item["id"] in new_ids}
                for item in cast_collectibles(conn, book_id, cast)
            ],
        }


def award_cast(conn, cast, earned_at):
    new_ids = set()
    for person in cast:
        person_id = person["id"]
        inserted = conn.execute("INSERT INTO collectibles VALUES (?, ?) ON CONFLICT(id) DO NOTHING", (person_id, earned_at))
        if inserted.rowcount:
            new_ids.add(person_id)
        conn.execute("INSERT INTO clue_game_rewards VALUES (?) ON CONFLICT(id) DO NOTHING", (person_id,))
    return new_ids


def save_earned_cards(conn, book_id, cast):
    book = conn.execute("SELECT title FROM books WHERE id = ?", (book_id,)).fetchone()
    title = book["title"] if book else sample_story()["title"]
    conn.executemany("""
        INSERT INTO character_cards(id, name, sprite, book_id, book_title)
        SELECT id, ?, ?, ?, ? FROM collectibles WHERE id = ? ON CONFLICT(id) DO NOTHING
    """, [(person["name"], person["sprite"], book_id, title, person["id"]) for person in cast])


def migrate_story_rewards(conn):
    record = conn.execute(
        "SELECT MIN(earned_at) earned_at FROM collectibles WHERE id IN (?, ?)",
        (MINSEO_ID, LEGACY_REWARD_ID),
    ).fetchone()
    if record["earned_at"]:
        award_cast(conn, STORY_CAST, record["earned_at"])
    save_earned_cards(conn, STORY, STORY_CAST)
    conn.execute("DELETE FROM collectibles WHERE id = ?", (LEGACY_REWARD_ID,))


def cast_collectibles(conn, book_id, cast):
    earned = {row["id"]: row["earned_at"] for row in rows(conn, "SELECT id, earned_at FROM collectibles")}
    book = conn.execute("SELECT title FROM books WHERE id = ?", (book_id,)).fetchone()
    title = book["title"] if book else sample_story()["title"]
    return [
        {
            **person, "bookId": book_id,
            "reason": f"「{title}」 완독 활동 해결",
            "earnedAt": earned.get(person["id"]),
            **({"characterId": person["id"]} if person["id"] in earned else {}),
        }
        for person in cast
    ]


@router.get("/me/collectibles")
def collectibles(conn: Db):
    result = []
    if conn.execute("SELECT 1 FROM books WHERE id = ?", (STORY,)).fetchone():
        result.extend(cast_collectibles(conn, STORY, STORY_CAST))
    for book in rows(conn, "SELECT book_id AS id, result FROM book_analysis"):
        activity = json.loads(book["result"])
        case = activity.get("case")
        if isinstance(case, dict):
            items = cast_collectibles(conn, book["id"], case["cast"])
            result.extend(item for item in items if activity.get("caseSource") != "genre" or item["earnedAt"])
    return result


def memo_view(conn, memo, boundary):
    book_id = memo["book_id"]
    item = {
        "id": memo["id"], "bookId": book_id, "type": memo["type"], "content": memo["content"],
        "quote": quote_from(passage_at(conn, book_id, memo["ordinal"]), memo["quote"]), "createdAt": memo["created_at"],
    }
    if memo["type"] == "hypothesis":
        revisions = []
        for revision in rows(conn, """
            SELECT r.*, o.outcome FROM revisions r LEFT JOIN revision_outcomes o ON o.revision_id = r.id
            WHERE r.memo_id = ? ORDER BY r.id
        """, memo["id"]):
            evidence = {"for": [], "against": []}
            for citation in rows(conn, "SELECT * FROM revision_evidence WHERE revision_id = ? AND ordinal <= ? ORDER BY ordinal", revision["id"], boundary):
                passage = passage_at(conn, book_id, citation["ordinal"])
                evidence[citation["stance"]].append(quote_from(passage, citation["quote"]))
            revisions.append({
                "content": revision["content"], "evidenceFor": evidence["for"],
                "evidenceAgainst": evidence["against"], "createdAt": revision["created_at"],
                **({"outcome": revision["outcome"]} if revision["outcome"] else {}),
            })
        due = memo["review_at"] is not None and memo["review_at"] <= boundary
        hypothesis = {
            "evidence": memo["evidence"], "confidence": memo["confidence"], "revisions": revisions,
            "reviewStatus": "revised" if revisions else "due" if due else "waiting",
        }
        if due:
            passage = passage_at(conn, book_id, memo["review_at"])
            hypothesis.update(reviewAt=location(passage), reviewEvidence={"for": [quote_from(passage)], "against": []})
        item["hypothesis"] = hypothesis
    return item


@router.get("/books/{book_id}/memos")
def memos(book_id: str, conn: Db, type: MemoType | None = None):
    boundary = progress(conn, book_id)["confirmed"]
    return [
        memo_view(conn, memo, boundary)
        for memo in rows(conn, "SELECT * FROM memos WHERE book_id = ? ORDER BY created_at DESC", book_id)
        if type is None or memo["type"] == type
    ]


@router.get("/books/{book_id}/memos/due")
def due_memos(book_id: str, conn: Db):
    return [memo for memo in memos(book_id, conn, "hypothesis") if memo["hypothesis"]["reviewStatus"] == "due"]


def get_memo_row(conn, book_id, memo_id):
    return one(conn, "SELECT * FROM memos WHERE book_id = ? AND id = ?", book_id, memo_id)


@router.get("/books/{book_id}/memos/{memo_id}")
def get_memo(book_id: str, memo_id: str, conn: Db):
    return memo_view(conn, get_memo_row(conn, book_id, memo_id), progress(conn, book_id)["confirmed"])


@router.post("/books/{book_id}/memos", status_code=201)
def create_memo(book_id: str, body: MemoInput, conn: Db, request_key: RequestKey = None):
    if book_id != body.bookId or (body.type == "hypothesis") != (body.hypothesis is not None):
        raise HTTPException(422, "책 또는 메모 유형이 일치하지 않아요.")
    memo_id = uuid4().hex
    with write_transaction(conn):
        state = progress(conn, book_id)
        existing = claim_request(conn, "memo", request_key, body, memo_id)
        if existing is not None:
            return get_memo(book_id, existing, conn)
        anchor, quote = validate_quote(conn, book_id, body.quote)
        hypothesis = body.hypothesis
        review_at = None
        if hypothesis:
            earliest = max(anchor["ordinal"], state["confirmed"])
            if hypothesis.reviewAt:
                review_at = resolve_location(conn, book_id, hypothesis.reviewAt)["ordinal"]
                if review_at <= earliest:
                    raise HTTPException(422, "아직 읽지 않은 후속 문단을 선택해 주세요.")
            else:
                # 이 이야기에서 손으로 연결한 단서 한 쌍. 실제 설명을 읽기 전에는 감춘다.
                if book_id == STORY and "젖은 소매를 등 뒤로 감췄다" in anchor["text"]:
                    payoff = conn.execute("""
                        SELECT ordinal FROM passages WHERE book_id = ? AND ordinal > ?
                        AND text LIKE '%%소매만 젖었고%%'
                    """, (book_id, earliest)).fetchone()
                    if payoff:
                        review_at = payoff["ordinal"]
            if review_at is None and not hypothesis.reviewAt:
                candidate = conn.execute("""
                    SELECT p.ordinal FROM passages p
                    WHERE p.book_id = ? AND p.ordinal > ?
                    ORDER BY EXISTS (
                        SELECT 1 FROM questions q WHERE q.book_id = p.book_id AND q.ordinal = p.ordinal
                    ) DESC, p.ordinal
                    LIMIT 1
                """, (book_id, earliest)).fetchone()
                review_at = candidate["ordinal"] if candidate is not None else None
        conn.execute(
            "INSERT INTO memos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (memo_id, book_id, anchor["ordinal"], body.type, clean(body.content), quote["text"], now(),
             clean(hypothesis.evidence) if hypothesis else None, hypothesis.confidence if hypothesis else None,
             review_at, state["confirmed"]),
        )
        study(conn, 3, "메모 작성")
        return get_memo(book_id, memo_id, conn)


@router.delete("/books/{book_id}/memos/{memo_id}", status_code=204)
def delete_memo(book_id: str, memo_id: str, conn: Db):
    with write_transaction(conn):
        if not conn.execute("DELETE FROM memos WHERE book_id = ? AND id = ?", (book_id, memo_id)).rowcount:
            raise HTTPException(404, "메모를 찾을 수 없어요.")
    return Response(status_code=204)


@router.post("/books/{book_id}/memos/{memo_id}/revisions")
def revise_memo(book_id: str, memo_id: str, body: RevisionInput, conn: Db):
    with write_transaction(conn):
        memo = get_memo_row(conn, book_id, memo_id)
        boundary = progress(conn, book_id)["confirmed"]
        if memo["review_at"] is None or memo["review_at"] > boundary:
            raise HTTPException(409, "후속 구간을 읽음으로 확정한 후 다시 확인해 주세요.")
        revision_id = conn.execute(
            "INSERT INTO revisions(memo_id, content, created_at) VALUES (?, ?, ?) RETURNING id",
            (memo_id, clean(body.content), now()),
        ).fetchone()["id"]
        if body.outcome:
            conn.execute("INSERT INTO revision_outcomes VALUES (?, ?)", (revision_id, body.outcome))
        for stance, quotes in (("for", body.evidenceFor), ("against", body.evidenceAgainst)):
            for quote in quotes:
                passage, citation = validate_quote(conn, book_id, quote, boundary)
                conn.execute(
                    "INSERT INTO revision_evidence VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
                    (revision_id, book_id, passage["ordinal"], stance, citation["text"]),
                )
        return get_memo(book_id, memo_id, conn)


@router.get("/me")
def me(conn: Db):
    default = {"id": getattr(conn, "account_id", None) or "local", "nickname": "독자", "interests": [], "onboarded": False, "createdAt": now()}
    return get_pref(conn, "profile", default)


@router.patch("/me")
def update_me(body: ProfilePatch, conn: Db):
    with write_transaction(conn):
        profile = {**me(conn), **body.model_dump(exclude_none=True)}
        set_pref(conn, "profile", profile)
        return profile


@router.get("/me/settings")
def settings(conn: Db):
    return get_pref(conn, "settings", {})


@router.patch("/me/settings")
def update_settings(body: dict[str, dict], conn: Db):
    with write_transaction(conn):
        value = settings(conn)
        if "layout" in body.get("display", {}) and body["display"]["layout"] not in ("auto", "mobile", "tablet"):
            raise HTTPException(422, "지원하지 않는 화면 모드예요.")
        for group in ("reader", "learning", "library", "display"):
            if group in body:
                value[group] = {**value.get(group, {}), **body[group]}
        set_pref(conn, "settings", value)
        return value


@router.get("/me/stats")
def stats(conn: Db):
    return {
        "bookCount": one(conn, "SELECT COUNT(*) total FROM library_books")["total"],
        "memoCount": one(conn, "SELECT COUNT(*) total FROM memos")["total"],
        "quizCount": one(conn, "SELECT COUNT(*) total FROM quiz_sessions WHERE finished_at IS NOT NULL")["total"],
        "characterCount": one(conn, "SELECT COUNT(*) total FROM collectibles")["total"],
    }


@router.get("/explore/characters", dependencies=[Depends(reader_identity)])
def explore_characters():
    return []
