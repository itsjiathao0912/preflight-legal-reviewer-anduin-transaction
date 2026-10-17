import { sha256Hex } from '../model/hash';
import type { DocumentRequest, ExternalReference } from './types';

/**
 * GP document request list (AC-I20, T3): one item per distinct missing target, deduplicated by
 * `targetKey`; label and quote from the first mention in document order. Unclear references are
 * never requests. Quotes are stored UNMASKED (renders and exports mask them).
 */
export function buildDocumentRequests(
  references: readonly ExternalReference[],
  primaryId: string,
): DocumentRequest[] {
  const ordered = references
    .filter((r) => r.resolution === 'not_in_package')
    .slice()
    .sort(
      (a, b) =>
        a.location.blockIndex - b.location.blockIndex || a.location.start - b.location.start,
    );
  const by = new Map<string, DocumentRequest>();
  for (const r of ordered) {
    const hit = by.get(r.targetKey);
    if (hit) {
      hit.count++;
      continue;
    }
    by.set(r.targetKey, {
      id: sha256Hex(`request|${r.targetKey}`).slice(0, 16),
      targetKey: r.targetKey,
      label: r.targetLabel,
      targetFamily: r.targetFamily,
      quote: r.quote,
      count: 1,
      firstDocId: primaryId,
    });
  }
  return [...by.values()];
}
