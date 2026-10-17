/**
 * Locked numeric defaults (umbrella "Locked Numeric Defaults").
 * Single source of truth for core, web and worker. Change only with a
 * contract-change note in the phase report.
 */
export const limits = Object.freeze({
  /** Upload limit for any document (bytes). */
  maxUploadBytes: 10 * 1024 * 1024,
  /** HTML adapter input cap (bytes); larger input is rejected with payload_too_large. */
  maxHtmlBytes: 10 * 1024 * 1024,
  /** Lines longer than this are split at whitespace (never rejected). */
  maxLineChars: 4000,
  /** Pages per scanned document. */
  maxScanPages: 30,
  /** Accepted upload extensions. */
  uploadExtensions: ['.htm', '.html', '.pdf', '.docx', '.jpg', '.jpeg', '.png'] as const,
  /** Fresh-AI documents per visitor per UTC day (D-4). */
  visitorAiDocsPerDay: 3,
  /** AI requests per visitor per UTC day (incl. counsel drafts). */
  visitorAiRequestsPerDay: 8,
  /** OCR pages per visitor per UTC day. */
  visitorOcrPagesPerDay: 6,
  /** Global AI requests per UTC day (15 of 50 held in reserve). */
  globalAiRequestsPerDay: 35,
  /** Total spend ceiling in USD (paid path disabled). */
  spendCapUsd: 10,
  /** Requests per minute per visitor. */
  rateLimitPerMin: 30,
  /** AI requests per minute per visitor. */
  aiRateLimitPerMin: 6,
  /** Body caps (bytes). */
  aiBodyBytes: 128 * 1024,
  ocrBodyBytes: 700 * 1024,
  otherBodyBytes: 64 * 1024,
  /** Max candidates in one AI request. */
  aiCandidates: 40,
  /** OCR pages per request (S3 fallback: one page per request). */
  ocrPagesPerRequest: 1,
  /** Retention (D-4). */
  browserUploadRetentionHours: 24,
  sandboxRetentionDays: 30,
  aiCacheTtlDays: 7,
  quotaWindowPurgeDays: 2,
  /** Memory. */
  ruleProposalMin: 3,
  findingsChunk: 50,
  memoryLookupMax: 200,
  quoteMaxChars: 1000,
  snippetMaxChars: 300,
  detailMaxChars: 2000,
  /** Variance (Phase 03): active regression checks per firm per workspace (= rules config cap). */
  regressionChecksPerFirm: 20,
  /** Variance (Phase 03): analyst intent text on an answer or decision. */
  intentMaxChars: 500,
  /** OCR page confidence below this is low-confidence. */
  ocrLowConfidence: 0.6,
  /** Session cookie. */
  cookieMaxBytes: 512,
  cookieIatSkewSeconds: 60,
  /** Heartbeat interval for NDJSON streams. */
  heartbeatSeconds: 10,
});

export type Limits = typeof limits;
