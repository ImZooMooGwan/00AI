# 00AI Workspace v6 — Source-Grounded Public Administration AI

A ChatGPT-inspired browser workspace for drafting council responses and cross-agency submissions from files that an officer explicitly selects on their workstation.

## What's included

- Chat-first UX with task shortcuts, conversation view, model selector and contextual drawers.
- Folder selection with local in-browser text indexing (TXT, JSON, CSV, Markdown, and best-effort DOCX/XLSX/HWPX/PPTX).
- Optional upload of agency submission templates and drafting instructions.
- Evidence-aware retrieval; preview and explicit approval of excerpts before AI requests.
- HASA OpenAI-compatible models accessed **server-side through a Cloudflare Worker secret**.
- Optional remote MCP tool integration: KOSIS statistical research at `https://mcp.gomdori.app/stats`; Korean-law MCP requires a separately accessible service URL.
- Dashboard UI showing model and tool states. **Cron editing, MCP installation and machine administration are NOT implemented**; the referenced `hermes-dashboard` server requires a dedicated authenticated administration backend.

## Source projects

- [LexDiff](https://github.com/chrisryugj/lexdiff), BSL 1.1: conceptual reference for evidence-grounded Korean-law responses. **No LexDiff code has been copied.**
- [Korean Stats MCP](https://github.com/chrisryugj/korean-stats-mcp), MIT: remote MCP service used for KOSIS tool calls when available.
- [Hermes Dashboard](https://github.com/chrisryugj/hermes-dashboard), MIT: inspiration for the operations dashboard layout.
- [kordoc](https://github.com/chrisryugj/kordoc), MIT: parser reference, not fully embedded.

## Architecture

```text
Browser folder → extract and index locally → retrieve excerpts / template + guide
          → review and approve data transfer → Cloudflare Worker
             → HASA LLM (secret server binding)
             → optional KOSIS/Law MCP tool → grounded Korean draft
```

## Deployment and secrets

Deploy the Worker and bind `HASA_API_KEY` using Cloudflare secrets. Never commit credentials or place them in the browser bundle. To enable verified law MCP calls, set a trusted HTTPS `LAW_MCP_URL` binding after confirming its HTTP transport schema and authentication.

**Protect `/api/models` and `/api/compose` with authenticated access and rate limits before allowing public users to consume a personal HASA key.** The repository intentionally does not contain a reusable secret.

## Limitations

- OCR and reliable binary HWP/PDF parsing are not yet implemented; Office ZIP XML extraction is best-effort.
- Folder-wide exhaustive reasoning is not guaranteed; retrieval selects a subset of evidence.
- MCP remote tools depend on availability and tool schemas; if unavailable, the AI is explicitly told that external verification did not occur.
- Spreadsheet formula reconciliation, cited law articles, editable HWPX output, administrative API authentication and cron scheduling remain future work.
- No unattended background access to workstation files.

## Testing

Run JavaScript syntax checks, verify browser rendering and file ingestion with synthetic fixtures, then execute real API/MCP tests on an authorized environment. Do not claim production validation from compilation alone.

## Privacy and official use

Do not transmit restricted institutional documents, personal data or classified information to HASA or external MCP endpoints without explicit organizational approval. All AI answers require officer review before submission.