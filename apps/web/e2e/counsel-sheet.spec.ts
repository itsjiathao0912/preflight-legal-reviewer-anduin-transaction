import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  blockOpenRouter,
  enableLane,
  hb,
  interceptAi,
  interceptQuota,
  MODEL,
  ndjson,
} from './fixtures/ai';
import { gotoApp } from './fixtures/app';
import {
  counselRow,
  EXPECT,
  findingByQuote,
  gotoCounsel,
  gotoFindings,
  markAccepted,
  markCounsel,
  openFund,
} from './fixtures/counsel';

// AC20: the counsel sheet is drafted (template, no AI) and editable; the AI draft replays the
// committed counsel-draft recording through /api/ai (Hybrid: recorded, never live); Already
// answered / Awaiting counsel never appear as questions (see memory-prior-answer).
const q = (key: string) =>
  findingByQuote(
    'fund-II',
    EXPECT.passages.find((p) => p.key === key && p.fund === 'fund-II')!.quote,
  );

const REC_DIR = resolve(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'fixtures',
  'llm-recordings',
  'counsel-draft',
);
const recordedDrafts = (): string[] =>
  readdirSync(REC_DIR).flatMap((n) =>
    (
      JSON.parse(readFileSync(resolve(REC_DIR, n), 'utf8')) as {
        response: { parsed: { drafts: { text: string }[] } };
      }
    ).response.parsed.drafts.map((d) => d.text),
  );

test.describe('counsel-sheet', () => {
  test('no-AI template draft: Needs counsel and Accepted critical findings become questions', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFund(page, 'fund-II');
    const a = q('n1-new-placeholder');
    const crit = q('p6-edited-section-ref');
    const other = q('n2-new-drafting-note');
    await markCounsel(page, a.id);
    await markAccepted(page, crit.id); // critical + Accepted = a question
    await markAccepted(page, other.id); // medium + Accepted = not a question
    await gotoCounsel(page);
    await expect(page.getByTestId('counsel-meta')).toHaveText('2 questions · 2 unanswered');
    await expect(page.getByTestId('counsel-row')).toHaveCount(2);
    await expect(counselRow(page, a.id)).toHaveAttribute('data-state', 'new');
    await expect(counselRow(page, crit.id)).toHaveAttribute('data-state', 'accepted');
    await expect(counselRow(page, other.id)).toHaveCount(0);
    await counselRow(page, a.id).getByTestId('counsel-row-toggle').click();
    const r = counselRow(page, a.id);
    await expect(r.getByTestId('counsel-template-chip')).toHaveText('Template draft');
    await expect(r.getByTestId('counsel-quote')).toContainText(a.quote);
    expect(await r.getByTestId('counsel-interp').count()).toBeGreaterThanOrEqual(2);
    // no AI lane (no API base): the template draft stays and the user is told
    await page.getByTestId('counsel-ai-draft').click();
    await expect(page.getByText('The AI draft is not available right now.')).toBeVisible();
    await expect(page.getByTestId('counsel-ai-draft')).toHaveAttribute('aria-pressed', 'false');
    await expect(r.getByTestId('counsel-template-chip')).toBeVisible();
  });

  test('edit wording: saved, marked "Edited by you", persists across reload, reset restores', async ({
    page,
  }) => {
    await gotoApp(page);
    await openFund(page, 'fund-II');
    const a = q('n1-new-placeholder');
    await markCounsel(page, a.id);
    await gotoCounsel(page);
    const r = counselRow(page, a.id);
    const template = (await r.getByTestId('counsel-question-text').textContent())!;
    await r.getByTestId('counsel-row-toggle').click();
    await r.getByTestId('counsel-edit').click();
    await r.getByTestId('counsel-edit-text').fill('Please confirm who fills in the investor name.');
    await r.getByTestId('counsel-edit-save').click();
    await expect(r.getByTestId('counsel-question-text')).toHaveText(
      'Please confirm who fills in the investor name.',
    );
    await expect(r.getByTestId('counsel-edited-chip')).toBeVisible();
    // Escape cancels an edit without saving
    await r.getByTestId('counsel-edit').click();
    await r.getByTestId('counsel-edit-text').fill('discard me');
    await r.getByTestId('counsel-edit-text').press('Escape');
    await expect(r.getByTestId('counsel-question-text')).toHaveText(
      'Please confirm who fills in the investor name.',
    );

    await page.reload();
    await openFund(page, 'fund-II');
    await gotoCounsel(page);
    await expect(counselRow(page, a.id).getByTestId('counsel-question-text')).toHaveText(
      'Please confirm who fills in the investor name.',
    );
    await counselRow(page, a.id).getByTestId('counsel-row-toggle').click();
    await counselRow(page, a.id).getByTestId('counsel-edit').click();
    await counselRow(page, a.id).getByTestId('counsel-edit-reset').click();
    await expect(counselRow(page, a.id).getByTestId('counsel-question-text')).toHaveText(template);
  });

  test('AI draft (recorded): drafts replace the template wording with an AI suggestion chip', async ({
    page,
  }) => {
    const texts = recordedDrafts();
    const openrouter = await blockOpenRouter(page);
    await gotoApp(page);
    await interceptQuota(page);
    const calls = await interceptAi(page, (call) => {
      if (call.body.task !== 'counsel-draft')
        return {
          kind: 'stream',
          body: ndjson(hb, {
            t: 'result',
            kind: 'ai',
            data: { v: 1, findings: [] },
            cache: 'miss',
            model: MODEL,
          }),
        };
      const drafts = call.body.candidates.map((c, i) => ({
        candidate_id: c.id,
        text: texts[i % texts.length]!,
      }));
      return {
        kind: 'stream',
        body: ndjson(hb, {
          t: 'result',
          kind: 'ai',
          data: { v: 1, drafts },
          cache: 'miss',
          model: MODEL,
        }),
      };
    });
    await enableLane(page);
    await openFund(page, 'fund-II');
    const a = q('n1-new-placeholder');
    await gotoFindings(page);
    await markCounsel(page, a.id);
    await gotoCounsel(page);
    await page.getByTestId('counsel-ai-draft').click();
    await expect(page.getByTestId('counsel-ai-draft')).toHaveAttribute('aria-pressed', 'true');
    const draftCall = calls.find((c) => c.body.task === 'counsel-draft')!;
    expect(draftCall.body.law_firm_id).toBeNull();
    expect(draftCall.body.candidates.map((c) => c.id)).toEqual([a.id]);
    const r = counselRow(page, a.id);
    await expect(r.getByTestId('counsel-question-text')).toHaveText(texts[0]!);
    await r.getByTestId('counsel-row-toggle').click();
    await expect(r.getByTestId('counsel-ai-chip')).toBeVisible();
    await expect(r.getByTestId('counsel-provenance')).toContainText(MODEL);
    // toggle back to the template draft
    await page.getByTestId('counsel-ai-draft').click();
    await expect(r.getByTestId('counsel-template-chip')).toBeVisible();
    expect(openrouter).toEqual([]);
  });
});
