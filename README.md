# 00AI Harness · Local-First Government AI

행정망 안의 파일·문서·데이터·도구를 안전하게 연결하기 위한 00AI Harness입니다.

웹 Harness는 요청, 실행 대상 선택, 진행상태, 결과 확인을 담당합니다. 실제 처리는 업무 경계에 따라 세 가지 실행기 중 하나에서 수행합니다.

1. **브라우저 로컬** — 설치 없이 텍스트 문서를 읽고 근거와 SHA-256을 생성합니다.
2. **PC 에이전트** — 사용자 PC의 별도 Python 실행기가 문서를 처리하고 HASA 추론을 선택적으로 사용합니다.
3. **기관 내부 서버** — 같은 실행기 계약을 기관 서버에 배치해 내부 시스템과 확장 연결합니다.

## 핵심 원칙

- API Key와 접근 토큰을 공개 웹사이트나 GitHub에 저장하지 않습니다.
- 원본 문서의 읽기, 근거 추출, 해시는 PC 또는 내부 서버에서 수행합니다.
- HASA에는 원본 전체가 아니라 이메일·전화번호·주민등록번호 패턴을 가린 근거 문장만 전달합니다.
- 실행기 연결 확인이 성공해야 PC 에이전트와 내부 서버 RUN 버튼이 활성화됩니다.
- 문서나 실행기가 없으면 가짜 결과를 만들지 않습니다.

## PC 에이전트 설치

설치·실행 파일은 [`apps/harness-agent`](apps/harness-agent)에 있습니다.

Windows에서는 Python 3.10 이상을 설치한 뒤 `start-windows.ps1`을 실행합니다. HASA API Key는 화면에 표시되지 않는 입력창으로 받고 해당 실행 프로세스의 환경변수에만 둡니다.

## HASA 연결

HASA Open AI Service Hub의 OpenAI 호환 API를 사용합니다.

- Base URL: `https://open.hasa.re.kr/v1`
- Chat endpoint: `POST /v1/chat/completions`
- 기본 모델: `exaone-4.0-32b`

실행기는 `HASA_API_KEY`, `HASA_BASE_URL`, `HASA_MODEL` 환경변수를 읽습니다. 키가 없거나 HASA가 응답하지 않으면 로컬 근거 추출 결과는 유지하고 오류 상태를 명시합니다.

## 브라우저 로컬 실행

1. `https://harness.00ai.kr`을 엽니다.
2. `브라우저`를 선택합니다.
3. 업무 요청과 TXT·Markdown·CSV·JSON·HTML 문서를 입력합니다.
4. `RUN BROWSER LOCAL`을 누릅니다.
5. 근거, 파일 해시, Markdown 결과를 확인합니다.

## 기관 내부 서버

```bash
export HASA_API_KEY="발급받은 키"
export HARNESS_AGENT_TOKEN="충분히 긴 내부 접근 토큰"
./apps/harness-agent/start-server.sh --origin https://harness.00ai.kr
```

내부 서버는 방화벽·접근통제·HTTPS 리버스 프록시 뒤에 배치하세요. 현재 공개 MVP는 텍스트 문서 근거 추출과 HASA 분석까지 지원합니다. HWPX 파싱·생성, 행정망 파일 검색, 전자결재 등은 내부 실행기의 승인형 도구로 추가해야 합니다.

## Y-HUB 청년정책 MCP

`apps/youth-policy-mcp`에는 온통청년 정책을 영속화하고 검색·상세·자격점검·비교·변경이력·근거 조회를 제공하는 읽기 전용 원격 MCP Worker가 있습니다. 목표 엔드포인트는 `https://mcp.00ai.kr/youth`입니다.
