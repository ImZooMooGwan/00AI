# 00AI Harness PC Agent / Internal Runner

`harness.00ai.kr`과 PC 또는 기관 내부 서버를 연결하는 실제 실행기입니다. Python 표준 라이브러리만 사용하므로 별도 패키지 설치가 필요 없습니다.

## 처리 경계

- 원본 문서 읽기, 근거 추출, SHA-256 계산은 PC 또는 내부 서버에서 수행합니다.
- HASA를 사용할 때는 이름·전화번호·이메일·주민등록번호 패턴을 가린 근거 문장만 전송합니다.
- API Key는 환경변수로만 읽으며 웹사이트나 GitHub에 저장하지 않습니다.
- 현재 지원 파일은 TXT, Markdown, CSV, JSON, HTML입니다.

## Windows PC에서 실행

1. Python 3.10 이상을 설치합니다.
2. 이 폴더를 내려받습니다.
3. `start-windows.ps1`을 우클릭해 PowerShell로 실행합니다.
4. HASA API Key를 입력합니다. 입력값은 화면에 표시되지 않습니다.
5. `https://harness.00ai.kr`에서 `PC 에이전트`를 선택하고 연결 확인을 누릅니다.

PowerShell 실행 정책 때문에 차단될 경우 폴더에서 다음 명령을 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\start-windows.ps1
```

## 기관 내부 서버에서 실행

```bash
export HASA_API_KEY="발급받은 키"
export HARNESS_AGENT_TOKEN="충분히 긴 내부 접근 토큰"
./start-server.sh --origin https://harness.00ai.kr
```

방화벽 또는 리버스 프록시에서 HTTPS를 적용하고 필요한 이용자만 접근하도록 제한하세요. 웹 Harness에는 내부 실행 서버의 HTTPS 주소와 접근 토큰을 입력합니다. 토큰은 브라우저 탭 메모리에만 유지됩니다.

## 실행 API

- `GET /health`: 실행기, HASA 설정, 문서 전송 정책 확인
- `POST /v1/runs`: 업무 요청과 선택 문서를 처리

요청 예시:

```json
{
  "request": "문서의 핵심 수치와 확인 필요 항목을 근거와 함께 정리해줘.",
  "files": [
    {"name": "plan.txt", "content": "문서 내용"}
  ]
}
```

HASA는 OpenAI 호환 `POST /v1/chat/completions`로 연결하며 기본 모델은 `exaone-4.0-32b`입니다. `HASA_MODEL` 환경변수로 변경할 수 있습니다.
