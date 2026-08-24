# 아키텍처

## 경계

`src/ingestion`은 공식 외부 원천을 읽고 검증·정규화합니다. `src/db`는 현재 정책, 조건, 버전, 근거와 동기화 기록을 보존합니다. `src/domain`은 검색·상세·자격·비교·변경·출처 규칙의 단일 구현입니다. `src/mcp`는 입력/출력 스키마와 MCP 등록만 담당합니다.

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

Worker는 요청마다 새 MCP 서버 팩토리를 구성하는 stateless Streamable HTTP 방식입니다. 사용자 세션이나 프로필을 전역 상태에 저장하지 않습니다. 운영 KV와 Rate Limiting API는 네트워크 REST 대신 Worker binding으로 호출합니다. KV 쓰기는 세대별 불변 청크를 먼저 저장하고 작은 루트 포인터를 마지막에 교체하며, 읽기는 전파 지연 시 직전 세대 descriptor로 폴백합니다. D1 구현은 로컬·회귀 테스트에 유지됩니다.

## 통계 분리

인구·고용·지역 시계열과 같은 통계는 `KOSIS_MCP_URL`의 국가통계 MCP가 담당합니다. Y-HUB MCP는 그 도구를 복제하지 않습니다. `analyze_youth_policy_region` 프롬프트는 AI 호스트가 두 서버를 조합하는 순서만 안내합니다.

## 신뢰 경계

- 외부 URL은 코드의 공식 호스트 허용목록에 있어야 합니다.
- API 응답은 2 MiB로 제한하고 구조가 다르면 저장하지 않습니다.
- MCP 요청은 1 MiB로 제한합니다.
- 공개 MCP는 읽기 전용이며 `/admin/sync`는 별도 Bearer Secret을 사용합니다.
- 사용자 자격 프로필은 요청 수명 동안만 함수 인자로 존재합니다.
