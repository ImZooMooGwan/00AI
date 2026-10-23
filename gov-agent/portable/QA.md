# Portable A1 static and manual QA

## Automated static checks completed
- Embedded JavaScript is syntactically valid.
- No fetch, XMLHttpRequest, WebSocket or EventSource, remote JS, remote CSS, fonts or CDN dependencies.
- Folder input uses browser-granted file access.
- Export functions: TXT, HTML, Word DOCX, JSON, print-to-PDF.
- HTML closing tag present.
- Cloudflare production route 00ai.kr/gov-agent* maps to 00ai-gov-agent, with no secret bindings.

## Pending physical acceptance
1. Use Microsoft Edge with network disabled and open downloaded index.html.
2. Select a sample directory with TXT, CSV, XLSX, DOCX and incompatible PDF/HWP.
3. Confirm per-file success/failure labels.
4. Input 50000 and 60000, expect 10000 and 20%.
5. Verify zip package in MS Word or an independent DOCX reader.
6. Print to PDF and visually inspect A4 pages.
7. Inspect browser network panel: 0 outbound requests.
8. Repeat on an institution-managed Windows desktop after IT approval.

Known limits: browser decompression support, legacy HWP/PDF, no persistent file edits, no local language model, no HWPX output. This is A1, not the complete Antigravity agent platform.
