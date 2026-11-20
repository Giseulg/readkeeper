"""Verified reader identity for the production reading service."""
import os
import re
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from fastapi import Header, HTTPException


def production():
    mode = os.getenv("READING_ENV", "development")
    if mode not in ("production", "development", "test"):
        raise RuntimeError("Unknown READING_ENV")
    return mode == "production"


def https_origin(name):
    value = os.environ.get(name, "").rstrip("/")
    url = urlsplit(value)
    if url.scheme != "https" or not url.hostname or url.netloc != url.hostname or url.path or url.query or url.fragment:
        raise RuntimeError(f"{name} must be an HTTPS origin")
    return value


def release_sha():
    return os.getenv("VERCEL_GIT_COMMIT_SHA") or os.getenv("RELEASE_SHA", "")


def production_settings():
    https_origin("SUPABASE_URL")
    if not os.getenv("SUPABASE_PUBLISHABLE_KEY") or not os.getenv("READING_DATABASE_URL"):
        raise RuntimeError("Missing Supabase Auth or reading database configuration")
    if not re.fullmatch(r"https://[a-z0-9]{20}\.supabase\.co", https_origin("SUPABASE_URL")):
        raise RuntimeError("Expected a hosted Supabase project origin")
    UUID(os.environ["READING_DATABASE_ID"])
    if not re.fullmatch("[0-9a-f]{40}", release_sha()):
        raise RuntimeError("RELEASE_SHA must be the full Git commit")


def reader_identity(authorization: str | None = Header(default=None)):
    if not production():
        return None
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(401, "로그인이 필요해요.")
    try:
        response = httpx.get(https_origin("SUPABASE_URL") + "/auth/v1/user",
                             headers={"Authorization": "Bearer " + token,
                                      "apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"]}, timeout=5)
        if response.status_code in (401, 403):
            raise HTTPException(401, "로그인이 만료됐어요. 다시 로그인해 주세요.")
        response.raise_for_status()
        return str(UUID(response.json()["id"]))
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "로그인 서버에 연결할 수 없어요.") from None
