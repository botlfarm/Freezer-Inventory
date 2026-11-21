import React, { useEffect, useState } from 'react';
import { Truck, Package, Save, RotateCcw, CheckCircle2, AlertTriangle, KeyRound } from 'lucide-react';
import { InventoryState, Action } from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { authFetch } from '../utils/clientDevice';
import { useUserAuth } from '../hooks/useUserAuth';

interface OffSiteSettingsPanelProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  fromName: string;
  setFromName: (val: string) => void;
  fromAddress: string;
  setFromAddress: (val: string) => void;
  theoreticalBoxWeight: number;
  setTheoreticalBoxWeight: (val: number) => void;
}

export const OffSiteSettingsPanel: React.FC<OffSiteSettingsPanelProps> = ({
  state,
  dispatch,
  fromName,
  setFromName,
  fromAddress,
  setFromAddress,
  theoreticalBoxWeight,
  setTheoreticalBoxWeight,
}) => {
  const { usersConfigured, isAuthenticated, requireLoginForEdits, openAccountModal } = useUserAuth();
  const isLoginRequiredForWrite = usersConfigured && requireLoginForEdits && !isAuthenticated;

  const [boxWeightInput, setBoxWeightInput] = useState<string>(() =>
    theoreticalBoxWeight > 0 ? String(theoreticalBoxWeight) : '40'
  );
  const [weightError, setWeightError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string; authRequired?: boolean } | null>(null);

  useEffect(() => {
    if (theoreticalBoxWeight > 0) {
      setBoxWeightInput(String(theoreticalBoxWeight));
    }
  }, [theoreticalBoxWeight]);

  const persistConfigs = async (configs: Record<string, string>, successMessage: string) => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/app-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs }),
      });

      if (res.status === 401) {
        setFeedback({
          type: 'error',
          text: 'Sign in with your user PIN to save changes to the shared server database.',
          authRequired: true,
        });
        return;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setFeedback({
          type: 'error',
          text: errBody?.message || 'Failed to persist Off-Site Settings to server.',
        });
        return;
      }

      const data = await res.json().catch(() => ({}));
      const nextAppConfig = Array.isArray(data?.appConfig)
        ? data.appConfig
        : data && data.configs
          ? Object.entries(data.configs).map(([k, v]) => ({
              key: k,
              value: String(v ?? ''),
              updatedAt: new Date().toISOString(),
            }))
          : null;
      if (nextAppConfig) {
        dispatch({
          type: 'SYNC_APP_CONFIG',
          payload: nextAppConfig,
        });
      }

      setFeedback({ type: 'success', text: successMessage });
      setTimeout(() => setFeedback(null), 4000);
    } catch {
      setFeedback({
        type: 'error',
        text: 'Saved locally. Network unavailable—changes could not sync to the server yet.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeight = parseFloat(boxWeightInput);
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      setWeightError('Enter a positive weight greater than 0 lbs (default is 40 lbs).');
      return;
    }

    setWeightError(null);
    setTheoreticalBoxWeight(parsedWeight);
    localStorage.setItem('report-from-name', fromName);
    localStorage.setItem('report-from-address', fromAddress);
    localStorage.setItem('offsite-theoretical-box-weight', String(parsedWeight));

    await persistConfigs(
      {
        'report-from-name': fromName,
        'report-from-address': fromAddress,
        'offsite-theoretical-box-weight': String(parsedWeight),
      },
      'Off-Site Settings saved and synced across devices.',
    );
  };

  const handleResetWeightDefault = async () => {
    setWeightError(null);
    setBoxWeightInput('40');
    setTheoreticalBoxWeight(40);
    localStorage.setItem('offsite-theoretical-box-weight', '40');
    await persistConfigs(
      { 'offsite-theoretical-box-weight': '40' },
      'Reset theoretical box weight to default 40 lbs.',
    );
  };

  return (
    <form onSubmit={handleSaveAll} className="space-y-6 max-w-4xl font-sans">
      {isLoginRequiredForWrite && (
        <div className="p-3.5 rounded-lg border border-amber-500/35 bg-amber-950/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-amber-200 font-medium">
            Sign in with your user PIN to sync Off-Site Settings changes to the server.
          </span>
          <button
            type="button"
            onClick={() => openAccountModal('signin')}
            className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Sign In
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/35 border-emerald-700/50 text-emerald-200'
              : 'bg-rose-950/35 border-rose-700/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          {feedback.authRequired && (
            <button
              type="button"
              onClick={() => openAccountModal('signin')}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs whitespace-nowrap cursor-pointer"
            >
              Sign In with PIN
            </button>
          )}
        </div>
      )}

      {/* Default Movement Report Shipper Card */}
      <section className="bg-cool-gray-850 rounded-lg border border-cool-gray-750 p-5 space-y-4">
        <div className="border-b border-cool-gray-800 pb-3">
          <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
            <Truck className="w-4 h-4 text-cyan-400" />
            Default Movement Report Shipper (From Address)
          </h4>
          <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
            Set the default origin name and address pre-filled on Delivery Slips and Transfer Manifests. You can still customize these live inside each report form.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 max-w-xl">
          <div>
            <label
              htmlFor="offsite-shipper-name-input"
              className="block text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider mb-1.5"
            >
              Default Shipper Name
            </label>
            <input
              id="offsite-shipper-name-input"
              type="text"
              value={fromName}
              onChange={(e) => {
                setFromName(e.target.value);
                localStorage.setItem('report-from-name', e.target.value);
              }}
              className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 font-medium"
              placeholder="Shipper or farm name (e.g. My Ranch)"
            />
          </div>

          <div>
            <label
              htmlFor="offsite-shipper-address-input"
              className="block text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider mb-1.5"
            >
              Default Shipper Address
            </label>
            <textarea
              id="offsite-shipper-address-input"
              value={fromAddress}
              onChange={(e) => {
                setFromAddress(e.target.value);
                localStorage.setItem('report-from-address', e.target.value);
              }}
              rows={3}
              className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:border-cyan-500 font-medium leading-snug"
              placeholder="Street address, City, State, Zip"
            />
          </div>
        </div>
      </section>

      {/* Theoretical / Simulated Box Weight Card */}
      <section className="bg-cool-gray-850 rounded-lg border border-cool-gray-750 p-5 space-y-4">
        <div className="border-b border-cool-gray-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              Simulated Box Weight Estimation
            </h4>
            <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
              Specify the theoretical weight (lbs) per box used to estimate box counts in the Off-Site Storage spreadsheet.
            </p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleResetWeightDefault}
            className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-xs font-semibold text-cool-gray-300 flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cool-gray-400" />
            Reset to 40 lbs
          </button>
        </div>

        <div className="max-w-xs space-y-1.5">
          <label
            htmlFor="offsite-box-weight-input"
            className="block text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider"
          >
            Theoretical Box Weight (lbs)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="offsite-box-weight-input"
              type="number"
              min="0.1"
              step="0.1"
              value={boxWeightInput}
              onChange={(e) => {
                setBoxWeightInput(e.target.value);
                setWeightError(null);
              }}
              className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3.5 py-2 text-white text-sm font-mono tabular-nums focus:outline-none focus:border-cyan-500 font-semibold"
              placeholder="40"
            />
            <span className="text-xs font-semibold text-cool-gray-400 shrink-0">lbs</span>
          </div>
          {weightError && (
            <p className="text-xs text-rose-400 font-medium">{weightError}</p>
          )}
        </div>
      </section>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <p className="text-xs text-cool-gray-400">
          Changes are stored in the shared database (<code className="font-mono text-cyan-400">app_config</code>) for all team members.
        </p>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 transition"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Saving...' : 'Save Off-Site Settings'}
        </button>
      </div>
    </form>
  );
};
