# 00AI DOCS | Google Docs parity engineering backlog

Updated 2026-11-03. Reference baseline: estimated 43/100 Google Docs feature-completeness; not a measured production benchmark.

## Completed and deployed this session

- Migration safety preflight for authorized documents: immutable source metadata, source revision, SHA-256 of stored HTML body.
- Require flush of unsaved edits, version match, verified export backup before launching separate Yjs editor.
- Yjs client attaches stable per-session, monotonically increasing request ID to each queued update.
- Durable Object uses SQLite receipt table keyed by actor/request ID and transactional journal/receipt write; duplicate deliveries receive prior sequence acknowledgement.
- ACK matching checks the queued request ID before removing local unsent updates.
- Updated bundled client and server uploaded to Cloudflare Workers with existing bindings preserved.
- No automatic migration of legacy content; the old canonical D1 HTML remains unmodified.

## Newly built and deployed follow-up changes

- Client: online recovery, capped 30-second exponential reconnect, timer cleanup.
- Realtime UI: explicit manual reconnect button.
- Additional automated assertions for reconnect behavior.
- Vite client bundle `index-D9G6sQae.js` deployed in `00ai-gov-docs`.
- Rebuilt Durable Object server bundle deployed in `00ai-docs-collab-canary`, including 30-day dedupe receipt cleanup at snapshot intervals.
- Both Cloudflare workers confirmed on versions receiving 100% traffic; original account bindings retained.
- Full multi-account end-to-end editing remains unverified and is not counted as completed.

## Additional delivered functionality

- Added a native `.docx` Open XML download route in the legacy editor using JSZip: paragraphs, headings, inline basic marks, lists and simple tables. Includes OOXML content types and relationships. This is **not full-fidelity HWPX/DOCX round-trip**, and multi-format visual QA is outstanding.
- Added an editor inline-script parse test and DOCX packaging assertions to GitHub CI.

## Remaining gates before 100% claim

1. **Canonical document migration** — approved HTML -> ProseMirror JSON -> Y.Doc; preserve original with export and deterministic rollback.
2. **Single editor** — replace legacy contenteditable with the Tiptap editor; all versions/comments/workflow/output reference one canonical document state.
3. **Collaboration end-to-end** — 3 users, same-table-cell concurrent edits, reconnect 10 times, 1,000 updates, role revocation, restart/resume.
4. **High fidelity formats** — DOCX/HWPX round-trip, complex tables, images, headers/footers, page layout and proper DOCX/PDF output.
5. **Document workspace** — folders, trash, search, favorites, owned/shared access and permission UI.
6. **Review workflows** — inline anchored comments, suggestion accept/reject, named revisions and audit trail.
7. **AI** — context-aware HASA drafting, edits as reversible suggestions, quantitative source checks, use restrictions for private data.
8. **Durable storage/recovery** — R2 originals, retention, backups, restore drill, offline draft handling.
9. **Security/operations** — browser E2E with real test accounts; pen test for XSS/CSRF/session, capacity, error alerts, accessibility.
10. **Acceptance** — objective feature-by-feature comparison with Google Docs and formally recorded evidence; only then update parity score.

## Operating rule

Do not treat Cloudflare HTTP 200 or source commits as proof that end-user functionality passed. Do not feed private government documents to this experimental service. Never overwrite the canonical HTML document with an experimental Y.Doc until explicit per-document conversion has passed validation. Preserve D1/DO bindings and deployed secrets during updates.

## 2026-11-03 follow-up: collaboration correctness and recovery (deployed)

- **Fail-closed ACK handling**: the client removes an unacknowledged edit only when the server's `requestId` matches the front queued edit; a stray ACK no longer removes work.
- **Fail-closed sync**: incomplete, malformed or unappliable Yjs snapshot data prevents the editor from entering a writable connected state; the socket reconnects.
- **Unsendable local edits**: an update exceeding the protocol frame cap now produces a persistent unsaved-change indication and participates in the unload warning rather than being silently ignored.
- **Awareness ACL**: Durable Objects re-check the recipient's read permission before broadcasting presence updates.
- **Recovery exports**: the experimental real-time editor can download local HTML and ProseMirror JSON copies. These are recovery artifacts and are not canonical document versions or fully verified round-trip formats.
- **Automated source guards**: collaboration tests now include invalid sync/ACK, large update, presence ACL, and HTML/JSON export checks; the GitHub Actions build produced the packaged frontend.
- **Deployment validation**: Cloudflare `00ai-gov-docs` and `00ai-docs-collab-canary` deploy APIs succeeded; both show 100% traffic on the latest revision. The original D1, DO, authentication, mail and HASA bindings remain configured.

Unverified: authenticated multi-user live-browser E2E, session revocation under concurrent editing, crash/reconnect test, DOCX round trip, enterprise security test and migration to a single canonical document editor. These must pass before raising the Google Docs parity score or allowing sensitive official documents.
