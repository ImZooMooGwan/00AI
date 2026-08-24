# Architecture

```text
공식 API·공식 페이지
        ↓ Server Connector
D1 Bronze 원문·해시
        ↓ 정규화·엔터티 식별
D1 Silver 외부 레코드·변경 후보
        ↓ 검증·공개 규칙
Gold 검증 스냅샷·공개 레지스트리
        ↓ 필드 비교
Change Event
        ↓
Next.js 화면 · Open API · CSV/JSON · RSS
```

API 키 부재 시 `lib/data.ts`의 검증 스냅샷을 사용한다. 브라우저는 공공데이터 API를 직접 호출하지 않는다. 수집기는 서버에서 실행하고 원문 JSON, SHA-256 해시, 수집시각, 원천 갱신일을 D1에 저장한다.

영속 계층은 Sites가 관리하는 Cloudflare D1을 사용한다. 대용량 원문 파일이 필요해지는 시점에는 R2를 추가하고, 현재 단계에서는 구조화 API 응답만 D1에 보존한다.
