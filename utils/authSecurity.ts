// Authentication and Cloudflare security token management utility
import { getDeviceId, getDeviceName, getOperatorName, setClientDeviceInfo, FREEZER_DEVICE_ID_KEY, FREEZER_DEVICE_NAME_KEY, FREEZER_OPERATOR_NAME_KEY } from './clientDevice';
import { getApiUrl } from '../hooks/apiUrl';

export const FREEZER_DEVICE_BACKUP_KEY = 'freezer_device_identity_backup_v1';
export const CF_ACCESS_CLIENT_ID_KEY = 'freezer_cf_access_client_id';
export const CF_ACCESS_CLIENT_SECRET_KEY = 'freezer_cf_access_client_secret';
export const CF_TOKEN_REFRESH_ENABLED_KEY = 'cf_token_refresh_enabled';

export interface DeviceIdentityBackup {
  deviceId: string;
  deviceName: string;
  operatorName: string;
  timestamp: number;
}

export interface AuthProbeResult {
  isBlocked: boolean;
  isCloudflareBlocked: boolean;
  status: number;
  statusText: string;
  isHtmlRedirect: boolean;
  message: string;
}

/**
 * Backs up current device identity into redundant storage locations (localStorage & sessionStorage)
 * so that any cache purge, reload, or token refresh guarantees that device identity is never lost.
 */
export function preserveDeviceIdentity(): DeviceIdentityBackup {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const operatorName = getOperatorName();

  const backup: DeviceIdentityBackup = {
    deviceId,
    deviceName,
    operatorName,
    timestamp: Date.now()
  };

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(FREEZER_DEVICE_BACKUP_KEY, JSON.stringify(backup));
    } catch (e) {}
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(FREEZER_DEVICE_BACKUP_KEY, JSON.stringify(backup));
    } catch (e) {}
  }

  return backup;
}

/**
 * Restores device identity from backup if primary localStorage keys were somehow cleared.
 */
export function restoreDeviceIdentityIfLost(): boolean {
  if (typeof localStorage === 'undefined') return false;

  const currentId = localStorage.getItem(FREEZER_DEVICE_ID_KEY);
  if (currentId && currentId.trim()) {
    // Identity is intact
    return false;
  }

  let rawBackup = localStorage.getItem(FREEZER_DEVICE_BACKUP_KEY);
  if (!rawBackup && typeof sessionStorage !== 'undefined') {
    rawBackup = sessionStorage.getItem(FREEZER_DEVICE_BACKUP_KEY);
  }

  if (rawBackup) {
    try {
      const backup: DeviceIdentityBackup = JSON.parse(rawBackup);
      if (backup.deviceId) {
        localStorage.setItem(FREEZER_DEVICE_ID_KEY, backup.deviceId);
        if (backup.deviceName) {
          localStorage.setItem(FREEZER_DEVICE_NAME_KEY, backup.deviceName);
        }
        if (backup.operatorName) {
          localStorage.setItem(FREEZER_OPERATOR_NAME_KEY, backup.operatorName);
          localStorage.setItem('freezerUserName', backup.operatorName);
          localStorage.setItem('freezer_user', backup.operatorName);
        }
        return true;
      }
    } catch (e) {}
  }

  return false;
}

/**
 * Safely clears HTTP Service Worker asset caches without touching IndexedDB or localStorage,
 * ensuring the Service Worker cannot intercept and serve stale offline HTML shells when re-authenticating.
 */
export async function clearAssetCachesOnly(): Promise<void> {
  // 1. Send command to active service worker to purge HTTP asset caches
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({ type: 'FORCE_PURGE_CACHE' });
    } catch (e) {}
  }

  // 2. Clear browser CacheStorage directly from the window context
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      for (const key of keys) {
        // Preserve offline uploaded user photos while clearing web app shell caches
        if (key !== 'freezer-tracker-images') {
          await window.caches.delete(key).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Failed to delete asset cache:', e);
    }
  }
}

/**
 * Executes a safe security token refresh:
 * 1. Backs up device identity (Device ID, Device Name, Operator Name).
 * 2. Purges HTTP asset caches so the Service Worker does not hijack navigation.
 * 3. Appends `cf_token_refresh` query parameter which instructs `sw.js` to bypass navigation interception.
 * 4. Navigates the window directly through the network so Cloudflare Access intercepts and prompts for login.
 */
export async function executeSecurityTokenRefresh(options?: { customPath?: string }): Promise<void> {
  if (typeof window === 'undefined') return;

  // Step 1: Ensure device identity is secured
  preserveDeviceIdentity();

  // Step 2: Purge browser HTTP caches (preserving IndexedDB & localStorage)
  await clearAssetCachesOnly();

  // Step 3: Compute target URL
  let targetUrl: URL;
  if (options?.customPath) {
    targetUrl = new URL(options.customPath, window.location.href);
  } else {
    targetUrl = new URL(window.location.href);
  }

  targetUrl.searchParams.set('cf_token_refresh', Date.now().toString());

  // Step 4: Full top-level navigation to trigger Cloudflare Access authentication
  window.location.href = targetUrl.toString();
}

/**
 * Tests connection to the server to diagnose whether Cloudflare or network is blocking API requests.
 */
export async function probeAuthStatus(customProbeUrl?: string): Promise<AuthProbeResult> {
  if (typeof fetch === 'undefined') {
    return {
      isBlocked: false,
      isCloudflareBlocked: false,
      status: 200,
      statusText: 'OK',
      isHtmlRedirect: false,
      message: 'Offline test environment'
    };
  }

  const endpoint = customProbeUrl || getApiUrl(`api/version?_cf_probe=${Date.now()}`);

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      },
      signal: AbortSignal.timeout(6000)
    });

    const contentType = (typeof res.headers?.get === 'function' ? res.headers.get('content-type') : '') || '';
    const isHtml = contentType.toLowerCase().includes('text/html');
    const hasCfRay = typeof res.headers?.has === 'function' ? (res.headers.has('cf-ray') || res.headers.has('cf-mitigated')) : false;
    const isCloudflare = hasCfRay || isHtml;

    if (res.status === 401 || res.status === 403 || isHtml) {
      return {
        isBlocked: true,
        isCloudflareBlocked: true,
        status: res.status,
        statusText: res.statusText || 'Unauthorized',
        isHtmlRedirect: isHtml,
        message: isHtml
          ? 'Cloudflare returned a login page instead of API JSON. Your security token has expired.'
          : `Server returned HTTP ${res.status} Unauthorized. Re-authentication required.`
      };
    }

    if (res.ok) {
      return {
        isBlocked: false,
        isCloudflareBlocked: false,
        status: res.status,
        statusText: res.statusText || 'OK',
        isHtmlRedirect: false,
        message: 'Security token is valid and active. Connection to server is healthy.'
      };
    }

    return {
      isBlocked: true,
      isCloudflareBlocked: isCloudflare,
      status: res.status,
      statusText: res.statusText,
      isHtmlRedirect: isHtml,
      message: `Server returned status ${res.status}: ${res.statusText}`
    };
  } catch (err: any) {
    const errMsg = (err.message || '').toLowerCase();
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

    return {
      isBlocked: true,
      isCloudflareBlocked: true,
      status: 0,
      statusText: err.name || 'NetworkError',
      isHtmlRedirect: false,
      message: isOffline
        ? 'Device is currently offline with no network connection.'
        : `Network connection failed: ${err.message || 'Server unreachable'}. Could be an expired Cloudflare session.`
    };
  }
}

/**
 * Removes `cf_token_refresh` query parameters from the browser address bar after re-authentication.
 */
export function cleanTokenRefreshUrlParams(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('cf_token_refresh') || url.searchParams.has('cf_auth_success')) {
      url.searchParams.delete('cf_token_refresh');
      url.searchParams.delete('cf_auth_success');
      const title = typeof document !== 'undefined' ? document.title : '';
      const newSearch = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
      window.history.replaceState({}, title, url.pathname + newSearch + url.hash);
    }
  } catch (e) {}
}

/**
 * Retrieves optional Cloudflare Service Token credentials configured on this client.
 */
export function getCloudflareServiceTokens(): { clientId: string; clientSecret: string } {
  if (typeof localStorage === 'undefined') return { clientId: '', clientSecret: '' };
  return {
    clientId: localStorage.getItem(CF_ACCESS_CLIENT_ID_KEY) || '',
    clientSecret: localStorage.getItem(CF_ACCESS_CLIENT_SECRET_KEY) || ''
  };
}

/**
 * Saves or clears optional Cloudflare Service Token credentials.
 */
export function setCloudflareServiceTokens(tokens: { clientId?: string; clientSecret?: string }): void {
  if (typeof localStorage === 'undefined') return;

  if (tokens.clientId !== undefined) {
    if (tokens.clientId.trim()) {
      localStorage.setItem(CF_ACCESS_CLIENT_ID_KEY, tokens.clientId.trim());
    } else {
      localStorage.removeItem(CF_ACCESS_CLIENT_ID_KEY);
    }
  }

  if (tokens.clientSecret !== undefined) {
    if (tokens.clientSecret.trim()) {
      localStorage.setItem(CF_ACCESS_CLIENT_SECRET_KEY, tokens.clientSecret.trim());
    } else {
      localStorage.removeItem(CF_ACCESS_CLIENT_SECRET_KEY);
    }
  }
}

/**
 * Checks whether the Cloudflare Security Token Refresh helper is enabled.
 * Checks SQLite appConfig first, then localStorage, and falls back to true if
 * Cloudflare Service Tokens are configured on the client. Otherwise defaults to false
 * so non-Cloudflare users (direct LAN, Nabu Casa, VPN) are not bothered with Cloudflare prompts.
 */
export function isCloudflareTokenRefreshEnabled(appConfig?: { key: string; value: string }[]): boolean {
  if (appConfig && Array.isArray(appConfig)) {
    const item = appConfig.find(c => c.key === CF_TOKEN_REFRESH_ENABLED_KEY);
    if (item?.value !== undefined) {
      return item.value === 'true';
    }
  }

  if (typeof localStorage !== 'undefined') {
    const val = localStorage.getItem(CF_TOKEN_REFRESH_ENABLED_KEY);
    if (val !== null) {
      return val === 'true';
    }

    // Auto-enable if client has Cloudflare service tokens configured
    const clientId = localStorage.getItem(CF_ACCESS_CLIENT_ID_KEY);
    if (clientId && clientId.trim()) {
      return true;
    }
  }

  return false;
}

/**
 * Persists the Cloudflare Security Token Refresh helper preference locally and fires a sync event.
 */
export function setCloudflareTokenRefreshEnabled(enabled: boolean): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CF_TOKEN_REFRESH_ENABLED_KEY, String(enabled));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('freezer-cf-token-refresh-toggled', { detail: { enabled } }));
  }
}

