# 00AI DOCS 구조화 편집기 및 실시간 협업 개발 브랜치 설계

## 상태
기존 운영 UI는 contenteditable + D1 revision optimistic locking이며 Yjs CRDT가 아니다.
이 문서는 운영 Worker에 아직 결합되지 않은 다음 단계 코드 구조다.

## 기술 선택
- React 19 + TypeScript
- @tiptap/react, @tiptap/starter-kit, @tiptap/extension-table, @tiptap/extension-table-row, @tiptap/extension-table-cell, @tiptap/extension-table-header
- @tiptap/extension-collaboration, @tiptap/extension-collaboration-caret
- yjs, y-protocols, awareness, Durable Objects WebSocket
- D1: 문서 권한, 메타데이터, 저장 이력
- DO: 문서별 공유 Y.Doc 업데이트와 awareness session
- R2: 활성화 후 원본 파일 저장

## 필수 마이그레이션
1. 현행 docs_v2.body HTML 원문 유지하고 export_snapshot 생성
2. ProseMirror JSON 변환 및 round-trip 비교
3. 표 행/열/병합, 문단 스타일, 텍스트, 기호, 줄바꿈이 동일한지 테스트
4. HWPX 업로드 문서 20건과 복잡한 표 10건 품질 비교
5. snapshot에 ProseMirror JSON, Y.Doc state를 별도 버전으로 저장
6. 2인 동시 편집 중 DB rev가 뒤쳐져도 Yjs updates가 유실되지 않도록 DO 단일 저장 경로 도입
7. 전환 이전 버전으로 롤백할 수 있어야 함

## 구조화 문서 스키마 필수
doc / paragraph / text / heading / table / tableRow / tableCell / tableHeader /
bulletList / orderedList / listItem / hardBreak / blockquote / horizontalRule /
image / link / textStyle / bold / italic / underline / strike
- 표와 그림은 원문 식별자/source map을 별도로 보관
- 임의 HTML 실행 금지, 허용 노드·속성 기반 직렬화
- 서버에서 문서별 ACL 확인 후 DO WebSocket upgrade 허용
- client supplied role/owner를 절대 신뢰하지 않음

## 운영 승인 테스트
- 독립 이용자 3명, 같은 셀 동시 편집, 다중 커서, 연결 단절/복구 10회
- 모든 저장에서 last_ack 및 editor_rev 추적, 변경 유실 0건
- 바이너리 HWP와 복합 표는 지원범위를 기능별로 명시
- HTML sanitizer 우회, 권한 없는 DO room 접속, 재접속 토큰 검증
- 문제 발생 시 새 편집기를 feature flag로 OFF, 기존 HTML 수정 화면 복구

## 편집기 API 인터페이스
```ts
type DocumentEnvelope = {
  documentId: string;
  ownerEmail: string;
  schemaVersion: number;
  revision: number;
  htmlBackup: string;
  editorJSON: Record<string, unknown> | null;
  updatedAt: string;
};
type CollaboratorRole = 'owner'|'editor'|'viewer';
interface DocumentEditor {
  setDocument(doc: DocumentEnvelope): Promise<void>;
  exportJSON(): object;
  exportHTML(): string;
  setReadOnly(readOnly: boolean): void;
  onChange(cb: (json: object) => void): void;
  destroy(): void;
}
```

## 개발 위험
- Tiptap 라이선스와 유료 Collaboration 서비스 의존성을 분리할 것
- Durable Objects binding/migration 배포는 기존 Worker의 secrets, domains, DB bindings을 반드시 보존
- 프로토타입에는 임시 공동 cursor simulation을 '실시간 공동 편집'으로 광고하지 말 것
