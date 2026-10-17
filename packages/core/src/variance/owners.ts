import { OWNERS, type Owner } from './types';

/**
 * Question keys (DECISION D4, AC-V12). A change finding gets one question per owner, keyed
 * `<findingId>@<owner>`; an error finding keeps its plain id (legacy flows unchanged). One helper,
 * used everywhere. Parsing splits at the LAST "@" and only accepts a known owner suffix, so an id
 * that itself contains "@" stays intact.
 */

export function isOwner(x: unknown): x is Owner {
  return typeof x === 'string' && (OWNERS as readonly string[]).includes(x);
}

export function questionKey(findingId: string, owner?: Owner): string {
  if (!findingId) throw new Error('questionKey: findingId required');
  if (owner === undefined) return findingId;
  if (!isOwner(owner)) throw new Error(`questionKey: unknown owner ${String(owner)}`);
  return `${findingId}@${owner}`;
}

export function parseQuestionKey(key: string): { findingId: string; owner?: Owner } {
  const at = key.lastIndexOf('@');
  if (at > 0) {
    const suffix = key.slice(at + 1);
    if (isOwner(suffix)) return { findingId: key.slice(0, at), owner: suffix };
  }
  return { findingId: key };
}
