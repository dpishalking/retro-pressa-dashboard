# ADR-003 — Why Mother does not store raw dialog transcripts

- **Status:** Accepted (code comment + OS design)
- **Context:** Dialog workbooks contain full message bodies (PII, volume).
- **Decision:** Transcripts stay in `OS_DIALOGS_SPREADSHEET_ID`. Mother keeps `08_Dialog_Export` as **index/pointer only**.
- **Consequences:** Privacy and sheet size controlled; dialog analytics remain external.
- **Open:** Exact automated writers for dialog index — **Requires clarification** if ops need runbook detail.
- **Refs:** `src/config/os-sheets.ts` · [SPREADSHEETS.md](../SPREADSHEETS.md)
