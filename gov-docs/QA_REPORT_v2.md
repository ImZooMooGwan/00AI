# 00AI Gov Docs 2.0 — 구현 내역 및 검수 보고 (2026-10-28)

## 배포
- 웹 주소: https://docs.00ai.kr/
- Cloudflare Worker: `00ai-gov-docs`
- GitHub 실행 코드: `gov-docs/worker.js`
- 편집 UI 원본: `gov-docs/v2-preview.html`
- D1: `00ai-gov-docs-db` (기존 데이터 유지)
- 인증: `@korea.kr` 이메일 OTP (Brevo)
- AI: HASA Worker Secret 사용

## 구현된 기능
1. **범용 문서**: 고정된 주간업무보고에서 분리, 자유로운 문서 생성·제목 변경·문서 목록과 선택
2. **문서 편집 UI**: 3단 패널(왼쪽 문서 목록, 중앙 A4형 편집기, 오른쪽 파일/AI/이력), 서식 리본, 표 삽입, HTML 저장/출력
3. **변경 추적**: 문서별 rev, 수정자 닉네임, UTC 기준 이벤트 생성 및 화면 표시
4. **협업**: 같은 문서를 열고 주기적으로 반영(3.5초 polling), 오래된 버전의 저장 거절(낙관적 동시성)
5. **파일 가져오기**: TXT/MD/HTML 직접 읽기, DOCX(Mammoth), 텍스트 PDF(PDF.js), HWPX(JSZip + XML 구조 분석)
6. **AI 재구성**: 추출 내용에서 HASA가 편집 가능한 HTML 초안을 제안, 사용자가 미리 보고 수동 반영
7. **기존 HASA 기능**: 요약, 교정, 수치 점검. 결과를 문서에 삽입 가능

## 설치/운영 기술
`Worker (UI + API)` -> `D1` (문서, 이벤트, 추출 텍스트)
`Worker` -> `Brevo` (OTP 이메일), `HASA` (AI)
`Browser` -> CDN 라이브러리 (mammoth, jszip, pdf.js)

## D1 확장 스키마
```sql
CREATE TABLE IF NOT EXISTS docs_v2 (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
 owner TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
 rev INTEGER NOT NULL DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS docs_v2_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, doc_id TEXT NOT NULL,
 actor TEXT NOT NULL, nickname TEXT NOT NULL, kind TEXT NOT NULL,
 before_text TEXT, after_text TEXT, ts TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS docs_v2_files (
 id TEXT PRIMARY KEY, doc_id TEXT NOT NULL, filename TEXT NOT NULL,
 mime TEXT NOT NULL, content TEXT NOT NULL,
 uploaded_by TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## 사용방법
1. https://docs.00ai.kr/ 에서 `@korea.kr` 이메일 OTP 로그인
2. 최초 1회 닉네임 설정
3. 왼쪽에서 **새 문서 만들기** → 이름 지정
4. 중앙 문서 편집 후 저장; 문서 링크 공유
5. 우측 파일 탭에서 DOCX/PDF/HWPX → **문서 분석** → **AI로 문서 구조 재구성** → **본문 삽입** → 저장
6. 우측 AI 탭에서 요약·교정·수치점검 실행
7. 우측 이력 탭에서 누가 언제 문서를 저장했는지 확인

## 검수 결과
| 검수 항목 | 결과 | 증거 / 제한 |
|---|---|---|
| Cloudflare Worker API 배포 | 통과 | Cloudflare PUT 200 |
| 도메인 설정 | 통과 | docs.00ai.kr -> 00ai-gov-docs enabled |
| Secret 유지 | 통과 | BREVO_API_KEY, HASA_API_KEY, SESSION_SECRET 이름 확인 |
| D1 새 테이블 | 통과 | docs_v2 / docs_v2_events / docs_v2_files 확인 |
| D1 insert/update/delete | 통과 | synthetic test row rev 1→2 및 정리 |
| 브라우저 JS 구문 | 통과 | 내장 스크립트 4개 정적 파싱 |
| 실제 사이트에서 사용자 로그인 | 미검증 | 운영 브라우저 E2E 수행 불가; 이전 v1 로그인 사용자가 실증 성공한 기록 있음 |
| 다중 사용자 동시 편집 | 부분구현 | poll/버전충돌 처리, CRDT 아님 |
| DOCX/PDF/HWPX 실물 변환 | 미검증 | 모듈/구조 구현, 샘플 파일별 테스트 필요 |
| HASA 파일 재구성 실제 응답 | 미검증 | 키 설정 확인, 호출 성공 미확인 |
| 바이너리 HWP -> 웹 에디터 | 미구현 | HWPX 재저장 경로로 우회 |
| 이미지·표·정밀 레이아웃 충실도 | 미구현 | 텍스트 추출 우선 |
| 원본 파일 서버 보존 | 미구현 | 계정 R2 활성화 필요 (403 / 10042) |
| 파일별 책임자 및 ACL | 미구현 | 모든 인증 사용자는 전체 문서 공유 |
| 승인·반려·최종본 잠금 UI | 미구현 | 차기 단계 |
| PDF/DOCX/HWPX 출력 | 미구현 | 현재 HTML 내보내기 |
| 보안·접근 통제 검수 | 미수행 | 실제 행정자료 사용 불가 |

## 반드시 알아야 할 한계
- 현재 버전은 Google Docs / Polaris Docs의 **완전한 실시간 동시 편집 엔진이 아님**. 같은 문단을 여러 명이 수정하면 버전 충돌이 발생할 수 있고 수동 병합이 필요함.
- 원본 HWP 바이너리(.hwp), 복잡한 HWPX 표/머리말/꼬리말/이미지, 스캔 PDF OCR은 해결하지 못함.
- 업로드한 **원본 파일 바이너리**는 서버에 저장하지 않고 추출한 텍스트/HTML만 D1에 저장함. 브라우저 단에서 파일 열기 처리.
- 공용 문서 목록에는 현재 인증된 모든 사용자의 문서가 나옴. 접근제어 요구사항 미완료.
- 외부 CDN 라이브러리가 차단된 네트워크에서는 변환이 실패할 수 있음.
- AI 출력 HTML은 신뢰할 수 없는 내용이므로 실제 운영 전 HTML sanitizer와 원본 검증이 필요함.

## 후속 우선순위
1. **Yjs/Tiptap + Durable Objects** 실시간 협업 및 공동 커서
2. R2 활성화 후 원본 파일의 버전별 보존·다운로드
3. 한컴 바이너리 HWP 변환 엔진(서버 측 실행 환경)과 정밀 HWPX 변환
4. 댓글·제안 모드·출처 및 숫자 근거 링크
5. 파일/폴더 권한·접근 통제와 승인·반려·확정 워크플로
6. DOCX/HWPX/PDF 내보내기 및 문서 라운드트립 테스트

**평가**: 업무용 완성품이 아닌, 서비스 운영 주소에 배포된 기능 확장 프로토타입. 완료/미완료 표기를 혼동하지 말 것.


## 2026-10-28 추가 개발 및 검수 (v2.1)
**실제 개발·배포**
- 문서별 댓글 등록·조회 API 및 우측 검토 탭 구현
- 소유자 검토 요청(submitted) → 승인(approved) → 확정(final) 상태 전이; 확정 시 snapshot 저장
- 반려 및 초안 상태 복귀 API 구현
- HTML 및 Word 호환 `.doc` 파일 내보내기, 브라우저 인쇄를 통한 PDF 저장 UI 구현
- 신규 테이블 docs_v2_comments / docs_v2_members / docs_v2_versions 생성
- Cloudflare Workers 배포 API 성공(HTTP 200)
- UI 내장 JavaScript 정적 구문 검사 통과

**제한 및 미완료**
- `.doc`는 HTML 기반 Word 호환 출력이며 DOCX 포맷 아님.
- PDF는 브라우저 인쇄 기능으로 저장, PDF 엔진 직접 생성 아님.
- 댓글과 상태 전이의 사용자 브라우저 E2E 검증은 미수행.
- 문서별 ACL 강제, R2 원본 보관, 진정한 Yjs CRDT 공동 편집, 바이너리 HWP 및 스캔 PDF OCR, 완전한 HWPX 서식 복원, 원본 보존 라운드트립은 미구현.
- R2 활성화 실패: Cloudflare 403/10042 계정 설정 필요. 운영 전 실제 문서 사용 금지.
