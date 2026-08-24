# 배포

## 사전 준비

Cloudflare Workers, D1, Custom Domain을 관리할 권한과 온통청년·국가법령정보 API 인증값이 필요합니다.

```bash
cd apps/youth-policy-mcp
npm ci
npx wrangler d1 create 00ai-youth-policy
```

출력된 `database_id`로 `wrangler.jsonc`의 placeholder UUID를 교체합니다.

## 마이그레이션과 Secret

```bash
npm run db:migrate:remote
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

Workers 배포 이력에서 직전 버전으로 롤백합니다. 마이그레이션은 기존 테이블·데이터를 제거하지 않습니다. 스키마 롤백이 필요하면 별도 전진 마이그레이션을 작성하고 운영 데이터에 `DROP`이나 초기화를 직접 실행하지 않습니다.

## 현재 외부 블로커

저장소에는 배포 준비 코드만 포함됩니다. 실제 D1 ID, Cloudflare 계정·도메인 권한과 세 API Secret이 없으면 공개 URL 활성화와 실데이터 수집은 완료할 수 없습니다.
