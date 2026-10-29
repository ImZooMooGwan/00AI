# 진행 현황

## 완료
- 초기 프로젝트 구조 및 ATS 화면 구현
- Cloudflare Worker, D1 migration, R2, Queue/Cron, Access JWT 경계
- 지원자 등록 및 이메일 중복 후보자 재사용
- 단계 이동과 D1 상태 이벤트/동시성 버전 확인
- 불합격 이메일 600초 지연 예약, 복원 취소, 재불합격 별 예약
- 파일 업로드 API 및 파일 형식/크기 검사
- HASA 서버 프록시, Cloudflare Email Service binding
- 설계·운영·검증 문서 및 배포 설정
- typecheck, unit/schema test, production build, Wrangler dry-run 통과

## 운영 연결 대기
- Cloudflare 계정 리소스/인증, D1 database ID
- Access team domain/audience 및 조직 사용자/역할 설정
- 발신 도메인 등록 및 Email binding 실발송 검증
- HASA 실제 API 계약/개인정보 전송 정책
- 미구현: 평가/면접 관리, XLSX/CSV 대량등록, 파일 미리보기/텍스트 추출, 이메일 템플릿 관리 화면, 활동/사용자 관리, 파기 작업
