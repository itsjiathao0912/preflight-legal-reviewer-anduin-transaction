import { limits } from '@aduin/core';

/** Privacy notice copy (AC38); retention and allowance values come from core limits (D-4). */
export function privacyLines(): string[] {
  return [
    `Uploaded documents stay in this browser for ${limits.browserUploadRetentionHours} hours, then they are deleted.`,
    `AI review sends short snippets of the document to a free AI model. Up to ${limits.visitorAiDocsPerDay} fresh-AI documents per day; opening a sample is free.`,
    'Review memory keeps short masked snippets, hashes and your decisions, never the full document.',
  ];
}
