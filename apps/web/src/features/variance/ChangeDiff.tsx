import { maskQuote } from '@aduin/core';

/**
 * Old text above new text. Removed words are struck through (`del`), added words are bold and
 * underlined (`ins`): never colour alone. Text is masked then clipped by the core mask contract.
 */
type Part = { t: string; k: 'same' | 'del' | 'ins' };

const MAX_CELLS = 250_000;

function tokens(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

/** Word-level LCS diff (bounded; above the bound the whole text is one replace). */
export function wordDiff(oldText: string, newText: string): { old: Part[]; new: Part[] } {
  const a = tokens(oldText);
  const b = tokens(newText);
  if (a.length * b.length > MAX_CELLS)
    return {
      old: a.length ? [{ t: a.join(' '), k: 'del' }] : [],
      new: b.length ? [{ t: b.join(' '), k: 'ins' }] : [],
    };
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const old: Part[] = [];
  const neu: Part[] = [];
  const push = (list: Part[], t: string, k: Part['k']) => {
    const last = list[list.length - 1];
    if (last && last.k === k) last.t += ` ${t}`;
    else list.push({ t, k });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(old, a[i]!, 'same');
      push(neu, b[j]!, 'same');
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) push(old, a[i++]!, 'del');
    else push(neu, b[j++]!, 'ins');
  }
  while (i < n) push(old, a[i++]!, 'del');
  while (j < m) push(neu, b[j++]!, 'ins');
  return { old, new: neu };
}

function Line({ parts }: { parts: Part[] }) {
  return (
    <>
      {parts.map((p, i) => {
        const sp = i > 0 ? ' ' : '';
        if (p.k === 'del')
          return (
            <span key={i}>
              {sp}
              <del>
                <span className="sr">removed: </span>
                {p.t}
              </del>
            </span>
          );
        if (p.k === 'ins')
          return (
            <span key={i}>
              {sp}
              <ins>
                <span className="sr">added: </span>
                {p.t}
              </ins>
            </span>
          );
        return <span key={i}>{sp + p.t}</span>;
      })}
    </>
  );
}

export function ChangeDiff({
  oldText,
  newText,
  baselineLabel,
  currentLabel,
}: {
  oldText: string;
  newText: string;
  baselineLabel: string;
  currentLabel: string;
}) {
  const o = maskQuote(oldText.replace(/\s+/g, ' ').trim());
  const n = maskQuote(newText.replace(/\s+/g, ' ').trim());
  const d = wordDiff(o, n);
  return (
    <div className="cmpq" data-testid="change-diff">
      <div>
        <div className="qh">{baselineLabel}</div>
        {o ? (
          <div className="qq" data-testid="change-old">
            <Line parts={d.old} />
          </div>
        ) : (
          <div className="none" data-testid="change-old">
            Not in {baselineLabel}
          </div>
        )}
      </div>
      <div>
        <div className="qh">{currentLabel}</div>
        {n ? (
          <div className="qq" data-testid="change-new">
            <Line parts={d.new} />
          </div>
        ) : (
          <div className="none" data-testid="change-new">
            Not in this document
          </div>
        )}
      </div>
    </div>
  );
}
