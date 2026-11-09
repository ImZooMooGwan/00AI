# 00AI COUNCIL

00AI COUNCIL은 대전광역시의회 공식 생방송을 재생하면서 한국어 음성 인식을 회의 기록으로 저장하고, 공무원 간 내부 채팅과 AI 회의 보고서 초안을 제공하는 웹 서비스입니다.

- 서비스: https://council.00ai.kr/
- 00AI 통합 로그인: 기존 00AI NOTE 이메일 코드 인증 API 재사용
- 접근 계정: `@korea.kr`만 허용
- 방송 입력: 사용자가 Edge 탭 오디오 공유를 승인해야 함
- 전사: Cloudflare Workers AI Whisper, 6초 단위 WAV 구간
- 저장: Cloudflare D1에 회의, 전사, 채팅, 보고서, 해시된 세션 토큰
- 보고서: Cloudflare Workers AI Llama 초안; 공식 기록·사실 검증을 대체하지 않음

## 구조

`src/index.js`는 Cloudflare Worker와 인라인 로그인/앱 UI를 포함합니다. Council 이메일 인증 코드는 서버 간 요청으로 기존 00AI NOTE의 `/api/auth/request-code`, `/api/auth/verify-code` 엔드포인트에 전달합니다. 원시 메일 API 키는 이 프로젝트에 저장하지 않습니다. 인증 코드가 확인되면 Council 전용 HttpOnly 세션 쿠키를 발급합니다.

## 저장소 파일

- `src/index.js`: Worker, OTP 로그인, 회의 API와 화면
- `schema.sql`: 회의·자막·채팅·보고서·로그인 세션 스키마
- `wrangler.jsonc`: Cloudflare Worker 및 D1/Workers AI 바인딩
- `DEPLOYMENT.md`: 현재 배포·사용 흐름·제한사항

## 보안·운영 주의

- 설치된 Cloudflare Access 로그인 페이지는 이 호스트에서 제거했습니다. Worker가 00AI 인증 결과와 Council 세션을 확인합니다.
- 서비스는 대전광역시의회가 공식 운영하는 서비스가 아닙니다.
- Edge의 오디오 공유는 사용자의 명시적 허가가 필요합니다. 자동 캡처는 시도하지 않습니다.
- 음성 인식은 자동 받아쓰기 초안이며 정확성 보장을 하지 않습니다.
- 채팅·기록은 로그인한 이용자에게 공유됩니다. 민감하거나 비공개인 발언을 입력하지 마세요.
- 환경변수·메일 자격증명·세션 토큰은 저장소에 올리지 않습니다.

배포 및 전체 기능 안내는 [DEPLOYMENT.md](DEPLOYMENT.md)를 참조하세요.
