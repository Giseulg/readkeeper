"""Persist and publish queued reading analyses."""
from contextlib import closing
from datetime import datetime, timedelta, timezone
from hashlib import sha256
import json
import logging
from random import Random
import sqlite3
from uuid import uuid4

from .genre_analysis import VERSION, AnalysisError, generate, generate_character_designs, generate_completion_riddle, generate_concept_flow, generate_solar_research_map, openai_parser, select_character_design

logger = logging.getLogger(__name__)

JOB_SCHEMA = """
CREATE TABLE IF NOT EXISTS genre_analysis_jobs (
    book_id TEXT PRIMARY KEY REFERENCES books ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'ready', 'failed')),
    token TEXT, updated_at TEXT NOT NULL
);
"""

def jobs_enabled(conn):
    if isinstance(conn, sqlite3.Connection):
        return True
    return conn.execute("SELECT to_regclass('genre_analysis_jobs') AS name").fetchone()["name"] is not None

def job_status(conn, book_id):
    if not jobs_enabled(conn):
        return None
    row = conn.execute("SELECT status FROM genre_analysis_jobs WHERE book_id = ?", (book_id,)).fetchone()
    return row["status"] if row else None

def enqueue(conn, book_id, now):
    from .reading_identity import production
    if production():
        raise RuntimeError("Production analysis runs within the reading request")
    return conn.execute("""
        INSERT INTO genre_analysis_jobs (book_id, status, updated_at) VALUES (?, 'queued', ?)
        ON CONFLICT(book_id) DO UPDATE SET status = 'queued', token = NULL, updated_at = excluded.updated_at
        WHERE genre_analysis_jobs.status = 'failed'
    """, (book_id, now)).rowcount == 1


def evidence_end(item):
    return max(proof["ordinal"] for proof in item["evidence"])

def anchor_id(book_id, kind, name):
    digest = sha256(name.strip().casefold().encode()).hexdigest()[:16]
    return f"{book_id}-{kind}-{digest}"

def package_analysis(book_id, output):
    questions, details, profiles = [], {}, {}
    sprites = {"novel": "d_criteria", "poetry": "d_sense", "cs_book": "d_sched", "paper": "d_criteria"}
    for section_number, section in enumerate(output["sections"]):
        for index, riddle in enumerate(section.get("riddles", [])):
            question_id = f"{book_id}-genre-{VERSION}-{section_number}-{index}"
            proof = max(riddle["evidence"], key=lambda evidence: evidence["ordinal"])
            questions.append((question_id, proof["ordinal"], riddle["prompt"],
                              riddle["choices"][riddle["answer_index"]], riddle["choices"]))
            details[question_id] = {"explanation": riddle["explanation"], "quote": proof["quote"]}
        for persona in section["personas"]:
            persona["id"] = anchor_id(book_id, "persona", persona["name"])
            persona["sprite"] = sprites[output["category"]]
            profiles.setdefault(persona["id"], persona)
    finale = output.pop("finale")
    cards, slots, answer = [], [], {}
    for key, slot in zip(("situation", "reason", "action"), finale["slots"]):
        slots.append({"id": key, "label": slot["label"]})
        answer[key] = uuid4().hex[:16]
        cards.extend([{"id": answer[key], "text": slot["correct_card"]},
                      {"id": uuid4().hex[:16], "text": slot["distractor_card"]}])
    # Place distractors independently of their slot and avoid revealing the answer in card order.
    Random(book_id).shuffle(cards)
    proof = finale["evidence"] + [cite for slot in finale["slots"] for cite in slot["evidence"]]
    cast = [{k: persona[k] for k in ("id", "name", "sprite")} for persona in profiles.values()][:3]
    case = {"prompt": finale["prompt"], "explanation": finale["explanation"], "cast": cast,
            "cards": cards, "slots": slots, "answer": answer,
            "evidence": list(dict.fromkeys(cite["ordinal"] for cite in proof))}
    return questions, details, case

def run_solar_research_map(parse):
    from .reading import CATALOG_SOLAR_PAPER, analysis_for, open_db, rows, save_book_analysis, write_transaction

    book_id = CATALOG_SOLAR_PAPER
    query = "SELECT ordinal, text FROM passages WHERE book_id = ? ORDER BY ordinal"
    with closing(open_db()) as conn:
        passages = rows(conn, query, book_id)
    logic = generate_solar_research_map(passages, parse)
    with closing(open_db()) as conn, write_transaction(conn):
        if passages != rows(conn, query, book_id):
            raise AnalysisError("Paper changed during analysis. Run the worker again.")
        stored = analysis_for(conn, book_id)
        stored["researchMap"] = {"source": "gemini", "logic": logic}
        save_book_analysis(conn, book_id, [], stored)

def run_character_design(book_id, parse):
    from .reading import analysis_for, open_db, rows, save_book_analysis, write_transaction

    query = "SELECT ordinal, text FROM passages WHERE book_id = ? ORDER BY ordinal"
    with closing(open_db()) as conn:
        book = conn.execute("SELECT category FROM books WHERE id = ?", (book_id,)).fetchone()
        if not book or book["category"] not in ("novel", "poetry", "cs_book", "paper"):
            raise AnalysisError("Book not found or genre is not supported")
        category = book["category"]
        passages = rows(conn, query, book_id)
        study = analysis_for(conn, book_id).get("studyMap") or {}
    # Reuse the reviewed chapter analysis to ground a concept character across the chapter.
    evidence_ordinals = {proof["ordinal"] for concept in study.get("flow", []) for proof in concept["evidence"]}
    design_source = [row for row in passages if row["ordinal"] in evidence_ordinals] if evidence_ordinals else passages
    designs = generate_character_designs(category, design_source, parse)
    selected = select_character_design(category, designs, parse)
    with closing(open_db()) as conn, write_transaction(conn):
        current = conn.execute("SELECT category FROM books WHERE id = ?", (book_id,)).fetchone()
        if not current or current["category"] != category or passages != rows(conn, query, book_id):
            raise AnalysisError("Book changed during analysis")
        stored = analysis_for(conn, book_id)
        stored["characterDesigns"] = {"source": "gemini", "status": "draft", "characters": designs, "selected": selected}
        save_book_analysis(conn, book_id, [], stored)

def run_concept_flow(book_id, parse):
    from .reading import analysis_for, open_db, rows, save_book_analysis, write_transaction

    query = "SELECT ordinal,text FROM passages WHERE book_id=? ORDER BY ordinal"
    with closing(open_db()) as conn:
        book = conn.execute("SELECT category FROM books WHERE id=?", (book_id,)).fetchone()
        if not book or book["category"] not in ("cs_book", "major"):
            raise AnalysisError("Select a technical textbook")
        passages = rows(conn, query, book_id)
    # This edition ends its explanatory chapter before the bibliography and simulator exercises.
    source = passages[:212] if book_id == "787b0dbd72c84041ba15f68a7f3a0c04" else passages
    flow = generate_concept_flow(source, parse)
    with closing(open_db()) as conn, write_transaction(conn):
        if passages != rows(conn, query, book_id):
            raise AnalysisError("Source changed while the concept flow was generated")
        stored = analysis_for(conn, book_id)
        stored["studyMap"] = {"source": "gemini", "flow": flow}
        save_book_analysis(conn, book_id, [], stored)

def publish_character_reward(book_id, parse):
    from .reading import analysis_for, open_db, rows, save_book_analysis, write_transaction

    query = "SELECT ordinal, text FROM passages WHERE book_id = ? ORDER BY ordinal"
    with closing(open_db()) as conn:
        original = analysis_for(conn, book_id)
        passages = rows(conn, query, book_id)
        book = conn.execute("SELECT category FROM books WHERE id = ?", (book_id,)).fetchone()
    selected = (original.get("characterDesigns") or {}).get("selected")
    if not selected:
        raise AnalysisError("Review a character design before publishing its reward")
    case = json.loads(json.dumps(original.get("case")))
    if not isinstance(case, dict):
        if not book or book["category"] not in ("paper", "cs_book", "major"):
            raise AnalysisError("Create the book's completion activity first")
        source = passages[:212] if book_id == "787b0dbd72c84041ba15f68a7f3a0c04" else passages
        finale = generate_completion_riddle(source, original.get("studyMap") or original.get("researchMap"),
                                             parse, book["category"])
        cards, slots, answer, evidence, explanations, evidence_by_slot = [], [], {}, [], {}, {}
        for key, slot in zip(("situation", "reason", "action"), finale["slots"]):
            correct, distractor = uuid4().hex[:16], uuid4().hex[:16]
            slots.append({"id": key, "label": slot["label"]})
            answer[key] = correct
            cards.extend([{"id": correct, "text": slot["correct_card"]},
                          {"id": distractor, "text": slot["distractor_card"]}])
            evidence.append(slot["evidence"][0])
            evidence_by_slot[key] = slot["evidence"]
            explanations[key] = slot["explanation"]
        Random(book_id).shuffle(cards)
        case = {"title": finale["title"], "prompt": finale["prompt"], "slots": slots,
                "cards": cards, "answer": answer, "explanation": finale["explanation"],
                "slotExplanations": explanations, "evidence": evidence, "evidenceBySlot": evidence_by_slot, "cast": []}
    subject = selected["character"]["subject"]
    cast = case.get("cast", [])
    # Existing identities preserve previously earned rewards.
    match = next((person for person in cast if person["name"].replace(" ", "") == subject.replace(" ", "")), None)
    if match is None:
        match = {"id": anchor_id(book_id, "reward", subject), "name": subject}
        cast.append(match)
    match["sprite"] = "recipe:" + json.dumps(selected["recipe"], ensure_ascii=False, separators=(",", ":"))
    case["cast"] = cast
    with closing(open_db()) as conn, write_transaction(conn):
        if original != analysis_for(conn, book_id) or passages != rows(conn, query, book_id):
            raise AnalysisError("Book changed during reward generation")
        original["case"] = case
        original["characterDesigns"]["status"] = "approved"
        save_book_analysis(conn, book_id, [], original)


def run_one(parse=None):
    from .reading import analysis_for, now, open_db, rows, save_book_analysis, write_transaction

    token = uuid4().hex
    with closing(open_db()) as conn:
        if not jobs_enabled(conn):
            raise RuntimeError("Apply the genre analysis migration before running this worker.")
        with write_transaction(conn):
            expired = (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()
            job = conn.execute("""
                SELECT j.book_id, b.category FROM genre_analysis_jobs j JOIN books b ON b.id = j.book_id
                WHERE j.status = 'queued' OR (j.status = 'running' AND j.updated_at < ?)
                ORDER BY j.updated_at, j.book_id LIMIT 1
            """, (expired,)).fetchone()
            if not job:
                return False
            book_id, category = job["book_id"], job["category"]
            conn.execute("UPDATE genre_analysis_jobs SET status = 'running', token = ?, updated_at = ? WHERE book_id = ?",
                         (token, now(), book_id))
        passages = rows(conn, "SELECT ordinal, text FROM passages WHERE book_id = ? ORDER BY ordinal", book_id)

    try:
        generated = generate(book_id, category, passages, parse if parse is not None else openai_parser())
        questions, details, case = package_analysis(book_id, generated)
        with closing(open_db()) as conn, write_transaction(conn):
            if conn.execute("""
                UPDATE genre_analysis_jobs SET status = 'ready', token = NULL, updated_at = ?
                WHERE book_id = ? AND token = ?
            """, (now(), book_id, token)).rowcount:
                stored = analysis_for(conn, book_id)
                stored["genre"] = generated
                stored.setdefault("questionDetails", {}).update(details)
                # Keep hand-authored final activities and original reward identities.
                if not isinstance(stored.get("case"), dict):
                    stored["case"] = case
                    stored["caseSource"] = "genre"
                save_book_analysis(conn, book_id, questions, stored)
    except Exception as error:
        logger.warning("Reading analysis failed for %s (%s)", book_id, type(error).__name__)
        with closing(open_db()) as conn, write_transaction(conn):
            conn.execute("""
                UPDATE genre_analysis_jobs SET status = 'failed', token = NULL, updated_at = ?
                WHERE book_id = ? AND token = ?
            """, (now(), book_id, token))
    return True
