import { limits } from '../config/limits';
import { CoreError } from '../model/errors';
import { sha256Hex } from '../model/hash';
import type { IssueClass } from '../findings/taxonomy';
import { normalize } from './normalize';

export const FP_VERSION = 1 as const;

/** Quotes longer than limits.quoteMaxChars are rejected, never truncated. */
export function assertQuoteLength(quote: string): void {
  if (quote.length > limits.quoteMaxChars) {
    throw new CoreError('invalid_request', `quote exceeds ${limits.quoteMaxChars} chars`);
  }
}

/** quote_hash = hex(sha256(normalize(q))). Callers mask sensitive spans first. */
export function quoteHash(quote: string): string {
  assertQuoteLength(quote);
  return sha256Hex(normalize(quote));
}

/** fingerprint = hex(sha256("fp1|" + firmId + "|" + class + "|" + quote_hash)). */
export function fingerprint(
  firmId: string,
  issueClass: IssueClass | string,
  qHash: string,
): string {
  if (!/^[0-9a-f]{64}$/.test(qHash))
    throw new CoreError('invalid_request', 'quote_hash must be 64 hex chars');
  if (!firmId) throw new CoreError('invalid_request', 'firmId required');
  return sha256Hex(`fp${FP_VERSION}|${firmId}|${issueClass}|${qHash}`);
}

/** Fingerprint for a finding at lookup time; null when no firm ("memory not applied"). */
export function fingerprintFor(
  finding: { issue_class: IssueClass | string; quote_hash: string },
  firmId: string | null,
): string | null {
  if (firmId === null) return null;
  return fingerprint(firmId, finding.issue_class, finding.quote_hash);
}

/** Server-side recompute check: does quote_text produce this fingerprint? */
export function fingerprintMatches(
  quoteText: string,
  firmId: string,
  issueClass: string,
  fp: string,
): boolean {
  return fingerprint(firmId, issueClass, quoteHash(quoteText)) === fp;
}
