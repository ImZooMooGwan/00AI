# 00AI ATS Public SaaS v2 — integration package

This package is intended to be copied into the existing `ImZooMooGwan/00AI` repository before switching its public `ats.00ai.kr` endpoint. The ATS in that repository already has a React Kanban UI, basic Cloudflare Worker, D1 and Queue bindings.

```bash
# copy this package's apps/ats/{worker/saas.ts,worker/public-auth.ts,migrations/0003_public_saas.sql,src/AuthGate.tsx,src/auth.css,scripts/*,tsconfig.saas-build.json}
# into the existing apps/ats folder, without deleting existing files
cd apps/ats
node scripts/apply_to_existing_repo.mjs
npm install
npm run typecheck
python3 scripts/test_saas_schema.py
npm run test:saas
npm run build
npx wrangler deploy --dry-run
```

Deployment requires the safety gates in `apps/ats/docs/PUBLIC-SAAS-RELEASE.md`. The package was validated with local SQLite + strict backend TypeScript stubs, **not yet deployed into production**.
