# 00AI GOV · local upload package

00AI Figma 디자인을 기준으로 만든 정적 웹 프로토타입입니다. 별도의 빌드 과정 없이 `index.html`을 열거나 정적 호스팅에 업로드할 수 있습니다.

## 포함 기능

- 00AI GOV 정책상황실 데스크톱·모바일 반응형 UI
- 실시간 정책 신호 오비트 애니메이션
- 균형·속도·형평 분석 모드 선택
- 정책 시뮬레이션 진행 상태 인터랙션
- 정책 대안 선택 및 적합도 변경
- 예산 슬라이더와 20억원 한도 표시
- 근거·계산·AI 해석 레이어
- 결과 요약 클립보드 복사
- `prefers-reduced-motion` 접근성 대응

## 로컬 실행

가장 간단한 방법은 `index.html`을 더블클릭하는 것입니다. 개발자 도구에서 모듈 오류가 발생하는 환경이라면 다음처럼 정적 서버로 실행하세요.

```bash
python3 -m http.server 4173
```

그 다음 브라우저에서 `http://localhost:4173`을 엽니다.

## GitHub에 올리기

GitHub Desktop을 사용한다면 이 폴더를 `Add existing repository`로 추가한 뒤 `Publish repository`를 선택하세요.

터미널을 사용한다면:

```bash
cd 00AI-GOV-local-upload
git init
git branch -M main
git add .
git commit -m "Build 00AI GOV policy command center prototype"
git remote add origin https://github.com/ImZooMooGwan/00AI.git
git push -u origin main
```

이미 원격 저장소에 파일이 있다면 `git pull --rebase origin main`으로 먼저 확인한 뒤 푸시하세요.

## GitHub Pages

저장소의 `Settings → Pages`에서 `Deploy from a branch`, `main`, `/ (root)`를 선택하면 됩니다. 이 프로젝트는 정적 파일만 사용하므로 별도 빌드 명령이 필요하지 않습니다.

## HASA 연결 주의

현재 패키지는 안전한 정적 데모입니다. HASA 개발키를 `app.js`, HTML, 브라우저 저장소 또는 GitHub에 넣지 마세요. 실제 HASA 호출은 별도의 서버/API 라우트에서 환경변수로 처리하고, 브라우저에는 결과만 반환해야 합니다. 환경변수 이름은 `.env.example`에만 기록되어 있습니다.

## 디자인 원본

- Figma: https://www.figma.com/design/f2X1FjxpCxKXTZG2k9hHQ7
- 원본 콘셉트: 00AI GOV · Future Command Center
- 색상: ink / panel / paper / signal-lime / data-cyan

## 다음 구현 단계

1. 이 정적 프로토타입을 `00AI.kr` 또는 `policy.00AI.kr`에 연결
2. 서버 프록시에서 HASA API 연결
3. 실제 공공데이터·법령·예산 계산 모듈 연결
4. 00AI DROP 정적 배포 기능을 별도 서비스로 구축
