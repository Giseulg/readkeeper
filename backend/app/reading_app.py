"""Reading API for the Vercel function and local development."""
import os
from contextlib import asynccontextmanager, closing

from fastapi import FastAPI, HTTPException

from .reading import init_reading_db, open_db, router
from .reading_identity import production, production_settings, release_sha
from .village import router as village_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_reading_db()
    yield


app = FastAPI(title="SpoKeeper Reading", lifespan=lifespan)


@app.middleware("http")
async def private_responses(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "private, no-store"
    return response


@app.get("/api/reading/version")
def version():
    return {"environment": "production" if production() else "development", "release": release_sha()}


@app.get("/api/reading/health")
def health():
    if not production():
        return {"environment": "development"}
    try:
        production_settings()
        with closing(open_db()) as conn:
            info = conn.check_installation()
    except (RuntimeError, ValueError, KeyError):
        raise HTTPException(503, "운영 서재 연결을 확인해 주세요.") from None
    return {**version(), "schema": info["schema_version"], "authOrigin": os.environ["SUPABASE_URL"],
            "databaseId": str(info["database_id"]), "analysis": "on-request"}


app.include_router(router)
app.include_router(village_router)
