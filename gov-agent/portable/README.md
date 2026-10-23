# 00AI Gov Agent — Portable A1

**A new, separate project under the 00AI repository.** No installations, servers, Node.js runtime, API keys, or Internet connection are required for the portable HTML edition.

## Distribution

- `index.html`: standalone, UTF-8, self-contained HTML application
- Deployed browser version: `https://00ai.kr/gov-agent` (the same LOCAL_ONLY app)
- Local edition: open `index.html` by double-clicking in Microsoft Edge or Google Chrome

## What works
- User-approved folder selection (up to 250 files and 12 MB per file), per-file extraction results
- Local text search and evidence candidate ranking
- Browser-only SHA-256 over selected text excerpts (when Web Crypto is available; the offline `file://` context may not expose Web Crypto in some browsers)
- Deterministic arithmetic for two explicitly entered numeric values
- Visible task steps and local run log
- Offline TXT, HTML, DOCX, JSON downloads and browser print-to-PDF

## Security guarantees and limits
- No `fetch`, `XMLHttpRequest`, external scripts, font CDNs, remote images, external AI calls, remote MCP calls, or server file uploads.
- The Edge file-picker warning may say "upload"; it is the browser's access confirmation. File bytes are processed in JavaScript memory.
- Input files are not modified. Generated content is downloaded only by a user click.
- Evidence snippets and file names will appear in downloaded report artifacts. These outputs need the same handling as their source materials.
- The offline edition is a **rules-based assistant**, not a local large language model and not Google Antigravity itself. It does not autonomously edit arbitrary files or run shell commands.
- HWP (binary), text/scanned PDF and images are not supported by the current local parser. DOCX/XLSX/PPTX/HWPX support is limited and ZIP bit-3/data-descriptor archives are rejected.
- Literal numeric matches and hashes do not prove that a claim is factually correct. Reports are review drafts only.

## Security model
`LOCAL_ONLY`: no external calls. No external plan-only or approved-evidence mode. Data remains in browser memory, cleared when the tab is closed (except manually downloaded reports).

## Quality gates
1. Verify that the HTML runs when disconnected from the Internet.
2. Select a sample directory containing TXT, CSV, DOCX, XLSX and unsupported PDF/HWP to verify per-file status.
3. Try 2025 value 50,000 and 2026 value 60,000: expect difference 10,000 and 20% increase.
4. Export DOCX, JSON, TXT and browser PDF; open these in target office suites.
5. Inspect browser Network to confirm no requests during use.
6. Check no original files were overwritten.

## Next versions (NOT implemented)
- Approved local runtime / on-premises LLM and agent orchestration
- Full HWP/PDF and complex XLSX support
- Persistent workspace watchers and file editing
- Patent-style dual original-vs-transmitted evidence validation
- Scheduled jobs and offline MCP services

## Relationship to existing projects
The existing `workspace/v8` at `harness.00ai.kr` remains separate. The Gov Agent A1 does not use HASA or Cloudflare API endpoints. This project shares high-level UI and office parsing ideas but avoids dependencies that would require installation on administrative PCs.

## UI refresh (v1.1 — 2026-10-23)

**Visual language:** calm light surfaces, muted indigo (#5557d6), rounded 10–20px corners, generous whitespace, system Korean fonts only (no external font downloads), subtle separation rather than heavy outlines and gradients.

**Information architecture:** persistent desktop navigation, responsive compact mobile navigation, a concise task introduction, Step 01 (local files), Step 02 (task request), right-side progress and evidence cards, and a full-width report preview with download actions. Desktop, mobile and A4 print layouts are defined.

**Interaction changes:** task status messages retain their original labels when completed; the confirmation checkbox now affects TXT, HTML, JSON, DOCX and browser print/PDF. All previous file IDs, exported functions, and offline constraints are maintained.

**Offline integrity:** the HTML uses no external JavaScript, CSS, images, font servers or network requests. Both deployed Cloudflare Worker HTML and downloadable `index.html` are generated from the same content. Cloudflare's browser-delivery Worker uses a restrictive `connect-src 'none'` policy.

**Verification completed:** JavaScript parse, all 18 DOM element IDs needed by the application, 10 inline click handlers, worker/HTML exact-content synchronization, mobile + print CSS rules, and source-level absence of outbound request primitives. Cloudflare Worker deploy completed with HTTP 200. Actual manual visual inspection in managed Windows browsers has not been performed in this execution.

### Visual hierarchy and UI tokens
| Token | Hex | Purpose |
| --- | --- | --- |
| Background | `#f7f8fb` | Workspace canvas |
| Surfaces | `#ffffff` | Panels and cards |
| Indigo | `#5557d6` | Primary actions and brand |
| Ink | `#222436` | Main content |
| Muted | `#777b8d` | Supporting descriptions |
| Success | `#198469` | Local-only or completed status |


## HASA assisted web mode — 2026-10-23

**Online deployment:** `https://00ai.kr/gov-agent` now offers an optional **HASA AI 작성 보조** checkbox. This mode is **off by default**. Before any external call, the page shows exactly the abstract information intended for the API and requires an explicit user confirmation. Offline `file://` use disables HASA and keeps all rules-based local features.

**Network path:** browser → `/gov-agent/api/compose` → Cloudflare Gov Worker → Cloudflare service binding `V7` → internal existing HASA integration. The API key remains in the upstream V7 Worker secret and is never embedded into HTML or Gov Worker source. A server-side allowlist reconstructs the outbound plan as only task category, document count and per-extension counts. Question original, document text, file names, numerical values, selected evidence, templates and directory paths are neither received as accepted plan fields nor passed to HASA. Unknown plan fields are rejected. A 3 KB JSON-body limit is enforced before parsing.

**Result:** HASA returns general report outline, workflow suggestions and validation checklist only, not a document-grounded answer. The client joins that general advice locally with search results. Provider claims are **not verified** against the source documents.

**Security caveat:** this is a web AI mode, not a fully offline local LLM. External AI can observe the generalized task category and file-type counts if the user consents. Institutional security policies and network approvals still apply. No claims are made that this is safe for classified documents or a complete patent-style E/D dual verification solution.

**Tests:** static JavaScript syntax passed; deployed Worker source matched the standalone HTML; V7 service binding reported configured in the Cloudflare API; Worker deployment returned HTTP 200. Direct end-to-end live HASA completion could not be confirmed via this environment, so do not advertise external provider availability as proven. Existing IP/total throttling is managed by the upstream V7 Worker, but individual request quota behavior has not been load tested.
