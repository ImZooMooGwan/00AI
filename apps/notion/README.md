# 00AI Workspace

협업 문서와 공공 템플릿을 위한 Cloudflare 기반 워크스페이스. 프론트엔드는 React/Tiptap, 편집 상태는 Yjs, 동시 접속 조정과 영속화는 Durable Objects SQLite, 계정·공간·페이지 메타데이터는 D1을 사용합니다.

## 제품 범위

- 이메일 일회용 코드 로그인, 사용자별 개인 공간 및 다중 워크스페이스
- 페이지 생성·복제, 역할별 페이지 공유, 댓글과 해결 상태
- Tiptap 서식/표 편집, 브라우저 IndexedDB 복구, Yjs 실시간 협업과 온라인 사용자 표시
- HASA 선택 텍스트 요약·다듬기·번역·할 일 추출
- 한국어 공공 업무 템플릿 카탈로그와 워크스페이스 내부 복제

## 배포

1. `npm ci`
2. `wrangler d1 migrations apply 00ai-notion --remote`
3. Brevo/HASA 키는 계정 Secrets Store에서 Worker 바인딩으로 연결합니다. 세션 서명 키는 첫 로그인 시 D1에 생성·보관합니다.
4. `npm run deploy`

`wrangler.jsonc`는 `notion.00ai.kr/*` Worker Route와 기존 계정 D1/Workers 리소스를 참조합니다. DNS에 해당 호스트가 없다면 `00ai.kr` zone의 기존 wildcard DNS/서브도메인 라우터 규칙을 확인한 뒤 `notion` 호스트를 Cloudflare proxied DNS에 연결해야 합니다. `MAIL_FROM` 도메인은 Brevo에서 발신 인증되어야 합니다.

GitHub Actions 배포에는 저장소 Actions secret `CLOUDFLARE_API_TOKEN`이 필요합니다. 배포 토큰 권한에는 Workers Scripts 편집, D1 편집, DNS/Workers Route 편집, Account Secrets Store 편집이 포함되어야 합니다. Brevo/HASA 키는 GitHub로 복사하지 않습니다.

## 운영 설정

- 공개 회원 가입은 기본 활성화입니다. 초대제 운영은 Worker var `SIGNUP_ENABLED=false`로 전환합니다.
- Brevo/HASA 키는 Worker secret에 저장합니다. 코드·브라우저 번들·일반 vars에는 키를 저장하지 않습니다.
- 이메일 코드와 AI API는 서버에서만 호출합니다. 문서 저장은 DB에 기록 후 ACK하며, 로컬 임시 복사본은 로그인 사용자와 페이지 ID로 분리합니다.
- 초기 템플릿은 `migrations/0001_workspace.sql`에 포함됩니다.

## 오픈소스 선택 메모 (2026-10-30)

이 저장소는 오픈소스 제품 전체를 포크하지 않고, React/Tiptap/Yjs를 조합해 00AI의 인증·권한·공공 템플릿 정책을 자체 구현합니다. 기존 00AI DOCS 저장소의 Yjs 협업 실험과 Cloudflare 운영 구조를 이어받으면서, 에디터와 협업 프로토콜을 분리할 수 있기 때문입니다. AppFlowy·AFFiNE·Docmost는 기능/UX 및 데이터 모델 참고 대상으로만 취급하며, 코드나 템플릿은 라이선스와 출처를 확인하지 않고 복사하지 않습니다.

조사 기준일에 확인한 최신 릴리스 지점: AppFlowy 0.14.11 (2026-10-26), AFFiNE 2026.10.26 canary, BlockNote 0.55.0 (2026-09-22). 이 릴리스 값은 지속적으로 변하므로 공개 배포 전에 각 공식 릴리스와 패키지 라이선스를 다시 확인합니다. 오픈 템플릿은 저작자·출처·라이선스·개인정보 제거를 확인한 뒤 게시해야 합니다.
