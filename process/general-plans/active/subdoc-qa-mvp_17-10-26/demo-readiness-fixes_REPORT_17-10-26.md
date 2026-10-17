---
name: demo-readiness-fixes
description: Five demo-readiness fixes on the live sub-doc QA app (gate severity on real samples, neutral no-document gate pill, Partners Group demo seed, fit scores out of finding text, Compare copy); repo only, no deploy
date: 2026-10-17
metadata:
  type: report
  phase: demo-readiness
  status: COMPLETE
---

# Demo-readiness fixes (17-10-26)

**Bottom line:** all 5 fixes are in the repo and every gate is green except `prettier --check` on `README.md`, which is design-owned and was already unformatted at HEAD. Real sample #5 now opens as **Blocked · 2** with no forced severity. Nothing deployed, no live D1 writes, nothing committed.

**Seed warning for the walkthrough/design session:** the approved demo seed (`sd06`, `sd07`) records counsel answer **A** on both swapped Part B references on #3. #5 has the same quotes, so it gets the same fingerprints. Once the live D1 is reseeded, #3 and #5 both open with those critical items marked "already answered" and the gate shows **Ready**. That is correct behavior: counsel answered, and the answer carries over. To show Blocked live, either open the sample before reseeding (stub/no-memory), or reopen `sd06`/`sd07` in Memory inside a sandbox; the refs then come back as New and the gate reads Blocked · 2. The spec was not changed, because the 7 decisions were user-approved.

## Item 1: gate on real samples (decision + evidence)

**Decision:** a broken cross-reference is **critical** when it sits in a routing context, otherwise **high**. A routing context is one of:
- an `instructions` scope
- an answer option (block kind `option` or a member of an option group)
- a block that hosts a conditional

Implemented as `refRoutingContext()` / `refSeverity()` in `packages/core/src/detectors/util.ts` and used by `ref-label-coherence` and `ref-this-section`. Each finding records the context as fact `routing_context`. AI findings still never gate, and `computeGate` is unchanged (critical-only).

**Evidence (engine probe over the 12 HTML samples):**

| Sample | Finding | Context | Before | After |
|---|---|---|---|---|
| #3, #5 | "Custodian indicated in Part B of Section 6" | instructions scope, option block (☐ delivery instruction) | high | **critical** |
| #3, #5 | "amount specified in Part B of Section 4" | instructions scope, option block (☐ wire instruction) | high | **critical** |
| #1 (x2) | "this Section 11" inside Section 12 (Qualified Client Status) | body list item; no option, no conditional | high | high (kept) |
| others | no broken-cross-reference findings | | | |

**Why #1 stays high:** it is a representation paragraph in the body. The investor still answers Section 12's own tests, so the wrong pointer is a drafting error to fix, not a form mis-route. README and demo copy may say "the gate blocks on real samples #3 and #5", but not "on #1".

**Ripple (each count change explained):**
- Goldens: in `golden-03-05`, 4 findings changed high to critical (2 per doc), and the test now asserts `routing_context: 'instructions'`. In `golden-01`, the 2 findings stay high and the test asserts `routing_context: 'none'`. No finding counts changed.
- Unchanged:
  - corpus (13), seeded matrix
  - fund fixtures (6/8/8, 62.5%; `fixtures:check` OK)
  - finding ids, fingerprints and pattern keys (none depend on severity or explanation)
  - AI candidates, which use only the anchor and class, so `record:author --check` and `precompute:ai --from-recordings --check` stay OK and no inputHash moved
  - memory label rule: `isBlocking` already covered both high and critical
- e2e, preview project:
  - `filter-sort` "keep filter state after reload" now uses the Blocks chip, because the #3 goldens moved from Fix to Blocks.
  - In `gate-pill`, the popover test forces only its one target finding to critical and every other finding to high; its old assumption that everything else was high no longer held.
  - New `gate-pill` test: real #5 is Blocked · 2 with no forcing.

## Item 2: gate pill with no document
- New pure view `apps/web/src/features/gate/gate-pill.ts`. With no document open, the pill reads "No document" in neutral `.gate.none` styling (`--panel` / `--ink-3`, doc icon, no count). The popover says "No document open" and lists no reasons. Ready only shows once a document is open and nothing blocks.
- `GateButton.tsx` uses the new view and exposes `data-gate-state` (`none|ready|blocked`).
- Tests:
  - unit: `apps/web/test/gate-pill.test.ts` (3 tests)
  - e2e: new `gate-pill` test, no document = neutral, then #6 = Ready

## Item 3: Partners Group seed (repo part)
- `seed:gen` now always builds `apps/worker/seed/demo.sql` from `fixtures/memory/demo-seed-spec.json`: 7 decisions, 1 proposed rule `sr01`, 3 analysts.
- It also writes the new `apps/worker/seed/test-seed.sql` from `_test-seed-spec.json`. That file is byte-identical to the old `demo.sql`.
- The Worker vitest config now loads `test-seed.sql`, so the 525 Worker tests run on an unchanged fixture. The deployed seed is covered by the `stack-memory` e2e project, which uses `demo-seed-spec`.
- `seed:check` requires each file to record its own spec (`demo.sql` must record `demo-seed-spec.json`) and diffs both files against the generator.
- New guard `scripts/test/demo-seed-fingerprints.test.ts`: reads the (firm, fingerprint) pairs from the generated `demo.sql` and asserts each one equals a core `fingerprintFor` result for a finding in a bundled HTML sample. The 7 of 7 match after the item 1 changes.

## Item 4: fit scores out of finding text
- `ref-label-coherence` explanation is now: `"agreement custodian" is said to be in Part B of Section 6, but that target is "Investment amount"; it fits Section 4 (CUSTODIAN INFORMATION) better.`
- `cited_overlap` / `expected_overlap` stay in facts ("Why it was flagged").
- Fingerprint, id and pattern_key do not use the explanation text. The golden asserts the exact text and the absence of `fit <digit>`.

## Item 5: Compare copy
- The code condition is `counselEnabled = !!current.findingId && openFindingIds.has(current.findingId)`, i.e. the row is linked to a finding of the open document.
- New copy: "Only changes linked to a finding in the open document can be sent to counsel." The `diff-pairs` e2e assertion is updated to match.

## Gate results (serial, one token per call, no `--`)

| Gate | Result |
|---|---|
| core whole | 76 files / 2914 passed |
| core test:corpus | 13 passed |
| worker whole | 65 / 525 passed |
| web unit whole | 31 / 226 passed (+3 gate-pill) |
| scripts whole | 16 / 152 passed (+2 demo-seed-fingerprints) |
| seed:check / fixtures:check | OK / OK |
| record:author --check / precompute:ai --from-recordings --check | OK (11 cases) / exit 0 |
| preview e2e whole | 175 passed, 1 opt-in skip |
| stack-memory whole (after preview) | 10 passed |
| typecheck / eslint | 0 / 0 |
| prettier --check | only `README.md` (design-owned, unchanged by me, already failing at HEAD) |
| guard:cf / secrets:scan | OK / OK |

## Live reseed procedure (NOT run; for the later live step)

**Why it needs a purge script.** `demo.sql` is plain INSERTs; it is not idempotent and deletes nothing. Six triggers always block deleting ws_demo rows: `decision_no_delete` and `audit_no_delete` (a demo workspace can never be `purging` because of a CHECK constraint), plus `demo_ro_workspace_delete`, `demo_ro_firm_rule_delete`, `demo_ro_rule_evidence_delete` and `demo_ro_analyst_delete`.

**What the purge script does.** `reseed-demo-purge.sql` (in the session scratchpad):
1. sets seed_mode=1
2. drops those 6 triggers
3. deletes only `workspace_id = 'ws_demo'` rows (audit_event, rule_evidence, firm_rule, decision, analyst, workspace)
4. recreates the 6 triggers, verbatim from migrations 0002/0005 (diff-checked)
5. sets seed_mode=0

**What happens to sandboxes.** They are untouched. Existing sandboxes keep their old Firm X copies until they expire; new sandboxes copy the new seed.

**Local dry run** on sqlite (migrations + old seed + a sandbox row, `-bail`, foreign keys on):
- after: partners-group 7 decisions, `sr01` proposed
- sandbox row intact, seed_mode 0
- trigger count 40 (same as a fresh migrate)
- a ws_demo delete afterwards is refused again (`decision_append_only`)

```bash
cd /Users/itsjiathao_/Skylab/itsjiathao/aduin-transaction/apps/worker
set -a; source ~/.config/cloudflare/credentials.env; set +a
S=/private/tmp/claude-501/-Users-itsjiathao--Skylab-itsjiathao-aduin-transaction/08d15510-3fa2-4a03-add1-62cb1b9c2eeb/scratchpad
# (a) backup the whole remote DB
pnpm exec wrangler d1 export aduin-transaction-db --remote --output "$S/d1-backup-before-reseed.sql"
pnpm exec wrangler d1 execute aduin-transaction-db --remote --json --command "SELECT law_firm_id, count(*) n FROM decision WHERE workspace_id='ws_demo' GROUP BY 1" > "$S/before-counts.json"
# (b) purge ws_demo rows only (drops/recreates the 6 demo delete guards)
pnpm exec wrangler d1 execute aduin-transaction-db --remote --file "$S/reseed-demo-purge.sql"
# (c) apply the new Partners Group seed
pnpm exec wrangler d1 execute aduin-transaction-db --remote --file seed/demo.sql
# verify
pnpm exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT law_firm_id, count(*) FROM decision WHERE workspace_id='ws_demo' GROUP BY 1; SELECT id, status FROM firm_rule WHERE workspace_id='ws_demo'; SELECT value FROM app_meta WHERE key='seed_mode'; SELECT count(*) FROM sqlite_master WHERE type='trigger'"
# expect: partners-group 7 | sr01 proposed | seed_mode 0 | 40 triggers
```

**If step (c) fails** after (b), ws_demo is empty but the protections are restored. Fix the error and re-run (c). If anything else goes wrong, restore from `d1-backup-before-reseed.sql`.

## Follow-ups
- Design session: README/demo copy. "Gate blocks on real samples" is true for #3/#5 without memory. With the live seed, #3/#5 show counsel's prior answer and Ready (see the seed warning at the top). Walkthrough §12 items 1/2/3/5/6 are addressed in code.
- Design session: `README.md` fails `prettier --check`.

TL;DR: swapped instruction refs on #3/#5 are now critical (#1 stays high, with the reason recorded); the gate pill is neutral with no document; the deployed seed is the Partners Group spec with a fingerprint guard; fit scores are gone from finding text; the Compare copy matches the code. The live reseed steps are above and were not run.

## Live reseed + redeploy (17-10-26, done)

**Result: the live demo D1 now holds the Partners Group seed, and HEAD (incl. 0a67dc4) is deployed. All smoke checks passed.**

- **Pre-checks:** every DELETE in the purge script is scoped to `ws_demo` (6 of 6). The 6 recreated triggers match migrations 0002/0005 after whitespace normalisation. A local sqlite dry run (migrations + old test-seed + fake sandbox, `-bail`, foreign keys on) gave partners-group 7, sr01 proposed, seed_mode 0, 40 triggers, sandbox row intact, and a later ws_demo DELETE was refused with `decision_append_only`.
- **Backup:** `/private/tmp/claude-501/-Users-itsjiathao--Skylab-itsjiathao-aduin-transaction/08d15510-3fa2-4a03-add1-62cb1b9c2eeb/scratchpad/d1-backup-before-reseed.sql` (43,702 bytes, session scratchpad, not in the repo).
- **Time-travel bookmark (rollback):** `00000012-00000000-00005107-de7c068d1119cc2380fc35859211b3c5`.

| Check | Before | After |
|---|---|---|
| ws_demo decisions by firm | firm-x 6, firm-y 1, partners-group 1 | partners-group 7 |
| ws_demo firm_rule | sr01 active, sr02 proposed, sr03 active | sr01 proposed |
| workspaces | 1 demo, 0 sandbox | 1 demo, 0 sandbox |
| triggers | 40 | 40 |
| seed_mode | 0 | 0 |

- **Delete guard:** no real DELETE was run on live data. Instead, the SQL of all 6 delete guards was read back from the live `sqlite_master` and matches the migration text.
- **Deploy:** guard:cf OK, secrets:scan OK, plain web bundle with the Turnstile site key, deploy:preflight OK (13 of 13 PASS). Ran `wrangler deploy` with the plain config: workers.dev only, no routes, existing cron `17 3 * * *`. **Version `47d98295-c583-4dc0-9f96-f9e161c8cf35`.** Rollback target: `23612b12-51c7-4d75-a324-f4f2f6392ba8`.
- **Smoke** (headless, /api/ai, /api/ocr and /api/session aborted; the spec made 0 such calls; 0 page errors):
  - no document open: gate reads "No document"
  - sample #5: first findings in about 1.1 s, 7 rows, gate "Blocked · 2" (no memory without a session)
  - no finding row contains "(fit"
  - Compare 5 vs 6: the new disabled-button copy appears (1 element) and the old "Available after counsel sheet" copy is gone
  - `/` carries a CSP; `GET /api/health` returns `cache-control: no-store` (a HEAD request returns 404)
  - `/api/memory/health`: schema_version 5, seed_mode 0, seed_version 1
  - stack project against the live URL: 1 passed
