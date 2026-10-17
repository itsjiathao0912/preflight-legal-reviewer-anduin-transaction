import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analyzeHtml,
  locateQuote,
  rangesOverlap,
  runDeterministic,
  verifyAiResult,
  type Finding,
} from '@aduin/core';
import { expect, test, type Page } from '@playwright/test';
import {
  aiRows,
  blockOpenRouter,
  enableLane,
  expectStage,
  hb,
  interceptAi,
  interceptQuota,
  ndjson,
  recording,
  resultFrame,
} from './fixtures/ai';
import { gotoApp, openSample } from './fixtures/app';

// AC12 (ai-review-stream-dedup): the app never shows an AI row that repeats a deterministic
// finding, and the AI lane count equals the AI rows shown. Case (i) replays the authored
// `ai-duplicate-of-rule` recording: its duplicate cites a candidate id the engine no longer sends
// (rule sentences are not AI candidates), so it is rejected by the verify chain (not suppressed by
// dropRuleDuplicates; that path is proven by the core unit test on synthetic input).
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const RAW = resolve(ROOT, 'samples', 'sub-docs', 'raw');
const PRE = resolve(ROOT, 'apps', 'web', 'public', 'precomputed');

function sample01() {
  const f = readdirSync(RAW).find((n) => n.startsWith('01-') && n.endsWith('.htm'))!;
  const g = analyzeHtml(new Uint8Array(readFileSync(resolve(RAW, f))));
  return { g, rules: runDeterministic(g).filter((x) => x.detector_kind === 'rule') };
}

function overlapsRule(f: Pick<Finding, 'anchor'>, rules: readonly Finding[]): boolean {
  return rules.some(
    (r) =>
      r.anchor.blockId === f.anchor.blockId &&
      rangesOverlap(
        f.anchor.offsetStart,
        f.anchor.offsetEnd,
        r.anchor.offsetStart,
        r.anchor.offsetEnd,
      ),
  );
}

async function laneCount(page: Page): Promise<number> {
  await page.getByTestId('stage-status-button').click();
  const sub = page.locator('[data-testid="stage-item"][data-stage="ai"] .sub');
  await expect(sub).toContainText(/AI suggestion/);
  const m = /(\d+) AI suggestion/.exec((await sub.textContent()) ?? '');
  await page.keyboard.press('Escape');
  return Number(m?.[1] ?? -1);
}

test.describe('ai-no-duplicates', () => {
  test('should show no AI row that overlaps a rule row and a lane count equal to the rows shown', async ({
    page,
  }) => {
    const rec = recording('ai-duplicate-of-rule');
    const findings = rec.response.parsed.findings;
    // precondition: the second finding's quote really sits in a rule-flagged sentence
    const { g, rules } = sample01();
    const dupQuote = String(findings[1]!['quote']);
    const loc = locateQuote(g, dupQuote)!;
    expect(loc).not.toBeNull();
    const blockId = g.structure.blocks[loc.blockIndex]!.id;
    expect(
      overlapsRule(
        { anchor: { ...rules[0]!.anchor, blockId, offsetStart: loc.start, offsetEnd: loc.end } },
        rules,
      ),
    ).toBe(true);

    await gotoApp(page);
    await interceptQuota(page);
    const outbound = await blockOpenRouter(page);
    await page.route('**/precomputed/**', (r) => r.fulfill({ status: 404, body: '' }));
    const calls = await interceptAi(page, () => ({
      kind: 'stream',
      body: ndjson(hb, resultFrame(findings, 'miss', rec.meta.served_model)),
    }));
    await enableLane(page);
    await openSample(page, '01');
    await page.getByTestId('ai-run-sample').click();
    await expectStage(page, /^Checks done · AI review done/);
    await expect(aiRows(page)).toHaveCount(1);
    await expect(aiRows(page).filter({ hasText: 'Section 11' })).toHaveCount(0);
    expect(await laneCount(page)).toBe(await aiRows(page).count());
    expect(calls).toHaveLength(1);
    expect(outbound).toEqual([]);
  });

  test('bundled sample #1 (precomputed path) shows no AI row overlapping a rule finding', async ({
    page,
  }) => {
    const { g, rules } = sample01();
    const pre = readdirSync(PRE)
      .filter((n) => n.endsWith('.json'))
      .map((n) => JSON.parse(readFileSync(resolve(PRE, n), 'utf8')) as Record<string, unknown>)
      .find((j) => j['sample'] === '01')!;
    // every AI finding the precomputed file can produce, with its anchor (no dedupe applied)
    const all = verifyAiResult(g, pre['result'], {
      model: String(pre['model']),
      provenance: 'cache',
    });
    if (!all.ok) throw new Error('schema');
    const anchorById = new Map(all.findings.map((f) => [f.id, f]));

    await gotoApp(page);
    await interceptQuota(page);
    const outbound = await blockOpenRouter(page);
    await enableLane(page);
    await openSample(page, '01');
    await expectStage(page, /^Checks done · AI review from cache/);
    const ids = await aiRows(page).evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-finding-id') ?? ''),
    );
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const f = anchorById.get(id);
      expect(f, `AI row ${id} comes from the precomputed file`).toBeDefined();
      expect(overlapsRule(f!, rules), `AI row ${id} overlaps a rule finding`).toBe(false);
    }
    expect(await laneCount(page)).toBe(ids.length);
    expect(outbound).toEqual([]);
  });
});
