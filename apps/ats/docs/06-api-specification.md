# API 요약

모든 `/api/*` 요청은 Cloudflare Access JWT를 검증한다. 모든 변경 API는 same-origin 요청을 요구한다. JSON 오류는 `{error:string}` 형식.

| Method | Path | 용도 |
|---|---|---|
| GET | `/api/health` | 연결 상태 |
| GET | `/api/applications` | 칸반 지원건 조회 |
| POST | `/api/candidates` | 후보자/지원건 생성 |
| POST | `/api/applications/:id/move` | 단계 변경, 감사기록, 이메일 예약·취소 |
| POST | `/api/email-schedules/:id/cancel` | 대기 이메일 취소 |
| GET | `/api/email-schedules` | 이메일 예약 목록 |
| GET | `/api/email-templates` | 활성 템플릿 조회 |
| POST | `/api/resumes/upload` | 최대 10MB 파일 업로드 |
| GET | `/api/resumes/:applicationId` | 인증된 파일 다운로드 |
| GET | `/api/integrations/status` | 외부 연결 상태 |
| POST | `/api/ai/resume-summary` | HASA 서버 프록시 |
| GET | `/api/dashboard/stats` | 집계 통계 |

평가·면접·템플릿 수정/재시도 API는 아직 미구현이다.
