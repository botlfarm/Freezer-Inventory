import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppUserSummary, AuthStatus, PwaDevice, UserSessionSummary } from '../types';
import {
  authFetch,
  clearSessionToken,
  FREEZER_USER_SESSION_KEY,
  getDeviceId,
  getSessionToken,
  setClientDeviceInfo,
  setSessionToken,
} from '../utils/clientDevice';
import { getApiUrl } from './apiUrl';

export type AccountModalTab = 'signin' | 'account' | 'setup-admin' | 'recovery';

interface UserAuthContextValue {
  status: AuthStatus | null;
  authLoaded: boolean;
  loading: boolean;
  usersConfigured: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  canAccessAdmin: boolean;
  requireLoginForEdits: boolean;
  isEditLockedByAuth: boolean;
  currentUser: AppUserSummary | null;
  recoveryModeActive: boolean;
  recoveryPinConfigured: boolean;
  myDevices: PwaDevice[];
  mySessions: UserSessionSummary[];
  loadingMyDevices: boolean;
  isAccountModalOpen: boolean;
  accountModalTab: AccountModalTab;
  openAccountModal: (tab?: AccountModalTab) => void;
  closeAccountModal: () => void;
  setAccountModalTab: (tab: AccountModalTab) => void;
  refreshAuth: () => Promise<AuthStatus | null>;
  refreshMyDevices: () => Promise<void>;
  setupFirstAdmin: (params: { name: string; pin: string; deviceName?: string; requireLoginForEdits?: boolean }) => Promise<{ user: AppUserSummary; sessionToken: string }>;
  loginWithPin: (params: { name: string; pin: string; deviceName?: string }) => Promise<{ user: AppUserSummary; sessionToken: string }>;
  loginWithRecoveryPin: (pin?: string) => Promise<{ sessionToken: string }>;
  logout: () => Promise<void>;
  changeOwnPin: (currentPin: string, newPin: string) => Promise<AppUserSummary>;
  updateAuthPolicy: (requireLoginForEdits: boolean) => Promise<boolean>;
  renameMyDevice: (deviceId: string, name: string, notes?: string) => Promise<void>;
  revokeMyDevice: (deviceId: string) => Promise<void>;
  authorizeMyDevice: (deviceId: string) => Promise<void>;
  deleteMyDevice: (deviceId: string) => Promise<void>;
}

const UserAuthContext = createContext<UserAuthContextValue | null>(null);

export const UserAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [myDevices, setMyDevices] = useState<PwaDevice[]>([]);
  const [mySessions, setMySessions] = useState<UserSessionSummary[]>([]);
  const [loadingMyDevices, setLoadingMyDevices] = useState<boolean>(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [accountModalTab, setAccountModalTab] = useState<AccountModalTab>('signin');

  // Monotonic epoch & in-flight deduplication prevent older /api/auth/status requests
  // (for example, from mount, window focus, or SSE auth_changed) from overwriting a
  // newly completed login or wiping a valid session token.
  const authEpochRef = useRef<number>(0);
  const inFlightRefreshRef = useRef<{ epoch: number; promise: Promise<AuthStatus | null> } | null>(null);

  const notifyAuthChanged = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('freezer-auth-changed'));
    }
  };

  const refreshMyDevices = useCallback(async () => {
    setLoadingMyDevices(true);
    try {
      const res = await authFetch(getApiUrl('api/account/devices'), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMyDevices(Array.isArray(data.devices) ? data.devices : []);
        setMySessions(Array.isArray(data.sessions) ? data.sessions : []);
      } else {
        setMyDevices([]);
        setMySessions([]);
      }
    } catch {
      // Keep existing state on transient offline failures
    } finally {
      setLoadingMyDevices(false);
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<AuthStatus | null> => {
    const active = inFlightRefreshRef.current;
    if (active && active.epoch === authEpochRef.current) {
      return active.promise;
    }

    const requestEpoch = authEpochRef.current;
    const tokenUsed = getSessionToken();

    const run = (async (): Promise<AuthStatus | null> => {
      try {
        const res = await authFetch(getApiUrl('api/auth/status'), {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });
        if (!res.ok) {
          if (requestEpoch === authEpochRef.current) {
            setLoading(false);
          }
          return null;
        }
        const data: AuthStatus = await res.json();

        // Ignore stale response if a login/setup/logout/token update happened while in flight
        if (requestEpoch !== authEpochRef.current) {
          return null;
        }

        // Only clear the locally cached token if the server explicitly rejected that exact token
        if (!data.isAuthenticated && tokenUsed && tokenUsed === getSessionToken()) {
          clearSessionToken();
        }

        if (data.isAuthenticated && data.currentUser?.name) {
          setClientDeviceInfo({ operatorName: data.currentUser.name, markPrompted: true });
        }
        setStatus(data);
        setLoading(false);
        if (data.isAuthenticated && data.currentUser) {
          void refreshMyDevices();
        } else {
          setMyDevices([]);
          setMySessions([]);
        }
        return data;
      } catch {
        if (requestEpoch === authEpochRef.current) {
          setLoading(false);
        }
        return null;
      } finally {
        if (inFlightRefreshRef.current?.promise === run) {
          inFlightRefreshRef.current = null;
        }
      }
    })();

    inFlightRefreshRef.current = { epoch: requestEpoch, promise: run };
    return run;
  }, [refreshMyDevices]);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleAuthEvent = () => {
      void refreshAuth();
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FREEZER_USER_SESSION_KEY) {
        if (!e.newValue) {
          clearSessionToken();
        } else {
          setSessionToken(e.newValue);
        }
        authEpochRef.current += 1;
        inFlightRefreshRef.current = null;
        void refreshAuth();
      } else if (e.key === null) {
        clearSessionToken();
        authEpochRef.current += 1;
        inFlightRefreshRef.current = null;
        void refreshAuth();
      }
    };
    const handleFocus = () => {
      void refreshAuth();
    };
    window.addEventListener('freezer-auth-changed', handleAuthEvent);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('freezer-auth-changed', handleAuthEvent);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refreshAuth]);

  const openAccountModal = useCallback((preferredTab?: AccountModalTab) => {
    if (preferredTab) {
      setAccountModalTab(preferredTab);
    } else if (status?.recoveryModeActive && !status?.isAdmin) {
      setAccountModalTab('recovery');
    } else if (status?.isAuthenticated && status?.currentUser) {
      setAccountModalTab('account');
    } else if (status && !status.usersConfigured) {
      setAccountModalTab('setup-admin');
    } else {
      setAccountModalTab('signin');
    }
    setIsAccountModalOpen(true);
  }, [status]);

  const closeAccountModal = useCallback(() => {
    setIsAccountModalOpen(false);
  }, []);

  const setupFirstAdmin = useCallback(async ({ name, pin, deviceName, requireLoginForEdits }: { name: string; pin: string; deviceName?: string; requireLoginForEdits?: boolean }) => {
    const res = await authFetch(getApiUrl('api/auth/setup-first-admin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        pin,
        deviceId: getDeviceId(),
        deviceName,
        requireLoginForEdits,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to set up first admin user.');
    }
    authEpochRef.current += 1;
    inFlightRefreshRef.current = null;
    if (data.sessionToken) {
      setSessionToken(data.sessionToken);
    }
    if (data.user?.name) {
      setClientDeviceInfo({
        operatorName: data.user.name,
        deviceName: deviceName?.trim() || undefined,
        markPrompted: true,
      });
    }
    if (data.user) {
      setStatus((prev) => ({
        usersConfigured: true,
        isAuthenticated: true,
        isAdmin: data.user.role === 'admin',
        requireLoginForEdits: data.requireLoginForEdits ?? prev?.requireLoginForEdits ?? true,
        currentUser: data.user,
        currentSessionId: data.session?.id || prev?.currentSessionId || null,
        currentDeviceId: getDeviceId(),
        recoveryModeActive: prev?.recoveryModeActive ?? false,
        recoveryPinConfigured: prev?.recoveryPinConfigured ?? false,
        recoverySource: prev?.recoverySource ?? 'none',
        availableUsers: prev?.availableUsers || [data.user],
      }));
      setLoading(false);
    }
    notifyAuthChanged();
    await refreshAuth();
    return { user: data.user, sessionToken: data.sessionToken };
  }, [refreshAuth]);

  const loginWithPin = useCallback(async ({ name, pin, deviceName }: { name: string; pin: string; deviceName?: string }) => {
    const res = await authFetch(getApiUrl('api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        pin,
        deviceId: getDeviceId(),
        deviceName,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.message || data.error || 'Invalid credentials.');
      err.code = data.error;
      err.retryAfterSeconds = data.retryAfterSeconds;
      err.remainingAttempts = data.remainingAttempts;
      throw err;
    }
    authEpochRef.current += 1;
    inFlightRefreshRef.current = null;
    if (data.sessionToken) {
      setSessionToken(data.sessionToken);
    }
    if (data.user?.name) {
      setClientDeviceInfo({
        operatorName: data.user.name,
        deviceName: deviceName?.trim() || undefined,
        markPrompted: true,
      });
    }
    if (data.user) {
      setStatus((prev) => ({
        usersConfigured: true,
        isAuthenticated: true,
        isAdmin: data.user.role === 'admin',
        requireLoginForEdits: prev?.requireLoginForEdits ?? true,
        currentUser: data.user,
        currentSessionId: data.session?.id || prev?.currentSessionId || null,
        currentDeviceId: getDeviceId(),
        recoveryModeActive: prev?.recoveryModeActive ?? false,
        recoveryPinConfigured: prev?.recoveryPinConfigured ?? false,
        recoverySource: prev?.recoverySource ?? 'none',
        availableUsers: prev?.availableUsers || [],
      }));
      setLoading(false);
    }
    notifyAuthChanged();
    await refreshAuth();
    return { user: data.user, sessionToken: data.sessionToken };
  }, [refreshAuth]);

  const loginWithRecoveryPin = useCallback(async (pin?: string) => {
    const res = await authFetch(getApiUrl('api/auth/recovery-login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin || '' }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.message || data.error || 'Recovery sign-in failed.');
      err.code = data.error;
      err.retryAfterSeconds = data.retryAfterSeconds;
      throw err;
    }
    authEpochRef.current += 1;
    inFlightRefreshRef.current = null;
    if (data.sessionToken) {
      setSessionToken(data.sessionToken);
    }
    setStatus((prev) => ({
      usersConfigured: prev?.usersConfigured ?? true,
      isAuthenticated: true,
      isAdmin: true,
      requireLoginForEdits: prev?.requireLoginForEdits ?? true,
      currentUser: {
        id: '__recovery_admin__',
        name: 'Recovery Admin',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      currentSessionId: '__recovery_session__',
      currentDeviceId: getDeviceId(),
      recoveryModeActive: true,
      recoveryPinConfigured: prev?.recoveryPinConfigured ?? false,
      recoverySource: data.recoverySource || prev?.recoverySource || 'env',
      availableUsers: prev?.availableUsers || [],
    }));
    setLoading(false);
    notifyAuthChanged();
    await refreshAuth();
    return { sessionToken: data.sessionToken };
  }, [refreshAuth]);

  const logout = useCallback(async () => {
    authEpochRef.current += 1;
    inFlightRefreshRef.current = null;
    try {
      await authFetch(getApiUrl('api/auth/logout'), { method: 'POST' });
    } catch {
      // Proceed cleanly even if offline
    }
    clearSessionToken();
    setMyDevices([]);
    setMySessions([]);
    setStatus((prev) =>
      prev
        ? {
            ...prev,
            isAuthenticated: false,
            isAdmin: !prev.usersConfigured,
            currentUser: null,
            currentSessionId: null,
          }
        : null
    );
    notifyAuthChanged();
    await refreshAuth();
  }, [refreshAuth]);

  const changeOwnPin = useCallback(async (currentPin: string, newPin: string): Promise<AppUserSummary> => {
    const res = await authFetch(getApiUrl('api/account/change-pin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data.message || data.error || 'Failed to update PIN.');
      err.code = data.error;
      err.retryAfterSeconds = data.retryAfterSeconds;
      throw err;
    }
    await refreshAuth();
    return data.user;
  }, [refreshAuth]);

  const updateAuthPolicy = useCallback(async (requireLoginForEdits: boolean): Promise<boolean> => {
    const res = await authFetch(getApiUrl('api/admin/auth-policy'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requireLoginForEdits }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to update access policy.');
    }
    authEpochRef.current += 1;
    inFlightRefreshRef.current = null;
    setStatus((prev) => (prev ? { ...prev, requireLoginForEdits: Boolean(data.requireLoginForEdits) } : prev));
    notifyAuthChanged();
    await refreshAuth();
    return Boolean(data.requireLoginForEdits);
  }, [refreshAuth]);

  const renameMyDevice = useCallback(async (deviceId: string, name: string, notes?: string) => {
    const res = await authFetch(getApiUrl(`api/account/devices/${encodeURIComponent(deviceId)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, notes }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to update device.');
    }
    if (deviceId === getDeviceId() && name.trim()) {
      setClientDeviceInfo({ deviceName: name.trim() });
    }
    await refreshMyDevices();
  }, [refreshMyDevices]);

  const revokeMyDevice = useCallback(async (deviceId: string) => {
    const res = await authFetch(getApiUrl(`api/account/devices/${encodeURIComponent(deviceId)}/revoke`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to revoke device.');
    }
    if (deviceId === getDeviceId()) {
      clearSessionToken();
      notifyAuthChanged();
      await refreshAuth();
    } else {
      await refreshMyDevices();
    }
  }, [refreshAuth, refreshMyDevices]);

  const authorizeMyDevice = useCallback(async (deviceId: string) => {
    const res = await authFetch(getApiUrl(`api/account/devices/${encodeURIComponent(deviceId)}/authorize`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to authorize device.');
    }
    await refreshMyDevices();
  }, [refreshMyDevices]);

  const deleteMyDevice = useCallback(async (deviceId: string) => {
    const res = await authFetch(getApiUrl(`api/account/devices/${encodeURIComponent(deviceId)}`), {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Failed to delete device.');
    }
    if (deviceId === getDeviceId()) {
      clearSessionToken();
      notifyAuthChanged();
      await refreshAuth();
    } else {
      await refreshMyDevices();
    }
  }, [refreshAuth, refreshMyDevices]);

  const usersConfigured = Boolean(status?.usersConfigured);
  const isAuthenticated = Boolean(status?.isAuthenticated);
  const isAdmin = Boolean(status?.isAdmin);
  const canAccessAdmin = Boolean(status && (!status.usersConfigured || status.isAdmin));
  const requireLoginForEdits = Boolean(status?.requireLoginForEdits);
  const isEditLockedByAuth = Boolean(usersConfigured && requireLoginForEdits && !isAuthenticated);

  const value: UserAuthContextValue = {
    status,
    authLoaded: status !== null,
    loading,
    usersConfigured,
    isAuthenticated,
    isAdmin,
    canAccessAdmin,
    requireLoginForEdits,
    isEditLockedByAuth,
    currentUser: status?.currentUser || null,
    recoveryModeActive: Boolean(status?.recoveryModeActive),
    recoveryPinConfigured: Boolean(status?.recoveryPinConfigured),
    myDevices,
    mySessions,
    loadingMyDevices,
    isAccountModalOpen,
    accountModalTab,
    openAccountModal,
    closeAccountModal,
    setAccountModalTab,
    refreshAuth,
    refreshMyDevices,
    setupFirstAdmin,
    loginWithPin,
    loginWithRecoveryPin,
    logout,
    changeOwnPin,
    updateAuthPolicy,
    renameMyDevice,
    revokeMyDevice,
    authorizeMyDevice,
    deleteMyDevice,
  };

  return <UserAuthContext.Provider value={value}>{children}</UserAuthContext.Provider>;
};

export function useUserAuth(): UserAuthContextValue {
  const ctx = useContext(UserAuthContext);
  if (!ctx) {
    throw new Error('useUserAuth must be used within a UserAuthProvider');
  }
  return ctx;
}
