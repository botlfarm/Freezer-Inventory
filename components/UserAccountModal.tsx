import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { AccountModalTab, useUserAuth } from '../hooks/useUserAuth';
import { getDeviceId, getDeviceName } from '../utils/clientDevice';

export const UserAccountModal: React.FC = () => {
  const {
    status,
    usersConfigured,
    isAuthenticated,
    isAdmin,
    currentUser,
    recoveryModeActive,
    recoveryPinConfigured,
    myDevices,
    loadingMyDevices,
    isAccountModalOpen,
    accountModalTab,
    setAccountModalTab,
    closeAccountModal,
    refreshMyDevices,
    setupFirstAdmin,
    loginWithPin,
    loginWithRecoveryPin,
    logout,
    changeOwnPin,
    renameMyDevice,
    revokeMyDevice,
    authorizeMyDevice,
    deleteMyDevice,
  } = useUserAuth();

  const currentDeviceId = getDeviceId();

  // Sign In form state
  const [signInName, setSignInName] = useState('');
  const [signInPin, setSignInPin] = useState('');
  const [signInDeviceName, setSignInDeviceName] = useState(getDeviceName());
  const [showSignInPin, setShowSignInPin] = useState(false);

  // First Admin Setup state
  const [setupName, setSetupName] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [setupPinConfirm, setSetupPinConfirm] = useState('');
  const [setupDeviceName, setSetupDeviceName] = useState(getDeviceName());
  const [setupRequireLogin, setSetupRequireLogin] = useState(true);

  // Change PIN state
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');

  // Recovery PIN state
  const [recoveryPinInput, setRecoveryPinInput] = useState('');

  // Device rename inline state
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState('');

  // Feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAccountModalOpen) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSignInPin('');
    setCurrentPinInput('');
    setNewPinInput('');
    setConfirmNewPinInput('');
    setRecoveryPinInput('');
    setSignInDeviceName(getDeviceName());
    setSetupDeviceName(getDeviceName());
  }, [isAccountModalOpen, accountModalTab]);

  useEffect(() => {
    if (!isAccountModalOpen) return;
    if (status?.availableUsers && status.availableUsers.length === 1 && !signInName) {
      setSignInName(status.availableUsers[0].name);
    }
  }, [isAccountModalOpen, status, signInName]);

  if (!isAccountModalOpen) return null;

  const availableTabs: Array<{ id: AccountModalTab; label: string }> = [];
  if (!usersConfigured) {
    availableTabs.push({ id: 'setup-admin', label: 'First Admin Setup' });
  }
  if (isAuthenticated && currentUser) {
    availableTabs.push({ id: 'account', label: 'My Account' });
  }
  if (usersConfigured) {
    availableTabs.push({
      id: 'signin',
      label: isAuthenticated ? 'Switch User' : 'Sign In',
    });
  }
  if (recoveryModeActive) {
    availableTabs.push({ id: 'recovery', label: 'Recovery' });
  }

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!signInName.trim() || !signInPin.trim()) {
      setErrorMsg('Please enter both your user name and PIN.');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithPin({
        name: signInName.trim(),
        pin: signInPin.trim(),
        deviceName: signInDeviceName.trim() || undefined,
      });
      setSignInPin('');
      closeAccountModal();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetupFirstAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!setupName.trim()) {
      setErrorMsg('Please enter an administrator name.');
      return;
    }
    if (setupPin.trim().length < 4) {
      setErrorMsg('Admin PIN must be at least 4 characters.');
      return;
    }
    if (setupPin.trim() !== setupPinConfirm.trim()) {
      setErrorMsg('PIN confirmation does not match.');
      return;
    }
    setSubmitting(true);
    try {
      await setupFirstAdmin({
        name: setupName.trim(),
        pin: setupPin.trim(),
        deviceName: setupDeviceName.trim() || undefined,
        requireLoginForEdits: setupRequireLogin,
      });
      setSetupPin('');
      setSetupPinConfirm('');
      closeAccountModal();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create initial administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!currentPinInput.trim() || !newPinInput.trim()) {
      setErrorMsg('Enter your current PIN and a new PIN.');
      return;
    }
    if (newPinInput.trim().length < 4) {
      setErrorMsg('New PIN must be at least 4 characters.');
      return;
    }
    if (newPinInput.trim() !== confirmNewPinInput.trim()) {
      setErrorMsg('New PIN confirmation does not match.');
      return;
    }
    setSubmitting(true);
    try {
      await changeOwnPin(currentPinInput.trim(), newPinInput.trim());
      setCurrentPinInput('');
      setNewPinInput('');
      setConfirmNewPinInput('');
      setSuccessMsg('Your PIN has been updated.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update PIN.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoveryLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await loginWithRecoveryPin(recoveryPinInput.trim());
      setRecoveryPinInput('');
      closeAccountModal();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Recovery unlock failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDeviceRename = async (deviceId: string) => {
    if (!editingDeviceName.trim()) return;
    setErrorMsg(null);
    try {
      await renameMyDevice(deviceId, editingDeviceName.trim());
      setEditingDeviceId(null);
      setSuccessMsg('Device label updated.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to rename device.');
    }
  };

  const handleLogout = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await logout();
      closeAccountModal();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-cool-gray-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl max-w-lg w-full shadow-2xl text-cool-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-cool-gray-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cool-gray-850 border border-cool-gray-750 flex items-center justify-center text-cyan-400">
              {accountModalTab === 'recovery' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              ) : isAdmin ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <KeyRound className="w-4 h-4 text-cyan-400" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {accountModalTab === 'setup-admin'
                  ? 'First-Time Admin Setup'
                  : accountModalTab === 'recovery'
                  ? 'Emergency Admin Recovery'
                  : accountModalTab === 'account' && currentUser
                  ? currentUser.name
                  : 'User Sign In'}
              </h3>
              <p className="text-[11px] text-cool-gray-400">
                {accountModalTab === 'setup-admin'
                  ? 'Create the first administrator account to lock down system settings'
                  : accountModalTab === 'recovery'
                  ? 'Temporary admin override for locked-out installations'
                  : accountModalTab === 'account' && currentUser
                  ? `${currentUser.role === 'admin' ? 'Administrator' : 'Standard User'} • Persistent Trusted Session`
                  : 'Enter your local Name and PIN to sign in'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAccountModal}
            className="text-cool-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-cool-gray-800 transition cursor-pointer"
            aria-label="Close account modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher */}
        {availableTabs.length > 1 && (
          <div className="px-5 pt-3 pb-2 border-b border-cool-gray-850 flex items-center gap-1.5 overflow-x-auto shrink-0">
            {availableTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setSuccessMsg(null);
                  setAccountModalTab(tab.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  accountModalTab === tab.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-cool-gray-850 text-cool-gray-300 hover:text-white border border-cool-gray-750'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs font-medium flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: FIRST ADMIN SETUP */}
          {accountModalTab === 'setup-admin' && (
            <form onSubmit={handleSetupFirstAdmin} className="space-y-4">
              <div className="p-3 rounded-lg bg-cool-gray-950 border border-cool-gray-800 text-xs text-cool-gray-300 space-y-1">
                <p className="font-semibold text-white">Local-Only Account Protection</p>
                <p className="text-[11px] text-cool-gray-400 leading-relaxed">
                  No cloud or Cloudflare account is required. Creating your first admin enables role protection for Import, Backups, PWA Devices, and Settings. You can add team users afterward.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5">
                  Administrator Name
                </label>
                <input
                  type="text"
                  value={setupName}
                  onChange={(e) => setSetupName(e.target.value)}
                  placeholder="e.g. Nick"
                  className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5">
                    PIN (4–16 chars)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={setupPin}
                    onChange={(e) => setSetupPin(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5">
                    Confirm PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={setupPinConfirm}
                    onChange={(e) => setSetupPinConfirm(e.target.value)}
                    placeholder="••••"
                    className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5">
                  This Device Label
                </label>
                <input
                  type="text"
                  value={setupDeviceName}
                  onChange={(e) => setSetupDeviceName(e.target.value)}
                  placeholder="e.g. Office Mac"
                  className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                />
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-lg bg-cool-gray-950 border border-cool-gray-800 cursor-pointer hover:border-cool-gray-700 transition">
                <input
                  type="checkbox"
                  checked={setupRequireLogin}
                  onChange={(e) => setSetupRequireLogin(e.target.checked)}
                  className="mt-0.5 rounded border-cool-gray-700 bg-cool-gray-900 accent-cyan-500"
                />
                <div className="text-xs leading-snug">
                  <div className="font-semibold text-white">Require user PIN sign-in to make inventory changes</div>
                  <p className="text-[11px] text-cool-gray-400 mt-0.5 leading-relaxed">
                    Recommended. Guests can browse read-only, while adding, moving, or adjusting inventory requires signing in with a user PIN. You can change this anytime in Users &amp; Devices.
                  </p>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-cool-gray-800">
                <button
                  type="button"
                  onClick={closeAccountModal}
                  className="px-3.5 py-2 text-xs text-cool-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Creating...' : 'Create Admin & Trust Device'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SIGN IN / SWITCH USER */}
          {accountModalTab === 'signin' && (
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              {status?.availableUsers && status.availableUsers.length > 0 && (
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1.5">
                    Select Account
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {status.availableUsers.map((u) => {
                      const selected = signInName.trim().toLowerCase() === u.name.trim().toLowerCase();
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => setSignInName(u.name)}
                          className={`px-3 py-2 rounded-lg border text-left transition cursor-pointer ${
                            selected
                              ? 'bg-cyan-950/60 border-cyan-500 text-white'
                              : 'bg-cool-gray-950 border-cool-gray-800 text-cool-gray-300 hover:border-cool-gray-700'
                          }`}
                        >
                          <div className="text-xs font-bold truncate">{u.name}</div>
                          <div className="text-[10px] text-cool-gray-500 mt-0.5">
                            Tap to select
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5">
                  User Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-cool-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={signInName}
                    onChange={(e) => setSignInName(e.target.value)}
                    placeholder="Enter user name"
                    className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5">
                  PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-cool-gray-500 absolute left-3 top-2.5" />
                  <input
                    type={showSignInPin ? 'text' : 'password'}
                    inputMode="numeric"
                    value={signInPin}
                    onChange={(e) => setSignInPin(e.target.value)}
                    placeholder="Enter PIN"
                    className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg pl-9 pr-9 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                    autoFocus
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPin(!showSignInPin)}
                    className="absolute right-2.5 top-2 text-cool-gray-400 hover:text-white p-0.5 cursor-pointer"
                    aria-label={showSignInPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showSignInPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5">
                  Device Label
                </label>
                <input
                  type="text"
                  value={signInDeviceName}
                  onChange={(e) => setSignInDeviceName(e.target.value)}
                  placeholder="e.g. Freezer Room iPad"
                  className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                />
                <span className="text-[10px] text-cool-gray-500 mt-1 block">
                  Signing in links this device to your user account until locked or revoked.
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-cool-gray-800">
                {recoveryModeActive ? (
                  <button
                    type="button"
                    onClick={() => setAccountModalTab('recovery')}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
                  >
                    Emergency Recovery Mode
                  </button>
                ) : (
                  <span className="text-[11px] text-cool-gray-500">Locked out? Check HA config or CLI recovery.</span>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: MY ACCOUNT & MY LINKED DEVICES */}
          {accountModalTab === 'account' && currentUser && (
            <div className="space-y-5">
              {/* Session Header */}
              <div className="p-3.5 rounded-xl bg-cool-gray-950 border border-cool-gray-800 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{currentUser.name}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      currentUser.role === 'admin'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
                        : 'bg-cool-gray-850 text-cool-gray-300 border-cool-gray-700'
                    }`}>
                      {currentUser.role === 'admin' ? 'Admin' : 'Standard User'}
                    </span>
                  </div>
                  <p className="text-[11px] text-cool-gray-400 mt-0.5">
                    This device stays unlocked until you lock it or revoke access.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border border-rose-800/60 flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Lock / Sign Out</span>
                </button>
              </div>

              {/* Change Own PIN */}
              <form onSubmit={handleChangePin} className="p-3.5 rounded-xl bg-cool-gray-950 border border-cool-gray-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Change My PIN</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Current PIN"
                    value={currentPinInput}
                    onChange={(e) => setCurrentPinInput(e.target.value)}
                    className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="New PIN"
                    value={newPinInput}
                    onChange={(e) => setNewPinInput(e.target.value)}
                    className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="Confirm New PIN"
                    value={confirmNewPinInput}
                    onChange={(e) => setConfirmNewPinInput(e.target.value)}
                    className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 border border-cool-gray-700 cursor-pointer disabled:opacity-50"
                  >
                    Update PIN
                  </button>
                </div>
              </form>

              {/* My Owned Devices */}
              <div className="p-3.5 rounded-xl bg-cool-gray-950 border border-cool-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>My Devices ({myDevices.length})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void refreshMyDevices()}
                    className="text-cool-gray-400 hover:text-white p-1 rounded cursor-pointer"
                    title="Refresh my devices"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingMyDevices ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {myDevices.length === 0 ? (
                  <p className="text-xs text-cool-gray-500 py-2">
                    No devices are currently linked to this account.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {myDevices.map((dev) => {
                      const isThisDevice = dev.id === currentDeviceId;
                      const isRevoked = dev.status === 'revoked';
                      const isEditing = editingDeviceId === dev.id;
                      return (
                        <div
                          key={dev.id}
                          className="p-2.5 rounded-lg bg-cool-gray-900 border border-cool-gray-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingDeviceName}
                                  onChange={(e) => setEditingDeviceName(e.target.value)}
                                  className="bg-cool-gray-950 border border-cyan-500 rounded px-2 py-1 text-xs text-white flex-1 outline-none"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleSaveDeviceRename(dev.id)}
                                  className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                                  title="Save label"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingDeviceId(null)}
                                  className="p-1 text-cool-gray-400 hover:text-white cursor-pointer"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-white truncate">
                                    {dev.name}
                                  </span>
                                  {isThisDevice && (
                                    <span className="text-[10px] font-semibold text-cyan-300">
                                      (This device)
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-semibold ${isRevoked ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {isRevoked ? 'Revoked' : dev.isOnline ? 'Online' : 'Trusted'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-cool-gray-500 truncate mt-0.5">
                                  {dev.clientInfo || dev.clientDevice || 'Browser'}
                                </div>
                              </>
                            )}
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDeviceId(dev.id);
                                  setEditingDeviceName(dev.name);
                                }}
                                className="p-1.5 rounded text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 cursor-pointer"
                                title="Rename device"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void (isRevoked ? authorizeMyDevice(dev.id) : revokeMyDevice(dev.id))}
                                className={`p-1.5 rounded cursor-pointer ${
                                  isRevoked
                                    ? 'text-emerald-400 hover:bg-emerald-950/60'
                                    : 'text-amber-400 hover:bg-amber-950/60'
                                }`}
                                title={isRevoked ? 'Restore access' : 'Revoke device session'}
                              >
                                {isRevoked ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteMyDevice(dev.id)}
                                className="p-1.5 rounded text-cool-gray-400 hover:text-rose-400 hover:bg-rose-950/60 cursor-pointer"
                                title="Remove device"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: EMERGENCY RECOVERY */}
          {accountModalTab === 'recovery' && recoveryModeActive && (
            <form onSubmit={handleRecoveryLogin} className="space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Emergency Lockout Recovery Active</span>
                </div>
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  Configured via {status?.recoverySource === 'ha_options' ? 'Home Assistant Add-on Options' : 'server environment variables'}. Sign in temporarily as Administrator to reset user PINs, then disable recovery mode in your config.
                </p>
              </div>

              {recoveryPinConfigured ? (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5">
                    Configured Recovery PIN
                  </label>
                  <input
                    type="password"
                    value={recoveryPinInput}
                    onChange={(e) => setRecoveryPinInput(e.target.value)}
                    placeholder="Enter admin_recovery_pin"
                    className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500 outline-none"
                    autoFocus
                    required
                  />
                </div>
              ) : (
                <p className="text-xs text-cool-gray-300">
                  No recovery PIN was set. Click below to unlock a temporary administrator recovery session.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-800">
                <button
                  type="button"
                  onClick={closeAccountModal}
                  className="px-3.5 py-2 text-xs text-cool-gray-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Unlocking...' : 'Unlock Admin Recovery Session'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
