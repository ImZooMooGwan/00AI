# 외부 연동 대기사항

코드/템플릿/Mock 설계는 준비됨. 다음은 계정 고유 설정 및 운영 승인 없이는 완료 표시할 수 없음.
- Cloudflare D1 ID, R2, Queue 리소스 생성 및 배포 인증
- Cloudflare Access team domain 및 app AUD
- 기관 소유 발신 이메일 도메인의 Email Sending 등록
- HASA의 실제 API base URL, 인증 방식, 모델 및 데이터 전송 정책 결정
- 운영 데이터 보유기간 및 파기 정책 확정

비밀값을 소스코드나 채팅에 적지 말고 Cloudflare secrets에 등록한다.
