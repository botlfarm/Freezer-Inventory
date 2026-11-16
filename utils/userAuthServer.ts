import crypto from 'crypto';
import fs from 'fs';
import Database from 'better-sqlite3';
import { AppUserRole, AppUserSummary, LegacyOperatorGroup, PwaDevice, UserSessionSummary } from '../types';

export const USER_SESSION_COOKIE_NAME = 'freezer_user_session';
export const DEFAULT_HA_OPTIONS_PATH = '/data/options.json';
export const REQUIRE_LOGIN_FOR_EDITS_KEY = 'require_login_for_edits';

export class AuthError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode: number = 400, code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface RecoveryConfig {
  recoveryMode: boolean;
  recoveryPin: string;
  recoveryPinConfigured: boolean;
  source: 'none' | 'env' | 'ha_options';
}

export function normalizeUsername(name: string): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function validateUsername(name: string): { valid: boolean; clean: string; error?: string } {
  const clean = normalizeUsername(name);
  if (!clean || clean.length < 1) {
    return { valid: false, clean: '', error: 'User name is required.' };
  }
  if (clean.length > 64) {
    return { valid: false, clean, error: 'User name must be 64 characters or fewer.' };
  }
  return { valid: true, clean };
}

export function validatePin(pin: string): { valid: boolean; clean: string; error?: string } {
  const clean = String(pin ?? '').trim();
  if (clean.length < 4 || clean.length > 16) {
    return { valid: false, clean, error: 'PIN must be between 4 and 16 characters.' };
  }
  if (/\s/.test(clean)) {
    return { valid: false, clean, error: 'PIN cannot contain spaces or whitespace.' };
  }
  return { valid: true, clean };
}

export function hashPin(pin: string, existingSalt?: string): { hash: string; salt: string } {
  const cleanPin = String(pin ?? '').trim();
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(cleanPin, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPin(pin: string, storedHash: string, storedSalt: string): boolean {
  if (!pin || !storedHash || !storedSalt) return false;
  try {
    const cleanPin = String(pin).trim();
    const derivedBuf = crypto.scryptSync(cleanPin, storedSalt, 64);
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (derivedBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(derivedBuf, storedBuf);
  } catch {
    return false;
  }
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return out;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

export function isHttpsRequest(req: any): boolean {
  if (!req) return false;
  if (req.secure === true) return true;
  if (String(req.protocol || '').toLowerCase() === 'https') return true;
  const xfProto = req.headers?.['x-forwarded-proto'];
  const protoStr = Array.isArray(xfProto) ? xfProto.join(',') : String(xfProto || '');
  if (protoStr.toLowerCase().split(',').some((p) => p.trim() === 'https')) {
    return true;
  }
  const xfSsl = String(req.headers?.['x-forwarded-ssl'] || '').toLowerCase().trim();
  if (xfSsl === 'on' || xfSsl === '1' || xfSsl === 'true') return true;
  const origin = String(req.headers?.origin || req.headers?.referer || '').toLowerCase().trim();
  if (origin.startsWith('https://')) return true;
  return false;
}

export function buildSessionCookieHeader(opts: {
  token: string;
  isHttps: boolean;
  maxAgeSeconds?: number;
}): string {
  const maxAge = typeof opts.maxAgeSeconds === 'number' ? opts.maxAgeSeconds : 365 * 24 * 60 * 60;
  const sameSiteAttrs = opts.isHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
  return `${USER_SESSION_COOKIE_NAME}=${encodeURIComponent(opts.token)}; HttpOnly; ${sameSiteAttrs}; Path=/; Max-Age=${maxAge}`;
}

export function readRecoveryConfig(opts?: {
  optionsPath?: string;
  env?: Record<string, string | undefined>;
}): RecoveryConfig {
  const env = opts?.env || process.env;
  const optionsPath = opts?.optionsPath || DEFAULT_HA_OPTIONS_PATH;

  let haMode = false;
  let haPin = '';
  let haPresent = false;

  try {
    if (optionsPath && fs.existsSync(optionsPath)) {
      const raw = fs.readFileSync(optionsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.admin_recovery_mode === true || parsed.admin_recovery_mode === 'true') {
          haMode = true;
          haPresent = true;
        }
        if (typeof parsed.admin_recovery_pin === 'string' && parsed.admin_recovery_pin.trim()) {
          haPin = parsed.admin_recovery_pin.trim();
          haPresent = true;
        }
      }
    }
  } catch {
    // Ignore unreadable options.json
  }

  const envModeRaw = String(env.ADMIN_RECOVERY_MODE || '').trim().toLowerCase();
  const envMode = envModeRaw === 'true' || envModeRaw === '1' || envModeRaw === 'yes';
  const envPin = typeof env.ADMIN_RECOVERY_PIN === 'string' ? env.ADMIN_RECOVERY_PIN.trim() : '';

  const recoveryMode = envMode || haMode;
  const recoveryPin = envPin || haPin;
  const source: RecoveryConfig['source'] =
    envMode || envPin ? 'env' : haPresent ? 'ha_options' : 'none';

  return {
    recoveryMode,
    recoveryPin,
    recoveryPinConfigured: Boolean(recoveryPin),
    source,
  };
}

export function verifyRecoveryPin(enteredPin: string, configuredPin: string): boolean {
  const a = Buffer.from(String(enteredPin || '').trim(), 'utf8');
  const b = Buffer.from(String(configuredPin || '').trim(), 'utf8');
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export class PinRateLimiter {
  private maxAttempts: number;
  private windowMs: number;
  private lockDurationMs: number;
  private records = new Map<string, { failures: number; firstFailureAt: number; lockedUntil: number }>();

  constructor(maxAttempts: number = 5, lockDurationMs: number = 60_000, windowMs: number = 10 * 60_000) {
    this.maxAttempts = maxAttempts;
    this.lockDurationMs = lockDurationMs;
    this.windowMs = windowMs;
  }

  check(key: string, now: number = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    if (!key) return { allowed: true, retryAfterSeconds: 0 };
    const rec = this.records.get(key);
    if (!rec) return { allowed: true, retryAfterSeconds: 0 };
    if (rec.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((rec.lockedUntil - now) / 1000)),
      };
    }
    if (now - rec.firstFailureAt > this.windowMs) {
      this.records.delete(key);
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  recordFailure(key: string, now: number = Date.now()): { locked: boolean; retryAfterSeconds: number; remaining: number } {
    if (!key) return { locked: false, retryAfterSeconds: 0, remaining: this.maxAttempts };
    const existing = this.records.get(key);
    if (!existing || now - existing.firstFailureAt > this.windowMs || existing.lockedUntil > 0 && existing.lockedUntil <= now) {
      this.records.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
      return { locked: false, retryAfterSeconds: 0, remaining: Math.max(0, this.maxAttempts - 1) };
    }

    const failures = existing.failures + 1;
    let lockedUntil = existing.lockedUntil;
    if (failures >= this.maxAttempts) {
      lockedUntil = now + this.lockDurationMs;
    }
    this.records.set(key, { failures, firstFailureAt: existing.firstFailureAt, lockedUntil });
    if (lockedUntil > now) {
      return {
        locked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((lockedUntil - now) / 1000)),
        remaining: 0,
      };
    }
    return { locked: false, retryAfterSeconds: 0, remaining: Math.max(0, this.maxAttempts - failures) };
  }

  reset(key: string): void {
    if (key) this.records.delete(key);
  }
}

export function ensureAuthSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      pinHash TEXT NOT NULL,
      pinSalt TEXT NOT NULL,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      lastLoginAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_app_users_name_lower ON app_users (LOWER(TRIM(name)));

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      tokenHash TEXT NOT NULL UNIQUE,
      deviceId TEXT,
      deviceName TEXT,
      userAgent TEXT,
      ip TEXT,
      createdAt TEXT NOT NULL,
      lastSeenAt TEXT NOT NULL,
      expiresAt TEXT,
      revokedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_user_sessions_userId ON user_sessions (userId);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_deviceId ON user_sessions (deviceId);
  `);

  try {
    const pwaCols = db.prepare('PRAGMA table_info(pwa_devices)').all() as Array<{ name: string }>;
    if (pwaCols.length > 0 && !pwaCols.some((c) => c.name === 'userId')) {
      db.exec('ALTER TABLE pwa_devices ADD COLUMN userId TEXT');
    }
  } catch {
    // pwa_devices might not exist yet if invoked standalone before initDatabase
  }
}

function mapUserRow(row: any): AppUserSummary {
  return {
    id: row.id,
    name: row.name,
    role: row.role === 'admin' ? 'admin' : 'user',
    isActive: row.isActive === 1 || row.isActive === true,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt || undefined,
    deviceCount: typeof row.deviceCount === 'number' ? row.deviceCount : undefined,
    activeSessionCount: typeof row.activeSessionCount === 'number' ? row.activeSessionCount : undefined,
  };
}

export function getActiveAdminCount(db: Database.Database): number {
  const row = db
    .prepare("SELECT COUNT(*) as cnt FROM app_users WHERE role = 'admin' AND isActive = 1")
    .get() as { cnt: number } | undefined;
  return Number(row?.cnt || 0);
}

export function isUsersConfigured(db: Database.Database): boolean {
  return getActiveAdminCount(db) > 0;
}

export function getRequireLoginForEdits(db: Database.Database): boolean {
  if (!isUsersConfigured(db)) {
    return false;
  }
  try {
    const row = db
      .prepare('SELECT value FROM app_config WHERE key = ?')
      .get(REQUIRE_LOGIN_FOR_EDITS_KEY) as { value?: string } | undefined;
    if (row && typeof row.value === 'string' && row.value.trim().toLowerCase() === 'false') {
      return false;
    }
  } catch {
    // app_config table might not exist in minimal unit-test schemas; default to true once configured
  }
  return true;
}

export function setRequireLoginForEdits(db: Database.Database, enabled: boolean): boolean {
  const now = new Date().toISOString();
  const val = enabled ? 'true' : 'false';
  db.prepare(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT,
      updatedAt TEXT
    )
  `).run();
  db.prepare(`
    INSERT INTO app_config (key, value, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
  `).run(REQUIRE_LOGIN_FOR_EDITS_KEY, val, now);
  return getRequireLoginForEdits(db);
}

export function listUsersSummary(db: Database.Database): AppUserSummary[] {
  const rows = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        u.role,
        u.isActive,
        u.createdAt,
        u.updatedAt,
        u.lastLoginAt,
        (SELECT COUNT(*) FROM pwa_devices d WHERE d.userId = u.id) as deviceCount,
        (SELECT COUNT(*) FROM user_sessions s WHERE s.userId = u.id AND s.revokedAt IS NULL) as activeSessionCount
      FROM app_users u
      ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, LOWER(u.name) ASC
    `)
    .all() as any[];
  return rows.map(mapUserRow);
}

export function listAvailableUsers(db: Database.Database): Array<{ id: string; name: string }> {
  const rows = db
    .prepare('SELECT id, name FROM app_users WHERE isActive = 1 ORDER BY LOWER(name) ASC')
    .all() as Array<{ id: string; name: string }>;
  return rows;
}

export function getUserById(db: Database.Database, userId: string): AppUserSummary | null {
  const row = db
    .prepare(`
      SELECT
        u.id,
        u.name,
        u.role,
        u.isActive,
        u.createdAt,
        u.updatedAt,
        u.lastLoginAt,
        (SELECT COUNT(*) FROM pwa_devices d WHERE d.userId = u.id) as deviceCount,
        (SELECT COUNT(*) FROM user_sessions s WHERE s.userId = u.id AND s.revokedAt IS NULL) as activeSessionCount
      FROM app_users u
      WHERE u.id = ?
    `)
    .get(userId) as any;
  return row ? mapUserRow(row) : null;
}

export function createUser(
  db: Database.Database,
  input: { name: string; role?: AppUserRole; pin: string; isActive?: boolean }
): AppUserSummary {
  const nameCheck = validateUsername(input.name);
  if (!nameCheck.valid) {
    throw new AuthError(nameCheck.error || 'Invalid name', 400, 'INVALID_NAME');
  }
  const pinCheck = validatePin(input.pin);
  if (!pinCheck.valid) {
    throw new AuthError(pinCheck.error || 'Invalid PIN', 400, 'INVALID_PIN');
  }

  const existing = db
    .prepare('SELECT id FROM app_users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))')
    .get(nameCheck.clean) as any;
  if (existing) {
    throw new AuthError(`A user named "${nameCheck.clean}" already exists.`, 409, 'DUPLICATE_USER');
  }

  const id = `usr_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const { hash, salt } = hashPin(pinCheck.clean);
  const role: AppUserRole = input.role === 'admin' ? 'admin' : 'user';
  const isActiveInt = input.isActive === false ? 0 : 1;

  db.prepare(`
    INSERT INTO app_users (id, name, role, pinHash, pinSalt, isActive, createdAt, updatedAt, lastLoginAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(id, nameCheck.clean, role, hash, salt, isActiveInt, now, now);

  return getUserById(db, id)!;
}

export function setupFirstAdmin(
  db: Database.Database,
  input: {
    name: string;
    pin: string;
    requireLoginForEdits?: boolean;
    deviceId?: string;
    deviceName?: string;
    clientDevice?: string;
    clientInfo?: string;
    isPwa?: boolean;
    ip?: string;
    userAgent?: string;
  }
): { user: AppUserSummary; sessionToken: string; session: UserSessionSummary; requireLoginForEdits: boolean } {
  return db.transaction(() => {
    if (getActiveAdminCount(db) > 0) {
      throw new AuthError('An active admin user already exists. Please sign in with an admin account.', 409, 'ALREADY_CONFIGURED');
    }

    const user = createUser(db, { name: input.name, role: 'admin', pin: input.pin, isActive: true });
    const now = new Date().toISOString();
    db.prepare('UPDATE app_users SET lastLoginAt = ? WHERE id = ?').run(now, user.id);

    const enforceLogin = input.requireLoginForEdits !== false;
    setRequireLoginForEdits(db, enforceLogin);

    if (input.deviceId && input.deviceId.trim()) {
      linkDeviceToUser(db, {
        deviceId: input.deviceId.trim(),
        userId: user.id,
        deviceName: input.deviceName,
        operatorName: user.name,
        clientDevice: input.clientDevice,
        clientInfo: input.clientInfo,
        isPwa: input.isPwa,
        ip: input.ip,
        userAgent: input.userAgent,
      });
    }

    const { sessionToken, session } = createSession(db, {
      userId: user.id,
      deviceId: input.deviceId?.trim(),
      deviceName: input.deviceName,
      userAgent: input.userAgent,
      ip: input.ip,
    });

    return {
      user: getUserById(db, user.id)!,
      sessionToken,
      session,
      requireLoginForEdits: enforceLogin,
    };
  })();
}

export function authenticateUserPin(
  db: Database.Database,
  input: { name: string; pin: string }
): AppUserSummary | null {
  const cleanName = normalizeUsername(input.name);
  const cleanPin = String(input.pin ?? '').trim();
  if (!cleanName || !cleanPin) return null;

  const row = db
    .prepare('SELECT * FROM app_users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))')
    .get(cleanName) as any;

  if (!row || row.isActive !== 1) return null;
  if (!verifyPin(cleanPin, row.pinHash, row.pinSalt)) return null;

  const now = new Date().toISOString();
  db.prepare('UPDATE app_users SET lastLoginAt = ?, updatedAt = ? WHERE id = ?').run(now, now, row.id);
  return getUserById(db, row.id);
}

export function createSession(
  db: Database.Database,
  input: { userId: string; deviceId?: string; deviceName?: string; userAgent?: string; ip?: string; expiresAt?: string | null }
): { sessionToken: string; session: UserSessionSummary } {
  const id = `ses_${crypto.randomUUID()}`;
  const sessionToken = generateSessionToken();
  const tokenHash = hashSessionToken(sessionToken);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO user_sessions (id, userId, tokenHash, deviceId, deviceName, userAgent, ip, createdAt, lastSeenAt, expiresAt, revokedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    id,
    input.userId,
    tokenHash,
    input.deviceId || null,
    input.deviceName || null,
    input.userAgent || null,
    input.ip || null,
    now,
    now,
    input.expiresAt || null
  );

  const user = getUserById(db, input.userId);
  return {
    sessionToken,
    session: {
      id,
      userId: input.userId,
      userName: user?.name,
      userRole: user?.role,
      deviceId: input.deviceId || undefined,
      deviceName: input.deviceName || undefined,
      userAgent: input.userAgent || undefined,
      ip: input.ip || undefined,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: input.expiresAt || undefined,
      isCurrentSession: true,
    },
  };
}

export function resolveSessionToken(
  db: Database.Database,
  rawToken?: string | null
): { user: AppUserSummary; session: UserSessionSummary } | null {
  if (!rawToken || typeof rawToken !== 'string' || !rawToken.trim()) return null;
  const tokenHash = hashSessionToken(rawToken.trim());
  const row = db
    .prepare(`
      SELECT
        s.id as ses_id,
        s.userId as ses_userId,
        s.deviceId as ses_deviceId,
        s.deviceName as ses_deviceName,
        s.userAgent as ses_userAgent,
        s.ip as ses_ip,
        s.createdAt as ses_createdAt,
        s.lastSeenAt as ses_lastSeenAt,
        s.expiresAt as ses_expiresAt,
        s.revokedAt as ses_revokedAt,
        u.id as usr_id,
        u.name as usr_name,
        u.role as usr_role,
        u.isActive as usr_isActive,
        u.createdAt as usr_createdAt,
        u.updatedAt as usr_updatedAt,
        u.lastLoginAt as usr_lastLoginAt
      FROM user_sessions s
      JOIN app_users u ON u.id = s.userId
      WHERE s.tokenHash = ?
    `)
    .get(tokenHash) as any;

  if (!row) return null;
  if (row.ses_revokedAt) return null;
  if (row.usr_isActive !== 1) return null;
  if (row.ses_expiresAt && Date.parse(row.ses_expiresAt) < Date.now()) {
    return null;
  }

  // Throttle lastSeenAt updates (at most once per 30 seconds per session)
  const lastSeenMs = Date.parse(row.ses_lastSeenAt || '') || 0;
  const now = new Date();
  if (now.getTime() - lastSeenMs > 30_000) {
    try {
      db.prepare('UPDATE user_sessions SET lastSeenAt = ? WHERE id = ?').run(now.toISOString(), row.ses_id);
    } catch {
      // Ignore concurrent lock
    }
  }

  return {
    user: {
      id: row.usr_id,
      name: row.usr_name,
      role: row.usr_role === 'admin' ? 'admin' : 'user',
      isActive: row.usr_isActive === 1,
      createdAt: row.usr_createdAt,
      updatedAt: row.usr_updatedAt,
      lastLoginAt: row.usr_lastLoginAt || undefined,
    },
    session: {
      id: row.ses_id,
      userId: row.ses_userId,
      userName: row.usr_name,
      userRole: row.usr_role === 'admin' ? 'admin' : 'user',
      deviceId: row.ses_deviceId || undefined,
      deviceName: row.ses_deviceName || undefined,
      userAgent: row.ses_userAgent || undefined,
      ip: row.ses_ip || undefined,
      createdAt: row.ses_createdAt,
      lastSeenAt: row.ses_lastSeenAt,
      expiresAt: row.ses_expiresAt || undefined,
      revokedAt: row.ses_revokedAt || undefined,
      isCurrentSession: true,
    },
  };
}

export function revokeSession(db: Database.Database, sessionId: string): boolean {
  const now = new Date().toISOString();
  const info = db
    .prepare('UPDATE user_sessions SET revokedAt = ? WHERE id = ? AND revokedAt IS NULL')
    .run(now, sessionId);
  return info.changes > 0;
}

export function revokeSessionByToken(db: Database.Database, rawToken: string): boolean {
  if (!rawToken || !rawToken.trim()) return false;
  const tokenHash = hashSessionToken(rawToken.trim());
  const now = new Date().toISOString();
  const info = db
    .prepare('UPDATE user_sessions SET revokedAt = ? WHERE tokenHash = ? AND revokedAt IS NULL')
    .run(now, tokenHash);
  return info.changes > 0;
}

export function revokeAllSessionsForUser(db: Database.Database, userId: string): number {
  const now = new Date().toISOString();
  const info = db
    .prepare('UPDATE user_sessions SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL')
    .run(now, userId);
  return info.changes;
}

export function revokeSessionsForDevice(db: Database.Database, deviceId: string, userId?: string): number {
  const now = new Date().toISOString();
  if (userId) {
    const info = db
      .prepare('UPDATE user_sessions SET revokedAt = ? WHERE deviceId = ? AND userId = ? AND revokedAt IS NULL')
      .run(now, deviceId, userId);
    return info.changes;
  }
  const info = db
    .prepare('UPDATE user_sessions SET revokedAt = ? WHERE deviceId = ? AND revokedAt IS NULL')
    .run(now, deviceId);
  return info.changes;
}

export function listSessionsSummary(db: Database.Database, opts?: { userId?: string; currentSessionId?: string | null; includeRevoked?: boolean }): UserSessionSummary[] {
  const whereParts: string[] = [];
  const params: any[] = [];
  if (opts?.userId) {
    whereParts.push('s.userId = ?');
    params.push(opts.userId);
  }
  if (!opts?.includeRevoked) {
    whereParts.push('s.revokedAt IS NULL');
  }
  const whereSql = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  const rows = db
    .prepare(`
      SELECT s.*, u.name as userName, u.role as userRole
      FROM user_sessions s
      LEFT JOIN app_users u ON u.id = s.userId
      ${whereSql}
      ORDER BY s.lastSeenAt DESC
    `)
    .all(...params) as any[];

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    userName: row.userName || undefined,
    userRole: row.userRole === 'admin' ? 'admin' : row.userRole === 'user' ? 'user' : undefined,
    deviceId: row.deviceId || undefined,
    deviceName: row.deviceName || undefined,
    userAgent: row.userAgent || undefined,
    ip: row.ip || undefined,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt || undefined,
    revokedAt: row.revokedAt || undefined,
    isCurrentSession: Boolean(opts?.currentSessionId && row.id === opts.currentSessionId),
  }));
}

export function updateUser(
  db: Database.Database,
  userId: string,
  updates: { name?: string; role?: AppUserRole; isActive?: boolean }
): AppUserSummary {
  return db.transaction(() => {
    const current = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as any;
    if (!current) {
      throw new AuthError('User not found.', 404, 'USER_NOT_FOUND');
    }

    let nextName = current.name;
    if (updates.name !== undefined) {
      const check = validateUsername(updates.name);
      if (!check.valid) throw new AuthError(check.error || 'Invalid name', 400, 'INVALID_NAME');
      const dup = db
        .prepare('SELECT id FROM app_users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) AND id != ?')
        .get(check.clean, userId) as any;
      if (dup) {
        throw new AuthError(`A user named "${check.clean}" already exists.`, 409, 'DUPLICATE_USER');
      }
      nextName = check.clean;
    }

    const nextRole: AppUserRole =
      updates.role !== undefined ? (updates.role === 'admin' ? 'admin' : 'user') : (current.role === 'admin' ? 'admin' : 'user');
    const nextIsActive = updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : current.isActive;

    const wasActiveAdmin = current.role === 'admin' && current.isActive === 1;
    const willBeActiveAdmin = nextRole === 'admin' && nextIsActive === 1;
    if (wasActiveAdmin && !willBeActiveAdmin) {
      const activeAdmins = getActiveAdminCount(db);
      if (activeAdmins <= 1) {
        throw new AuthError(
          'Cannot demote or deactivate the last active admin user.',
          400,
          'LAST_ADMIN_PROTECTED'
        );
      }
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE app_users
      SET name = ?, role = ?, isActive = ?, updatedAt = ?
      WHERE id = ?
    `).run(nextName, nextRole, nextIsActive, now, userId);

    if (nextName !== current.name) {
      try {
        db.prepare('UPDATE pwa_devices SET operator = ? WHERE userId = ?').run(nextName, userId);
      } catch {
        // Ignore if pwa_devices lacks rows
      }
    }

    if (nextIsActive === 0) {
      revokeAllSessionsForUser(db, userId);
    }

    return getUserById(db, userId)!;
  })();
}

export function resetUserPin(db: Database.Database, userId: string, newPin: string): AppUserSummary {
  const existing = db.prepare('SELECT id FROM app_users WHERE id = ?').get(userId) as any;
  if (!existing) {
    throw new AuthError('User not found.', 404, 'USER_NOT_FOUND');
  }
  const pinCheck = validatePin(newPin);
  if (!pinCheck.valid) {
    throw new AuthError(pinCheck.error || 'Invalid PIN', 400, 'INVALID_PIN');
  }

  const { hash, salt } = hashPin(pinCheck.clean);
  const now = new Date().toISOString();
  db.prepare('UPDATE app_users SET pinHash = ?, pinSalt = ?, updatedAt = ? WHERE id = ?').run(hash, salt, now, userId);
  return getUserById(db, userId)!;
}

export function changeOwnPin(
  db: Database.Database,
  userId: string,
  currentPin: string,
  newPin: string
): AppUserSummary {
  const row = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as any;
  if (!row || row.isActive !== 1) {
    throw new AuthError('Active user not found.', 404, 'USER_NOT_FOUND');
  }
  if (!verifyPin(currentPin, row.pinHash, row.pinSalt)) {
    throw new AuthError('Current PIN is incorrect.', 403, 'INVALID_CURRENT_PIN');
  }
  const pinCheck = validatePin(newPin);
  if (!pinCheck.valid) {
    throw new AuthError(pinCheck.error || 'Invalid PIN', 400, 'INVALID_PIN');
  }
  const { hash, salt } = hashPin(pinCheck.clean);
  const now = new Date().toISOString();
  db.prepare('UPDATE app_users SET pinHash = ?, pinSalt = ?, updatedAt = ? WHERE id = ?').run(hash, salt, now, userId);
  return getUserById(db, userId)!;
}

export function deleteUser(db: Database.Database, userId: string): boolean {
  return db.transaction(() => {
    const current = db.prepare('SELECT * FROM app_users WHERE id = ?').get(userId) as any;
    if (!current) {
      throw new AuthError('User not found.', 404, 'USER_NOT_FOUND');
    }
    if (current.role === 'admin' && current.isActive === 1) {
      const activeAdmins = getActiveAdminCount(db);
      if (activeAdmins <= 1) {
        throw new AuthError('Cannot delete the last active admin user.', 400, 'LAST_ADMIN_PROTECTED');
      }
    }

    db.prepare('DELETE FROM user_sessions WHERE userId = ?').run(userId);
    try {
      db.prepare('UPDATE pwa_devices SET userId = NULL WHERE userId = ?').run(userId);
    } catch {
      // ignore if table absent
    }
    const info = db.prepare('DELETE FROM app_users WHERE id = ?').run(userId);
    return info.changes > 0;
  })();
}

export function linkDeviceToUser(
  db: Database.Database,
  input: {
    deviceId: string;
    userId: string;
    deviceName?: string;
    operatorName?: string;
    clientDevice?: string;
    clientInfo?: string;
    isPwa?: boolean;
    ip?: string;
    userAgent?: string;
  }
): void {
  const cleanId = String(input.deviceId || '').trim();
  if (!cleanId) return;
  const now = new Date().toISOString();
  const existing = db.prepare('SELECT * FROM pwa_devices WHERE id = ?').get(cleanId) as any;
  const user = getUserById(db, input.userId);
  const opName = input.operatorName || user?.name || '';

  if (existing) {
    db.prepare(`
      UPDATE pwa_devices
      SET userId = ?,
          operator = CASE WHEN ? != '' THEN ? ELSE operator END,
          name = CASE WHEN ? != '' THEN ? ELSE name END,
          clientDevice = COALESCE(NULLIF(?, ''), clientDevice),
          clientInfo = COALESCE(NULLIF(?, ''), clientInfo),
          isPwa = COALESCE(?, isPwa),
          lastSeen = ?,
          lastIp = COALESCE(NULLIF(?, ''), lastIp),
          userAgent = COALESCE(NULLIF(?, ''), userAgent)
      WHERE id = ?
    `).run(
      input.userId,
      opName,
      opName,
      (input.deviceName || '').trim(),
      (input.deviceName || '').trim(),
      input.clientDevice || '',
      input.clientInfo || '',
      input.isPwa === undefined ? null : input.isPwa ? 1 : 0,
      now,
      input.ip || '',
      input.userAgent || '',
      cleanId
    );
  } else {
    const cleanName = (input.deviceName || '').trim() || input.clientDevice || 'PWA Device';
    db.prepare(`
      INSERT INTO pwa_devices (id, name, operator, userId, deviceType, clientDevice, clientInfo, isPwa, firstSeen, lastSeen, lastIp, userAgent, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'authorized', '')
    `).run(
      cleanId,
      cleanName,
      opName,
      input.userId,
      input.clientInfo || input.clientDevice || 'Web Browser',
      input.clientDevice || 'Web Browser',
      input.clientInfo || '',
      input.isPwa ? 1 : 0,
      now,
      now,
      input.ip || '',
      input.userAgent || ''
    );
  }
}

export function listDevicesForUser(
  db: Database.Database,
  userId: string,
  currentDeviceId?: string,
  onlineDeviceIds?: Set<string>
): PwaDevice[] {
  const rows = db
    .prepare('SELECT * FROM pwa_devices WHERE userId = ? ORDER BY lastSeen DESC')
    .all(userId) as any[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    operator: row.operator || undefined,
    userId: row.userId || undefined,
    deviceType: row.deviceType || undefined,
    clientDevice: row.clientDevice || undefined,
    clientInfo: row.clientInfo || undefined,
    isPwa: row.isPwa === 1 || row.isPwa === true,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    lastIp: row.lastIp || undefined,
    userAgent: row.userAgent || undefined,
    status: row.status === 'revoked' ? 'revoked' : 'authorized',
    notes: row.notes || undefined,
    isCurrentDevice: Boolean(currentDeviceId && row.id === currentDeviceId),
    isOnline: Boolean(onlineDeviceIds && onlineDeviceIds.has(row.id)),
  }));
}

export function assertDeviceOwnedByUser(db: Database.Database, deviceId: string, userId: string): any {
  const device = db.prepare('SELECT * FROM pwa_devices WHERE id = ?').get(deviceId) as any;
  if (!device) {
    throw new AuthError('Device not found.', 404, 'DEVICE_NOT_FOUND');
  }
  if (!device.userId || device.userId !== userId) {
    throw new AuthError('You do not have permission to manage this device.', 403, 'DEVICE_FORBIDDEN');
  }
  return device;
}

function mapDeviceRow(row: any, currentDeviceId?: string, onlineDeviceIds?: Set<string>): PwaDevice {
  return {
    id: row.id,
    name: row.name,
    operator: row.operator || undefined,
    userId: row.userId || undefined,
    deviceType: row.deviceType || undefined,
    clientDevice: row.clientDevice || undefined,
    clientInfo: row.clientInfo || undefined,
    isPwa: row.isPwa === 1 || row.isPwa === true,
    firstSeen: row.firstSeen,
    lastSeen: row.lastSeen,
    lastIp: row.lastIp || undefined,
    userAgent: row.userAgent || undefined,
    status: row.status === 'revoked' ? 'revoked' : 'authorized',
    notes: row.notes || undefined,
    isCurrentDevice: Boolean(currentDeviceId && row.id === currentDeviceId),
    isOnline: Boolean(onlineDeviceIds && onlineDeviceIds.has(row.id)),
  };
}

export function listLegacyUnlinkedGroups(
  db: Database.Database,
  currentDeviceId?: string,
  onlineDeviceIds?: Set<string>
): LegacyOperatorGroup[] {
  const rows = db
    .prepare(`
      SELECT *
      FROM pwa_devices
      WHERE userId IS NULL
         OR TRIM(userId) = ''
         OR userId NOT IN (SELECT id FROM app_users)
      ORDER BY lastSeen DESC
    `)
    .all() as any[];

  if (rows.length === 0) return [];

  const users = db.prepare('SELECT id, name FROM app_users').all() as Array<{ id: string; name: string }>;
  const userByLowerName = new Map<string, { id: string; name: string }>();
  for (const u of users) {
    userByLowerName.set(normalizeUsername(u.name).toLowerCase(), u);
  }

  const groupMap = new Map<string, { rawName: string; devices: PwaDevice[] }>();
  for (const row of rows) {
    const cleanOp = normalizeUsername(row.operator || '');
    const key = cleanOp ? cleanOp.toLowerCase() : '__unassigned__';
    if (!groupMap.has(key)) {
      groupMap.set(key, { rawName: cleanOp, devices: [] });
    }
    groupMap.get(key)!.devices.push(mapDeviceRow(row, currentDeviceId, onlineDeviceIds));
  }

  const result: LegacyOperatorGroup[] = Array.from(groupMap.entries()).map(([key, value]) => {
    const isUnassigned = key === '__unassigned__';
    const matchingUser = !isUnassigned ? userByLowerName.get(key) : undefined;
    return {
      operatorKey: key,
      displayName: isUnassigned ? 'Unassigned / Anonymous' : value.rawName,
      isUnassigned,
      deviceCount: value.devices.length,
      devices: value.devices,
      matchingUserId: matchingUser?.id,
      matchingUserName: matchingUser?.name,
    };
  });

  result.sort((a, b) => {
    if (a.isUnassigned && !b.isUnassigned) return 1;
    if (!a.isUnassigned && b.isUnassigned) return -1;
    return a.displayName.localeCompare(b.displayName);
  });

  return result;
}

function findUnlinkedDevicesForOperatorKey(db: Database.Database, sourceOperatorKey: string, deviceIds?: string[]): any[] {
  const allUnlinked = db
    .prepare(`
      SELECT *
      FROM pwa_devices
      WHERE userId IS NULL
         OR TRIM(userId) = ''
         OR userId NOT IN (SELECT id FROM app_users)
    `)
    .all() as any[];

  const idSet = Array.isArray(deviceIds) && deviceIds.length > 0 ? new Set(deviceIds.map((d) => String(d).trim())) : null;
  if (idSet) {
    return allUnlinked.filter((d) => idSet.has(d.id));
  }

  const normalizedKey = normalizeUsername(sourceOperatorKey || '').toLowerCase();
  return allUnlinked.filter((d) => {
    const opKey = normalizeUsername(d.operator || '').toLowerCase() || '__unassigned__';
    return opKey === (normalizedKey || '__unassigned__');
  });
}

export function migrateLegacyOperatorToUser(
  db: Database.Database,
  input: {
    sourceOperatorKey: string;
    newName?: string;
    role?: AppUserRole;
    pin: string;
    isActive?: boolean;
    deviceIds?: string[];
  }
): { user: AppUserSummary; migratedDeviceCount: number } {
  return db.transaction(() => {
    const targets = findUnlinkedDevicesForOperatorKey(db, input.sourceOperatorKey, input.deviceIds);
    const fallbackName =
      input.sourceOperatorKey && input.sourceOperatorKey !== '__unassigned__'
        ? normalizeUsername(targets[0]?.operator || input.sourceOperatorKey)
        : '';
    const finalName = normalizeUsername(input.newName || fallbackName);
    const user = createUser(db, {
      name: finalName,
      role: input.role === 'admin' ? 'admin' : 'user',
      pin: input.pin,
      isActive: input.isActive,
    });

    if (targets.length > 0) {
      const stmt = db.prepare('UPDATE pwa_devices SET userId = ?, operator = ? WHERE id = ?');
      for (const dev of targets) {
        stmt.run(user.id, user.name, dev.id);
      }
    }

    return {
      user: getUserById(db, user.id)!,
      migratedDeviceCount: targets.length,
    };
  })();
}

export function linkLegacyOperatorToUser(
  db: Database.Database,
  input: {
    sourceOperatorKey?: string;
    targetUserId: string;
    deviceIds?: string[];
  }
): { user: AppUserSummary; linkedDeviceCount: number } {
  return db.transaction(() => {
    const targetUser = getUserById(db, input.targetUserId);
    if (!targetUser) {
      throw new AuthError('Target user account not found.', 404, 'USER_NOT_FOUND');
    }

    const targets = findUnlinkedDevicesForOperatorKey(db, input.sourceOperatorKey || '__unassigned__', input.deviceIds);
    if (targets.length > 0) {
      const stmt = db.prepare('UPDATE pwa_devices SET userId = ?, operator = ? WHERE id = ?');
      for (const dev of targets) {
        stmt.run(targetUser.id, targetUser.name, dev.id);
      }
    }

    return {
      user: getUserById(db, targetUser.id)!,
      linkedDeviceCount: targets.length,
    };
  })();
}

export function assignDeviceToUser(
  db: Database.Database,
  deviceId: string,
  targetUserId: string | null
): PwaDevice {
  return db.transaction(() => {
    const existing = db.prepare('SELECT * FROM pwa_devices WHERE id = ?').get(deviceId) as any;
    if (!existing) {
      throw new AuthError('Device not found.', 404, 'DEVICE_NOT_FOUND');
    }

    const cleanTargetUserId = targetUserId && String(targetUserId).trim() ? String(targetUserId).trim() : null;
    if (!cleanTargetUserId) {
      revokeSessionsForDevice(db, deviceId);
      db.prepare('UPDATE pwa_devices SET userId = NULL WHERE id = ?').run(deviceId);
    } else {
      const user = getUserById(db, cleanTargetUserId);
      if (!user) {
        throw new AuthError('Target user account not found.', 404, 'USER_NOT_FOUND');
      }
      if (existing.userId && existing.userId !== user.id) {
        revokeSessionsForDevice(db, deviceId, existing.userId);
      }
      db.prepare('UPDATE pwa_devices SET userId = ?, operator = ? WHERE id = ?').run(user.id, user.name, deviceId);
    }

    const updated = db.prepare('SELECT * FROM pwa_devices WHERE id = ?').get(deviceId) as any;
    return mapDeviceRow(updated);
  })();
}

