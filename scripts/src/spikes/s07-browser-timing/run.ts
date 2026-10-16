// S7 spike: browser timing for the largest HTML sample (#2) and PDF/scan page rendering.
// Usage: pnpm --filter @aduin/scripts spike:s07  (exit 1 when a kill threshold fires)
import { chromium } from '@playwright/test';
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { judgeS7, S7_LIMITS } from './thresholds';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(here, '../../../..');
const raw = join(repoRoot, 'samples/sub-docs/raw');
const SAMPLE_2 = join(raw, '02-coatue-innovation-fund-2025.htm');
const ILPA_PDF = join(raw, '14-ilpa-model-subscription-agreement-2018.pdf'); // gitignored, local-only
const SCANS = join(raw, '09-rw-holdings-scans');
const require = createRequire(import.meta.url);
const PDF_WORKER = require.resolve('pdfjs-dist/build/pdf.worker.mjs');

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
};

async function bundle(): Promise<string> {
  const out = await build({
    entryPoints: [join(here, 'browser-entry.ts')],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    write: false,
    logLevel: 'silent',
  });
  const file = out.outputFiles[0];
  if (!file) throw new Error('esbuild produced no output');
  return file.text;
}

function serve(files: Map<string, string | Buffer>): Promise<{ server: Server; base: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const body = files.get((req.url ?? '/').split('?')[0] ?? '/');
      if (body === undefined) {
        res.writeHead(404).end();
        return;
      }
      const type = TYPES[extname(req.url ?? '')] ?? 'text/html';
      res.writeHead(200, { 'content-type': type }).end(body);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      ok({ server, base: `http://127.0.0.1:${port}` });
    });
  });
}

const round = (n: number) => Math.round(n);

async function main(): Promise<number> {
  if (!existsSync(SAMPLE_2)) throw new Error(`missing sample #2: ${SAMPLE_2}`);
  const scans = existsSync(SCANS)
    ? readdirSync(SCANS)
        .filter((f) => f.endsWith('.jpg'))
        .sort()
    : [];
  const files = new Map<string, string | Buffer>([
    [
      '/',
      '<!doctype html><html><body><script type="module" src="/entry.js"></script></body></html>',
    ],
    ['/entry.js', await bundle()],
    ['/pdf.worker.mjs', readFileSync(PDF_WORKER)],
    ['/sample2.htm', readFileSync(SAMPLE_2)],
  ]);
  const hasPdf = existsSync(ILPA_PDF);
  if (hasPdf) files.set('/ilpa.pdf', readFileSync(ILPA_PDF));
  for (const f of scans) files.set(`/scans/${f}`, readFileSync(join(SCANS, f)));

  const { server, base } = await serve(files);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(base);
    await page.waitForFunction(() => 's07' in window);
    type Probe = {
      timeParseMerge(u: string): Promise<{ ms: number; bytes: number; rows: number }>;
      renderPdf(u: string, w: string): Promise<number[]>;
      downscaleJpegs(u: string[]): Promise<number[]>;
    };
    // Warm-up run (JIT), then the measured run; record the measured (second) run.
    const parse = await page.evaluate(async () => {
      const p = (window as unknown as { s07: Probe }).s07;
      await p.timeParseMerge('/sample2.htm');
      return p.timeParseMerge('/sample2.htm');
    });
    const pdfMs = hasPdf
      ? await page.evaluate(
          (w) => (window as unknown as { s07: Probe }).s07.renderPdf('/ilpa.pdf', w),
          `${base}/pdf.worker.mjs`,
        )
      : [];
    const scanMs = await page.evaluate(
      (urls) => (window as unknown as { s07: Probe }).s07.downscaleJpegs(urls),
      scans.map((f) => `/scans/${f}`),
    );

    const pages = [...pdfMs, ...scanMs];
    const { verdict, worstPageMs } = judgeS7({ parseMergeMs: parse.ms, pageRenderMs: pages });
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const result = {
      spike: 'S7',
      chromium: browser.version(),
      sample2: { bytes: parse.bytes, rows: parse.rows, parseMergeMs: round(parse.ms) },
      pdf: hasPdf
        ? { pages: pdfMs.length, avgMs: round(avg(pdfMs)), maxMs: round(Math.max(...pdfMs)) }
        : 'ILPA PDF not present locally (gitignored); skipped',
      scans: {
        pages: scanMs.length,
        avgMs: round(avg(scanMs)),
        maxMs: round(Math.max(0, ...scanMs)),
      },
      worstPageMs: round(worstPageMs),
      limits: S7_LIMITS,
      verdict,
    };
    console.log(JSON.stringify(result, null, 2));
    return verdict === 'FAIL' ? 1 : 0;
  } finally {
    await browser.close();
    server.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error('spike:s07 error:', err instanceof Error ? err.message : String(err));
    process.exit(2);
  },
);
