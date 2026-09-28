import React, { useState } from 'react';
import { Smartphone, User, Check, X, Shield, Sparkles } from 'lucide-react';
import {
  getDeviceId,
  getDeviceName,
  getOperatorName,
  isStandalonePWA,
  setClientDeviceInfo,
  getClientDeviceInfo,
  getClientAuditHeaders
} from '../utils/clientDevice';
import { getApiUrl } from '../hooks/apiUrl';

interface DeviceSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (operator: string, deviceName: string) => void;
}

export const DeviceSetupModal: React.FC<DeviceSetupModalProps> = ({
  isOpen,
  onClose,
  onSaved
}) => {
  const isPwa = isStandalonePWA();
  const [operatorInput, setOperatorInput] = useState<string>(getOperatorName());
  const [deviceLabelInput, setDeviceLabelInput] = useState<string>(getDeviceName());
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOp = operatorInput.trim();
    const cleanDev = deviceLabelInput.trim() || getDeviceName();

    if (!cleanOp) {
      setErrorMsg('Please enter your name or an operator label.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      setClientDeviceInfo({
        operatorName: cleanOp,
        deviceName: cleanDev,
        markPrompted: true
      });

      // Register with server
      const clientInfo = getClientDeviceInfo();
      await fetch(getApiUrl('api/devices/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuditHeaders()
        },
        body: JSON.stringify({
          deviceId: clientInfo.deviceId,
          deviceName: cleanDev,
          operatorName: cleanOp,
          isPwa: clientInfo.isPwa,
          clientDevice: clientInfo.clientDevice,
          clientInfo: clientInfo.clientInfo
        })
      }).catch(() => {});

      if (onSaved) onSaved(cleanOp, cleanDev);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save device settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    setClientDeviceInfo({ markPrompted: true });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-cool-gray-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-cool-gray-900 border border-cyan-500/40 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scale-up text-cool-gray-100">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0">
              {isPwa ? <Sparkles className="w-5 h-5 text-cyan-400" /> : <Smartphone className="w-5 h-5 text-cyan-400" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Configure This Device</span>
                {isPwa && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                    PWA Mode
                  </span>
                )}
              </h3>
              <p className="text-xs text-cool-gray-400 mt-0.5">
                Set up user identity for activity logs & audit tracking
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="text-cool-gray-400 hover:text-white p-1 rounded-lg transition"
            title="Skip for now"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informational Callout */}
        <div className="p-3 bg-cool-gray-950/70 rounded-xl border border-cool-gray-800 text-xs text-cool-gray-300 space-y-1">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
            <Shield className="w-3.5 h-3.5" />
            <span>Audit Trail Attribution</span>
          </div>
          <p className="text-[11px] text-cool-gray-400 leading-relaxed">
            In standalone PWA mode, this operator name replaces the generic "web browser" label in your history log, so every meat cut movement and inventory edit is properly attributed to you.
          </p>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-cool-gray-200 uppercase tracking-wider block mb-1.5">
              Your Name / Operator Name <span className="text-cyan-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-cool-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="e.g. Nick"
                value={operatorInput}
                onChange={(e) => setOperatorInput(e.target.value)}
                className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-700 pl-9 pr-3 py-2 text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                autoFocus
                required
              />
            </div>
            <span className="text-[10px] text-cool-gray-400 mt-1 block">
              Recorded in the activity history when you perform inventory updates.
            </span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-cool-gray-200 uppercase tracking-wider block mb-1.5">
              Device Label
            </label>
            <div className="relative">
              <Smartphone className="w-4 h-4 text-cool-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="e.g. Nick's iPhone"
                value={deviceLabelInput}
                onChange={(e) => setDeviceLabelInput(e.target.value)}
                className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-700 pl-9 pr-3 py-2 text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
              />
            </div>
            <span className="text-[10px] text-cool-gray-400 mt-1 block">
              Helps identify this device in the PWA Device Manager.
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-cool-gray-800">
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-cool-gray-400 hover:text-white transition cursor-pointer"
            >
              Skip for Now
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save & Start Tracking'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
