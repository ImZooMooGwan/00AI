# 00AI ATS

사내 채용담당자용 ATS 초기 운영 베이스. React/Vite 프런트엔드와 Cloudflare Worker API, D1, Workers KV 파일 저장, Queues, Cron, Access 구성을 제공합니다.

## 실행

```bash
npm install
npm run dev
```

초기 화면에는 지원자 예시를 넣지 않습니다. 로컬에서 API가 연결되지 않으면 빈 파이프라인이 표시됩니다. 실제 배포는 D1과 로그인 비밀번호로 보호됩니다.

## 검증

```bash
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run --config dist/00ai_ats/wrangler.json
```

## Cloudflare 배포

1. Cloudflare 인증을 가진 관리 PC에서 `npx wrangler login`을 실행합니다.
2. 리소스를 생성합니다: D1 `00ai-ats`, Workers KV `00ai-ats-resumes`, Queue `00ai-ats-email`을 생성합니다. 이력서 최대 크기는 10 MB이며 Workers KV Free 한도는 계정 기준 1 GB입니다. 현재 배포는 계정에서 R2가 활성화되지 않아 KV를 사용합니다. KV는 글로벌 복제 저장소라 다른 위치에서 최근 파일을 읽을 때 최대 60초 지연될 수 있습니다. R2 활성화 후에는 객체 저장소로 전환하는 것을 권장합니다.
3. D1 실제 ID를 `wrangler.jsonc`의 database_id에 입력합니다.
4. `wrangler d1 migrations apply 00ai-ats --remote`로 스키마를 적용합니다.
5. Access application을 만들어 사이트 경로 전체를 보호하고 `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`를 vars에 설정합니다. 별도 Access 설정 전에는 Worker secrets `ATS_ACCESS_PASSWORD`, `ATS_SESSION_SECRET`을 설정해 로그인합니다.
6. `wrangler secret put HASA_API_KEY`로 HASA 키를 설정하고 HASA base URL/호환 API 계약을 확인합니다.
7. Cloudflare Email Sending에 발신 도메인을 등록한 뒤 `EMAIL` binding 및 발신 주소를 설정합니다.
8. `npm run build && npx wrangler deploy --config dist/00ai_ats/wrangler.json`을 실행합니다.

운영 배포 전 `DEMO_MODE`가 반드시 `false`인지 확인합니다. 비밀값을 `.env`, 브라우저 번들, Git 저장소에 넣지 않습니다.

## 기능 범위와 제한

현재 구현: 반응형 칸반, 검색/포지션 필터, 카드 상세 drawer, 중복 이메일 후보자 재사용을 포함한 신규 지원건 등록, 단계 이동 및 Undo, D1 상태 이력/낙관적 동시성, 10분 지연 거절 이메일 예약/취소/중복 claim 방지, Workers KV/R2 파일 저장 경로, Access JWT 또는 공유 비밀번호 세션 검증, HASA 서버 프록시. 실제 발송에는 Email binding 및 발신 도메인 설정이 필요합니다.

운영 베타 전 추가 구현이 필요한 항목: 평가/면접 CRUD 화면과 API, 대량 XLSX/CSV 등록, 이력서 브라우저 미리보기/문서 파싱, 이메일 템플릿 편집 및 수동 재시도·취소 UI, 사용자 초대/역할 관리 UI, 활동 기록 화면, 웹훅 기반 전달/반송 상태 반영, 개인정보 파기 및 보존 작업, 실제 HASA 규격 검증. 이 항목들은 완료된 것으로 표시하지 않습니다.
