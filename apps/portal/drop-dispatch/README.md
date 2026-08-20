# 00AI DROP Dispatch Worker

사용자 프로젝트를 포털과 분리된 `*.00ai.kr` Origin에서 제공하는 Cloudflare Worker입니다.

## 배포 준비

1. `wrangler.toml.example`을 `wrangler.toml`로 복사하고 실제 D1 ID와 R2 버킷명을 입력합니다.
2. Cloudflare DNS에 `*.00ai.kr` 와일드카드 레코드를 만들고 Worker route를 `*.00ai.kr/*`로 연결합니다.
3. 포털의 인증 Cookie는 반드시 Host-only로 설정합니다. `Domain=.00ai.kr` 설정은 금지합니다.
4. `npx wrangler deploy`로 배포합니다.

## 동작

- 서브도메인으로 프로젝트를 찾고 최신 저장 버전의 R2 파일을 제공합니다.
- 확장자가 없는 SPA 경로는 `index.html`로 fallback합니다.
- 폴더 이탈 경로와 백슬래시 경로는 차단합니다.
- 보안 헤더와 정적 자산 캐시 정책을 적용합니다.
