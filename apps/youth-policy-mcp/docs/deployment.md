# 배포

## 사전 준비

Cloudflare Workers와 Custom Domain을 관리할 권한, 온통청년·국가법령정보 API 인증값이 필요합니다. Durable Object SQLite namespace는 Worker 배포와 함께 생성되므로 별도의 D1·KV API 권한은 필요하지 않습니다.

`main`에 변경이 반영되면 GitHub Actions가 저장소의 Cloudflare API Token을
사용해 Durable Object SQLite 생성·Worker 배포·`mcp.00ai.kr` 연결·MCP 프로토콜
검증을 자동 수행합니다. `YouthPolicyStore` class namespace는 재배포해도 같은 저장소를
유지합니다.

```bash
cd apps/youth-policy-mcp
npm ci
jq 'del(.d1_databases) | .vars.POLICY_STORAGE_BACKEND = "durable_object"' \
  wrangler.jsonc > wrangler.deploy.jsonc
npx wrangler deploy --config wrangler.deploy.jsonc
```

수동 운영 배포에서는 D1 binding을 제외한 설정으로 `POLICY_STORAGE_BACKEND=durable_object`를 사용합니다. GitHub Actions는 이 배포 전용 설정을 자동 생성합니다.

## Secret

```bash
npx wrangler secret put YOUTH_POLICY_API_KEY
npx wrangler secret put LAW_API_OC
npx wrangler secret put HASA_API_KEY
npx wrangler secret put SYNC_SECRET
```

Secret을 `wrangler.jsonc`, `.env.example`, GitHub Actions 로그에 넣지 않습니다.

## 배포·검증

```bash
npm run check
npm test
npm run build
npm run deploy
curl -fsS https://<worker>.workers.dev/youth/health
```

검증 후 Cloudflare Custom Domain에서 `mcp.00ai.kr`을 Worker origin으로 연결하고 다음을 확인합니다.

- `GET https://mcp.00ai.kr/youth/health`
- MCP Inspector로 `https://mcp.00ai.kr/youth` 초기화
- 도구 수 7개와 annotation
- API 키를 설정한 뒤 수동 동기화 1회
- 검색 결과의 원천 ID·URL·기준일

## Cron

Cloudflare Cron은 UTC이므로 `30 18 * * *`가 한국시간 03:30입니다. Git에 있는 `SYNC_CRON_KST`는 운영자용 표시값이며 실제 트리거는 `wrangler.jsonc`의 UTC 표현이 권위값입니다.

## 롤백

Workers 배포 이력에서 직전 버전으로 롤백합니다. Durable Object schema는 `_sql_schema_migrations`의 전진 마이그레이션만 사용하며 운영 namespace를 직접 초기화하지 않습니다. SQLite Point-in-Time Recovery가 필요한 경우 Cloudflare의 보존 정책과 복구 절차를 따릅니다.

## 현재 외부 블로커

Cloudflare API Token이 없으면 자동 배포할 수 없습니다. 온통청년 키가 없으면 Y-HUB 검증 스냅샷으로 저장소를 초기화하므로 검색은 동작하지만 공식 실시간 수집은 활성화되지 않습니다. HASA 키가 없으면 선택형 AI 분석 도구만 `HASA_API_KEY_REQUIRED`를 반환합니다. Secret은 GitHub Actions Secret 또는 `wrangler secret put`으로만 설정합니다.
