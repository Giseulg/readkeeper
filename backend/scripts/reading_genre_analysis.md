# 장르별 AI 분석 실행 안내

책을 등록하면 FastAPI가 DB에 원문과 분석 작업을 저장한다. 별도 워커가 작업을 가져와 OpenAI로 분석하고, 결과가 검증되면 DB에 저장한다. React는 사용자가 읽음으로 확정한 범위의 결과를 표시한다. 워커가 분석하는 동안 본문을 읽을 수 있다.

## 설정

1. Supabase 테스트 프로젝트에서는 [reading_genre_migration.sql](reading_genre_migration.sql)을 적용한다. 기존 `reading` 스키마에 분석 상태 테이블을 추가하고, 분석 결과는 기존 `book_analysis.result` JSONB에 저장한다. 스키마가 없는 새 프로젝트라면 먼저 [reading_postgres_schema.sql](reading_postgres_schema.sql)을 적용한다. 로컬 SQLite에서는 앱을 시작할 때 작업 테이블이 만들어진다.
2. 저장소 루트에서 `python -m pip install -r backend/requirements.txt`를 실행한다.
3. `backend/.env`에 `OPENAI_API_KEY`와 Structured Outputs를 지원하는 `READING_OPENAI_MODEL`을 설정한다. 테스트에는 전송이 허용된 원문을 사용한다. OpenAI에 보내는 내용은 원문 구간과 분석에 필요한 발췌·메모이며, 별도 저장을 요청하는 API 옵션은 끈다.
4. [루트 실행 안내](../../README.md)에 따라 FastAPI와 프론트를 시작한다. 저장소 루트를 연 세 번째 터미널에서 워커를 실행한다.

```powershell
python -m backend.scripts.run_genre_worker
```

`--once`를 넣으면 작업 한 건을 처리하고 종료한다. 키나 모델명을 확인할 수 없으면 워커가 시작 오류를 표시한다. 워커가 꺼져 있으면 요청은 DB에 대기 상태로 남는다. 분석 화면의 **분석 다시 요청**은 실패한 작업을 다시 대기열에 넣는다.

## 태양광 논문의 논리 구조도 생성

`backend/.env`에 Google AI Studio에서 발급한 `GEMINI_API_KEY`와 사용할 모델 ID를 `READING_GEMINI_MODEL`로 설정한다. 저장소 루트에서 아래 명령을 실행한다.

```powershell
python -m backend.scripts.run_genre_worker --solar-research-map
```

워커는 `paper-solar-overlap-2026` 본문을 Gemini API에 보내 논리 구조도를 생성하고 원문 인용과 표 2·3의 비교 수치를 확인한다. 검증을 통과한 구조도를 기존 분석 레코드의 `researchMap`에 저장한다. 화면은 저장된 결과에서 읽음으로 확인한 범위를 표시한다.

## 사용 흐름

1. 서재에서 UTF-8 TXT 하나를 등록하고 소설, 시, CS 서적, 논문 중 장르를 선택한다. 기존 활동 JSON을 같이 올리면 작성된 활동을 사용한다.
2. 읽기 화면에서 **여기까지 읽음**을 누른 뒤 장르 분석을 연다. 인물·상징 관계도, 시어·심상 사전, CS 개념 흐름도, 논문 논리 구조도 중 알맞은 화면이 열린다.
3. 잠깐 놀기에는 읽은 범위의 선택형 수수께끼가 나온다. 완독하면 세 가지 단서를 맞추는 최종 수수께끼가 열린다. 풀이에 성공하면 장르별 캐릭터를 얻는다. 캐릭터 프로필은 생성하고, 화면과 마을에서는 기존 픽셀 스프라이트를 장르별 대표 이미지로 사용한다.

기존 책을 새 분석에 넣을 때는 지급된 캐릭터와 책 분류를 먼저 확인하고 대상만 지정한다. `--category`는 담당자가 해당 책의 장르를 확인한 경우에 쓴다.

```powershell
python -m backend.scripts.run_genre_worker --enqueue BOOK_ID --category cs_book
```

분석 도중 실패하면 새 결과 전체를 공개하지 않는다. 읽은 범위는 서버에서 확인하고, 여러 인용을 사용하는 항목은 필요한 인용 중 가장 늦은 위치까지 읽어야 열린다. 논문 전체 흐름과 최종 수수께끼는 완독한 뒤 공개한다. 기존에 수동으로 만든 완독 활동과 보상 ID는 유지한다.

## 캐릭터 설계와 도트 미리보기

`python -m backend.scripts.run_genre_worker --character-design BOOK_ID`는 Gemini로 작품별 후보와 원문 근거를 만들고 대표 후보의 도트 부품 설정을 저장한다. Supabase를 사용할 때는 같은 서버 환경에 `READING_DATABASE_URL`을 설정한다.

캐릭터 설계 미리보기 경로 `/library/BOOK_ID/character-design`에서 기본 자세와 네 동작, 원문 근거를 확인할 수 있다. 설정에는 인간형, 겹친 블록, 태양, 책, 프로세스 상태의 다섯 기본 형태와 두 가지 색, 얼굴선·수염이 포함된다. 표현되지 않는 특징은 추가 부품 목록에 표시된다. 사용자 완독 화면에는 설계 버튼을 숨기고 실제 보상만 표시한다.

검토한 캐릭터는 `python -m backend.scripts.run_genre_worker --publish-character-reward BOOK_ID`로 기존 완독 활동의 보상에 연결한다. 완독 활동이 없는 논문과 전공서적은 Gemini로 세 칸 수수께끼도 생성한다. 기존 캐릭터는 같은 인물의 보상 ID를 유지한다. 새 결과를 공개한 뒤 실제 앱에서 문제·정답 해설과 보상 그림을 확인한다.

## 현재 범위

## 시어·심상 사전과 시 전용 완독 시험

`python -m backend.scripts.run_genre_worker --poetry-study BOOK_ID`는 Gemini로 시어·심상 사전, 작품 핵심 정리, 시어 해석·화자 태도·표현 효과를 묻는 세 문항의 5지선다 시험을 생성한다. 사전과 문제 요청을 나누고 모두 검증된 뒤 함께 저장한다. 문항마다 보기별 해설과 근거 문단을 저장하며 정답과 해설은 풀이 전 API에서 제외한다. 사전은 읽은 근거 범위까지만, 작품 핵심 정리는 완독 후 공개한다.

현재 「서시」는 첫 9개 문단이 시 원문이며 이후 출처·라이선스 문단을 문학 해석 근거에서 제외한다. 생성 결과는 원문과 대조해 검토한다. 이 명령은 기존 보상 ID를 보존하며 캐릭터 설계·보상 연결 명령과 함께 사용한다. 새 시 등록 시 자동 호출되는 업로드 처리는 별도 연결이 필요하다.

## 전공서적 개념 흐름도

`python -m backend.scripts.run_genre_worker --concept-flow BOOK_ID`는 Gemini로 개념의 필요성, 동작, 혼동하기 쉬운 개념, 비유의 한계, 상황 예시와 선행 개념 연결을 생성한다. 결과는 원문 번호 검증 후 `studyMap`에 저장한다. 생성 결과의 기술적 정확성은 원문과 대조해 검토한다.

OSTEP 프로세스의 검토된 PDF 추출 보정은 `python -m backend.scripts.repair_ostep_process --backup BACKUP_PATH.json.gz`로 적용한다. 대상은 스크립트에 지정된 258문단 판본이며, 백업을 만든 뒤 문단 번호를 유지해 수정한다. 이미 같은 버전의 보정이 적용됐으면 건너뛴다.

한 번에 원문을 최대 32구간으로 나누어 분석한다. 구간당 최대 12,000자이며 한도를 넘는 책은 분석에 실패할 수 있다. 원문 읽기는 계속할 수 있다. 이전 스크립트는 이미 공개된 분석 JSON을 함께 복사한다. 실행 중인 작업 상태는 옮기지 않으므로 필요할 때 다시 등록한다.
