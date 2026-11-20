# 무료 운영 서재 배포

[운영 서재](https://intereading-2026-bootcamp-hackathon.vercel.app/library)와 FastAPI는 하나의 Vercel 프로젝트에 배포한다. 브라우저는 현재 도메인의 `/api/reading`을 호출한다. 계정과 기록은 [intereading-seoul](https://supabase.com/dashboard/project/eowbmvmpnyaybmwjgwyo)에 저장한다. Supabase Free 조직에서 생성한 뒤 세션 풀러의 서울 리전(ap-northeast-2), 스키마 버전 1과 운영 로그인 콜백을 확인했다. 기존 뭄바이 테스트 프로젝트는 운영 연결 대상에서 제외한다.

| 역할 | 실행 위치 |
| --- | --- |
| 정적 화면·운영 API | Vercel Hobby, Vite와 Python Function을 한 번에 배포. 함수 지역은 서울 `icn1`. |
| 로그인·DB | Supabase Free와 PostgreSQL. 등록된 독자는 이메일 매직링크 또는 Google 계정으로 로그인한다. |
| TXT 분석 | 업로드 요청 안에서 내장 분석기 또는 제공된 활동 JSON을 처리하고 트랜잭션으로 저장한다. 카탈로그는 준비된 데이터를 읽는다. 무료 운영에 상시 워커, 크론, 외부 모델 키가 필요하지 않다. |

## 최초 연결

1. 팀의 Vercel 플랜이 Hobby이고 Supabase 조직이 Free인지 확인한다. Hobby는 개인 비상업 프로젝트용이다. 무료 한도를 넘거나 DB가 일시 정지되면 서비스가 제한될 수 있다. [Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Supabase 요금제](https://supabase.com/pricing)
2. Supabase SQL Editor에서 [운영 스키마](../backend/scripts/reading_release_v1.sql)를 적용한다. 기존 공용 `reading` 스키마는 보존된다. 서버 전용 LOGIN 역할에 `reading_service`를 부여한다. `SELECT database_id FROM reading_control.installation;` 결과로 DB 식별자를 확인한다. `reading_control`과 개별 `reader_*` 스키마는 Data API에 공개하지 않는다.
3. Supabase Auth의 Site URL에 운영 원점을, Redirect URLs에 운영 원점의 `/login`을 등록한다. 초대·등록된 이메일로 로그인 링크를 발송한다. PKCE로 로그인하므로 링크는 요청한 브라우저에서 연다.
4. Vercel의 Production 환경에 아래 변수를 등록한다. Preview는 운영 DB 접속을 차단하며 `/api/reading/version`만 제공한다. Vercel의 System Environment Variables를 활성화하여 프론트와 함수에 같은 Git 커밋이 전달되도록 한다.

| Production 환경 변수 | 값 |
| --- | --- |
| `VITE_USE_MOCK` | `false` |
| `SUPABASE_URL` | 생략 가능. 배포 대상 파일의 서울 프로젝트 주소를 사용한다. 별도 설정 시 같은 주소여야 한다. |
| `SUPABASE_PUBLISHABLE_KEY` | Vite와 API가 함께 사용하는 같은 프로젝트의 공개 키 `sb_publishable_…` |
| `READING_DATABASE_URL` | 역할 이름은 `intereading_runtime`으로 지정한다. 서울 프로젝트의 Session pooler URI, 포트 5432. Vercel 민감 변수로 저장한다. 요청별 역할 및 스키마 선택에 세션 연결이 필요하다. |
| `READING_DATABASE_ID` | 생략 가능. [배포 대상 파일](../backend/app/production-target.json)에 서울 DB의 설치 UUID를 고정했다. |
| `READING_DATABASE_SSLROOTCERT` | TLS 발급 CA를 확인하고, 필요한 경우 `backend/` 기준 인증서 경로를 설정한다. |
| `VITE_API_BASE_URL` | 비워 둔다. |
| `VITE_GOOGLE_LOGIN_ENABLED` | Google 공급자와 초대 전용 가입 정책을 설정한 뒤 `true`로 지정한다. |

## Google 로그인 연결

1. Google Auth Platform에서 웹 애플리케이션 OAuth 클라이언트를 만든다. 승인된 JavaScript 원본에 앱 원점을, 승인된 리디렉션 URI에 Supabase Google 공급자 화면의 콜백 주소(`https://<project-ref>.supabase.co/auth/v1/callback`)를 등록한다. [Supabase Google 로그인 설정](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
2. Supabase의 **Authentication → Sign In / Providers**에서 **Allow new users to sign up**을 끈다. Google 공급자를 활성화하고 Google Client ID와 Client Secret을 해당 화면에 저장한다. 독자는 관리자가 초대하거나 등록한다. [Supabase 가입 정책](https://supabase.com/docs/guides/auth/general-configuration)
3. Supabase Redirect URLs에 운영 앱의 정확한 `/login` 주소를 등록한다. 로컬에서 테스트할 때는 테스트 Supabase 프로젝트의 Redirect URLs에 `http://localhost:5173/login`을 등록한다. Vercel에서 `VITE_GOOGLE_LOGIN_ENABLED=true`를 설정하고 후보를 빌드한다.
4. 등록된 독자가 매직링크와 동일한 이메일의 Google 계정으로 로그인해 기존 서재를 여는지 확인한다. Supabase가 동일 이메일의 OAuth ID를 기존 계정에 연결하므로 서재 식별자인 사용자 UUID가 유지된다. 등록되지 않은 Google 계정의 로그인 거부와 Google 인증 취소 후 재시도도 확인한다. [Supabase 계정 연결](https://supabase.com/docs/guides/auth/auth-identity-linking)

## 배포 확인과 전환

- PR의 **Reading integration**은 두 독자 격리, PostgreSQL 저장, 프론트 빌드를 검사한다. Vercel 프리뷰의 `/library`와 `/api/reading/version`이 각각 HTML과 해당 커밋의 JSON을 반환하는지 확인한다.
- Vercel Production은 `main`을 추적하고 **Auto-assign Custom Production Domains**를 해제한다. 병합하면 Git 연동이 운영 환경변수로 후보를 빌드한다. 기존 운영 도메인은 승격 전까지 앞선 배포를 가리킨다.
- 후보 고유 주소에서 `/release.json`의 SHA와 인증 원점, `/library`의 JS, `/api/reading/health`의 SHA·DB UUID·스키마, 비로그인 `/api/reading/me`의 401을 확인한다. 같은 커밋인지 확인한 뒤 Vercel의 **Promote to Production**으로 해당 빌드를 승격하고 운영 도메인에서 같은 검사를 반복한다. [검증 스크립트](../scripts/verify-release.mjs)
- CLI로 배포하는 팀은 선택적으로 [Promote reading production](https://github.com/Waterrrrrit/intereading_2026_bootcamp_hackathon/blob/5ec3070/.github/workflows/reading-release.yml)을 사용할 수 있다. 이 경로에는 GitHub `production` Environment의 `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, Secret `VERCEL_TOKEN`이 필요하고, 후보가 보호된 경우 `VERCEL_AUTOMATION_BYPASS_SECRET`도 필요하다. 대시보드에서 승격할 때는 이 값들이 필요하지 않다.
- 운영 일반 창과 시크릿 창에 같은 이메일로 로그인하고 진도와 메모가 복원되는지 확인한다. 이미 열린 탭은 버전 알림이 뜨면 메모를 저장한 뒤 새 버전을 연다. 장애가 있으면 하위 호환 DB를 유지하고 Vercel에서 이전의 검증된 배포로 프론트와 함수를 함께 롤백한다.

계정별 저장소는 인증된 UUID의 첫 접속에서 생성한다. 공용 데모와 브라우저에 있던 미귀속 기록은 실제 소유자를 확인한 후 별도로 이관한다.
