# 00AI Workspace — Public-Sector Document Intelligence

**Turn everyday working folders into source-grounded administrative drafts.**

[![Status](https://img.shields.io/badge/status-prototype-orange)](https://github.com/ImZooMooGwan/00AI)
[![Delivery](https://img.shields.io/badge/delivery-browser--first-486FF8)](https://harness.00ai.kr/)
[![Language](https://img.shields.io/badge/UI-Korean-14B8A6)](https://harness.00ai.kr/)

> **Live workspace:** https://harness.00ai.kr/  
> **Alternate workspace:** https://00ai.kr/workspace  
> **Repository:** https://github.com/ImZooMooGwan/00AI/tree/main/workspace/document-engine

## Why this exists

An administrative officer responding to a council, another department, an auditor, or a national agency typically needs to review many scattered documents, extract figures from spreadsheets, cross-check dates, assemble tables, and write a defensible submission. A general chatbot is not enough: **the numbers must be traceable to files**.

**00AI Workspace** is an experimental, browser-first AI assistant designed around that specific workflow:

**Select a local folder → Parse supported files → Build an in-browser index → Retrieve relevant evidence → Review what will be sent → Generate a HASA-backed draft → Verify and export.**

It targets a government workstation where installing Node.js, Python, or executables may be restricted, without assuming that internet access implies authorization to disclose internal materials.

## What can you do?

| Workflow | What it aims to produce |
| --- | --- |
| Legislative council requests | Year-by-year program budgets, expenditure, attendance and evidence-backed narrative |
| Interdepartmental inquiries | Project status summaries and requested tables |
| National agency reporting | Outcomes, implementation progress and supporting documents |
| Audit preparation | Draft evidence inventories, missing-item flags and discrepancies |
| Document intelligence | Summaries, comparisons, question answering and classification |
| General drafting | Reports, meeting summaries, checklists and correspondence |

Some options are **prompt templates**, not fully independent production engines. PPTX generation, OCR, legally reliable rule checking and advanced spreadsheet reconciliation require further implementation.

## Quick start

### In your browser

1. Open **https://harness.00ai.kr/**.
2. Check the HASA connection indicator. Select a model that is available to your account.
3. Choose **Select folder**, then grant access to the chosen directory and its descendants.
4. Inspect the parsed-file counts and any unsupported formats.
5. Choose an administrative task and write a concrete request.
6. Review the exact evidence excerpts before approving any external transfer.
7. Review the draft, confirm all figures against their original source, and export the result.

### Standalone HTML

Download [`index.html`](./index.html) and open it with Edge or Chrome. The prototype is designed for a single-file interface; API functionality still depends on network availability, browser policies, and valid HASA credentials. No credentials are published in this repository.

### Example request

```text
Using documents in the selected working folder, prepare a response for
the local council comparing 2024–2026 youth-space budgets, expenditures,
execution rates, visitor counts and major program outcomes.

Create a year-by-year table, identify the source file and sheet or
section for every figure, flag conflicting values and mark missing
evidence as "Verification required". Do not invent numbers.
```

## Architecture

```text
Government workstation (Edge / Chrome)
     │
     ├── User-selected local folder / subfolders
     │      ├── Text, CSV, JSON and structured Office files
     │      └── Format-aware extraction and chunking
     │
     ├── In-memory document index
     │      ├── File path and source-position metadata
     │      └── Query-time evidence retrieval
     │
     └── Transfer review and explicit user approval
                     │
                     ▼
       Cloudflare Worker / HASA adapter
                     │
                     ▼
              HASA LLM service
                     │
                     ▼
          Source-grounded draft / export
```

### Processing principles

- Read only files deliberately selected by the user; do not modify originals.
- Extract and index locally wherever supported.
- Keep workbook cell, table, document and filename provenance when available.
- Retrieve selected evidence snippets rather than forwarding an entire folder by default.
- Ask for approval before network transmission of evidence.
- Label unsupported files, missing evidence and model failures explicitly.
- Treat generated narratives and citations as **drafts requiring verification**, not official findings.

## Format support: current limitations matter

| Format | Current approach | Limitations |
| --- | --- | --- |
| TXT / Markdown / CSV / JSON | Browser text parsing | Encoding and complex data interpretation may differ |
| HTML / XML | Text extraction | Layout and semantics may be lost |
| DOCX | Compressed XML extraction | Merged cells and layout are not guaranteed |
| XLSX | Sheet/row/cell extraction | Formula evaluation, cached values and date types require checking |
| PPTX | Slide text extraction | Visual layout and chart semantics may be lost |
| HWPX | Compressed-XML extraction attempts | Complex tables and embedded objects may be missed |
| PDF | Future parser integration | Scanned PDF / OCR not reliable in current build |
| Legacy binary HWP | Future parser integration | Not supported as a complete browser-native parser |

Workloads containing large folders or encrypted, malformed, image-based or legacy office documents may fail. Do not interpret a parsed-file count as proof that all relevant evidence was recovered.

## AI models and integration

- AI provider: [HASA Open](https://open.hasa.re.kr/)
- Potential Korean administrative-document models: `hyperclovax-seed-32b`, `kanana-2-30b-a3b`
- Optional additional models depend on the dynamically retrieved HASA model list and user entitlements.
- Existing Cloudflare API bridge: `00ai-hasa-bridge`
- Law and ordinance analysis is intended to work with an existing Korean-law MCP integration; successful end-to-end legal-tool execution remains a separate validation milestone.

### References and related open source

- [kordoc](https://github.com/chrisryugj/kordoc): Korean-document parsing project — architectural reference; **not** a claim that its complete engine is included.
- [Docufinder](https://github.com/chrisryugj/Docufinder): full-text document discovery reference.
- [korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp): legal retrieval / citation validation reference.

Original projects retain their own licenses. Attribution does not imply incorporation of entire implementations.

## Security and data governance

**Never upload restricted administrative files, personal information, security-sensitive materials or non-public records to third-party AI services without explicit organizational approval.**

- A public Git repository is not a place for API keys.
- A browser application cannot keep a hardcoded client-side key secret.
- External HTTPS reachability does not authorize external data processing.
- Client-side redaction or consent UI alone does not constitute enforceable data-loss prevention.
- The current prototype is **not** a certified government security product.
- Users are responsible for source validation before any formal submission.

A separate personal testing copy may use an embedded development key, but **that copy must not be distributed or committed**. Public builds must not include such a key.

## Status and validation

| Milestone | Status |
| --- | --- |
| Browser-first workspace | Prototype implemented |
| HASA model connectivity through Cloudflare | Previously observed in interactive testing; revalidate after updates |
| Selected-folder file discovery | Prototype implemented |
| Structured extraction for selected document families | Prototype; format-specific accuracy testing needed |
| Grounded administrative drafting | Prototype; human verification required |
| Robust PDF / legacy HWP extraction | Planned |
| Exact numeric conflict resolution across many files | Planned |
| Direct Korean-law MCP tool invocation | Planned / requires integration validation |
| XLSX / DOCX / HWPX output preserving official templates | Planned |
| Government workstation acceptance tests | Pending |

A successful JavaScript syntax check or Cloudflare deployment does **not** substitute for functional, security or end-to-end testing.

## Roadmap

1. **Parsing fidelity:** robust PDF, HWP, HWPX, DOCX and XLSX handling with table and source coordinates.
2. **Numeric reconciliation:** deterministic sum, execution rate and target-achievement calculations; version/date conflict reporting.
3. **Council response assistant:** auto-extract requested fields from an incoming inquiry and fill the response matrix.
4. **Verified legal grounding:** connect legal MCP tools, cite operative provisions and report effective-date uncertainty.
5. **Output fidelity:** generate editable Office/HWP-compatible deliverables.
6. **Institutional readiness:** authentication, enforceable server-side policy, secrets management, evaluation fixtures and auditability.

## Contributing

Please open issues with the browser version, file type, steps to reproduce, expected behavior and observed behavior. **Never attach confidential documents, personal data, credentials or live institutional records.** Contributions should include tests, honest status descriptions and appropriate source attribution.

---

**00AI Workspace is an experimental public-sector productivity project.** It assists trained personnel; it does not replace administrative review, legal judgment, information-security approvals or formal sign-off.
