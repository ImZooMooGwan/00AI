# 00AI DOCS 실시간 공동편집 고도화 — 구현 및 검수보고 (2026-10-29)

## 배포 결과
- 기존 운영 주소: https://docs.00ai.kr/
- 신규 별도 rich text UI: https://docs.00ai.kr/realtime-app/?doc=<문서 UUID>
- 기존 UI 좌측 베타테스트 메뉴: **리치텍스트 공동편집 (베타)** 선택 가능
- 기존 운영 문서 HTML 본문과 **Yjs 공동편집 내용은 별도 저장**. 기존 내용을 자동 마이그레이션하지 않았음.
- 기존 Worker: 00ai-gov-docs / 새 DO Worker: 00ai-docs-collab-canary.

## 이번에 구현·배포한 기술
1. 브라우저 편집기
   - React 19 / Tiptap 3 / ProseMirror / Yjs
   - 굵게, 기울임, 제목, 목록, 표 추가, 표 행·열 추가·삭제, 셀 병합·분할
   - 편집 권한에 따라 읽기 전용, 접속 상태 표시, 미확인 전송 수 표시
2. 실시간 전송
   - 문서별 Cloudflare Durable Object WebSocket
   - D1 사용자 세션 및 문서별 owner/editor/viewer ACL 확인 후 업그레이드
   - JSON 프레임으로 Yjs 바이너리 업데이트 base64url 전달
   - 서버에서 쓰기 권한 재검증, 문서 잠김 상태 확인, 권한 회수 시 연결 종료
   - 확인(ACK)을 받지 못한 업데이트는 메모리에서 유지, 재연결 시 재전송
3. CRDT 영속화
   - Durable Object SQLite 업데이트 저널
   - 서버 Y.Doc 상태 합성 후 200건 주기로 스냅샷 저장, 저널 구간 압축
   - 재접속 시 서버 측 Y.Doc 전체 상태 전송, 큰 스냅샷 조각 단위 전송
   - Yjs 업데이트 유효성 확인 후 영속 기록, 서버 ACK와 fan-out 순서 보장
4. 빌드 및 배포
   - GitHub Actions TypeScript 타입 검사, Yjs convergence 테스트, Vite 빌드
   - 실제 빌드된 프런트 정적 에셋을 운영 Worker의 /realtime-app/ 경로로 제공
   - 별도 DO Worker에는 esbuild로 Yjs를 포함해 Cloudflare Worker 모듈로 배포
   - 기존 Brevo/HASA/SESSION_SECRET/D1 바인딩 보존

## 검수 증거
- GitHub Actions run 40801273457: 타입 검사·Yjs merge/replay/XML fragment 테스트·Vite 빌드 통과
- 최신 GitHub Actions CI: snapshot-capable client/server 타입 검사, 테스트 및 빌드 성공
- Cloudflare 00ai-gov-docs PUT: HTTP 200
- Cloudflare 00ai-docs-collab-canary PUT: HTTP 200
- main Worker의 DOC_ROOM 바인딩이 DO Worker를 참조하는지 확인
- GitHub Actions run 40801662743: 기존 웹·health·리치텍스트 HTML·JS·CSS 외부 HTTP 200 검증
- 최신 smoke run 40802178298: 리치텍스트 리소스 제공·비인증 WebSocket 접속 거부 통과
- DO 전송의 로컬 mock 단위시험: 저널 persist-then-fanout, viewer 쓰기 차단, replay 등 통과

## 정식 베타 완료를 위해 여전히 필요한 사항
- **실제 사용자 2~3명 계정으로 실브라우저 동시수정 E2E**: 문단·동일 표 셀·동시 삭제·10회 재접속·권한 회수/문서 확정 테스트
- **기존 docs_v2.body -> Yjs ProseMirror 원본 이관**: HWPX 표/머리말/이미지 충실도와 라운드트립 검증
- **Y.Doc 상태를 정식 문서의 버전·승인·내보내기 흐름과 연결**: 현재 별도 공동편집 상태
- **장애복구 리허설**: DO 교체/재시작, 200회 이상 수정 후 스냅샷 로딩, 2명 동시 저장에 대한 누락 검사
- 문서별 보안정책/외부 AI 데이터 전송/자료 보존·삭제와 사용자 계정 운영 정책
- 브라우저 접근성, 성능, 장시간 세션 부하, CDN 차단 환경 검수

## 판정
**실시간 리치텍스트 공동편집 엔진의 코드 구현과 운영 URL·DO 서버 배포는 완료**하였으나, 기존 행정문서를 대체하는 **정식 베타 완성·승인은 아님**. 실사용 자료 업로드 금지, 공개·합성 데이터로 실증. 
