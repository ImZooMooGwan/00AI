# 데이터 모델

- `candidates` 1:N `applications`
- `positions` 1:N `applications`
- `applications` 1:N `stage_events`, `email_schedules`, `evaluations`, `interviews`
- `email_templates`는 예약 시점의 template_version으로 스냅샷 식별
- `applications.version`은 동시 업데이트 감지에 사용
- R2 object key는 `applications.resume_key`에 기록. R2는 공개 버킷이 아니며 API 인증을 거쳐 내려받는다.
- `audit_logs`에는 사용자, 작업, 리소스 식별자와 최소한의 변경 정보를 기록

전체 DDL은 `migrations/0001_init.sql` 참조.
