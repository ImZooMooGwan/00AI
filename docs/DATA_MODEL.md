# Data Model

## 정책 계층

1. `Policy Family`: 장기간 유지되는 정책 정체성
2. `Program`: 특정 기관·지역의 집행사업
3. `Application Round`: 연도·회차별 모집
4. `Policy Version`: 특정 시점의 필드 상태
5. `Source Document`: 상태를 증명하는 공식 원천

## 핵심 엔터티

`PolicyRecord`, `ChangeEvent`, `IndicatorRecord`, `SourceRecord`를 현재 MVP 계약으로 사용한다. 모든 공개 정책은 `id`, `slug`, `programId`, `roundId`, `sourceId`, `verificationStatus`, `lastObservedAt`을 가진다.

자격조건은 연령, 지역, 소득, 고용, 학력, 창업, 혼인, 중복수혜 제한 등 필드로 확장할 수 있게 배열로 분리한다. 자연어 설명만으로 신청 가능 여부를 확정하지 않는다.

