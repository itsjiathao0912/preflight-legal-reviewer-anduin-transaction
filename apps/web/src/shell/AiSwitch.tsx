import { limits } from '@aduin/core';
import { Icon } from '../components/ui/icon';
import { useSession } from '../state/session';

export function AiSwitch() {
  const aiOn = useSession((s) => s.aiOn);
  const allowance = useSession((s) => s.allowance);
  const setAi = useSession((s) => s.setAi);
  const requestAiOn = useSession((s) => s.requestAiOn);
  return (
    <>
      <div className="airow">
        <div className="seg" role="group" aria-label="AI mode">
          <button type="button" data-testid="ai-on" aria-pressed={aiOn} onClick={requestAiOn}>
            AI on
          </button>
          <button
            type="button"
            data-testid="ai-off"
            aria-pressed={!aiOn}
            onClick={() => setAi(false)}
          >
            No AI
          </button>
        </div>
        <div className="allow" data-testid="ai-allowance">
          <Icon name="spark" />
          <span>
            <b>
              {allowance} of {limits.visitorAiDocsPerDay}
            </b>{' '}
            fresh-AI documents left today
          </span>
        </div>
      </div>
      <button
        className="ibtn aimini"
        type="button"
        aria-pressed={aiOn}
        aria-label={aiOn ? 'AI review on. Switch off' : 'AI review off. Switch on'}
        onClick={() => (aiOn ? setAi(false) : requestAiOn())}
      >
        <Icon name="spark" />
      </button>
    </>
  );
}
