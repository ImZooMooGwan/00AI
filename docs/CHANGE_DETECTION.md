# Change Detection

1. 원천 응답과 문서를 Bronze 스냅샷으로 보존한다.
2. ETag·Last-Modified를 우선 사용하고 없으면 정규화 원문의 해시를 계산한다.
3. 이전 Silver 레코드와 필드 단위로 비교한다.
4. 변경 후보에 `previousValue`, `currentValue`, `sourceId`를 연결한다.
5. 자격·지원금·기한·종료·지역·법적 근거 변화에 영향도 규칙을 적용한다.
6. 자동 감지와 사람 검토를 분리해 공개한다.

자동 감지 이벤트는 시민의 신청 가능 판단에 직접 반영하지 않는다.

