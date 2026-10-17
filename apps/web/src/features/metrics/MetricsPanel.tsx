import { useEffect, useState } from 'react';
import { formatDuration, readMetrics, type MetricsRow } from './metrics-store';

/**
 * Delivery metrics for the open document (AC64), shown once the first export is recorded:
 * defects found before the build (non-AI findings not dismissed as a tool false alarm), questions
 * batched into the sheet (target: one round) and the time from opening to an exportable sheet.
 */
export function MetricsPanel({ docId, refresh }: { docId: string; refresh: number }) {
  const [row, setRow] = useState<MetricsRow | null>(null);
  useEffect(() => {
    let live = true;
    void readMetrics(docId).then((r) => {
      if (live) setRow(r);
    });
    return () => {
      live = false;
    };
  }, [docId, refresh]);
  const m = row?.metrics;
  if (!m || row?.exportedAt === undefined) return null;
  return (
    <section className="metrics" aria-labelledby="h-metrics" data-testid="metrics-panel">
      <h2 id="h-metrics">Delivery metrics (first export)</h2>
      <dl>
        <dt>Defects found before build</dt>
        <dd data-testid="metric-defects">{m.defectsBeforeBuild}</dd>
        <dt>Questions batched</dt>
        <dd data-testid="metric-questions">{m.questionsBatched} in one round</dd>
        <dt>Time to exportable sheet</dt>
        <dd data-testid="metric-time">{formatDuration(m.timeToExportMs)}</dd>
      </dl>
    </section>
  );
}
