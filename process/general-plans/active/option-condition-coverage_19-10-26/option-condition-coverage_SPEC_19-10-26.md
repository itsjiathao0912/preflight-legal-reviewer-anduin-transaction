---
name: spec:option-condition-coverage
description: "Requirements for a deterministic detector that flags an investor-type option only partly named by the nearby conditional (e.g. 'Partnership or LLC' vs 'If ... partnership, also complete Section 3')"
date: 19-10-26
---

# Option-condition coverage — SPEC

**Answer first:** add one rule-based detector that flags an exclusive investor-type option whose label joins two types ("Partnership or LLC") when the conditional right after the group names one of them ("partnership") but not the other ("LLC"). It reuses the existing `option_gap_overlap` class, uses severity `high` (shown as "Fix"; it does not gate, because the gate only counts `critical`), and suggests the counsel question "Should LLC investors complete Section 3?".

## Goal
The analyst learns, without an LLM, that one investor type's route is unclear, and gets a ready-made question for counsel.

## Use case (the demo doc)
`fixtures/variance/hartwell-crane/fund-I.html` (Harbor Ridge Opportunity Fund I, L.P.; the same text is in fund-II, fund-III, and fund-III-with-appendix-c). Section 2 Part B: "Investor type (check one): Individual / Joint tenants / Trust / IRA / Corporation / Partnership or LLC", followed by "If the Investor is a trust, corporation or partnership, also complete Section 3." Expected: one finding on "Partnership or LLC" that cites the option, the conditional text, and "Section 2, Part B".

## In scope
- Exclusive groups (`exclusive: true`) that pass `isInvestorGroup` (an existing helper).
- Conditionals in the same block as the group, or in the 3 blocks after the group's last block, in the same section. Skip negative conditionals.
- An option qualifies when its label splits into 2 or more parts on "or", "/" or ",", at least one part is named in the conditional's trigger, and at least one other part is a recognised investor type (`classifyType` is non-null) that is not named.
- Every string fact goes through `maskFacts` / `maskThenClip`. One finding per (group, conditional).

## Out of scope
- Options not named at all (Individual, Joint tenants, IRA). With "also" they are additive and correct. IRA is not flagged because the detector must not guess whether an IRA is an entity.
- The AI false positive "conditional lacks alternative instruction".
- New issue class, web label, Worker, schema or contract change.

## Constraints
- Deterministic, no LLM, linear time. The detector registry only allows appends at the end.
- Severity at most `high`; confidence 0.7.
- Precision first: when unsure, do not flag (same rule as `option-gap-overlap`).
