# 00AI ATS Public SaaS v2 — deployment and security gates

## Completed in this implementation package

- Email OTP signup/login/logout with 12-hour HTTP-only session cookies and request throttling.
- Automatic first-organization bootstrap after verified email, and per-organization rejection email template.
- D1 migration that quarantines all legacy ATS records into a suspended organization.
- Tenant-scoped applications, candidates, positions, stage events, templates, email scheduling, interviews, evaluations, resumes, activity, and statistics.
- 10-minute rejection-email scheduling and cancellation, queue/cron fallback, version validation and send-once guard.
- Server-side HASA proxy with per-organization opt-in.
- Dedicated 00AI-branded login screen and workspace identification.
- SQLite migration and synthetic two-tenant integration tests (never send real email).

## Not safe to remove Cloudflare Access until ALL of the following pass

1. Back up production D1 and existing KV files; ensure the old records are assigned to the suspended legacy organization.
2. Run staging D1 migration 0003, run `npm run typecheck`, `npm run test:saas`, `npm run build`, and `wrangler deploy --dry-run`.
3. On staging Worker set `ATS_AUTH_PEPPER` (random >= 32 bytes), `BREVO_API_KEY`, verified `EMAIL_FROM_ADDRESS`, and correct bindings. Keep `EMAIL_SERVICE_VERIFIED=false` until domain + provider verification succeeds.
4. Confirm public account signup receives OTP, browser cookie is httpOnly, OTP replay fails, user B cannot access user A's candidate IDs or files, and existing data is invisible to both.
5. Confirm organization-specific email automation is opt-in; test queued email with synthetic addresses only and abort when restoring a candidate before 10 minutes.
6. Confirm HASA is disabled for new workspaces until admin enables it, and private resume content is never sent without adequate privacy authorization.
7. Manually provision a verified legacy administrator with a membership into the suspended legacy org, review ownership, and activate legacy org only after approval. Do not self-assign the old data to the first signup.
8. Only after staging verification, deploy new Worker and static assets, re-test from a private browser, and **then** remove Cloudflare Access on `ats.00ai.kr` so the branded ATS signup page can display.

## Operational constraints

- R2 is not enabled in the currently connected account; previous KV resume storage remains the temporary fallback. Do not represent KV as R2.
- The existing shared-password secrets remain unused by v2; rotate/remove them after cutover.
- `EMAIL_SERVICE_VERIFIED` is a separate operator flag; no live rejection email is sent until an org admin enables that workflow.
- Signups are verified-email passwordless accounts, not anonymous access to applicant data.
- Passwordless login requires verified outgoing email (Brevo). Do not disable authentication because an email provider is unconfigured.
- Invite generation and membership switching are an optional follow-on; organization invite acceptance support exists in auth, but UI/admin invitation API is not included in this release.
- CSV import, document parsing, audit browsing, billing, service plan limits, deletion policy, more granular evaluator rights and operational monitoring need a separate production hardening milestone.
