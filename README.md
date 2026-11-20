# Readkeeper · 읽기의 재미

Readkeeper는 **읽기 → 이해하기 → 문제 풀기 → 캐릭터 수집**을 연결하는 독서 서비스입니다. 읽던 문단에서 이어 읽고, 작품의 장르에 맞는 분석을 원문 근거와 함께 살펴봅니다. 완독 문제를 해결하면 작품의 인물이나 핵심 개념을 표현한 도트 캐릭터를 얻습니다.

기존 [Intereading 해커톤 프로젝트](https://github.com/Waterrrrrit/intereading_2026_bootcamp_hackathon)의 팀 코드와 장르별 개선을 정리한 제출용 저장소입니다. 기존 화면·일부 코드 이름에는 Intereading 표기가 남아 있습니다.

## 무엇을 할 수 있나요?

- **책 읽기** · 스크롤·페이지 넘김, 읽은 범위 표시와 이어 읽기를 지원합니다.
- **장르별로 이해하기** · 인물 관계, 시어, 전공 개념, 논문 논리 구조를 원문 근거와 함께 확인합니다.
- **메모와 추론 남기기** · 문장을 인용하고 자신의 생각과 가설을 기록합니다.
- **완독 문제와 수집** · 문제를 해결하면 3·2·1 연출과 함께 캐릭터를 얻고 수집·마을에서 확인합니다. 획득한 캐릭터는 다섯 자세를 반복합니다. 동작 줄이기 환경에서는 움직임을 줄입니다.

## 장르에 맞게 달라지는 독서 경험

| 장르 | 분석 기능 | 완독 활동 | 검토한 작품 |
| --- | --- | --- | --- |
| 소설 | 인물·상징 관계도 | 상황·이유·행동을 연결하는 단서 카드 | 운수 좋은 날 |
| 시 | 시어·심상 사전: 뜻·정서·표현 효과·해석 주의점 | 시어·화자의 태도·표현 효과를 묻는 5지선다 | 서시 |
| 전공서적 | 개념의 필요성·동작·비유·예시를 연결하는 흐름도 | 개념을 적용하는 상황 카드 | OSTEP 프로세스 |
| 논문 | 연구 문제·방법·실험·결과·한계와 표의 수치 비교 | 연구 논리와 적용 범위를 연결하는 카드 | 구간별 중복 그룹핑 기반 일사량·태양광 예측 논문 |

설명에 필요한 근거까지 읽은 뒤 해당 분석을 공개합니다. 전체 작품 요약과 완독 활동에는 완독 조건을 적용합니다.

## AI 분석과 보상 캐릭터

Gemini API로 생성한 장르별 분석과 캐릭터 설계를 검토해 Supabase에 저장합니다. 독서 화면은 저장된 결과를 조회하므로 열 때마다 분석 생성을 기다리지 않습니다. 캐릭터는 원문의 인물·이미지·개념을 바탕으로 대표 대상·분위기·색을 정하고 공통 도트 부품과 동작으로 표현합니다.

```mermaid
flowchart LR
    A[작품 등록] --> B[분석 워커 · Gemini API]
    B --> C[원문 근거 검증 · 내용 검토]
    C --> D[(Supabase)]
    D --> E[읽은 범위의 분석 조회]
    E --> F[완독 문제]
    F --> G[도트 캐릭터 · 수집 · 마을]
```

전문 장르 분석은 담당자가 워커 명령으로 실행합니다. 일반 TXT 업로드와 전문 분석의 자동 연결은 추가 작업이 필요합니다. 기존 범용 분석 대기열의 OpenAI 경로와 Gemini 전문 명령은 구분합니다. [AI 분석 실행 안내](backend/scripts/reading_genre_analysis.md)

## 실행하기

Node.js 22.22.2 이상과 Python 3.12 이상을 권장합니다. 저장소를 내려받고 루트 폴더에서 터미널 두 개를 엽니다. 실제 데이터 검증에는 팀 Supabase 테스트 프로젝트를 사용합니다. 먼저 `backend/.env.example`을 참고해 `backend/.env`를 작성합니다. 새 DB에는 스키마 준비가 필요합니다. [설정 안내](docs/setup.md)

첫 번째 터미널에서 읽기 API를 실행합니다.

```bash
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.reading_app:app --host 127.0.0.1 --port 8000
```

두 번째 터미널에서 화면을 실행합니다.

```bash
npm ci
npm run dev:reading
```

Vite 주소를 열어 개발용 시연 계정을 선택하고 **서재 → 작품 → 읽기 → 여기까지 읽음 → 장르별 분석 → 완독 문제** 순서로 확인합니다. 개발 시연 모드와 Supabase Auth를 사용하는 운영 모드는 다릅니다.

| 환경 변수 | 위치 | 용도 |
| --- | --- | --- |
| `READING_DATABASE_URL` | 서버 | Supabase PostgreSQL Session pooler 접속 |
| `READING_DATABASE_SSLROOTCERT` | 서버 | 필요한 환경의 DB TLS 인증서 경로 |
| `GEMINI_API_KEY` | 서버 | Gemini 분석 요청 |
| `READING_GEMINI_MODEL` | 서버 | 사용할 Gemini 모델 ID |
| `VITE_USE_MOCK=false` | 프런트 | 실제 읽기 API 사용. `.env.reading`에 설정 |
| `VITE_API_BASE_URL` | 프런트 | 개발 프록시 사용 시 비워 둠 |

키와 DB 비밀번호는 서버에만 저장하고 Git에 올리지 않습니다.

## 기술 구성

| 영역 | 기술·역할 |
| --- | --- |
| 화면 | React, TypeScript, Vite, React Router |
| 서버 상태 | TanStack Query |
| 읽기 API | FastAPI, Pydantic |
| 저장·운영 인증 | Supabase PostgreSQL, Supabase Auth |
| 장르별 생성 | Gemini API, 구조화된 응답·원문 번호 검증 |
| 도트 그래픽 | TypeScript 인간형·개념형 생성기, SVG 렌더링 |
| 배포 구성 | Vercel 정적 화면·Python Function |

`npm run dev`의 MSW 예시 화면은 둘러보기용입니다. 실제 저장·API 검증은 `npm run dev:reading`으로 수행합니다. SQLite 개발 대체 경로도 코드에 남아 있지만 아래 데이터 검증은 Supabase에서 수행했습니다.

## 검증한 내용

| 개발용 네 작품의 검사 | 확인 결과 |
| --- | --- |
| 활성 분석의 인용 문자열 | 110건 중 불일치 0건 |
| 풀이 전 정답·해설 필드 비공개 | 4개 응답에서 노출 0건 |
| 시 5지선다 형식 | 3문항 검사 통과 |
| 장르 분석 함수의 미독·부분·완독 경계 | 시·전공서적·논문 9개 경계 검사 통과 |
| 브라우저 독서·보상 흐름 | 전용 Supabase 검증 책으로 잠금·오답 미지급·정답 연출·반복 동작·중복 지급 방지 확인 |

기존 개발 환경의 검사 기록이며 새 저장소의 모든 운영 환경을 보장하지 않습니다. 인용 일치는 의미 정확도와 다릅니다. 내용 정확도·근거 적합도·핵심 포함률은 독립 채점이 필요합니다. 설명 168개·완독 문제 단위 12개·기준 초안 24개를 평가 대상으로 준비했으며, 다중 모델 가상 예시는 실측 성능에 포함하지 않습니다. [평가 방법](docs/reading-analysis-evaluation.md)

## 구조

```text
src/
  api/              API 연결·인증·오류 처리
  domain/           도메인 타입·읽기 위치
  hooks/            데이터 조회·상태 캐시
  components/pixel/ 도트 생성·캐릭터 동작
  pages/            서재·읽기·분석·퀴즈·마을 화면
  mocks/            별도 데모용 예시 응답
backend/
  app/              읽기 API·계정 격리·장르 분석
  scripts/          DB 스키마·분석 워커·평가 도구
  tests/            API 회귀 검사
api/                Vercel Python 진입점
docs/               설정·분석 평가·도트 규격
```

## 배포와 관련 문서

새 저장소의 운영 배포는 별도로 연결해야 합니다. GitHub 복사만으로 기존 Vercel·Supabase 설정이 이전되지는 않습니다. 운영 빌드는 인증 원점·DB 식별자·커밋 SHA를 검사하므로 담당자가 승인한 배포 대상 설정을 확인합니다.

- [실행·데이터 연결](docs/setup.md)
- [기존 팀 운영 배포 구성](docs/production-release.md) — 기존 Intereading 배포의 참고 기록
- [AI 분석 실행](backend/scripts/reading_genre_analysis.md)
- [픽셀 캐릭터 규격](docs/pixel-character-spec.md) · [개념형 캐릭터 설계](docs/concept-diagram-characters.md)
- [기존 프로젝트 출처와 정리 범위](docs/source-provenance.md)

원문·표지·외부 자료는 각 출처의 이용 조건을 따릅니다. 평가용 정답표와 개인 독서 데이터는 제품 사용자에게 공개하지 않습니다.
