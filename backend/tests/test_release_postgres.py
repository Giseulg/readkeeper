"""Exercise the production paths against a disposable loopback PostgreSQL database."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
import os
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.app import reading_identity
from backend.app.reading import STORY, open_db
from backend.app.reading_app import app


def test_vercel_preview_has_no_database_access(monkeypatch):
    import runpy
    monkeypatch.setenv("VERCEL_ENV", "preview")
    monkeypatch.setenv("VERCEL_GIT_COMMIT_SHA", "c" * 40)
    monkeypatch.setenv("READING_DATABASE_URL", "must-not-connect")
    application = runpy.run_path(str(Path(__file__).parents[2] / "api/index.py"))["app"]
    with TestClient(application) as client:
        assert client.get("/api/reading/version").json() == {"environment": "preview", "release": "c" * 40}
        assert client.get("/api/reading/me").status_code == 503


def test_production_refuses_non_korean_database(monkeypatch):
    from backend.app.reading_postgres import ReadingPostgres
    monkeypatch.setenv("READING_ENV", "production")
    monkeypatch.setenv("SUPABASE_URL", "https://aaaaaaaaaaaaaaaaaaaa.supabase.co")
    with pytest.raises(RuntimeError, match="Seoul"):
        ReadingPostgres("postgres://intereading_runtime.aaaaaaaaaaaaaaaaaaaa@aws-1-ap-south-1.pooler.supabase.com:5432/postgres", None)


def test_hosted_entrypoint_refuses_other_project(monkeypatch):
    import runpy
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("SUPABASE_URL", "https://aaaaaaaaaaaaaaaaaaaa.supabase.co")
    with pytest.raises(RuntimeError, match="SUPABASE_URL"):
        runpy.run_path(str(Path(__file__).parents[2] / "api/index.py"))


def test_production_requires_database(monkeypatch):
    monkeypatch.setenv("READING_ENV", "production")
    monkeypatch.delenv("READING_DATABASE_URL", raising=False)
    with pytest.raises(RuntimeError, match="READING_DATABASE_URL"):
        open_db()


@pytest.mark.skipif(not os.getenv("READING_TEST_ADMIN_URL"), reason="requires disposable PostgreSQL")
def test_two_readers_and_release(monkeypatch):
    import psycopg
    url = os.environ["READING_TEST_ADMIN_URL"]
    address = urlsplit(url)
    assert address.hostname in ("localhost", "127.0.0.1") and address.path == "/reading_test"
    migration = (Path(__file__).parents[1] / "scripts/reading_release_v1.sql").read_text(encoding="utf-8")
    with psycopg.connect(url, autocommit=True) as admin:
        admin.execute(migration)
        admin.execute(migration)
        database_id = str(admin.execute("SELECT database_id FROM reading_control.installation").fetchone()[0])
    for key, value in {
        "READING_TEST_LOCAL_PG": "1", "READING_ENV": "production", "READING_DATABASE_URL": url,
        "READING_DATABASE_ID": database_id, "RELEASE_SHA": "a" * 40,
        "SUPABASE_URL": "https://aaaaaaaaaaaaaaaaaaaa.supabase.co", "SUPABASE_PUBLISHABLE_KEY": "test",
        "FRONTEND_ORIGIN": "https://example.test", "READING_OPENAI_MODEL": "test",
    }.items():
        monkeypatch.setenv(key, value)
    monkeypatch.delenv("VERCEL_GIT_COMMIT_SHA", raising=False)
    users = {token: str(uuid4()) for token in ("alice", "alice-phone", "bob")}
    users["alice-phone"] = users["alice"]
    def auth_user(url, *, headers, timeout):
        token = headers["Authorization"].split()[1]
        return httpx.Response(200 if token in users else 401, json={"id": users.get(token)},
                              request=httpx.Request("GET", url))
    monkeypatch.setattr(reading_identity.httpx, "get", auth_user)
    api = "/api/reading"
    me, books = api + "/me", api + "/books"
    story = books + "/" + STORY
    a, phone, b = ({"Authorization": "Bearer " + key} for key in ("alice", "alice-phone", "bob"))
    with TestClient(app) as client:
        assert client.get(me).status_code == 401
        assert client.get(me, headers={"Authorization": "Bearer invalid"}).status_code == 401
        with ThreadPoolExecutor(2) as pool:
            assert list(pool.map(lambda h: client.get(me, headers=h).raise_for_status().json()["id"], (a, phone))) == [users["alice"]] * 2
        assert client.get(me, headers=b).json()["id"] == users["bob"]
        ch = client.get(story + "/content", headers=a).json()["chapters"]
        end = {"chapter": len(ch) - 1, "paragraph": len(ch[-1]["paragraphs"]) - 1}
        for h in (a, phone):
            client.put(story + "/progress/confirmed", headers=h, json=end).raise_for_status()
        assert client.get(story, headers=phone).json()["progress"]["percent"] == 100
        assert client.get(story, headers=b).json()["progress"]["percent"] == 0
        assert client.get(me + "/castle", headers=phone).json()["points"] == 45
        won = client.post(story + "/case/solve", headers=a, json={"situation":"wet", "reason":"crush", "action":"note"})
        won.raise_for_status()
        cards = client.get(me + "/characters", headers=phone).json()
        assert cards and all(c["ownerId"] == users["alice"] for c in cards)
        assert client.get(me + "/characters", headers=b).json() == []
        private = client.post(books, headers=a, data={"title":"Private", "category":"novel"},
                              files={"file":("test.txt", b"Private book text")}).raise_for_status().json()["id"]
        assert client.get(books + "/" + private, headers=b).status_code == 404
        assert client.get(books + "/" + private, headers=phone).status_code == 200
        with closing(open_db(users["alice"])) as conn:
            assert conn.execute("SELECT count(*) AS n FROM genre_analysis_jobs").fetchone()["n"] == 0
        assert client.get(api + "/health").json()["databaseId"] == database_id
        monkeypatch.setenv("RELEASE_SHA", "b" * 40)
        assert client.get(api + "/health").json()["release"] == "b" * 40
        assert client.get(api + "/health").json()["analysis"] == "on-request"
        monkeypatch.setenv("READING_DATABASE_ID", str(uuid4()))
        assert client.get(api + "/health").status_code == 503
        with closing(open_db()) as conn, pytest.raises(RuntimeError, match="Unexpected production"):
            conn.check_installation()
