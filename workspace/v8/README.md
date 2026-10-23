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


## Reliability patch — 2026-10-23

- Revalidated Cloudflare v8 Worker bindings: `V7` service bridge, D1 and Durable Object.
- Added a client-side **fail-soft mode**: if the AI endpoint fails after the user's approval, the workspace still builds a clearly labeled, editable local report outline and a list of retrieved file excerpts, with the actual error retained. Existing DOCX/PDF/HWPX download controls can work from this local result.
- The fallback does **not** claim that AI inference, original-source verification or MCP retrieval succeeded. Source claims still require review.
- Cloudflare Worker upload returned HTTP 200. End-to-end live HASA/KOSIS/law MCP tests and native Hancom HWPX compatibility remain pending; no certification is claimed.

## First release candidate — 2026-10-23

### Delivered in the deployed Worker

- Three production DNS routes: `harness.00ai.kr/*`, `00ai.kr/harness*`, and `00ai.kr/secure-workspace*`.
- Chat-first document workflow, local-folder indexing, example/template inputs and writing guidance.
- `PLAN_ONLY` abstract request policy with server-side field allowlisting. No original document excerpts are sent through normal document-drafting requests.
- Private Cloudflare `V7` service binding provides HASA inference without exposing the key in the browser.
- Explicit law/statistics question routes `/api/public/law` and `/api/public/stats`; the **submitted question** is sent to an external search/AI process, unlike PLAN_ONLY document drafting. These routes depend on the v7 MCP adapter. Claims still require verification against primary references.
- Local report fallback if HASA fails, with a conspicuous offline/AI-disconnected label.
- PDF print, DOCX export, and **experimental** HWPX export.
- Cloudflare persistent D1 and quota bindings.

### Release acceptance evidence

- JavaScript parser: frontend script and Worker passed.
- Static security check: `PLAN_ONLY` guard and both public search endpoints present; no literal HASA key embedded.
- Cloudflare API: Worker upload succeeded, production route mappings and bindings confirmed.
- Desktop/mobile UI: previous browser smoke test with **mocked** AI API passed.
- DOCX: local archive/XML parsing and document rendering previously passed; broad compatibility not certified.
- HWPX: XML/ZIP structure tested; **Hancom opening unverified**.
- External network limitation: requests to the deployed addresses were inaccessible to the verification environment, therefore real HASA, legal MCP, KOSIS MCP and scheduler execution cannot be called proven. **Do not claim full end-to-end operational acceptance.**

### Open issues for full production acceptance

1. Verify live `GET /api/models` and `POST /api/compose` from a real internet client, including mobile.
2. Verify `/api/public/law` with the exact source law title, article and effective date.
3. Verify `/api/public/stats` with KOSIS table ID and reference period.
4. Run one authenticated D1 scheduled job and inspect the saved `job_runs` row; the admin panel is not complete.
5. Open a generated HWPX in Hancom Office and correct its format if necessary.
6. Add patent-disclosed E/D dual verification, signed/pinned evidence snapshots and claim-level numeric checks.


## Security and UX audit — 2026-10-23

- Browser folder selection through `webkitdirectory` may display an Edge/Chromium warning using the word **upload**. This grants the page access to the selected local files; it does **not**, by itself, send files to a remote server. The UI now explains this distinction.
- Document drafting retains `PLAN_ONLY` mode: original documents, file paths, excerpts, submitted examples and writing guides are not included in the normal HASA request. The server rebuilds a restricted abstract plan instead of trusting arbitrary nested fields from the browser.
- **Legal and KOSIS lookup is different:** the user-typed question is sent outside the browser. The approval dialog now shows the actual outbound question and warns users to remove private or personal details. This is not covered by the `PLAN_ONLY` statement.
- Local retrieval was tightened: unrelated document excerpts with zero query-term matches are no longer automatically included as evidence.
- Folder analysis still has format/size limitations, including legacy HWP, OCR PDF, and very large or complex workbooks. Successful parsing does not certify factual or numerical correctness.
- Deployed Cloudflare Worker received HTTP 200 and JavaScript syntax passed. Live end-to-end HASA, MCP, PDF mobile printing, Hancom HWPX opening and scheduled task execution are separate acceptance tests and remain unverified.


## Hardening release — 2026-10-23 (security audit follow-up)

### Changes actually deployed
- Reject POST API requests declared larger than 18 KB and non-JSON content types on public `/api/` endpoints. **Limitations:** chunked requests and post-decompression size still require stream-based byte counting; this is not a complete DoS safeguard.
- Fail closed when the downstream search response does **not** report the requested MCP tool in `toolUsed`; an LLM narrative alone is no longer displayed as successful official legal/KOSIS retrieval.
- Label external search responses as **unverified**, not official facts.
- Distinguish external search query transmission from local document browsing in the approval dialog and result label.
- Warn when a selected folder contains more than 250 files: only the first 250 are processed by this release.
- Preserve PLAN_ONLY for ordinary document drafting, with local-only documents and server-side task allowlisting.

### Outstanding blocking issues (not claimed as fixed)
1. The production-replay version of v7 in GitHub is truncated; restore from an authoritative intact release and enforce reproducible deployments before changes to that Worker.
2. Validate real HASA completions, law/KOSIS MCP responses and source IDs through an internet client; toolUsed checks prevent false positives but cannot prove official facts.
3. Replace current XML-flattening XLSX/HWPX parser with conformant, bounded document readers retaining cell coordinates, units and date formats.
4. Implement actual local claim-to-source verification and mathematical reconciliation (COPY/SUM/DIFFERENCE/RATIO). Current source excerpt attachment is NOT verified evidence.
5. Correct legacy HWP and scanned PDF extraction, or explicitly reject these documents; never mark unsupported documents as fully parsed.
6. Validate HWPX opening in Hancom and PDF on mobile; leave HWPX labeled experimental.
7. Establish authenticated job administration, idempotent schedules, Cron run capture and operational alerts.
8. Conduct browser network HAR and penetration tests with non-sensitive test fixtures before authorizing institutional data use.
9. Enforce request and CPU limits at infrastructure level, not solely client-declared Content-Length.
10. Complete privacy/records retention analysis and public-sector network security approval.

**Acceptance status:** safer **public preview**, *not* a complete production certification. Cloudflare Worker upload succeeded; live external integrations and official-document accuracy remain unverified.


## Browser document engine patch — 2026-10-23

GitHub research reviewed `chrisryugj/kordoc`, `Docufinder`, and `korean-stats-mcp` as reference architectures. **No complete third-party parser was copied or claimed to be included.** The browser-native reader now preserves XLSX worksheet XML identifiers, row numbers, cell addresses, shared string mappings and the literal formula expressions found in sheet XML. DOCX and PPTX paragraph extraction uses DOMParser instead of blanket regex tag removal. The ZIP reader now imposes bounded compressed-entry and total expanded sizes and checks XML syntax.

These checks **do not** constitute complete OOXML support. The reader rejects ZIP data-descriptor files (flag bit 3), does not compute Excel formulas, does not fully interpret number formats, merged cells or shared formulas, and does not handle PDF, legacy HWP, scanned images or nonstandard HWPX packages. For officially submitted figures, the user must still verify the original file and the applicable units/period. ZIP corruption, compression bombs and parser-edge security need further systematic testing.

**Release evidence:** JavaScript parsing passed before commit; Cloudflare Worker update returned HTTP 200. Actual uploaded-file fixtures, native Hancom compatibility, live HASA/MCP calls and institution-network penetration tests were not completed in this patch.
