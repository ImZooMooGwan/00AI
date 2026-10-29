# 00AI DOCS 정식 베타 준비 개발·검수 보고
기준일: 2026-10-29
서비스: https://docs.00ai.kr/
GitHub: ImZooMooGwan/00AI/gov-docs

## 요구사항별 구현
1. 한글 기능: HWPX XML 문단 텍스트 추출에 기초 표 행/셀 재구성 추가; 표 내부 문단 중복 제거. 바이너리 HWP, 복잡한 셀 병합/그림·각주/정밀 레이아웃/재내보내기는 미구현.
2. 제품명: 웹 페이지와 제목을 **00AI DOCS**로 변경. Worker 이름/도메인/DB명은 기존 유지.
3. 보안 및 베타 참여자: POST save 요청의 위험 HTML 패턴 거부, 문서별 기존 ACL 유지, 베타 승인 명단 조회·추가/제외 및 서버 접근 차단 모드, 관리자 권한 검증. 접근 제한은 기존 사용자 보호를 위해 기본 OFF(value=0). 초기 베타 운영자 지정 미완료.
4. 문서 동시편집·자동저장·복원: 기존 약 3.5초 동기화, 리비전 충돌 확인, 자동저장, D1 버전 스냅샷/복원 유지. **Yjs/CRDT 실시간 공동편집 및 동시 커서는 미구현**. 저장 SQL의 잘못된 `SET body?`를 `SET body=?`로 교정.
5. 운영자 대시보드·장애·접속기록: 운영 지표(사용자 수·문서 수·베타 제보 수·24시간 활동), 문서 읽기/저장 시 접속 감사 로그, 서버 예외 종류/경로 기록 및 관리자 전용 조회 화면. 장애 알림 발송·외부 가용성 모니터링·로그 보존 자동화는 미구현.

## 데이터베이스
- beta_access_log: 최근 문서 읽기 및 저장
- beta_errors: 서버 예외 유형 및 경로 (민감 본문 비기록)
- beta_settings: enforce_allowlist=0 기본
- beta_allowlist: 승인 참여자 목록
- 기존 users, docs_v2, docs_v2_versions, beta_feedback 등 유지

## 정적/구성 검수
- Cloudflare Worker PUT: HTTP 200
- Worker HTML / UI 파일 일치 확인
- JS 문법 및 필요한 DOM id 검사 통과
- 저장 SQL 오류 수정 확인
- 보안 차단 정규식에 대한 script/onerror/안전 HTML 샘플 시험
- 기존 BREVO_API_KEY / HASA_API_KEY / SESSION_SECRET 및 DB 바인딩 유지 확인
- D1 신규 테이블 및 베타 정책 기본 OFF 확인

## 미검증 / 정식 베타 출시 차단사항
- 관리자 계정의 최초 안전한 부트스트랩 및 승인 대상 명단 확인
- HWPX 대표 샘플 문단/셀/병합 표 검수 및 HWP 바이너리 변환
- 독립 계정 2~3개로 ACL·읽기전용·편집 충돌/자동저장/복원 E2E
- 악성 HTML 우회/파일 삽입/XSS·CSRF·세션·Rate-limit 보안시험
- 클라우드 저장 및 외부 HASA AI 전송에 대한 기관 정책 적합성 검토
- 자동 백업/재해복구 리허설, 보존기간·삭제 정책
- R2 원본 파일 보존(Cloudflare R2 계정 미활성)
- 서버측 완전한 HTML sanitizer/CSP, Tiptap+Yjs, 실시간 공동커서
- 외부 접근성 시험, 성능시험, 장애 알림 및 운영 SLA

## 판정
기능을 추가해 Cloudflare에 배포했지만 **정식 업무자료 베타 승인 상태는 아님**. 공개·합성 문서로 제한적 사용성 테스트를 수행하고, 상기 보안/문서 무결성 시험 후 확대 권장.
