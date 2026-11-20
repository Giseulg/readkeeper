"""Validate optional, source-backed activities submitted alongside a TXT."""

from typing import Literal

from pydantic import BaseModel, Field, ValidationError


class Evidence(BaseModel):
    paragraph: int = Field(ge=1)
    quote: str = Field(min_length=1, max_length=350)


class Node(BaseModel):
    id: str = Field(pattern=r"^[a-zA-Z0-9_-]{1,40}$")
    name: str = Field(min_length=1, max_length=90)
    kind: Literal["person", "concept", "object", "theme", "event"] = "concept"
    description: str = Field(min_length=1, max_length=500)
    evidence: Evidence


class Edge(BaseModel):
    source: str
    target: str
    relation: str = Field(min_length=1, max_length=90)
    explanation: str = Field(min_length=1, max_length=500)
    evidence: Evidence


class Question(BaseModel):
    prompt: str = Field(min_length=1, max_length=500)
    choices: list[str] = Field(min_length=2, max_length=5)
    answer: int = Field(ge=1)
    explanation: str = Field(min_length=1, max_length=500)
    evidence: Evidence
    relatedNodes: list[str] = Field(default_factory=list, max_length=8)


class Activities(BaseModel):
    nodes: list[Node] = Field(min_length=1, max_length=40)
    edges: list[Edge] = Field(default_factory=list, max_length=80)
    questions: list[Question] = Field(min_length=1, max_length=60)


def imported_analysis(book_id, paragraphs, payload):
    try:
        source = Activities.model_validate_json(payload)
    except ValidationError as error:
        field = ".".join(map(str, error.errors()[0]["loc"]))
        raise ValueError(f"활동 파일의 항목을 확인해 주세요. {field or 'JSON 형식'}") from error

    def verify(evidence):
        ordinal = evidence.paragraph - 1
        quote = evidence.quote.strip()
        if not quote or ordinal >= len(paragraphs) or quote not in paragraphs[ordinal]:
            raise ValueError(f"{evidence.paragraph}번째 문단에서 활동 파일의 원문 근거를 찾을 수 없어요.")
        return ordinal, quote

    by_id = {}
    for node in source.nodes:
        if node.id in by_id:
            raise ValueError(f"활동 파일에 같은 카드 ID가 두 번 있어요. {node.id}")
        ordinal, _ = verify(node.evidence)
        by_id[node.id] = dict(id=f"{book_id}-node-{node.id}", name=node.name, kind=node.kind,
                              ordinal=ordinal, attributes={"설명": node.description})

    def visible_node(key, ordinal):
        node = by_id.get(key)
        if not node or node["ordinal"] > ordinal:
            raise ValueError(f"활동의 근거 문단까지 등장한 카드의 ID를 써 주세요. {key}")
        return node["id"]

    edges = []
    for index, edge in enumerate(source.edges):
        ordinal, quote = verify(edge.evidence)
        if edge.source == edge.target:
            raise ValueError("관계는 서로 다른 두 카드 사이에 연결해 주세요.")
        edges.append(dict(id=f"{book_id}-edge-{index}", source=visible_node(edge.source, ordinal),
                          target=visible_node(edge.target, ordinal), relation=edge.relation,
                          explanation=edge.explanation, ordinal=ordinal, quote=quote))

    questions, details = [], {}
    for index, question in enumerate(source.questions):
        ordinal, quote = verify(question.evidence)
        choices = [choice.strip() for choice in question.choices]
        normalized = ["".join(ch.casefold() for ch in choice if ch.isalnum()) for choice in choices]
        if (question.answer > len(choices) or any(not choice for choice in normalized)
                or len(set(normalized)) != len(choices) or any(len(choice) > 200 for choice in choices)):
            raise ValueError(f"{index + 1}번째 문제의 보기와 정답 번호를 확인해 주세요.")
        question_id = f"{book_id}-import-{index}"
        questions.append((question_id, ordinal, question.prompt, choices[question.answer - 1], choices))
        details[question_id] = dict(explanation=question.explanation, quote=quote,
                                    relatedNodeIds=[visible_node(key, ordinal) for key in question.relatedNodes])
    return questions, {"nodes": list(by_id.values()), "edges": edges, "questionDetails": details, "source": "provided"}
