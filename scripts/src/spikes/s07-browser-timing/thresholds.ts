export type SpikeVerdict = 'PASS' | 'PASS-WITH-RISK' | 'FAIL';

export interface S7Result {
  parseMergeMs: number;
  /** Per-page render(+downscale) times in ms; one entry per page measured. */
  pageRenderMs: number[];
}

export const S7_LIMITS = {
  parseMergePassMs: 1500,
  parseMergeKillMs: 3000,
  renderPassMs: 400,
  renderKillMs: 1500,
} as const;

function grade(value: number, pass: number, kill: number): SpikeVerdict {
  if (value > kill) return 'FAIL';
  if (value > pass) return 'PASS-WITH-RISK';
  return 'PASS';
}

/** S7 verdict. Render is judged on the worst page (kill is "> 1.5 s/page"). */
export function judgeS7(r: S7Result): { verdict: SpikeVerdict; worstPageMs: number } {
  const worstPageMs = r.pageRenderMs.length ? Math.max(...r.pageRenderMs) : 0;
  const a = grade(r.parseMergeMs, S7_LIMITS.parseMergePassMs, S7_LIMITS.parseMergeKillMs);
  const b = grade(worstPageMs, S7_LIMITS.renderPassMs, S7_LIMITS.renderKillMs);
  const order: SpikeVerdict[] = ['PASS', 'PASS-WITH-RISK', 'FAIL'];
  return { verdict: order[Math.max(order.indexOf(a), order.indexOf(b))] ?? 'FAIL', worstPageMs };
}
