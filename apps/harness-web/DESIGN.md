# 00AI Harness workspace refresh

Figma: https://www.figma.com/design/hNYtD63s9cqvvt50U3biW7

The first view now exposes runner selection, the task and selected documents together. The existing three execution modes, installation scripts, connection controls, execution log, evidence ledger and Markdown download remain available. Files can be dropped or removed; new work resets selected documents and the old result. Pending work prevents duplicate runs. Connection responses cannot overwrite a newly selected runner.

The current agent masks email, Korean mobile phone and resident-number patterns in task text and filenames as well as evidence before HASA calls. This is partial pattern masking, not comprehensive anonymization. Existing installations need the latest installer to receive the change.

Validation: static asset and DOM wiring checks; browser-mode execution logic with real hashing and no network; invalid/oversized file selection; mocked HASA egress test for all three input fields. Figma renders reviewed. No interactive browser session or live external-model generation was performed.
