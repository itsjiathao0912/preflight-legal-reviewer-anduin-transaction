/**
 * Counsel share link (counsel-share-link plan, 19-10-26): the tab's role flag, kept in a leaf module
 * so the memory client, the outbox and the review store can read it without importing the counsel
 * feature (no import cycle). Once a share link is joined the tab is in counsel mode for good: no
 * memory session, no lookup, no outbox, no decision writes, no persisted triage, no AI lane.
 */
let counsel = false;
const listeners = new Set<() => void>();

export function isCounselMode(): boolean {
  return counsel;
}

export function setCounselMode(on: boolean): void {
  if (counsel === on) return;
  counsel = on;
  for (const l of listeners) l();
}

export function onCounselModeChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
