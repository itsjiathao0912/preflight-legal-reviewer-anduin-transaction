import type { ApiErrorDetail } from '../../api/http';

/**
 * (code, reason) -> one banner per reason (G4/E5). Covers pre-stream HTTP error bodies AND terminal
 * error frames, plus the client-side cases (result unusable, rules changed).
 */
export type BannerKey =
  | 'visitor_limit'
  | 'daily_cap'
  | 'quota'
  | 'ai_unavailable'
  | 'ai_disabled'
  | 'budget'
  | 'spend_limit'
  | 'breaker'
  | 'rate'
  | 'verification'
  | 'provider_error'
  | 'result_unusable'
  | 'rules_unavailable'
  | 'rules_changed';

/** How the lane comes back: at the next UTC midnight, after retry_after_s, by manual Retry, or never. */
export type ResumeKind = 'midnight' | 'retry_after' | 'manual' | 'none';

export interface BannerCopy {
  /** What happened, shown bold after "AI review skipped:". */
  reason: string;
  /** Short form for the stage popover. */
  short: string;
  resume: ResumeKind;
  /** 'skipped' = downgrade (quota, budget, policy); 'unavailable' = the call failed. */
  lane: 'skipped' | 'unavailable';
}

export const BANNERS: Readonly<Record<BannerKey, BannerCopy>> = Object.freeze({
  visitor_limit: {
    reason: 'your fresh-AI documents for today are used up',
    short: 'daily allowance used',
    resume: 'midnight',
    lane: 'skipped',
  },
  daily_cap: {
    reason: 'today’s shared AI allowance is used up',
    short: 'shared allowance used',
    resume: 'midnight',
    lane: 'skipped',
  },
  quota: {
    reason: 'the AI allowance is used up',
    short: 'allowance used',
    resume: 'midnight',
    lane: 'skipped',
  },
  ai_unavailable: {
    reason: 'AI review is not available on the server right now',
    short: 'not available',
    resume: 'manual',
    lane: 'skipped',
  },
  ai_disabled: {
    reason: 'AI review is disabled on the server',
    short: 'AI disabled',
    resume: 'none',
    lane: 'skipped',
  },
  budget: {
    reason: 'the AI budget for today is used up',
    short: 'budget used',
    resume: 'midnight',
    lane: 'skipped',
  },
  /** OpenAI provider: the lifetime spend limit is reached; it never resets on its own. */
  spend_limit: {
    reason: 'the spend limit has been reached, so AI review is switched off',
    short: 'spend limit reached',
    resume: 'none',
    lane: 'skipped',
  },
  breaker: {
    reason: 'AI review is paused by a safety stop',
    short: 'safety stop',
    resume: 'midnight',
    lane: 'skipped',
  },
  rate: {
    reason: 'too many AI requests in a short time',
    short: 'too many requests',
    resume: 'retry_after',
    lane: 'skipped',
  },
  verification: {
    reason: 'a quick verification is needed before a fresh AI review',
    short: 'verification needed',
    resume: 'manual',
    lane: 'skipped',
  },
  provider_error: {
    reason: 'the AI provider did not answer',
    short: 'provider error',
    resume: 'manual',
    lane: 'unavailable',
  },
  result_unusable: {
    reason: 'the AI answer could not be used',
    short: 'answer unusable',
    resume: 'manual',
    lane: 'unavailable',
  },
  rules_unavailable: {
    reason: 'the firm rules could not be read, and AI never runs without them',
    short: 'firm rules unavailable',
    resume: 'manual',
    lane: 'skipped',
  },
  rules_changed: {
    reason: 'the firm rules changed, so the AI answer for the old rules was not used',
    short: 'firm rules changed',
    resume: 'manual',
    lane: 'unavailable',
  },
});

/** Map a Worker error (HTTP body or terminal frame) to its banner. */
export function bannerFor(e: Pick<ApiErrorDetail, 'code' | 'reason'>): BannerKey {
  const r = e.reason ?? '';
  switch (e.code) {
    case 'quota_exhausted':
      if (r === 'visitor_limit') return 'visitor_limit';
      if (r === 'global_cap') return 'daily_cap';
      if (r === 'ai_unavailable') return 'ai_unavailable';
      if (r === 'ai_disabled') return 'ai_disabled';
      return 'quota';
    case 'budget_cap':
      if (r === 'circuit_breaker') return 'breaker';
      if (r === 'spend_cap') return 'spend_limit';
      if (r === 'provider_balance') return 'ai_unavailable';
      return 'budget';
    case 'rate_limited':
      return 'rate';
    case 'invalid_session':
      return 'verification';
    case 'memory_unavailable':
      return 'rules_unavailable';
    case 'upstream_failed':
      return r === 'malformed' || r === 'bad_frame' || r === 'not_a_stream'
        ? 'result_unusable'
        : 'provider_error';
    default:
      return 'provider_error';
  }
}

/** Next UTC midnight (ms). */
export function nextUtcMidnight(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

/** When the lane may resume on its own (ms epoch), or null for manual / never. */
export function resumeAt(
  key: BannerKey,
  retryAfterS: number | undefined,
  now: number,
): number | null {
  const kind = BANNERS[key].resume;
  if (kind === 'manual' || kind === 'none') return null;
  if (retryAfterS !== undefined) return now + Math.min(retryAfterS, 86_400) * 1000;
  return kind === 'midnight' ? nextUtcMidnight(now) : now + 60_000;
}
