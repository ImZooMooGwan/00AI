# MCP 도구

공통 성공 응답은 `ok`, `data`, `meta.as_of`, `meta.retrieved_at`, `meta.sources`, `meta.warnings`, `meta.is_cached`를 사용합니다. 오류는 `ok=false`, 안정적인 오류 코드, 사용자용 메시지와 `retryable`을 반환합니다.

## `search_youth_policies`

입력: `query`, `region_codes`, `large_categories`, `medium_categories`, `age`, `employment_status`, `application_status`, `as_of`, `page`, `page_size`. `page_size` 최대 50. 지역명과 시·도 법정코드를 인식하며 잘못된 지역은 오류입니다.

## `get_youth_policy`

입력: `policy_id`, 선택적 `as_of`. 기준일이 있으면 그 날 유효한 저장 버전을 사용합니다. 상세 조건, 신청기간·방법, 기관, 법적 근거, 출처, 경고와 최신성을 반환합니다.

## `check_policy_eligibility`

입력: `policy_id`, 선택적 `as_of`, `profile`. 프로필은 연령, 지역, 소득/구간, 취업·재학, 학력, 전공, 혼인, 특화조건을 받을 수 있습니다.

출력 상태는 `eligible`, `ineligible`, `needs_more_info`, `manual_review`입니다. 조건별 결과는 `pass`, `fail`, `unknown`, `manual`입니다. 자유서술 조건을 임의로 계산하지 않습니다.

## `compare_youth_policies`

`policy_ids` 2~10개 또는 `regions`와 `category`를 입력합니다. 사실 비교와 `rule_based_signal` 해석을 별도 필드로 반환합니다.

## `get_policy_changes`

입력: `policy_id`, 선택적 `from`, `to`. 변경 필드, 전·후 값, 감지일, 출처, 영향 수준, 원문 URL을 반환합니다.

## `get_policy_evidence`

입력: `policy_id`, 선택적 `fields`. 원천 ID·URL·기준일·수집일·해시·인용문과 법령 연결, 충돌·불확실성을 반환합니다.

## 리소스와 프롬프트

리소스는 `youth-policy://taxonomy`, `code-reference`, `methodology`, `data-sources`, `eligibility-rules`, `citation-guide`입니다. `analyze_youth_policy_region` 프롬프트는 국가통계 MCP와 정책 MCP의 조합 절차를 제공합니다.
