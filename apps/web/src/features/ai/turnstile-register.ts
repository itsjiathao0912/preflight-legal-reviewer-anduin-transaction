import { registerTurnstileWidget } from './turnstile-widget';

// Side-effect module imported once from main.tsx (Phase 10 D1): registers the Turnstile provider
// only when a site key is configured; otherwise nothing happens and no script is loaded.
registerTurnstileWidget();
