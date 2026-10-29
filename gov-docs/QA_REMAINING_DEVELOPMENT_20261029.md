# 00AI DOCS — 잔여 개발사항 진행 및 QA (2026-10-29)

## 1. 이번 운영 반영 (실제 배포)
- 네트워크 오프라인 상태에서는 저장 시도를 중단하고 미저장 안내 표시
- 인터넷 연결 복귀 시 미저장 변경에 대해 자동저장 재시도
- 기존 rev 충돌 감지, 충돌 백업 HTML 다운로드, 병합 표 위험 편집 차단 유지
- Cloudflare Worker PUT HTTP 200 확인
- GitHub Worker와 UI 원본 동기화
- 브라우저 JS 정적 문법과 DOM id 참조 검사 통과

## 2. 구조화 편집기 개발 (staging 전용)
- `staging/StructuredDocumentEditor.tsx` 작성: Tiptap 기반 React 편집 컴포넌트, 표 삽입/행/열/병합/분할 명령
- `staging/package.json` 작성: 의존성/빌드 명령
- 아직 npm 빌드 및 브라우저 통합 검수 전
- **운영 서비스에 연결되지 않음**

## 3. 공동 편집 전송 계층 프로토타입 (staging 전용)
- `staging/DocumentCollaborationRoom.js` 작성: Durable Object WebSocket 릴레이 실험 코드
- Yjs 업데이트 프레임을 릴레이하는 수준으로 Y.Doc 상태 복원, 영속 스냅샷, state vector sync, 서명된 권한 확인 없음
- 절대로 이 상태로 공개 배포하거나 실시간 공동 편집 완료로 광고하지 않음
- 개발 차단 요건은 `staging/COLLAB_PROTOCOL.md` 참고

## 4. 미완료 요구사항
- Tiptap 구조화 편집기의 실제 기존 HTML 마이그레이션/빌드 검증
- Yjs 인식·상태 유지·재접속·동시 커서가 가능한 협업 엔진 완성 및 DO 운영 배포
- 바이너리 HWP 변환, 병합셀/이미지/스타일/페이지 복원, R2 저장, DOCX/HWPX round-trip
- 권한/보안/다중 사용자 E2E, 자동 백업·복원 시나리오, 성능 테스트

## 5. 출시 판정
운영 반영은 자동저장 복구 안정성 개선에 한정.
Tiptap/Yjs/Durable Objects는 격리된 개발 소스만 작성된 상태.
정식 업무자료 처리 베타 승인은 미충족.
