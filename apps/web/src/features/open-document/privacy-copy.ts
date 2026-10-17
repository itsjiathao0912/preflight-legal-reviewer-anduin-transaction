import { limits } from '@aduin/core';

/** Privacy notice copy (AC38); retention and allowance values come from core limits (D-4). */
export function privacyLines(): string[] {
  return [
    `Uploaded documents stay in this browser for ${limits.browserUploadRetentionHours} hours, then they are deleted.`,
    `AI review sends short snippets of the document to a free AI model. Up to ${limits.visitorAiDocsPerDay} fresh-AI documents per day; opening a sample is free.`,
    'Scanned pages are sent as images to a third-party free AI model to read the text, only while AI review is on.',
    'Review memory keeps short masked snippets, hashes and your decisions, never the full document.',
  ];
}
