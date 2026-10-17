---
name: note:missing-target-xref
description: "DEFERRED backlog P6-1 missing-target cross-reference detector; feasibility INCONCLUSIVE"
date: 17-10-26
feature: general
---

# Missing-target xref detector (P6-1): DEFERRED 17-10-26

TL;DR: Do not implement before Phase 10. Evidence: `missing-target-xref_FEASIBILITY_17-10-26.md` (verdict INCONCLUSIVE).

## Decision (orchestrator, autopilot design autonomy)

Defer. Nothing is implemented before the final Phase 10 deploy.

## Rationale

- Census over 15 docs: 0 true-missing plain refs in the 12 real samples.
- The 6 true positives (fund fixtures) are already flagged by `broken-conditional`.
- Plain filters F-A/F-B/F-C flood with false positives (13 to 49 on real docs).
- Guarded F-D is tuned in-sample, has about 49% mutation recall and 0 net-new findings.
- Adding it now risks golden/seeded/AI-inputHash drift right before the final deploy.
- Higher-value fixes are upstream structurer and reference issues (see `core-followups_REF` rows P6-1a to P6-1d).

## F-D design constraint (starting point if revived)

- Licenses: a guarded detector (integer-only ref, no heading-like line for N anywhere in the doc, no external or statutory qualifier, at least 3 accepted sections in some scope, dedupe by block against `broken-conditional`), low or medium severity, modest confidence.
- Forbids: plain unresolved or out-of-range filters (F-A, F-B, F-C), sub-letter refs ("4B", "3A", "14A"), docs with fewer than 3 accepted sections, any claim of real-corpus recall, counting fund fixtures as new coverage.
- Uncertain: real-corpus value (0 true positives), out-of-sample precision, recall (~49%), statutory-rule misses to fix first, need for a new seeded fixture with a plain missing xref.
