import type { PackageGateReason } from '@aduin/core';
import { Icon } from '../../components/ui/icon';
import '../../styles/package-gate.css';

/** Package missing-document gate reasons: blocks first, then warnings (AC-I19). */
export function PackageGateReasons({ reasons }: { reasons: readonly PackageGateReason[] }) {
  const blocks = reasons.filter((r) => r.level === 'block');
  const warns = reasons.filter((r) => r.level === 'warn');
  if (blocks.length === 0 && warns.length === 0) return null;
  return (
    <div className="pkg-gate-reasons">
      {blocks.length > 0 ? (
        <ul className="pkg-gate-list">
          {blocks.map((r) => (
            <li key={`b-${r.docType}`} data-testid="package-gate-reason" data-level="block">
              <Icon name="stop" />
              <span>{r.text}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {warns.length > 0 ? (
        <>
          <h3 className="pkg-gate-head">Warnings (they do not block digitization)</h3>
          <ul className="pkg-gate-list">
            {warns.map((r) => (
              <li key={`w-${r.docType}`} data-testid="package-gate-warning" data-level="warn">
                <Icon name="warn" />
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
