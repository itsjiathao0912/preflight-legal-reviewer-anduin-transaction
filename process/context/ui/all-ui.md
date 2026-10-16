---
name: context:all-ui
description: UI/UX design direction, design skills, references, tokens and approved mockups for the sub-doc QA web app
keywords: ui, ux, design, mockup, frontend, layout, look and feel, design tokens, taste skill, minimalist, accessibility, wcag, review workspace, counsel sheet
related: []
date: 17-10-26
metadata:
  node_type: group-entrypoint
  type: context
  read_when: any UI/UX design, mockup, frontend implementation or UI review task
---

# aduin-transaction - UI/UX Context

Last updated: 2026-10-17

Entrypoint for the `ui/` context group. `vc-ui-ux-designer` MUST read this before any design or frontend work.

## Scope

Covers: UI/UX design direction, which design skills to use, references, design tokens and approved mockups for the sub-doc QA web app.

Does not cover: component code conventions (none yet; add them here once frontend code exists), product scope (see `process/context/product-domain.md`).

## Read When

- any UI/UX design, mockup, frontend implementation or UI review task
- choosing a design skill or visual-QA method

## Design Skills

Installed at USER level in `~/.claude/skills`, intentionally NOT in repo `.claude/skills`, so kit validators and vc-update are unaffected.

- Source: https://github.com/leonxlnx/taste-skill, commit `f624f37` (2026-10-14), MIT.
- Reinstall: clone that commit, then copy
  - `skills/minimalist-skill` -> `~/.claude/skills/taste-minimalist-skill`
  - `skills/redesign-skill` -> `~/.claude/skills/taste-redesign-skill`
  - `skills/taste-skill` -> `~/.claude/skills/design-taste-frontend`
- Each installed folder has a `SOURCE.txt`.

## Which Skill For Which Job

| Job | Use |
|---|---|
| App screens (review workspace, structure view, diff, counsel sheet + gate, firm memory, audit trail) | `minimalist-ui` (taste-minimalist-skill) for visual direction; `redesign-existing-projects` (taste-redesign-skill) for audit/upgrade passes. `ui-ux-pro-max` / `vc-frontend-design` also allowed for component patterns |
| Visual QA | design-taste-frontend `references/tells.md` and `references/critique.md` as an anti-"AI-slop" checklist; its `scripts/inspect.mjs` (local server + screenshots) for a look-and-fix loop; plus `ui-review` / `ux-review` skills |
| Marketing surfaces only (demo intro/landing page, README banner, slides) | `design-taste-frontend` main skill. It is NOT for dashboards or app screens; never use it to style app screens |
| Do not use | brutalist, gpt-taste, imagegen-*, brandkit |

## Product UI Principles

Derived from the SPEC (`process/general-plans/active/subdoc-qa-mvp_17-10-26/subdoc-qa-mvp_SPEC_17-10-26.md`):

- English UI; dense, calm analyst tool, not a marketing page
- document left, findings right
- severity never conveyed by color alone; WCAG AA; keyboard-operable triage (AC30)
- every finding shows provenance: rule id, or model + fresh/cache
- AI results visibly labeled and shown as pending until done
- deterministic results first
- no-LLM mode banner

## References

When to provide: at the start of the UX design step, BEFORE mockups; 2-3 refs per screen type with one line on what is liked. Never introduce new references during EXECUTE.

Reference list: none provided yet.

## Artifacts

- Approved mockups: `design/mockups/` (repo root)
- Design tokens: not yet approved. Record them here once approved.

## Source Paths

- `process/context/product-domain.md`
- SPEC path above
- `design/mockups/` (once created)
- `~/.claude/skills/{taste-minimalist-skill,taste-redesign-skill,design-taste-frontend}`

## Update Triggers

Mockup approved, tokens changed, skill version changed, new references provided.

## Routing

No deeper docs yet. Add rows here when tokens, references or component conventions get their own files.
