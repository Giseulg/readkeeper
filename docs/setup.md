# 실행·데이터 연결

저장소 루트에서 README의 설치·실행 명령을 사용한다. `backend/.env.example`은 값 없는 양식이며 실제 접속 정보는 담당자가 별도로 제공한다. 테스트는 팀 Supabase 테스트 프로젝트에 연결한다. 운영 계정의 자료를 테스트 데이터로 수정하지 않는다.

## 개발용 Supabase

1. Session pooler URI를 `backend/.env`의 `READING_DATABASE_URL`에 설정한다. SSL 인증서가 필요하면 발급 CA를 확인해 `READING_DATABASE_SSLROOTCERT`에 지정한다. 다른 프로젝트의 인증서·비밀번호를 재사용하지 않는다.
2. 처음 만든 개발 프로젝트에는 [읽기 스키마](../backend/scripts/reading_postgres_schema.sql), [분석 대기열 스키마](../backend/scripts/reading_genre_migration.sql), [게임·캐릭터 스키마](../backend/scripts/reading_game_migration.sql)를 담당자가 검토한 뒤 순서대로 적용한다. 마지막 스키마는 보상 캐릭터 저장과 요청 중복 방지에 필요하다. 이미 사용 중인 프로젝트에는 필요한 추가 마이그레이션만 확인해 적용한다. 운영 계정별 스키마는 별도 운영 배포 절차를 따른다.
3. FastAPI와 `npm run dev:reading`을 실행한다. 이 모드는 개발용 시연 계정과 실제 읽기 API를 사용한다. 운영 로그인 모드가 아니다.
4. 빈 DB는 기존 팀 DB의 책·분석 결과를 자동 복제하지 않는다. 공개·전송 가능한 TXT를 등록하고, 필요한 경우 활동 JSON과 전문 분석 명령을 적용한다. [분석 실행 안내](../backend/scripts/reading_genre_analysis.md)

Gemini의 키·사용할 모델 ID는 서버 환경 변수에 설정한다. 원문 전송 권한을 확인한 자료만 분석한다. 시 분석 `--poetry-study BOOK_ID`, 전공서적 분석 `--concept-flow BOOK_ID`, 캐릭터 설계 `--character-design BOOK_ID`를 지원한다. 생성 후 정확성과 원문 근거를 검토한다. 현재 태양광 구조도 명령은 지정된 카탈로그 책을 대상으로 한다.

## 데모와 빌드

- `npm run dev`: MSW 예시 데이터. 실제 DB 검증을 대신하지 않는다.
- `npm run dev:reading`: 실제 API에 연결하는 개발 서버.
- `npm run build:demo`: 별도 서버 키 없이 만드는 데모 번들.
- `npm run build`: 운영 설정·대상 원점·커밋 SHA를 확인하는 운영 빌드. `vite.config.ts`의 조건을 충족해야 한다.
- `npm run lint`: 프런트 코드 검사.

## 운영 배포

운영 모드는 Supabase Auth와 사용자별 스키마를 사용한다. [기존 운영 배포 문서](production-release.md)는 원본 팀 프로젝트의 설정 참고용이며 이 저장소가 이미 배포되었다는 뜻이 아니다. 새 Vercel 프로젝트, 로그인 콜백, 서버 전용 DB 역할과 환경 변수를 따로 설정한다.

`backend/app/production-target.json`은 원본 운영 대상의 공개 식별자를 가진 보호 설정이다. 비밀 키가 아니지만 새 운영 DB로 전환할 때는 API·프런트가 동일한 대상으로 검증되도록 담당자가 함께 변경해야 한다. 이를 우회하거나 기존 운영 DB에 새 테스트 자료를 넣지 않는다.
