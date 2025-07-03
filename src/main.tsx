import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './scripts/diagnoseUserIsolation';
import './scripts/cleanupLegacyGoals';
import './scripts/cleanupContaminatedData';
import './scripts/cleanupUserGoals';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
