// `pnpm --filter @aduin/scripts probe:live-ai` — AC51 live rules_hash8 echo probe plus the
// workerd CPU/duration timing of the first counted AI call (G13, E17).
//
// Opens a headed Chromium on the live site (one session in the ledger; refuses at 4 used). The
// operator adds a rule for firm A in #memory and runs one AI review on sample #1, then (optional)
// one AI review under a second firm. The probe:
//   - gates every `/api/ai` and `/api/ocr` request through the APPROVED-LIVE ledger BEFORE it
//     leaves the browser (<= 6 per phase, <= 3 per UTC day, AI planned 4 of 6); over cap => aborted;
//   - stops (closes the browser) on usage.cost > 0, any 429, breaker / budget open;
//   - reads the echoed `meta.rules_hash8`, fetches the active rules of that firm through the same
//     browser context, and compares with core `rulesHash8(injectedRulesHash(texts))`;
//   - with --tail, runs `wrangler tail preflight-legal-reviewer --format json` and records cpuTime /
//     wallTime of the first `/api/ai` invocation (fallback: GraphQL workersInvocationsAdaptive).
//
// Flags: --base <origin>, --max-ai <n> (this run, default 2, max 2), --tail, --headless,
//        --allow-fifth-ai, --timeout-ms <n> (default 600000).
// Exit:  0 echo matched (and second firm differs when exercised), 1 fail/stop, 2 bad args/ledger.
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { injectedRulesHash, rulesHash8 } from '@aduin/core';
import {
  Ledger,
  liveBase,
  LiveGuardError,
  log,
  parseFlags,
  parseNdjson,
  ROOT,
  stopReason,
  WORKER_NAME,
} from './common';

const P = 'probe:live-ai';

export interface EchoMeta {
  rules_hash8: string;
  rules_applied: number;
  rules_total: number;
}

/** Find the L5 echo `meta` in NDJSON frames (cache hit or miss). */
export function findEcho(frames: readonly unknown[]): EchoMeta | null {
  for (const f of frames) {
    const m = (f as { meta?: Partial<EchoMeta> } | null)?.meta;
    if (m && typeof m.rules_hash8 === 'string') {
      return {
        rules_hash8: m.rules_hash8,
        rules_applied: Number(m.rules_applied ?? 0),
        rules_total: Number(m.rules_total ?? 0),
      };
    }
  }
  return null;
}

/** Expected echo for a set of active rule texts. */
export function expectedHash8(activeTexts: readonly string[]): string {
  return activeTexts.length === 0 ? 'none' : rulesHash8(injectedRulesHash(activeTexts));
}

export function activeRuleTexts(body: unknown): string[] {
  const rules =
    (body as { rules?: Array<{ text?: unknown; status?: unknown }> } | null)?.rules ?? [];
  return rules
    .filter((r) => r.status === 'active' && typeof r.text === 'string')
    .map((r) => r.text as string);
}

export interface TailTiming {
  cpuTimeMs: number | null;
  wallTimeMs: number | null;
  outcome: string | null;
}

/** Parse one `wrangler tail --format json` event; returns timing for an `/api/ai` POST, else null. */
export function parseTailEvent(line: string): TailTiming | null {
  let ev: Record<string, unknown>;
  try {
    ev = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }
  const req = (ev['event'] as { request?: { url?: unknown; method?: unknown } } | undefined)
    ?.request;
  if (typeof req?.url !== 'string') return null;
  let path: string;
  try {
    path = new URL(req.url).pathname;
  } catch {
    return null;
  }
  if (path !== '/api/ai') return null;
  if (req.method !== undefined && req.method !== 'POST') return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  return {
    cpuTimeMs: num(ev['cpuTime']),
    wallTimeMs: num(ev['wallTime']),
    outcome: typeof ev['outcome'] === 'string' ? ev['outcome'] : null,
  };
}

function startTail(onTiming: (t: TailTiming) => void): ChildProcess {
  const child = spawn('pnpm', ['exec', 'wrangler', 'tail', WORKER_NAME, '--format', 'json'], {
    cwd: join(ROOT, 'apps', 'worker'),
    stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
  });
  let buf = '';
  let seen = false;
  child.stdout?.on('data', (d: Buffer) => {
    buf += d.toString('utf8');
    // wrangler prints pretty JSON objects; split on top-level object boundaries per line block.
    const parts = buf.split(/\n(?=\{)/);
    buf = parts.pop() ?? '';
    for (const p of parts) {
      const t = parseTailEvent(p);
      if (t && !seen) {
        seen = true;
        onTiming(t);
      }
    }
  });
  return child;
}

async function main(): Promise<number> {
  const f = parseFlags(
    process.argv.slice(2),
    ['base', 'max-ai', 'timeout-ms'],
    ['tail', 'headless', 'allow-fifth-ai'],
  );
  const base = liveBase(f.values['base']);
  const maxAi = Number(f.values['max-ai'] ?? 2);
  if (!Number.isInteger(maxAi) || maxAi < 1 || maxAi > 2)
    throw new LiveGuardError('--max-ai must be 1 or 2');
  const timeoutMs = Number(f.values['timeout-ms'] ?? 600_000);
  const allowFifthAi = f.bools.has('allow-fifth-ai');
  const ledger = new Ledger();
  ledger.claim('session', 'probe:live-ai');

  let tail: ChildProcess | null = null;
  let timing: TailTiming | null = null;
  if (f.bools.has('tail')) tail = startTail((t) => (timing = t));

  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: f.bools.has('headless') });
  const results: Array<{ firm: string | null; echo: EchoMeta | null; expected: string | null }> =
    [];
  let stop: string | null = null;
  let aiThisRun = 0;
  try {
    const context = await browser.newContext();
    await context.route(/\/api\/(ai|ocr)(\?|$)/, async (route) => {
      const kind = /\/api\/ai/.test(route.request().url()) ? 'ai' : 'ocr';
      try {
        if (stop) throw new LiveGuardError(`stopped: ${stop}`);
        if (kind === 'ai' && aiThisRun >= maxAi)
          throw new LiveGuardError(`--max-ai ${maxAi} reached`);
        ledger.claim(kind, `probe:live-ai ${kind}`, { allowFifthAi });
        if (kind === 'ai') aiThisRun++;
        await route.continue();
      } catch (e) {
        log(P, `${kind} request aborted: ${(e as Error).message}`);
        await route.abort();
      }
    });
    const page = await context.newPage();
    const done = new Promise<void>((resolve) => {
      page.on('response', (r) => {
        const u = new URL(r.url());
        if (
          u.origin !== base ||
          r.request().method() !== 'POST' ||
          !/^\/api\/(ai|ocr)$/.test(u.pathname)
        )
          return;
        void (async () => {
          const text = await r.text().catch(() => '');
          let frames: unknown[];
          try {
            frames = parseNdjson(text);
          } catch {
            frames = [];
          }
          const s = stopReason({ status: r.status(), body: frames });
          if (s) {
            stop = s;
            resolve();
            return;
          }
          if (u.pathname !== '/api/ai') return;
          let firm: string | null;
          try {
            firm =
              ((JSON.parse(r.request().postData() ?? '{}') as { law_firm_id?: unknown })
                .law_firm_id as string) ?? null;
          } catch {
            firm = null;
          }
          const echo = findEcho(frames);
          let expected: string | null = null;
          if (firm) {
            const rr = await context.request.get(
              `${base}/api/rules?law_firm_id=${encodeURIComponent(firm)}`,
            );
            if (rr.ok()) expected = expectedHash8(activeRuleTexts(await rr.json()));
          }
          results.push({ firm, echo, expected });
          log(
            P,
            `ai #${results.length}: HTTP ${r.status()} firm=${firm ?? '-'} echo=${echo?.rules_hash8 ?? '-'} expected=${expected ?? '-'} applied=${echo?.rules_applied ?? '-'}`,
          );
          if (results.length >= maxAi) resolve();
        })();
      });
      setTimeout(resolve, timeoutMs);
    });
    await page.goto(`${base}/`, { waitUntil: 'load' });
    log(
      P,
      `operator: add a rule for firm A in #memory, run one AI review on #1${maxAi > 1 ? ', then one under a second firm' : ''}`,
    );
    await done;
  } finally {
    await browser.close();
    tail?.kill('SIGTERM');
  }

  const failures: string[] = [];
  if (stop) failures.push(`stop condition: ${stop}`);
  if (results.length === 0) failures.push('no AI response observed');
  const first = results[0];
  if (first) {
    if (!first.echo) failures.push('first AI response carried no rules echo');
    else if (first.expected === null)
      failures.push('first AI call had no firm or rules could not be read');
    else if (first.echo.rules_hash8 !== first.expected)
      failures.push('echoed rules_hash8 differs from the active rules hash');
  }
  const second = results[1];
  if (
    first?.echo &&
    second?.echo &&
    second.firm !== first.firm &&
    second.echo.rules_hash8 === first.echo.rules_hash8 &&
    first.echo.rules_hash8 !== 'none'
  )
    failures.push("second firm echoed the first firm's rules hash");
  const t = timing as TailTiming | null;
  if (tail)
    log(
      P,
      t
        ? `timing (wrangler tail, first /api/ai): cpuTime ${t.cpuTimeMs ?? '?'} ms, wallTime ${t.wallTimeMs ?? '?'} ms, outcome ${t.outcome ?? '?'}`
        : 'timing: no tail event captured; use the GraphQL workersInvocationsAdaptive fallback',
    );
  const ai = ledger.counts('ai');
  log(P, `ledger: ai ${ai.phase} of 6 this phase, ${ai.today} of 3 today`);
  for (const x of failures) log(P, `FAIL ${x}`);
  log(P, failures.length ? `${failures.length} failure(s)` : 'OK');
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error(`${P}: ${e instanceof Error ? e.message : String(e)}`);
      process.exit(e instanceof LiveGuardError ? 2 : 1);
    },
  );
}
