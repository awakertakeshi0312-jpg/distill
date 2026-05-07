import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import {
  isTauriRuntimeWindow,
  shouldRegisterServiceWorker,
  unregisterDesktopServiceWorkers,
} from './serviceWorkerPolicy';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

void unregisterDesktopServiceWorkers().catch((error) => {
  console.warn('Distill desktop service worker cleanup failed.', error);
});

if (
  shouldRegisterServiceWorker({
    hasServiceWorker: 'serviceWorker' in navigator,
    isProduction: import.meta.env.PROD,
    isTauriRuntime: isTauriRuntimeWindow(),
  })
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((error) => {
      console.warn('Distill service worker registration failed.', error);
    });
  });
}
