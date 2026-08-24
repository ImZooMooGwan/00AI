# Current State

## 저장소 감사 결과

- 프레임워크: Next.js App Router 호환 Vinext, React 19, TypeScript strict, Tailwind CSS 4
- 런타임: Cloudflare Worker 호환 ESM
- 데이터: `lib/data.ts`의 검증 스냅샷 32개 정책, 8개 변경, 12개 지표 메타데이터
- API: Next.js Route Handler 기반 Open API v1, CSV·JSON, RSS
- 환경변수: `.env.example`에 공공데이터 API 키 변수만 선언
- 테스트: 데이터·출처·그래프·기준일 검증, lint, typecheck, 빌드 후 HTML/API/RSS 테스트
- 배포: Sites 체크포인트와 GitHub Actions 구성

초기 저장소는 최소 Vinext 스타터였으며 기존 서비스 데이터나 디자인 자산은 없었다. 스타터의 빌드·Worker 구조는 보존하고 서비스 계층을 추가했다.

