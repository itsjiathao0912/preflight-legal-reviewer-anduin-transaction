---
name: subdoc-qa-mvp-phase06-pvl-iteration-001
description: Inner PVL cycle 1 report for phase 06 (PDF, DOCX, OCR and precompute)
date: 2026-10-17
metadata:
  type: iteration-report
  domain: plan
  iteration: 1
  phase: "06"
---

# Phase 06 — inner PVL iteration 001

- First-pass verdict: CONDITIONAL (0 FAIL, 7 CONCERN rows, 5 supplement items). Layer 1 and Layer 2 checks ran inline against HEAD fb3cd32.
- Supplement applied all 5 items (see the plan's `### PVL supplement cycle 1 (2026-10-17)`):
  1. Gate commands made runnable and non-vacuous: `fixtures:check` filter form, worker `ocr-prompt-version`, regression via `app-shell` / `finding-highlight` / `structure-view` (no `slice`), `OCR_MAX_REQUESTS` env cap, new `ocr-never-sends-pdf` gate.
  2. D2 reworded probe-first: PATH-04 should flag Partnership/LLC lacking footnote 2 from OCR sup segments; relax `footnote-requirement` only if it does not, OCR-provenance only, with dedupe; golden asserts exactly one finding; no HTML golden changes.
  3. Touchpoints/Blast Radius: `features/home/**` corrected to `features/open-document/**`; added `apps/web/package.json` (conditional on E5 probe: add unpdf/mammoth to web OR re-export via `@aduin/core`), `scripts/package.json`, `pnpm-lock.yaml` (single serialized writer after Phase 05), `harness/phase-06/`; assertions to flip named.
  4. Checklist: B0 (06c-0 library probe) and F1 (06f evidence pack with adversarial scenarios) added; S3 record-only (`ocrPagesPerRequest` stays 1), S4 fits frozen schema; total live cap stays 30.
  5. Verification Evidence: AC3 and AC4 mapped to named assertions in `ocr-position-confidence` and `scan-set-smoke`; single token `ocr-position-confidence`.
- Also recorded: optional `buildDocGraph` source arg; `analyze()` propagation to `engine/types.ts`, `engine/client.ts`, `state/review.ts`; post-Phase-05 re-anchoring of `OCR_PROMPT`/`PROMPT_VER`; Phase 05 client names read from its commit/report.
- Registry: plan's `### Registry update request (Phase 06)` corrected; the orchestrator applies it (registry not edited here).
- Next: re-validate from V1 (expect closure of the 7 CONCERN rows). Open decision carried to EXECUTE: E5 probe outcome decides whether unpdf/mammoth become web deps or are re-exported through core.
