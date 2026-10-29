# 운영 전 남은 확인사항

- Brevo 키는 ATS Worker secret `BREVO_API_KEY`에 등록됨. 키 자체의 `/v3/account` 인증과 발신 주소 `no-reply@00ai.kr`의 검증 상태는 아직 확인되지 않음. 실지원자에게 보내지 않고 계정 확인 및 통제된 시험 주소로 검증할 것.
- HASA Worker secret은 등록되어 있으나 실제 API 계약(인증·모델·입력 규격·오류 형식)과 개인정보 처리 범위 검증이 남아 있음.
- 현재 Cloudflare 계정에서 R2를 사용할 수 없어 이력서 파일은 KV에 저장됨. 운영 규모가 커지기 전에 R2 전환과 보유기간·파기 절차를 결정할 것.
- 평가/면접 관리, 이메일 템플릿 편집·수동 재시도, 사용자 역할 관리, 감사 기록 화면, 개인정보 파기 자동화는 추가 개발 대상.
- `00ai.kr` 서비스 목록 변경은 GitHub의 portal 소스 반영 이후 해당 Worker 배포 상태까지 확인해야 함.

비밀값은 소스코드나 Git에 저장하지 않고 Cloudflare Worker secrets에만 둔다.
