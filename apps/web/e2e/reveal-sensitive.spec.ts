import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeHtml, quoteHash, runDeterministic, sensitiveSpans } from '@aduin/core';
import { expect, test } from '@playwright/test';
import { gotoApp, openSample, row } from './fixtures/app';

/**
 * reveal-sensitive (AC10): real ABA/DDA flags on sample #1 are masked by default in the list and the
 * document; Reveal shows the value; quote_hash and snippet never hold the raw value. The raw value is
 * derived at runtime from the sample text (no number is written in this file).
 */
const RAW = resolve(import.meta.dirname, '..', '..', '..', 'samples', 'sub-docs', 'raw');
const file = readdirSync(RAW).find((f) => f.startsWith('01-') && f.endsWith('.htm'))!;
const g = analyzeHtml(readFileSync(resolve(RAW, file)));
const flags = runDeterministic(g).filter((f) => f.detector_id === 'flag-sensitive');
const rawOf = (blockId: string) => {
  const b = g.doc.blocks.find((x) => x.id === blockId)!;
  const text = b.lines.map((l) => l.text).join(' ');
  const s = sensitiveSpans(text)[0]!;
  return { text, raw: text.slice(s.start, s.end) };
};

test.describe('reveal-sensitive', () => {
  test('engine output: quote, snippet, facts and quote_hash never hold the raw value', () => {
    expect(flags.map((f) => f.detail.facts.kind)).toEqual(['aba', 'dda']);
    for (const f of flags) {
      const { text, raw } = rawOf(f.anchor.blockId);
      const digits = raw.replace(/\D/g, '');
      expect(digits.length).toBeGreaterThanOrEqual(6);
      const json = JSON.stringify(f);
      expect(json).not.toContain(raw);
      expect(json.replace(/\D/g, ' ')).not.toContain(digits);
      expect(f.quote_snippet).toContain(String(f.detail.facts.last4));
      expect(f.quote_hash).toBe(quoteHash(f.quote));
      expect(f.quote_hash).not.toBe(
        quoteHash(text.slice(f.anchor.offsetStart, f.anchor.offsetEnd)),
      );
    }
  });

  test('masked by default in list and document; reveal shows value; hide masks again', async ({
    page,
  }) => {
    await gotoApp(page);
    await openSample(page, '01');
    const pane = page.getByTestId('doc-pane');
    for (const f of flags) {
      const { raw } = rawOf(f.anchor.blockId);
      const r = row(page, f.id);
      await expect(r).toBeVisible();
      await expect(r).not.toContainText(raw);
      await expect(pane).not.toContainText(raw);
      await expect(
        pane.locator('.mask', { hasText: String(f.detail.facts.last4) }).first(),
      ).toBeVisible();
    }
    const [aba] = flags;
    const { raw } = rawOf(aba!.anchor.blockId);
    await row(page, aba!.id).click();
    const q = page.getByTestId('finding-quote');
    await expect(q).toContainText(String(aba!.detail.facts.last4));
    await expect(q).not.toContainText(raw);
    await page.getByTestId('reveal-toggle').click();
    await expect(q).toContainText(raw);
    await expect(pane).toContainText(raw);
    await page.getByTestId('reveal-toggle').click();
    await expect(q).not.toContainText(raw);
    await expect(pane).not.toContainText(raw);
    // the row snippet and title stay masked throughout
    await expect(page.getByTestId('finding-title').first()).not.toContainText(raw);
  });
});
