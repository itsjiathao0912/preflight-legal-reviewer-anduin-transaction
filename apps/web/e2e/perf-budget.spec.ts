import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { gotoApp, openDialog, sample } from './fixtures/app';
import { hcFile, openHc } from './fixtures/variance-owners';
import { changeRows, uploadOne } from './fixtures/variance';

/**
 * AC29 (perf-budget-corpus). Timings are measured IN-PAGE (performance.now) from the click on the
 * sample in the Open a document dialog to the stage line reading "Checks done", on the e2e-mode
 * bundle (`vite build --mode e2e`, served by `vite preview`) in Desktop Chromium on this machine.
 * They do not prove timings on the deployed edge or slow client hardware. If a run flakes, re-run
 * this spec alone (serially) and record the printed numbers in the phase report.
 *
 * Samples are picked from the generated manifest by size: the largest (~380 KB) must finish under
 * 5 s, the one closest to 50 KB under 2 s. The 22-page scan set's per-page progress is proven by
 * the existing `scan-set-smoke` spec.
 */
const BUNDLE_LABEL = 'e2e-mode bundle (vite --mode e2e, vite preview, Desktop Chromium)';
const SAMPLES = resolve(import.meta.dirname, '..', 'public', 'samples');

interface Entry {
  id: string;
  kind: string;
  file?: string;
  disabled?: boolean;
}

function htmlSamplesBySize(): { id: string; bytes: number }[] {
  const raw = JSON.parse(readFileSync(resolve(SAMPLES, 'manifest.json'), 'utf8')) as
    Entry[] | { samples: Entry[] };
  const list = Array.isArray(raw) ? raw : raw.samples;
  return list
    .filter((e) => !e.disabled && e.kind === 'html')
    .filter((e) => typeof e.file === 'string' && /\.html?$/i.test(e.file))
    .map((e) => ({ id: e.id, bytes: readFileSync(resolve(SAMPLES, e.file!)).byteLength }))
    .sort((a, b) => b.bytes - a.bytes);
}

/** Open a sample and return the in-page milliseconds from the click to "Checks done". */
async function timeOpen(page: Page, id: string): Promise<number> {
  await openDialog(page);
  await page.evaluate(() => {
    const w = window as unknown as { __perf?: { t0?: number; t1?: number } };
    w.__perf = {};
    document.addEventListener(
      'click',
      (e) => {
        if ((e.target as Element | null)?.closest('[data-testid="sample-option"]'))
          w.__perf!.t0 = performance.now();
      },
      { capture: true, once: true },
    );
    const done = () => {
      const el = document.querySelector('[data-testid="stage-status-button"]');
      if (w.__perf!.t0 !== undefined && el && /Checks done/.test(el.textContent ?? '')) {
        w.__perf!.t1 = performance.now();
        return true;
      }
      return false;
    };
    const mo = new MutationObserver(() => {
      if (done()) mo.disconnect();
    });
    mo.observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await sample(page, id).click();
  await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
    timeout: 30_000,
  });
  const ms = await page.evaluate(() => {
    const p = (window as unknown as { __perf: { t0?: number; t1?: number } }).__perf;
    return p.t0 !== undefined && p.t1 !== undefined ? p.t1 - p.t0 : NaN;
  });
  expect(Number.isFinite(ms), 'in-page timing captured').toBe(true);
  return ms;
}

test.describe('perf-budget', () => {
  test.describe.configure({ mode: 'serial' });

  test('should open the largest sample within five seconds', async ({ page }, testInfo) => {
    const [largest] = htmlSamplesBySize();
    expect(largest, 'an HTML sample exists').toBeDefined();
    expect(largest!.bytes).toBeGreaterThan(300_000);
    await gotoApp(page);
    const ms = await timeOpen(page, largest!.id);
    const line = `[perf-budget] ${BUNDLE_LABEL}: sample ${largest!.id} (${largest!.bytes} B) open->Checks done ${ms.toFixed(0)} ms (budget 5000)`;
    console.log(line);
    testInfo.annotations.push({ type: 'perf', description: line });
    expect(ms).toBeLessThan(5_000);
  });

  test('should open the ~50 KB sample within two seconds', async ({ page }, testInfo) => {
    const near = [...htmlSamplesBySize()].sort(
      (a, b) => Math.abs(a.bytes - 50_000) - Math.abs(b.bytes - 50_000),
    )[0]!;
    expect(near.bytes).toBeLessThan(80_000);
    await gotoApp(page);
    const ms = await timeOpen(page, near.id);
    const line = `[perf-budget] ${BUNDLE_LABEL}: sample ${near.id} (${near.bytes} B) open->Checks done ${ms.toFixed(0)} ms (budget 2000)`;
    console.log(line);
    testInfo.annotations.push({ type: 'perf', description: line });
    expect(ms).toBeLessThan(2_000);
  });

  // Variance Phase 05 (D1, additive): Fund III against the Fund II baseline (demo pair). Measured
  // in-page from the Open click to the errors painted, then to the 7 change rows (variance settled).
  test('should show Fund III variance within the 5 second deterministic target', async ({
    page,
  }, testInfo) => {
    await gotoApp(page);
    await openHc(page, 'fund-II.html', 'Fund II');
    await page.evaluate(() => {
      const w = window as unknown as {
        __vperf?: { t0?: number; errors?: number; changes?: number };
      };
      w.__vperf = {};
      document.addEventListener(
        'click',
        (e) => {
          if (
            w.__vperf!.t0 === undefined &&
            (e.target as Element | null)?.closest('[data-testid="open-submit"]')
          )
            w.__vperf!.t0 = performance.now();
        },
        { capture: true },
      );
      const mo = new MutationObserver(() => {
        const p = w.__vperf!;
        if (p.t0 === undefined) return;
        const stage = document.querySelector('[data-testid="stage-status-button"]');
        if (p.errors === undefined && /Checks done/.test(stage?.textContent ?? ''))
          p.errors = performance.now();
        if (
          document.querySelectorAll('[data-testid="finding-row"][data-kind="change"]').length >= 7
        ) {
          p.changes = performance.now();
          mo.disconnect();
        }
      });
      mo.observe(document.body, { subtree: true, childList: true });
    });
    await uploadOne(page, hcFile('fund-III.html'), {
      firm: 'Hartwell & Crane LLP',
      fund: 'Fund III',
    });
    await expect(changeRows(page)).toHaveCount(7, { timeout: 30_000 });
    // the pair has no error findings: "errors painted" is the Checks done stage line
    await expect(page.getByTestId('stage-status-button')).toContainText('Checks done');
    const t = await page.evaluate(
      () =>
        (window as unknown as { __vperf: { t0?: number; errors?: number; changes?: number } })
          .__vperf,
    );
    expect(t.t0, 'click captured').toBeDefined();
    expect(t.changes, 'changes painted').toBeDefined();
    const errMs = (t.errors ?? t.changes!) - t.t0!;
    const chMs = t.changes! - t.t0!;
    const line = `[perf-budget] ${BUNDLE_LABEL}: variance Fund III vs Fund II open->checks done ${errMs.toFixed(0)} ms, ->7 changes ${chMs.toFixed(0)} ms (budget 5000)`;
    console.log(line);
    testInfo.annotations.push({ type: 'perf', description: line });
    expect(errMs).toBeLessThanOrEqual(chMs);
    expect(chMs).toBeLessThan(5_000);
  });
});
