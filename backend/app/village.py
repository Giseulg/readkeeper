"""Persistent village and castle for the single-reader API."""
from collections import Counter
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

from .game import apply_action, castle_state, claim_request, get_pref, next_raid, points, set_pref
from .reading import Db, RequestKey, write_transaction

router = APIRouter(prefix="/api/reading/me", tags=["village"])


def character_list(conn):
    return [{
        "id": r["id"], "name": r["name"], "sprite": r["sprite"], "bookId": r["book_id"],
        "bookTitle": r["book_title"], "acquiredReason": f"「{r['book_title']}」 완독 활동 해결",
        "acquiredAt": r["earned_at"], "ownerId": getattr(conn, "account_id", None) or "local", "isPublic": bool(r["is_public"]),
        **({"villagePosition": {"x": r["x"], "y": r["y"]}} if r["x"] is not None else {}),
    } for r in conn.execute("SELECT * FROM character_cards JOIN collectibles USING(id) ORDER BY earned_at, id")]


@router.get("/characters")
def characters(conn: Db):
    return character_list(conn)


class Visibility(BaseModel):
    isPublic: bool


@router.patch("/characters/{char_id}")
def visibility(char_id: str, body: Visibility, conn: Db):
    with write_transaction(conn):
        if not conn.execute("UPDATE character_cards SET is_public=? WHERE id=?", (body.isPublic, char_id)).rowcount:
            raise HTTPException(404, "보유한 캐릭터가 아니에요.")
        return next(c for c in character_list(conn) if c["id"] == char_id)


class Position(BaseModel):
    # Dragging the character's feet to a scene edge can yield fractional or negative tile coordinates.
    x: float = Field(ge=-1, le=10, allow_inf_nan=False)
    y: float = Field(ge=-2, le=7, allow_inf_nan=False)


class Placement(BaseModel):
    id: str
    villagePosition: Position | None = None


@router.put("/village")
def place(body: Annotated[list[Placement], Body(max_length=500)], conn: Db):
    with write_transaction(conn):
        for item in body:
            p = item.villagePosition
            if not conn.execute("UPDATE character_cards SET x=?, y=? WHERE id=?",
                                (p.x if p else None, p.y if p else None, item.id)).rowcount:
                raise HTTPException(404, "보유한 캐릭터가 아니에요.")
        return character_list(conn)


class SimpleAction(BaseModel):
    type: Literal["repair", "ack"]


class DefenderAction(BaseModel):
    type: Literal["upgrade", "heal"]
    charId: str


class SlotAction(BaseModel):
    type: Literal["slot"]
    charId: str | None
    index: int = Field(ge=0, lt=25)


def castle_view(state):
    raid = next_raid(state)
    return {**state, **({"nextRaid": raid} if raid else {})}


@router.get("/castle")
def castle(conn: Db):
    with write_transaction(conn):
        at = datetime.now(timezone.utc)
        state = castle_state(conn, at)
        day = at.date().isoformat()
        if state.get("lastVisitDay") != day:
            points(state, 5, "오늘의 방문", at)
            state["lastVisitDay"] = day
        set_pref(conn, "castle", state)
        return castle_view(state)


@router.post("/castle/actions")
def act(body: Annotated[SimpleAction | DefenderAction | SlotAction, Body(discriminator="type")],
        conn: Db, request_key: RequestKey = None):
    with write_transaction(conn):
        at = datetime.now(timezone.utc)
        state = castle_state(conn, at)
        if claim_request(conn, "castle", request_key, body, "castle") is None:
            apply_action(state, body, at)
        set_pref(conn, "castle", state)
        return castle_view(state)


# Cost and per-scene limit from the frontend's DECOR_CATALOG.
DECOR = {"house": (0, 1), "tree": (0, 8), "bush": (0, 8), "flowerv": (0, 10), "flowery": (0, 10),
         "sign": (0, 3), "fence": (0, 10), "lamp": (0, 4), "rock": (5, 6), "mailbox": (10, 2),
         "bench": (15, 4), "well": (30, 1)}
INITIAL_ITEMS = (
    ("house", "house", 50, 20), ("lamp", "lamp", 62, 20), ("tree1", "tree", 12, 18),
    ("tree2", "tree", 88, 20), ("tree3", "tree", 10, 100), ("fence", "fence", 80, 42),
    ("bush1", "bush", 14, 50), ("bush2", "bush", 30, 96), ("flower1", "flowerv", 22, 44),
    ("flower2", "flowery", 40, 86), ("flower3", "flowery", 92, 50), ("sign", "sign", 42, 52),
)


@router.get("/village/decor")
def layout(conn: Db):
    return get_pref(conn, "village_decor", {
        "items": [{"id": f"d-{key}", "kind": kind, "x": x, "y": y} for key, kind, x, y in INITIAL_ITEMS],
        "unlocked": [kind for kind, (cost, _) in DECOR.items() if cost == 0],
    })


class DecorKind(BaseModel):
    kind: str


class DecorItem(DecorKind):
    id: str = Field(min_length=1, max_length=128)
    x: float = Field(allow_inf_nan=False)
    y: float = Field(allow_inf_nan=False)


@router.put("/village/decor")
def save_decor(body: Annotated[list[DecorItem], Body(max_length=128)], conn: Db):
    with write_transaction(conn):
        scene = layout(conn)
        counts = Counter(item.kind for item in body)
        items = []
        for item in body:
            if item.kind not in scene["unlocked"] or counts[item.kind] > DECOR[item.kind][1]:
                raise HTTPException(422, "소품 해금 여부와 최대 배치 수를 확인해 주세요.")
            items.append({**item.model_dump(), "x": round(max(2, min(98, item.x)), 1),
                          "y": round(max(4, min(100, item.y)), 1)})
        if not counts["house"]:
            items.append(next(old for old in scene["items"] if old["kind"] == "house"))
        if len({item["id"] for item in items}) != len(items):
            raise HTTPException(422, "소품 ID가 중복됐어요.")
        scene["items"] = items
        set_pref(conn, "village_decor", scene)
        return scene


@router.post("/village/decor/unlock")
def unlock(body: DecorKind, conn: Db):
    if body.kind not in DECOR:
        raise HTTPException(422, "등록되지 않은 소품이에요.")
    with write_transaction(conn):
        scene = layout(conn)
        if body.kind not in scene["unlocked"]:
            at = datetime.now(timezone.utc)
            state = castle_state(conn, at)
            points(state, -DECOR[body.kind][0], "마을 소품 해금", at)
            scene["unlocked"].append(body.kind)
            set_pref(conn, "castle", state)
            set_pref(conn, "village_decor", scene)
        return scene
