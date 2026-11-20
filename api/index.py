"""Same-deployment entry point for Vercel's Python runtime."""
import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException

def create_app():
    if os.getenv("VERCEL_ENV") == "production":
        target = json.loads((Path(__file__).resolve().parents[1] / "backend/app/production-target.json").read_text())
        for key, expected in (("SUPABASE_URL", target["authOrigin"]), ("READING_DATABASE_ID", target["databaseId"])):
            if os.environ.setdefault(key, expected) != expected:
                raise RuntimeError(f"{key} does not match the approved production project")
        os.environ["READING_ENV"] = "production"
        from backend.app.reading_app import app as reading_app
        return reading_app

    # A preview validates routing without opening the team's production database.
    preview = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

    @preview.get("/api/reading/version")
    def preview_version():
        return {"environment": "preview", "release": os.getenv("VERCEL_GIT_COMMIT_SHA")}

    @preview.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
    def preview_unavailable(path: str):
        raise HTTPException(503, "프리뷰에서는 운영 서재에 접근할 수 없어요.")

    return preview


app = create_app()
