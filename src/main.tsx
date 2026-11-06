import { useAppUpdate } from '@/components/ui/UpdateBanner';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Installable app shell (production only). Business data never goes through the service worker.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // A tab already controlled by a service worker sees "controllerchange" only when a newer deploy activates.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) useAppUpdate.setState({ available: true });
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        // Check for new deploys periodically and whenever the tab comes back into view.
        setInterval(() => void reg.update().catch(() => undefined), 30 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);
  });
}

// Surface unexpected errors instead of failing silently.
let lastErrorAt = 0;
const report = (message: string) => {
  if (Date.now() - lastErrorAt < 4000) return;
  lastErrorAt = Date.now();
  void import('./state/toast').then(({ toast }) => toast(`Something went wrong: ${message}. Your saved data is unaffected; reload if the page misbehaves.`, 'error'));
};
window.addEventListener('error', (e) => report(e.message || 'unexpected error'));
window.addEventListener('unhandledrejection', (e) => report(e.reason instanceof Error ? e.reason.message : 'unexpected error'));

