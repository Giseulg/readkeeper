"""Generate small, source-backed activities without sending uploaded text away."""

import re
from collections import Counter

TOKEN = re.compile(r"[가-힣]{2,}|[A-Za-z][A-Za-z0-9+-]{2,}")
STOP = set("그리고 그러나 그래서 하지만 이것 그것 있는 없는 한다 하는 대한 경우 여기 다음 같은 있어요 있습니다 합니다 해요 the and for that with".split())
PARTICLE = re.compile(r"(?:에서는|에서|에게|으로|처럼|까지|부터|이다|입니다|에는|이나|이나|하고|은|는|이|가|을|를|의|에|도|와|과|로)$")
SEEDS = {
    "sample-good-luck": ("김 첨지", "아내", "설렁탕", "인력거"),
    "sample-preface-poem": ("하늘", "바람", "별", "길"),
    "sample-animal-assembly": ("금수회의록", "가마귀", "여호", "호랑이"),
    "sample-django-internet": ("브라우저", "서버", "HTML", "IP", "HTTP", "DNS"),
    "sample-semver": ("주 버전", "부 버전", "수 버전", "API", "호환", "빌드"),
}


def terms(text):
    for match in TOKEN.finditer(text):
        word = PARTICLE.sub("", match.group()) if not match.group().isascii() else match.group()
        if len(word) >= 2 and word.casefold() not in STOP:
            yield word


def excerpt(text, limit=145):
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit].rstrip() + "…"


def analyze(book_id, category, passages):
    choices, nodes = [], []
    body = [row for row in passages if row["title"] != "출처와 이용 조건"]
    if not body:
        return choices, {"nodes": nodes, "edges": [], "case": None}
    count = Counter(term for row in body for term in dict.fromkeys(terms(row["text"])))
    frequent = [word for word, n in count.most_common(24) if n >= 2]
    words = list(dict.fromkeys([*SEEDS.get(book_id, ()), *frequent, *list(count)[:64]]))
    words = [word for word in words if any(word in row["text"] for row in body)]

    for n, word in enumerate(words[:8]):
        first = next(row for row in body if word in row["text"])
        person = book_id == "sample-good-luck" and word in {"김 첨지", "아내"}
        nodes.append({
            "id": f"{book_id}-node-{n}", "name": word, "kind": "person" if person else "concept",
            "ordinal": first["ordinal"], "attributes": {"본문 속 설명": excerpt(first["text"])},
        })
    # Pick actual words and mask them in a real sentence. Choices use vocabulary
    # from the same material, and the answer itself always occurs in the cited passage.
    stride = max(1, len(body) // 24)
    for row in body[::stride]:
        text = " ".join(row["text"].split())
        answer = next((w for w in words[:32] if w in text), None)
        if answer is None:
            continue
        index = text.index(answer)
        window = ("…" if index > 45 else "") + text[max(0, index - 45):index] + "____" + text[index + len(answer):index + len(answer) + 72]
        distractors = [w for w in words if w != answer and w not in text and answer not in w and w not in answer][:3]
        if len(distractors) < 2:
            continue
        options = distractors[:]
        options.insert(row["ordinal"] % (len(options) + 1), answer)
        choices.append((row["ordinal"], f"원문 빈칸에 들어갈 말은?\n{window}", answer, options))
    return choices, {"nodes": nodes, "edges": [], "case": None}
