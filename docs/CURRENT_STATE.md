# Current State

## 저장소 감사 결과

- 프레임워크: Next.js App Router 호환 Vinext, React 19, TypeScript strict, Tailwind CSS 4
- 런타임: Cloudflare Worker 호환 ESM
- 데이터: `lib/data.ts`의 검증 스냅샷과 D1의 외부 원천 레코드를 분리 운영
- 영속 계층: D1 5개 테이블(원천 상태, 실행이력, 외부 레코드, 변경 후보, 지표 관측값)
- 수집기: 온통청년 정책, KOSIS 통합검색, 국가법령정보 현행법령 검색
- MCP: GitHub `apps/youth-policy-mcp` Streamable HTTP 클라이언트, 6개 도구 계약 검증, 원격 우선 검색
- API: Next.js Route Handler 기반 Open API v1, CSV·JSON, RSS
- 환경변수: 공식 API 키, 수집 페이지 상한, 내부 동기화 비밀값 선언
- 테스트: 데이터·출처·그래프·기준일 검증, lint, typecheck, 빌드 후 HTML/API/RSS 테스트
- 배포: Sites 체크포인트와 GitHub Actions 구성

초기 저장소는 최소 Vinext 스타터였으며 기존 서비스 데이터나 디자인 자산은 없었다. 스타터의 빌드·Worker 구조는 보존하고 서비스 계층을 추가했다.

홈 화면은 정책 은하만 단독으로 제공하지 않고 첨부 마스터 기획의 데이터 허브 구조로 다시 통합했다. 첫 화면에서 브랜드·자연어 정책검색·실제 데이터 상태와 인터랙티브 정책 은하를 함께 제공하고, 아래에서 Policy Pulse, 7대 모듈, 변경 피드, 대한민국 정책지도, 2D 관계지도, 청년지표, 데이터 계보, 연구자·기자·시민·공무원별 진입 화면으로 이어진다.

정책 은하는 첫 화면의 핵심 시각화 모듈로 배치했다. Canvas 2D 투시 엔진은 드래그 회전, 휠·핀치 확대/축소, 자동 공전, 시네마, 은하/분야별 모드, 관계선·핵심 정책·입자 토글과 변화 연대기를 지원한다. 정책·기관·지역 검색은 해당 노드로 즉시 포커스하고 상세 패널을 열며, 모든 정보는 정책 목록·변경 피드·2D 관계지도에서도 탐색할 수 있다.

홈과 운영실에는 GitHub 청년정책 MCP 진단 카드가 있다. `/api/v1/live-policies`는 MCP의 `search_youth_policies`를 먼저 사용하고, 원격 서버가 내려가거나 아직 배포되지 않았을 때 D1 공식 수집 레코드와 32개 검증 스냅샷을 순서대로 제공한다. 이 폴백은 응답 메타데이터에 명시된다.
