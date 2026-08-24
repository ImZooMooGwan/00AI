# Deployment

## Sites·Cloudflare 호환 배포

프로젝트는 `npm run build` 후 `dist/server/index.js`의 Cloudflare Worker 호환 ESM과 정적 자산을 생성한다. 현재 `.openai/hosting.json`의 Sites 프로젝트에 체크포인트 배포한다.

## GitHub CI

`.github/workflows/ci.yml`은 main push와 pull request에서 설치, 데이터 검증, lint, typecheck, 테스트·빌드를 수행한다.

## 환경변수

공공데이터 API 키는 배포 플랫폼의 서버 환경변수에 저장한다. `.env.local`과 서비스 역할 키는 커밋하지 않는다. API 키가 없으면 마지막 검증 스냅샷과 연결 상태를 보여준다.

