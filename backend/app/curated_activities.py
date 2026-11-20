"""Comprehension activities checked against the imported editions."""

from hashlib import blake2s

LUCK = "sample-good-luck"
SEMVER = "sample-semver"

CURATED = {
    LUCK: {
        "title": "왜 운수 좋은 날이었을까?",
        "verdictMood": "gentle",
        "prompt": "김 첨지의 하루와 마지막 장면을 떠올려, 제목의 뜻을 설명하는 단서를 골라 보세요.",
        "explanation": "돈을 많이 번 하루였지만, 아내가 바라던 설렁탕을 사 갔을 때는 이미 늦었어요. 돈을 번 행운과 아내를 잃은 비극이 맞부딪쳐 제목이 반대로 느껴져요.",
        "nodes": [
            ("kim", "김 첨지", "person", "h_luck_kim", 1, {"역할": "인력거를 끌어 생활비를 벌어요."}),
            ("wife", "김 첨지의 아내", "person", "h_luck_wife", 2, {}),
            ("soup", "설렁탕", "object", "object_soup", 2, {"역할": "김 첨지가 번 돈으로 아내에게 사 줄 수 있게 된 음식이에요."}),
            ("luck", "운수 좋은 날", "theme", None, 1, {"본문에서의 뜻": "손님이 이어져 큰돈을 번 날이라고 여겨요."}),
        ],
        "edges": [
            ("kim", "luck", "손님을 태워 돈을 벎", 2, "오래간만에 손님을 잇달아 태워 아내에게 설렁탕을 사 줄 돈을 벌어요."),
            ("wife", "soup", "먹고 싶어 함", 6, "아픈 아내는 사흘 전부터 설렁탕 국물을 마시고 싶다고 말했어요."),
            ("kim", "soup", "아내에게 사 감", 68, "김 첨지는 취한 상태에서도 아내가 바라던 설렁탕을 사서 집으로 돌아가요."),
            ("luck", "wife", "행운과 비극이 대비됨", 81, "김 첨지에게 돈이 들어온 날이었지만, 아내는 결국 설렁탕을 먹지 못해요. 제목의 행운은 이 비극과 대비돼요."),
        ],
        "quizzes": [
            (2, "김 첨지에게 아침에 번 돈이 특히 반가웠던 이유는?", "아픈 아내에게 설렁탕을 사 줄 수 있어서", ["인력거를 새로 주문할 수 있어서", "아내가 이미 병에서 나았기 때문에"], "돈은 단순히 좋은 수입이 아니라 아픈 아내에게 바라던 음식을 사 줄 수 있는 기회였어요."),
            (6, "아내가 설렁탕을 바란 것은 김 첨지가 돈을 벌기 전부터였을까?", "그렇다. 사흘 전부터 남편에게 부탁했다", ["아니다. 김 첨지가 돌아온 뒤 처음 말했다", "아니다. 개똥이가 먼저 먹자고 했다"], "본문에서 아내가 사흘 전부터 국물을 마시고 싶어 했다고 설명해요."),
            (69, "김 첨지가 집에 왔을 때 기침과 숨소리가 들리지 않는 장면은 어떤 느낌을 주나요?", "평소와 다른 정적이 불길한 일을 짐작하게 해요", ["가족 모두가 편안하게 자고 있다는 확신을 줘요", "아내의 병이 다 나았다는 기쁨을 줘요"], "작품은 침묵을 무덤에 빗대어 평소와 다른 상황을 불길하게 느끼게 해요."),
        ],
        "slots": [
            ("아침에 어떤 행운이 있었나요?", "손님을 잇달아 태워 아내에게 설렁탕을 사 줄 돈을 벌었어요.", 2),
            ("집에서 어떤 일이 있었나요?", "설렁탕을 사 갔지만 아내는 이미 먹을 수 없는 상태였어요.", 81),
            ("그래서 제목이 왜 역설적인가요?", "돈을 번 행운과 아내를 잃은 비극이 같은 날에 일어났어요.", 81),
        ],
        "distractors": ["비가 그치고 아내의 병도 나았어요.", "김 첨지는 설렁탕을 사지 않기로 했어요.", "돈을 한 푼도 벌지 못해서 불운한 날이었어요."],
        "reward_ids": ("kim", "wife"),
        "anchors": {1: "인력거꾼", 2: "앓는 아내에게 설렁탕", 6: "사흘 전부터 설렁탕", 68: "설렁탕을 사가지고", 69: "숨소리조차", 81: "운수가 좋더니만"},
    },
    SEMVER: {
        "title": "이 변경에는 어떤 버전 번호를 올릴까?",
        "prompt": "공개 API가 안정된 서비스 2.4.3의 변경 사례를 주·부·수 버전 규칙에 맞춰 보세요.",
        "explanation": "기존 코드가 깨지면 주 버전을 올리고 뒤 두 숫자는 0으로 바꿔요. 호환되는 기능을 추가하면 부 버전을 올리고 수 버전을 0으로 바꿔요. 호환되는 오류 수정만 하면 수 버전만 올려요.",
        "nodes": [
            ("breaking", "호환이 깨지는 변경", "concept", None, 1, {"뜻": "기존에 쓰던 같은 방법으로는 새 API를 사용할 수 없는 변경이에요."}),
            ("major", "주 버전", "concept", "v_major", 1, {"규칙": "공개 API가 기존 사용 방법과 호환되지 않을 때 올려요."}),
            ("feature", "호환되는 기능 추가", "concept", None, 2, {"예": "기존 기능을 그대로 두고 새 기능을 더하는 경우예요."}),
            ("minor", "부 버전", "concept", "v_minor", 2, {"규칙": "기존 API와 호환되는 새 기능을 추가할 때 올려요."}),
            ("fix", "호환되는 오류 수정", "concept", None, 3, {"예": "사용 방법은 그대로 두고 계산 오류를 고치는 경우예요."}),
            ("patch", "수 버전", "concept", "v_patch", 3, {"규칙": "기존 API와 호환되는 오류 수정만 있을 때 올려요."}),
        ],
        "edges": [
            ("breaking", "major", "주 버전을 올리는 조건", 1, "기존 코드에서 더 이상 호출할 수 없는 공개 API 변경에는 주 버전을 올려요."),
            ("feature", "minor", "부 버전을 올리는 조건", 2, "기존 호출은 그대로 되고 새 기능만 더해지면 부 버전을 올려요."),
            ("fix", "patch", "수 버전을 올리는 조건", 3, "새 기능 없이 기존 동작의 오류만 바로잡고 호환성을 유지하면 수 버전을 올려요."),
        ],
        "quizzes": [
            (1, "공개 함수를 삭제해서 기존 코드에서 그 함수를 더 이상 호출할 수 없다면?", "주 버전을 올린다", ["부 버전을 올린다", "수 버전을 올린다"], "기존 코드가 그 함수를 그대로 사용할 수 없어서 호환성이 깨져요."),
            (2, "기존 기능은 그대로 두고 검색 옵션을 새로 추가했다면?", "부 버전을 올린다", ["주 버전을 올린다", "수 버전을 올린다"], "기존 사용법과 호환되면서 새 기능이 생긴 경우예요."),
            (3, "사용 방법과 기능을 유지하면서 합계 계산 오류만 고쳤다면?", "수 버전을 올린다", ["부 버전을 올린다", "주 버전을 올린다"], "기존 API와 호환되고 오류만 고쳤으므로 수 버전에 해당해요."),
            (16, "2.4.3에서 호환되는 기능을 추가했다면 다음 버전은?", "2.5.0", ["2.4.4", "3.0.0"], "부 버전을 5로 올리고 수 버전은 0으로 초기화해요."),
        ],
        "slots": [
            ("주 버전 변경 → 3.0.0", "공개 함수를 지워 기존 앱이 동작하지 않아요.", 17),
            ("부 버전 변경 → 2.5.0", "기존 호출은 유지하고, 선택할 수 있는 새 정렬 기능을 추가했어요.", 16),
            ("수 버전 변경 → 2.4.4", "기능과 사용법은 그대로 두고 할인 합계 오류만 고쳤어요.", 15),
        ],
        "distractors": ["설치 파일을 다시 받았고 프로그램에는 바뀐 점이 없어요.", "출시 계획만 적었고 프로그램은 아직 바꾸지 않았어요.", "같은 버전의 사용 방법을 동료에게 설명했어요."],
        "reward_ids": ("major", "minor", "patch"),
        "anchors": {1: "호환되지 않게", 2: "새로운 기능을 추가", 3: "버그를 수정", 15: "호환되는 버그 수정", 16: "부버전이 올라가면", 17: "0으로 초기화"},
    },
}


def curated_analysis(book_id, passages, slot_ids):
    config = CURATED[book_id]
    original = {row["ordinal"]: row["text"] for row in passages}
    for ordinal, phrase in config["anchors"].items():
        if phrase not in original.get(ordinal, ""):
            raise ValueError(f"Curated source mismatch: {book_id}:{ordinal}")
    def key(name):
        return f"{book_id}-{name}"

    def card_id(name):
        return blake2s(key(name).encode(), digest_size=8).hexdigest()
    nodes = []
    for short, name, kind, sprite, ordinal, attributes in config["nodes"]:
        nodes.append(dict(id=key(short), name=name, kind=kind, ordinal=ordinal, attributes=attributes,
                          **({"sprite": sprite} if sprite else {})))
    edges = [
        dict(id=key(f"edge-{i}"), source=key(source), target=key(target), relation=relation,
             ordinal=ordinal, explanation=explanation)
        for i, (source, target, relation, ordinal, explanation) in enumerate(config["edges"])
    ]
    cast = [{k: node[k] for k in ("id", "name", "sprite")}
            for reward in config["reward_ids"] for node in nodes if node["id"] == key(reward)]
    questions, explanations = [], {}
    for i, (ordinal, prompt, answer, wrong, explanation) in enumerate(config["quizzes"]):
        options = list(wrong)
        options.insert(i % 3, answer)
        questions.append((ordinal, prompt, answer, options))
        explanations[f"{book_id}-understand-{ordinal}"] = explanation
    cards, answer, slots, evidence = [], {}, [], []
    for i, (slot_id, (label, text, ordinal)) in enumerate(zip(slot_ids, config["slots"])):
        card = card_id(f"evidence-{i}")
        cards.append({"id": card, "text": text})
        slots.append({"id": slot_id, "label": label})
        answer[slot_id] = card
        evidence.append(ordinal)
    cards += [{"id": card_id(f"other-{i}"), "text": text} for i, text in enumerate(config["distractors"])]
    cards = [cards[i] for i in (4, 2, 3, 0, 5, 1)]
    case = {**{k: config[k] for k in ("title", "prompt", "explanation", "verdictMood") if k in config},
            "cast": cast, "cards": cards, "slots": slots, "answer": answer, "evidence": evidence}
    return questions, {"nodes": nodes, "edges": edges, "case": case, "explanations": explanations}
