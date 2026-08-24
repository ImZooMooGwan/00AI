# 청년정책데이터허브 Y-HUB

> AI로 시각화한 대한민국 청년정책  
> 정책의 발표가 아니라, 정책의 변화를 기록합니다.

Y-HUB는 중앙정부와 지방정부의 청년정책을 정책 패밀리, 프로그램, 모집회차, 버전, 원천문서로 분리하고 변경 이력과 검증상태를 공개하는 정책 데이터 인프라입니다.

## 현재 MVP

- 공식 출처가 연결된 중앙·지역 청년정책 32개
- 정책 변경 이벤트 8개와 필드 단위 Diff
- 청년지표 메타데이터 12개
- 정책 Pulse, 변경 피드, 정책 레지스트리, 상세 9개 영역
- 신청 스윔레인, 17개 시도 정책지도, 정책 관계망
- 최대 3개 정책 비교, Research Lab, Newsroom, 공개 검증대장
- CSV·JSON 다운로드, RSS 피드, Open API v1
- Cloudflare D1 영속 저장, 수집 실행이력, 원문 해시와 변경 후보 보존
- 온통청년·KOSIS·국가법령정보 서버 수집기와 운영 상태 화면
- GitHub `apps/youth-policy-mcp`의 6개 읽기 전용 도구를 사용하는 Streamable HTTP 클라이언트
- MCP 장애 시 D1 공식 수집 레코드, 다시 검증 스냅샷으로 자동 전환
- 데이터·출처·그래프·기준일 검증 스크립트
- 인메모리 SQLite로 D1 마이그레이션·삽입·무변경·변경감지 검증
- 모바일, 키보드 탐색, 고대비·동작 줄이기 대응

현재 데이터셋 `2026.08.24-mvp.1`은 개발 스냅샷입니다. 정책의 존재와 공식 출처 연결을 우선 확인했으며, 변동 가능한 신청기간·소득·자격은 반드시 공식 원문에서 최종 확인해야 합니다.

## 실행

요구 환경: Node.js 22.13 이상

```bash
npm ci
npm run dev
```

주요 검증:

```bash
npm run validate:all
npm run lint
npm run typecheck
npm test
```

## 주요 화면

| 경로 | 기능 |
|---|---|
| `/` | 분야·지역 필터, 정책 은하/대장, 실시간 변화가 결합된 청년정책 지도 |
| `/changes` | 변경 피드·검증필터·필드 Diff |
| `/policies` | 상황·지역·분야·상태별 정책 탐색 |
| `/policy/[slug]` | 정책 상세 9개 영역·신청 스윔레인 |
| `/compare` | 최대 3개 정책 비교 |
| `/indicators` | 청년지표 메타데이터 관측소 |
| `/map` | 17개 시도 정책지도 |
| `/graph` | 설명 가능한 정책 관계망 |
| `/research` | 재현 가능한 추출·인용·다운로드 |
| `/newsroom` | 검증 가능한 정책 변화 모니터 |
| `/verification` | 공개 검증대장 |
| `/downloads` | 버전 데이터 릴리스 |
| `/api` | Open API v1 문서 |
| `/admin` | 공식 API 수집·D1·변경감지 운영실 |

## Open API

```text
GET /api/v1/policies
GET /api/v1/policies/{id}
GET /api/v1/programs
GET /api/v1/rounds
GET /api/v1/changes
GET /api/v1/indicators
GET /api/v1/regions
GET /api/v1/organizations
GET /api/v1/legal-bases
GET /api/v1/sources
GET /api/v1/verification-issues
GET /api/v1/graph
GET /api/v1/datasets
GET /api/v1/live-policies
GET /api/v1/mcp/status
GET /api/v1/collection-status
GET /api/openapi
```

공통 응답에는 `apiVersion`, `datasetVersion`, `generatedAt`, `recordCount`, `sourceCount`, `license`, `nextCursor`가 포함됩니다.

## 공식 데이터 연동

검증 스냅샷은 안정적인 공개 기준선으로 유지하고, 공식 API 응답은 D1에 별도 영속 저장합니다. 같은 원천 레코드의 해시가 달라지면 자동으로 변경 후보가 생성됩니다. 실시간 정책 검색은 `YOUTH_POLICY_MCP_URL`의 청년정책 MCP를 우선 사용하고, 실패하면 이 D1 계층과 검증 스냅샷 순으로 전환합니다.

```bash
cp .env.example .env.local
```

온통청년, KOSIS, 국가법령정보 공동활용 API는 각각 별도 신청·승인이 필요합니다. 키는 서버 환경변수로만 관리하고 브라우저에 노출하지 않습니다. 키가 연결된 원천은 `/admin`에서 즉시 동기화할 수 있고 Worker 예약 이벤트에서도 같은 수집기를 실행합니다.

## 문서

- [아키텍처](docs/ARCHITECTURE.md)
- [데이터 모델](docs/DATA_MODEL.md)
- [공식 데이터 출처](docs/DATA_SOURCES.md)
- [변경 감지](docs/CHANGE_DETECTION.md)
- [검증 원칙](docs/VERIFICATION.md)
- [방법론](docs/METHODOLOGY.md)
- [배포](docs/DEPLOYMENT.md)
- [실시간 수집](docs/INGESTION.md)
- [결정 기록](docs/DECISIONS.md)
- [미완료 과제](docs/OPEN_ISSUES.md)

## 라이선스와 주의사항

소스코드는 MIT License를 따릅니다. 공공데이터는 각 원천기관의 이용조건과 공공누리 유형을 우선 적용합니다. 이 저장소는 공식 정부 서비스가 아니며, Y-HUB의 AI 설명은 공식 원문을 대체하지 않습니다.
