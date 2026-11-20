"""Apply source-reviewed extraction repairs without changing passage identities."""
import argparse
from contextlib import closing
import gzip
import json
from pathlib import Path
import re

from backend.app.reading import analysis_for, open_db, rows, save_book_analysis, write_transaction

BOOK_ID = "787b0dbd72c84041ba15f68a7f3a0c04"
SOURCE = "https://pages.cs.wisc.edu/~remzi/OSTEP/Korean/04-cpu-intro.pdf"
REPAIRS = {
    "ᨧ": "없", "ᨦ": "업", "ᨨ": "엇", "ᨩ": "었", "ၵ": "바", "ၷ": "밖", "ၼ": "받",
    "ၽ": "발", "ၾ": "밝", "발념": "개념", "발체": "개체", "발수": "개수",
    "수백 발의": "수백 개의", "여러 발의": "여러 개의", "두 발의": "두 개의",
    "세 발의": "세 개의", "4발의": "4개의", "두 발를": "두 개를", "무한발": "무한개",
    "박제로": "강제로", "박이라도": "강이라도", "재발": "재개", "밖는다": "갖는다",
    "소발": "소개", "ile descriptor": "file descriptor", "(inal)": "(final)",
    "ມ❑프로그래ၮ": "멀티프로그래밍", "발č": "발견", "Ύ 필요한": "꼭 필요한",
    "하나인프로세스": "하나인 프로세스", "는실행": "는 실행", "이시분할": "이 시분할",
}
CODE = {
    189: "// 프로세스를 중단하고 이후에 재개하기 위해\n// xv6가 저장하고 복원하는 레지스터\nstruct context {",
    190: "  int eip;\n  int esp;\n  int ebx;\n  int ecx;\n  int edx;\n  int esi;\n  int edi;\n  int ebp;\n};",
    191: "// 가능한 프로세스 상태\nenum proc_state { UNUSED, EMBRYO, SLEEPING,",
    192: "  RUNNABLE, RUNNING, ZOMBIE };\n// 레지스터 문맥과 상태를 포함하여\n// 각 프로세스에 대하여 xv6가 추적하는 정보\nstruct proc {",
    193: """  char *mem;                 // 프로세스 메모리 시작 주소
  uint sz;                   // 프로세스 메모리의 크기
  char *kstack;              // 이 프로세스의 커널 스택의 바닥 주소
  enum proc_state state;     // 프로세스 상태
  int pid;                   // 프로세스 ID
  struct proc *parent;       // 부모 프로세스
  void *chan;               // 0이 아니면, chan에서 수면
  int killed;               // 0이 아니면 종료됨
  struct file *ofile[NOFILE]; // 열린 파일
  struct inode *cwd;        // 현재 디렉터리
  struct context context;   // 프로세스를 실행시키려면 여기로 교환
  struct trapframe *tf;     // 현재 인터럽트에 해당하는 트랩 프레임
};""",
}
# These ranges correspond to paragraphs reviewed in the publisher's PDF.
GROUPS = [
    (1, 5), (6, 11), (13, 17), (18, 23), (25, 30), (32, 34), (35, 37),
    (38, 41), (42, 43), (44, 48), (49, 50), (53, 55), (56, 58), (59, 63),
    (64, 65), (66, 68), (69, 70), (72, 74), (76, 80), (81, 87), (88, 92),
    (93, 98), (99, 104), (105, 110), (112, 115), (116, 117), (118, 119),
    (120, 123), (124, 126), (128, 131), (132, 134), (145, 147), (148, 152), (166, 171), (174, 179),
    (180, 183), (184, 188), (195, 201), (203, 205), (207, 211), (221, 224),
]
SPLIT_WORDS = ("논의", "메모리", "프로세스", "프로세서", "명령어", "가상화", "입출력",
               "어떻게", "무엇", "프로그램", "실행", "레지스터", "이용률", "초기", "추적",
               "해야", "동작", "생성", "공간", "정책", "스택")


def repair(text):
    for before, after in REPAIRS.items():
        text = text.replace(before, after)
    return re.sub(r"\r+\n?", "\n", text)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backup", required=True)
    args = parser.parse_args()
    with closing(open_db()) as db:
        passages = rows(db, "SELECT * FROM passages WHERE book_id=? ORDER BY ordinal", BOOK_ID)
        original = analysis_for(db, BOOK_ID)
        questions = rows(db, "SELECT * FROM questions WHERE book_id=?", BOOK_ID)
    if len(passages) != 258:
        raise RuntimeError("The source edition changed. Review repairs again.")
    if original.get("sourceCleanup", {}).get("version") == 2:
        print("Source repairs already applied.")
        return
    backup = Path(args.backup)
    backup.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(backup, "xt", encoding="utf-8") as stream:
        json.dump({"book_id": BOOK_ID, "passages": passages, "analysis": original, "questions": questions},
                  stream, ensure_ascii=False)
    corrected = {row["ordinal"]: CODE.get(row["ordinal"], repair(row["text"])) for row in passages}
    layout = {str(row["ordinal"]): {"group": row["ordinal"], "separator": "",
                                  "kind": "code" if row["ordinal"] in CODE else "text"} for row in passages}
    for start, end in GROUPS:
        for ordinal in range(start, end + 1):
            separator = " " if ordinal != start else ""
            if ordinal != start:
                left, right = corrected[ordinal - 1].rstrip(), corrected[ordinal].lstrip()
                if any(left.endswith(word[:split]) and right.startswith(word[split:])
                       for word in SPLIT_WORDS for split in range(1, len(word))):
                    separator = ""
            layout[str(ordinal)].update(group=start, separator=separator)
    with closing(open_db()) as db, write_transaction(db):
        if passages != rows(db, "SELECT * FROM passages WHERE book_id=? ORDER BY ordinal", BOOK_ID):
            raise RuntimeError("Source changed during repair.")
        for row in passages:
            if corrected[row["ordinal"]] != row["text"]:
                db.execute("UPDATE passages SET text=? WHERE book_id=? AND ordinal=?",
                           (corrected[row["ordinal"]], BOOK_ID, row["ordinal"]))
        for question in questions:
            prompt, answer = repair(question["prompt"]), repair(question["answer"])
            if (prompt, answer) != (question["prompt"], question["answer"]):
                db.execute("UPDATE questions SET prompt=?,answer=? WHERE id=?", (prompt, answer, question["id"]))
        stored = analysis_for(db, BOOK_ID)
        stored["sourceCleanup"] = {"version": 2, "source": SOURCE, "layout": layout}
        save_book_analysis(db, BOOK_ID, [], stored)
    print("Repaired source with all 258 passage identities preserved.", backup)


if __name__ == "__main__":
    main()
