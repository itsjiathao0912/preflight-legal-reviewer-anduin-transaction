import type { Anchor } from './types';
import { sha256Hex } from './hash';

export function makeAnchor(
  docHash: string,
  blockId: string,
  offsetStart: number,
  offsetEnd: number,
): Anchor {
  return { docHash, blockId, offsetStart, offsetEnd };
}

/** Anchor id = hex(sha256(docHash|blockId|offsetStart|offsetEnd)). Stable across runs. */
export function anchorId(a: Anchor): string {
  return sha256Hex(`${a.docHash}|${a.blockId}|${a.offsetStart}|${a.offsetEnd}`);
}
