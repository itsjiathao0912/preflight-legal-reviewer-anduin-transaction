import { Icon } from '../../../components/ui/icon';
import { useReview } from '../../../state/review';
import { useSession } from '../../../state/session';
import { AiBanner } from '../../ai/AiBanner';
import { ScanNotices } from '../../scan/ScanNotices';

export function Banners() {
  const aiOn = useSession((s) => s.aiOn);
  const doc = useReview((s) => s.doc);
  const memory = useReview((s) => s.memory);
  return (
    <>
      {!aiOn ? (
        <div className="banner on" role="status" data-testid="ai-off-banner">
          <Icon name="warn" />
          <p className="bn-p">
            <b>AI review is off.</b> Rules, memory and the gate still work; ambiguity, contradiction
            and typo passes are skipped.
          </p>
        </div>
      ) : null}
      <AiBanner />
      <ScanNotices />
      {doc && doc.firmId === null ? (
        <div className="banner on" role="status" data-testid="memory-not-applied">
          <Icon name="info" />
          <p className="bn-p">
            <b>Memory not applied.</b> This document has no law firm, so earlier decisions are not
            looked up.
          </p>
        </div>
      ) : null}
      {doc && doc.firmId !== null && memory?.unavailable ? (
        <div className="banner on" role="status" data-testid="memory-unavailable">
          <Icon name="warn" />
          <p className="bn-p">
            <b>Memory unavailable.</b> Every finding is shown as New.
          </p>
        </div>
      ) : null}
    </>
  );
}
