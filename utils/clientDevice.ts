// Client device detection utils
export interface ClientDeviceInfo {
  clientDevice: 'Desktop Browser' | 'Mobile Browser' | 'HA Companion App' | 'Standalone PWA';
  clientInfo: string;
  deviceId: string;
  deviceName: string;
  operatorName: string;
  isPwa: boolean;
}

export const FREEZER_DEVICE_ID_KEY = 'freezer_device_id';
export const FREEZER_DEVICE_NAME_KEY = 'freezer_device_name';
export const FREEZER_OPERATOR_NAME_KEY = 'freezer_operator_name';
export const FREEZER_DEVICE_PROMPTED_KEY = 'freezer_device_prompted_v1';
export const FREEZER_USER_SESSION_KEY = 'freezer_user_session';

let inMemorySessionToken = '';

export function getSessionToken(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const val = (localStorage.getItem(FREEZER_USER_SESSION_KEY) || '').trim();
      if (val) {
        inMemorySessionToken = val;
        try {
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem(FREEZER_USER_SESSION_KEY, val);
          }
        } catch {}
        return val;
      }
    }
  } catch {
    // ignore storage errors
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      const sVal = (sessionStorage.getItem(FREEZER_USER_SESSION_KEY) || '').trim();
      if (sVal) {
        inMemorySessionToken = sVal;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(FREEZER_USER_SESSION_KEY, sVal);
          }
        } catch {}
        return sVal;
      }
    }
  } catch {
    // ignore storage errors
  }

  return inMemorySessionToken;
}

export function setSessionToken(token: string): void {
  const clean = (token || '').trim();
  inMemorySessionToken = clean;
  try {
    if (typeof localStorage !== 'undefined') {
      if (clean) {
        localStorage.setItem(FREEZER_USER_SESSION_KEY, clean);
      } else {
        localStorage.removeItem(FREEZER_USER_SESSION_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (clean) {
        sessionStorage.setItem(FREEZER_USER_SESSION_KEY, clean);
      } else {
        sessionStorage.removeItem(FREEZER_USER_SESSION_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function clearSessionToken(): void {
  inMemorySessionToken = '';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(FREEZER_USER_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(FREEZER_USER_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Detects whether the application is running as an installed Standalone PWA.
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const isMatchMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone = (window.navigator as any)?.standalone === true;
  const isAndroidReferrer = typeof document !== 'undefined' && Boolean(document?.referrer && document.referrer.includes('android-app://'));
  return Boolean(isMatchMedia || isNavigatorStandalone || isAndroidReferrer);
}

let inMemoryDeviceId = '';
let inMemoryDeviceName = '';
let inMemoryOperatorName = '';

function safeStorageGet(storageType: 'local' | 'session', key: string): string {
  try {
    const store = storageType === 'local'
      ? (typeof localStorage !== 'undefined' ? localStorage : undefined)
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
    if (!store) return '';
    return (store.getItem(key) || '').trim();
  } catch {
    return '';
  }
}

function safeStorageSet(storageType: 'local' | 'session', key: string, value: string): void {
  try {
    const store = storageType === 'local'
      ? (typeof localStorage !== 'undefined' ? localStorage : undefined)
      : (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
    if (!store) return;
    store.setItem(key, value);
  } catch {
    // ignore storage errors
  }
}

function readIdentityBackup(): { deviceId?: string; deviceName?: string; operatorName?: string } | null {
  try {
    const backupRaw =
      safeStorageGet('local', 'freezer_device_identity_backup_v1') ||
      safeStorageGet('session', 'freezer_device_identity_backup_v1');
    if (backupRaw) {
      const parsed = JSON.parse(backupRaw);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
  } catch {
    // ignore invalid backup JSON
  }
  return null;
}

/**
 * Gets or initializes a persistent device identifier stored in localStorage.
 * Checks backup storage and falls back to sessionStorage/memory if localStorage is blocked.
 */
export function getDeviceId(): string {
  let id = safeStorageGet('local', FREEZER_DEVICE_ID_KEY);
  if (!id) {
    const backup = readIdentityBackup();
    if (backup?.deviceId && backup.deviceId.trim()) {
      id = backup.deviceId.trim();
    }
  }
  if (!id) {
    id = safeStorageGet('session', FREEZER_DEVICE_ID_KEY);
  }
  if (!id && inMemoryDeviceId) {
    id = inMemoryDeviceId;
  }
  if (!id) {
    if (typeof localStorage === 'undefined' && typeof sessionStorage === 'undefined' && typeof window === 'undefined') {
      return 'server_or_unknown';
    }
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      } else {
        id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      }
    } catch {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    }
  }

  inMemoryDeviceId = id;
  safeStorageSet('local', FREEZER_DEVICE_ID_KEY, id);
  safeStorageSet('session', FREEZER_DEVICE_ID_KEY, id);
  return id;
}

/**
 * Generates an intelligent default device label based on the browser/OS user agent.
 */
export function getDefaultDeviceName(): string {
  if (typeof navigator === 'undefined') return 'My Device';
  const ua = navigator.userAgent || '';
  const isPWA = isStandalonePWA();
  const prefix = isPWA ? 'PWA ' : '';

  if (/iPhone/i.test(ua)) return `${prefix}iPhone`;
  if (/iPad/i.test(ua)) return `${prefix}iPad`;
  if (/Android.*Mobile|Mobile.*Android/i.test(ua)) return `${prefix}Android Phone`;
  if (/Android/i.test(ua)) return `${prefix}Android Tablet`;
  if (/Macintosh|Mac OS X/i.test(ua)) return `${prefix}Mac`;
  if (/Windows NT/i.test(ua)) return `${prefix}Windows PC`;
  if (/CrOS/i.test(ua)) return `${prefix}Chromebook`;
  if (/Linux/i.test(ua)) return `${prefix}Linux Workstation`;

  return `${prefix}Device`;
}

/**
 * Gets the configured or default device name.
 * Checks redundant backup before falling back to sessionStorage, memory, or default.
 */
export function getDeviceName(): string {
  let name = safeStorageGet('local', FREEZER_DEVICE_NAME_KEY);
  if (!name) {
    const backup = readIdentityBackup();
    if (backup?.deviceName && backup.deviceName.trim()) {
      name = backup.deviceName.trim();
    }
  }
  if (!name) {
    name = safeStorageGet('session', FREEZER_DEVICE_NAME_KEY);
  }
  if (!name && inMemoryDeviceName) {
    name = inMemoryDeviceName;
  }

  if (name) {
    inMemoryDeviceName = name;
    safeStorageSet('local', FREEZER_DEVICE_NAME_KEY, name);
    safeStorageSet('session', FREEZER_DEVICE_NAME_KEY, name);
    return name;
  }

  return getDefaultDeviceName();
}

/**
 * Gets the configured operator name for this specific device.
 * Checks redundant backup before falling back to sessionStorage or memory.
 */
export function getOperatorName(): string {
  let op =
    safeStorageGet('local', FREEZER_OPERATOR_NAME_KEY) ||
    safeStorageGet('local', 'freezerUserName') ||
    safeStorageGet('local', 'freezer_user');

  if (!op || op === 'User') {
    const backup = readIdentityBackup();
    if (backup?.operatorName && backup.operatorName.trim() && backup.operatorName.trim() !== 'User') {
      op = backup.operatorName.trim();
    }
  }
  if (!op || op === 'User') {
    op = safeStorageGet('session', FREEZER_OPERATOR_NAME_KEY);
  }
  if ((!op || op === 'User') && inMemoryOperatorName && inMemoryOperatorName !== 'User') {
    op = inMemoryOperatorName;
  }

  if (op && op !== 'User') {
    inMemoryOperatorName = op;
    safeStorageSet('local', FREEZER_OPERATOR_NAME_KEY, op);
    safeStorageSet('local', 'freezerUserName', op);
    safeStorageSet('local', 'freezer_user', op);
    safeStorageSet('session', FREEZER_OPERATOR_NAME_KEY, op);
    return op;
  }

  return '';
}

/**
 * Saves operator name and device label locally and dispatches a change event.
 */
export function setClientDeviceInfo(updates: { operatorName?: string; deviceName?: string; markPrompted?: boolean }) {
  if (updates.operatorName !== undefined) {
    const cleanOp = updates.operatorName.trim();
    inMemoryOperatorName = cleanOp;
    safeStorageSet('local', FREEZER_OPERATOR_NAME_KEY, cleanOp);
    safeStorageSet('local', 'freezerUserName', cleanOp);
    safeStorageSet('local', 'freezer_user', cleanOp);
    safeStorageSet('session', FREEZER_OPERATOR_NAME_KEY, cleanOp);
  }

  if (updates.deviceName !== undefined) {
    const cleanDev = updates.deviceName.trim();
    inMemoryDeviceName = cleanDev;
    safeStorageSet('local', FREEZER_DEVICE_NAME_KEY, cleanDev);
    safeStorageSet('session', FREEZER_DEVICE_NAME_KEY, cleanDev);
  }

  if (updates.markPrompted) {
    safeStorageSet('local', FREEZER_DEVICE_PROMPTED_KEY, 'true');
    safeStorageSet('session', FREEZER_DEVICE_PROMPTED_KEY, 'true');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('freezer_device_info_changed', {
      detail: {
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        operatorName: getOperatorName()
      }
    }));
  }
}

/**
 * Detects client environment (Standalone PWA, Desktop Browser, Mobile Browser, or Home Assistant Companion App)
 * and extracts relevant browser, operating system, and device details for audit history.
 */
export function getClientDeviceInfo(): ClientDeviceInfo {
  const deviceId = getDeviceId();
  const deviceName = getDeviceName();
  const operatorName = getOperatorName();
  const isPwa = isStandalonePWA();

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      clientDevice: 'Desktop Browser',
      clientInfo: 'Desktop Browser',
      deviceId,
      deviceName,
      operatorName,
      isPwa: false
    };
  }

  const ua = navigator.userAgent || '';

  // 1. Detect Home Assistant Companion App (iOS or Android)
  const isHACompanion =
    /Home\s*Assistant|HomeAssistant|io\.robbie\.HomeAssistant|io\.homeassistant\.companion/i.test(ua) ||
    Boolean((window as any).externalApp) ||
    Boolean((window as any).webkit?.messageHandlers?.externalApp);

  if (isHACompanion) {
    const isIOS = /iPhone|iPad|iPod|iOS/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const os = isIOS ? 'iOS' : isAndroid ? 'Android' : 'HA OS';
    return {
      clientDevice: 'HA Companion App',
      clientInfo: `HA Companion App (${os})`,
      deviceId,
      deviceName,
      operatorName,
      isPwa: false
    };
  }

  // 2. Detect Operating System & Device Details
  const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isMobileUA =
    /iPhone|iPad|iPod|Android.*Mobile|Mobile.*Android|webOS|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(ua) ||
    /Android|iPhone|iPad|iPod/i.test(ua);
  const isSmallScreen = typeof window.innerWidth === 'number' && window.innerWidth <= 1024 && isTouch;

  // Determine Browser Name
  let browser = 'Browser';
  if (/Edg\//i.test(ua) || /EdgiOS\//i.test(ua)) {
    browser = 'Edge';
  } else if (/OPR\//i.test(ua) || /Opera\//i.test(ua)) {
    browser = 'Opera';
  } else if (/CriOS\//i.test(ua) || (/Chrome\//i.test(ua) && !/Edg\//i.test(ua))) {
    browser = 'Chrome';
  } else if (/FxiOS\//i.test(ua) || /Firefox\//i.test(ua)) {
    browser = 'Firefox';
  } else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/CriOS\//i.test(ua)) {
    browser = 'Safari';
  }

  // Determine Hardware OS
  let os = 'Desktop';
  if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Windows NT/i.test(ua)) os = 'Windows';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // 3. Detect Standalone PWA
  if (isPwa) {
    return {
      clientDevice: 'Standalone PWA',
      clientInfo: `Standalone PWA (${os} / ${browser})`,
      deviceId,
      deviceName,
      operatorName,
      isPwa: true
    };
  }

  // 4. Mobile Browser vs Desktop Browser
  if (isMobileUA || isSmallScreen) {
    return {
      clientDevice: 'Mobile Browser',
      clientInfo: `Mobile Browser (${browser} / ${os})`,
      deviceId,
      deviceName,
      operatorName,
      isPwa: false
    };
  }

  return {
    clientDevice: 'Desktop Browser',
    clientInfo: `Desktop Browser (${browser} / ${os})`,
    deviceId,
    deviceName,
    operatorName,
    isPwa: false
  };
}

/**
 * Returns HTTP headers to attach client device, operator identity, and browser context to API requests.
 */
export function getClientAuditHeaders(): Record<string, string> {
  const info = getClientDeviceInfo();
  const headers: Record<string, string> = {
    'X-Client-Device': info.clientDevice,
    'X-Client-Info': info.clientInfo,
    'X-Device-Id': info.deviceId,
    'X-Device-Name': encodeURIComponent(info.deviceName || ''),
    'X-Is-Pwa': info.isPwa ? '1' : '0'
  };

  if (info.operatorName && info.operatorName.trim() && info.operatorName.trim() !== 'User') {
    headers['X-User-Name'] = info.operatorName.trim();
    headers['X-Operator-Name'] = info.operatorName.trim();
  }

  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers['X-User-Session'] = sessionToken;
  }

  // Attach optional Cloudflare Access Service Token headers if configured
  if (typeof localStorage !== 'undefined') {
    try {
      const cfId = localStorage.getItem('freezer_cf_access_client_id');
      const cfSecret = localStorage.getItem('freezer_cf_access_client_secret');
      if (cfId && cfSecret) {
        headers['CF-Access-Client-Id'] = cfId;
        headers['CF-Access-Client-Secret'] = cfSecret;
      }
    } catch (e) {}
  }

  return headers;
}

/**
 * Wrapper around fetch() that attaches persistent user session cookies,
 * X-User-Session header, and device audit headers.
 */
export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const mergedHeaders = new Headers(getClientAuditHeaders());
  if (init.headers) {
    const callerHeaders = new Headers(init.headers);
    callerHeaders.forEach((value, key) => {
      mergedHeaders.set(key, value);
    });
  }
  return fetch(input, {
    ...init,
    credentials: init.credentials || 'include',
    headers: mergedHeaders
  });
}
