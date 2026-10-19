---
name: note:openai-stage2-probe
description: "Operator residual M5.5 / AC19 - stage-2 OpenAI probe through the live Worker with a human Turnstile token"
date: 19-10-26
feature: none
---

# OpenAI stage-2 probe (operator residual, AC19)

Source plan: `process/general-plans/active/openai-provider_19-10-26/openai-provider_PLAN_19-10-26.md` step 5.5.

State at write time: Worker `preflight-legal-reviewer` version `80f60ad5-6634-4528-9181-d51bfac03aaa` runs `AI_PROVIDER=openai` (commit bcbdce3). The stage-1 direct probe passed on 19-10-26 (3 calls, all HTTP 200, 1,834 µUSD total). No billed call has gone through the Worker yet.

## What to run (human in a real browser, at most 3 billed calls)

1. Open https://preflight-legal-reviewer.giathaowork.workers.dev, solve Turnstile, run one AI review (one call) and one OCR page on sample #9 (one call). One extra call is allowed if needed.
2. Read-only D1 check: `pnpm --filter @aduin/worker exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT * FROM quota_counter WHERE key = 'spend|openai'"`. The value should be > 0.
3. Check that a `spend_ledger` row exists with a non-zero `cost_micro_usd`.
4. Run `wrangler tail preflight-legal-reviewer` during the calls and look for a `proxy.spend` line. Confirm the breaker is not tripped (`/api/quota` returns `global_ok: true`).
5. Compare the usage x price constant (400,000 / 1,600,000 µUSD per MTok) with the OpenAI dashboard.

Exit: AC19 moves from CONDITIONAL to met. Rollback if anything is wrong: set `AI_PROVIDER` to `"openrouter"` and redeploy, or `wrangler rollback 4005f4f9-599d-4bad-a2fd-7114c86b725d`.
