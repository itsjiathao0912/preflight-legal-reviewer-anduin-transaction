import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeHtml, fingerprintFor, runDeterministic, type Finding } from '@aduin/core';
import { expect, type Page } from '@playwright/test';
import mammoth from 'mammoth';
import { memorySettled, openDialog, row } from './app';
import { seedMemory, type SeedDecision } from './seedMemory';

/**
 * Phase 08 S3 helpers: counsel questions view, DOCX export parse-back, and the seeded fund fixtures
 * (`fixtures/memory/fund-{I,II,Y}.html`, Firm X / Firm Y) whose expected labels and fingerprints live
 * in `fixtures/memory/fund-expectations.json` (generated from real engine output).
 */
const MEM = resolve(import.meta.dirname, '..', '..', '..', '..', 'fixtures', 'memory');

export type FundId = 'fund-I' | 'fund-II' | 'fund-Y';

interface Expectations {
  funds: Record<FundId, { file: string; firm_id: string; fund_name: string; findings: number }>;
  summary: {
    fund_II_findings: number;
    handled: number;
    need_action: number;
    fewer_to_review_pct: number;
    previously_dismissed: number;
    already_answered: number;
  };
  passages: {
    key: string;
    quote: string;
    fund: FundId;
    firm_id: string;
    fingerprint: string;
    label: string;
    category: string;
  }[];
}

interface FixtureDecision {
  quote: string;
  fingerprint: string;
  decided_by_name: string;
  decision: 'dismissed' | 'answered';
  reason_code?: SeedDecision['reason'];
  counsel_option?: SeedDecision['option'];
}

const readJson = <T>(name: string): T => JSON.parse(readFileSync(resolve(MEM, name), 'utf8')) as T;

export const EXPECT = readJson<Expectations>('fund-expectations.json');
export const FIRM_NAME: Record<string, string> = { 'firm-x': 'Firm X', 'firm-y': 'Firm Y' };

export function fundHtml(fund: FundId): Buffer {
  return readFileSync(resolve(MEM, EXPECT.funds[fund].file));
}

export function fundFindings(fund: FundId): Finding[] {
  return runDeterministic(analyzeHtml(fundHtml(fund)));
}

export function findingByQuote(fund: FundId, quote: string): Finding {
  const f = fundFindings(fund).find((x) => x.quote === quote);
  if (!f) throw new Error(`no ${fund} finding quoting ${quote}`);
  return f;
}

/** Fund I decisions + counsel answers (Firm X), seeded into the stub with engine fingerprints. */
export async function seedFundI(page: Page): Promise<void> {
  const decisions = readJson<{ decisions: FixtureDecision[] }>('fund-I-decisions.json').decisions;
  const answers = readJson<{ answers: FixtureDecision[] }>('fund-I-answers.json').answers;
  const seeds: SeedDecision[] = [...decisions, ...answers].map((d) => {
    const finding = findingByQuote('fund-I', d.quote);
    // the fixture fingerprint is the real engine fingerprint (never a hand-made string)
    expect(fingerprintFor(finding, 'firm-x')).toBe(d.fingerprint);
    return {
      finding,
      firmId: 'firm-x',
      decision: d.decision,
      fund: EXPECT.funds['fund-I'].fund_name,
      who: d.decided_by_name,
      ...(d.reason_code ? { reason: d.reason_code } : {}),
      ...(d.counsel_option ? { option: d.counsel_option } : {}),
    };
  });
  await seedMemory(page, seeds);
}

/** Upload a fund fixture through the Open a document dialog, tagged with its law firm. */
export async function openFund(page: Page, fund: FundId, firmOverride?: string): Promise<void> {
  const meta = EXPECT.funds[fund];
  await openDialog(page);
  await page.getByTestId('upload-input').setInputFiles({
    name: meta.file,
    mimeType: 'text/html',
    buffer: fundHtml(fund),
  });
  await page.getByTestId('firm-combobox').fill(firmOverride ?? FIRM_NAME[meta.firm_id]!);
  await page.getByTestId('fund-input').fill(meta.fund_name);
  await page.getByTestId('version-input').fill('2026');
  await page.getByTestId('privacy-ack').check();
  await page.getByTestId('open-submit').click();
  await expect(page.getByTestId('stage-status-button')).toContainText('Checks done', {
    timeout: 30_000,
  });
  await memorySettled(page);
  await expect(page.getByTestId('loading-state')).toHaveCount(0);
}

export const counselRow = (page: Page, id: string) =>
  page.locator(`[data-testid="counsel-row"][data-finding-id="${id}"]`);
export const priorItem = (page: Page, id: string) =>
  page.locator(`[data-testid="counsel-prior"][data-finding-id="${id}"]`);
export const gateReason = (page: Page, id: string) =>
  page.locator(`[data-testid="gate-reason"][data-finding-id="${id}"]`);

export async function gotoCounsel(page: Page): Promise<void> {
  await page.getByTestId('nav-counsel').click();
  await expect(page.getByTestId('counsel-view')).toBeVisible();
}

export async function gotoFindings(page: Page): Promise<void> {
  await page.getByTestId('nav-findings').click();
  await expect(page.getByTestId('findings-meta')).toBeVisible();
}

/** Findings screen: mark a finding Needs counsel. */
export async function markCounsel(page: Page, id: string): Promise<void> {
  await row(page, id).click();
  await page.getByTestId('action-counsel').click();
  await expect(row(page, id)).toHaveAttribute('data-status', 'counsel');
}

/** Findings screen: accept a finding. */
export async function markAccepted(page: Page, id: string): Promise<void> {
  await row(page, id).click();
  await page.getByTestId('action-accept').click();
  await expect(row(page, id)).toHaveAttribute('data-status', 'accepted');
}

/** Counsel view: open a question and record counsel's answer through the form. */
export async function answerQuestion(
  page: Page,
  id: string,
  option: 'A' | 'B' | 'C' | 'unclear',
  note?: string,
): Promise<void> {
  const r = counselRow(page, id);
  if ((await r.getByTestId('counsel-row-toggle').getAttribute('aria-expanded')) !== 'true')
    await r.getByTestId('counsel-row-toggle').click();
  await r.getByTestId('counsel-record').click();
  const form = page.locator(`[data-testid="answer-form"][data-finding-id="${id}"]`);
  await form.locator(`[data-testid="answer-option"][value="${option}"]`).check();
  if (note) await form.getByTestId('answer-note').fill(note);
  await form.getByTestId('answer-save').click();
  await expect(form).toHaveCount(0);
}

/** Open the export preview, download the DOCX and return its raw text (mammoth parse-back). */
export async function exportDocxText(page: Page): Promise<{ text: string; filename: string }> {
  await page.getByTestId('counsel-export').click();
  await expect(page.getByTestId('export-dialog')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-download').click(),
  ]);
  const path = await download.path();
  const { value } = await mammoth.extractRawText({ buffer: readFileSync(path) });
  await expect(page.getByTestId('export-dialog')).toBeHidden();
  return { text: value, filename: download.suggestedFilename() };
}

/** Never contact OpenRouter from the browser (free models only, no live calls in e2e). */
export function trackOpenRouter(page: Page): string[] {
  const hits: string[] = [];
  page.context().on('request', (req) => {
    if (/openrouter\.ai/i.test(req.url())) hits.push(req.url());
  });
  return hits;
}
