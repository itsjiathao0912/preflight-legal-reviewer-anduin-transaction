import { Modal } from '../../components/ui/modal';
import { useSession } from '../../state/session';
import { privacyLines } from './privacy-copy';

/** Privacy notice before the first AI use in a session (switching AI on). */
export function PrivacyPrompt() {
  const open = useSession((s) => s.privacyPrompt);
  const close = useSession((s) => s.closePrivacyPrompt);
  const ack = useSession((s) => s.ackPrivacy);
  const setAi = useSession((s) => s.setAi);
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && close()}
      title="Before AI review"
      testId="privacy-prompt"
    >
      <div className="od-privacy" data-testid="privacy-notice">
        {privacyLines().map((l) => (
          <p key={l} className="mut">
            {l}
          </p>
        ))}
      </div>
      <div className="acts">
        <button type="button" className="btn" onClick={close}>
          Keep AI off
        </button>
        <button
          type="button"
          className="btn pri"
          data-testid="privacy-accept"
          onClick={() => {
            ack();
            setAi(true);
            close();
          }}
        >
          Accept and turn AI on
        </button>
      </div>
    </Modal>
  );
}
