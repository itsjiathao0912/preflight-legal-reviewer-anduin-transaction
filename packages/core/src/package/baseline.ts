import type { BaselineCandidate } from './types';

/**
 * Same-firm baseline eligibility (AC-I9 pure half; variance L10). A candidate is eligible when it
 * is in the same package and its own non-null firm does not differ from the package firm, or it
 * is in another package of the same non-null firm. Never another firm; a null-firm package sees
 * within-package candidates only. Order: createdAt desc, then name, then docId.
 */
export function eligibleBaselines(
  pkg: { id: string; firmId: string | null },
  candidates: readonly BaselineCandidate[],
): BaselineCandidate[] {
  const ok = candidates.filter((c) => {
    if (c.firmId !== null && c.firmId !== pkg.firmId) return false;
    if (c.packageId === pkg.id) return true;
    return pkg.firmId !== null && c.firmId === pkg.firmId;
  });
  return ok.sort((a, b) => {
    const ca = a.createdAt ?? '';
    const cb = b.createdAt ?? '';
    if (ca !== cb) return ca < cb ? 1 : -1;
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    return a.docId < b.docId ? -1 : a.docId > b.docId ? 1 : 0;
  });
}
