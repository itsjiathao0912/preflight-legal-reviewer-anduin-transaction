import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeHtml, fingerprintFor, runDeterministic, type Finding } from '@aduin/core';
import type { Page } from '@playwright/test';

/**
 * Seeds the stub memory (Dexie, in the page) with decisions whose fingerprints are computed in Node by
 * core fingerprintFor on the real engine output for a sample (never hand-made strings).
 */
const RAW = resolve(import.meta.dirname, '..', '..', '..', '..', 'samples', 'sub-docs', 'raw');

export function engineFindings(sampleId: string): Finding[] {
  const file = readdirSync(RAW).find((f) => f.startsWith(`${sampleId}-`) && f.endsWith('.htm'));
  if (!file) throw new Error(`no sample ${sampleId}`);
  return runDeterministic(analyzeHtml(readFileSync(resolve(RAW, file))));
}

export interface SeedDecision {
  finding: Finding;
  firmId: string;
  decision: 'dismissed' | 'accepted' | 'answered';
  fund: string;
  who?: string;
  reason?: 'firm_standard_wording' | 'no_form_impact' | 'tool_false_alarm' | 'other';
  option?: 'A' | 'B' | 'C' | 'unclear';
}

export async function seedMemory(page: Page, seeds: SeedDecision[]): Promise<string[]> {
  const payload = seeds.map((s) => ({
    firmId: s.firmId,
    decision: s.decision,
    fingerprint: fingerprintFor(s.finding, s.firmId)!,
    issue_class: s.finding.issue_class,
    quote: s.finding.quote,
    snippet: s.finding.quote_snippet,
    fund: s.fund,
    who: s.who ?? 'Duc Pham',
    reason: s.reason ?? 'firm_standard_wording',
    option: s.option ?? 'A',
    ref: s.finding.id,
  }));
  return page.evaluate(async (items) => {
    type Api = {
      decide: (x: unknown) => Promise<{ id: string }>;
      answer: (x: unknown) => Promise<{ id: string }>;
    };
    const api = (window as unknown as { __aduinE2E: { memory: () => Api } }).__aduinE2E.memory();
    const ids: string[] = [];
    for (const it of items) {
      const common = {
        client_op_id: `op_seed_${Math.random().toString(16).slice(2, 12)}`,
        law_firm_id: it.firmId,
        fingerprint: it.fingerprint,
        issue_class: it.issue_class,
        fund_name: it.fund,
        quote_snippet: it.snippet,
        decided_by_name: it.who,
      };
      const d =
        it.decision === 'answered'
          ? await api.answer({ ...common, counsel_option: it.option })
          : await api.decide({
              ...common,
              finding_ref: it.ref,
              decision: it.decision,
              reason_code: it.reason,
              quote_text: it.quote,
            });
      ids.push(d.id);
    }
    return ids;
  }, payload);
}
