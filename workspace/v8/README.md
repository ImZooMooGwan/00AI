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
v8 is a separate Cloudflare preview Worker. A new Worker **does not automatically inherit** the HASA secret configured on v7. A live HASA test is required before replacing `harness.00ai.kr`. Target service limits are 500 global calls per UTC day, 40 per IP per day, and 5 per IP per minute using a Durable Object.

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