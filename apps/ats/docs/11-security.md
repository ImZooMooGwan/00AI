# 보안 및 개인정보

- Cloudflare Access에서 사이트 정적 화면과 API 경로 모두 접근 제한
- Worker에서 Access JWT 서명/issuer/audience 검증
- D1 parameterized statements, optimistic concurrency, same-origin mutation check
- R2 private bucket; 인증 API 통과 후에만 다운로드
- 파일 최대 10MB 및 PDF signature 확인. 복잡한 파일 형식 검사/악성코드 스캔은 운영 확장 항목
- HASA 키는 Worker secret, 사용자 문서는 기본 외부 전송 금지 원칙
- 예상치 못한 이메일 provider 오류는 UNKNOWN으로 보류하고 자동 재발송하지 않음
- 운영자가 데이터 보유기간과 파기 절차를 조직 정책에 맞게 설정해야 함
- Worker error logs에 지원자 본문/이메일/문서 내용 기록 금지
