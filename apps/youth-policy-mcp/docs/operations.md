# 운영

## 일일 확인

1. `/youth/health`의 `database.connected`, `storage_backend`, `last_sync_at`, `last_sync_status`를 봅니다.
2. Workers Logs에서 `youth_policy_sync` 구조화 이벤트를 확인합니다.
3. `failed` 또는 `partial`이면 `sync_runs.error_summary`의 안정적인 오류 코드를 확인합니다.

## 장애별 대응

- `YOUTH_POLICY_API_KEY` 미설정: 동기화가 `skipped`입니다. Secret을 설정하고 수동 동기화를 실행합니다.
- `UPSTREAM_SCHEMA_MISMATCH`: 원문을 정책으로 저장하지 않습니다. 공식 응답 변경을 확인하고 버전별 파서를 추가합니다.
- `UPSTREAM_TEMPORARY_ERROR`: 자동 재시도 후 실패합니다. 원천 상태를 확인하고 수동 재실행합니다.
- 저장소 연결 실패: 운영 환경은 KV binding `POLICY_STORE`와 namespace ID, 로컬·테스트 환경은 D1 binding `DB`와 마이그레이션 적용 여부를 확인합니다.
- MCP 403: `MCP_ALLOWED_HOSTS`, `MCP_ALLOWED_ORIGINS`와 Custom Domain을 확인합니다.
- MCP 429: 요청 주체별 60초 제한을 확인하고 필요할 때 binding 한도를 조정합니다.

## 데이터 품질

- 3회 연속 전체 동기화에서 사라진 정책만 `source_missing`으로 바뀝니다.
- `manual_review` 법령·조건을 정기적으로 검토합니다.
- 출처 충돌은 `conflict_note`에 남기며 하나를 조용히 삭제하지 않습니다.
- 테스트/Mock 데이터는 공개 검색 쿼리에서 제외됩니다.

## 개인정보와 로그

자격 프로필은 저장하거나 구조화 로그에 기록하지 않습니다. 인증키, Authorization 헤더, 원시 외부 오류, 요청 본문과 내부 스택도 로그에 기록하지 않습니다.

## 실데이터 스모크 테스트

CI는 키 없이 통과해야 합니다. 라이브 검증은 승인된 운영 환경에서만 실행하고 최소 1페이지를 수집한 뒤 정책 수, 출처 URL, 중복 버전 방지와 `/health`를 확인합니다.
