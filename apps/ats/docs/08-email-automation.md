# 불합격 이메일 자동화

1. `/api/applications/:id/move`가 기존 stage와 version을 읽는다.
2. `UPDATE ... WHERE version=?`를 이용해 경쟁 업데이트를 방지한다.
3. 단계 이벤트와 application 상태를 저장한다.
4. REJECTED면 같은 지원건의 기존 PENDING 예약을 취소하고, 현재 이메일/템플릿 버전의 새 예약을 `now + 600000ms`로 생성한다.
5. Cloudflare Queue 메시지는 `delaySeconds: 600`으로 지연 전달한다. Cron은 Queue 지연이나 consumer 장애에도 대비한 due 작업 복구 장치다. consumer는 예약 검증으로 `scheduled_at <= now`인지 확인하고 조기 발송하지 않는다.
6. Cron은 매 분 due 예약을 조회하고 원자적 claim을 얻은 작업만 전송한다.
7. 발송 전 application이 여전히 REJECTED이고 예약 상태가 PENDING인지 SQL 조회로 검증한다.
8. Cloudflare Email binding 또는 Brevo `POST /v3/smtp/email` 응답 성공 시 SENT, 제공자 미설정은 FAILED, 결과가 불명확한 오류나 처리 시간 초과는 UNKNOWN으로 보류한다. 중복 발송 위험이 있어 UNKNOWN 작업은 자동 재시도하지 않는다.

## 상태
PENDING, CANCELLED, PROCESSING, SENT, FAILED, DELIVERED, BOUNCED, UNKNOWN. 전달 상태는 Provider webhook 연동 시 갱신한다. 전송 결과가 불명확한 오류는 UNKNOWN으로 두고 자동 재전송하지 않아 중복 발송 위험을 줄인다. SENT는 수신자 전달·열람 확인이 아니다.

## 운영 설정
Brevo를 사용하는 경우 `BREVO_API_KEY`를 Worker secret으로 등록하고 발신 도메인과 `no-reply@00ai.kr` 발신자를 인증한다. 실제 발송 시험은 mock 또는 기관이 통제하는 주소로만 한다. 실제 지원자에게 임의 테스트 메일을 전송하지 않는다.
