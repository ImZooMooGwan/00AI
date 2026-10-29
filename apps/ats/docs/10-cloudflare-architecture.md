# Cloudflare 구성

- Worker: `worker/index.ts`
- Static asset binding: Vite `dist`
- D1: `00ai-ats`, 스키마 `migrations/0001_init.sql`
- R2: 비공개 `00ai-ats-resumes`
- Queue producer/consumer: `00ai-ats-email`, DLQ `00ai-ats-email-dlq`
- Cron: 매 분 due 예약 처리
- Access: Cloudflare Access application policy로 웹 화면과 `/api/*` 전체 도메인을 모두 보호한다. 이메일/조직 정책을 구성하고 AUD 및 Team 도메인을 Worker 환경으로 전달. Worker는 API 접근 시 Access JWT 서명/issuer/audience도 재검증
- Email: `EMAIL` send_email binding과 도메인 온보딩 필요

운영 전 database_id를 실제 값으로 대체하고 `wrangler d1 migrations apply`를 실행한다. R2/Queues 리소스 생성 후 `wrangler deploy`한다. Access 인증정보, HASA 키는 `wrangler secret put`으로 등록한다. 이메일 binding의 발신자 도메인을 사전 인증한다.
