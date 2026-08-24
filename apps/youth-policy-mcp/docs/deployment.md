# 배포

## 사전 준비

Cloudflare Workers, Workers KV, Custom Domain을 관리할 권한과 온통청년·국가법령정보 API 인증값이 필요합니다.

`main`에 변경이 반영되면 GitHub Actions가 저장소의 Cloudflare API Token을
사용해 KV namespace 생성·Worker 배포·`mcp.00ai.kr` 연결·MCP 프로토콜
검증을 자동 수행합니다. KV namespace는 `00ai-youth-policy`라는 고정 이름으로 재사용하므로
재배포해도 기존 정책 데이터가 유지됩니다.

```bash
cd apps/youth-policy-mcp
npm ci
npx wrangler kv namespace create 00ai-youth-policy --binding POLICY_STORE
```

수동 배포일 때만 출력된 namespace ID로 `wrangler.jsonc`의 placeholder를 교체하고 `POLICY_STORAGE_BACKEND`를 `kv`로 설정합니다. GitHub Actions는 이 배포 전용 설정을 자동 생성합니다.

## Secret

```bash
npx wrangler secret put YOUTH_POLICY_API_KEY
npx wrangler secret put LAW_API_OC
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
- 도구 수 6개와 annotation
- API 키를 설정한 뒤 수동 동기화 1회
- 검색 결과의 원천 ID·URL·기준일

## Cron

Cloudflare Cron은 UTC이므로 `30 18 * * *`가 한국시간 03:30입니다. Git에 있는 `SYNC_CRON_KST`는 운영자용 표시값이며 실제 트리거는 `wrangler.jsonc`의 UTC 표현이 권위값입니다.

## 롤백

Workers 배포 이력에서 직전 버전으로 롤백합니다. KV는 현재와 직전의 불변 스냅샷을 유지하므로 새 스냅샷 전파 중에는 자동으로 직전 세대를 읽습니다. 데이터 포맷 롤백이 필요하면 새 세대를 발행하고 운영 namespace를 직접 초기화하지 않습니다.

## 현재 외부 블로커

Cloudflare API Token이 없으면 자동 배포할 수 없습니다. 온통청년·법령 API Secret이
없어도 MCP 서버와 빈 KV 저장소는 배포되지만 실데이터 동기화는 건너뜁니다. 세 API Secret은
GitHub Actions Secret 또는 `wrangler secret put`으로만 설정합니다.
