#!/usr/bin/env bash
# Phase 04b remote spikes S8 (remote), S9 (rows written), S10 (CPU), cron on Free.
# APPROVED-REMOTE scope only: throwaway D1 `aduin-transaction-spike-db` and Worker
# `aduin-transaction-spike-mem` on workers.dev; NO secrets on the Worker; no routes, no custom
# domain, never the zone. Credentials must already be exported by the caller via
#   set -a; source ~/.config/cloudflare/credentials.env; set +a  # APPROVED:credentials.env
# and are never printed. Both resources are deleted at the end and their absence is listed.
# Usage: run-remote.sh <out-dir>
set -uo pipefail
OUT="${1:?out dir}"
mkdir -p "$OUT"
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SCRIPTS="$ROOT/scripts"
DB_NAME="aduin-transaction-spike-db"
WORKER="aduin-transaction-spike-mem"
WR() { (cd "$SCRIPTS" && CI=true pnpm exec wrangler "$@"); }

cleanup() {
  [ -n "${TAIL_PID:-}" ] && kill "$TAIL_PID" 2>/dev/null
  echo "== cleanup"
  WR delete --name "$WORKER" --force >"$OUT/delete-worker.txt" 2>&1 || true
  WR d1 delete "$DB_NAME" -y >"$OUT/delete-db.txt" 2>&1 || true
  WR d1 list >"$OUT/d1-list-after.txt" 2>&1 || true
  if grep -q "$DB_NAME" "$OUT/d1-list-after.txt"; then echo "D1 STILL PRESENT"; else echo "D1 absent: OK"; fi
  WR deployments list --name "$WORKER" >"$OUT/worker-after.txt" 2>&1
  if grep -qiE "not found|does not exist|10007|could not" "$OUT/worker-after.txt"; then echo "Worker absent: OK"; else echo "Worker check:"; tail -3 "$OUT/worker-after.txt"; fi
}
trap cleanup EXIT

echo "== create $DB_NAME"
WR d1 create "$DB_NAME" >"$OUT/create-db.txt" 2>&1
DB_ID="$(grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$OUT/create-db.txt" | head -1)"
[ -z "$DB_ID" ] && { echo "create failed"; tail -5 "$OUT/create-db.txt"; exit 1; }
echo "created (id recorded in $OUT only)"

CFG="$OUT/wrangler.spike.jsonc"
cat >"$CFG" <<EOF
{
  "name": "$WORKER",
  "main": "$SCRIPTS/src/spikes/s08-sql-surface/remote-worker.mjs",
  "compatibility_date": "2026-10-01",
  "workers_dev": true,
  "d1_databases": [{ "binding": "DB", "database_name": "$DB_NAME", "database_id": "$DB_ID", "migrations_dir": "$ROOT/apps/worker/migrations" }],
  "triggers": { "crons": ["* * * * *"] }
}
EOF
if grep -qE '"(routes|route|custom_domain|zone_id|zone_name)"' "$CFG"; then echo "forbidden key"; exit 1; fi

echo "== migrate + seed (remote throwaway DB)"
WR d1 migrations apply "$DB_NAME" --remote -c "$CFG" >"$OUT/migrate.txt" 2>&1 || { tail -20 "$OUT/migrate.txt"; exit 1; }
WR d1 execute "$DB_NAME" --remote -c "$CFG" --file "$ROOT/apps/worker/seed/demo.sql" >"$OUT/seed.txt" 2>&1 || { tail -20 "$OUT/seed.txt"; exit 1; }
WR d1 execute "$DB_NAME" --remote -c "$CFG" --command "SELECT key, value FROM app_meta ORDER BY key" --json >"$OUT/app-meta.json" 2>&1

echo "== deploy $WORKER (no secrets)"
WR deploy -c "$CFG" >"$OUT/deploy.txt" 2>&1 || { tail -30 "$OUT/deploy.txt"; exit 1; }
URL="$(grep -oE 'https://[a-z0-9.-]+\.workers\.dev' "$OUT/deploy.txt" | head -1)"
echo "url: $URL"
grep -iE "schedule|cron" "$OUT/deploy.txt" | head -3
WR secret list --name "$WORKER" >"$OUT/secret-list.txt" 2>&1 || true

(cd "$SCRIPTS" && pnpm exec wrangler tail "$WORKER" --format json >"$OUT/tail.jsonl" 2>"$OUT/tail.err") &
TAIL_PID=$!
sleep 12

node -e '
const f = (i) => ({ id: "fk-" + i, issue_class: "defined_term_issue", severity: "medium", detector_kind: "rule", detector_id: "undefined-term", confidence: 0.9,
  anchor: { docHash: "a".repeat(64), blockId: "b-" + i, offsetStart: 0, offsetEnd: 10 }, section_path: ["Part B"], quote_snippet: ("Spike quote " + i + " ").repeat(20).slice(0, 300),
  quote_hash: "b".repeat(64), fingerprint: "c".repeat(64), detail: { explanation: "e".repeat(1000), facts: { a: "f".repeat(900), b: "g".repeat(400) }, interpretations: [] } });
process.stdout.write(JSON.stringify({ client_op_id: "spike-s10-0001", findings: Array.from({ length: 50 }, (_, i) => f(i)) }));
' >"$OUT/s10-body.json"
echo "s10 body bytes: $(wc -c <"$OUT/s10-body.json")"

for i in 1 2 3; do curl -s -X POST --data-binary @"$OUT/s10-body.json" -H 'content-type: application/json' "$URL/s10?mode=zod" >>"$OUT/s10.txt"; echo >>"$OUT/s10.txt"; done
for i in 1 2 3; do curl -s -X POST --data-binary @"$OUT/s10-body.json" -H 'content-type: application/json' "$URL/s10?mode=raw" >>"$OUT/s10.txt"; echo >>"$OUT/s10.txt"; done
curl -s "$URL/s9" >"$OUT/s9.json"
curl -s "$URL/s8" >"$OUT/s8.json"
for qs in "q=45" "q=55" "b=60" "q=40&f=5" "q=45&f=10" "f=55" "q=10&b=45"; do
  echo "$qs $(curl -s "$URL/budget?$qs")" >>"$OUT/budget.txt"
done
echo "== waiting up to 90 s for a scheduled() event"
for i in $(seq 1 18); do
  grep -q 'spike-cron-fired' "$OUT/tail.jsonl" 2>/dev/null && break
  sleep 5
done
grep -q 'spike-cron-fired' "$OUT/tail.jsonl" && echo "cron fired: yes" || echo "cron fired: no (within 90 s)"
sleep 3
