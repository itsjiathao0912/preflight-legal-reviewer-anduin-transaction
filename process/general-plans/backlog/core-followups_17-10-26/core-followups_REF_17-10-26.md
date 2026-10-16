---
name: core-followups
description: Low-severity follow-ups from the phase 01 independent security review (2026-10-17)
date: 2026-10-17
metadata:
  type: backlog
---

# Core follow-ups (phase 01 review)

| # | Item | Owner phase |
|---|---|---|
| F3 | `ACCOUNT_NUMBER_RE` misses digit runs over 31 digits and alpha-prefixed numbers (IBAN, "ACCT123…") — widen or document | 02 |
| F7 | `DATA_MODEL_CHECK` in memory-label-matrix.test.ts is a hard-coded copy — parse it from DATA-MODEL or keep in sync | 04b |
| F8 | THIRD_PARTY_NOTICES.md: add transitive sax (BlueOak-1.0.0), pako (MIT AND Zlib), jszip (MIT OR GPL-3.0 → elect MIT), dev deps fast-check/typescript/vitest | after 03 (seam), must land before 10 |
| R1 | `detail.explanation` / `detail.facts` (noun_window, first_context) carry short unmasked document text — mask or never persist server-side | 03/04b |
| R2 | The future AI-finding path (`contracts/ai.ts`) must apply the same masking before hashing | 05 |
| R3 | Worst-case 10 MB flat input costs ~3.7 s CPU in the browser engine — keep the Worker body cap and per-request budget | 04a |
| R4 | `payload_too_large` used for a nesting rejection — consider a dedicated code in a future contract version (not v1) | later |
