# 00AI Workspace — Operational Backend v7

A public-facing, ChatGPT-inspired administrative-document assistant that indexes user-selected working files in the browser, applies evidence and templates, and sends approved excerpts to HASA for Korean-language administrative drafts.

## Capabilities

- **Public demo access:** Users need no login or API key. HASA credentials must remain exclusively in a Cloudflare Worker secret, never in the browser bundle or public Git repository.
- **Quotas:** Durable Objects maintain an atomic **global limit of 500 accepted AI requests per UTC day** across instances, with a secondary 5 requests / IP / minute and 40 requests / IP / day limit. Requests are reserved before HASA execution, including requests that fail upstream. This conservative reservation prevents exceeding 500 calls. Usage of model-list queries is separate from the generation quota. UTC reset is intentional, not Korean midnight.
- **MCP:** KOSIS statistics via `https://mcp.gomdori.app/stats` and `quick_stats`, legal original-source research via `https://mcp.gomdori.app/law?oc=...` and `legal_research` when the separate `LAW_OC` secret is configured. Responses should disclose unavailable or failed retrieval; no invented legal/statistical citations.
- **Schedules:** Cloudflare Cron Trigger invokes a backend D1 job runner every 15 minutes and writes execution results to `job_runs`. Jobs are created by a **private administrator API** authenticated with `ADMIN_TOKEN`; public users cannot create or execute scheduled jobs. Repeated runs currently use the configured minute interval, minimum 60 minutes. The schedule is not a personal reminder service.
- **Drafting:** Folder excerpts + optional agency response template + writing guidance are sent to the selected HASA model only after transfer review.

## Prerequisites

Cloudflare account with Workers, Durable Objects (SQLite-backed) and D1 enabled; HASA development/operational credential, and a law MCP OC credential if legal research is required. The KOSIS MCP is a third-party hosted service; availability and current capabilities should be verified before production use.

## Deploy

1. Create D1 database `00ai-workspace-jobs`, copy its UUID into `wrangler.jsonc`.
2. Apply `schema.sql` to D1 with Wrangler's migration/execute functionality.
3. Set Worker secrets `HASA_API_KEY`, `LAW_OC` and `ADMIN_TOKEN` using `wrangler secret put`. Never paste their values into code or git.
4. Run `wrangler deploy`. New Durable Object migration `v1-quota` creates the atomic usage-limit coordinator.
5. Confirm `/api/health`, `/api/models`, legal and KOSIS MCP calls, rate limiting, the scheduled job journal and all error paths.
6. Only after end-to-end tests, change `harness.00ai.kr/*` and `00ai.kr/harness*` routes to the production Worker.

## Important operational constraints

- **Quota reservation vs successful response:** The 500 count is per attempted AI execution accepted for handling, not billing-confirmed success. If an upstream request fails, it still consumes one reservation. This favors protecting the published key.
- **MCP calls:** The remote server must support Streamable HTTP/SSE and the cited tool interface. If the server uses a different required parameter schema, integration must be updated and tested; do not silently fall back to LLM-generated numbers.
- **Admin security:** `ADMIN_TOKEN` must be strong and used only through an authenticated management client. This backend does not yet provide a fully interactive admin console with start/pause/reschedule/delete or an email-notification channel.
- **File types:** Existing HTML provides local extraction attempts for text and structured office formats; accurate HWP/PDF/complex XLSX processing, OCR, and editable government-form export remain separate work items.
- **No implicit privacy approval:** End-user access without login does *not* authorize uploading internal government files to an external model.
- **Production verification:** Code compilation is not evidence of successful Cloudflare deployment, HASA model inference, official-law citations, KOSIS response validity, or Cron execution. Require explicit acceptance results for each.

## Routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/health` | GET | Platform status and configured integrations (no secret contents) |
| `/api/models` | GET | Obtain account-accessible HASA model IDs |
| `/api/compose` | POST | Public draft request, enforced atomic quota |
| `/api/admin/jobs` | GET/POST | List and create recurring jobs; protected admin token |
| `/api/admin/runs` | GET | Last 50 job executions; admin only |
| `/api/admin/run-now` | POST | Execute due jobs immediately; admin only |

## Licensing and credit

- [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) — MIT; remote legal MCP reference.
- [korean-stats-mcp](https://github.com/chrisryugj/korean-stats-mcp) — MIT; official KOSIS query bridge reference.
- [lexdiff](https://github.com/chrisryugj/lexdiff) — BSL 1.1, not copied; inspiration for original-source grounding.
- [hermes-dashboard](https://github.com/chrisryugj/hermes-dashboard) — MIT; dashboard UX/reference only, not a transplanted working gateway.

**Status:** Backend implementation candidate requiring provisioning and live acceptance testing. Do not describe it as a fully validated operational deployment until every integration has been verified.