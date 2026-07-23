# Documentation Issues

Список найденных проблем **без молчаливого «исправления» конфликтов**.  
Hub: [00_START_HERE.md](./00_START_HERE.md)

Спринт Governance: новые hub-docs созданы; старые `docs/business-os/*` **не переписывались** ради унификации формулировок.

---

## Duplicates / overlapping names

| Issue | Detail | Recommendation |
|-------|--------|----------------|
| Two `ARCHITECTURE.md` | [docs/ARCHITECTURE.md](./ARCHITECTURE.md) (OS boundaries map) vs [business-os/ARCHITECTURE.md](./business-os/ARCHITECTURE.md) (Mother tabs / layer overview) | Keep both; always link with role. Hub is canonical for OS boundaries. |
| Metrics docs triad | `METRICS.md`, `METRIC_DEFINITIONS.md`, `METRIC_STANDARD_V1.md`, plus `METRIC_ALIGNMENT_REPORT.md` | Clarify which is SSOT for metric names in a follow-up doc sprint |
| Sync docs | `SYNC.md` vs `SYNC_STANDARD_V1.md` | Standard = norms; SYNC.md = operational notes — label in indexes (done partially) |
| Traffic roadmap | `TRAFFIC_OS_ROADMAP.md` vs `business-os/ROADMAP.md` | Both valid; company roadmap wins for sequencing |

## Possibly outdated

| Doc | Risk |
|-----|------|
| [business-os-architecture-audit.md](./business-os-architecture-audit.md) | Pre-Standard / pre-Traffic OS stack; may conflict with current manifests |
| [conversation-analytics-architecture.md](./conversation-analytics-architecture.md) | Dialog analytics; not wired into Business OS hub narrative |
| Some Traffic audit reports | Snapshot-in-time numbers (Unknown %, revenue coverage) — treat as historical unless re-run |

## Conflicting / ambiguous definitions

| Topic | Conflict | Status |
|-------|----------|--------|
| Mother Traffic canon | Mother still has traffic daily tabs; Traffic OS `traffic_export_v3` cutover **blocked** | Documented as dual-canon; not resolved |
| Prediction placement | Predictive Sales front workbook vs Standard Prediction layer inside Sales OS | Marked legacy placement in SYSTEMS / SPREADSHEETS |
| `GOOGLE_TRAFFIC_SHEET_ID` | Env name says “traffic” but default is **СВОД** marketing book | Naming debt; do not rename without migration sprint |
| Maria vs Bitrix paid | Bitrix = CRM SSOT; Maria = operational paid truth | ADR-005 note; ops must not conflate |

## Broken / missing links (governance pass)

| Item | Notes |
|------|-------|
| Relative links in new hub docs | Written against `docs/` tree; verify after move |
| Deep links into specific sheet tab names | Rely on audits; tabs may renumber — prefer sheet name constants in code |
| Production crontab / sync frequency | Partially missing → [RECOVERY.md](./RECOVERY.md) open items |
| Sheet backup cadence | **Requires clarification** |
| Executive workbook ID | Does not exist → Planned |
| Predictive cuts separate workbook | Discussed in product intent; **Requires clarification** — no formal sprint doc |

## Intentional non-fixes this sprint

- Did not rewrite older audits to match Standard wording  
- Did not rename env vars or sheet numbers  
- Did not delete duplicate-looking docs  
- Did not invent ADRs beyond 001–007 from existing architecture

When fixing: open a dedicated doc-debt sprint; update this file with resolution date.
