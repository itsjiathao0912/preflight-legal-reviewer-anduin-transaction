# Variance management, slim MVP (V1 + V2), folded into the approved shell

File: `design/mockups/app-variance.html` (copy of `app.html`, extended; one file, inline CSS/JS in one IIFE, Google Fonts only). `app.html` is untouched. Same tokens, icon sprite, 4px radius, serif for document text and headings, Geist for UI. Hash routes, storage guards and "route never persisted" are unchanged.

**Scenario (fictional):** Hartwell & Crane LLP, "Northgate Infrastructure Fund III" reviewed against the baseline "Fund II (2025)". 214 raw changes become 7 that matter (3 New, 4 Logic) plus 206 cosmetic (hidden).

## Slim MVP (V1 + V2)
In scope: V1 classification of what changed vs a baseline, V2 impact from the logic graph, owner routing, intent capture, one regression example, a 2-state gate. Zero new screens and zero new sidebar items.

| Capability | Where it lives |
|---|---|
| Change list | **Findings**: `All · Errors 8 · Changes 7`. A change row = type chip (New / Logic) + title + owner chip + status icons |
| Cosmetic changes | **Findings → Filter**: "Show cosmetic changes (206)", off by default (5 grouped rows when on) |
| Old vs new | Expanded change row: Fund II above Fund III (stacked, 400 px column), word marks by strike-through vs bold underline (never colour alone) |
| Impact (V2) | Expanded row: investor types, paths, "Old form rule reusable". Labelled "from the logic graph · deterministic" |
| Owner routing | Owner chip on the row; "Suggested owner" select (changeable) with a one-line reason |
| Actions | Ask owner (was Needs counsel), Mark as expected… (Dismiss modal, reason required), Open in Compare |
| Baseline | Findings header "vs Fund II (2025) ▾" opens a modal: prior funds and prior versions of the same firm (same firm only), suggested item pre-checked, error only on submit |
| No prior documents | Modal shows "No earlier documents from this firm. This review becomes the baseline." Findings then shows Errors only plus one muted line "First review: this document becomes Hartwell & Crane's baseline." Reached through a collapsed "Demo: simulate a new law firm" control in the modal (the only demo control left) |
| Questions | Existing **Questions**: `All · Counsel 3 · GP 2 · Fund admin 1`, owner sections, "Export for <owner> (DOCX)" per owner |
| Record answer | Modal: option (default marked), note, "Why is it written this way? (intent)", scope This fund only / Firm template (one muted regression-preview line; intent required for Firm template) |
| Regression example | One finding, R-01 "Appendix C is referenced but missing", labelled "Regression: confirmed in Fund II", in Findings (hidden in the no-history case, since it needs the firm's memory) |
| Gate | Sidebar pill: **Blocked · N** / **Ready to digitize** (icon + words). Popover lists reasons grouped by owner (list only) |

## Gate logic (2 states)
- **Blocked · N**: N = open blocking errors + untriaged New or Logic changes (yours to decide) + asked questions without a clear answer (including the prior-fund item "Eligible Investor defined twice"). Answer "unclear" stays blocked.
- **Ready to digitize**: N = 0.
- Cosmetic changes never block.
- Seed: Blocked · 12 (5 to decide + 7 waiting). The popover groups: You 5 · Counsel 3 · GP 2 · Fund admin 1 · Earlier funds 1.

## Counts that must agree (all derived from one list)
| Where | Value in the seed |
|---|---|
| Findings segment | Changes 7 (active, non-cosmetic), Errors 8 |
| Findings header | 6 errors open · 3 changes to review |
| Sidebar badges | Findings 9 (open), Questions 6 |
| Questions owner tabs | Counsel 3 · GP 2 · Fund admin 1 (unanswered) |
| Gate popover | You 5 · Counsel 3 · GP 2 · Fund admin 1 · Earlier funds 1 = Blocked · 12 |

## Deterministic vs AI
| Part | Source |
|---|---|
| Diff, classification (New / Logic / cosmetic) | Deterministic (VAR-01, VAR-COS-xx) |
| Impact | Deterministic, from the logic graph and investor paths. Said in the UI |
| Suggested owner | Deterministic routing table (config); analyst can override |
| Regression check R-01 | Deterministic (MEM-REG-01) |
| Gate | Deterministic |
| Question wording | Template draft by default; AI draft only where cached (existing). Intent is human-entered |
| Ambiguity or contradiction findings | AI (existing, labelled) |

## Cut, future work
| Cut | One-line reason |
|---|---|
| Tier 2 market templates (ILPA, "Unusual vs market") | Needs a vetted template library and a match score; baseline from the same firm covers the core job |
| First-review logic groups ("Logic to confirm 23", Confirm group) | A second review mode with its own gate rules; the empty-baseline case is one muted line for now |
| Cross-doc mismatch ([P1] placeholder) | Needs a second document in scope and its own severity policy |
| "Rules in effect" UI and Baselines table | Config is versioned in the repo; a read-only viewer can come once the config format settles |
| Generalized regression checks (Memory table, Firm-template checks listed and managed) | One example proves the idea; listing, editing and expiry need a policy. Firm-template answers still capture intent and scope and show a preview, but no check list is shown |
| 3-state gate (Not ready / Waiting / Ready) | Two states are enough: asked questions count toward Blocked |

## Seed notes (mockup only)
- Document is "Northgate III 2026"; Compare, Memory decisions and Documents labels use Northgate / Fund I 2022 / Fund II 2025 / Fund III template (labels only).
- F-07 seeded open so Questions starts at Counsel 3 · GP 2 · Fund admin 1; F-02 Accepted, F-03 Needs counsel. Four changes are seeded "asked" (7A, Singapore, 4.2, minimum), three stay open (sanctions, tax status, trust split).
- Picking a different baseline only relabels; the sample changes stay classified against Fund II.
- Section 4.2 reads "formed or organized outside the United States" (7 words added, computed from the markup).
- Findings details still print "Ran under rules 2026.10.3 (7e41a9c)" as provenance.

## Verified (Playwright headless Chrome, 1440 and 1024, normal and --disable-local-storage)
No uncaught errors; Changes shows 7; cosmetic hidden until toggled (12 rows when on); baseline modal pre-checked with no error on open, error only on submit with nothing selected; empty-firm case shows the modal line and the muted Findings line with Errors only; Questions group by owner with per-owner export; answer modal shows intent and scope and the regression preview; R-01 appears with its label; gate stays Blocked while questions are open and reaches Ready when everything is resolved; Rules tab has no extra tables; no horizontal overflow.

## Open questions
1. Should an untriaged New or Logic change block the gate, as shown, or only warn?
2. Singapore has two owners ("GP + Counsel"), filed under GP. Prefer two separate questions?
3. Analyst-owned changes (owner "You") can only be marked expected. Add a "decided by me" action with intent?
4. Firm-template answers: keep intent required? Where should created checks be listed once the generalized check list returns?
5. Any asked question holds the gate (even note-level "Needs counsel" ones). Keep this simple rule?
6. Multiple baselines may be ticked; the mockup does not show per-baseline differences. Keep one baseline for the MVP?
