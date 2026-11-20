from contextlib import closing

from fastapi.testclient import TestClient
import pytest

from backend.app.genre_analysis import GENRES, PaperFinale
from backend.app.genre_jobs import run_one
from backend.app.reading import open_db
from backend.app.reading_app import app

FIRST = "The first clue is a light."
LAST = "The final clue explains the result."
SOURCE = f"{FIRST}\n\n{LAST}"

def example_reply(schema, instructions, payload):
    early = [{"ordinal": 0, "quote": FIRST}]
    late = [{"ordinal": 1, "quote": LAST}]
    fields = schema.model_fields
    if "slots" in fields:
        value = {
            "prompt": "Which clues fit?",
            "explanation": "Each clue supports the conclusion.",
            "evidence": late,
            "slots": [{"label": f"Slot {i}", "correct_card": f"Correct {i}",
                       "distractor_card": f"Incorrect {i}", "evidence": late} for i in range(3)],
        }
        if schema is PaperFinale:
            value["research_overview"] = [
                {"stage": "problem", "title": "Whole-work claim", "explanation": FIRST,
                 "prior_stage_indexes": [], "connections": [], "comparisons": [], "evidence": early},
                {"stage": "result", "title": "Whole-work result", "explanation": LAST,
                 "prior_stage_indexes": [0], "comparisons": [], "evidence": late,
                 "connections": [{"prior_index": 0, "reason": LAST, "evidence": late}]},
            ]
        return schema.model_validate(value)

    kind = "person" if "items" in fields else "speaker" if "imagery" in fields else "concept" if "flow" in fields else "method"
    value = {
        "summary": [{"title": "Early summary", "description": FIRST, "evidence": early}],
        "personas": [{"name": "Late profile", "subject_kind": kind, "personality": "Careful",
                      "voice": "Quiet", "motivation": "Clarity", "emblem": "Light", "appearance": "Coat",
                      "evidence": late}],
        "riddles": [{"prompt": "What is the clue?", "choices": ["Light", "Shadow", "Noise"], "answer_index": 0,
                     "explanation": "The opening mentions a light.", "evidence": early}],
    }
    if "items" in fields:
        value.update(
            items=[{"name": "Early symbol", "kind": "symbol", "description": FIRST, "evidence": early},
                   {"name": "Late profile", "kind": "person", "description": LAST, "evidence": late}],
            links=[{"source_index": 0, "target_index": 1, "relation": "explains",
                    "explanation": LAST, "evidence": late}],
        )
    if "imagery" in fields:
        value["imagery"] = [{"term": "Test imagery", "literal_meaning": "Light", "contextual_meaning": "Hope",
                             "imagery": "Visual", "emotion": "Hopeful", "evidence": early}]
    if "flow" in fields:
        value["flow"] = [{"stage": "concept", "title": "Test concept", "explanation": FIRST,
                          "analogy": "A lamp", "evidence": early}]
    if "logic" in fields:
        value["logic"] = [{"stage": "problem", "title": "Test research", "explanation": FIRST,
                           "prior_stage_indexes": [], "connections": [], "comparisons": [], "evidence": early}]
    return schema.model_validate(value)

@pytest.fixture
def local_db(monkeypatch, tmp_path):
    monkeypatch.delenv("READING_DATABASE_URL", raising=False)
    monkeypatch.setenv("SPO_READING_DB", str(tmp_path / "genre.db"))
    monkeypatch.setenv("READING_OPENAI_MODEL", "fixture")

@pytest.mark.parametrize("category", GENRES)
def test_genre_pregeneration_and_progress(local_db, category):
    with TestClient(app) as client:
        added = client.post("/api/reading/books", data={"title": "Genre test", "category": category},
                            files={"file": ("genre.txt", SOURCE.encode())}).raise_for_status().json()
        path = f"/api/reading/books/{added['id']}"
        assert client.get(path + "/graph").json()["analysisStatus"] == "queued"
        assert run_one(example_reply)
        unread = client.get(path + "/graph").json()
        assert unread["analysis"]["category"] == category
        assert FIRST not in str(unread)
        assert client.get(path + "/case").status_code == 409
        client.put(path + "/progress/confirmed", json={"chapter": 0, "paragraph": 0}).raise_for_status()
        partial = client.get(path + "/graph").json()
        assert FIRST in str(partial) and LAST not in str(partial) and "Late profile" not in str(partial)
        assert "answer_index" not in str(partial) and "Whole-work" not in str(partial)
        session = client.post(path + "/quiz-sessions", json={"mode": "check"}).raise_for_status().json()
        question = session["questions"][0]
        assert question["choices"][0] == "Light" and "answer" not in question
        result = client.post(f"/api/reading/quiz-sessions/{session['id']}/attempts",
                             json={"questionId": question["id"], "response": "Light"}).raise_for_status().json()
        assert result["attempts"][0]["result"] == "correct"
        client.put(path + "/progress/confirmed", json={"chapter": 0, "paragraph": 1}).raise_for_status()
        complete = client.get(path + "/graph").json()
        assert "Late profile" in str(complete)
        assert ("Whole-work result" in str(complete)) == (category == "paper")
        if category == "novel":
            assert len(complete["edges"]) == 1
        assert "Late profile" not in str(client.get("/api/reading/me/collectibles").json())
        case = client.get(path + "/case").raise_for_status().json()
        assert "answer" not in case
        by_text = {card["text"]: card["id"] for card in case["cards"]}
        body = {slot["id"]: by_text[f"Correct {index}"] for index, slot in enumerate(case["slots"])}
        solved = client.post(path + "/case/solve", json=body).raise_for_status().json()
        assert solved["rewards"][0]["newlyEarned"]
        assert not client.post(path + "/case/solve", json=body).json()["rewards"][0]["newlyEarned"]
        client.post(path + "/progress/restart").raise_for_status()
        assert client.get(path + "/case").status_code == 409
        assert LAST not in str(client.get(path + "/graph").json())
        with closing(open_db()) as conn:
            assert conn.execute("SELECT COUNT(*) AS count FROM quiz_attempts WHERE session_id = ?", (session["id"],)).fetchone()["count"] == 1

def test_bad_evidence_rejected_and_job_retried(local_db):
    def bad_reply(schema, instructions, payload):
        reply = example_reply(schema, instructions, payload)
        reply.summary[0].evidence[0].quote = "Not in the source"
        return reply

    with TestClient(app) as client:
        added = client.post("/api/reading/books", data={"title": "Retry test", "category": "poetry"},
                            files={"file": ("poem.txt", SOURCE.encode())}).raise_for_status().json()
        path = f"/api/reading/books/{added['id']}"
        assert run_one(bad_reply)
        graph = client.get(path + "/graph").json()
        assert graph["analysisStatus"] == "failed" and "analysis" not in graph
        assert client.post(path + "/analysis/retry").status_code == 202
        assert run_one(example_reply)
        assert client.get(path + "/graph").json()["analysisStatus"] == "ready"
