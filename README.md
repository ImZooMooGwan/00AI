# 00AI Harness · Local-First Government AI

행정망 안의 파일·문서·데이터·도구를 안전하게 연결하는 00AI Harness의 정적 프로토타입입니다.

이 버전은 별도 설치나 API 키 없이 실행됩니다.

## 핵심 원칙

- 내부 데이터는 외부 생성형 AI로 전송하지 않습니다.
- 외부 모델은 필요할 때 추론 계획만 제안하고, 실제 데이터 조회와 문서 처리는 내부 실행기가 담당합니다.
- 모든 결과는 `FACT · CALCULATED · INFERRED · PROPOSED` 근거 유형으로 구분합니다.
- API 키와 개인정보는 저장소에 넣지 않습니다.

## 로컬 실행

1. 압축을 해제합니다.
2. `index.html`을 브라우저로 엽니다.
3. 또는 폴더에서 다음 명령으로 정적 서버를 실행합니다.

```bash
python -m http.server 4173
```

브라우저에서 `http://localhost:4173`을 엽니다.

## GitHub 업로드

압축 해제 후 해당 폴더에서 실행합니다.

```bash
git init
git branch -M main
git add .
git commit -m "Build 00AI Harness local-first prototype"
git remote add origin https://github.com/ImZooMooGwan/00AI.git
git push -u origin main
```

기존 저장소에 파일이 이미 있다면 먼저 `git pull --rebase origin main`을 실행한 뒤 커밋하세요.

## 배포

- GitHub Pages: 저장소 Settings → Pages → `main` / root 선택
- Netlify: `index.html`이 있는 폴더를 드래그 앤 드롭
- Vercel: 프로젝트 Import 후 Framework Preset을 `Other`로 선택

## 화면 흐름

`RUN HARNESS`를 누르면 `Ready → Active`로 이동합니다. Active 화면의 `DRAFT RENDER` 단계를 누르면 `Verified` 결과 화면으로 이동합니다. `Ctrl/Cmd + K`로 상태 전환 명령 팔레트를 열 수 있습니다.

## 다음 구현 단계

정적 데모의 상태 전환을 실제 내부 실행기로 교체할 때는 브라우저에 키를 넣지 말고, 행정망 내부 백엔드의 `/api/plan`, `/api/execute`, `/api/evidence` 같은 엔드포인트를 연결하세요.

## Y-HUB 청년정책 MCP

`apps/youth-policy-mcp`에는 온통청년 정책을 영속화하고 검색·상세·자격점검·비교·변경이력·근거 조회를 제공하는 읽기 전용 원격 MCP Worker가 있습니다. 목표 엔드포인트는 `https://mcp.00ai.kr/youth`이며 설치·마이그레이션·운영·배포 방법은 [앱 README](apps/youth-policy-mcp/README.md)를 참고하세요.
