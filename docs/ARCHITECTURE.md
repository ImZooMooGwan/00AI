# Architecture

```text
GitHub 00AI Youth Policy MCP (Streamable HTTP, read-only tools 6개)
        ↓ 우선 조회
Y-HUB MCP Client ───────────────┐
        │ 실패                  │
        ↓                       │
공식 API·공식 페이지            │
        ↓ Server Connector      │
D1 Bronze 원문·해시             │
        ↓ 정규화·엔터티 식별     │
D1 Silver 외부 레코드·변경 후보 ─┤
        ↓ 실패/빈 저장소         │
Gold 검증 스냅샷·공개 레지스트리 ─┘
        ↓ 필드 비교
Change Event
        ↓
Next.js 화면 · Open API · CSV/JSON · RSS
```

API 키 부재 시 `lib/data.ts`의 검증 스냅샷을 사용한다. 브라우저는 공공데이터 API를 직접 호출하지 않는다. 수집기는 서버에서 실행하고 원문 JSON, SHA-256 해시, 수집시각, 원천 갱신일을 D1에 저장한다.

영속 계층은 Sites가 관리하는 Cloudflare D1을 사용한다. 대용량 원문 파일이 필요해지는 시점에는 R2를 추가하고, 현재 단계에서는 구조화 API 응답만 D1에 보존한다.

`lib/youth-policy-mcp.ts`는 GitHub `ImZooMooGwan/00AI/apps/youth-policy-mcp`가 공개한 `2025-06-18` Streamable HTTP 규격을 사용한다. `tools/call`의 `search_youth_policies` 결과를 Y-HUB 공개 레코드로 정규화하며, MCP URL과 시간제한은 서버 런타임 환경변수로만 읽는다. 상태 API는 공개 엔드포인트·도구·DB·최근 동기화 여부만 반환하고 비밀값은 반환하지 않는다.
