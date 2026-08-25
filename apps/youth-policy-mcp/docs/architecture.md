# 아키텍처

## 경계

`src/ingestion`은 공식 외부 원천과 공개 Y-HUB 검증 스냅샷을 읽고 검증·정규화합니다. `src/db`는 현재 정책, 조건, 버전, 근거와 동기화 기록을 보존합니다. `src/domain`은 검색·상세·자격·비교·변경·출처 규칙의 단일 구현입니다. `src/mcp`는 입력/출력 스키마와 MCP 등록만 담당합니다. `src/ai`는 검색된 근거만 HASA에 전달하는 선택형 분석 경계입니다.

```text
official sources
  └─ bounded fetch + allowlist + retry
       └─ versioned payload parser
            └─ normalization + hash + evidence
                 └─ PolicyRepository
                      └─ YouthPolicyService
                           └─ MCP / future public API / Y-HUB UI
```

웹 또는 공개 API를 추가할 때 `YouthPolicyService`를 재사용해야 하며 MCP 핸들러에 정책 규칙을 추가하지 않습니다.

## 런타임

Worker는 요청마다 새 MCP 서버 팩토리를 구성하는 stateless Streamable HTTP 방식입니다. 사용자 세션이나 프로필을 전역 상태에 저장하지 않습니다. 운영 저장소는 `POLICY_STORE_DO` RPC binding으로 원천 단위 SQLite Durable Object를 호출하며, 별도 저장소 REST API나 계정 토큰을 사용하지 않습니다. Durable Object는 생성자에서 schema만 초기화하고 요청별 읽기·쓰기는 강한 일관성의 SQL storage에서 처리합니다. D1 구현은 로컬·회귀 테스트에 유지됩니다.

## 통계 분리

인구·고용·지역 시계열과 같은 통계는 `KOSIS_MCP_URL`의 국가통계 MCP가 담당합니다. Y-HUB MCP는 그 도구를 복제하지 않습니다. `analyze_youth_policy_region` 프롬프트는 AI 호스트가 두 서버를 조합하는 순서만 안내합니다.

## HASA 분리

결정론적 6개 정책 도구는 HASA 장애나 키 유무와 무관하게 동작합니다. `analyze_youth_policy_question`만 `open.hasa.re.kr/v1`을 호출하며, 호출 전에 Durable Object 검색 결과를 최대 10건으로 제한합니다. HASA에는 비밀키·사용자 프로필·원천 원문 전체를 전달하지 않고 정책 ID·요약·지역·상태·공식 URL만 전달합니다.

## 신뢰 경계

- 외부 URL은 코드의 공식 호스트 허용목록에 있어야 합니다.
- API 응답은 2 MiB로 제한하고 구조가 다르면 저장하지 않습니다.
- MCP 요청은 1 MiB로 제한합니다.
- 공개 MCP는 읽기 전용이며 `/admin/sync`는 별도 Bearer Secret을 사용합니다.
- 사용자 자격 프로필은 요청 수명 동안만 함수 인자로 존재합니다.
- HASA 키는 Worker Secret으로만 읽으며 헬스·MCP 응답·로그에 노출하지 않습니다.
