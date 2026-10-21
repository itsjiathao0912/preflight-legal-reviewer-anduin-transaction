# EVL iteration 001 (22-10-26)

- vc-tester re-ran 26 gates: 25 PASS, gate 24 (live-answer replay, AC10) FAIL.
- Gate 24: reference-target caught 1/3 (E1 Onex), missed E2 LAGO, E3 Keystone; 21 false positives. Engine 5/5.
- Live spend so far: $0.0258 (cap for this work: $1).
- Root causes (execute report): model emits low-severity "no defect" findings instead of none; wrong pointer sentence chosen in LAGO/Keystone multi-label/duplicate-label cases.
- Fix scope (cycle 1): model-side verdict field + drop non-mismatch verdicts; one judgment per label; precision check on held-out (non-verified) corpus docs. No new finding fields; no tuning on target quotes.
- Next: vc-execute-agent supplement, then vc-tester re-run.
