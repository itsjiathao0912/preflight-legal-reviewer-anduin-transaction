import firmsData from '../../../../fixtures/memory/law-firms.json' with { type: 'json' };

/** Canonical law firms + aliases (fixtures/memory/law-firms.json). */
export interface LawFirm {
  id: string;
  name: string;
  aliases: string[];
}

export const LAW_FIRMS: readonly LawFirm[] = Object.freeze(
  (firmsData as { firms: LawFirm[] }).firms.map((f) =>
    Object.freeze({ ...f, aliases: [...f.aliases] }),
  ),
);

const SUFFIXES = new Set([
  'llp',
  'llc',
  'inc',
  'incorporated',
  'pllc',
  'pc',
  'lp',
  'ltd',
  'limited',
  'ag',
  'gmbh',
]);

/** Alias normalization: lowercase, legal suffixes dropped, punctuation stripped, spaces collapsed. */
export function normalizeFirmAlias(name: string): string {
  return name
    .normalize('NFC')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 0 && !SUFFIXES.has(t))
    .join(' ');
}

const INDEX: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const f of LAW_FIRMS) {
    for (const a of [f.id, f.name, ...f.aliases]) m.set(normalizeFirmAlias(a), f.id);
  }
  return m;
})();

/** Resolve a free-text firm name to a canonical firm id; unknown text -> null (memory not applied). */
export function resolveFirm(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = normalizeFirmAlias(name);
  if (!key) return null;
  return INDEX.get(key) ?? null;
}

export function firmById(id: string): LawFirm | undefined {
  return LAW_FIRMS.find((f) => f.id === id);
}
