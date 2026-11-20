from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import sqlite3

from fastapi.testclient import TestClient

from backend.app.game import get_pref, set_pref
from backend.app.reading import STORY
from backend.app.reading_app import app

ME = "/api/reading/me"
BOOK = f"/api/reading/books/{STORY}"


def test_game_contract_survives_retries_and_restart(tmp_path, monkeypatch):
    db = tmp_path / "village.db"
    monkeypatch.setenv("SPO_READING_DB", str(db))
    with TestClient(app) as client:
        assert client.get(f"{ME}/castle").json()["points"] == 35
        chapters = client.get(f"{BOOK}/content").json()["chapters"]
        end = {"chapter": len(chapters) - 1, "paragraph": len(chapters[-1]["paragraphs"]) - 1}
        for _ in range(2):
            client.put(f"{BOOK}/progress/confirmed", json=end).raise_for_status()
        assert client.get(f"{ME}/castle").json()["points"] == 45
        s = client.post(f"{BOOK}/quiz-sessions", json={"mode": "check"}).json()
        quiz = f"/api/reading/quiz-sessions/{s['id']}"
        for _ in range(2):
            client.post(f"{quiz}/attempts", json={"questionId": "key", "response": "손수건 아래"}).raise_for_status()
            client.post(f"{quiz}/finish").raise_for_status()
        assert client.get(f"{ME}/castle").json()["points"] == 61
        won = client.post(f"{BOOK}/case/solve", json={"situation": "wet", "reason": "crush", "action": "note"}).json()
        char = won["rewards"][0]["characterId"]
        owned = client.get(f"{ME}/characters").json()
        assert {c["id"] for c in owned} == {c["characterId"] for c in won["rewards"]}
        assert client.patch(f"{ME}/characters/{char}", json={"isPublic": True}).json()["isPublic"]
        pos = {"x": -0.2, "y": 2.35}
        place = {"id": char, "villagePosition": pos}
        client.put(f"{ME}/village", json=[place]).raise_for_status()
        assert client.put(f"{ME}/village", json=[{"id": char}, {"id": "unearned"}]).status_code == 404

        action_path = f"{ME}/castle/actions"
        upgrade = {"type": "upgrade", "charId": char}
        receipt = {"Idempotency-Key": "one-upgrade"}
        for _ in range(2):
            state = client.post(action_path, json=upgrade, headers=receipt).raise_for_status().json()
            assert state["points"] == 21 and state["defenders"][char]["level"] == 2
        assert client.post(action_path, json={"type": "ack"}, headers=receipt).status_code == 409
        assert client.post(action_path, json={"type": "slot", "index": 2, "charId": char}).status_code == 422
        client.post(action_path, json={"type": "slot", "index": 0, "charId": char}).raise_for_status()

        decor = f"{ME}/village/decor"
        assert client.post(f"{decor}/unlock", json={"kind": "well"}).status_code == 409
        assert "well" not in client.get(decor).json()["unlocked"]
        with ThreadPoolExecutor(2) as pool:
            results = list(pool.map(lambda _: client.post(f"{decor}/unlock", json={"kind": "bench"}), range(2)))
        assert all(r.status_code == 200 for r in results)
        assert client.get(f"{ME}/castle").json()["points"] == 6
        bench = {"id": "my-bench", "kind": "bench", "x": 52, "y": 63}
        scene = client.put(decor, json=[bench]).raise_for_status().json()
        assert bench in scene["items"] and any(item["kind"] == "house" for item in scene["items"])
        assert client.put(decor, json=[bench, bench]).status_code == 422
        memo = {"type": "memo", "bookId": STORY, "content": "메모", "quote": {
            "text": chapters[0]["paragraphs"][0], "location": {"chapter": 0, "paragraph": 0}}}
        header = {"Idempotency-Key": "first-note"}
        note = client.post(f"{BOOK}/memos", json=memo, headers=header).raise_for_status().json()
        assert client.post(f"{BOOK}/memos", json=memo, headers=header).json()["id"] == note["id"]
        assert client.get(f"{ME}/castle").json()["points"] == 9
        client.patch(f"{ME}/settings", json={"display": {"layout": "tablet"}}).raise_for_status()

    # Simulate time passing without sleeping or offering a production skip endpoint.
    with sqlite3.connect(db) as conn:
        conn.row_factory = sqlite3.Row
        state = get_pref(conn, "castle", None)
        state["lastStudyAt"] = (datetime.now(timezone.utc) - timedelta(minutes=11)).isoformat()
        set_pref(conn, "castle", state)
    conn.close()
    with TestClient(app) as client:
        state = client.get(f"{ME}/castle").json()
        assert state["hp"] == 96 and state["defenders"][char]["hp"] == 43
        assert state["slots"][0] == char and len(state["reports"]) == 1
        assert client.get(f"{ME}/castle").json()["reports"] == state["reports"]
        assert client.post(action_path, json={"type": "ack"}).json()["reports"][0]["seen"]
        card = next(c for c in client.get(f"{ME}/characters").json() if c["id"] == char)
        assert card["villagePosition"] == pos and card["isPublic"]
        assert client.get(decor).json() == scene
        assert client.get(f"{ME}/settings").json()["display"] == {"layout": "tablet"}
