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

/**
 * Detects whether the application is running as an installed Standalone PWA.
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const isMatchMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const isNavigatorStandalone = (window.navigator as any)?.standalone === true;
  const isAndroidReferrer = Boolean(document?.referrer && document.referrer.includes('android-app://'));
  return Boolean(isMatchMedia || isNavigatorStandalone || isAndroidReferrer);
}

/**
 * Gets or initializes a persistent device identifier stored in localStorage.
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'server_or_unknown';
  }
  let id = localStorage.getItem(FREEZER_DEVICE_ID_KEY);
  if (!id || !id.trim()) {
    try {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        id = crypto.randomUUID();
      } else {
        id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      }
    } catch (e) {
      id = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
    }
    localStorage.setItem(FREEZER_DEVICE_ID_KEY, id);
  }
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
 */
export function getDeviceName(): string {
  if (typeof localStorage === 'undefined') return getDefaultDeviceName();
  const stored = localStorage.getItem(FREEZER_DEVICE_NAME_KEY);
  if (stored && stored.trim()) return stored.trim();
  return getDefaultDeviceName();
}

/**
 * Gets the configured operator name for this specific device.
 */
export function getOperatorName(): string {
  if (typeof localStorage === 'undefined') return '';
  const op =
    localStorage.getItem(FREEZER_OPERATOR_NAME_KEY) ||
    localStorage.getItem('freezerUserName') ||
    localStorage.getItem('freezer_user') ||
    '';
  if (op.trim() && op.trim() !== 'User') {
    return op.trim();
  }
  return '';
}

/**
 * Saves operator name and device label locally and dispatches a change event.
 */
export function setClientDeviceInfo(updates: { operatorName?: string; deviceName?: string; markPrompted?: boolean }) {
  if (typeof localStorage === 'undefined') return;

  if (updates.operatorName !== undefined) {
    const cleanOp = updates.operatorName.trim();
    localStorage.setItem(FREEZER_OPERATOR_NAME_KEY, cleanOp);
    localStorage.setItem('freezerUserName', cleanOp);
    localStorage.setItem('freezer_user', cleanOp);
  }

  if (updates.deviceName !== undefined) {
    const cleanDev = updates.deviceName.trim();
    localStorage.setItem(FREEZER_DEVICE_NAME_KEY, cleanDev);
  }

  if (updates.markPrompted) {
    localStorage.setItem(FREEZER_DEVICE_PROMPTED_KEY, 'true');
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

  return headers;
}
