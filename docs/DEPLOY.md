# Deploy guide

Target: one Cloudflare Worker `preflight-legal-reviewer` on `*.workers.dev`, Workers Free plan, plus D1
`aduin-transaction-db`. No routes, no custom domain, no zone changes. `pnpm guard:cf` enforces this.

## Resources

| Resource | Name | Notes |
|---|---|---|
| Worker (with static assets) | `preflight-legal-reviewer` | `apps/worker/wrangler.jsonc`, `workers_dev: true` |
| D1 database | `aduin-transaction-db` | binding `DB`, migrations `apps/worker/migrations/0001-0005` |
| Cron | `17 3 * * *` | daily retention purge |
| Secrets | `COOKIE_SIGNING_KEYS`, `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY`, `TURNSTILE_SECRET` | values never in the repo |
| Plain vars | in `wrangler.jsonc` | `AI_TEXT_MODELS`, `AI_VISION_MODELS`, `AI_RESPONSE_MODE`, `PAID_FALLBACK_ENABLED=false`, `AI_UPLOADS_ENABLED`. The Worker config also reads an optional `TURNSTILE_SITE_KEY`; it is not set and nothing needs it, because the browser uses the key compiled into the web bundle |
| Web build var | `VITE_TURNSTILE_SITE_KEY` | public Turnstile site key, read at web build time; not a secret |

Live URL: https://preflight-legal-reviewer.giathaowork.workers.dev

The Worker was renamed from `aduin-transaction-web` on 19-10-26 (user-approved exception to the
`aduin-transaction-*` naming rule for this Worker only). The old Worker
`https://aduin-transaction-web.giathaowork.workers.dev` is kept running, untouched, with its own
secrets; both share D1 `aduin-transaction-db`, and the Turnstile widget lists both hostnames.
Live Worker version: 23612b12-51c7-4d75-a324-f4f2f6392ba8 (code af59da6, render-first fix), deployed 2026-10-17. Previous version for rollback: 67c796ff-477c-4900-ba89-4ff3109e0c56 (code 38a3b2f).
D1 `aduin-transaction-db` is live with migrations 0001-0005; its id is recorded in `apps/worker/wrangler.jsonc`.

## Prerequisites

- Node 24 or newer, pnpm 11, `pnpm install` done.
- Credentials outside the repo: `~/.config/cloudflare/credentials.env` (`CLOUDFLARE_EMAIL`, `CLOUDFLARE_API_KEY`,
  `CLOUDFLARE_ACCOUNT_ID`) and `~/.config/openrouter/credentials.env` (`OPENROUTER_API_KEY`).
- Load without printing: `set -a; source ~/.config/cloudflare/credentials.env; set +a`.

## 1. Pre-flight

```bash
pnpm guard:cf
pnpm secrets:scan
pnpm typecheck
pnpm --filter @aduin/worker test
pnpm --filter @aduin/web test
pnpm --filter @aduin/scripts deploy:preflight   # after the plain web build (step 4), before wrangler deploy
```

All must pass before any deploy. `deploy:preflight` checks the web output: `_headers` with a CSP, no e2e hook markers
(`__aduinE2E`, `__aduinTurnstileSiteKey`) and the Turnstile site key compiled in.

## 2. Create and migrate D1 (first deploy only)

```bash
cd apps/worker
pnpm exec wrangler d1 create aduin-transaction-db
# copy the printed database_id into d1_databases[0].database_id in wrangler.jsonc
pnpm exec wrangler d1 migrations apply aduin-transaction-db --remote
pnpm exec wrangler d1 execute aduin-transaction-db --remote --file=seed/demo.sql   # demo workspace seed
```

Check `app_meta.schema_version` is 5 afterward:

```bash
pnpm exec wrangler d1 execute aduin-transaction-db --remote --command "SELECT * FROM app_meta"
```

## 3. Secrets

Each command prompts for the value on stdin; nothing is echoed or committed.

```bash
cd apps/worker
pnpm exec wrangler secret put COOKIE_SIGNING_KEYS     # JSON map {"<kid>":"<random key>"}
pnpm exec wrangler secret put COOKIE_SIGNING_KID
pnpm exec wrangler secret put OPENROUTER_API_KEY
pnpm exec wrangler secret put TURNSTILE_SECRET        # from the Turnstile widget created for the workers.dev host
```

The Turnstile site key is public and goes in the web build env as `VITE_TURNSTILE_SITE_KEY` (names only in the
`apps/web` env example file). Create the widget for the `*.workers.dev` hostname only.

Warning: if `TURNSTILE_SECRET` is set on the Worker but the bundle was built without `VITE_TURNSTILE_SITE_KEY`, the
browser never sends a token, so session bootstrap (memory) and AI/OCR calls fail closed. Always build with the key.

## 4. Build and deploy

Deploy the Worker before the web bundle matters only when the OCR or API contract changed; here both ship together
because the Worker serves the bundle.

```bash
VITE_TURNSTILE_SITE_KEY=<public site key> pnpm --filter @aduin/web build   # fresh plain build, not build:e2e
pnpm --filter @aduin/scripts deploy:preflight
cd apps/worker
pnpm exec wrangler deploy
```

Record the printed version id in the umbrella plan and in `README.md`.

## 5. Verify

```bash
curl -s https://preflight-legal-reviewer.giathaowork.workers.dev/api/health
curl -sI https://preflight-legal-reviewer.giathaowork.workers.dev/ | head -20     # status 200 and security headers
SLICE_BASE_URL=https://preflight-legal-reviewer.giathaowork.workers.dev \
  pnpm --filter @aduin/web exec playwright test --project=stack
```

Then open the site by hand: sample 5, Compare 5 against 6, Counsel questions, and Firm memory from the nav.

## Rollback

```bash
cd apps/worker
pnpm exec wrangler deployments list
pnpm exec wrangler rollback <previous-version-id>
```

Rollback changes code only. D1 migrations are forward-only: do not roll back a migration; write a new one. To stop
AI spend immediately without a redeploy, remove the secret: `pnpm exec wrangler secret delete OPENROUTER_API_KEY`
(AI then fails closed and the rest of the app keeps working).

## Hard rules

- Only `aduin-transaction-*` resource names; `*.workers.dev` URLs only.
- Never add a route, custom domain or zone setting. If a task seems to need one, stop and ask.
- Free models only; `PAID_FALLBACK_ENABLED` stays `false`.
- No secret values in the repo, logs or chat. `pnpm secrets:scan` must pass.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `wrangler deploy` cannot resolve D1 | placeholder all-zero `database_id` still in `wrangler.jsonc` | complete step 2 |
| AI and uploads answer `memory_unavailable` or fail closed | no D1 binding or missing secret | check bindings and `wrangler secret list` |
| "verification needed" in the AI lane | Turnstile site key or secret missing | set both, redeploy |
| Memory writes refused with 429 | daily D1 write budget reached | resets at UTC midnight; see the worker context doc |
