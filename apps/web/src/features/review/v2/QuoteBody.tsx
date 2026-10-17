import { mask } from '@aduin/core';
import { Icon } from '../../../components/ui/icon';
import { useReview } from '../../../state/review';
import type { Row } from '../model';

/**
 * Quote text for an expanded row (E2; the FindingRow QuoteBody is private). Masked by default (the
 * core quote is already masked); Reveal shows the original block slice. Text nodes only.
 */
export function QuoteBody({ row }: { row: Row }) {
  const revealed = useReview((s) => s.revealed);
  const toggle = useReview((s) => s.toggleReveal);
  const block = useReview((s) => s.result?.blocks.find((b) => b.id === row.f.anchor.blockId));
  const f = row.f;
  if (f.sensitive.length === 0 || !block) return <>{f.quote_snippet}</>;
  const { offsetStart: a, offsetEnd: b } = f.anchor;
  const raw = block.text.slice(a, b);
  const spans = f.sensitive.map((s) => ({ start: s.start - a, end: s.end - a }));
  return (
    <>
      {revealed ? raw : mask(raw, spans)}
      <button
        type="button"
        className="revealbtn"
        data-testid="reveal-toggle"
        aria-pressed={revealed}
        onClick={toggle}
      >
        <Icon name={revealed ? 'eyeoff' : 'eye'} />
        {revealed ? 'Hide' : 'Reveal'}
      </button>
    </>
  );
}
