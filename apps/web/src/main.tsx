import './zod-jitless';
import '@fontsource/geist/400.css';
import '@fontsource/geist/500.css';
import '@fontsource/geist/600.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { memoryApi } from './api/client';
import { App } from './App';
import './features/ai/turnstile-register';
import { installE2eHook } from './e2e-hook';
import { loadAnalystName } from './state/memory-sync';
import { useReview } from './state/review';

installE2eHook({
  memory: () => memoryApi(),
  review: () => useReview.getState(),
});

// stored analyst name (non-blocking); the memory session is bootstrapped lazily before the
// first memory call (ensureSession), so a firmless document never calls POST /api/session
void loadAnalystName();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
