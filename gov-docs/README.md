# 00AI Gov Docs

웹 기반 공무원 공동문서 취합 프로토타입입니다. Polaris Docs의 공개된 기능을 참고한 독립 구현입니다.

## 목표
- 쪽지/첨부파일로 분산된 자료 취합의 최종본 혼선 방지
- `@korea.kr` 이메일 인증번호 기반 로그인(공무원 재직 증명은 아님)
- 최초 접속 시 닉네임 설정: 예) 청년정책과 김댕댕 주무관
- 공동 문서 수정 이력, 숫자 변경 전후와 사유 기록
- 제출 확정 및 버전 관리의 후속 확장

## 기술구조
Cloudflare Workers + D1 데이터베이스. 초기 프로토타입은 3초 폴링 기반 문서 동기화이며 완전한 동시 편집용 CRDT는 아직 구현되지 않았습니다.

## 배포 및 인증 설정
Workers에 D1 바인딩 `DB`, secret `SESSION_SECRET`, `RESEND_API_KEY`, 환경값 `MAIL_FROM`을 설정하고 메일 발신 도메인을 검증해야 합니다. 발송 서비스가 구성되지 않으면 이메일 인증은 작동하지 않습니다.

## 주의
시범용 프로젝트로 실제 비공개 행정자료·개인정보를 입력하지 마세요. 인터넷망 접근 허용과 외부 데이터 저장 승인은 별도로 확인해야 합니다.

## 다음 단계
Tiptap/Yjs 동시 편집, 수치 검증, 최종본 확정·잠금, 보고서 출력, 사용자별 권한을 추가합니다.

## 기존 소스
현재 개발 산출물: `00AI_Gov_Docs_Web_Email_Verification_v0.3.zip` (대화 내 첨부). GitHub에 실행 소스 전체 반영 및 Cloudflare 실서비스 배포는 인증·발신 설정과 함께 검증 예정입니다.


## v0.4 HASA AI integration (2026-10-28)
- [소스 배포 패키지]는 대화에 첨부된 `00AI_Gov_Docs_HASA_v04.zip` 참조.
- 웹 UI에 AI 요약, 문장 교정, 수치 검증, 보고서 초안 생성 탭 추가.
- AI 요청은 Worker 서버측 `/api/ai`에서 HTTPS OpenAI-compatible API로 프록시하며, HASA 키는 브라우저에 노출되지 않음.
- 필요한 설정: `HASA_API_URL`, `HASA_MODEL`, secret `HASA_API_KEY`.
- 인증메일 필요 설정: `SESSION_SECRET`, `RESEND_API_KEY`, 인증된 `MAIL_FROM`.
- `docs.00ai.kr` Cloudflare Custom Domain 연결 API 성공. **기존 Worker에는 안내 페이지가 유지되어 전체 앱 배포는 미완료**.
- 개발용으로 가상자료만 사용. 이메일 발송 및 HASA 연결의 실제 성공 여부는 아직 검증되지 않음.


## 2026-10-28 online deployment update

- Main Worker source: [`worker.js`](./worker.js), newly committed and deployed to Cloudflare `00ai-gov-docs`.
- Domain `docs.00ai.kr` is connected to the Worker, and D1 `DB` binding is present.
- HASA API key is held only in Cloudflare Worker secret `HASA_API_KEY`; `SESSION_SECRET` is also provisioned.
- Email OTP flow is coded but **cannot be used until verified sender service credentials (`RESEND_API_KEY`) are configured**.
- HASA upstream URL is configured provisionally to `https://open.hasa.re.kr/v1/chat/completions`; **upstream API response/model compatibility is not yet proven**.
- Editor currently uses 3-second polling + revision conflict detection; it is not a Yjs/CRDT real-time coauthoring engine.
- Live browser response could not be independently confirmed from the inspection environment; Cloudflare API reports successful Worker upload and domain binding.
- Test with synthetic data only. Passwords/tokens/secrets must not be committed to GitHub.

## 무료 이메일 인증 연동 (2026-10-28)

**무료 권장: Brevo** — 무료 플랜은 하루 최대 300통의 트랜잭션 이메일을 제공합니다. Cloudflare Workers 유료 전환이 필요하지 않습니다.

1. https://www.brevo.com/ 에서 Free 계정을 만들고 발신 도메인 `00ai.kr` 또는 발신 주소를 인증합니다.
2. Brevo API Keys에서 발급받은 키를 Cloudflare Worker `00ai-gov-docs`의 Secret `BREVO_API_KEY`에 저장합니다. **절대 공개 GitHub에 키를 기록하지 않습니다.**
3. `MAIL_FROM`을 Brevo에서 승인한 발신 주소로 설정합니다 (예: `00AI Gov Docs <auth@00ai.kr>`).
4. https://docs.00ai.kr/api/health 에서 `mail: true`를 확인한 뒤, 실제 `@korea.kr` 주소로 6자리 OTP 발송을 테스트합니다.
5. 최초 로그인 후 닉네임을 설정합니다.

기존 Resend 발송도 선택적으로 지원하지만, `BREVO_API_KEY`가 존재하면 Brevo를 우선 사용합니다.

**현재 상태**: Brevo API 지원 코드는 GitHub와 Cloudflare Worker에 반영됨. Brevo 계정/키/발신주소 승인 정보가 연결되지 않아 이메일 실발송 및 사용자 로그인은 아직 검증하지 못했습니다. 이메일 도메인 소유 인증이 공무원 재직 여부를 확인하는 것은 아닙니다.


## 00AI Gov Docs 2.0 배포 (2026-10-28)
- [구현 및 상세 검수 보고서](./QA_REPORT_v2.md)
- [Polaris-style UI 코드](./v2-preview.html)
- [Cloudflare Worker 앱 전체 소스](./worker.js)
- 접속: https://docs.00ai.kr/
- 범용 문서 생성, 제목 변경, A4형 웹 편집기, 리본 서식, 파일 원문 추출(DOCX / 텍스트 PDF / HWPX), HASA 구조 재구성, 문서별 편집 이력 구현.
- **현 버전은 3.5초 polling / 버전 충돌 감지이며 Yjs 실시간 편집은 아님.**
- **바이너리 HWP 변환 / 원본 R2 저장 / 완전한 포맷 호환은 미구현.** R2 계정 활성화 실패(403).
- 실제 사용자 브라우저 통합 테스트와 파일별 정밀 품질 평가는 아직 미수행.


## UX/UI 3.0 개편 (2026-10-28)
- 서비스: https://docs.00ai.kr/
- 디자인 및 화면 원본: [v3-ui.html](./v3-ui.html)
- 실제 서버 실행코드: [worker.js](./worker.js)
- [UX/UI 3.0 배포 및 검수 보고](./QA_UX_V3.md)
- 변경사항: 오피스형 리본, 문서 검색, 3단 편집 화면, 자동저장·충돌상태, 파일/AI 비교, 키보드 단축키, 댓글·이력·검토 인터페이스.
- **보안/기능 유의**: 아직 Yjs/CRDT 실시간 공동 편집, R2 원본 보관, 문서별 ACL, HWP 바이너리 복원, 스캔 PDF OCR 미구현. 행정망 실사용 전에 검증 필요.
