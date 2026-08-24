# 00AI Youth Policy MCP

`Y-HUB MCP`는 온통청년·국가법령정보·Y-HUB 영속 데이터에 근거해 대한민국 청년정책을 검색, 비교하고 자격조건·변경이력·출처를 확인하는 읽기 전용 원격 MCP 서버입니다.

- 목표 MCP 엔드포인트: `https://mcp.00ai.kr/youth`
- 헬스체크: `https://mcp.00ai.kr/youth/health`
- 전송 방식: stateless Streamable HTTP
- 런타임: TypeScript + Cloudflare Workers + Durable Objects SQLite (운영) / D1 (로컬 회귀)
- 정상 정책 질의 중 LLM API 호출: 없음

## 구조

```text
온통청년 API ─┐
국가법령 API ─┼─ ingestion/validation/normalization ─ Durable Object SQLite
공식 공고 ────┘                                      │
                                                       ▼
                                       deterministic domain service
                                                       │
                              ┌────────────────────────┼──────────────┐
                              ▼                        ▼              ▼
                         Y-HUB MCP                 공개 API       Y-HUB 웹

KOSIS MCP ── 별도 통계 계층 (도구를 이 서버에 복제하지 않음)
```

MCP 핸들러는 `YouthPolicyService`를 호출하는 얇은 어댑터입니다. 저장소 인터페이스는 운영 Durable Object SQLite, 로컬 D1, 테스트용 메모리 구현을 분리합니다. 운영 저장소는 Worker 배포와 함께 생성되어 별도의 D1·KV API 권한이 필요하지 않으며 정책 원천 단위의 강한 일관성을 제공합니다. 공개 서버는 테스트 데이터를 실데이터 폴백으로 반환하지 않습니다.

## MCP 도구

| 도구 | 용도 |
| --- | --- |
| `search_youth_policies` | 자연어·지역·분류·연령·취업·신청상태 검색 |
| `get_youth_policy` | 현재 또는 과거 기준일의 정책 상세 조회 |
| `check_policy_eligibility` | 규칙 기반 사전 자격 점검 |
| `compare_youth_policies` | 최대 10개 정책 또는 지역·분류 비교 |
| `get_policy_changes` | 버전 간 필드별 변경이력 조회 |
| `get_policy_evidence` | 필드별 출처·해시·법적 근거 조회 |

모든 도구는 read-only, non-destructive, idempotent annotation을 가집니다. 자세한 스키마는 [docs/mcp-tools.md](docs/mcp-tools.md)를 참고하세요.

## 로컬 실행

Node.js 22.13 이상이 필요합니다.

```bash
cd apps/youth-policy-mcp
npm ci
cp .env.example .dev.vars
npm run db:migrate:local
npm run dev
```

로컬 MCP 주소는 `http://localhost:8787/youth`, 헬스체크는 `http://localhost:8787/youth/health`입니다. 실제 API 키 없이도 서버, 테스트, 빌드가 동작하며 동기화만 `skipped`로 기록됩니다.

## 로컬 데이터베이스 마이그레이션

```bash
# 로컬 D1
npm run db:migrate:local

# D1 권한이 있는 별도 환경에서만 원격 적용
npm run db:migrate:remote
```

마이그레이션은 `CREATE ... IF NOT EXISTS`를 사용하고 기존 정책 데이터를 삭제하지 않습니다. 상세 엔티티는 [docs/data-model.md](docs/data-model.md)에 있습니다.

## 환경변수와 비밀값

비밀값은 `.dev.vars` 또는 `wrangler secret put`으로만 주입합니다.

```bash
npx wrangler secret put YOUTH_POLICY_API_KEY
npx wrangler secret put LAW_API_OC
npx wrangler secret put SYNC_SECRET
```

필수 운영 설정:

- `YOUTH_POLICY_API_KEY`: 온통청년 API 인증키
- `LAW_API_OC`: 국가법령정보 공동활용 OC
- `SYNC_SECRET`: `/admin/sync` Bearer 인증값
- `YOUTH_POLICY_API_BASE_URL`, `YOUTH_POLICY_API_PATH`: 공식 온통청년 원천
- `KOSIS_MCP_URL`: 별도 국가통계 MCP 주소
- `MCP_PUBLIC_BASE_URL`: 공개 MCP 기준 URL

운영 배포 워크플로는 `YouthPolicyStore` SQLite Durable Object를 Worker와 함께 선언하고 배포 전용 설정을 자동 생성합니다. Git에 있는 D1 ID는 로컬 검증용 placeholder이며 `.env.example`에는 실제 비밀값이 없습니다.

## 동기화

Cloudflare Cron은 UTC `30 18 * * *`, 즉 한국시간 매일 03:30에 실행됩니다. 수동 실행은 공개 MCP와 분리된 인증 엔드포인트를 사용합니다.

```bash
curl -X POST http://localhost:8787/admin/sync \
  -H "Authorization: Bearer $SYNC_SECRET"
```

동기화는 최대 3회 지수 백오프, 10초 타임아웃, 2 MiB 응답 제한, 공식 호스트 허용목록을 적용합니다. 동일 원문 해시는 새 버전을 만들지 않습니다. 원천에서 사라진 정책은 성공한 전체 동기화에서 3회 연속 확인된 뒤 `source_missing`으로 변경합니다.

## 테스트와 빌드

```bash
npm run check
npm test
npm run build
```

테스트는 실제 API 키나 외부 네트워크를 사용하지 않습니다. JSON/XML 파싱, 날짜·지역, 자격 판정, 변경 감지, D1·Durable Object SQLite 버전 보존, MCP 초기화·도구 목록, HTTP 보안을 Workerd에서 검증합니다.

## MCP 연결 예시

MCP Inspector에서 `http://localhost:8787/youth` 또는 배포 후 `https://mcp.00ai.kr/youth`를 Streamable HTTP 서버로 추가합니다.

```json
{
  "mcpServers": {
    "youth-policy": {
      "url": "https://mcp.00ai.kr/youth"
    },
    "korean-stats": {
      "url": "https://mcp.gomdori.app/stats"
    }
  }
}
```

## 배포

1. GitHub Actions에 Workers·DNS 권한이 있는 Cloudflare API Token을 설정합니다.
2. 온통청년·법령 API와 수동 동기화 Secret을 설정합니다.
3. `main` 반영 시 워크플로가 SQLite Durable Object 생성, Worker 배포와 Custom Domain 연결을 함께 수행합니다.
4. 워크플로가 `/youth/health`, MCP 초기화와 6개 도구 목록을 실호출로 검증합니다.

세부 절차와 롤백은 [docs/deployment.md](docs/deployment.md), 일상 운영은 [docs/operations.md](docs/operations.md)를 참고하세요.

## 출처·한계·면책

- 정책 결과는 온통청년과 연결된 공식 원문을 기준으로 하며 기준일·수집일·원천 ID·URL을 함께 반환합니다.
- 법령 연결이 불확실하면 `manual_review`로 표시하며 추정한 법적 근거를 생성하지 않습니다.
- 통계 수치는 별도 KOSIS MCP 장애 시 추정하거나 대체하지 않습니다.
- 자격 판정은 공개된 구조화 조건의 사전 점검입니다. 최종 신청 자격, 선정 또는 지원을 보장하지 않으며 공식 공고와 담당기관 확인이 우선합니다.
- 데이터 장애 시 유사 정책·전국값·내장 Mock 데이터를 정답처럼 반환하지 않습니다.

## 장애 대응

먼저 `/youth/health`의 저장소 연결·`storage_backend`·마지막 동기화 상태를 확인하고 Workers Logs에서 구조화 이벤트를 조회합니다. 외부 API 오류에는 인증키나 원시 응답을 기록하지 않습니다. 복구 순서는 [docs/operations.md](docs/operations.md)에 정리되어 있습니다.
