# 00AI Secure Workspace v8 — English Documentation

**Plan-first public-sector AI, with local-only evidence and ChatGPT-style workflow.**

- [v8 preview](https://00ai-workspace-v8.able001.workers.dev/)
- [Existing production](https://harness.00ai.kr/)
- [Source repository](https://github.com/ImZooMooGwan/00AI)

## Purpose
00AI is a browser-first public administration assistant. Users choose a working folder, sample forms, and reporting guidelines, then request council, agency, and internal reports. Search and evidence selection happen in browser memory.

## Secure workflow
1. Locally index files and user-supplied templates.
2. Compile a structured work plan with `task_type`, `evidence_requirements`, `response_schema`, and `validation_rules`.
3. Display the complete outbound plan for user approval.
4. Send the abstract plan to HASA; do **not** transmit file bytes, excerpts, paths, private templates or instructions.
5. Append locally selected source snippets to the generic draft **on the user's device only**.
6. Require a human to verify every concrete claim before official use.

## Security limitations
The referenced invention disclosure additionally defines an on-premises model, run-specific XREFs, policy-approved KEEP/REMOVE/COARSEN transformations, SHA-256 pinned evidence, claim-level numeric checks and a two-path semantic comparison of the original and actual transmitted evidence. **v8 does not yet implement these complete safeguards.** Its PLAN_ONLY policy prevents document disclosure but cannot produce automatically verified factual conclusions. The server rejects source-bearing payload fields. This prototype is not a certified governmental DLP system.

## Export options
| Format | Technique | Tested |
| --- | --- | --- |
| PDF | Browser print / Save as PDF | UI path added, browser compatibility pending |
| DOCX | Local Open XML document as ZIP | ZIP CRC and XML well-formedness passed; real Word opening pending |
| HWPX | Minimal XML package | ZIP CRC and XML well-formedness passed; **Hancom application compatibility not verified** |

Legacy binary HWP is **not** generated. HWPX is experimental and should not be used for official submission without verifying it in Hancom Office.

## Operational setup
v8 is a separate Cloudflare preview Worker, also routed at `https://00ai.kr/secure-workspace`. The v8 Worker uses a **Cloudflare Service Binding** named `V7` to call the existing v7 Worker, which owns the HASA secret. No browser credentials are shipped. A live end-to-end test is still required before replacing `harness.00ai.kr`. Target service limits are 500 global calls per UTC day, 40 per IP per day, and 5 per IP per minute using a Durable Object.

## Testing status
- Syntax: frontend and Worker passed.
- DOCX/HWPX archive CRC and XML parsing: passed.
- Word/Hancom native opening: pending.
- Phone/desktop PDF print: pending.
- HASA completion on v8: pending.
- Law/KOSIS MCP and scheduler end-to-end: pending.
- Patent-grade evidence dual verification: not implemented.

## Code
`index.html` — workspace and exports; `worker.js` — PLAN_ONLY backend; `README.md` — project documentation.

## Related repositories
[korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp) · [korean-stats-mcp](https://github.com/chrisryugj/korean-stats-mcp) · [kordoc](https://github.com/chrisryugj/kordoc) · [hermes-dashboard](https://github.com/chrisryugj/hermes-dashboard) · [LexDiff](https://github.com/chrisryugj/lexdiff). These are references, not claims of bundled implementation.

**Status: Preview, not a completed production release.**

## Deployment and rollback

On 2026-10-22, Cloudflare routes `harness.00ai.kr/*` and `00ai.kr/harness*` were switched from `00ai-document-engine` to `00ai-workspace-v8`. The previous Worker remains available as a rollback target. The v8 Worker shares server-side HASA access through the `V7` Service Binding and enforces plan-only payload sanitization. `00ai.kr/secure-workspace*` is another direct v8 route. The full production sign-off is **conditional** until browser API calls, Korean-law MCP, KOSIS MCP, and Hancom HWPX interoperability have been tested in their real environments.


## Final QA pass — 2026-10-22

- **Routing:** Cloudflare confirms `harness.00ai.kr/*`, `00ai.kr/harness*` and `00ai.kr/secure-workspace*` all target `00ai-workspace-v8`.
- **Path resolution:** frontend and Worker both normalize the `/harness` and `/secure-workspace` deployment prefixes.
- **Interactive browser smoke test:** headless Chromium desktop (1320×850) and mobile (390×844) successfully rendered the UI without JavaScript page errors. API responses were mocked due to sandbox outbound browsing restrictions; this is not a live HASA check.
- **Report workflow:** tested prompt entry, disclosure/approval dialog, mocked AI response, and DOCX/HWPX download buttons.
- **Document packages:** downloaded DOCX and HWPX archives passed ZIP CRC and XML parsing. The DOCX was successfully rendered into a PDF and inspected visually; Korean text displayed without clipping.
- **HWPX:** package structural inspection succeeded, but compatibility with Hancom Office is **still unverified**.
- **PDF export:** DOCX-to-PDF conversion was verified; the in-browser Print/Save-as-PDF control has not been tested on every platform.
- **Backend:** Cloudflare confirms the `V7` service binding, D1 and Durable Object. A successful live HASA completion, legal/KOSIS remote MCP tool call and actual scheduled job execution are **not verified** by this test.
- **Security boundary:** the v8 frontend uses PLAN_ONLY; its backend rejects document fields and reconstructs the outgoing abstract plan from an allowlist. This is not equivalent to complete patent-specified dual claim validation.

**Release decision:** Deployable public **preview** with tested routes, UI and basic document export; **not certified as a fully validated administrative production system**.
