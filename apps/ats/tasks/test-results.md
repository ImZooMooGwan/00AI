# 검증 결과 (2026-10-29)

- `npm run typecheck`: 통과 (2026-10-29 개선 적용 후 재실행)
- `npm test`: 통과, 불합격 예약 규칙 4개 (2026-10-29 개선 적용 후 재실행)
- `npm run test:schema`: 통과, 전체 SQLite 마이그레이션/예약 인덱스/단계전환/예약 취소/재불합격/경쟁이벤트 시나리오 (2026-10-29 개선 적용 후 재실행)
- `npm run build`: 통과, Cloudflare Worker 및 클라이언트 번들 생성 (2026-10-29 개선 적용 후 재실행)
- `npx wrangler deploy --dry-run --config dist/00ai_ats/wrangler.json`: 통과, D1/R2/Queue/Email/Assets 바인딩 인식
- 로컬 Worker/브라우저 런타임 실행은 현재 실행 컨테이너의 `uv_interface_addresses` 시스템 오류로 시작되지 않음. 배포 dry-run은 별도로 성공.
- 실제 Cloudflare 배포, Access 인증, 이메일 발송, HASA 호출은 계정/도메인/비밀값이 없어 검증하지 않음.
