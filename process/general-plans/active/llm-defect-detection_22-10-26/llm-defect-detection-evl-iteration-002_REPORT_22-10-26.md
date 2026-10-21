# EVL iteration 002 (22-10-26)

- Fix cycle 1 applied (reference-target@2): model-side verdict + audience fields, mismatch-only filter, one pair per label with NOTE line, resolver additions, bench heldout subset.
- Execute-agent results: verified live 3/3 caught, 3 non-matching (AC10 limits met); held-out 30 docs: 14 non-matching, 2 docs over per-doc limit, high run-to-run variance (recorded as backlog F1, not an AC).
- Spend: $0.3121 this cycle, $0.3379 total (cap $1).
- Caveat: several live iterations were run against the verified set, so some tuning-to-set risk; held-out numbers are the honest precision signal.
- Next: vc-tester EVL confirmation re-run.
