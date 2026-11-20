"""Curated people and evidence for the first reading game."""

MINSEO_ID = "rain-return-box-minseo"
MINSEO_SPRITE = "h_reader"

# Each description has its own reveal point. An early card must not disclose
# an action the reader would only learn about later.
PEOPLE = (
    ("jiwoo", "지우", "h_traveler", "지우는 휴대폰을 확인했다.", (
        ("역할", "도서실에 책을 돌려주러 왔어요.", "지우는 휴대폰을 확인했다."),
    )),
    (MINSEO_ID, "민서", MINSEO_SPRITE, "같은 반 민서였다.", (
        ("역할", "지우와 같은 반이에요.", "같은 반 민서였다."),
        ("행적", "젖은 소매를 등 뒤로 감췄어요.", "민서는 젖은 소매를 등 뒤로 감췄다."),
        ("중요한 물건", "손수건 아래에서 작은 열쇠를 꺼냈어요.", "작은 은색 열쇠가 드러났다."),
    )),
    ("doyun", "도윤", "h_keeper", "도서부인 도윤은", (
        ("역할", "도서부예요.", "도서부인 도윤은"),
    )),
)

STORY_CAST = tuple(
    {"id": person[0], "name": person[1], "sprite": person[2]}
    for person in (PEOPLE[0], PEOPLE[2], PEOPLE[1])
)


RELATIONSHIPS = (
    ("classmates", MINSEO_ID, "jiwoo", "같은 반", "같은 반 민서였다."),
    ("borrowed-key", MINSEO_ID, "doyun", "열쇠를 빌림", "아까 빌려 간 작은 열쇠"),
)


def story_graph(book_id, passages):
    def evidence_for(anchor):
        return next((row for row in passages if anchor in row["text"]), None)

    def position(row):
        return {"chapter": row["chapter"], "paragraph": row["paragraph"]}

    nodes = []
    for node_id, name, sprite, anchor, fields in PEOPLE:
        first = evidence_for(anchor)
        if first is None:
            continue
        nodes.append({
            "id": node_id, "bookId": book_id, "kind": "person", "name": name,
            "sprite": sprite, "firstSeen": position(first),
            "attributes": {
                label: value for label, value, evidence in fields
                if evidence_for(evidence) is not None
            },
        })

    visible = {node["id"] for node in nodes}
    edges = []
    for edge_id, source, target, label, anchor in RELATIONSHIPS:
        evidence = evidence_for(anchor)
        if evidence is None or source not in visible or target not in visible:
            continue
        first_seen = position(evidence)
        edges.append({
            "id": edge_id, "bookId": book_id, "source": source, "target": target,
            "relation": label, "firstSeen": first_seen,
            "quotes": [{"text": evidence["text"], "location": first_seen}],
        })

    return nodes, edges
