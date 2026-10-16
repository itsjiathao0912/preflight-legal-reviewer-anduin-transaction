---
name: subdoc-qa-mvp-phase07-pvl-iteration-003
description: Inner PVL cycle 3 report for phase 07 (version diff and sibling comparison)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 3
  phase: "07"
---

# Phase 07 — inner PVL iteration 003

- Cycle 2 re-validate verdict: CONDITIONAL (0 FAIL, 1 CONCERN gap: N3). Gap trend 9 to 2 to 1.
- N3 (core vs worker error ownership): core `diffDocuments` takes per-side inputs `{ok:true, structure, graph, findings} | {ok:false, stage, code}` and returns `{result}` or `{error:{side, stage, code}}`. The worker `prepare(bytes, settings)` maps a thrown CoreError (code only, never message text) to `{ok:false, stage, code}`; the worker wraps with `ms`. Stage vocabulary `read|parse|structure|detect|diff` is its own type `DiffStage`, distinct from `StageId`; `code` = CoreError code or a fixed token.
- Tests: core `diff-input-failure` covers shaping for side a and side b plus "no document text in payload"; e2e assertion 8b covers the worker mapping using a deterministic trigger (HTML nested beyond MAX_PARSE_DEPTH, same hostile shape as `apps/web/e2e/hostile-html.spec.ts`, uploaded through the upload-input flow; E2E fail hook with a `side` param is the fallback only). Never random bytes.
- Contract E17-E20 reflected in the checklist (spans on whole aligned-block raw text then mapped to jsdiff segments; drift-narrative inputs masked+clipped with an assertion; e2e uses upload-input; DiffStage type).
- Fixes applied (SUPPLEMENT_APPLIED, 1 gap). Validate Contract untouched.
- Next: re-validate from V1.
