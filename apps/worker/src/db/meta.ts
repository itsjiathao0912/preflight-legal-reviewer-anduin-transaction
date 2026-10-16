// D1 query metering: a wrapper that counts queries (one per statement, batches count each
// statement) and sums `meta.rows_read` / `meta.rows_written`. Used by the query-budget and
// rows-written gates through the worker D1 binding (the wrangler CLI does not report rows_written).

/** The D1 surface the repository and the ports use. */
export type Db = Pick<D1Database, 'prepare' | 'batch'>;

export interface DbStats {
  queries: number;
  rowsRead: number;
  rowsWritten: number;
}

const inner = new WeakMap<object, D1PreparedStatement>();

function add(stats: DbStats, meta: Partial<D1Meta> | undefined): void {
  stats.rowsRead += meta?.rows_read ?? 0;
  stats.rowsWritten += meta?.rows_written ?? 0;
}

function wrap(stmt: D1PreparedStatement, stats: DbStats): D1PreparedStatement {
  const w = {
    bind: (...values: unknown[]) => wrap(stmt.bind(...values), stats),
    async first(col?: string) {
      stats.queries++;
      const r = await stmt.all();
      add(stats, r.meta);
      const row = (r.results[0] ?? null) as Record<string, unknown> | null;
      if (col === undefined) return row;
      return row === null ? null : (row[col] ?? null);
    },
    async all() {
      stats.queries++;
      const r = await stmt.all();
      add(stats, r.meta);
      return r;
    },
    async run() {
      stats.queries++;
      const r = await stmt.run();
      add(stats, r.meta);
      return r;
    },
    async raw(opts?: { columnNames?: boolean }) {
      stats.queries++;
      return stmt.raw(opts as never);
    },
  } as unknown as D1PreparedStatement;
  inner.set(w, stmt);
  return w;
}

/** Wrap a D1 database; `stats` accumulates until `reset()`. */
export function meteredDb(db: D1Database): { db: D1Database; stats: DbStats; reset(): void } {
  const stats: DbStats = { queries: 0, rowsRead: 0, rowsWritten: 0 };
  const m = {
    prepare: (sql: string) => wrap(db.prepare(sql), stats),
    async batch(stmts: D1PreparedStatement[]) {
      stats.queries += stmts.length;
      const r = await db.batch(stmts.map((s) => inner.get(s) ?? s));
      for (const x of r) add(stats, x.meta);
      return r;
    },
    exec: (q: string) => db.exec(q),
    dump: () => (db as unknown as { dump(): Promise<ArrayBuffer> }).dump(),
    withSession: (c?: string) => db.withSession(c as never),
  } as unknown as D1Database;
  return {
    db: m,
    stats,
    reset() {
      stats.queries = 0;
      stats.rowsRead = 0;
      stats.rowsWritten = 0;
    },
  };
}
