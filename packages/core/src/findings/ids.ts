import { anchorId } from '../model/anchors';
import { sha256Hex } from '../model/hash';
import type { Anchor } from '../model/types';

/** Stable finding key: hash of detector, class, anchor and quote hash (AC8). */
export function findingId(
  detectorId: string,
  issueClass: string,
  anchor: Anchor,
  quoteHash: string,
): string {
  return (
    'f_' + sha256Hex(`${detectorId}|${issueClass}|${anchorId(anchor)}|${quoteHash}`).slice(0, 32)
  );
}

/** Sort key: document order, then offset, then detector, then id. */
export function compareFindings(
  a: { anchor: Anchor; detector_id: string; id: string },
  b: { anchor: Anchor; detector_id: string; id: string },
): number {
  const ba = Number.parseInt(a.anchor.blockId.replace(/\D/g, ''), 10) || 0;
  const bb = Number.parseInt(b.anchor.blockId.replace(/\D/g, ''), 10) || 0;
  return (
    ba - bb ||
    a.anchor.offsetStart - b.anchor.offsetStart ||
    (a.detector_id < b.detector_id ? -1 : a.detector_id > b.detector_id ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
