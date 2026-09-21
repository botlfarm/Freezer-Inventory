
import React from 'react';
import ReactDOM from 'react-dom/client';
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import App from './App';
import './index.css';

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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
