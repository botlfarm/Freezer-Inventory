// PWA install button component
import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share, X, Smartphone, ExternalLink, ShieldCheck } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, isIframe, install, openInNewTab } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA, hide
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop direct prompt flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        title="Install Freezer App for Standalone & Offline Access"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowGuide(true)}
          title="Install on iPhone/iPad for Standalone Offline Access"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-sky-400 border border-sky-500/30 text-xs font-medium transition-all active:scale-95 ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>Install App</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-cool-gray-900 border border-cool-gray-700 p-6 shadow-2xl text-cool-gray-100">
              <div className="flex items-center justify-between pb-3 border-b border-cool-gray-800">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <Smartphone className="w-5 h-5 text-sky-400" />
                  <span>Install on iPhone / iPad</span>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  className="p-1 rounded-lg hover:bg-cool-gray-800 text-cool-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs text-cool-gray-300">
                <p className="leading-relaxed">
                  To use Freezer Tracker offline when disconnected from network or Wi-Fi:
                </p>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-cool-gray-800/80 border border-cool-gray-700">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs shrink-0">1</span>
                  <span>Tap the <strong className="text-white">Share</strong> button <Share className="w-3.5 h-3.5 inline mx-1 text-sky-400" /> in Safari.</span>
                </div>
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-cool-gray-800/80 border border-cool-gray-700">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs shrink-0">2</span>
                  <span>Scroll down and tap <strong className="text-white">Add to Home Screen</strong>.</span>
                </div>
              </div>

              <button
                onClick={() => setShowGuide(false)}
                className="mt-5 w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-medium text-xs text-white shadow-lg transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for iframe preview or when prompt hasn't captured yet
  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        title="Install App for Offline & Standalone Operation"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-cool-gray-900 border border-cool-gray-700 p-6 shadow-2xl text-cool-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-cool-gray-800">
              <div className="flex items-center gap-2 font-semibold text-white">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span>Install Freezer App</span>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg hover:bg-cool-gray-800 text-cool-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-cool-gray-300">
              {isIframe ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-2">
                  <p className="font-semibold text-amber-200">Sandbox / Iframe Notice</p>
                  <p className="text-[11px] leading-relaxed text-amber-300/90">
                    Chrome on Android prevents PWA installation when browsing inside an embedded sandbox iframe.
                  </p>
                  <p className="text-[11px] leading-relaxed text-amber-300/90">
                    Tap <strong>Open in Direct Tab</strong> below to open the standalone app URL, then tap <strong>Install App</strong> or select <strong>Add to Home screen</strong> from Chrome's menu.
                  </p>
                </div>
              ) : (
                <>
                  <p className="leading-relaxed">
                    Freezer Inventory Tracker is fully compliant as an installable Progressive Web App (PWA).
                  </p>
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-cool-gray-800/80 border border-cool-gray-700">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs shrink-0">1</span>
                    <span>Look for the <strong className="text-white">Install App</strong> icon in your browser address bar (Chrome / Edge / Brave).</span>
                  </div>
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-cool-gray-800/80 border border-cool-gray-700">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-bold text-xs shrink-0">2</span>
                    <span>Or open browser options menu (⋮) and select <strong className="text-white">Install Freezer Inventory Tracker</strong> or <strong className="text-white">Add to Home Screen</strong>.</span>
                  </div>
                </>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 font-medium text-xs text-white shadow-lg transition text-center"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open Direct Tab</span>
              </a>
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2.5 rounded-xl bg-cool-gray-800 hover:bg-cool-gray-700 text-xs font-medium text-cool-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
