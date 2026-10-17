# Deploy guide

Target: one Cloudflare Worker `aduin-transaction-web` on `*.workers.dev`, Workers Free plan, plus D1
`aduin-transaction-db`. No routes, no custom domain, no zone changes. `pnpm guard:cf` enforces this.

## Resources

| Resource | Name | Notes |
|---|---|---|
| Worker (with static assets) | `aduin-transaction-web` | `apps/worker/wrangler.jsonc`, `workers_dev: true` |
| D1 database | `aduin-transaction-db` | binding `DB`, migrations `apps/worker/migrations/0001-0005` |
| Cron | `17 3 * * *` | daily retention purge |
| Secrets | `COOKIE_SIGNING_KEYS`, `COOKIE_SIGNING_KID`, `OPENROUTER_API_KEY`, `TURNSTILE_SECRET` | values never in the repo |
| Plain vars | in `wrangler.jsonc` | `AI_TEXT_MODELS`, `AI_VISION_MODELS`, `AI_RESPONSE_MODE`, `PAID_FALLBACK_ENABLED=false`, `AI_UPLOADS_ENABLED`, `TURNSTILE_SITE_KEY` |

Live URL: https://aduin-transaction-web.giathaowork.workers.dev
<!-- P10:FILL deploy-version: final Worker version id and date -->
<!-- P10:FILL d1-id: real D1 database id is recorded in wrangler.jsonc (not here) -->

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
```

All must pass before any deploy.

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

The Turnstile site key is public and goes in the web build env (see `apps/web` env example). Create the widget for the
`*.workers.dev` hostname only.

## 4. Build and deploy

Deploy the Worker before the web bundle matters only when the OCR or API contract changed; here both ship together
because the Worker serves the bundle.

```bash
pnpm --filter @aduin/web build          # plain build, not build:e2e
cd apps/worker
pnpm exec wrangler deploy
```

Record the printed version id in the umbrella plan and in `README.md`.

## 5. Verify

```bash
curl -s https://aduin-transaction-web.giathaowork.workers.dev/api/health
curl -sI https://aduin-transaction-web.giathaowork.workers.dev/ | head -20     # status 200 and security headers
SLICE_BASE_URL=https://aduin-transaction-web.giathaowork.workers.dev \
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
