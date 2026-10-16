import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { PlaceholderPage } from './pages/placeholder-page';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <PlaceholderPage />
  </StrictMode>,
);
