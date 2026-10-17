/** The muted variance lines (no baseline, scan, text gone, error, ignored baselines). */
export function NoBaselineLine({ lines }: { lines: readonly string[] }) {
  if (!lines.length) return null;
  return (
    <>
      {lines.map((l) => (
        <p className="mut" role="status" key={l} data-testid="variance-line">
          {l}
        </p>
      ))}
    </>
  );
}
