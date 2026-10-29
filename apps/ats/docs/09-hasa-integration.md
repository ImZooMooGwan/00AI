# HASA 연동
Worker 전용 프록시 `/api/ai/resume-summary`를 마련했다. 브라우저는 HASA에 직접 접근하지 않으며 API 키는 `HASA_API_KEY` secret에만 저장한다. 현재 연결 경로는 OpenAI 호환 `/v1/chat/completions` 형태를 가정한다. 실제 HASA API의 인증 방식, 모델 목록, 경로, 요청/응답 계약을 확인한 뒤 어댑터를 맞춰야 한다. 지원자 개인정보를 HASA에 전송하는 기능은 기본 비활성 상태다.
