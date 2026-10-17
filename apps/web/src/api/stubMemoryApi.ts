import { ActiveDecisionSchema, limits, REASON_CODES, type ActiveDecision } from '@aduin/core';
import { e2eFirmRules } from '../e2e-hook';
import type { AppDb, DecisionRow } from '../storage/db';
import { MemoryApiError, type AnswerInput, type DecideInput, type MemoryApi } from './memoryApi';

const HEX64 = /^[0-9a-f]{64}$/;

function strip(row: DecisionRow): ActiveDecision {
  const { law_firm_id: _f, seq: _s, ...rest } = row;
  return ActiveDecisionSchema.parse(rest);
}

/** Dexie-backed stub with the Worker semantics (append-only, one active per fingerprint, revoke not delete). */
export class StubMemoryApi implements MemoryApi {
  constructor(
    private readonly db: AppDb,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async lookup(lawFirmId: string, fingerprints: string[]): Promise<ActiveDecision[]> {
    if (!lawFirmId) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    if (fingerprints.length === 0 || fingerprints.length > limits.memoryLookupMax) {
      throw new MemoryApiError(
        'invalid_request',
        `1..${limits.memoryLookupMax} fingerprints per lookup`,
      );
    }
    if (fingerprints.some((f) => !HEX64.test(f)))
      throw new MemoryApiError('invalid_request', 'bad fingerprint');
    const rows = await this.db.decisions.where('fingerprint').anyOf(fingerprints).toArray();
    return rows
      .filter((r) => r.law_firm_id === lawFirmId && r.status === 'active')
      .sort((a, b) => a.seq - b.seq)
      .map(strip);
  }

  private async append(
    lawFirmId: string,
    d: Omit<ActiveDecision, 'id' | 'status' | 'decided_at'>,
  ): Promise<ActiveDecision> {
    let created: DecisionRow | null = null;
    await this.db.transaction('rw', this.db.decisions, async () => {
      const prior = await this.db.decisions.where('fingerprint').equals(d.fingerprint).toArray();
      const maxSeq = (await this.db.decisions.orderBy('seq').last())?.seq ?? 0;
      for (const p of prior) {
        if (p.law_firm_id === lawFirmId && p.status === 'active') {
          await this.db.decisions.update(p.id, { status: 'superseded' });
        }
      }
      const row: DecisionRow = {
        ...d,
        id: `d_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        status: 'active',
        decided_at: this.now(),
        law_firm_id: lawFirmId,
        seq: maxSeq + 1,
      };
      ActiveDecisionSchema.parse(strip(row));
      await this.db.decisions.add(row);
      created = row;
    });
    return strip(created!);
  }

  async decide(input: DecideInput): Promise<ActiveDecision> {
    if (!input.law_firm_id) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    if (!HEX64.test(input.fingerprint))
      throw new MemoryApiError('invalid_request', 'bad fingerprint');
    if (input.decision === 'dismissed') {
      if (!input.reason_code || !(REASON_CODES as readonly string[]).includes(input.reason_code)) {
        throw new MemoryApiError('invalid_request', 'dismissed requires reason_code');
      }
    }
    if (input.quote_text.length === 0 || input.quote_text.length > limits.quoteMaxChars) {
      throw new MemoryApiError('invalid_request', 'quote_text length');
    }
    return this.append(input.law_firm_id, {
      fingerprint: input.fingerprint,
      decision: input.decision,
      ...(input.reason_code ? { reason_code: input.reason_code } : {}),
      ...(input.note ? { note: input.note.slice(0, 500) } : {}),
      issue_class: input.issue_class,
      ...(input.quote_snippet
        ? { quote_snippet: input.quote_snippet.slice(0, limits.snippetMaxChars) }
        : {}),
      ...(input.section_path ? { section_path: input.section_path.slice(0, 8) } : {}),
      ...(input.pattern_key ? { pattern_key: input.pattern_key } : {}),
      fund_name: input.fund_name ?? '',
      ...(input.doc_version_label ? { doc_version_label: input.doc_version_label } : {}),
      decided_by_name: input.decided_by_name,
    });
  }

  async answer(input: AnswerInput): Promise<ActiveDecision> {
    if (!input.law_firm_id) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    if (!HEX64.test(input.fingerprint))
      throw new MemoryApiError('invalid_request', 'bad fingerprint');
    return this.append(input.law_firm_id, {
      fingerprint: input.fingerprint,
      decision: 'answered',
      counsel_option: input.counsel_option,
      ...(input.counsel_note ? { counsel_note: input.counsel_note } : {}),
      issue_class: input.issue_class,
      ...(input.quote_snippet
        ? { quote_snippet: input.quote_snippet.slice(0, limits.snippetMaxChars) }
        : {}),
      fund_name: input.fund_name ?? '',
      decided_by_name: input.decided_by_name,
    });
  }

  /**
   * Bundled samples carry no active firm rules (the demo seed rule is `proposed`), so the stub returns
   * [] and the rules hash is 'none', matching the committed `{docHash}.none.json` precomputed files
   * (E18(e) option "[] / none").
   */
  async firmRules(lawFirmId: string): Promise<string[]> {
    if (!lawFirmId) throw new MemoryApiError('invalid_request', 'law_firm_id required');
    return [...(e2eFirmRules() ?? [])];
  }

  async revoke(decisionId: string, reason: string): Promise<ActiveDecision | null> {
    if (!reason.trim()) throw new MemoryApiError('invalid_request', 'revoke requires a reason');
    const row = await this.db.decisions.get(decisionId);
    if (!row) throw new MemoryApiError('not_found', 'decision not found');
    if (row.status === 'active') await this.db.decisions.update(decisionId, { status: 'revoked' });
    return null;
  }
}
