import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Edit2,
  KeyRound,
  RefreshCw,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AppUserRole, AppUserSummary, UserSessionSummary } from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { authFetch } from '../utils/clientDevice';
import { useUserAuth } from '../hooks/useUserAuth';

interface AdminUsersManagerCardProps {
  refreshTrigger?: number;
  onUsersChanged?: (users: AppUserSummary[]) => void;
}

export const AdminUsersManagerCard: React.FC<AdminUsersManagerCardProps> = ({
  refreshTrigger = 0,
  onUsersChanged,
}) => {
  const { currentUser, refreshAuth, usersConfigured, openAccountModal } = useUserAuth();
  const [users, setUsers] = useState<AppUserSummary[]>([]);
  const [sessions, setSessions] = useState<UserSessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const onUsersChangedRef = React.useRef(onUsersChanged);
  onUsersChangedRef.current = onUsersChanged;

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AppUserRole>('user');
  const [newPin, setNewPin] = useState('');
  const [savingCreate, setSavingCreate] = useState(false);

  // Inline Edit User
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<AppUserRole>('user');
  const [editActive, setEditActive] = useState(true);

  // Reset PIN modal
  const [resetTarget, setResetTarget] = useState<AppUserSummary | null>(null);
  const [resetPinValue, setResetPinValue] = useState('');
  const [resetRevokeSessions, setResetRevokeSessions] = useState(true);

  // Delete User confirm
  const [deleteTarget, setDeleteTarget] = useState<AppUserSummary | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, sRes] = await Promise.all([
        authFetch(getApiUrl('api/admin/users')),
        authFetch(getApiUrl('api/admin/sessions')),
      ]);
      if (uRes.ok) {
        const uData = await uRes.json();
        const nextUsers = Array.isArray(uData.users) ? uData.users : [];
        setUsers(nextUsers);
        onUsersChangedRef.current?.(nextUsers);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        setSessions(Array.isArray(sData.sessions) ? sData.sessions : []);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to load user directory.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (usersConfigured) {
      void loadData();
    } else {
      setUsers([]);
      setSessions([]);
      onUsersChangedRef.current?.([]);
    }
  }, [usersConfigured, loadData, refreshTrigger]);

  const showNotice = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    if (type === 'success') {
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCreate(true);
    try {
      const res = await authFetch(getApiUrl('api/admin/users'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), role: newRole, pin: newPin.trim(), isActive: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to create user.');
      setNewName('');
      setNewRole('user');
      setNewPin('');
      setShowCreateForm(false);
      showNotice('success', `User "${data.user.name}" created.`);
      await loadData();
      await refreshAuth();
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to create user.');
    } finally {
      setSavingCreate(false);
    }
  };

  const handleSaveEditUser = async (userId: string) => {
    try {
      const res = await authFetch(getApiUrl(`api/admin/users/${encodeURIComponent(userId)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), role: editRole, isActive: editActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to update user.');
      setEditingUserId(null);
      showNotice('success', `Updated "${data.user.name}".`);
      await loadData();
      await refreshAuth();
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to update user.');
    }
  };

  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    try {
      const res = await authFetch(getApiUrl(`api/admin/users/${encodeURIComponent(resetTarget.id)}/reset-pin`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: resetPinValue.trim(), revokeSessions: resetRevokeSessions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to reset PIN.');
      const targetName = resetTarget.name;
      setResetTarget(null);
      setResetPinValue('');
      showNotice('success', `PIN reset for "${targetName}".`);
      await loadData();
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to reset PIN.');
    }
  };

  const handleRevokeUserSessions = async (user: AppUserSummary) => {
    try {
      const res = await authFetch(getApiUrl(`api/admin/users/${encodeURIComponent(user.id)}/revoke-sessions`), {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to revoke sessions.');
      showNotice('success', `Revoked ${data.revokedCount ?? 0} active session(s) for "${user.name}".`);
      await loadData();
      await refreshAuth();
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to revoke sessions.');
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      const res = await authFetch(getApiUrl(`api/admin/users/${encodeURIComponent(deleteTarget.id)}`), {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to delete user.');
      const deletedName = deleteTarget.name;
      setDeleteTarget(null);
      showNotice('success', `Deleted user "${deletedName}".`);
      await loadData();
      await refreshAuth();
    } catch (err: any) {
      setDeleteTarget(null);
      showNotice('error', err?.message || 'Failed to delete user.');
    }
  };

  const handleRevokeSingleSession = async (sessionId: string) => {
    try {
      const res = await authFetch(getApiUrl(`api/admin/sessions/${encodeURIComponent(sessionId)}/revoke`), {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to revoke session.');
      showNotice('success', 'Session revoked.');
      await loadData();
    } catch (err: any) {
      showNotice('error', err?.message || 'Failed to revoke session.');
    }
  };

  if (!usersConfigured) {
    return (
      <div className="bg-cool-gray-900 rounded-xl border border-cool-gray-750 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>User Accounts & Admin Access Control</span>
            </h3>
            <p className="text-xs text-cool-gray-400 mt-1">
              No users are configured yet. Create your first Administrator PIN to restrict Import, Backups, Users &amp; Devices, and Settings to admins only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAccountModal('setup-admin')}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Set Up First Admin</span>
          </button>
        </div>
      </div>
    );
  }

  const adminCount = users.filter((u) => u.role === 'admin' && u.isActive).length;

  return (
    <div className="bg-cool-gray-900 rounded-xl border border-cool-gray-750 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cool-gray-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>User Accounts & Master Access Control</span>
          </h3>
          <p className="text-xs text-cool-gray-400 mt-1">
            Create named local accounts with individual PINs, manage admin roles, and revoke active sessions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => void loadData()}
            className="p-2 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-750 text-cool-gray-300 hover:text-white cursor-pointer"
            title="Refresh users and sessions"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between gap-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-200'
            : 'bg-rose-950/70 border border-rose-800 text-rose-200'
        }`}>
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-current opacity-70 hover:opacity-100 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-2.5 text-xs">
        <div className="p-3 rounded-lg bg-cool-gray-950 border border-cool-gray-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400">Total Users</div>
          <div className="text-base font-bold text-white tabular-nums mt-0.5">{users.length}</div>
        </div>
        <div className="p-3 rounded-lg bg-cool-gray-950 border border-cool-gray-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400">Active Admins</div>
          <div className="text-base font-bold text-emerald-400 tabular-nums mt-0.5">{adminCount}</div>
        </div>
        <div className="p-3 rounded-lg bg-cool-gray-950 border border-cool-gray-800">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400">Live Sessions</div>
          <div className="text-base font-bold text-cyan-400 tabular-nums mt-0.5">{sessions.length}</div>
        </div>
      </div>

      {/* Create User Inline Form */}
      {showCreateForm && (
        <form onSubmit={handleCreateUser} className="p-4 rounded-xl bg-cool-gray-950 border border-cyan-800/50 space-y-3">
          <div className="text-xs font-bold text-white">New Local User</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Sarah"
                className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
                Role
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AppUserRole)}
                className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-1.5 text-xs text-white focus:border-cyan-500 outline-none"
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
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="••••"
                className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-1.5 text-xs text-cool-gray-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCreate}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer disabled:opacity-50"
            >
              {savingCreate ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      {/* User Directory */}
      <div className="space-y-2">
        {users.map((u) => {
          const isEditing = editingUserId === u.id;
          const isSelf = currentUser?.id === u.id;
          return (
            <div
              key={u.id}
              className="p-3.5 rounded-xl bg-cool-gray-950 border border-cool-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {isEditing ? (
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="bg-cool-gray-900 border border-cyan-500 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  />
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as AppUserRole)}
                    className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-cool-gray-200 px-2">
                    <input
                      type="checkbox"
                      checked={editActive}
                      onChange={(e) => setEditActive(e.target.checked)}
                      className="rounded border-cool-gray-700 bg-cool-gray-900"
                    />
                    <span>Active</span>
                  </label>
                </div>
              ) : (
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-white">{u.name}</span>
                    {isSelf && (
                      <span className="text-[10px] font-semibold text-cyan-400">(You)</span>
                    )}
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      u.role === 'admin'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                        : 'bg-cool-gray-900 text-cool-gray-300 border-cool-gray-750'
                    }`}>
                      {u.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                    {!u.isActive && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/60">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-cool-gray-400 mt-1 tabular-nums">
                    {u.deviceCount} device(s) • {u.activeSessionCount} active session(s)
                    {u.lastLoginAt ? ` • Last login ${new Date(u.lastLoginAt).toLocaleDateString()}` : ''}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                {isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleSaveEditUser(u.id)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingUserId(null)}
                      className="px-2.5 py-1.5 rounded-lg text-xs text-cool-gray-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingUserId(u.id);
                        setEditName(u.name);
                        setEditRole(u.role);
                        setEditActive(u.isActive);
                      }}
                      className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-800 text-cool-gray-300 hover:text-white cursor-pointer"
                      title="Edit name, role, or status"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResetTarget(u);
                        setResetPinValue('');
                        setResetRevokeSessions(true);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-800 text-cool-gray-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      title="Reset PIN"
                    >
                      <KeyRound className="w-3 h-3 text-cyan-400" />
                      <span>Reset PIN</span>
                    </button>
                    {u.activeSessionCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void handleRevokeUserSessions(u)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/50 text-amber-300 text-xs font-semibold cursor-pointer"
                        title="Sign out all active sessions for this user"
                      >
                        Revoke Sessions
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(u)}
                      className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-rose-950/60 border border-cool-gray-800 hover:border-rose-800/60 text-cool-gray-400 hover:text-rose-300 cursor-pointer"
                      title="Delete user"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Sessions Drawer */}
      <div className="pt-2 border-t border-cool-gray-800">
        <button
          type="button"
          onClick={() => setShowSessions(!showSessions)}
          className="text-xs font-semibold text-cool-gray-300 hover:text-white cursor-pointer"
        >
          {showSessions ? 'Hide' : 'Show'} Active Signed-In Sessions ({sessions.length})
        </button>

        {showSessions && (
          <div className="mt-3 space-y-1.5 max-h-52 overflow-y-auto">
            {sessions.length === 0 ? (
              <p className="text-xs text-cool-gray-500">No active sessions.</p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className="p-2.5 rounded-lg bg-cool-gray-950 border border-cool-gray-800 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">
                      {s.userName || s.userId} • {s.deviceName || 'Unnamed Device'}
                      {s.isCurrent && <span className="text-cyan-400 ml-1.5">(Current)</span>}
                    </div>
                    <div className="text-[10px] text-cool-gray-500 tabular-nums">
                      Last seen {new Date(s.lastSeenAt).toLocaleString()} {s.ip ? `• ${s.ip}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRevokeSingleSession(s.id)}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/60 shrink-0 cursor-pointer"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Reset PIN Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 bg-cool-gray-950/80 flex items-center justify-center p-4">
          <form onSubmit={handleResetPinSubmit} className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white">Reset PIN for {resetTarget.name}</h4>
              <button type="button" onClick={() => setResetTarget(null)} className="text-cool-gray-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
                New PIN (4–16 chars)
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={resetPinValue}
                onChange={(e) => setResetPinValue(e.target.value)}
                className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-cyan-500"
                autoFocus
                required
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-cool-gray-300">
              <input
                type="checkbox"
                checked={resetRevokeSessions}
                onChange={(e) => setResetRevokeSessions(e.target.checked)}
              />
              <span>Sign out existing sessions for this user</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setResetTarget(null)} className="px-3 py-1.5 text-xs text-cool-gray-400 hover:text-white cursor-pointer">
                Cancel
              </button>
              <button type="submit" className="px-4 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer">
                Save New PIN
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete User Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-cool-gray-950/80 flex items-center justify-center p-4">
          <div className="bg-cool-gray-900 border border-rose-900/60 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
              <h4 className="text-sm font-bold text-white">Delete User "{deleteTarget.name}"?</h4>
            </div>
            <p className="text-xs text-cool-gray-300 leading-relaxed">
              This removes the user account and revokes any active sessions. Historical audit logs remain intact.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 text-xs text-cool-gray-400 hover:text-white cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteUser()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
