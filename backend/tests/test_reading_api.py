import pytest
from fastapi.testclient import TestClient

from backend.app.reading import STORY
from backend.app.reading_app import app

PREFIX = f"/api/reading/books/{STORY}"


@pytest.fixture(autouse=True)
def use_local_reading_database(monkeypatch):
    monkeypatch.delenv("READING_DATABASE_URL", raising=False)


def test_reading_flow_persists_and_only_unlocks_confirmed_material(tmp_path, monkeypatch):
    monkeypatch.setenv("SPO_READING_DB", str(tmp_path / "reading.sqlite"))
    with TestClient(app) as client:
        chapters = client.get(f"{PREFIX}/content").json()["chapters"]
        first = chapters[0]["paragraphs"]
        second = chapters[1]["paragraphs"]
        later = {"chapter": 1, "paragraph": len(second) - 1}
        visited = client.put(f"{PREFIX}/progress/current", json=later).json()["progress"]
        assert visited["current"] == later
        assert visited["percent"] == 0
        assert client.get(f"{PREFIX}/graph").json()["nodes"] == []
        assert client.post(f"{PREFIX}/quiz-sessions", json={"mode": "check"}).json()["questions"] == []
        assert client.put(f"{PREFIX}/progress/confirmed", json={"chapter": 99, "paragraph": 0}).status_code == 422

        end_first = {"chapter": 0, "paragraph": len(first) - 1}
        client.put(f"{PREFIX}/progress/confirmed", json=end_first).raise_for_status()
        graph = client.get(f"{PREFIX}/graph").json()
        minseo = next(node for node in graph["nodes"] if node["name"] == "민서")
        assert "행적" in minseo["attributes"] and "중요한 물건" not in minseo["attributes"]
        assert {edge["relation"] for edge in graph["edges"]} == {"같은 반", "열쇠를 빌림"}
        session = client.post(f"{PREFIX}/quiz-sessions", json={"mode": "check"}).json()
        assert [q["id"] for q in session["questions"]] == ["sleeve"]
        assert "젖은 소매" in session["questions"][0]["choices"]
        assert "answer" not in session["questions"][0]
        assert "evidence" not in session["questions"][0]
        attempts = f"/api/reading/quiz-sessions/{session['id']}/attempts"
        assert client.post(attempts, json={"questionId": "key", "response": "손수건 아래"}).status_code == 404
        answer = {"questionId": "sleeve", "response": "젖은 소매"}
        submitted = client.post(attempts, json=answer).json()
        assert submitted["attempts"][0]["result"] == "correct"
        assert "젖은 소매" in submitted["questions"][0]["evidence"]["text"]
        assert client.post(attempts, json=answer).json()["attempts"] == submitted["attempts"]

        memo = client.post(f"{PREFIX}/memos", json={
            "bookId": STORY,
            "type": "hypothesis",
            "content": "민서는 무엇을 찾고 있었을까?",
            "quote": {"text": first[-1], "location": end_first},
            "hypothesis": {"evidence": "반납함 쪽을 살피고 있었다.", "confidence": 3},
        }).json()
        memo_path = f"{PREFIX}/memos/{memo['id']}"
        assert "reviewEvidence" not in memo["hypothesis"]
        assert client.get(f"{PREFIX}/memos/due").json() == []
        assert client.post(f"{memo_path}/revisions", json={"content": "너무 일찍 수정"}).status_code == 409

        client.put(f"{PREFIX}/progress/confirmed", json=later).raise_for_status()
        client.put(f"{PREFIX}/progress/confirmed", json=end_first).raise_for_status()
        result_session = client.post(f"{PREFIX}/quiz-sessions", json={"mode": "check"}).json()
        assert all("answer" not in question for question in result_session["questions"])
        finished = client.post(f"/api/reading/quiz-sessions/{result_session['id']}/finish").json()
        assert {q["answer"] for q in finished["questions"]} == {"젖은 소매", "손수건 아래"}
        assert all(q["evidence"] for q in finished["questions"])
        due = client.get(f"{PREFIX}/memos/due").json()[0]
        assert due["id"] == memo["id"]
        assert due["hypothesis"]["reviewEvidence"]["for"]
        future = {"location": {"chapter": 2, "paragraph": 0}, "text": chapters[2]["paragraphs"][0]}
        assert client.post(f"{memo_path}/revisions", json={"content": "수정", "evidenceFor": [future]}).status_code == 409
        client.post(f"{memo_path}/revisions", json={
            "content": "다음 장면의 단서를 확인했다.",
            "evidenceFor": due["hypothesis"]["reviewEvidence"]["for"],
        }).raise_for_status()

    with TestClient(app) as client:
        assert client.get(PREFIX).json()["progress"]["confirmed"] == later
        assert client.get(f"/api/reading/quiz-sessions/{session['id']}").json()["attempts"] == submitted["attempts"]


        hypothesis = client.get(memo_path).json()["hypothesis"]
        assert hypothesis["reviewStatus"] == "revised"
        assert hypothesis["revisions"][0]["content"] == "다음 장면의 단서를 확인했다."
        last = {"chapter": len(chapters) - 1, "paragraph": len(chapters[-1]["paragraphs"]) - 1}
        assert client.put(f"{PREFIX}/progress/confirmed", json=last).json()["progress"]["percent"] == 100
        restarted = client.post(f"{PREFIX}/progress/restart").json()["progress"]
        assert restarted["percent"] == 0
        assert restarted["current"] == {"chapter": 0, "paragraph": 0}
        assert client.get(PREFIX).json()["progress"] == restarted
        assert client.get(f"/api/reading/quiz-sessions/{session['id']}").status_code == 409
        assert client.post(f"{PREFIX}/quiz-sessions", json={"mode": "check"}).json()["questions"] == []
        assert client.get(memo_path).json()["hypothesis"]["revisions"][0]["content"] == "다음 장면의 단서를 확인했다."
        client.put(f"{PREFIX}/progress/confirmed", json=end_first).raise_for_status()
        assert client.get(f"/api/reading/quiz-sessions/{session['id']}").json()["attempts"] == submitted["attempts"]


def test_curated_clue_and_perfect_reading_reward(tmp_path, monkeypatch):
    monkeypatch.setenv("SPO_READING_DB", str(tmp_path / "rewards.sqlite"))
    with TestClient(app) as client:
        chapters = client.get(f"{PREFIX}/content").json()["chapters"]
        route = "/api/reading/me/collectibles"
        assert client.get(route).json()[0]["earnedAt"] is None
        anchor = next(i for i, p in enumerate(chapters[0]["paragraphs"]) if "젖은 소매를 등 뒤로" in p)
        quote = {"chapter": 0, "paragraph": anchor}
        client.put(f"{PREFIX}/progress/confirmed", json=quote).raise_for_status()
        memo = client.post(f"{PREFIX}/memos", json={
            "bookId": STORY, "type": "hypothesis", "content": "왜 소매를 숨겼을까?",
            "quote": {"text": chapters[0]["paragraphs"][anchor], "location": quote},
            "hypothesis": {"evidence": "젖은 소매를 감췄다.", "confidence": 3},
        }).raise_for_status().json()
        assert "reviewEvidence" not in memo["hypothesis"]
        early = client.post(f"{PREFIX}/quiz-sessions", json={"mode": "check"}).json()
        assert "reward" not in client.post(f"/api/reading/quiz-sessions/{early['id']}/finish").json()
        solution = {"situation": "wet", "reason": "crush", "action": "note"}
        assert client.get(f"{PREFIX}/case").status_code == 409
        assert client.post(f"{PREFIX}/case/solve", json=solution).status_code == 409
        payoff = next(i for i, p in enumerate(chapters[3]["paragraphs"]) if "소매만 젖었고" in p)
        client.put(f"{PREFIX}/progress/confirmed", json={"chapter": 3, "paragraph": payoff - 1}).raise_for_status()
        assert client.get(f"{PREFIX}/memos/due").json() == []
        client.put(f"{PREFIX}/progress/confirmed", json={"chapter": 3, "paragraph": payoff}).raise_for_status()
        due = client.get(f"{PREFIX}/memos/due").json()[0]
        assert "소매만 젖었고" in due["hypothesis"]["reviewEvidence"]["for"][0]["text"]
        revised = client.post(f"{PREFIX}/memos/{memo['id']}/revisions", json={
            "content": "책을 꺼내려다가 젖었다.", "outcome": "changed",
            "evidenceFor": due["hypothesis"]["reviewEvidence"]["for"],
        }).raise_for_status().json()
        assert revised["hypothesis"]["revisions"][0]["outcome"] == "changed"
        client.put(f"{PREFIX}/progress/confirmed", json={
            "chapter": 3, "paragraph": len(chapters[3]["paragraphs"]) - 1,
        }).raise_for_status()
        answers = {
            "sleeve": "젖은 소매", "key": "손수건 아래",
            "blue": "손에 파란 물이 묻어서", "note": "책이 더 들어와 젖은 책이 눌릴까 봐",
        }

        def finish_with(skip=False):
            session = client.post(f"{PREFIX}/quiz-sessions", json={"mode": "check"}).raise_for_status().json()
            session_path = f"/api/reading/quiz-sessions/{session['id']}"
            for question in session["questions"]:
                body = {"questionId": question["id"], "response": answers[question["id"]]}
                if skip and question["id"] == "sleeve":
                    body.update(response="", giveUp="skipped")
                client.post(f"{session_path}/attempts", json=body).raise_for_status()
            return session_path

        assert "reward" not in client.post(f"{finish_with(skip=True)}/finish").json()
        assert "reward" not in client.post(f"{finish_with()}/finish").json()
        case = client.get(f"{PREFIX}/case").raise_for_status().json()
        assert len(case["cards"]) == 6 and len(case["evidence"]) == 3
        assert "answer" not in case
        duplicate = {**solution, "reason": "wet"}
        assert client.post(f"{PREFIX}/case/solve", json=duplicate).status_code == 422
        wrong = client.post(f"{PREFIX}/case/solve", json={**solution, "reason": "rain"}).raise_for_status().json()
        assert wrong["solved"] is False and "rewards" not in wrong
        assert wrong["checks"] == {"situation": True, "reason": False, "action": True}
        assert client.get(route).json()[0]["earnedAt"] is None
        won = client.post(f"{PREFIX}/case/solve", json=solution).raise_for_status().json()
        assert won["solved"] is True and won["explanation"]
        first = won["rewards"]
        assert {item["name"] for item in first} == {"지우", "도윤", "민서"}
        assert all(item["newlyEarned"] for item in first)
        assert client.get("/api/reading/me/stats").json()["characterCount"] == 3
        repeated = client.post(f"{PREFIX}/case/solve", json=solution).json()["rewards"]
        assert len(repeated) == 3 and not any(item["newlyEarned"] for item in repeated)
        client.post(f"{PREFIX}/progress/restart").raise_for_status()
        assert client.get(f"{PREFIX}/graph").json()["nodes"] == []

    with TestClient(app) as client:
        collection = client.get(route).json()
        assert len(collection) == 3
        assert {item["id"]: item["earnedAt"] for item in collection} == {
            item["id"]: item["earnedAt"] for item in first
        }

def test_existing_rewards_are_converted_to_story_cast(tmp_path, monkeypatch):
    import sqlite3

    for old_id in ("rain-frog", "rain-return-box-minseo"):
        database = tmp_path / f"{old_id}.sqlite"
        monkeypatch.setenv("SPO_READING_DB", str(database))
        with TestClient(app):
            pass
        connection = sqlite3.connect(database)
        try:
            with connection:
                connection.execute("PRAGMA foreign_keys = ON")
                connection.execute("INSERT INTO collectibles VALUES (?, ?)", (old_id, "2026-11-20"))
                connection.execute("INSERT INTO clue_game_rewards VALUES (?)", (old_id,))
        finally:
            connection.close()
        with TestClient(app) as client:
            cast = client.get("/api/reading/me/collectibles").json()
            assert len(cast) == 3 and all(item["earnedAt"] == "2026-11-20" for item in cast)
            characters = client.get("/api/reading/me/characters").raise_for_status().json()
            assert {c["id"] for c in characters} == {item["characterId"] for item in cast}
            assert all(c["acquiredAt"] == "2026-11-20" for c in characters)
            assert client.get("/api/reading/me/stats").json()["characterCount"] == 3
