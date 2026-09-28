// PWA device manager card component
import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  Globe,
  Shield,
  RefreshCw,
  Trash2,
  Edit2,
  Ban,
  CheckCircle,
  AlertTriangle,
  User,
  HardDrive,
  Info,
  Clock,
  Check,
  Copy,
  Zap,
  Lock,
  Wifi,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PwaDevice } from '../types';
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

interface PwaDeviceManagerCardProps {
  onDeviceUpdated?: () => void;
}

export const PwaDeviceManagerCard: React.FC<PwaDeviceManagerCardProps> = ({ onDeviceUpdated }) => {
  // Current local device state
  const [currentDeviceId, setCurrentDeviceId] = useState<string>(getDeviceId());
  const [currentDeviceName, setCurrentDeviceName] = useState<string>(getDeviceName());
  const [currentOperatorName, setCurrentOperatorName] = useState<string>(getOperatorName());
  const [isPwa] = useState<boolean>(isStandalonePWA());

  // Edit current device state
  const [isEditingCurrentDevice, setIsEditingCurrentDevice] = useState<boolean>(false);
  const [editNameInput, setEditNameInput] = useState<string>('');
  const [editOperatorInput, setEditOperatorInput] = useState<string>('');
  const [isSavingCurrent, setIsSavingCurrent] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Registered devices state from server
  const [devices, setDevices] = useState<PwaDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);
  const [deviceActionLoadingId, setDeviceActionLoadingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit another device modal
  const [editingDevice, setEditingDevice] = useState<PwaDevice | null>(null);
  const [modalName, setModalName] = useState<string>('');
  const [modalOperator, setModalOperator] = useState<string>('');
  const [modalNotes, setModalNotes] = useState<string>('');
  const [isSavingModal, setIsSavingModal] = useState<boolean>(false);

  // Delete confirmation
  const [deviceToDelete, setDeviceToDelete] = useState<PwaDevice | null>(null);

  // Security explainer collapsible
  const [showSecurityInfo, setShowSecurityInfo] = useState<boolean>(false);

  // Sync state when local device info changes
  useEffect(() => {
    const handleLocalDeviceUpdate = () => {
      setCurrentDeviceId(getDeviceId());
      setCurrentDeviceName(getDeviceName());
      setCurrentOperatorName(getOperatorName());
    };
    window.addEventListener('freezer_device_info_changed', handleLocalDeviceUpdate);
    return () => window.removeEventListener('freezer_device_info_changed', handleLocalDeviceUpdate);
  }, []);

  // Fetch devices from backend
  const fetchDevices = useCallback(async () => {
    setIsLoadingDevices(true);
    try {
      const res = await fetch(getApiUrl('api/devices'), {
        headers: {
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.devices && Array.isArray(data.devices)) {
          setDevices(data.devices);
        }
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Handle saving this device's operator and device name
  const handleSaveCurrentDevice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingCurrent(true);
    setFeedbackMessage(null);
    try {
      const cleanOp = editOperatorInput.trim();
      const cleanDev = editNameInput.trim() || currentDeviceName;

      setClientDeviceInfo({
        operatorName: cleanOp,
        deviceName: cleanDev,
        markPrompted: true
      });

      setCurrentOperatorName(cleanOp);
      setCurrentDeviceName(cleanDev);

      // Register with backend immediately
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
      });

      setIsEditingCurrentDevice(false);
      setFeedbackMessage({
        type: 'success',
        text: `Device identity saved! Operator "${cleanOp || 'Unassigned'}" will be recorded in audit logs.`
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
      fetchDevices();
      if (onDeviceUpdated) onDeviceUpdated();
    } catch (err: any) {
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Failed to save device identity.'
      });
    } finally {
      setIsSavingCurrent(false);
    }
  };

  // Copy Device ID
  const handleCopyId = (id: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Toggle Revoke / Authorize
  const handleToggleAuthorization = async (device: PwaDevice) => {
    const isCurrentlyRevoked = device.status === 'revoked';
    const endpoint = isCurrentlyRevoked
      ? `api/devices/${encodeURIComponent(device.id)}/authorize`
      : `api/devices/${encodeURIComponent(device.id)}/revoke`;

    setDeviceActionLoadingId(device.id);
    try {
      const res = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        setFeedbackMessage({
          type: 'success',
          text: isCurrentlyRevoked
            ? `Device "${device.name}" access restored.`
            : `Device "${device.name}" revoked. Any active session has been immediately disconnected.`
        });
        setTimeout(() => setFeedbackMessage(null), 4000);
        fetchDevices();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update authorization.');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Action failed.' });
    } finally {
      setDeviceActionLoadingId(null);
    }
  };

  // Save Modal Edits
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDevice) return;
    setIsSavingModal(true);
    try {
      const res = await fetch(getApiUrl(`api/devices/${encodeURIComponent(editingDevice.id)}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getClientAuditHeaders()
        },
        body: JSON.stringify({
          name: modalName.trim() || editingDevice.name,
          operator: modalOperator.trim(),
          notes: modalNotes.trim()
        })
      });
      if (res.ok) {
        // If editing this device, also update local storage
        if (editingDevice.id === currentDeviceId) {
          setClientDeviceInfo({
            operatorName: modalOperator.trim(),
            deviceName: modalName.trim() || editingDevice.name
          });
          setCurrentOperatorName(modalOperator.trim());
          setCurrentDeviceName(modalName.trim() || editingDevice.name);
        }
        setEditingDevice(null);
        setFeedbackMessage({ type: 'success', text: 'Device settings updated successfully.' });
        setTimeout(() => setFeedbackMessage(null), 3500);
        fetchDevices();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update device.');
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message });
    } finally {
      setIsSavingModal(false);
    }
  };

  // Delete Device
  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;
    setDeviceActionLoadingId(deviceToDelete.id);
    try {
      const res = await fetch(getApiUrl(`api/devices/${encodeURIComponent(deviceToDelete.id)}`), {
        method: 'DELETE',
        headers: {
          ...getClientAuditHeaders()
        }
      });
      if (res.ok) {
        setDeviceToDelete(null);
        setFeedbackMessage({ type: 'success', text: `Device record deleted.` });
        setTimeout(() => setFeedbackMessage(null), 3000);
        fetchDevices();
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Failed to delete device.' });
    } finally {
      setDeviceActionLoadingId(null);
    }
  };

  const formatRelativeTime = (isoString?: string): string => {
    if (!isoString) return 'Never';
    const timestamp = new Date(isoString).getTime();
    if (isNaN(timestamp)) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 15000) return 'Just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    const days = Math.floor(diff / 86400000);
    if (days === 1) return 'Yesterday';
    return `${days}d ago`;
  };

  const getDeviceIcon = (clientDevice?: string, isPwaDevice?: boolean) => {
    const cd = (clientDevice || '').toLowerCase();
    if (isPwaDevice || cd.includes('pwa') || cd.includes('standalone')) {
      return <Smartphone className="w-4 h-4 text-cyan-400" />;
    }
    if (cd.includes('companion') || cd.includes('home assistant')) {
      return <Smartphone className="w-4 h-4 text-blue-400" />;
    }
    if (cd.includes('mobile') || cd.includes('iphone') || cd.includes('android')) {
      return <Smartphone className="w-4 h-4 text-purple-400" />;
    }
    if (cd.includes('tablet') || cd.includes('ipad')) {
      return <Tablet className="w-4 h-4 text-indigo-400" />;
    }
    if (cd.includes('desktop') || cd.includes('mac') || cd.includes('windows')) {
      return <Monitor className="w-4 h-4 text-emerald-400" />;
    }
    return <Globe className="w-4 h-4 text-cool-gray-400" />;
  };

  const totalRegistered = devices.length;
  const pwaCount = devices.filter(d => d.isPwa || d.clientDevice?.includes('Standalone') || d.clientDevice?.includes('PWA')).length;
  const onlineCount = devices.filter(d => d.isOnline || d.id === currentDeviceId).length;
  const revokedCount = devices.filter(d => d.status === 'revoked').length;

  return (
    <div className="bg-gradient-to-br from-cool-gray-850 to-cool-gray-900 rounded-xl border border-cool-gray-750 p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-750/70">
        <div>
          <h3 className="text-base font-bold text-cool-gray-100 flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            PWA & Device Manager
          </h3>
          <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
            Manage all installed PWA phones, tablets, and browser sessions. Set device-specific operator names for accurate audit logs and independently control access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0">
            {totalRegistered} {totalRegistered === 1 ? 'Device' : 'Devices'} Registered
          </span>
          <button
            type="button"
            onClick={fetchDevices}
            disabled={isLoadingDevices}
            className="p-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-300 hover:text-white transition cursor-pointer"
            title="Refresh devices list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingDevices ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {feedbackMessage && (
        <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 animate-fade-in ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-200'
            : 'bg-rose-950/80 border border-rose-800 text-rose-200'
        }`}>
          {feedbackMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          <span>{feedbackMessage.text}</span>
        </div>
      )}

      {/* Card 1: THIS DEVICE IDENTITY */}
      <div className="bg-cool-gray-950/80 rounded-xl border border-cyan-500/30 p-4 space-y-3 relative overflow-hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
              {isPwa ? <Zap className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-cool-gray-200">This Device</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  {isPwa ? '⚡ Installed Standalone PWA' : '🌐 Web Browser'}
                </span>
              </div>
              <span className="text-[11px] text-cool-gray-400">
                Audit trail identity configured for this physical device
              </span>
            </div>
          </div>

          {!isEditingCurrentDevice && (
            <button
              type="button"
              onClick={() => {
                setEditNameInput(currentDeviceName);
                setEditOperatorInput(currentOperatorName);
                setIsEditingCurrentDevice(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 hover:text-cyan-200 border border-cool-gray-700 text-xs font-semibold transition cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Identity</span>
            </button>
          )}
        </div>

        {!isEditingCurrentDevice ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-cool-gray-850">
            {/* Operator Name */}
            <div className="bg-cool-gray-900/80 p-2.5 rounded-lg border border-cool-gray-800">
              <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Assigned Operator (Audit Name)
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-cool-gray-100 font-mono">
                  {currentOperatorName ? `@${currentOperatorName}` : <span className="text-cool-gray-500 font-sans italic">Not configured</span>}
                </span>
              </div>
              <span className="text-[10px] text-cool-gray-500 mt-0.5 block">
                Stamped on all cuts, transfers, and inventory edits
              </span>
            </div>

            {/* Device Label */}
            <div className="bg-cool-gray-900/80 p-2.5 rounded-lg border border-cool-gray-800">
              <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Device Label
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-bold text-cool-gray-100">
                  {currentDeviceName}
                </span>
              </div>
              <span className="text-[10px] text-cool-gray-500 mt-0.5 block">
                Friendly label shown in the Device Manager
              </span>
            </div>

            {/* Device ID */}
            <div className="bg-cool-gray-900/80 p-2.5 rounded-lg border border-cool-gray-800">
              <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                Hardware Device ID
              </span>
              <div className="flex items-center justify-between gap-1 mt-1">
                <span className="text-xs font-mono text-cool-gray-300 truncate select-all">
                  {currentDeviceId.substring(0, 16)}...
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyId(currentDeviceId)}
                  className="p-1 hover:text-white text-cool-gray-400 transition"
                  title="Copy full Device ID"
                >
                  {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-cool-gray-500 mt-0.5 block">
                Persistent unique token stored in browser
              </span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveCurrentDevice} className="space-y-3 pt-2 border-t border-cool-gray-850">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Operator / User Name (e.g. Nick, Sarah)
                </label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={editOperatorInput}
                  onChange={(e) => setEditOperatorInput(e.target.value)}
                  className="w-full bg-cool-gray-900 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                  autoFocus
                />
                <span className="text-[10px] text-cool-gray-400 mt-0.5 block">
                  Replaces the generic "web browser" label in your activity audit log.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Device Label (e.g. Nick's iPhone, Walk-in iPad)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nick's iPhone"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  className="w-full bg-cool-gray-900 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <span className="text-[10px] text-cool-gray-400 mt-0.5 block">
                  Lets administrators identify this specific device.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingCurrentDevice(false)}
                className="px-3 py-1.5 text-xs text-cool-gray-400 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingCurrent}
                className="px-4 py-1.5 rounded-lg text-xs font-extrabold bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {isSavingCurrent ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save Device Identity</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">Total Devices</span>
            <span className="text-lg font-black text-cool-gray-100">{totalRegistered}</span>
          </div>
          <HardDrive className="w-5 h-5 text-cool-gray-500" />
        </div>

        <div className="p-3 bg-cyan-950/30 rounded-xl border border-cyan-800/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider block">Standalone PWAs</span>
            <span className="text-lg font-black text-cyan-300">{pwaCount}</span>
          </div>
          <Zap className="w-5 h-5 text-cyan-400" />
        </div>

        <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-800/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider block">Online Now</span>
            <span className="text-lg font-black text-emerald-300">{onlineCount}</span>
          </div>
          <Wifi className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-3 bg-rose-950/30 rounded-xl border border-rose-800/40 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">Revoked</span>
            <span className="text-lg font-black text-rose-300">{revokedCount}</span>
          </div>
          <Ban className="w-5 h-5 text-rose-400" />
        </div>
      </div>

      {/* ALL REGISTERED DEVICES TABLE */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-cool-gray-300 uppercase tracking-wider">
            All Installed & Registered Devices
          </span>
          <span className="text-[11px] text-cool-gray-500">
            Persistent hardware registry in SQLite
          </span>
        </div>

        {devices.length === 0 ? (
          <div className="p-8 text-center bg-cool-gray-900/50 rounded-xl border border-cool-gray-800 text-cool-gray-400 text-xs space-y-2">
            <Smartphone className="w-8 h-8 mx-auto text-cool-gray-600" />
            <p className="font-semibold text-cool-gray-300">No external devices registered yet</p>
            <p className="text-[11px] text-cool-gray-500 max-w-sm mx-auto">
              When phones or tablets open the standalone PWA or web app, they will automatically register here.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1 custom-scrollbar">
            {devices.map((device) => {
              const isThisDevice = device.id === currentDeviceId;
              const isRevoked = device.status === 'revoked';
              const isLoadingAction = deviceActionLoadingId === device.id;

              return (
                <div
                  key={device.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isRevoked
                      ? 'bg-rose-950/20 border-rose-900/50 opacity-80'
                      : isThisDevice
                      ? 'bg-cyan-950/25 border-cyan-500/40 ring-1 ring-cyan-500/20'
                      : 'bg-cool-gray-900/70 border-cool-gray-800 hover:border-cool-gray-750'
                  }`}
                >
                  {/* Left: Device & Operator Info */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl border shrink-0 ${
                      isRevoked
                        ? 'bg-rose-950/60 border-rose-800/60 text-rose-400'
                        : isThisDevice
                        ? 'bg-cyan-950/60 border-cyan-800/60 text-cyan-400'
                        : 'bg-cool-gray-800 border-cool-gray-700 text-cool-gray-300'
                    }`}>
                      {getDeviceIcon(device.clientDevice, device.isPwa)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-cool-gray-100 truncate">
                          {device.name}
                        </span>

                        {isThisDevice && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-200 border border-cyan-700/60">
                            This Device (You)
                          </span>
                        )}

                        {device.operator && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cool-gray-800 text-cyan-300 border border-cool-gray-750 font-mono">
                            @{device.operator}
                          </span>
                        )}

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          device.isPwa
                            ? 'bg-purple-950/60 text-purple-300 border-purple-800/60'
                            : 'bg-cool-gray-800 text-cool-gray-400 border-cool-gray-700'
                        }`}>
                          {device.clientDevice || (device.isPwa ? 'Standalone PWA' : 'Web Browser')}
                        </span>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isRevoked
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}>
                          {isRevoked ? 'Revoked' : 'Authorized'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-cool-gray-400 mt-1 flex-wrap">
                        <span>{device.clientInfo || device.deviceType || 'Web Client'}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-cool-gray-500">
                          ID: {device.id.substring(0, 8)}...
                        </span>
                        {device.lastIp && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-cool-gray-500 font-mono">{device.lastIp}</span>
                          </>
                        )}
                        {device.notes && (
                          <>
                            <span>•</span>
                            <span className="text-[10px] text-amber-400 italic font-medium">"{device.notes}"</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Presence Status & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-cool-gray-800">
                    <div className="text-left sm:text-right">
                      <div className="flex items-center sm:justify-end gap-1.5 text-xs">
                        {device.isOnline || isThisDevice ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-emerald-400 font-bold text-xs">Online Now</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-cool-gray-500" />
                            <span className="text-cool-gray-400 text-xs">Active {formatRelativeTime(device.lastSeen)}</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] text-cool-gray-500 block">
                        Added {new Date(device.firstSeen).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDevice(device);
                          setModalName(device.name);
                          setModalOperator(device.operator || '');
                          setModalNotes(device.notes || '');
                        }}
                        className="p-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white border border-cool-gray-700 transition cursor-pointer"
                        title="Edit Device Label & Operator Name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Revoke / Authorize Button */}
                      <button
                        type="button"
                        disabled={isLoadingAction}
                        onClick={() => handleToggleAuthorization(device)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-50 ${
                          isRevoked
                            ? 'bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border-emerald-800/60'
                            : 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border-rose-800/60'
                        }`}
                        title={isRevoked ? "Restore Device Access" : "Revoke Access (Terminates Live Session)"}
                      >
                        {isLoadingAction ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : isRevoked ? (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Authorize</span>
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5" />
                            <span className="text-[11px]">Revoke</span>
                          </>
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => setDeviceToDelete(device)}
                        className="p-1.5 rounded-lg bg-cool-gray-800/60 hover:bg-rose-950/60 text-cool-gray-400 hover:text-rose-300 border border-cool-gray-750 hover:border-rose-800/60 transition cursor-pointer"
                        title="Delete Device Registration"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECURITY EXPLAINER ACCORDION (Answers HA User Access & Persistent Cookie Question) */}
      <div className="bg-cool-gray-950/90 rounded-xl border border-cool-gray-800 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSecurityInfo(!showSecurityInfo)}
          className="w-full p-3.5 text-left flex items-center justify-between gap-3 text-xs font-bold text-cool-gray-200 hover:text-white transition cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>How Security & Home Assistant Access Control Work with PWAs</span>
          </div>
          {showSecurityInfo ? <ChevronUp className="w-4 h-4 text-cool-gray-400" /> : <ChevronDown className="w-4 h-4 text-cool-gray-400" />}
        </button>

        {showSecurityInfo && (
          <div className="p-4 pt-1 text-xs text-cool-gray-300 space-y-3 border-t border-cool-gray-850 bg-cool-gray-950/50">
            <div className="space-y-1.5">
              <strong className="text-cyan-300 block">1. Home Assistant Ingress vs. Standalone PWA Access:</strong>
              <p className="text-cool-gray-400 leading-relaxed text-[11px]">
                When accessing the app through the Home Assistant Companion App or web dashboard, Home Assistant's Ingress proxy verifies the user's active HA session on every single request. If you disable or delete a user in Home Assistant, their ingress session cookie is immediately invalidated by Home Assistant core, and they lose all access.
              </p>
            </div>

            <div className="space-y-1.5">
              <strong className="text-blue-300 block">2. Standalone PWAs & Persistent Browser Cookies:</strong>
              <p className="text-cool-gray-400 leading-relaxed text-[11px]">
                When installed as a standalone PWA or opened via direct URLs/tunnels, browsers store persistent storage and session tokens to enable offline functionality in walk-in freezers. To ensure you never lose control of installed devices:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-cool-gray-400 text-[11px]">
                <li>
                  <strong className="text-cool-gray-200">Independent Device Revocation:</strong> The <span className="text-cyan-400 font-semibold">PWA Device Manager</span> above provides an independent server-authoritative killswitch.
                </li>
                <li>
                  <strong className="text-cool-gray-200">Instant Stream Termination:</strong> Clicking <span className="text-rose-400 font-semibold">"Revoke"</span> on any phone or tablet immediately terminates its active real-time SSE sync stream, drops active connections, and rejects all subsequent API requests with HTTP 403 Forbidden.
                </li>
                <li>
                  <strong className="text-cool-gray-200">Persistent Cookie Immunity:</strong> Even if a user retains a cached cookie or offline token on their physical device, a revoked device ID is strictly blocked on the SQLite database layer.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* EDIT DEVICE MODAL */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 bg-cool-gray-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl animate-scale-up">
            <div className="flex items-center justify-between pb-3 border-b border-cool-gray-800">
              <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-400" />
                Edit Device Details
              </h4>
              <button
                type="button"
                onClick={() => setEditingDevice(null)}
                className="text-cool-gray-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Device Label
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Operator Name (Audit Log Attribution)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nick"
                  value={modalOperator}
                  onChange={(e) => setModalOperator(e.target.value)}
                  className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-cool-gray-400 mt-0.5 block">
                  Actions performed on this device will be logged under this user name.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-cool-gray-300 uppercase tracking-wider block mb-1">
                  Administrative Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Meat cutting room tablet"
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full bg-cool-gray-950 text-xs font-semibold rounded-lg border border-cool-gray-700 px-3 py-2 text-cool-gray-100 outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-cool-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingDevice(null)}
                  className="px-3.5 py-1.5 text-xs text-cool-gray-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingModal}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingModal ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-50 bg-cool-gray-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-900 border border-rose-900/50 rounded-2xl max-w-sm w-full p-5 space-y-3.5 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-bold text-cool-gray-100">Delete Device Record?</h4>
            </div>
            <p className="text-xs text-cool-gray-300">
              Are you sure you want to remove <strong className="text-white">"{deviceToDelete.name}"</strong> from the device registry?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeviceToDelete(null)}
                className="px-3 py-1.5 text-xs text-cool-gray-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDevice}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-sm"
              >
                Delete Device
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
