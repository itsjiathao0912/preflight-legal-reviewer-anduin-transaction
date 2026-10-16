/** Thrown by seam stubs that a later phase replaces. */
export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`Not implemented: ${what}`);
    this.name = 'NotImplementedError';
  }
}

/** Seam stub: Phase 04b implements the D1 platform (ports are typed in core contracts, Phase 01). */
export function createD1Platform(_db: D1Database): never {
  throw new NotImplementedError('createD1Platform (Phase 04b)');
}
