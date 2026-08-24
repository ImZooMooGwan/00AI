# Current State

## 저장소 감사 결과

- 프레임워크: Next.js App Router 호환 Vinext, React 19, TypeScript strict, Tailwind CSS 4
- 런타임: Cloudflare Worker 호환 ESM
- 데이터: `lib/data.ts`의 검증 스냅샷과 D1의 외부 원천 레코드를 분리 운영
- 영속 계층: D1 5개 테이블(원천 상태, 실행이력, 외부 레코드, 변경 후보, 지표 관측값)
- 수집기: 온통청년 정책, KOSIS 통합검색, 국가법령정보 현행법령 검색
- API: Next.js Route Handler 기반 Open API v1, CSV·JSON, RSS
- 환경변수: 공식 API 키, 수집 페이지 상한, 내부 동기화 비밀값 선언
- 테스트: 데이터·출처·그래프·기준일 검증, lint, typecheck, 빌드 후 HTML/API/RSS 테스트
- 배포: Sites 체크포인트와 GitHub Actions 구성

초기 저장소는 최소 Vinext 스타터였으며 기존 서비스 데이터나 디자인 자산은 없었다. 스타터의 빌드·Worker 구조는 보존하고 서비스 계층을 추가했다.
