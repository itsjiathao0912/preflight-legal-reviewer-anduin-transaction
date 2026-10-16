// Minimal Cloudflare API helper for the S1/S2 spike. Reads CLOUDFLARE_EMAIL / CLOUDFLARE_API_KEY /
// CLOUDFLARE_ACCOUNT_ID from env only; never prints them. Read-only calls plus the spike delete.
// Usage: pnpm exec tsx spikes/s01-s02/cf-api.ts subdomain|list-spikes|secrets <script>
const BASE = 'https://api.cloudflare.com/client/v4';

function creds(): { email: string; key: string; account: string } {
  const email = process.env.CLOUDFLARE_EMAIL;
  const key = process.env.CLOUDFLARE_API_KEY;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!email || !key || !account) throw new Error('Cloudflare credentials not loaded in env');
  return { email, key, account };
}

export async function cf(
  path: string,
): Promise<{ success: boolean; result: unknown; status: number }> {
  const { email, key, account } = creds();
  const res = await fetch(`${BASE}/accounts/${account}${path}`, {
    headers: { 'X-Auth-Email': email, 'X-Auth-Key': key },
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; result?: unknown };
  return { success: body.success === true, result: body.result, status: res.status };
}

async function main(cmd: string | undefined, arg: string | undefined): Promise<void> {
  if (cmd === 'subdomain') {
    const r = await cf('/workers/subdomain');
    const sub = (r.result as { subdomain?: string } | null)?.subdomain;
    console.log(
      JSON.stringify({ status: r.status, hasSubdomain: Boolean(sub), subdomain: sub ?? null }),
    );
  } else if (cmd === 'list-spikes') {
    const r = await cf('/workers/scripts');
    const ids = ((r.result as { id: string }[] | null) ?? []).map((s) => s.id);
    console.log(
      JSON.stringify({
        status: r.status,
        spikeWorkers: ids.filter((id) => id.startsWith('aduin-transaction-spike')),
      }),
    );
  } else if (cmd === 'secrets' && arg) {
    const r = await cf(`/workers/scripts/${arg}/secrets`);
    const names = ((r.result as { name: string }[] | null) ?? []).map((s) => s.name);
    console.log(JSON.stringify({ status: r.status, secretNames: names }));
  } else {
    throw new Error('usage: subdomain | list-spikes | secrets <script>');
  }
}

main(process.argv[2], process.argv[3]).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
