// Variance Phase 03 HTTP helpers (not a gate file): a counsel question on a fresh run and an answer
// body with the optional intent / scope / assertion fields.
import { call, decide, fpOf, newRun, op, type MemHarness, type Session } from './memory-harness';

export interface AskedQuestion {
  runId: string;
  questionId: string;
  quote: string;
  fp: string;
  firm: string;
  fund: string;
  findingRef: string;
}

let qSeq = 0;

export async function askQuestion(
  h: MemHarness,
  s: Session,
  o: {
    firm?: string;
    fund?: string;
    runId?: string;
    quote?: string;
    extra?: Record<string, unknown>;
  } = {},
): Promise<AskedQuestion & { status: number; body: unknown }> {
  qSeq++;
  const firm = o.firm ?? 'firm-x';
  const fund = o.fund ?? 'Fund I';
  const runId = o.runId ?? (await newRun(h, s, firm, fund));
  const quote = o.quote ?? `Variance counsel quote ${qSeq} ${Math.floor(Math.random() * 1e9)}.`;
  const fp = fpOf(firm, 'ambiguity', quote);
  const findingRef = `vq-${qSeq}-${Math.floor(Math.random() * 1e6)}`;
  const d = await decide(h, s, {
    runId,
    quote,
    decision: 'accepted',
    cls: 'ambiguity',
    findingRef,
    firm,
  });
  if (d.status !== 200) throw new Error(`decide failed: ${d.status} ${JSON.stringify(d.body)}`);
  const q = await call(
    h,
    'POST',
    '/api/counsel/questions',
    {
      client_op_id: op('q'),
      finding_ref: findingRef,
      fingerprint: fp,
      interpretations: ['a', 'b'],
      ...(o.extra ?? {}),
    },
    { cookie: s.cookie },
  );
  return {
    runId,
    questionId: q.body?.question_id,
    quote,
    fp,
    firm,
    fund,
    findingRef,
    status: q.status,
    body: q.body,
  };
}

export function answerBody(
  q: AskedQuestion,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    client_op_id: op('ans'),
    question_id: q.questionId,
    option: 'A',
    quote_text: q.quote,
    fingerprint: q.fp,
    ...extra,
  };
}

export async function answer(
  h: MemHarness,
  s: Session,
  q: AskedQuestion,
  extra: Record<string, unknown> = {},
) {
  return call(h, 'POST', '/api/counsel/answers', answerBody(q, extra), { cookie: s.cookie });
}

/** firm_template answer with a scope_exists assertion (the check-creating shape). */
export const withAssertion = (label = 'Appendix C', intent = 'Appendix C is a firm standard.') => ({
  scope: 'firm_template',
  intent,
  assertion: { kind: 'scope_exists', label },
});
