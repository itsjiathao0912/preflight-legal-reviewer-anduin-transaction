// Ids: `${prefix}_` + 11 hex chars of epoch ms + 10 hex random chars (time-sortable, 24 chars
// for a 2-char prefix). Seed copies use `${sandboxId}:${seedId}` (<= 64 chars, contract `Id`).

export function randomHex(bytes: number): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function newId(prefix: string, nowMs: number): string {
  const t = Math.max(0, Math.floor(nowMs)).toString(16).padStart(11, '0').slice(-11);
  return `${prefix}_${t}${randomHex(5)}`;
}

/** Contract `Id` (1-64 chars) used in path params; conservative charset. */
export const ID_RE = /^[A-Za-z0-9_:.-]{1,64}$/;
