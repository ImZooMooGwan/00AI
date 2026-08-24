# Data Sources

## 현재 연결 구조

- 온통청년 `https://www.youthcenter.go.kr/opi/youthPlcyList.do`: 정책 목록, 최대 100건 단위 페이지 수집
- KOSIS `https://kosis.kr/openapi/statisticsSearch.do`: 청년인구·고용·이동·주거·창업 통계표 메타데이터 수집
- 국가법령정보 `https://www.law.go.kr/DRF/lawSearch.do`: 청년기본법 등 관련 현행법령 메타데이터 수집
- 대전청년포털과 개별 공식 사업 안내

## 우선순위

1. 현행 법령·자치법규·공식 고시
2. 최신 공식 모집공고·사업지침
3. 소관기관 공식 API·정책 페이지
4. 정부·지자체 공식 보도자료
5. 공식 통계·재정자료

출처가 충돌하면 최신 공식 모집공고와 법적 근거를 함께 검토하고 `conflict` 이슈로 공개한다. 온통청년·KOSIS·법령 API는 별도 인증키 신청이 필요하며, 키가 없으면 수집기는 `key_required` 상태로 안전하게 중단한다.
