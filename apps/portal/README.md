# 00AI 공공AI 플랫폼

공공 AI 서비스 포털과 정적 웹 서비스 배포 기반을 위한 00AI v0.1입니다.

## 현재 구현

- 서비스 등록부와 프로젝트 갤러리
- GitHub 공개 저장소 프로젝트 자동 등록
- 00AI Harness 소개 화면
- 00AI DROP 정적 파일 업로드 API
- D1 프로젝트·배포 이력 저장 구조
- R2 정적 파일 저장 구조
- 파일 수·용량·확장자·파일명·`index.html` 검증
- 프로젝트별 배포 이력과 활성 버전 포인터
- 인증된 운영자용 이전 버전 되돌리기 API
- 중앙부처 요구자료 자동작성을 위한 Local-First 업무계획 API

## GitHub 프로젝트 자동 동기화

`ImZooMooGwan` 계정에 새 공개 저장소를 만들면 포털 프로젝트 갤러리에 최대 약 5분 안에 자동으로 나타납니다. 포털을 다시 빌드하거나 프로젝트 카드를 직접 수정할 필요가 없습니다.

- 저장소 이름 → 프로젝트명
- 저장소 Description → 프로젝트 설명
- 저장소 Homepage → `서비스 열기` 링크
- 저장소 Language와 Topics → 기술·분류 정보
- 새로 만든 저장소가 위에 표시됨
- 포크, 보관·비활성 저장소, `00AI`, `.github`는 자동 제외

공개 저장소 조회에는 토큰이 필요하지 않습니다. 호출량이 늘면 `GITHUB_TOKEN`을 런타임 비밀 환경변수로만 설정합니다. 특정 Topic이 있는 저장소만 공개하려면 `GITHUB_PROJECT_TOPIC`, 추가 제외 대상은 `GITHUB_EXCLUDE_REPOS`에 지정합니다.

## 현재 제한

- ZIP 자동 압축해제와 배포 이력은 구현되어 있습니다. GitHub 저장소의 소스 자체를 DROP으로 가져오는 기능과 사용자 로그인은 다음 단계입니다.
- 파일은 R2에 저장되지만, `*.00ai.kr` 공개 URL은 Cloudflare 와일드카드 DNS와 별도 배포 Worker를 연결한 뒤 활성화됩니다.
- 사용자 파일은 00AI 포털과 다른 Origin에서 제공해야 합니다. 포털 쿠키를 `.00ai.kr` 전체에 공유하면 안 됩니다.

## 실제 공개 URL 연결

`drop-dispatch/`에는 사용자 프로젝트를 `프로젝트명.00ai.kr`에서 제공할 독립 Worker가 포함되어 있습니다. DNS와 Cloudflare 계정 설정이 필요한 외부 작업이므로, Worker를 배포한 다음 `*.00ai.kr/*` 경로를 연결하면 업로드된 프로젝트의 공개 주소가 활성화됩니다.

## 구성

```text
Portal → D1 (프로젝트·배포 정보)
       → R2 (업로드 파일)
       → 별도 배포 Origin (*.00ai.kr)
```

## 로컬 실행

```bash
npm run dev
```

## 배포

```bash
npm run build
```

운영자가 이전 정적 배포 버전으로 되돌릴 때에는 `DROP_ADMIN_TOKEN`을 서버 환경에만 설정한 뒤 아래 API를 호출합니다. 이 API는 저장된 배포 버전만 활성화할 수 있으며, 토큰이 없으면 항상 거부됩니다.

```text
POST /api/deployments/rollback
Authorization: Bearer <DROP_ADMIN_TOKEN>
{"projectId":"...","deploymentId":"..."}
```

Sites 환경에서는 `.openai/hosting.json`의 `DB`, `BUCKET` 논리 바인딩이 D1/R2에 연결됩니다. 스키마 변경 시 아래 명령으로 migration을 생성합니다.

```bash
npm run db:generate
```

## 보안 원칙

- 서버 실행 코드와 실행 파일은 업로드하지 않습니다.
- 단일 파일 20MB, 프로젝트 50MB, 최대 1,000개 파일로 제한합니다.
- API 키와 비밀값은 파일·클라이언트 코드·Git 저장소에 넣지 않습니다.
- 버전 되돌리기 API는 서버 환경의 `DROP_ADMIN_TOKEN` 없이는 작동하지 않습니다.
- Harness 계획 API는 내부 원문을 받거나 외부 AI로 전송하지 않습니다. 실제 검색·통계 조회·양식 렌더링·승인은 행정망 내부 MCP 도구에서 실행해야 합니다.
- 실제 공개 전 ZIP Slip 차단, 파일 MIME 재검증, 속도 제한, CAPTCHA, 신고·차단 기능을 추가합니다.
