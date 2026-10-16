import { sha256Hex } from '../model/hash';
import { normalize } from './normalize';

/** sha256 of the sorted normalized active rule texts (joined by "\n"); 'none' when there are no rules. */
export function rulesHash(texts: readonly string[]): string {
  const norm = texts.map(normalize).filter((t) => t.length > 0);
  if (norm.length === 0) return 'none';
  norm.sort();
  return sha256Hex(norm.join('\n'));
}
