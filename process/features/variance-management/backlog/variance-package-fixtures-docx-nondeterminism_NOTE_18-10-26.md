---
name: note:variance-package-fixtures-docx-nondeterminism
description: "pnpm package:fixtures regenerates DOCX files with timestamp-only byte differences; make the output byte-stable"
date: 18-10-26
metadata:
  node_type: memory
  type: note
  feature: variance-management
  phase: phase-05
---

# package:fixtures DOCX non-determinism

**Priority:** P3 (harness hygiene).
**Problem:** regenerating package fixtures rewrites the DOCX members with timestamp-only drift, so `git status` goes dirty after the build. Leg 2 had to restore the files before the deploy-pinning check (F4a requires a clean worktree). P05 deviation 8 kept the DOCX bytes at HEAD after regeneration.
**Fix options:** pin the zip entry mtimes (fixed date) in `scripts/src/package/make-package.ts`, or make `fixtures:check` ignore zip timestamps. Add a test that two runs are byte-equal.
