---
name: plan:counsel-share-link
description: "Demo-grade counsel share link v2: signed 7-day link opens the SAME Findings workspace for counsel (bundled demo package re-run locally, server syncs only state + answers + comments), Mark ready + final DOCX"
date: 19-10-26
feature: none
---

# Counsel Share Link (demo-grade) - PLAN

Complexity: SIMPLE-shaped (one plan, 2 disjoint execute groups). Risk class: **HIGH** (auth/identity: signed link + counsel cookie; schema: migration 0007 bumps schema_version 6 -> 7).

Status: PLANNED, scope changed 2026-10-19 (see Inner Loop Refresh Note). Worker + core partly built (group A mostly DONE); web needs rework (group B). Validate gate CONDITIONAL, known gaps ACCEPTED by user 19-10-26 plus one new gap (uploads not shareable) that needs acceptance.

## Overview

Demo-grade sharing so analyst and counsel work on the same Findings workspace, then hand off to digitization. Counsel sees what the analyst sees: document pane with highlights on the left, findings list and detail panel on the right (Question for counsel, A/B options), gate pill "Blocked · N" in the sidebar. Counsel answers and comments directly on findings.

## Acceptance Criteria

- AC1 Share button (analyst) yields a link valid min(7 d, sandbox expiry). Enabled only when the open document is a bundled demo package or sample; otherwise disabled with "Sharing works for demo packages only." proven by: `counsel-share-mode` unit (button disabled for upload) + worker `counsel-share-token`; strategy: Fully-Automated.
- AC2 Opening the link in a fresh browser + typing a name opens the SAME Findings screen (same package/sample, same findings and ids, document highlights, detail panel) for that workspace only. proven by: stack-memory `stack-memory-counsel-share` (counsel context sees same finding ids as analyst); strategy: Hybrid.
- AC3 Counsel can only answer and comment; every other write route refuses the counsel cookie; cross-workspace access refused; analyst-only actions are hidden in counsel mode and counsel mode never mints a sandbox or writes memory. proven by: worker `counsel-role-scope`, `counsel-cross-workspace`; web unit `counsel-share-mode`; strategy: Fully-Automated.
- AC4 Both sides post comments per finding (anchored to its counsel question); each side sees the other's answers, comments and finding states (needs counsel / closed / accepted) within ~20 s; the gate pill recomputes on both sides. proven by: stack-memory `stack-memory-counsel-share`; strategy: Hybrid.
- AC5 Mark ready (analyst) is enabled only when computeGate is green; it downloads a DOCX with answers + answerer names, writes one `ready_to_digitize` audit_event, pill reads "Ready to digitize". proven by: web unit `counsel-share-mode`, `export-final-docx`; stack-memory spec; strategy: Fully-Automated + Hybrid.
- AC6 Migration 0007 applies; schema_version 7; comments purge with the sandbox; demo workspace refuses comment inserts. proven by: worker `migrations`, `counsel-comment-append-only`; strategy: Fully-Automated.
- AC7 (UI-only, apps/web, unchanged, section F, NOT yet built) A package-aware finding shows one short "Checked against" line on its expanded Findings v2 block. proven by: `checked-against` unit + `intake-checked-against` preview e2e; strategy: Fully-Automated.
- AC8 (new) The server stores no document text: documents are parsed in each browser from the bundled package/sample; the share carries only a doc ref (`package:<id>` or `sample:<NN>`). proven by: worker `counsel-share-token` (doc_ref round trip, bad ref refused) + review of sheet contract (no body text beyond masked snippets already stored); strategy: Fully-Automated.

## Phase Completion Rules

CODE DONE when checklist A and B are done; VERIFIED only when all Test gates in the Validate Contract pass serially (stack-memory included). No deploy implied by VERIFIED.

## Goal

The analyst opens the demo package (Northgate), uses "Ask counsel" on blocking findings, clicks Share, copies the link. Counsel opens it in another browser, types a name once, sees the same Findings screen, answers A/B + note and comments on findings. The analyst sees answers, comments and counsel states within ~20 s on the same findings, closes/answers the rest, the gate pill goes green, "Mark ready to digitize": final DOCX downloads, one audit_event is written, pill reads "Ready to digitize".

Out of scope: realtime/Durable Objects, revoke, login, GP/Fund-admin links, email, Turnstile changes, locking after ready, sharing user uploads, counsel editing finding states other than answering, AI features in counsel mode.

## Research Facts (verified 19-10-26)

- Cookie: `__Host-aduin_v`, claims `SessionClaimsSchema` (frozen v1, `.strict()`, `packages/core/src/contracts/claims.ts`), signed by `signCookie/verifyCookie` (`packages/core/src/session/cookie.ts`), Max-Age = exp - iat (`apps/worker/src/limits/visitor.ts:109`).
- New sandbox cookie exp = sandbox expiry (30 days, `session.ts:173`). The 24 h exp at `session.ts:129-136` is ONLY the degraded read-only visitor path, so there is no real TTL mismatch for sandboxes. The share link (7 d) is bounded by `min(now+7d, workspace.expires_at)`.
- Writes go through `resolveSession` (`apps/worker/src/memory/ctx.ts:92`): liveness (kind='sandbox', active, not expired), `writable(schema_version)` against `EXPECTED_SCHEMA_VERSION='6'` (`memory/health.ts:7`), then per-workspace req claim + global weighted row budget (`MEMORY_WRITE_WEIGHTS`, `platform/index.ts:56`).
- No GET for counsel questions exists; questions are persisted by `POST /api/counsel/questions` (counsel_question has draft/edited text, interpretations_json, finding_key, review_run_id). Quote/section come from `finding` (masked snippet + `section_path`).
- Purge: `PURGE_CHILD_TABLES` (`memory/repo/purge.ts:17`), child-first. Demo blocks: `demo_ro_*` triggers (0002/0005). audit_event has free-text `action` (no CHECK enum).
- Tests: worker `pnpm --filter @aduin/worker test <token>`; web unit `pnpm --filter @aduin/web test <token>`; a real D1 roundtrip in a browser needs the `stack-memory` project (`pnpm --filter @aduin/web test:e2e:stack-memory <token>`, wrangler dev local, migrations applied by `scripts/src/dev-seed.ts`). The `preview` project has no Worker/D1, so the two-browser e2e MUST be a stack-memory spec.

## Design (chosen, v2 2026-10-19)

Server-side pieces that already exist and stay (see Partial-work classification): share token + counsel cookie + route allow-list + comments table + ready + final DOCX. What changes is WHAT counsel sees and WHAT the server syncs.

1. **Document never stored.** Documents are parsed client-side (unchanged). The share binds a **doc ref** to the token and counsel cookie: `package:<id>` (id from `public/samples/packages.json`: hartwell, lotus-bay-asia-ii, northgate-iii, redwood-ridge-i) or `sample:<NN>` (public/samples). Counsel's browser loads the same bundled files and re-runs the deterministic engine locally, so findings, ids (`finding_id`) and fingerprints are identical. If the analyst's open document is not a bundled package/sample (user upload, or a package the user assembled), Share is disabled with "Sharing works for demo packages only."
2. **Server syncs STATE only** (one polled read, `GET /api/counsel/sheet`, ~20 s while the tab is visible, plus once on load and on visibilitychange):
   - needs-counsel state = existence of a `counsel_question` row (created by "Ask counsel" / Share via existing `POST /api/counsel/questions`, analyst only);
   - counsel answers = `counsel_answer` active rows (option + note + answerer name) via existing `POST /api/counsel/answers`;
   - closed / accepted states = the workspace's ACTIVE `decision` rows (already written by the analyst's outbox to `POST /api/decisions`); the sheet returns them as `decisions[]` (additive field, `ActiveDecision` shape, capped 500) and each browser maps them to local findings by fingerprint;
   - comments per question = `counsel_comment`.
   Nothing new is persisted for states: finding_state = decisions + questions. Only addition: read-only `decisions[]` and `doc_ref` in the sheet response, `doc_ref` in the share request, token, counsel cookie and join response.
3. **Overlay, not persistence, in the counsel browser.** Counsel mode loads the package through the normal open path (engine, highlights, Findings v2 panel) but with a `counsel` role flag: `ensureSession`, memory lookup, outbox flush, decision writes, AI lane, upload, export, baseline/version controls and Close issue are all disabled (counsel holds only `__Host-aduin_c`; a normal `POST /api/session` would mint a second sandbox and must never fire). Remote state is merged in memory/triage on each poll: questions -> status `counsel`; decisions (matched by fingerprint) -> closed/accepted display; answers -> counsel answer shown on the finding. Gate pill uses the existing `computeGate` over the overlaid triage, identical code on both sides.
4. **Analyst side** keeps the normal Findings screen. Each poll merges counsel answers (existing `mergeRemoteAnswers`) and adds comments; "Ask counsel" on a finding creates its counsel_question immediately once a share exists (so counsel sees it on the next poll and the analyst can comment on it). Share itself syncs all needs-counsel questions first (existing `syncQuestions`), then mints the link.
5. **Comment anchor decision:** comments anchor to `counsel_question.id` (existing FK in 0007, no migration change). A comment box appears in the finding detail only for findings that have a question (needs counsel). Findings without a question show "Not sent to counsel" and no box; "Ask counsel" creates the question, so the box appears on the next sync. Counsel cannot create questions (no new write surface).
6. **Counsel detail panel** (inside the existing Findings v2 detail/ExpandedBlock, role = counsel): shows the question wording + readings A/B/C, "Answer A/B" + note + typed-name attribution, recorded answer with change option, comment thread + box. Hidden: Close issue, Ask counsel, Upload/Open document, Export, baseline/version controls, AI toggle, rules/memory screens, Questions-screen export.
7. **Share token, cookie, join, ready** unchanged from v1 design (HMAC token with `share|v1|` prefix, `__Host-aduin_c`, fragment link, `POST /api/counsel/join`, analyst-only `POST /api/counsel/ready` writing one `ready_to_digitize` audit row), with `d` (doc ref) added to both signed payloads (backwards: tokens without `d` are refused as `share_bad`).
8. **Dropped:** the server-built reduced Questions sheet as the counsel UI (`CounselModeScreen`, `RemoteQuestionList`). The sheet endpoint stays as the polling endpoint.

## Decision Summary

### Chosen Approach
Signed share token binds a bundled doc ref; counsel's browser re-runs the engine on the same bundled package and overlays server-synced state (questions, decisions, answers, comments) on identical local findings. Smallest server change: one additive field pair on an existing read route.

### Why This Over Alternatives
| Alternative | Why Rejected |
|---|---|
| Store parsed document/findings in D1 for counsel | Breaks "documents never stored"; large schema + privacy surface |
| Server-built reduced Questions sheet (v1) | User changed scope: counsel must see the same Findings canvas |
| Share user uploads by uploading the file | Document storage; out of demo scope (gap accepted) |
| New finding_state table | decisions + questions already carry every state; no migration change |
| Reuse `__Host-aduin_v` for counsel | Edits frozen SessionClaims; replaces counsel's own cookie |

### Risk Predictions
- Fingerprint/id drift between browsers (different engine inputs, e.g. AI findings or a firm tag) would misalign overlays. Mitigation: deterministic findings only in counsel mode (AI lane off), same bundled files; stack-memory spec asserts equal finding id sets; unmatched remote state is ignored, never crashes.
- Counsel browser accidentally mints a sandbox or writes memory (breaks AC3). Mitigation: role flag gates every memory entry point; unit test asserts no `/api/session` or memory write call in counsel mode.
- Security: 7-day bearer link, no revoke (accepted). Counsel scope unchanged: answers + comments of one workspace.
- Data: schema bump 6 -> 7 makes the current live Worker write-incompatible after migration (roll-forward only; no deploy here).
- Testing: two-browser flow only provable in stack-memory (real wrangler + D1).

### Key Constraints Accepted
No revoke; no lock after ready; polling not realtime; counsel name self-declared; demo packages/samples only; counsel sees document text because it is the bundled public sample.

## Partial-work classification (git status at 19-10-26, interrupted build)

Share-link partial work (ours):
- Worker: `migrations/0007_counsel_comment.sql`, `src/memory/{share.ts,ctx.ts,http.ts,health.ts}`, `src/memory/repo/{comment.ts,counsel.ts,purge.ts,workspace.ts}`, `src/routes/memory/{share.ts,counsel.ts,index.ts}`, `src/platform/index.ts`, `src/db/tx.ts` (comment trigger texts), tests `test/memory/{counsel-share-token,counsel-role-scope,counsel-cross-workspace,counsel-comment-append-only}.test.ts`, `counsel-harness.ts`, and edits to `memory-endpoint-contract, memory-guards-matrix, memory-harness, memory-no-cross-firm-or-workspace, memory-write-limits, migrations, query-budget, rows-written` tests.
- Core: `packages/core/src/contracts/counsel-share.ts`, `contracts/memory.ts` (AUDIT_ACTIONS + ready_to_digitize), `src/index.ts`, snapshot `test/__snapshots__/contracts.json-schema.snap`, `test/contracts/contracts.test.ts`.
- Scripts: `scripts/src/dev-seed.ts` (EXPECTED_MIGRATIONS gains 0007; the only scripts/** file that is ours).
- Web (partial): `src/api/counselShareApi.ts`, `src/features/counsel/{counsel-share.ts,share-flow.ts,CounselJoinDialog.tsx,CommentList.tsx,RemoteQuestionList.tsx,counsel-share-mode.test.tsx}`, edits to `CounselScreen.tsx, AnswerForm.tsx, QuestionRow.tsx, export-flow.ts, exportDocx.ts`, `src/main.tsx`, `src/shell/AppShell.tsx`, `src/state/review.ts`, `src/styles/counsel.css`, `test/import-graph.test.ts`, `test/export-final-docx.test.ts`, `e2e/stack-memory-counsel-share.spec.ts`.
- This plan folder.

Other sessions, DO NOT TOUCH: `.DS_Store`, `.claude/launch.json`, `design/mockups/form-preview.html`, `design/mockups/form-preview_NOTES.md`, `process/features/form-preview/`, `process/general-plans/active/{live-demo-qa_18-10-26,openai-provider_19-10-26,option-condition-coverage_19-10-26}/`. The OCR/OpenAI files (`apps/web/src/engine/ocr-queue.ts`, banner-map, ai-banners / auto-downgrade / slice e2e specs, other `scripts/**`) are NOT dirty now (already committed by the other session); still off-limits.

Reuse vs change:
- KEEP as is (group A): migration 0007, share/ctx/http/comment/purge/weights/tx/workspace repo, counsel answer branch, join, ready, comments routes, all worker tests, core `AUDIT_ACTIONS`, dev-seed.
- CHANGE (group A, small, additive): `routes/memory/share.ts` shareHandler takes `{doc_ref}` and puts `d` in the token; `memory/share.ts` signed payloads (token + cookie) carry `d` and verify it against `DOC_REF_RE`; joinHandler returns `doc_ref`; sheetHandler returns `doc_ref` and `decisions[]`; `repo/decision.ts` gets a `listActive` SQL (read, workspace-scoped, LIMIT 500); core `counsel-share.ts` gets the new names below; worker tests extended (token round trip with doc_ref, bad ref refused, sheet includes decisions, counsel sees only own workspace decisions); `query-budget` read cap re-measured.
- KEEP (group B): `counselShareApi.ts` (add doc_ref arg/field), `counsel-share.ts` store + poll + `captureCounselToken` (+ `docRef`, state overlay helpers), `share-flow.ts` (add demo-only guard + doc_ref), `CounselJoinDialog.tsx` (after join, open the doc), `CommentList.tsx` (re-hosted in finding detail), `review.ts mergeRemoteAnswers`, `AnswerForm.tsx` counsel posting, `export-flow.ts/exportDocx.ts` final DOCX, `main.tsx`, `AppShell.tsx`, `import-graph.test.ts`, `export-final-docx.test.ts`, Share / Mark ready / pill / link line in `CounselScreen.tsx` (analyst side), `QuestionRow.questionId`.
- RETIRE (group B): `CounselModeScreen` in `CounselScreen.tsx` and `RemoteQuestionList.tsx` (counsel UI is now the Findings screen); rewrite `counsel-share-mode.test.tsx` and `e2e/stack-memory-counsel-share.spec.ts` for the new flow.

## Touchpoints

Group A (packages/core + apps/worker): see classification. New edits only: `packages/core/src/contracts/counsel-share.ts`, `apps/worker/src/memory/share.ts`, `apps/worker/src/routes/memory/share.ts`, `apps/worker/src/memory/repo/decision.ts`, worker tests listed above, `packages/core/test` snapshot if schema changes.

Group B (apps/web incl. e2e):
- `src/features/open-document/{demo-packages.ts,open-actions.ts,package-actions.ts}`: `docRefOf(doc)` (returns `package:<id>`/`sample:<NN>` only for bundled demo package/sample, else null; if `DocMeta.packageId` can be a user package, add additive `DocMeta.demoRef` set at open time) and `openDocRef(ref)` (opens the same bundled package/sample as the analyst; reuses the existing demo-package / sample open path).
- `src/state/session.ts`, `src/state/memory-sync.ts`: counsel-role guard (no `ensureSession`, lookup, outbox, decision write) when `useShare.role==='counsel'`.
- `src/state/review.ts`: `mergeRemoteStates(questions, decisions)` (in-memory overlay: status `counsel`, closed/accepted display, no outbox, no decision id), keeps `mergeRemoteAnswers`.
- `src/features/review/FindingsScreen.tsx`, `src/features/review/v2/{ActionBar.tsx,ExpandedBlock.tsx,FindingsPanelV2.tsx,use-finding-actions.ts,use-shortcuts.ts}`: counsel role hides Close issue / Ask counsel / reason modal and shows the counsel block (question text, A/B options, note, comment thread via `CommentList`); keyboard shortcuts for analyst actions off in counsel mode.
- `src/shell/{Sidebar.tsx,GateButton.tsx,AiSwitch.tsx,DocSwitcher.tsx,AnalystBadge.tsx,UnsyncedChip.tsx}` and `src/features/registry.ts`: counsel mode nav = Findings only (plus gate pill "Blocked · N"), no Upload, Export, baseline/version controls, AI toggle, Questions export, memory/rules screens. Default route after join = `#findings`.
- `src/features/counsel/{counsel-share.ts,share-flow.ts,CounselJoinDialog.tsx,CounselScreen.tsx,counsel-share-mode.test.tsx}`, `src/api/counselShareApi.ts`.
- `src/features/counsel/` analyst "Ask counsel" while shared: create the question immediately (reuse `syncQuestions`).
- Section F (UI-only, NOT yet built): `src/features/review/v2/checked-against.ts` (new, pure `checkedAgainst(row, pkg)`), its unit test, `ExpandedBlock.tsx` render of `<p data-testid="checked-against">`, `e2e/intake-checked-against.spec.ts`. Rules as in the earlier plan revision: memory label first (`Answered before by ...`, `Dismissed before: ...`), then undefined-term vs reference docs (LPA/PPM names or "No LPA or PPM in package"), then resolved cross-reference doc / "Not in package"; else null. F edits `ExpandedBlock.tsx`, which group B also edits for counsel mode: F is sequenced AFTER B inside group B (same agent).
- E2E: rewrite `e2e/stack-memory-counsel-share.spec.ts`; reuse fixtures `e2e/fixtures/{app,counsel,stack-memory,package}.ts`.

## Public Contracts

Shared names used by BOTH execute groups (group A defines and tests; group B imports from `@aduin/core`; names are fixed here, no renaming):
- `DocRefSchema` / type `DocRef` = string matching `/^(package|sample):[a-z0-9-]{1,40}$/` (`sample:` ids are two digits). Constants `DOC_REF_RE`.
- `CounselShareRequestSchema` = `{doc_ref: DocRef}`; `POST /api/counsel/share` body (was `{}`); response unchanged `CounselShareResponseSchema {token, expires_at}`.
- `CounselJoinResponseSchema` gains `doc_ref: DocRef`.
- `CounselSheetResponseSchema` gains `doc_ref: DocRef` and `decisions: ActiveDecision[]` (max 500; counsel and analyst both receive them; `ActiveDecisionSchema` from `contracts/memory.ts`, matched by `fingerprint`).
- Unchanged and still used: `CounselSheetQuestionSchema` (`finding_id`, `finding_key`, `fingerprint`, `owner`), `CounselSheetAnswerSchema`, `CounselCommentSchema`, `CounselCommentPostSchema`, `CounselCommentListResponseSchema`, `CounselReadyRequestSchema/ResponseSchema`, `COUNSEL_NAME_MAX`, `COUNSEL_COMMENT_MAX`, `SHARE_TOKEN_MAX`, audit action `ready_to_digitize`.
- Web allow-list in `apps/web/test/import-graph.test.ts` gains `DocRefSchema`, `CounselShareRequestSchema`, `DOC_REF_RE` (group B owns that edit).
Routes (all no-store, JSON, existing error shapes): POST /api/counsel/share (analyst), POST /api/counsel/join (token), GET /api/counsel/sheet, GET|POST /api/counsel/comments (analyst or counsel), POST /api/counsel/answers (analyst or counsel), POST /api/counsel/ready (analyst). D1 schema 6 -> 7 (migration 0007 unchanged). Error for a missing/invalid doc_ref: 400 `invalid_request` reason `doc_ref`; old tokens without `d`: 401 `share_bad`.
Counsel cookie accepted ONLY by sheet, answers, comments (unchanged allow-list).

## Blast Radius

~45 files: worker ~14 (mostly built), core 3, web ~22 (reworked), tests/e2e ~8. Packages: apps/worker, packages/core, apps/web. Group A and B file sets are disjoint (B never edits core/worker; A never edits web); the only coupling is the contract names above. No deploy, no Cloudflare calls, no scripts/live changes beyond the already-edited `dev-seed.ts`. Do NOT touch the other-session files listed above, nor `SessionClaimsSchema`.

## Implementation Checklist

A. packages/core + apps/worker (agent A). Items A1-A6 earlier DONE; remaining:
- [x] A1-A6 Worker + schema + routes + purge/weights (done 19-10-26, worker 96 files / 715 tests green).
- [x] A7 Core contracts v1 + `ready_to_digitize` (done).
- [x] A8 Core: add `DocRefSchema`, `DOC_REF_RE`, `CounselShareRequestSchema`; extend `CounselJoinResponseSchema` and `CounselSheetResponseSchema` (`doc_ref`, `decisions`); export from `src/index.ts`; regenerate snapshot additively; extend `contracts.test.ts`. Write failing tests first.
- [x] A9 Worker `memory/share.ts`: add `d` (doc ref) to share token + counsel cookie payloads; verify format; tokens lacking `d` -> `share_bad`. Tests in `counsel-share-token` (round trip, tampered, bad ref, old-shape token refused).
- [x] A10 Worker `routes/memory/share.ts`: shareHandler parses `CounselShareRequestSchema` (400 reason `doc_ref`), joinHandler returns `doc_ref`, sheetHandler returns `doc_ref` + `decisions[]`; `repo/decision.ts` `listActive` (workspace-scoped, LIMIT 500, added to the id-scoped SQL lint list). Tests: counsel cookie reads decisions of its own workspace only; sheet shape matches schema.
- [x] A11 Re-measure `query-budget` (sheet read count) and keep `rows-written` unchanged (reads only); update `memory-endpoint-contract`. Run worker gates serially (one token per call).
- [x] A12 Handoff to B: after A8-A10 are green, write nothing further; B pulls the names from `@aduin/core`.

B. apps/web incl. e2e (agent B; can start on UI structure immediately using the fixed contract names, integrate once A8 lands in `packages/core` source - same monorepo, no publish step):
- [x] B1 Write failing unit tests first (`counsel-share-mode.test.tsx` rewritten): share disabled for upload with the reason text; counsel mode renders the Findings screen (not CounselModeScreen) with analyst actions absent; counsel detail shows A/B + note + comment box for a finding with a question and "Not sent to counsel" without; no `/api/session`, lookup, decision or outbox call in counsel mode; Mark ready disabled until gate green; overlay merges question/decision/answer state by finding id/fingerprint and ignores unmatched.
- [x] B2 `docRefOf` / `openDocRef` (open-document module); share-flow guard + pass `doc_ref`; `counselShareApi` types for new contracts.
- [x] B3 Counsel-role guard in `memory-sync.ts` / `session.ts` / `review.ts` (no session mint, no writes, AI lane off); `mergeRemoteStates` overlay; poll hook drives both roles.
- [x] B4 `CounselJoinDialog` -> after join store `docRef`, open it with `openDocRef`, set route to Findings, strip fragment (existing). If the bundle cannot open the ref: plain message "This link points to a document that is not available."
- [x] B5 Findings v2 counsel mode (hide analyst-only actions listed in Touchpoints; counsel block in the detail; `CommentList` re-hosted; analyst sees counsel answers/comments on the same finding; shortcuts off).
- [x] B6 Shell counsel mode (Sidebar/GateButton/AiSwitch/DocSwitcher): Findings only, gate pill recomputes from overlay; keep sidebar pill "Blocked · N".
- [x] B7 Analyst: "Ask counsel" creates the question immediately once a share exists; Share/Mark ready/pill/link line (existing) wired to the new flow; Mark ready -> final DOCX + `/ready` (existing).
- [x] B8 Remove `CounselModeScreen` + `RemoteQuestionList` (retire); css cleanup in `counsel.css`; update `import-graph.test.ts` allow-list.
- [x] B9 (DROPPED by user scope change 19-10-26: no e2e; old v1 spec deleted, none written) Rewrite `e2e/stack-memory-counsel-share.spec.ts` (see Verification Evidence).
- [ ] B10 (SKIPPED: Section F is unrelated to the share link; left for a separate plan) Section F (after B5): F1 failing unit tests `checked-against.test.ts`; F2 `checked-against.ts`; F3 wire into `ExpandedBlock.tsx`; F4 `e2e/intake-checked-against.spec.ts` (hartwell package, "Stock" undefined-term finding contains the LPA file name and "not defined there"; verify names against `e2e/fixtures/package.ts` first). No Worker/core change.
- [x] B11 Web gates serially: unit tokens, `findings-v2-panel-ui`, preview e2e (`intake-checked-against`, `findings-v2`), then stack-memory spec; typecheck, lint.

Final (orchestrator-spawned after A+B): full worker, web unit, preview e2e, stack-memory, `pnpm --filter @aduin/core test`, typecheck, lint, `pnpm guard:cf`, `pnpm secrets:scan`, serially.

## Verification Evidence

Fully-automated (worker, one token per call, `pnpm --filter @aduin/worker test <token>`): `migrations`, `counsel-share-token`, `counsel-role-scope`, `counsel-cross-workspace`, `counsel-comment-append-only`, `rows-written`, `query-budget`, `memory-endpoint-contract`. Core: `pnpm --filter @aduin/core test contracts`. Web unit: `pnpm --filter @aduin/web test <counsel-share-mode|export-final-docx|checked-against|findings-v2-panel-ui>`. Preview e2e: `pnpm --filter @aduin/web test:e2e intake-checked-against`, `findings-v2`.

Hybrid stack-memory (precondition: no `apps/worker/.dev.vars`, run serially after preview): `pnpm --filter @aduin/web test:e2e:stack-memory stack-memory-counsel-share`. Scenario: (1) analyst context opens the Northgate demo package (`northgate-iii`), runs the engine, uses "Ask counsel" on every blocking finding, clicks Share, reads the link (the Share button is disabled on an upload: asserted in unit, not e2e). (2) Second browser context (different cf-connecting-ip, no analyst cookie) opens the link, enters a name, lands on the Findings screen; asserts same set of finding ids as the analyst, document pane with highlights present, gate pill "Blocked · N" equal, analyst-only controls absent, no `__Host-aduin_v` cookie created. (3) Counsel answers every blocking question (A/B + note) and posts one comment. (4) Analyst (poll interval shortened by the existing e2e flag, or reload) sees the answers and comment on the same findings, closes/answers the rest, gate turns Ready. (5) Mark ready downloads a DOCX containing the counsel name; audit shows exactly one `ready_to_digitize`; counsel context calling `/api/counsel/ready` is refused.

| Gate / Scenario | Strategy | Proves SPEC criterion |
|---|---|---|
| worker tokens (migrations, counsel-share-token, counsel-role-scope, counsel-cross-workspace, counsel-comment-append-only, rows-written, query-budget, memory-endpoint-contract) | Fully-Automated | AC1, AC3, AC6, AC8 |
| core contracts snapshot (`contracts`) | Fully-Automated | AC8 |
| web unit counsel-share-mode, export-final-docx | Fully-Automated | AC1, AC3, AC5 |
| stack-memory stack-memory-counsel-share | Hybrid | AC2, AC4, AC5 |
| web unit checked-against | Fully-Automated | AC7 |
| preview e2e intake-checked-against | Fully-Automated | AC7 |
| manual two-browser look at counsel mode (same canvas, no analyst buttons) | Agent-Probe | AC2, AC3 |

Known-Gap (residual, not a proving strategy; gate stays CONDITIONAL): live workers.dev proof; token theft within 7 days; uploads cannot be shared. Backlog stubs: `process/general-plans/backlog/counsel-share-live-proof_NOTE_19-10-26.md` and `counsel-share-uploads_NOTE_19-10-26.md` (execute-agent writes them).

## Test Infra Improvement Notes

(none identified yet) Candidate: a shared two-context helper in `e2e/fixtures/stack-memory.ts` (second browser with its own IP) if the rewritten spec needs it in other specs.

## Resume and Execution Handoff

Selected plan: this file. Two parallel execute agents (opus), disjoint blast radius, strategy agent-team (TeamCreate + shared task list + SendMessage so A can tell B when A8-A10 contracts are in the tree):
- Agent A = `packages/core` + `apps/worker` only (checklist A8-A12). Never edit apps/web.
- Agent B = `apps/web` incl. `apps/web/e2e` only (checklist B1-B11). Never edit core/worker. Imports the shared names from `@aduin/core` (names fixed under Public Contracts).
Resume point = first unchecked item per group. Sequencing: A8 before B3/B4 can compile against real schemas; B1/B2/B5-B8 UI work can start in parallel. Final regression after both report DONE. Deploy is a separate later step needing user approval, migration 0007 Time Travel bookmark + SQL export first, roll-forward only (`process/context/worker/all-worker.md`); another session currently deploys, so do not deploy or call Cloudflare. No git stash/checkout/reset. Plan validator: `node .claude/skills/vc-generate-plan/scripts/validate-plan-artifact.mjs <this file>`.

## Inner Loop Refresh Note

Date: 2026-10-19. Scope change from the user (demo-grade, keep it simple): the share link now shares the WHOLE Findings workspace canvas, not a reduced Questions view. Changed: Design (doc ref in token, counsel re-runs engine locally on the bundled package, server syncs state only, overlay), Touchpoints, Public Contracts (+`doc_ref`, `decisions[]`, share request body), Checklist (two disjoint groups A and B), Verification Evidence (new stack-memory scenario), Acceptance Criteria (AC1-AC5 reworded, AC8 added). Kept: signed link, `__Host-aduin_c`, route scoping, migration 0007 (comments anchored to `counsel_question.id`), Mark ready + final DOCX + audit event. Dropped: counsel's Questions-sheet UI (`CounselModeScreen`, `RemoteQuestionList`). New accepted-gap candidate: user uploads are not shareable. Section F unchanged and still unbuilt. Interrupted build: partial code classified above.

## Validate Contract

generated-by: inner-pvl: refresh 2026-10-19
date: 2026-10-19
Date: 19-10-26
Gate: CONDITIONAL
Validation mode: plan-agent self-check V1-V7 (brief). Orchestrator may re-run a full vc-validate-agent before EXECUTE (HIGH risk class).

V1 structure: PASS (all required sections present). V2 layers:
| Layer | Status | Note |
|---|---|---|
| Infra fit | PASS | No new binding; additive fields on existing read route; migration 0007 unchanged |
| Test coverage | CONCERN | Two-browser same-canvas flow only provable in stack-memory; poll interval shortened for e2e |
| Breaking changes | CONCERN | schema 6 -> 7 write-incompatible with live Worker after migration (roll-forward only; no deploy here) |
| Security | CONCERN | 7-day bearer link, no revoke; counsel cookie allow-list unchanged; counsel mode must never mint a sandbox cookie (new test) |
| Data flow | CONCERN | Fingerprint/id equality across browsers is assumed from determinism; asserted in e2e; unmatched remote state ignored |
| Scope/contracts | PASS | Shared names fixed; A and B file sets disjoint |
V3 synthesis 0 FAIL / 4 CONCERN. V4 strategy: agent-team, 2 opus execute agents (A, B), sonnet for tester/reviewers. V5 user acceptance: previously accepted gaps (1) no revoke, (2) local-only proof, (3) roll-forward-only deploy (user, 19-10-26, verbatim in git history of this plan); NEW gap (4) uploads not shareable ("Sharing works for demo packages only") stated by the user in the scope message, accepted by design. V6 gate stays CONDITIONAL with gaps 1-4 accepted. V7 no SUPPLEMENT REQUEST outstanding.

Execute-agent instructions:
- E1 Group A first writes failing tests, then code; never guess weights or query budgets (measure).
- E2 Group B: counsel mode must not call `ensureSession`, memory lookup, outbox, decision/answer writes other than `POST /api/counsel/answers` and `/comments`; AI lane off; assert in unit test.
- E3 Counsel UI is the Findings screen (v2 panel + document pane); delete `CounselModeScreen`/`RemoteQuestionList`.
- E4 Poll interval configurable (default 20000 ms); e2e uses the existing e2e flag or reload.
- E5 Do not edit `SessionClaimsSchema`, files of other sessions (see classification), or other plan folders. No git stash/checkout/reset. No deploy, no Cloudflare calls.
- E6 `crypto.subtle.verify` for MACs; tokens > 1024 chars rejected before decoding.
- E7 Section F touches only the web files named under Touchpoints; run after B5 in the same agent.
- E8 Write the two backlog stub notes named under Verification Evidence (Known-Gap residuals).

Test gates: worker tokens `migrations counsel-share-token counsel-role-scope counsel-cross-workspace counsel-comment-append-only rows-written query-budget memory-endpoint-contract`; core `contracts`; web tokens `counsel-share-mode export-final-docx checked-against findings-v2-panel-ui`; preview e2e `pnpm --filter @aduin/web test:e2e intake-checked-against`; stack-memory `stack-memory-counsel-share`; then full suites serially + typecheck, lint, guard:cf, secrets:scan.

## Deviations (EXECUTE, Agent A, 19-10-26)

- Core: `AUDIT_ACTIONS` (frozen v1 enum) gained `ready_to_digitize` (additive; contracts snapshot regenerated, only that enum + the new counsel-share module changed). Needed because `GET /api/audit` drops unknown actions, so AC5 "audit shows ready_to_digitize" was otherwise impossible.
- Share token and counsel cookie also carry `a` (the sharing analyst id): `decision.decided_by_analyst_id` has an FK to `analyst`, so counsel answers are attributed to the sharer's analyst row with `decided_by_name = "Counsel: <n>"`, `answered_by_name = <n>`.
- Counsel answers ignore body `quote_text` (counsel has no document): the quote hash/snippet come from the persisted finding, else the prior active decision; neither -> 400 `quote_unavailable`. Fingerprint must still equal the question's (422 otherwise).
- Cross-workspace / unknown question returns 400 `invalid_request` reason `question_not_found` (not 404): the frozen error-code set has no 404 code; matches the existing answer route.
- Join writes nothing (no audit row, no weight); share writes nothing. Comment cap error = 429 `quota_exhausted` reason `comment_cap` as planned, plus a `comment_cap` trigger backstop in 0007.
- When both cookies are present on the 4 counsel routes, a valid counsel cookie wins (documented in `memory/ctx.ts`).
- `query-budget` cap `session_with_purge` 30 -> 31 (one more purge DELETE); `scripts/src/dev-seed.ts` EXPECTED_MIGRATIONS gains '0007' (hard-coded list, per E1).

## Deviations (EXECUTE, Agent B, 19-10-26)

- Scope change from the user mid-run: no e2e. B9 dropped (the v1 `e2e/stack-memory-counsel-share.spec.ts` deleted, no new spec); preview and stack-memory gates not run. Verification = web unit tests, typecheck, lint. AC2/AC4 (two browsers, same canvas, ~20 s sync) are therefore proven only by unit tests of each part, not end to end.
- B10 (Section F, "Checked against") skipped: unrelated to the share link.
- Role flag lives in a new leaf module `src/state/share-role.ts` (not in `session.ts`) so the memory client, outbox and review store can read it without importing the counsel feature (no import cycle). `memoryApi()` returns null, `outbox()` returns null, `ensureSession()` resolves at once and `writesDisabled()` is true in counsel mode.
- Open question 1 (`DocMeta.packageId` for user-built packages): `packageId` is the stored package row id for every package, so it cannot name a demo. Resolved with `demo-refs.ts`: `runPackageDraft` remembers `packageId -> package:<demoId>` when the draft came from the Demo list (tab sessionStorage, survives reload). No `DocMeta.demoRef` field was added. Limit: a demo draft the analyst edited before running still counts as that demo.
- Open question 2 (`writeTriage` and the outbox): `writeTriage` only writes IndexedDB triage, never the outbox. In counsel mode it skips that write too; counsel triage is rebuilt in memory from each sheet (`mergeRemoteStates`, then `mergeRemoteAnswers`).
- Counsel mode keeps the session in tab sessionStorage (name, expiry, doc ref) so a reload re-enters counsel mode and re-opens the shared document; the App skips the analyst restore, quota fetch and last-doc save in counsel mode.
- Comments and the shared answer show in the finding detail for both roles (`FindingCounselBlock`); only counsel gets the Answer button. Analyst Questions screen keeps its existing thread per question.
- The analyst "Ready to digitize" pill is also shown in the Findings header (both roles).
- (A8-A11, 19-10-26) The analyst holds no share state server-side, so `GET /api/counsel/sheet` takes `?doc_ref=<ref>` for the ANALYST cookie (400 `invalid_request` reason `doc_ref` when missing/invalid); counsel gets `doc_ref` from its signed cookie (`d`) and the query is ignored. Group B must send `doc_ref` on the analyst poll.
- Tokens/cookies with no or invalid `d` fail as 401 reason `share_invalid_claims` (the `share_*` family; plan text said `share_bad`).
- `decisions[]` includes the sandbox copy's seeded demo decisions (all workspace-scoped, active). `counsel_sheet` query budget measured at 6 and added to `query-budget` CAPS. `scripts/src/dev-seed.ts` self-check now expects schema_version 7.

## Next Instruction

Context read for this plan: `process/context/all-context.md`, `ui/all-ui.md`, `worker/all-worker.md`, `tests/all-tests.md` (post-phase testing = serial gates above). Next: re-run VALIDATE (ENTER VALIDATE MODE) if the orchestrator wants a full V1-V7, then ENTER EXECUTE MODE with this plan path for agents A and B.
