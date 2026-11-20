"""Castle rules shared by the reading rewards and village endpoints."""
import json
from hashlib import sha256
from datetime import datetime, timedelta, timezone
from math import ceil

from fastapi import HTTPException


WAVES = (
    (10, 5, {"ninja": 2}), (60, 45, {"ninja": 4}),
    (1440, 20, {"ninja": 2, "thief": 2}), (10080, 5, {"thief": 2}),
    (43200, 5, {"thief": 3}),
)
MAX_HP = {1: 30, 2: 45, 3: 60}
BLOCK = {1: 10, 2: 15, 3: 20}


def get_pref(conn, key, default):
    row = conn.execute("SELECT value FROM preferences WHERE key = ?", (key,)).fetchone()
    return json.loads(row["value"]) if row is not None else default


def set_pref(conn, key, value):
    conn.execute(
        "INSERT INTO preferences VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, json.dumps(value)),
    )


def points(state, amount, reason, at):
    if state["points"] + amount < 0:
        raise HTTPException(409, "지식 포인트가 부족해요.")
    state["points"] += amount
    state["pointLog"].insert(0, {"at": at.isoformat(), "amount": amount, "reason": reason})
    del state["pointLog"][10:]


def claim_request(conn, scope, key, body, resource):
    """Record a request inside the mutation transaction so failure also releases the key."""
    if key is None:
        return None
    digest = sha256(body.model_dump_json().encode()).hexdigest()
    inserted = conn.execute("INSERT INTO game_requests VALUES (?, ?, ?, ?) ON CONFLICT(scope, key) DO NOTHING",
                            (scope, key, digest, resource))
    if inserted.rowcount:
        return None
    record = conn.execute("SELECT digest, resource FROM game_requests WHERE scope=? AND key=?", (scope, key)).fetchone()
    if record["digest"] != digest:
        raise HTTPException(409, "같은 요청 키에 다른 내용이 전달됐어요.")
    return record["resource"]


def next_raid(state):
    wave = state["wavesDone"]
    if wave >= len(WAVES):
        return None
    minutes, _, enemies = WAVES[wave]
    at = datetime.fromisoformat(state["lastStudyAt"]) + timedelta(minutes=minutes)
    return {"wave": wave, "at": at.isoformat(),
            "enemies": [{"kind": kind, "count": count} for kind, count in enemies.items()]}


def resolve_raids(state, at):
    while raid := next_raid(state):
        if datetime.fromisoformat(raid["at"]) > at:
            break
        wave = raid["wave"]
        raw = WAVES[wave][1]
        alive = [key for key in state["slots"] if key and state["defenders"][key]["hp"] > 0]
        rate = min(60, sum(BLOCK[state["defenders"][key]["level"]] for key in alive))
        blocked = (raw * rate + 50) // 100
        before = state["hp"]
        state["hp"] = max(0, before - raw + blocked)
        hits = []
        for key in alive:
            defender = state["defenders"][key]
            damage = min(defender["hp"], ceil(raw * 0.3))
            defender["hp"] -= damage
            hits.append({"charId": key, "damage": damage, "hpAfter": defender["hp"]})
        state["reports"].insert(0, {**raid, "id": f'{raid["at"]}/{wave}', "seen": False,
                                   "rawDamage": raw, "blocked": blocked, "castleHpBefore": before,
                                   "castleHpAfter": state["hp"], "defenders": hits})
        del state["reports"][10:]
        state["wavesDone"] += 1


def castle_state(conn, at):
    owned = [row["id"] for row in conn.execute("SELECT id FROM character_cards JOIN collectibles USING(id) ORDER BY earned_at, id")]
    state = get_pref(conn, "castle", None)
    if state is None:
        state = {"hp": 100, "maxHp": 100, "points": 0, "slots": [None] * 25,
                 "defenders": {}, "lastStudyAt": at.isoformat(), "wavesDone": 0,
                 "reports": [], "pointLog": []}
        for slot, key in zip((6, 8, 12), owned):
            state["slots"][slot] = key
        points(state, 30, "지식의 성 건설 기념", at)
    for key in owned:
        state["defenders"].setdefault(key, {"level": 1, "hp": MAX_HP[1]})
    resolve_raids(state, at)
    return state


def study(conn, amount, reason):
    """Called within the same write transaction as the first accepted learning event."""
    at = datetime.now(timezone.utc)
    state = castle_state(conn, at)
    points(state, amount, reason, at)
    state.update(lastStudyAt=at.isoformat(), wavesDone=0)
    set_pref(conn, "castle", state)


def apply_action(state, action, at):
    kind = action.type
    if kind == "ack":
        for report in state["reports"]:
            report["seen"] = True
    elif kind == "repair":
        if state["hp"] == state["maxHp"]:
            raise HTTPException(409, "성이 이미 온전해요.")
        points(state, -20, "성 수리", at)
        state["hp"] = min(state["maxHp"], state["hp"] + 25)
    elif kind == "slot":
        slots, i, key = state["slots"], action.index, action.charId
        if i == 2:
            raise HTTPException(422, "이 칸은 배치할 수 없어요.")
        if key is not None:
            if key not in state["defenders"]:
                raise HTTPException(404, "보유한 캐릭터가 아니에요.")
            if key in slots:
                slots[slots.index(key)] = slots[i]
            elif slots[i] is None and sum(old is not None for old in slots) >= 4:
                raise HTTPException(409, "최대 4명까지 배치할 수 있어요.")
        slots[i] = key
    else:
        defender = state["defenders"].get(action.charId)
        if defender is None:
            raise HTTPException(404, "보유한 캐릭터가 아니에요.")
        level = defender["level"]
        if kind == "upgrade":
            if level == 3:
                raise HTTPException(409, "이미 최고 등급이에요.")
            points(state, -40 if level == 1 else -80, "수호 등급 해금", at)
            defender["level"] += 1
        else:
            if defender["hp"] == MAX_HP[level]:
                raise HTTPException(409, "이미 체력이 가득해요.")
            points(state, -10, "캐릭터 회복", at)
        defender["hp"] = MAX_HP[defender["level"]]
