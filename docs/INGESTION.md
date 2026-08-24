# Official API Ingestion

## 수집 흐름

1. 서버가 원천별 운영 키 존재 여부를 확인한다.
2. 온통청년은 정책 목록을 페이지 단위로, KOSIS는 청년 관련 통계표 검색결과를, 국가법령정보는 관련 현행법령 목록을 요청한다.
3. JSON 또는 XML 응답을 공통 외부 레코드로 정규화한다.
4. 원문 JSON을 안정적으로 직렬화하고 SHA-256 해시를 계산한다.
5. 신규 레코드는 삽입하고, 기존 해시가 달라지면 `change_candidates`에 검토 후보를 만든다.
6. 실행 결과와 오류는 `collection_runs`, 원천 상태는 `source_connectors`에 기록한다.

## 운영 키

| 원천 | 서버 환경변수 |
|---|---|
| 온통청년 | `YOUTH_CENTER_API_KEY` |
| KOSIS | `KOSIS_API_KEY` |
| 국가법령정보 | `LAW_OPEN_API_KEY` 또는 `LAW_OC` |

키는 GitHub, 브라우저 번들, API 응답, 오류 메시지에 포함하지 않는다. `SYNC_SECRET`은 외부 예약 호출용이며, 로그인된 사이트 소유자는 `/admin`에서 직접 동기화할 수 있다.

## 공개 API

- `GET /api/v1/live-policies`: 청년정책 MCP 우선 검색, 장애 시 D1·검증 스냅샷 폴백
- `GET /api/v1/mcp/status`: GitHub 청년정책 MCP의 공개 연결·도구·DB 상태
- `GET /api/v1/collection-status`: 원천별 상태, 영속 데이터 건수, MCP 연결 상태
- `POST /api/system/sync?source=all`: 인증된 소유자 또는 Bearer 비밀값을 사용한 동기화

`/api/v1/live-policies`는 최근 성공 수집이 `COLLECTION_INTERVAL_MINUTES`보다 오래됐고 운영 키가 연결되어 있으면 요청 시 자동으로 원천을 갱신한다. 따라서 별도 예약 트리거가 없는 환경에서도 실제 조회를 기준으로 최신 상태를 유지한다.

## GitHub 청년정책 MCP

| 설정 | 용도 |
|---|---|
| `YOUTH_POLICY_MCP_URL` | `https://mcp.00ai.kr/youth` 형식의 공개 Streamable HTTP 주소 |
| `YOUTH_POLICY_MCP_TIMEOUT_MS` | 조회 시간제한, 기본 2,500ms·허용 500~10,000ms |

MCP 클라이언트는 `search_youth_policies`를 우선 호출한다. 성공 응답에는 `provider=youth-policy-mcp`, `fallbackUsed=false`를 넣는다. 네트워크·HTTP·JSON-RPC·도구 오류가 발생하면 MCP 오류코드만 남기고, D1 공식 수집 레코드와 검증 스냅샷 순서로 전환한다. 원격 오류 본문과 운영 키는 로그·브라우저·API 응답에 포함하지 않는다.

GitHub 소스가 공개한 나머지 읽기 전용 도구는 `get_youth_policy`, `check_policy_eligibility`, `compare_youth_policies`, `get_policy_changes`, `get_policy_evidence`이며 상태 API에서 실제 도구 목록 일치 여부를 확인한다.
