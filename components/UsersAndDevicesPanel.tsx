import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightCircle,
  CheckCircle,
  Link2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Unlock,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AppUserRole, AppUserSummary, LegacyOperatorGroup } from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { authFetch } from '../utils/clientDevice';
import { useUserAuth } from '../hooks/useUserAuth';
import { AdminUsersManagerCard } from './AdminUsersManagerCard';
import { PwaDeviceManagerCard } from './PwaDeviceManagerCard';

interface UsersAndDevicesPanelProps {
  onDeviceUpdated?: () => void;
  hideInternalHeader?: boolean;
}

export const UsersAndDevicesPanel: React.FC<UsersAndDevicesPanelProps> = ({
  onDeviceUpdated,
  hideInternalHeader = false,
}) => {
  const {
    usersConfigured,
    isAdmin,
    requireLoginForEdits,
    updateAuthPolicy,
    refreshAuth,
  } = useUserAuth();

  const [users, setUsers] = useState<AppUserSummary[]>([]);
  const [legacyGroups, setLegacyGroups] = useState<LegacyOperatorGroup[]>([]);
  const [loadingLegacy, setLoadingLegacy] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [policySaving, setPolicySaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Per-group upgrade-to-PIN form state
  const [upgradingKey, setUpgradingKey] = useState<string | null>(null);
  const [upgradeName, setUpgradeName] = useState('');
  const [upgradeRole, setUpgradeRole] = useState<AppUserRole>('user');
  const [upgradePin, setUpgradePin] = useState('');
  const [submittingMigration, setSubmittingMigration] = useState<string | null>(null);

  // Selected target existing user for each legacy group's link dropdown
  const [linkTargets, setLinkTargets] = useState<Record<string, string>>({});

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    if (type === 'success') {
      setTimeout(() => setFeedback(null), 4500);
    }
  };

  const fetchLegacyGroups = useCallback(async () => {
    if (!usersConfigured || !isAdmin) {
      setLegacyGroups([]);
      return;
    }
    setLoadingLegacy(true);
    try {
      const res = await authFetch(getApiUrl('api/admin/legacy-users'));
      if (res.ok) {
        const data = await res.json();
        const groups: LegacyOperatorGroup[] = Array.isArray(data.groups) ? data.groups : [];
        setLegacyGroups(groups);
        setLinkTargets((prev) => {
          const next = { ...prev };
          for (const g of groups) {
            if (!next[g.operatorKey] && g.matchingUserId) {
              next[g.operatorKey] = g.matchingUserId;
            }
          }
          return next;
        });
      }
    } catch {
      // Preserve UI cleanly on transient fetch failure
    } finally {
      setLoadingLegacy(false);
    }
  }, [usersConfigured, isAdmin]);

  useEffect(() => {
    void fetchLegacyGroups();
  }, [fetchLegacyGroups, refreshTrigger]);

  const handleChildDataChanged = useCallback(() => {
    setRefreshTrigger((n) => n + 1);
    onDeviceUpdated?.();
  }, [onDeviceUpdated]);

  const handleToggleRequireLogin = async (nextVal: boolean) => {
    setPolicySaving(true);
    setFeedback(null);
    try {
      await updateAuthPolicy(nextVal);
      showNotice(
        'success',
        nextVal
          ? 'Protected Mode active: User PIN sign-in is now required to make inventory changes.'
          : 'Open Floor / Kiosk Mode active: Inventory edits are allowed without signing in (Admin settings stay PIN-protected).'
      );
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to update access policy.');
    } finally {
      setPolicySaving(false);
    }
  };

  const handleLinkLegacyGroup = async (group: LegacyOperatorGroup, targetUserId: string) => {
    if (!targetUserId) {
      showNotice('error', 'Select a target user account first.');
      return;
    }
    setSubmittingMigration(group.operatorKey);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/admin/legacy-users/migrate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'link',
          sourceOperatorKey: group.operatorKey,
          targetUserId,
          deviceIds: group.devices.map((d) => d.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to link legacy devices.');
      }
      showNotice(
        'success',
        `Linked ${data.migratedCount ?? group.deviceCount} device(s) to "${data.user?.name || 'account'}".`
      );
      setRefreshTrigger((n) => n + 1);
      await refreshAuth();
      onDeviceUpdated?.();
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to link legacy devices.');
    } finally {
      setSubmittingMigration(null);
    }
  };

  const handleUpgradeLegacyGroup = async (e: React.FormEvent, group: LegacyOperatorGroup) => {
    e.preventDefault();
    setSubmittingMigration(group.operatorKey);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/admin/legacy-users/migrate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'create',
          sourceOperatorKey: group.operatorKey,
          newName: upgradeName.trim(),
          role: upgradeRole,
          pin: upgradePin.trim(),
          deviceIds: group.devices.map((d) => d.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to upgrade legacy operator.');
      }
      setUpgradingKey(null);
      setUpgradeName('');
      setUpgradeRole('user');
      setUpgradePin('');
      showNotice(
        'success',
        `Upgraded "${data.user?.name}" to a PIN account and linked ${data.migratedCount ?? group.deviceCount} device(s).`
      );
      setRefreshTrigger((n) => n + 1);
      await refreshAuth();
      onDeviceUpdated?.();
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to upgrade legacy operator.');
    } finally {
      setSubmittingMigration(null);
    }
  };

  const totalLegacyDevices = legacyGroups.reduce((sum, g) => sum + g.deviceCount, 0);

  return (
    <div className={`space-y-6 ${hideInternalHeader ? '' : 'mt-4 '}max-w-4xl font-sans animate-fade-in`}>
      {!hideInternalHeader && (
        <div className="bg-cool-gray-850 p-3 sm:p-4 rounded-xl border border-cool-gray-750 shadow-sm">
          <h3 className="text-sm sm:text-base font-bold text-cool-gray-100 flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-cyan-400" />
            <span>Users &amp; Connected Devices</span>
          </h3>
          <p className="text-xs text-cool-gray-400 mt-0.5 font-medium">
            Configure sign-in policy for inventory changes, migrate legacy non-PIN operators into PIN accounts, and manage trusted devices.
          </p>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-200'
              : 'bg-rose-950/70 border border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100 cursor-pointer"
            aria-label="Dismiss feedback"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Access Policy Card */}
      <div className="bg-cool-gray-900 rounded-xl border border-cool-gray-750 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {requireLoginForEdits ? (
                <Lock className="w-4 h-4 text-emerald-400" />
              ) : (
                <Unlock className="w-4 h-4 text-amber-400" />
              )}
              <h4 className="text-sm font-bold text-white">Inventory Edit Access Policy</h4>
              {usersConfigured && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                    requireLoginForEdits
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                      : 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                  }`}
                >
                  {requireLoginForEdits ? 'PIN Required to Edit' : 'Open Floor Mode'}
                </span>
              )}
            </div>
            <p className="text-xs text-cool-gray-400 leading-relaxed">
              {!usersConfigured
                ? 'Once you create the first Administrator account below, user PIN sign-in will be required to make inventory changes by default (toggleable anytime here).'
                : requireLoginForEdits
                ? 'Unauthenticated browsers can view inventory read-only, while adding, moving, or adjusting quantities requires signing in with a user PIN. Admin tabs always require an Admin PIN.'
                : 'Anyone on this server can edit inventory without signing in. Admin tabs (Import, Users & Devices, Settings) always remain PIN-protected.'}
            </p>
          </div>

          {usersConfigured && isAdmin && (
            <label className="relative inline-flex items-center cursor-pointer shrink-0 self-start sm:self-center gap-2.5">
              <span className="text-xs font-semibold text-cool-gray-300">
                {policySaving ? 'Saving...' : requireLoginForEdits ? 'Required' : 'Optional'}
              </span>
              <input
                type="checkbox"
                checked={requireLoginForEdits}
                disabled={policySaving}
                onChange={(e) => void handleToggleRequireLogin(e.target.checked)}
                className="sr-only peer"
                aria-label="Require PIN sign-in to make inventory changes"
              />
              <div className="w-10 h-5 bg-cool-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:right-[22px] after:top-[2px] after:bg-white after:border-cool-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
            </label>
          )}
        </div>
      </div>

      {/* 2. Legacy Non-PIN Operator Migration */}
      {usersConfigured && isAdmin && legacyGroups.length > 0 && (
        <div className="bg-cool-gray-900 rounded-xl border border-amber-500/40 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-800">
            <div>
              <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <ArrowRightCircle className="w-4 h-4 text-amber-400" />
                <span>Migrate Legacy Non-PIN Users ({totalLegacyDevices} unlinked device{totalLegacyDevices === 1 ? '' : 's'})</span>
              </h4>
              <p className="text-xs text-cool-gray-400 mt-1">
                These devices were registered before PIN accounts were enabled. Upgrade named operators into PIN accounts or link devices to an existing account.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchLegacyGroups()}
              disabled={loadingLegacy}
              className="p-2 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-750 text-cool-gray-300 hover:text-white cursor-pointer self-start sm:self-auto"
              title="Refresh unlinked legacy devices"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLegacy ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-3">
            {legacyGroups.map((group) => {
              const isUpgrading = upgradingKey === group.operatorKey;
              const isBusy = submittingMigration === group.operatorKey;
              const selectedTarget = linkTargets[group.operatorKey] || '';

              return (
                <div
                  key={group.operatorKey}
                  className="p-3.5 rounded-xl bg-cool-gray-950 border border-cool-gray-800 space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {group.isUnassigned ? group.displayName : `@${group.displayName}`}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                          {group.deviceCount} legacy device{group.deviceCount === 1 ? '' : 's'}
                        </span>
                        {group.matchingUserName && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/60">
                            Matches account "{group.matchingUserName}"
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-cool-gray-400 mt-1 truncate">
                        Devices: {group.devices.map((d) => d.name).join(', ')}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {group.matchingUserId && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleLinkLegacyGroup(group, group.matchingUserId!)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          <span>Link All to @{group.matchingUserName}</span>
                        </button>
                      )}

                      {!group.isUnassigned && !group.matchingUserId && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            if (isUpgrading) {
                              setUpgradingKey(null);
                            } else {
                              setUpgradingKey(group.operatorKey);
                              setUpgradeName(group.displayName);
                              setUpgradeRole('user');
                              setUpgradePin('');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{isUpgrading ? 'Cancel Upgrade' : 'Upgrade to PIN Account'}</span>
                        </button>
                      )}

                      {users.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <select
                            value={selectedTarget}
                            onChange={(e) =>
                              setLinkTargets((prev) => ({
                                ...prev,
                                [group.operatorKey]: e.target.value,
                              }))
                            }
                            className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-cyan-500"
                            aria-label={`Select user account for ${group.displayName}`}
                          >
                            <option value="">Assign to account...</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.name} ({u.role === 'admin' ? 'Admin' : 'User'})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isBusy || !selectedTarget}
                            onClick={() => void handleLinkLegacyGroup(group, selectedTarget)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cyan-300 cursor-pointer disabled:opacity-40"
                          >
                            Link
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isUpgrading && (
                    <form
                      onSubmit={(e) => void handleUpgradeLegacyGroup(e, group)}
                      className="pt-3 border-t border-cool-gray-800 grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end"
                    >
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
                          Account Name
                        </label>
                        <input
                          type="text"
                          value={upgradeName}
                          onChange={(e) => setUpgradeName(e.target.value)}
                          className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
                          Role
                        </label>
                        <select
                          value={upgradeRole}
                          onChange={(e) => setUpgradeRole(e.target.value as AppUserRole)}
                          className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 outline-none"
                        >
                          <option value="user">Standard User</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
                          Initial PIN (4–16 chars)
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          value={upgradePin}
                          onChange={(e) => setUpgradePin(e.target.value)}
                          placeholder="••••"
                          className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                          autoFocus
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isBusy}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? 'Upgrading...' : 'Create PIN Account & Link'}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {usersConfigured && isAdmin && legacyGroups.length === 0 && !loadingLegacy && (
        <div className="px-4 py-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>All registered devices are linked to active PIN user accounts.</span>
        </div>
      )}

      {/* 3. User Accounts & Master Access Control */}
      <AdminUsersManagerCard refreshTrigger={refreshTrigger} onUsersChanged={setUsers} />

      {/* 4. Registered Devices */}
      <PwaDeviceManagerCard
        users={users}
        refreshTrigger={refreshTrigger}
        onDeviceUpdated={handleChildDataChanged}
      />
    </div>
  );
};
