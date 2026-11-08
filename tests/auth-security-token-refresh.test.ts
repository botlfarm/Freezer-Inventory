import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  preserveDeviceIdentity,
  restoreDeviceIdentityIfLost,
  getCloudflareServiceTokens,
  setCloudflareServiceTokens,
  cleanTokenRefreshUrlParams,
  probeAuthStatus,
  isCloudflareTokenRefreshEnabled,
  setCloudflareTokenRefreshEnabled,
  FREEZER_DEVICE_BACKUP_KEY,
  CF_ACCESS_CLIENT_ID_KEY,
  CF_ACCESS_CLIENT_SECRET_KEY,
  CF_TOKEN_REFRESH_ENABLED_KEY
} from '../utils/authSecurity';
import {
  getDeviceId,
  getDeviceName,
  getOperatorName,
  getClientAuditHeaders,
  FREEZER_DEVICE_ID_KEY,
  FREEZER_DEVICE_NAME_KEY,
  FREEZER_OPERATOR_NAME_KEY
} from '../utils/clientDevice';

describe('Cloudflare Security Token Refresh & Device Identity Preservation', () => {
  const mockLocalStorage: Record<string, string> = {};
  const mockSessionStorage: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]);
    Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]);

    // Setup browser localStorage mock
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => { mockLocalStorage[key] = String(val); }),
      removeItem: vi.fn((key: string) => { delete mockLocalStorage[key]; }),
      clear: vi.fn(() => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); })
    });

    // Setup browser sessionStorage mock
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
      setItem: vi.fn((key: string, val: string) => { mockSessionStorage[key] = String(val); }),
      removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
      clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); })
    });

    vi.stubGlobal('window', {
      location: {
        href: 'https://freezer.example.com/',
        pathname: '/',
        search: '',
        hash: ''
      },
      history: {
        replaceState: vi.fn()
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves device ID, device name, and operator name into redundant backup storage', () => {
    mockLocalStorage[FREEZER_DEVICE_ID_KEY] = 'freezer-dev-test-1234';
    mockLocalStorage[FREEZER_DEVICE_NAME_KEY] = 'Barn Walk-In iPad';
    mockLocalStorage[FREEZER_OPERATOR_NAME_KEY] = 'Butcher Mike';

    const backup = preserveDeviceIdentity();

    expect(backup.deviceId).toBe('freezer-dev-test-1234');
    expect(backup.deviceName).toBe('Barn Walk-In iPad');
    expect(backup.operatorName).toBe('Butcher Mike');
    expect(backup.timestamp).toBeGreaterThan(0);

    // Verify written to both localStorage and sessionStorage
    expect(mockLocalStorage[FREEZER_DEVICE_BACKUP_KEY]).toBeDefined();
    expect(mockSessionStorage[FREEZER_DEVICE_BACKUP_KEY]).toBeDefined();

    const parsedLocal = JSON.parse(mockLocalStorage[FREEZER_DEVICE_BACKUP_KEY]);
    expect(parsedLocal.deviceId).toBe('freezer-dev-test-1234');
    expect(parsedLocal.deviceName).toBe('Barn Walk-In iPad');
    expect(parsedLocal.operatorName).toBe('Butcher Mike');
  });

  it('restores device identity without creating a new random ID if primary keys were cleared', () => {
    // 1. Establish initial identity and save backup
    mockLocalStorage[FREEZER_DEVICE_ID_KEY] = 'persistent-hardware-uuid-999';
    mockLocalStorage[FREEZER_DEVICE_NAME_KEY] = 'Warehouse Tablet';
    mockLocalStorage[FREEZER_OPERATOR_NAME_KEY] = 'Sarah';
    preserveDeviceIdentity();

    // 2. Simulate browser cache or partial storage clearing
    delete mockLocalStorage[FREEZER_DEVICE_ID_KEY];
    delete mockLocalStorage[FREEZER_DEVICE_NAME_KEY];
    delete mockLocalStorage[FREEZER_OPERATOR_NAME_KEY];

    // 3. getDeviceId, getDeviceName, and getOperatorName should recover identity from backup
    const recoveredId = getDeviceId();
    const recoveredName = getDeviceName();
    const recoveredOp = getOperatorName();

    expect(recoveredId).toBe('persistent-hardware-uuid-999');
    expect(recoveredName).toBe('Warehouse Tablet');
    expect(recoveredOp).toBe('Sarah');

    // Primary localStorage keys should be restored automatically
    expect(mockLocalStorage[FREEZER_DEVICE_ID_KEY]).toBe('persistent-hardware-uuid-999');
    expect(mockLocalStorage[FREEZER_DEVICE_NAME_KEY]).toBe('Warehouse Tablet');
    expect(mockLocalStorage[FREEZER_OPERATOR_NAME_KEY]).toBe('Sarah');
  });

  it('restoreDeviceIdentityIfLost explicitly recovers missing identity fields', () => {
    mockSessionStorage[FREEZER_DEVICE_BACKUP_KEY] = JSON.stringify({
      deviceId: 'backup-session-dev-777',
      deviceName: 'Processing Room Station',
      operatorName: 'Alex',
      timestamp: Date.now()
    });

    const didRestore = restoreDeviceIdentityIfLost();
    expect(didRestore).toBe(true);

    expect(mockLocalStorage[FREEZER_DEVICE_ID_KEY]).toBe('backup-session-dev-777');
    expect(mockLocalStorage[FREEZER_DEVICE_NAME_KEY]).toBe('Processing Room Station');
    expect(mockLocalStorage[FREEZER_OPERATOR_NAME_KEY]).toBe('Alex');

    // Calling again when identity is intact returns false
    expect(restoreDeviceIdentityIfLost()).toBe(false);
  });

  it('manages optional Cloudflare Service Token credentials and attaches them to request headers', () => {
    mockLocalStorage[FREEZER_DEVICE_ID_KEY] = 'cf-test-dev';
    mockLocalStorage[FREEZER_DEVICE_NAME_KEY] = 'CF Client';
    mockLocalStorage[FREEZER_OPERATOR_NAME_KEY] = 'Test Operator';

    // Before configuring CF tokens, audit headers should not include CF headers
    let headers = getClientAuditHeaders();
    expect(headers['CF-Access-Client-Id']).toBeUndefined();
    expect(headers['CF-Access-Client-Secret']).toBeUndefined();

    // Save CF Service Tokens
    setCloudflareServiceTokens({
      clientId: 'cf-app-client-id-abc',
      clientSecret: 'cf-app-secret-xyz'
    });

    const storedTokens = getCloudflareServiceTokens();
    expect(storedTokens.clientId).toBe('cf-app-client-id-abc');
    expect(storedTokens.clientSecret).toBe('cf-app-secret-xyz');

    // Audit headers now include CF headers
    headers = getClientAuditHeaders();
    expect(headers['CF-Access-Client-Id']).toBe('cf-app-client-id-abc');
    expect(headers['CF-Access-Client-Secret']).toBe('cf-app-secret-xyz');

    // Clearing CF Service Tokens
    setCloudflareServiceTokens({
      clientId: '',
      clientSecret: ''
    });

    headers = getClientAuditHeaders();
    expect(headers['CF-Access-Client-Id']).toBeUndefined();
    expect(headers['CF-Access-Client-Secret']).toBeUndefined();
  });

  it('cleans up cf_token_refresh query parameters from window address bar', () => {
    const replaceStateMock = vi.fn();
    (window as any).location = {
      href: 'https://freezer.example.com/?cf_token_refresh=1700000000000&cf_auth_success=1#product',
      pathname: '/',
      search: '?cf_token_refresh=1700000000000&cf_auth_success=1',
      hash: '#product'
    };
    (window as any).history = {
      replaceState: replaceStateMock
    };

    cleanTokenRefreshUrlParams();

    expect(replaceStateMock).toHaveBeenCalled();
    const callArgs = replaceStateMock.mock.calls[0];
    expect(callArgs[2]).toBe('/#product');
  });

  it('diagnoses auth probe responses for 200 OK, 401 Unauthorized, and Cloudflare HTML redirects', async () => {
    // 1. Healthy 200 OK response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: vi.fn((h: string) => h === 'content-type' ? 'application/json' : null),
        has: vi.fn(() => false)
      }
    }));

    let probe = await probeAuthStatus('https://test.local/api/version');
    expect(probe.isBlocked).toBe(false);
    expect(probe.isCloudflareBlocked).toBe(false);
    expect(probe.status).toBe(200);

    // 2. 401 Unauthorized response
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        get: vi.fn(() => null),
        has: vi.fn((h: string) => h === 'cf-ray')
      }
    }));

    probe = await probeAuthStatus('https://test.local/api/version');
    expect(probe.isBlocked).toBe(true);
    expect(probe.isCloudflareBlocked).toBe(true);
    expect(probe.status).toBe(401);

    // 3. Cloudflare Access HTML Login Redirect response (HTTP 200 or 302 returning HTML)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {
        get: vi.fn((h: string) => h === 'content-type' ? 'text/html; charset=utf-8' : null),
        has: vi.fn((h: string) => h === 'cf-ray')
      }
    }));

    probe = await probeAuthStatus('https://test.local/api/version');
    expect(probe.isBlocked).toBe(true);
    expect(probe.isCloudflareBlocked).toBe(true);
    expect(probe.isHtmlRedirect).toBe(true);
    expect(probe.message).toContain('Cloudflare returned a login page');
  });

  describe('Cloudflare Token Refresh Enable/Disable Setting', () => {
    it('defaults to disabled (false) when no config or tokens are present', () => {
      expect(isCloudflareTokenRefreshEnabled()).toBe(false);
      expect(isCloudflareTokenRefreshEnabled([])).toBe(false);
    });

    it('honors centralized appConfig from SQLite when set to true', () => {
      const appConfig = [{ key: CF_TOKEN_REFRESH_ENABLED_KEY, value: 'true' }];
      expect(isCloudflareTokenRefreshEnabled(appConfig)).toBe(true);
    });

    it('honors centralized appConfig from SQLite when set to false', () => {
      const appConfig = [{ key: CF_TOKEN_REFRESH_ENABLED_KEY, value: 'false' }];
      expect(isCloudflareTokenRefreshEnabled(appConfig)).toBe(false);
    });

    it('falls back to localStorage preference when appConfig is omitted', () => {
      mockLocalStorage[CF_TOKEN_REFRESH_ENABLED_KEY] = 'true';
      expect(isCloudflareTokenRefreshEnabled()).toBe(true);

      mockLocalStorage[CF_TOKEN_REFRESH_ENABLED_KEY] = 'false';
      expect(isCloudflareTokenRefreshEnabled()).toBe(false);
    });

    it('appConfig takes precedence over localStorage', () => {
      mockLocalStorage[CF_TOKEN_REFRESH_ENABLED_KEY] = 'true';
      const appConfig = [{ key: CF_TOKEN_REFRESH_ENABLED_KEY, value: 'false' }];
      expect(isCloudflareTokenRefreshEnabled(appConfig)).toBe(false);
    });

    it('auto-enables if Cloudflare Service Token is configured in client storage without explicit toggle', () => {
      delete mockLocalStorage[CF_TOKEN_REFRESH_ENABLED_KEY];
      mockLocalStorage[CF_ACCESS_CLIENT_ID_KEY] = 'service-client-id-xyz';
      expect(isCloudflareTokenRefreshEnabled()).toBe(true);
    });

    it('setCloudflareTokenRefreshEnabled stores value in localStorage and dispatches event', () => {
      const eventSpy = vi.fn();
      vi.stubGlobal('window', {
        dispatchEvent: eventSpy
      });

      setCloudflareTokenRefreshEnabled(true);
      expect(mockLocalStorage[CF_TOKEN_REFRESH_ENABLED_KEY]).toBe('true');
      expect(eventSpy).toHaveBeenCalled();

      setCloudflareTokenRefreshEnabled(false);
      expect(mockLocalStorage[CF_TOKEN_REFRESH_ENABLED_KEY]).toBe('false');
    });
  });
});

