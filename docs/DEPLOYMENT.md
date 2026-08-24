# Deployment

## Sites·Cloudflare 호환 배포

프로젝트는 `npm run build` 후 `dist/server/index.js`의 Cloudflare Worker 호환 ESM과 정적 자산을 생성한다. 현재 `.openai/hosting.json`의 Sites 프로젝트에 체크포인트 배포한다.

`DB` 논리 바인딩은 Sites가 관리하는 Cloudflare D1에 연결된다. `drizzle/`의 SQL 마이그레이션이 배포 산출물 `dist/.openai/drizzle/`에 포함되어 스키마 변경과 소스 버전이 함께 보존된다.

## GitHub CI

`.github/workflows/ci.yml`은 main push와 pull request에서 설치, 데이터 검증, lint, typecheck, 테스트·빌드를 수행한다.

## 환경변수

공공데이터 API 키와 `SYNC_SECRET`은 Sites의 서버 환경변수에 저장한다. `.env.local`과 운영 키는 커밋하지 않는다. API 키가 없으면 검증 스냅샷을 유지하고 원천 상태를 `key_required`로 표시한다.
