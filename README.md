# 00AI — 공공업무 AI 서비스 모음

00AI는 공공업무에서 활용할 AI·문서·채용·정책정보 도구를 개발하고 운영하기 위한 통합 저장소입니다. Cloudflare Workers와 Pages를 중심으로 각 서비스를 독립적으로 배포할 수 있게 구성하며, 공통 포털에서 서비스 진입점과 운영 도구를 연결합니다.

이 저장소에는 운영 서비스 코드, 데이터베이스 마이그레이션, 배포 설정, 설계·보안 문서가 함께 들어 있습니다. 서비스별 실행 방법과 환경변수는 각 디렉터리의 README와 `.env.example`을 우선 확인하세요. API 키, 접근 토큰, 실사용자 개인정보는 저장소에 올리지 않습니다.

## 서비스 구성

| 경로 | 서비스 | 설명 |
|---|---|---|
| [`apps/portal`](apps/portal) | 00AI 포털 | `00ai.kr` 서비스 허브, 서비스 목록·도메인 연결, 배포 및 프로젝트 관리 기능을 담당하는 Next.js 앱입니다. 공개 서비스 라우팅, 상태 확인, Drop 배포 도구와 관련 API가 포함됩니다. |
| [`apps/root-router`](apps/root-router) | 루트 도메인 라우터 | 루트 도메인 요청을 포털 및 정적 서비스로 전달하는 Cloudflare Worker입니다. |
| [`apps/subdomain-router`](apps/subdomain-router) | 서브도메인 라우터 | 서비스별 서브도메인 요청을 목적지로 연결하는 Cloudflare Worker입니다. |
| [`apps/ats`](apps/ats) | 00AI ATS | 지원자 관리, 채용 단계, 면접 일정, 평가, 내부 메모, 이메일 예약 및 역할 기반 접근통제를 제공하는 채용 관리 서비스입니다. Worker API, D1 마이그레이션, 화면, 제품·보안 문서와 진행 기록을 포함합니다. |
| [`apps/council`](apps/council) | 00AI COUNCIL | 대전광역시의회 생방송을 00AI 계정으로 모니터링하고 한국어 자막·회의 기록, 공무원 채팅, AI 회의 보고서 초안을 제공합니다. |\n| [`apps/notion`](apps/notion) | 00AI NOTE | 문서·페이지·데이터베이스를 정리하고 협업하는 워크스페이스 앱입니다. Worker, D1 스키마와 단계별 마이그레이션, 편집기 및 서비스 설명이 포함됩니다. |
| [`apps/harness-web`](apps/harness-web) | 00AI Harness 웹 | 업무 요청 입력, 실행기 선택, 실행 상태와 결과 확인을 제공하는 브라우저 UI 및 배포 설정입니다. |
| [`apps/harness-agent`](apps/harness-agent) | Harness 실행기 | 사용자 PC 또는 기관 내부 서버에서 문서를 처리하고 선택적으로 HASA 추론을 호출하는 Python 실행기입니다. 설치 스크립트와 민감정보 마스킹 점검도 포함합니다. |
| [`apps/youth-policy-mcp`](apps/youth-policy-mcp) | Y-HUB 청년정책 MCP | 온통청년 정책정보를 검색·조회하고 자격 점검, 비교, 변경 이력 및 근거 확인을 지원하는 읽기 전용 MCP Worker입니다. |
| [`apps/00ai-reply`](apps/00ai-reply) | 00AI REPLY | 행정문서 회신·답변 작성 도구의 정적 서비스 파일입니다. |
| [`apps/otgeunmu-alarm`](apps/otgeunmu-alarm) | 초과근무 알림 | 초과근무 시간 확인과 알림을 위한 정적 앱입니다. |
| [`gov-docs`](gov-docs) | 00AI DOCS 개발 자료 | 문서 편집·문서관리카드 UX, 기능 검토, 품질 점검 및 공동편집 실험 자료를 보관합니다. |
| [`policy`](policy) | 정책정보 서비스 | 정책 관련 화면, Worker 구성, 디자인 문서 및 Cloudflare 배포 설정을 포함합니다. |
| [`workspace`](workspace) | 워크스페이스 프로토타입 | 문서 엔진과 NOTE 워크스페이스의 이전 버전·실험용 구현 및 버전별 설명을 보관합니다. |
| [`index.html`](index.html) | Harness 정적 진입 화면 | 저장소 루트에서 제공하는 Harness 웹 진입 페이지입니다. |

> 서비스의 배포 주소나 공개 여부는 코드에 적힌 주소만으로 보장되지 않습니다. 실제 운영 상태와 접근 권한은 해당 서비스의 Cloudflare 설정 및 포털 연결 상태를 확인하세요.

## 기술·운영 구조

- **웹 앱과 Worker 분리:** 화면과 API·백그라운드 처리를 서비스 목적에 따라 분리하고, 각 앱의 Wrangler 설정으로 배포 대상을 지정합니다.
- **Cloudflare 기반 구성:** Workers, Pages, D1 및 필요 시 R2·Durable Objects를 서비스별로 연결합니다. 실제 바인딩 이름과 마이그레이션 순서는 서비스별 설정을 따릅니다.
- **HASA 연동:** Harness 등 AI 기능을 사용하는 앱은 OpenAI 호환 API를 선택적으로 호출합니다. 비밀값은 환경변수 또는 Cloudflare 비밀 저장소에 두고 코드·문서 예시에는 실제 키를 기록하지 않습니다.
- **데이터 변경 관리:** D1 스키마 변경은 서비스 디렉터리의 순서가 지정된 마이그레이션 파일로 관리합니다. 운영 데이터베이스에 적용하기 전에 대상 환경과 백업·검증 절차를 확인해야 합니다.
- **보안 경계:** 서비스별 인증·역할·조직 격리 정책을 문서와 Worker에서 함께 확인합니다. 로컬 개발용 설정을 운영 보안 설정으로 간주하지 않습니다.

## 서비스별 문서와 실행 방법

- ATS: [`apps/ats/README.md`](apps/ats/README.md), [요구사항](apps/ats/docs/02-product-requirements.md), [보안 설계](apps/ats/docs/11-security.md)
- NOTE: [`apps/notion/README.md`](apps/notion/README.md)
- Harness PC·내부 실행기: [`apps/harness-agent/README.md`](apps/harness-agent/README.md)
- 포털: [`apps/portal/README.md`](apps/portal/README.md)
- 청년정책 MCP: [`apps/youth-policy-mcp/README.md`](apps/youth-policy-mcp/README.md)
- 문서 편집 개발 자료: [`gov-docs/README.md`](gov-docs/README.md)
- 정책정보 서비스: [`policy/README.md`](policy/README.md)

일반적으로는 대상 앱 디렉터리로 이동해 해당 앱의 README에 적힌 의존성 설치, 환경변수 설정, 개발 서버 실행 순서를 따릅니다. 저장소 루트에 단일 실행 명령이 있다고 가정하지 마세요. 비밀값이 필요한 기능은 `.env.example`을 참고해 로컬 또는 배포 환경에 별도로 설정합니다.

---

# 00AI Harness · Local-First Government AI

Harness는 행정망 안의 파일·문서·데이터·도구를 안전하게 연결하기 위한 업무 보조 도구입니다. 웹 Harness는 요청, 실행 대상 선택, 진행 상태, 결과 확인을 담당하며 실제 처리는 다음 실행 경계 중 하나에서 수행합니다.

1. **브라우저 로컬** — 설치 없이 텍스트 문서를 읽고 근거와 SHA-256을 생성합니다.
2. **PC 에이전트** — 사용자 PC의 별도 Python 실행기가 문서를 처리하고 HASA 추론을 선택적으로 사용합니다.
3. **기관 내부 서버** — 같은 실행기 계약을 기관 서버에 배치해 내부 시스템과 확장 연결합니다.

## Harness 핵심 원칙

- API Key와 접근 토큰을 공개 웹사이트나 GitHub에 저장하지 않습니다.
- 원본 문서의 읽기, 근거 추출, 해시는 PC 또는 내부 서버에서 수행합니다.
- HASA에는 원본 전체가 아니라 이메일·전화번호·주민등록번호 패턴을 가린 근거 문장만 전달합니다.
- 실행기 연결 확인이 성공해야 PC 에이전트와 내부 서버 RUN 버튼이 활성화됩니다.
- 문서나 실행기가 없으면 가짜 결과를 만들지 않습니다.

## 실행 경계와 송신 원칙

| 실행 방식 | 원문 처리 위치 | 원문 이동 범위 | HASA 송신 | 키 보관 |
|---|---|---|---|---|
| 브라우저 로컬 | 현재 브라우저 탭 | 이동 없음 | 사용하지 않음 | 필요 없음 |
| PC 에이전트 | `127.0.0.1:43120`의 로컬 실행기 | 웹에서 이 PC의 로컬 실행기까지 | 이메일·전화번호·주민등록번호 패턴을 가린 근거 문장 | Windows DPAPI 암호화 파일 |
| 기관 내부 서버 | 기관이 지정한 내부 실행기 | 업무 PC에서 내부 서버까지 | 비식별 근거 문장 | 서버 환경변수 또는 기관 비밀관리체계 |

PC 에이전트는 `127.0.0.1`에만 바인딩하고 허용 Origin을 `https://harness.00ai.kr`로 제한합니다. 기관 내부 서버는 HTTPS 리버스 프록시, 충분히 긴 `HARNESS_AGENT_TOKEN`, 방화벽 및 이용자 접근통제를 전제로 합니다. 현재 정규식 마스킹은 완전한 비식별을 보장하지 않으므로 기관의 반출 기준에 맞춘 추가 탐지·승인 절차가 필요합니다.

## PC 에이전트 설치

설치·실행 파일은 [`apps/harness-agent`](apps/harness-agent)에 있습니다.

Windows에서는 Python 3.10 이상을 설치한 뒤 `install-windows.ps1`을 최초 1회 실행합니다. 설치기는 HASA API Key를 현재 Windows 계정의 DPAPI로 암호화해 저장하고 로그인 자동 시작을 등록합니다. 이후 Harness에서 PC 에이전트를 선택하면 로컬 실행기 연결을 자동 확인합니다. 키는 공개 웹사이트, GitHub, 작업 스케줄러 인수에 저장하지 않습니다.

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

[`apps/youth-policy-mcp`](apps/youth-policy-mcp)에는 온통청년 정책을 영속화하고 검색·상세·자격점검·비교·변경이력·근거 조회를 제공하는 읽기 전용 원격 MCP Worker가 있습니다. 목표 엔드포인트는 `https://mcp.00ai.kr/youth`입니다.
