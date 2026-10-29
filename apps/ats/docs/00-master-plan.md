# 00AI ATS — 개발 설계 및 진행계획

## 제품 목적
사내 채용팀이 지원자와 지원 건을 분리해 관리하고, 칸반 파이프라인과 10분 지연 불합격 안내를 안전하게 운영하는 채용 관리 웹앱.

## 기술 구성
- React + TypeScript + Vite: 반응형 ATS 사용자 화면, dnd-kit 접근성 키보드 지원
- Cloudflare Worker: 인증 경계 및 REST API
- Cloudflare Access: 사내 사용자 인증. Worker가 Access JWT의 서명·issuer·audience를 검증
- D1: 후보자, 지원건, 평가, 면접, 단계 이벤트, 예약 이메일 및 감사 기록
- R2: 비공개 이력서 객체
- Queues + Cron: 예약 이벤트 전달 및 D1의 due-time 조회/발송. 예약 시각보다 이른 전송 방지를 DB의 scheduled_at로 재확인
- Cloudflare Email Service binding: 거래성 이메일 발송
- HASA: 서버 측 프록시만 제공. 브라우저에 API 키 노출 금지

## 핵심 업무 규칙
- 지원자(Candidate)와 지원건(Application)은 별도 엔티티
- 상태는 DOCUMENT, FIRST_INTERVIEW, FINAL_INTERVIEW, HIRED, REJECTED
- 각 단계 이동은 D1 버전 기반 낙관적 동시성 제어 및 stage_events 감사 기록
- REJECTED 전환 성공 후 600초가 지난 시점에만 발송 처리
- 재단계 이동은 PENDING 예약을 취소. 재불합격은 새 이벤트 ID와 새 예약 ID 사용
- 큐 메시지는 조기 도착 가능성을 고려하고, Cron이 due 작업을 보장. 수신 워커도 DB 상태를 재검증
- 이메일 전송 binding이 없으면 실패로 기록하고 자동발송 성공으로 표시하지 않음

## 화면
1. 대시보드/파이프라인: 포지션 필터, 검색, 단계별 수, 드래그 이동, Undo 안내
2. 지원자 추가: 이름·이메일·직무 입력, 이력서 업로드 영역
3. 지원자 Drawer: 기본정보, 이력서, 평가, 활동 이력, 단계 변경, 불합격 예약 취소
4. 이메일 자동화: 예약 상태, 템플릿 관리(추가 구현 대상)
5. 설정/통계/면접: 메뉴 진입점. 데이터 기능 확장 필요

## 보안 원칙
- API 전 구간 Access JWT 검증(개발 DEMO_MODE는 배포 전 반드시 false)
- D1 질의 파라미터화, 서버 검증, 파일 크기/MIME/PDF 시그니처 검사
- R2 버킷 공개 금지, API 인증 후 Worker를 통한 다운로드
- 이력서 내용은 기본적으로 HASA 전송 금지. 사용자가 명시적으로 분석을 실행하고 기관 정책 검토를 마친 뒤에만 허용
- 비밀키는 wrangler secret으로 등록하며 .env, 브라우저, git에 저장하지 않음
- 최소 보존기간과 파기 주기는 기관의 개인정보 처리방침과 채용절차 기준에 맞춰 운영자가 확정

## 구현 상태
`tasks/progress.md`와 `tasks/blockers.md` 참조. 본 코드베이스는 초기 배포 가능한 기반 구현이며, 실제 계정/도메인 인증과 이메일 도메인 등록, HASA 규격은 환경 정보가 없어 운영 연결 대기 상태.
