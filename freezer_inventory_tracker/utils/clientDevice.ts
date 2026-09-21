export interface ClientDeviceInfo {
  clientDevice: 'Desktop Browser' | 'Mobile Browser' | 'HA Companion App';
  clientInfo: string;
}

/**
 * Detects client environment (Desktop Browser, Mobile Browser, or Home Assistant Companion App)
 * and extracts relevant browser and operating system details for audit history.
 */
export function getClientDeviceInfo(): ClientDeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      clientDevice: 'Desktop Browser',
      clientInfo: 'Desktop Browser'
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
      clientInfo: `HA Companion App (${os})`
    };
  }

  // 2. Detect Mobile Browser vs Desktop Browser
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

  if (isMobileUA || isSmallScreen) {
    let deviceName = 'Mobile';
    if (/iPhone/i.test(ua)) deviceName = 'iPhone';
    else if (/iPad/i.test(ua)) deviceName = 'iPad';
    else if (/Android/i.test(ua)) deviceName = 'Android';

    return {
      clientDevice: 'Mobile Browser',
      clientInfo: `Mobile Browser (${browser} / ${deviceName})`
    };
  }

  // Determine Desktop OS
  let os = 'Desktop';
  if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  return {
    clientDevice: 'Desktop Browser',
    clientInfo: `Desktop Browser (${browser} / ${os})`
  };
}

/**
 * Returns HTTP headers to attach client device and browser context to API requests.
 */
export function getClientAuditHeaders(): Record<string, string> {
  const { clientDevice, clientInfo } = getClientDeviceInfo();
  return {
    'X-Client-Device': clientDevice,
    'X-Client-Info': clientInfo
  };
}
