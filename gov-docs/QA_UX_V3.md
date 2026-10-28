# 00AI Gov Docs 3.0 — UX/UI 개편 적용 및 검수보고
작성일: 2026-10-28
운영주소: https://docs.00ai.kr/
개발원칙: 기존 사용자 인증/Brevo/HASA/Cloudflare D1 보존, 문서 중심 UI 개편

## 1. 이번에 실제 적용한 화면
- 상단: 브랜드·문서명 인라인 편집·문서 저장 상태·닉네임 아바타·내보내기·공유·패널 토글
- 좌측: 새 문서, 파일에서 만들기, 문서명 즉시 검색, 문서 버전/확정 상태, 보고서·회의록·사업계획서 템플릿
- 리본 메뉴: 홈 / 삽입 / 검토 / 보기 / AI, 문단스타일·굵게·기울임·밑줄·정렬·목록·표·구분선·저장
- 중앙: A4 느낌의 흰 문서 캔버스, 문서 모드 안내 배너, 화면 확대/축소, 글자수·버전 표시
- 우측: 파일 가져오기 / AI / 수정 이력 / 검토·댓글
- 파일: 드래그앤드롭, 12MB 브라우저 분석 용량 안내, 원본 추출 결과와 AI 재구성 제안 양쪽 비교, 사용자 승인 후 본문 반영
- AI: 선택한 본문과 AI 결과를 나란히 확인하고 선택 영역 교체 또는 문서 끝 삽입
- 공유: 별도 모달에서 링크 복사, 현재 공유 정책의 주의 사항 표시
- 접근성: 버튼 제목/레이블, Ctrl/Cmd+S, Esc, 명시적인 포커스 표시, 작은 화면의 패널 전환

## 2. 저장·안전 UX 개선
- 입력 중 2.2초 유휴 후 자동저장, 저장 중 추가 편집은 별도로 감지·재저장
- 문서 전환 시 저장되지 않은 변경이 남으면 이동을 차단
- 서버 리비전 충돌 시 자동 덮어쓰기 금지, 오류 명시
- 최종확정·승인·검토 상태에서 본문 contenteditable 잠금
- DOMParser 기반 제한적 HTML 태그/속성 화이트리스트(클라이언트): 업로드/AI 문서 삽입 시 스크립트 요소 제거
- 본문 열기에서도 제한적 sanitization 적용. 다만 서버측 완전한 XSS 방어 및 CSP 검증은 아직 별도 보안 작업 필요
- Worker HTML cache-control: no-store

## 3. 구현 파일
- `gov-docs/v3-ui.html`: 신규 UX/UI 소스 (개발 원본)
- `gov-docs/worker.js`: 실제 Cloudflare Worker의 HTML 내장
- 이전 버전 `gov-docs/v2-preview.html` 유지(비교/복구 목적)

## 4. 검수
| ID | 항목 | 결과 | 검증 근거 |
|---|---|---|---|
| UX3-01 | 배포 | PASS | Worker 스크립트 PUT HTTP 200 |
| UX3-02 | 도메인 | PASS | docs.00ai.kr custom domain enabled / exact route mapping |
| UX3-03 | 인증 관련 비밀값 | PASS | BREVO_API_KEY, SESSION_SECRET 이름 확인 |
| UX3-04 | AI 비밀값 | PASS | HASA_API_KEY 이름 확인 |
| UX3-05 | 기존 DB 연결 | PASS | D1 binding 유지, docs_v2 및 5개 관련 테이블 존재 |
| UX3-06 | 프런트 JavaScript 문법 | PASS | 내장 스크립트 new Function 정적 컴파일 |
| UX3-07 | 핵심 문서/UI DOM id | PASS | editor, docsearch, syncLabel, importCompare, AI, dialog 등 체크 |
| UX3-08 | 주요 버튼 연결 | PASS (static) | 리본/자동저장/파일 만들기/AI 적용 함수 확인 |
| UX3-09 | 로그인 및 OTP 재검증 | NOT TESTED | 로그인 브라우저 접근 불가, 기존 운영 경험은 별개 |
| UX3-10 | 2명 동시 접속 충돌 | NOT TESTED | 실브라우저 E2E 불가, 기존 방식은 polling |
| UX3-11 | HWPX/DOCX/PDF 대표 샘플 20개 | NOT TESTED | 실제 자료 품질 테스트 필요 |
| UX3-12 | AI 응답 품질과 문서 편집 반영 | NOT TESTED | 실제 HASA 호출 검증 미수행 |
| UX3-13 | 모바일 반응형 실화면 QA | NOT TESTED | CSS breakpoint 작성, 실화면 촬영 미실시 |
| UX3-14 | 외부 접속 HTTP health | NOT TESTED | 외부 HTTP 확인 환경 제한 |
| UX3-15 | 접근제어 및 침투 검증 | NOT TESTED | 실제 행정자료 업로드 전 필수 |

## 5. 주요 한계와 후속 엔지니어링
- 공동편집은 기존 **3.5초 폴링+리비전 충돌 확인** 방식. Yjs/CRDT 실시간 동시 편집·공동 커서는 아직 제공하지 않음.
- 보조 패널의 파일 "원본"은 추출된 텍스트이지 HWP/HWPX 원본 렌더링이 아님.
- HWP 바이너리/스캔 PDF OCR/표·이미지·페이지 레이아웃 원형 보존은 미구현.
- 서버측 원본 저장 R2는 Cloudflare 계정 설정 문제로 비활성; R2 활성화 및 별도 보안/권한 설계 필요.
- 모든 korea.kr 인증 사용자가 동일한 공용 문서 목록을 볼 수 있는 기존 정책이 남아 있음. 문서 단위 ACL을 구현하지 못했으므로 **실제 행정·개인정보·비공개 문서 취급 금지**.
- 외부 CDN(jszip/mammoth/pdf.js)이 차단된 환경에서는 변환 기능 제한.
- `.doc`는 HTML 기반 Word 호환 출력, `.docx` 원형 출력 아님.
- 배포 API 성공을 사용자 브라우저의 모든 기능이 정상 작동한 것으로 간주하지 않는다.

**종합 판정**: 폴라리스·Google Docs의 UX 패턴을 참고한 오피스형 화면 개편은 배포 완료. 기술적 실시간 협업, 원본 HWP 전환 완성도, 행정자료 보안과 다중 사용자 통합 검수는 별도 과제.
