# 00AI COUNCIL

대전광역시의회 공식 생방송을 보면서 00AI 계정으로 로그인한 공무원이 실시간 한국어 자막, 회의록, 내부 채팅과 AI 보고서 초안을 사용하는 웹 앱입니다.

- 서비스: https://council.00ai.kr/
- 방송 출처: https://council.daejeon.go.kr/svc/air/AirMain.do
- 00AI 통합 이메일 코드 인증을 사용합니다. 인증 코드는 기존 00AI NOTE 서비스가 발송하며, Council에서 별도 이메일 설정을 복제하지 않습니다.
- 현재 방송의 탭 오디오를 받아오기 위해 브라우저가 화면 공유 권한을 요청합니다. 탭 오디오 허용은 브라우저 보안상 사용자가 직접 승인해야 합니다.
- 실시간 음성 인식은 Cloudflare Workers AI Whisper Large V3 Turbo로 수행하고, 회의 데이터·전사문·댓글·보고서 초안은 별도 Council D1에 저장합니다.
- 배포·검수 세부사항: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 파일 구성

- `src/index.js`: Cloudflare Worker UI/API
- `schema.sql`: Council D1 스키마
- `wrangler.jsonc`: Cloudflare 바인딩 및 배포 설정
