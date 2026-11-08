// Security token & Cloudflare Access re-authentication modal
import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldCheck, ShieldAlert, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, Server, Smartphone, ExternalLink, Settings2, Check } from 'lucide-react';
import { getDeviceId, getDeviceName, getOperatorName } from '../utils/clientDevice';
import { executeSecurityTokenRefresh, probeAuthStatus, getCloudflareServiceTokens, setCloudflareServiceTokens, AuthProbeResult } from '../utils/authSecurity';

interface SecurityTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecurityTokenModal: React.FC<SecurityTokenModalProps> = ({ isOpen, onClose }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<AuthProbeResult | null>(null);
  const [showAdvancedTokens, setShowAdvancedTokens] = useState(false);
  const [cfClientId, setCfClientId] = useState('');
  const [cfClientSecret, setCfClientSecret] = useState('');
  const [savedTokensSuccess, setSavedTokensSuccess] = useState(false);

  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const operatorName = getOperatorName() || 'Default User';

  useEffect(() => {
    if (isOpen) {
      const existing = getCloudflareServiceTokens();
      setCfClientId(existing.clientId);
      setCfClientSecret(existing.clientSecret);
      setSavedTokensSuccess(false);

      // Auto-probe connection status on modal open
      runProbe();
    }
  }, [isOpen]);

  const runProbe = async () => {
    setIsProbing(true);
    try {
      const result = await probeAuthStatus();
      setProbeResult(result);
    } finally {
      setIsProbing(false);
    }
  };

  const handleExecuteRefresh = async (customPath?: string) => {
    setIsRefreshing(true);
    try {
      await executeSecurityTokenRefresh(customPath ? { customPath } : undefined);
    } catch (err) {
      console.error('Failed to trigger token refresh:', err);
      setIsRefreshing(false);
    }
  };

  const handleSaveServiceTokens = () => {
    setCloudflareServiceTokens({
      clientId: cfClientId,
      clientSecret: cfClientSecret
    });
    setSavedTokensSuccess(true);
    setTimeout(() => {
      setSavedTokensSuccess(false);
    }, 2500);
    // Re-probe with new credentials
    runProbe();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="fixed inset-0" 
        onClick={() => { if (!isRefreshing) onClose(); }} 
      />

      <div className="relative w-full max-w-lg bg-cool-gray-900 border border-cool-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-10 max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-cool-gray-900 via-rose-950/30 to-amber-950/20 border-b border-cool-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-inner">
              <KeyRound className="w-5 h-5 text-rose-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Refresh Security Token
                </h3>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider">
                  Cloudflare
                </span>
              </div>
              <p className="text-xs text-cool-gray-400 mt-0.5">
                Re-authenticate without losing device identity or user name
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 transition cursor-pointer disabled:opacity-50"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Identity Safe Guarantee Banner */}
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-emerald-200 shadow-inner">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <strong className="text-white text-xs sm:text-sm font-bold block">
                  Device Identity & Data 100% Preserved
                </strong>
                <p className="text-[11px] text-emerald-200/90 mt-0.5 leading-snug">
                  Previously, clearing browser cache wiped your device configuration. This refresh only clears the HTTP cache and opens Cloudflare Access login to renew your session token without clearing your device identity:
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] bg-emerald-950/70 p-2 rounded-lg border border-emerald-800/50">
                  <div>
                    <span className="text-emerald-400/80 block text-[10px] uppercase font-bold">Device Name</span>
                    <span className="font-semibold text-white truncate block">{deviceName}</span>
                  </div>
                  <div>
                    <span className="text-emerald-400/80 block text-[10px] uppercase font-bold">Operator Name</span>
                    <span className="font-semibold text-white truncate block">{operatorName}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-emerald-800/40">
                    <span className="text-emerald-400/80 block text-[9px] uppercase font-mono">Device ID</span>
                    <span className="font-mono text-[10px] text-emerald-300 break-all select-all">{deviceId}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Connection Diagnostics Card */}
          <div className="p-3.5 bg-cool-gray-850 rounded-xl border border-cool-gray-750">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cool-gray-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                Connection & Token Status
              </span>
              <button
                type="button"
                onClick={runProbe}
                disabled={isProbing}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isProbing ? 'animate-spin' : ''}`} />
                <span>{isProbing ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            {probeResult ? (
              <div className={`p-2.5 rounded-lg border flex items-start gap-2 ${
                probeResult.isBlocked
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
              }`}>
                {probeResult.isBlocked ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0 text-xs">
                  <div className="font-bold flex items-center gap-1.5 flex-wrap">
                    <span>{probeResult.isBlocked ? 'Authentication Required' : 'Connection Active'}</span>
                    {probeResult.status > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-current">
                        HTTP {probeResult.status}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5 opacity-90 leading-snug">
                    {probeResult.message}
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-cool-gray-400 italic">
                Click "Test Connection" to check if Cloudflare Access is currently blocking API requests.
              </div>
            )}
          </div>

          {/* Explanation of Monthly Cloudflare Expiry */}
          <div className="p-3 bg-cool-gray-850/60 rounded-xl border border-cool-gray-800 text-cool-gray-300 text-xs leading-relaxed space-y-1.5">
            <p className="font-semibold text-cool-gray-200">
              Why does this happen?
            </p>
            <p className="text-cool-gray-400 text-[11px] leading-snug">
              Cloudflare Access session tokens typically expire every 30 days. When this happens, background data sync is blocked and the app displays <span className="text-amber-400 font-semibold">Offline</span>. 
              Clicking below will clear the web app shell cache and redirect to the Cloudflare Access login screen, immediately returning you here once authenticated.
            </p>
          </div>

          {/* Advanced / Optional Service Token Configuration */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedTokens(!showAdvancedTokens)}
              className="text-xs font-semibold text-cool-gray-400 hover:text-cool-gray-200 flex items-center gap-1.5 cursor-pointer transition select-none"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Advanced: Cloudflare Service Token Headers (Optional)</span>
              <span className="text-[10px] text-cool-gray-500">[{showAdvancedTokens ? 'Hide' : 'Show'}]</span>
            </button>

            {showAdvancedTokens && (
              <div className="mt-2.5 p-3 rounded-xl bg-cool-gray-850/80 border border-cool-gray-750 space-y-2.5 animate-scale-up">
                <p className="text-[11px] text-cool-gray-400 leading-snug">
                  If your Cloudflare Zero Trust setup uses non-expiring machine Service Tokens (<code className="text-cyan-300 font-mono text-[10px]">CF-Access-Client-Id</code> and <code className="text-cyan-300 font-mono text-[10px]">CF-Access-Client-Secret</code>), you can store them here to bypass periodic session expiration.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-cool-gray-300 block">
                    CF-Access-Client-Id
                  </label>
                  <input
                    type="text"
                    value={cfClientId}
                    onChange={(e) => setCfClientId(e.target.value)}
                    placeholder="e.g. 1234567890abcdef.access"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-cool-gray-500 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-cool-gray-300 block">
                    CF-Access-Client-Secret
                  </label>
                  <input
                    type="password"
                    value={cfClientSecret}
                    onChange={(e) => setCfClientSecret(e.target.value)}
                    placeholder="Enter Client Secret"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-cool-gray-500 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setCfClientId('');
                      setCfClientSecret('');
                      setCloudflareServiceTokens({ clientId: '', clientSecret: '' });
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                  >
                    Clear Tokens
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveServiceTokens}
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition cursor-pointer flex items-center gap-1 shadow"
                  >
                    {savedTokensSuccess ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{savedTokensSuccess ? 'Saved!' : 'Save Credentials'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Primary Actions */}
        <div className="p-4 sm:p-5 bg-cool-gray-850 border-t border-cool-gray-800 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => handleExecuteRefresh('/cdn-cgi/access/login')}
            disabled={isRefreshing}
            className="w-full sm:w-auto px-3 py-2 text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            title="Navigate directly to /cdn-cgi/access/login"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Direct /cdn-cgi Login</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-bold transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => handleExecuteRefresh()}
              disabled={isRefreshing}
              className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-rose-600 via-amber-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-black rounded-xl text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Redirecting to Cloudflare...' : 'Re-authenticate with Cloudflare'}</span>
              {!isRefreshing && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
