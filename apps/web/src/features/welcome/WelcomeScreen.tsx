import { useEffect, useRef } from 'react';
import { Icon } from '../../components/ui/icon';
import { SLIDES_URL, WEBSITE_URL } from './links';
import { rememberWelcomeSeen } from './welcome-gate';

function LinkButton({ url, label, testId }: { url: string; label: string; testId: string }) {
  if (!url) {
    return (
      <button className="btn welcome-link" type="button" disabled title="Link coming soon" data-testid={testId}>
        {label}
      </button>
    );
  }
  return (
    <a className="btn welcome-link" href={url} target="_blank" rel="noopener noreferrer" data-testid={testId}>
      {label}
    </a>
  );
}

export function WelcomeScreen({ onEnter }: { onEnter: () => void }) {
  const startRef = useRef<HTMLButtonElement>(null);
  const start = () => {
    rememberWelcomeSeen();
    onEnter();
  };
  useEffect(() => {
    startRef.current?.focus();
  }, []);
  return (
    <div className="welcome" data-testid="welcome-screen">
      <div
        className="welcome-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            start();
          }
        }}
      >
        <div className="welcome-main">
          <p className="welcome-label">Anduin Transactions · Legal Reviewer challenge</p>
          <h1 className="welcome-name" id="welcome-title">
            <svg className="i welcome-logo" aria-hidden="true">
              <use href="#logo" />
            </svg>
            Preflight
          </h1>
          <div className="welcome-route">
            <div>
              <small>From</small>
              <b>Sub doc</b>
            </div>
            <div className="welcome-plane" aria-hidden="true">
              ✈
            </div>
            <div className="welcome-route-to">
              <small>To</small>
              <b>Ready to digitize</b>
            </div>
          </div>
          <p className="welcome-tagline">
            Sub-doc QA before digitization, for Anduin’s Digitization Service Analyst.
          </p>
          <ul className="welcome-chips" aria-label="Benefits">
            <li className="tag t-new">Faster review</li>
            <li className="tag t-new">Safer forms</li>
            <li className="tag t-new">Fewer rebuilds</li>
          </ul>
        </div>
        <div className="welcome-stub">
          <button
            type="button"
            className="od-x"
            aria-label="Close"
            onClick={start}
            data-testid="welcome-close"
          >
            <Icon name="x" />
          </button>
          <button
            className="btn pri welcome-start"
            type="button"
            ref={startRef}
            onClick={start}
            data-testid="welcome-start"
          >
            Start review →
          </button>
          <div className="welcome-links">
            <LinkButton url={WEBSITE_URL} label="Website" testId="welcome-website" />
            <LinkButton url={SLIDES_URL} label="Slide deck" testId="welcome-slides" />
          </div>
        </div>
      </div>
    </div>
  );
}
