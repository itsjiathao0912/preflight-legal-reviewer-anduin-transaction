// S6 local spike: bundle the spike entry with `wrangler deploy --dry-run --outdir <scratch>`,
// gzip the output and judge the size. Usage: pnpm --filter @aduin/scripts spike:s06-local
// Exit: 0 PASS / PASS-WITH-RISK, 1 kill (> 2.5 MiB gz), 2 harness error. No network, no deploy.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { judgeS6Size, MiB, S6_LIMITS } from './thresholds';

const here = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Sum of gzip sizes of the emitted JS/wasm modules (source maps excluded). */
export function gzipSizeOf(outdir: string): { rawBytes: number; gzBytes: number; files: number } {
  const files = walk(outdir).filter((f) => /\.(m?js|wasm)$/.test(f));
  let rawBytes = 0;
  let gzBytes = 0;
  for (const f of files) {
    const buf = readFileSync(f);
    rawBytes += buf.length;
    gzBytes += gzipSync(buf, { level: 9 }).length;
  }
  return { rawBytes, gzBytes, files: files.length };
}

export function dryRunBundle(entry: string): { rawBytes: number; gzBytes: number; files: number } {
  const scratch = mkdtempSync(join(tmpdir(), 'aduin-s06-'));
  try {
    const config = join(scratch, 'wrangler.jsonc');
    writeFileSync(
      config,
      JSON.stringify({
        name: 'aduin-transaction-spike-s06',
        main: entry,
        compatibility_date: '2026-10-01',
        workers_dev: true,
      }),
    );
    const outdir = join(scratch, 'out');
    execFileSync(
      'pnpm',
      ['exec', 'wrangler', 'deploy', '--dry-run', '--config', config, '--outdir', outdir],
      {
        cwd: resolve(here, '../../..'),
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
      },
    );
    return gzipSizeOf(outdir);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const size = dryRunBundle(join(here, 'entry.ts'));
    const verdict = judgeS6Size(size.gzBytes);
    console.log(
      JSON.stringify(
        {
          spike: 'S6-local',
          bundles: 'route table + zod + @noble/hashes',
          files: size.files,
          rawKiB: Math.round(size.rawBytes / 1024),
          gzKiB: Math.round(size.gzBytes / 1024),
          passBelowMiB: S6_LIMITS.passBytes / MiB,
          killAboveMiB: S6_LIMITS.killBytes / MiB,
          verdict,
        },
        null,
        2,
      ),
    );
    process.exit(verdict === 'FAIL' ? 1 : 0);
  } catch (err) {
    console.error('spike:s06-local error:', err instanceof Error ? err.message : String(err));
    process.exit(2);
  }
}
