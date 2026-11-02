# 00AI REPLY v0.2 — 의회·감사 요구자료 자동작성

운영 주소: https://reply.00ai.kr

## 배포 (2026-11-02)
- Cloudflare Worker `00ai-reply` 업로드 및 프로덕션 배포 100% 확인
- Workers Custom Domain `reply.00ai.kr` 활성 상태 확인
- 실행 소스: [index.html](./index.html)

## 기능
- 설치 없는 브라우저 파일 처리: CSV, TSV, XLSX, HWPX, DOCX, TXT, MD
- 파일/폴더 등록, 요구문 키워드 검색, 파일·시트·행·문단 근거 확인
- 예산 집행률, 목표달성률, 전년 대비 증감률(일부 정형 필드), 동일 사업·연도 수치 충돌 검사
- 원·천원·만원·백만원·억원 단위 통일 및 요구 연도 근거 유무 표시
- 검토 초안 편집, DOCX/TXT 출력, 검증결과 CSV 출력
- 원문 서버 업로드 및 외부 AI 연동 없음; CSP connect-src 'none'

## 로컬 테스트
- Playwright/Chromium 가상 자료 기반 14개 기능 검증 통과
- CSV/DOCX/HWPX/XLSX/TXT 파서·교차검증 및 DOCX ZIP/XML 검증
- 모바일 390px 폭 오버플로 없음, JS 예외 없음

## 제약 및 주의
- PDF, 기존 HWP, 이미지 OCR, 온나라·HASA 실연동 미구현
- XLSX 수식은 저장된 캐시값만 인식; 문서 간 자동 대조는 한정된 표준 열 이름/사업명/연도에만 적용
- 개인정보·비공개 행정자료 사용 전 내부 보안 적합성 검토 필요. 제출용 확정문서는 담당자가 직접 검증하고 승인
- 외부에서 URL 응답을 확인하는 테스트는 별도로 필요하며 Cloudflare API에서 배포와 도메인 연결 상태만 확인함

## 다음 개발
1. PDF/PDF 텍스트·기존 HWP 파서 (정확도 검증 포함)
2. 개별 요구항목별 근거 매핑, 양식화 출력 및 출처 확인률 평가
3. 안전한 HASA/온프레미스 분석 연계, 권한·감사로그 후 실무 베타
4. 00AI 포털 서비스 카드 및 00AI DOCS 연동
