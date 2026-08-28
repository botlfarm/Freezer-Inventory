
import React from 'react';
import ReactDOM from 'react-dom/client';
import { polyfill } from "mobile-drag-drop";
import "mobile-drag-drop/default.css";
import { scrollBehaviourDragImageTranslateOverride } from "mobile-drag-drop/scroll-behaviour";
import App from './App';
import './index.css';

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
