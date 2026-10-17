export { normalize } from './normalize';
export {
  FP_VERSION,
  assertQuoteLength,
  quoteHash,
  fingerprint,
  fingerprintFor,
  fingerprintMatches,
} from './fingerprint';
export { mask, maskToken, sensitiveSpans, ACCOUNT_NUMBER_RE, type Span } from './mask';
export { resolveLabel, scopeMismatch } from './label';
export { rulesHash } from './rulesHash';
export { snapToSentence, ABBREVIATIONS } from './snap';
export { LAW_FIRMS, resolveFirm, firmById, normalizeFirmAlias, type LawFirm } from './firms';
