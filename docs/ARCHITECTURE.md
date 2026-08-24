# Architecture

```text
공식 API·공식 페이지
        ↓ Connector (예정)
Bronze 원문 스냅샷
        ↓ 정규화·엔터티 식별
Silver 정책·프로그램·회차
        ↓ 검증·공개 규칙
Gold 공개 레지스트리
        ↓ 필드 비교
Change Event
        ↓
Next.js 화면 · Open API · CSV/JSON · RSS
```

현재 MVP는 API 키 부재 시 `lib/data.ts`의 검증 스냅샷을 사용한다. 브라우저는 공공데이터 API를 직접 호출하지 않는다. 정식 수집기는 서버에서 실행하고 원문 해시, 수집시각, 원천 갱신일을 저장한다.

영속 계층은 Supabase PostgreSQL, PostGIS, pgvector, Storage, Realtime을 목표로 한다. 현재 배포환경에서는 정적 스냅샷을 우선해 비용과 운영 복잡도를 낮췄다.

