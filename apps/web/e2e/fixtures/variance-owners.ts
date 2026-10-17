import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, type Locator, type Page } from '@playwright/test';
import type { UploadFile } from './package';
import { changeRows, uploadOne, varianceSettled } from './variance';

/**
 * Variance Phase 04: owners, per-owner questions, answers and the R-01 regression (V4-owned; V5
 * appends only). Documents are the authored Hartwell & Crane fixtures (fund I / II / III); the
 * preview build keeps the Dexie stub memory, which stores firm-template checks like the Worker.
 */
export const HC = 'Hartwell & Crane LLP';
const ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const HC_DIR = join(ROOT, 'fixtures', 'variance', 'hartwell-crane');

export function hcFile(name: string, as?: string): UploadFile {
  return { name: as ?? name, buffer: readFileSync(join(HC_DIR, name)) };
}

/** Upload one Hartwell & Crane fund document and wait until variance settled. */
export async function openHc(page: Page, file: string, fund: string, firm = HC) {
  await uploadOne(page, hcFile(file), { firm, fund });
  await varianceSettled(page);
}

/** Fund II (baseline) then Fund III: the seven authored change rows. */
export async function openFundIIIvsII(page: Page) {
  await openHc(page, 'fund-II.html', 'Fund II');
  await openHc(page, 'fund-III.html', 'Fund III');
  await expect(changeRows(page)).toHaveCount(7);
}

/** The change row whose title matches. */
export function changeRow(page: Page, title: RegExp): Locator {
  return changeRows(page).filter({ hasText: title });
}

/** Expand a change row and press Ask owner (the sticky bar acts on the open row; it sits outside the body). */
export async function askOwner(page: Page, title: RegExp) {
  await changeRow(page, title).click();
  await expect(changeRow(page, title)).toHaveAttribute('aria-expanded', 'true');
  await page.getByTestId('action-counsel').click();
}

export async function gotoQuestions(page: Page) {
  await page.getByTestId('nav-counsel').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Questions' })).toBeVisible();
}

/** A question row on the Questions screen by its question key (`<findingId>@<owner>`). */
export const questionRow = (page: Page, key: string) =>
  page.locator(`[data-testid="counsel-row"][data-key="${key}"]`);

/** All question rows of one owner on the Questions screen. */
export const ownerRows = (page: Page, owner: string) =>
  page.locator(`[data-testid="counsel-row"][data-owner="${owner}"]`);

/**
 * Record an answer on an open question row (Questions screen): option, intent, scope. Reused by V5
 * (`recordFirmTemplateAnswer`).
 */
export async function recordAnswer(
  page: Page,
  row: Locator,
  o: {
    option?: 'A' | 'B' | 'C' | 'unclear';
    intent?: string;
    scope?: 'fund' | 'firm';
    note?: string;
  },
) {
  if ((await row.getAttribute('class'))?.includes('sel') !== true)
    await row.getByTestId('counsel-row-toggle').click();
  await row.getByTestId('counsel-record').click();
  const form = row.getByTestId('answer-form');
  const idx = { A: 0, B: 1, C: 2, unclear: 3 }[o.option ?? 'A'];
  await form.getByTestId('answer-option').nth(idx).check();
  if (o.note !== undefined) await form.getByTestId('answer-note').fill(o.note);
  if (o.intent !== undefined) await form.getByTestId('answer-intent').fill(o.intent);
  if (o.scope === 'firm') await form.getByTestId('answer-scope-firm').check();
  if (o.scope === 'fund') await form.getByTestId('answer-scope-fund').check();
  await form.getByTestId('answer-save').click();
}

export async function recordFirmTemplateAnswer(page: Page, row: Locator, intent: string) {
  await recordAnswer(page, row, { option: 'A', intent, scope: 'firm' });
  await expect(row.getByTestId('counsel-answer')).toBeVisible();
}

/** Stub memory values (the Dexie stub API keeps them in `uiState`) whose key starts with a prefix. */
export async function stubRows<T>(page: Page, prefix: string): Promise<T[]> {
  return page.evaluate(
    (p) =>
      new Promise<unknown[]>((done, fail) => {
        const req = indexedDB.open('aduin-web');
        req.onerror = () => fail(new Error('idb'));
        req.onsuccess = () => {
          const db = req.result;
          const out: unknown[] = [];
          const cur = db.transaction(['uiState'], 'readonly').objectStore('uiState').openCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return done(out);
            if (String(c.key).startsWith(p)) out.push((c.value as { value: unknown }).value);
            c.continue();
          };
          cur.onerror = () => fail(new Error('cursor'));
        };
      }),
    prefix,
  ) as Promise<T[]>;
}
