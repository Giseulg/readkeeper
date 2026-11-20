# 프론트엔드가 기대하는 백엔드 요구사항

2026-11-20의 GitHub 프론트·FastAPI 요구사항에 계정별 PostgreSQL, 카탈로그, 장르 분석과 운영 배포 조건을 반영했다. 표는 코드의 구현 상태를 나타낸다. 운영 전환 확인 방법은 [배포 안내](./production-release.md)에 있다.

## 연결 방식과 현재 상태

- 로컬 개발은 MSW 또는 단일 사용자 FastAPI를 선택한다. 운영 프론트는 같은 Vercel 도메인의 `/api/reading`을 호출한다. 목업 경로 접두사는 `/api`다. 아래 경로는 접두사를 제외한 상대 경로다.
- 운영 로그인은 등록된 독자의 Supabase 매직링크와 Google OAuth를 지원한다. 클라이언트가 Bearer 토큰을 전송하고 서버가 Supabase Auth에서 확인한 UUID로 PostgreSQL의 해당 독자 서재를 연다. SQLite와 정재 계정 선택은 로컬 체험에 사용한다. [Google 로그인 설정](./production-release.md#google-로그인-연결)
- 도메인 모델은 [`types.ts`](../src/domain/types.ts), 호출은 [`src/api`](../src/api), 목업 동작은 [`src/mocks/handlers`](../src/mocks/handlers), 실제 로컬 엔드포인트는 [독서 라우터](../backend/app/reading.py)와 [마을 라우터](../backend/app/village.py)가 기준이다. 응답 DTO가 다르면 API 어댑터에서 도메인 타입으로 변환한다.
- 로컬 구현의 책 업로드는 UTF-8 TXT만 지원하며 최대 2MB다. 프론트 타입과 목업은 PDF도 표현하지만 실제 PDF 처리의 증거는 아니다. 업로드 분석은 현재 요청 안에서 수행된다.

## API 목록

상태의 **로컬**은 FastAPI에 구현된 경로를 뜻한다. 운영에서는 같은 핸들러가 인증된 계정의 PostgreSQL에 접근한다. **목업**은 MSW 기능이다.

| 영역 | 메서드와 상대 경로 | 요청·응답 및 책임 | 상태 |
| --- | --- | --- | --- |
| 프로필 | `GET /me`, `PATCH /me` | `User`: 닉네임, 관심 분야, 온보딩 여부 등 | 로컬 |
| 설정·통계 | `GET /me/settings`, `PATCH /me/settings`, `GET /me/stats` | 설정 그룹 부분 갱신, 책·메모·퀴즈·캐릭터 수 | 로컬. reader·learning·library·display 그룹을 부분 저장하고 없는 값은 프론트가 기본값으로 채움 |
| 서재 | `GET /books`, `GET /books/:id`, `GET /books/:id/content` | 책 목록·상세와 챕터별 문단 제공 | 로컬 |
| 책 관리 | `POST /books`, `DELETE /books/:id` | 생성은 multipart `title`, `category`, `file`; 삭제는 빈 응답 | 로컬. TXT 제한은 위 참조 |
| 진도 | `PUT /books/:id/progress/current`, `PUT /books/:id/progress/confirmed`, `POST /books/:id/progress/restart` | `{chapter, paragraph}` 위치 저장·확정, 다시 읽기. 각각 갱신된 `Book` 반환 | 로컬 |
| 관계도 | `GET /books/:id/graph` | `BookGraph`: 노드·간선·원문 근거와 공개 범위 | 로컬. 작품·분석 결과에 따라 내용이 달라짐 |
| 메모 | `GET /books/:id/memos?type=...`, `GET /books/:id/memos/:memoId`, `POST /books/:id/memos`, `DELETE /books/:id/memos/:memoId` | 인용 위치와 텍스트를 포함한 메모·가설 저장 및 조회 | 로컬 |
| 가설 재검토 | `GET /books/:id/memos/due`, `POST /books/:id/memos/:memoId/revisions` | 재검토 대상과 수정 내용·찬반 근거·결과 | 로컬 |
| 퀴즈 | `POST /books/:id/quiz-sessions`, `GET /quiz-sessions/:sid`, `POST /quiz-sessions/:sid/attempts`, `POST /quiz-sessions/:sid/finish` | 모드·문항 수로 시작, 답안 제출·서버 채점, 세션 및 결과 반환 | 로컬. 문항과 채점 방식은 로컬 데이터·구현 범위에 한정 |
| 완독 활동 | `GET /books/:id/case`, `POST /books/:id/case/solve` | 완독 시 단서 카드 제공, 상황·이유·행동 판정과 보상 반환 | 로컬. 활동 데이터가 있는 책에 한정; MSW 핸들러는 없음 |
| 수집 | `GET /me/collectibles` | 수집품 ID·출처·스프라이트·획득 시각(`null`이면 미획득) | 로컬 |
| 캐릭터·마을 | `GET /me/characters`, `PATCH /me/characters/:id`, `PUT /me/village` | 보유 목록, 공개 여부, 캐릭터 배치 좌표 | 로컬. 획득한 캐릭터만 변경 가능. 좌표 생략 시 해당 캐릭터 배치 해제 |
| 꾸미기 | `GET /me/village/decor`, `PUT /me/village/decor`, `POST /me/village/decor/unlock` | 소품 배치·해금 목록, 해금 비용 차감 | 로컬. 성 포인트 차감과 해금을 한 트랜잭션으로 저장 |
| 성 | `GET /me/castle`, `POST /me/castle/actions` | 성 체력·포인트·25칸·방어자·습격 이력, 수리·회복·등급·배치·확인 동작 | 로컬. `POST /me/castle/skip`은 데모 전용 |
| 공식 자료·구매 | `GET /explore/contents`, `GET /explore/contents/:id`, `POST /explore/contents/:id/claim` | 무료 카탈로그 조회·내 서재 추가는 FastAPI에 구현됨. 프론트 탐색 진입과 `/purchase` 결제는 목업 전용 | 부분 구현 |
| 장르 분석 | `POST /books/:id/analysis/retry`, `GET /books/:id/graph` | 실패한 분석 재요청 및 독서 범위별 분석·관계도. 운영은 내장 분석기로 요청 안에서 재처리한다. 개인 업로드는 운영 서버에서 로컬 처리 | FastAPI |
| 배포 확인 | `GET /health` | 동일 배포의 운영 커밋·DB 식별자·스키마 버전·요청 내 분석 방식. `/release.json`은 프론트 배포 식별자 | 운영 |

## 사용자에게 보이는 구현 차이

| 화면 | 현재 동작과 남은 작업 |
| --- | --- |
| 읽기 설정 | 화면 모드(auto/mobile/tablet)를 바꾸면 FastAPI가 저장하고 다음 조회에 반환한다. |
| 다시 읽기 | 진도는 0%로 돌아간다. 이전 메모 본문과 가설 수정문은 계속 조회되며 수정 근거 인용만 현재 진도로 제한된다. 상용화 설계의 회차별 기록 분리와 공개 정책을 구현해야 한다. |
| 퀴즈 | MSW는 시작 응답에 정답을 포함한다. FastAPI는 제출한 문항의 정답을 공개하고, 세션 종료 시 미응답 문항의 정답도 반환한다. 로컬 서버의 채점은 정규화한 정답·별칭 일치 방식이며 부분 점수와 오답 관련 노드 추천은 제공하지 않는다. |
| 책 추가 | 실제 모드의 파일 선택기는 TXT만 허용하지만 빈 서재 문구에는 PDF도 표시된다. MSW에서 등록한 PDF는 처리 중 상태에 머문다. 일반 TXT 자동 분석은 용어 노드와 빈칸 문항을 만들며, 관계선과 완독 사건은 별도 활동 데이터가 있어야 제공할 수 있다. |
| 수집 → 마을 | FastAPI는 획득한 도감 항목에 `characterId`를 반환한다. 실제 API 모드에서도 도감의 보상을 마을에 배치하고 다음 방문에 복원할 수 있다. 공개 설정은 API가 지원하며 내 정보의 관리 화면은 아직 스텁이다. |
| 맞춤 자료 · 계정 데이터 | 맞춤 자료 화면은 파일 선택 미리보기 단계다. 검색·생성·개인 책 저장 API가 필요하다. 계정 데이터 관리 화면은 목업 초기화만 지원하며 서버 측 내보내기·탈퇴는 출시 설계에 있다. |

관련 코드: [설정·메모·퀴즈·수집 응답](../backend/app/reading.py) · [퀴즈 목업](../src/mocks/handlers/quizzes.ts) · [본문 자동 분석](../backend/app/book_analysis.py) · [수집 화면](../src/pages/collection/CollectionPage.tsx) · [맞춤 자료 미리보기](../src/pages/library/CuratedBookPage.tsx)

성 방문 보너스는 UTC 날짜별로 한 번 적립한다. 읽음 확정이 전진하거나 메모를 작성하거나 퀴즈에 처음 정답을 제출하면 학습 포인트를 적립한다. 응답 기록이 있는 퀴즈의 첫 종료만 완료 보상을 받는다. 메모 작성과 성 행동을 재전송할 때는 최초 요청의 `Idempotency-Key`를 재사용한다. 같은 키와 다른 요청 내용은 409를 반환한다. [게임 규칙](../backend/app/game.py) · [통합 테스트](../backend/tests/test_village_api.py)

## 반드시 유지할 동작

- `ReadingLocation`은 `{chapter, paragraph}`다. 현재 위치는 자유롭게 이동하지만 확정 진도는 다시 읽기를 시작하기 전까지 뒤로 줄지 않는다. 그래프의 노드·관계·설명·인용, 퀴즈와 가설 후속 근거는 서버에서 확정 범위에 맞게 제한한다.
- 퀴즈는 서버가 채점하고 답변 전 정답을 숨긴다. 완독 활동은 서버가 완독과 정답을 확인하고 보상을 지급한다. 재요청이나 동시 요청에서 보상·포인트가 중복 지급되지 않도록 해야 한다.
- 책·진도·메모·퀴즈·보상·설정은 계정별로 저장하고 모든 리소스에서 소유권 또는 열람 권한을 검사해야 한다. 사용자 제공 ID만으로 권한을 판단하지 않는다.
- 성 습격과 포인트 적립·차감은 서버 상태와 서버 시각으로 판정한다. 꾸미기 해금과 포인트 차감은 함께 성공하거나 함께 실패해야 한다. 실제 결제를 열 경우 결제 승인 확인과 구매 권한 발급도 신뢰할 수 있는 서버 처리로 연결한다.
- `Book.status`는 `processing`, `ready`, `failed`를 표현한다. 비동기 업로드를 도입한다면 상태 갱신·실패 원인·재시도 계약을 정하고 화면도 연결해야 한다. 현재 맞춤 자료 화면은 파일 선택만 하는 미리보기이며 업로드·분석·생성 API를 호출하지 않는다.

## 실제 서버 연결 시 함께 할 일

1. 운영 이메일 리디렉션과 계정별 DB는 서울의 intereading-seoul을 사용한다. 운영 후보를 승격할 때 프론트와 Vercel Function의 커밋 및 DB 식별자가 일치하는지 확인한다. [운영 서재 배포](./production-release.md)
2. 기존 공용 데모 및 SQLite 기록의 실제 소유자를 확인해야 이전할 수 있다. 운영 계정의 서재는 인증된 UUID 단위로 분리된다.
3. `src/hooks/queries.ts`의 탐색 조회와 `src/router.tsx`의 일부 화면은 `MOCK_MODE` 조건으로 제한되어 있다. 각 운영 API와 권한이 준비되면 해당 조건과 화면을 함께 변경한다.
4. 운영에서 새 계정의 셀프 가입, 계정 삭제·내보내기와 맞춤 자료 생성을 제공하려면 각각 가입 정책과 API 구현이 필요하다.
5. 두 계정의 데이터 격리, 진도 이전·이후의 스포일러 차단, 재시작, 중복 보상 방지, 업로드 오류, 실제 API의 JSON 오류와 새로고침 후 복원을 통합 검증한다.
