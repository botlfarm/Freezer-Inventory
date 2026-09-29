
// Main application entrypoint
import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import App from './App';
import './index.css';

// Service Worker Management for PWA offline operation & sandbox stability
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const isIframe = window.self !== window.top;
  const isPreviewHost = window.location.hostname.endsWith('.run.app');
  const isDevMode = import.meta.env.DEV;

  // Only disable the service worker in the development editor sandbox preview
  // and cloud preview host environments in development mode.
  // In production (such as the live Home Assistant add-on or direct deployments),
  // always allow service worker registration to enable PWA installability and offline support.
  if (isDevMode && (isIframe || isPreviewHost)) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister().catch(() => {}));
    }).catch(() => {});
  } else {
    // In direct/top-level browser windows, register service worker to meet Chrome Android PWA installability criteria
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js', { scope: './' }).then((registration) => {
          console.log('[PWA] ServiceWorker registered with scope:', registration.scope);

          // Register periodic background sync for automatic database updates
          if ('periodicSync' in registration) {
            const reg = registration as any;
            (async () => {
              try {
                // Check if we already have the permission, otherwise request/register
                const status = await (navigator as any).permissions.query({
                  name: 'periodic-background-sync' as any,
                });
                if (status.state === 'granted') {
                  await reg.periodicSync.register('update-database', {
                    minInterval: 3 * 60 * 60 * 1000, // every 3 hours
                  });
                  console.log('[PWA] Periodic background sync registered successfully for tag update-database');
                } else {
                  console.log('[PWA] Periodic background sync permission state:', status.state);
                  // Try to register directly just in case permission state check was overly strict
                  await reg.periodicSync.register('update-database', {
                    minInterval: 3 * 60 * 60 * 1000,
                  });
                }
              } catch (e) {
                // Fallback direct register
                try {
                  await reg.periodicSync.register('update-database', {
                    minInterval: 3 * 60 * 60 * 1000,
                  });
                  console.log('[PWA] Periodic background sync registered directly');
                } catch (err) {
                  console.warn('[PWA] Could not register periodic background sync:', err);
                }
              }
            })();
          }
        }).catch((err) => {
          console.warn('[PWA] ServiceWorker registration fallback:', err);
          try {
            registerSW({ immediate: true });
          } catch (_) {}
        });
      }
    } catch (e) {
      console.warn('[PWA] Service worker initialization error:', e);
    }
  }
}

// Global unhandled error & rejection listeners to prevent unhandled camera/media/stream exceptions from crashing to white screen
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.warn('[Global] Suppressed unhandled rejection:', event.reason);
    // Prevent unhandled promise rejection from blanking out React
    if (event.preventDefault) {
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    console.warn('[Global] Caught window error:', event.error || event.message);
  });
}

// Gracefully guard performance.measure against DataCloneError in iframe/DevTools environments
if (typeof window !== 'undefined' && window.performance && typeof window.performance.measure === 'function') {
    const originalMeasure = window.performance.measure.bind(window.performance);
    window.performance.measure = function (measureName: string, startOrMeasureOptions?: any, endMark?: string) {
        try {
            return originalMeasure(measureName, startOrMeasureOptions, endMark);
        } catch (_) {
            try {
                if (typeof startOrMeasureOptions === 'string') {
                    return originalMeasure(measureName, startOrMeasureOptions, endMark);
                }
            } catch (_) {}
            return undefined as any;
        }
    };
}

polyfill({
    dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride,
    holdToDrag: 300
});

// Polyfill requires this listener on some mobile browsers to prevent scrolling when dragging begins
window.addEventListener('touchmove', function() {}, {passive: false});

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends (React.Component as any) {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled app error caught by AppErrorBoundary:', error, errorInfo);
  }

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k))).catch(() => {});
      }
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('freezer_inventory_offline_db');
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
        }).catch(() => {});
      }
    } catch (e) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '480px',
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f87171', marginBottom: '12px' }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.5' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0284c7',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Reload App
              </button>
              <button
                onClick={this.handleClearCacheAndReload}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#475569',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Clear Cache & Restart
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);
