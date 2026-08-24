# 00AI 공공AI 플랫폼

공공 AI 서비스 포털과 정적 웹 서비스 배포 기반을 위한 00AI입니다.

## 현재 구현

- 서비스 등록부와 프로젝트 갤러리
- GitHub 공개 저장소 프로젝트 자동 등록
- 00AI Harness 소개 화면
- 00AI DROP 정적 파일 업로드 API
- Supabase Storage 기반 정적 웹 배포
- Supabase Edge Function 기반 업로드·검증·프로젝트 레지스트리
- 업로더 소속·성명·제목·설명 등록
- 단일 HTML 자동 `index.html` 처리
- ZIP 공통 최상위 폴더 자동 정리
- 파일 수·용량·확장자·파일명 검증
- 중앙부처 요구자료 자동작성을 위한 Local-First 업무계획 API

## 00AI DROP

00AI DROP은 포털의 `/api/deploy`가 Supabase Edge Function `zeroai-drop`으로 업로드를 전달하고, Edge Function이 전용 공개 Storage 버킷 `zeroai-drop`에 정적 파일을 저장하는 구조입니다.

```text
00ai.kr
  → /api/deploy
  → Supabase Edge Function (zeroai-drop)
  → Storage bucket (zeroai-drop/sites/<slug>/...)
  → 공개 정적 서비스 URL
```

프로젝트의 소속·성명·제목·내용은 `registry/<slug>.json`으로 별도 저장되며 프로젝트 갤러리에 다시 노출됩니다. 데이터베이스가 일시적으로 사용할 수 없는 경우에도 DROP 자체는 Storage 레지스트리만으로 동작합니다.

지원 규칙:

- 단일 `.html`/`.htm` 파일은 파일명이 무엇이든 자동으로 `index.html`로 배포
- ZIP 내부가 `project/index.html`처럼 한 단계 폴더로 감싸져 있으면 자동으로 루트 정리
- `Index.html` 등 대소문자 차이 자동 보정
- `.DS_Store`, `__MACOSX` 자동 제외
- 단일 파일 최대 20MB, 프로젝트 전체 최대 50MB, 최대 1,000개 파일
- 서버 실행 파일과 위험 확장자 차단

## GitHub 프로젝트 자동 동기화

`ImZooMooGwan` 계정에 새 공개 저장소를 만들면 포털 프로젝트 갤러리에 자동으로 나타납니다.

- 저장소 이름 → 프로젝트명
- 저장소 Description → 프로젝트 설명
- 저장소 Homepage → `서비스 열기` 링크
- 저장소 Language와 Topics → 기술·분류 정보
- 새로 만든 저장소가 위에 표시됨
- 포크, 보관·비활성 저장소, `00AI`, `.github`는 자동 제외

공개 저장소 조회에는 토큰이 필요하지 않습니다. 호출량이 늘면 `GITHUB_TOKEN`을 런타임 비밀 환경변수로만 설정합니다. 특정 Topic이 있는 저장소만 공개하려면 `GITHUB_PROJECT_TOPIC`, 추가 제외 대상은 `GITHUB_EXCLUDE_REPOS`에 지정합니다.

## 로컬 실행

```bash
npm run dev
```

## 배포

```bash
npm run build
```

## 보안 원칙

- 사용자 업로드 정적 웹앱은 00AI 포털과 다른 Origin인 Supabase Storage에서 제공합니다.
- 서버 실행 코드와 실행 파일은 업로드하지 않습니다.
- ZIP 경로 이탈을 차단하고 루트 밖 경로를 허용하지 않습니다.
- 단일 파일 20MB, 프로젝트 50MB, 최대 1,000개 파일로 제한합니다.
- Supabase service-role 키는 Edge Function 런타임에서만 사용합니다.
- 포털에는 공개 호출용 anon 키만 사용하며 service-role 키는 저장소에 넣지 않습니다.
- Harness 계획 API는 내부 원문을 받거나 외부 AI로 전송하지 않습니다. 실제 검색·통계 조회·양식 렌더링·승인은 행정망 내부 MCP 도구에서 실행해야 합니다.

## 다음 보강 항목

- 공개 업로드 속도 제한
- Turnstile/CAPTCHA
- 신고·차단 및 관리자 삭제
- 커스텀 배포 도메인 연결
- 프로젝트별 버전 관리와 롤백
