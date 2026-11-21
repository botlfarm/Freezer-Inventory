import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  createTestDatabase,
  seedSampleDatabase,
  restoreDatabaseSnapshot,
  TABLE_NAMES,
} from './test-harness';
import {
  ensureAuthSchema,
  validateUsername,
  validatePin,
  hashPin,
  verifyPin,
  PinRateLimiter,
  isUsersConfigured,
  setupFirstAdmin,
  authenticateUserPin,
  createSession,
  resolveSessionToken,
  revokeSession,
  revokeSessionsForDevice,
  revokeAllSessionsForUser,
  createUser,
  updateUser,
  resetUserPin,
  changeOwnPin,
  deleteUser,
  linkDeviceToUser,
  listDevicesForUser,
  assertDeviceOwnedByUser,
  listSessionsSummary,
  readRecoveryConfig,
  verifyRecoveryPin,
  getRequireLoginForEdits,
  setRequireLoginForEdits,
  listLegacyUnlinkedGroups,
  migrateLegacyOperatorToUser,
  linkLegacyOperatorToUser,
  assignDeviceToUser,
  AuthError,
  isHttpsRequest,
  buildSessionCookieHeader,
} from '../utils/userAuthServer';
import {
  getSessionToken,
  setSessionToken,
  clearSessionToken,
  getClientAuditHeaders,
} from '../utils/clientDevice';
import { runRecoveryCli } from '../scripts/admin-recovery';

describe('User Accounts, Salted PIN Auth, Device Isolation, Backups & Lockout Recovery', () => {
  let tempDir: string;
  let dbPath: string;
  let snapshotPath: string;
  let db: Database.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-user-auth-'));
    dbPath = path.join(tempDir, 'inventory.db');
    snapshotPath = path.join(tempDir, 'snapshot.db');
    db = createTestDatabase(dbPath);
    ensureAuthSchema(db);
  });

  afterEach(() => {
    try {
      if (db) db.close();
    } catch {}
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('validates usernames & PINs, hashes with unique salts via scrypt, and enforces PIN rate limiting', () => {
    expect(validateUsername('  Alice   Smith  ')).toEqual({ valid: true, clean: 'Alice Smith' });
    expect(validateUsername('   ').valid).toBe(false);
    expect(validateUsername('x'.repeat(65)).valid).toBe(false);

    expect(validatePin('123').valid).toBe(false);
    expect(validatePin('12 34').valid).toBe(false);
    expect(validatePin('12345678901234567').valid).toBe(false);
    expect(validatePin(' 2468 ').valid).toBe(true);

    const h1 = hashPin('2468');
    const h2 = hashPin('2468');
    expect(h1.salt).not.toBe(h2.salt);
    expect(h1.hash).not.toBe(h2.hash);
    expect(verifyPin('2468', h1.hash, h1.salt)).toBe(true);
    expect(verifyPin('9999', h1.hash, h1.salt)).toBe(false);

    const limiter = new PinRateLimiter(5, 60_000, 600_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 4; i++) {
      const res = limiter.recordFailure('dev-1:Alice', t0 + i * 100);
      expect(res.locked).toBe(false);
    }
    const fifth = limiter.recordFailure('dev-1:Alice', t0 + 500);
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfterSeconds).toBe(60);

    const blocked = limiter.check('dev-1:Alice', t0 + 10_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Expiry unlocks automatically
    const unlockedAfterWindow = limiter.check('dev-1:Alice', t0 + 500 + 60_001);
    expect(unlockedAfterWindow.allowed).toBe(true);

    // Explicit reset clears lock
    limiter.recordFailure('dev-1:Alice', t0 + 70_000);
    limiter.reset('dev-1:Alice');
    expect(limiter.check('dev-1:Alice', t0 + 70_100).allowed).toBe(true);
  });

  it('supports first-run bootstrap once and auto-links the setup device', () => {
    expect(isUsersConfigured(db)).toBe(false);

    const boot = setupFirstAdmin(db, {
      name: 'Farm Owner',
      pin: '4321',
      deviceId: 'dev-tablet-01',
      deviceName: 'Office Tablet',
      clientDevice: 'iPadOS',
      clientInfo: 'PWA Standalone',
      isPwa: true,
      ip: '192.168.1.10',
    });

    expect(isUsersConfigured(db)).toBe(true);
    expect(boot.user.name).toBe('Farm Owner');
    expect(boot.user.role).toBe('admin');
    expect(boot.user.isActive).toBe(true);
    expect(boot.sessionToken).toMatch(/^[a-f0-9]{64}$/);

    // Session token resolves without exposing pinHash/pinSalt/tokenHash
    const resolved = resolveSessionToken(db, boot.sessionToken);
    expect(resolved?.user.id).toBe(boot.user.id);
    expect((resolved?.user as any).pinHash).toBeUndefined();
    expect((resolved?.user as any).pinSalt).toBeUndefined();

    // Device was registered and owned by first admin
    const devices = listDevicesForUser(db, boot.user.id, 'dev-tablet-01');
    expect(devices).toHaveLength(1);
    expect(devices[0].id).toBe('dev-tablet-01');
    expect(devices[0].name).toBe('Office Tablet');
    expect(devices[0].userId).toBe(boot.user.id);
    expect(devices[0].isCurrentDevice).toBe(true);

    // Duplicate bootstrap must be rejected once an active admin exists
    expect(() =>
      setupFirstAdmin(db, { name: 'Second Admin', pin: '9999' })
    ).toThrowError(AuthError);
    try {
      setupFirstAdmin(db, { name: 'Second Admin', pin: '9999' });
    } catch (err: any) {
      expect(err.code).toBe('ALREADY_CONFIGURED');
      expect(err.statusCode).toBe(409);
    }
  });

  it('hashes session tokens in storage and rejects revoked, invalid, or deactivated sessions', () => {
    const admin = createUser(db, { name: 'Master Admin', role: 'admin', pin: '1111' });
    const staff = createUser(db, { name: 'Butcher Helper', role: 'user', pin: '2222' });

    expect(authenticateUserPin(db, { name: 'butcher helper', pin: '2222' })?.id).toBe(staff.id);
    expect(authenticateUserPin(db, { name: 'Butcher Helper', pin: 'wrong' })).toBeNull();

    const s1 = createSession(db, { userId: staff.id, deviceId: 'dev-a', deviceName: 'Phone A' });
    const s2 = createSession(db, { userId: staff.id, deviceId: 'dev-b', deviceName: 'Phone B' });

    // Database must store SHA-256 hash, never plaintext token
    const rawRow = db.prepare('SELECT tokenHash FROM user_sessions WHERE id = ?').get(s1.session.id) as any;
    expect(rawRow.tokenHash).not.toBe(s1.sessionToken);
    expect(rawRow.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    expect(resolveSessionToken(db, s1.sessionToken)?.user.id).toBe(staff.id);
    expect(resolveSessionToken(db, 'nonexistent-token')).toBeNull();

    // Revoking device dev-a invalidates s1 while leaving s2 active
    expect(revokeSessionsForDevice(db, 'dev-a', staff.id)).toBe(1);
    expect(resolveSessionToken(db, s1.sessionToken)).toBeNull();
    expect(resolveSessionToken(db, s2.sessionToken)?.session.id).toBe(s2.session.id);

    // Single session revoke invalidates s2
    expect(revokeSession(db, s2.session.id)).toBe(true);
    expect(resolveSessionToken(db, s2.sessionToken)).toBeNull();

    // Deactivating a user revokes all their remaining active sessions
    const s3 = createSession(db, { userId: staff.id, deviceId: 'dev-c' });
    expect(resolveSessionToken(db, s3.sessionToken)).not.toBeNull();
    updateUser(db, staff.id, { isActive: false });
    expect(resolveSessionToken(db, s3.sessionToken)).toBeNull();
    expect(authenticateUserPin(db, { name: 'Butcher Helper', pin: '2222' })).toBeNull();
    expect(admin.id).toBeTruthy();
  });

  it('enforces self-service PIN change verification and strict per-user device isolation', () => {
    const admin = createUser(db, { name: 'Admin One', role: 'admin', pin: '1111' });
    const alice = createUser(db, { name: 'Alice', role: 'user', pin: '2222' });
    const bob = createUser(db, { name: 'Bob', role: 'user', pin: '3333' });

    // Wrong current PIN fails with 403 INVALID_CURRENT_PIN
    try {
      changeOwnPin(db, alice.id, '0000', '4444');
      expect.unreachable('Expected INVALID_CURRENT_PIN');
    } catch (err: any) {
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('INVALID_CURRENT_PIN');
    }

    // Valid current PIN updates hash & verifies with new PIN
    changeOwnPin(db, alice.id, '2222', '4444');
    expect(authenticateUserPin(db, { name: 'Alice', pin: '2222' })).toBeNull();
    expect(authenticateUserPin(db, { name: 'Alice', pin: '4444' })?.id).toBe(alice.id);

    // Register devices for Alice, Bob, plus an unassigned legacy device
    linkDeviceToUser(db, { deviceId: 'dev-alice-1', userId: alice.id, deviceName: 'Alice iPhone' });
    linkDeviceToUser(db, { deviceId: 'dev-bob-1', userId: bob.id, deviceName: 'Bob Pixel' });
    db.prepare(`
      INSERT INTO pwa_devices (id, name, operator, firstSeen, lastSeen, status)
      VALUES ('dev-unowned', 'Shared Kiosk', '', '2026-01-01', '2026-01-01', 'authorized')
    `).run();

    const aliceDevices = listDevicesForUser(db, alice.id, 'dev-alice-1');
    expect(aliceDevices.map((d) => d.id)).toEqual(['dev-alice-1']);

    // Alice owns dev-alice-1, cannot manage Bob's device or unowned kiosk
    expect(assertDeviceOwnedByUser(db, 'dev-alice-1', alice.id).name).toBe('Alice iPhone');
    expect(() => assertDeviceOwnedByUser(db, 'dev-bob-1', alice.id)).toThrowError(AuthError);
    expect(() => assertDeviceOwnedByUser(db, 'dev-unowned', alice.id)).toThrowError(AuthError);
    try {
      assertDeviceOwnedByUser(db, 'dev-bob-1', alice.id);
    } catch (err: any) {
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('DEVICE_FORBIDDEN');
    }
    expect(admin.role).toBe('admin');
  });

  it('provides admin master control while protecting the last active admin against demotion, deactivation, or deletion', () => {
    const primaryAdmin = createUser(db, { name: 'Primary Admin', role: 'admin', pin: '1234' });
    const operator = createUser(db, { name: 'Worker', role: 'user', pin: '5678' });
    linkDeviceToUser(db, { deviceId: 'dev-worker', userId: operator.id, deviceName: 'Worker Scanner' });

    // Sole active admin cannot be demoted, deactivated, or deleted
    for (const action of [
      () => updateUser(db, primaryAdmin.id, { role: 'user' }),
      () => updateUser(db, primaryAdmin.id, { isActive: false }),
      () => deleteUser(db, primaryAdmin.id),
    ]) {
      try {
        action();
        expect.unreachable('Expected LAST_ADMIN_PROTECTED');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AuthError);
        expect(err.code).toBe('LAST_ADMIN_PROTECTED');
      }
    }

    // Renaming a user propagates to linked pwa_devices.operator
    const renamedWorker = updateUser(db, operator.id, { name: 'Lead Worker' });
    expect(renamedWorker.name).toBe('Lead Worker');
    const devRow = db.prepare('SELECT operator FROM pwa_devices WHERE id = ?').get('dev-worker') as any;
    expect(devRow.operator).toBe('Lead Worker');

    // Admin can promote Lead Worker to second active admin; then Primary Admin can be demoted
    updateUser(db, operator.id, { role: 'admin' });
    const demotedPrimary = updateUser(db, primaryAdmin.id, { role: 'user' });
    expect(demotedPrimary.role).toBe('user');

    // Admin can reset PIN and revoke all sessions
    const ses = createSession(db, { userId: primaryAdmin.id, deviceId: 'dev-old' });
    resetUserPin(db, primaryAdmin.id, '9876');
    expect(revokeAllSessionsForUser(db, primaryAdmin.id)).toBe(1);
    expect(resolveSessionToken(db, ses.sessionToken)).toBeNull();
    expect(authenticateUserPin(db, { name: 'Primary Admin', pin: '9876' })?.id).toBe(primaryAdmin.id);
    expect(listSessionsSummary(db, { userId: primaryAdmin.id }).length).toBe(0);
  });

  it('preserves app_users, user_sessions, and pwa_devices.userId across 25-table SQLite VACUUM backups and restores', () => {
    expect(TABLE_NAMES).toContain('app_users');
    expect(TABLE_NAMES).toContain('user_sessions');
    expect(TABLE_NAMES).toContain('notification_channels');
    expect(TABLE_NAMES).toContain('species_primals');
    expect(TABLE_NAMES.length).toBe(25);

    seedSampleDatabase(db);
    const boot = setupFirstAdmin(db, {
      name: 'Backup Admin',
      pin: '7777',
      deviceId: 'dev-backup-1',
      deviceName: 'Warehouse iPad',
    });
    const staff = createUser(db, { name: 'Floor Staff', role: 'user', pin: '8888' });
    linkDeviceToUser(db, { deviceId: 'dev-staff-1', userId: staff.id, deviceName: 'Floor Phone' });

    db.prepare('VACUUM INTO ?').run(snapshotPath);

    // Wipe auth and device tables
    db.prepare('DELETE FROM user_sessions').run();
    db.prepare('DELETE FROM app_users').run();
    db.prepare('DELETE FROM pwa_devices').run();
    expect(isUsersConfigured(db)).toBe(false);

    db.close();
    db = restoreDatabaseSnapshot(dbPath, snapshotPath);

    expect(isUsersConfigured(db)).toBe(true);
    expect(resolveSessionToken(db, boot.sessionToken)?.user.name).toBe('Backup Admin');
    expect(authenticateUserPin(db, { name: 'Floor Staff', pin: '8888' })?.id).toBe(staff.id);
    const restoredStaffDevices = listDevicesForUser(db, staff.id);
    expect(restoredStaffDevices).toHaveLength(1);
    expect(restoredStaffDevices[0].id).toBe('dev-staff-1');
  });

  it('parses Home Assistant / env recovery options cleanly and verifies recovery PIN safely', () => {
    const optionsFile = path.join(tempDir, 'options.json');
    fs.writeFileSync(
      optionsFile,
      JSON.stringify({ admin_recovery_mode: true, admin_recovery_pin: 'ha-rescue-99' }),
      'utf-8'
    );

    const haCfg = readRecoveryConfig({ optionsPath: optionsFile, env: {} });
    expect(haCfg.recoveryMode).toBe(true);
    expect(haCfg.recoveryPinConfigured).toBe(true);
    expect(haCfg.source).toBe('ha_options');
    expect(verifyRecoveryPin('ha-rescue-99', haCfg.recoveryPin)).toBe(true);
    expect(verifyRecoveryPin('wrong-pin', haCfg.recoveryPin)).toBe(false);

    // Environment variables override options.json
    const envCfg = readRecoveryConfig({
      optionsPath: optionsFile,
      env: { ADMIN_RECOVERY_MODE: 'true', ADMIN_RECOVERY_PIN: 'cli-override-42' },
    });
    expect(envCfg.source).toBe('env');
    expect(verifyRecoveryPin('cli-override-42', envCfg.recoveryPin)).toBe(true);
  });

  it('recovers locked-out non-HA admins via scripts/admin-recovery.ts CLI against any --db path', () => {
    // Locked-out scenario: single admin deactivated with forgotten PIN and active stale session
    const lockedAdmin = createUser(db, { name: 'LockedOwner', role: 'admin', pin: '1111' });
    const regularUser = createUser(db, { name: 'Packer', role: 'user', pin: '2222' });
    const staleSession = createSession(db, { userId: lockedAdmin.id, deviceId: 'dev-lost' });
    // Force deactivation at DB level (simulating corruption or edge lockout)
    db.prepare('UPDATE app_users SET isActive = 0 WHERE id = ?').run(lockedAdmin.id);
    db.close();

    // CLI commands operate on disk dbPath via --db
    expect(runRecoveryCli(['list', '--db', dbPath])).toBe(0);
    expect(runRecoveryCli(['reset-pin', 'LockedOwner', '5555', '--db', dbPath])).toBe(0);
    expect(runRecoveryCli(['revoke-sessions', 'LockedOwner', '--db', dbPath])).toBe(0);
    expect(runRecoveryCli(['promote', 'Packer', '--db', dbPath])).toBe(0);
    expect(runRecoveryCli(['create-admin', 'EmergencyAdmin', '6666', '--db', dbPath])).toBe(0);

    // Missing args return non-zero
    expect(runRecoveryCli(['create-admin', 'Incomplete', '--db', dbPath])).toBe(1);
    expect(runRecoveryCli(['unknown-cmd', '--db', dbPath])).toBe(1);

    db = new Database(dbPath);
    ensureAuthSchema(db);

    const recoveredOwner = authenticateUserPin(db, { name: 'LockedOwner', pin: '5555' });
    expect(recoveredOwner?.isActive).toBe(true);
    expect(recoveredOwner?.role).toBe('admin');
    expect(resolveSessionToken(db, staleSession.sessionToken)).toBeNull();

    const promotedPacker = authenticateUserPin(db, { name: 'Packer', pin: '2222' });
    expect(promotedPacker?.role).toBe('admin');

    const emergencyAdmin = authenticateUserPin(db, { name: 'EmergencyAdmin', pin: '6666' });
    expect(emergencyAdmin?.role).toBe('admin');
    expect(regularUser.id).toBeTruthy();
  });

  it('enforces configurable require_login_for_edits policy lifecycle and preserves it across SQLite backups', () => {
    // Before users are configured, login cannot block edits
    expect(isUsersConfigured(db)).toBe(false);
    expect(getRequireLoginForEdits(db)).toBe(false);

    // First-admin setup defaults requireLoginForEdits to true
    setupFirstAdmin(db, {
      name: 'Policy Admin',
      pin: '1234',
      deviceId: 'dev-policy-1',
    });
    expect(isUsersConfigured(db)).toBe(true);
    expect(getRequireLoginForEdits(db)).toBe(true);

    // Admin can toggle to Open Floor (false) and back to Protected (true)
    expect(setRequireLoginForEdits(db, false)).toBe(false);
    expect(getRequireLoginForEdits(db)).toBe(false);

    db.prepare('VACUUM INTO ?').run(snapshotPath);
    db.close();
    db = restoreDatabaseSnapshot(dbPath, snapshotPath);
    expect(getRequireLoginForEdits(db)).toBe(false);

    expect(setRequireLoginForEdits(db, true)).toBe(true);
    expect(getRequireLoginForEdits(db)).toBe(true);

    // Fresh DB with explicit requireLoginForEdits: false opt-out during setupFirstAdmin
    const optOutPath = path.join(tempDir, 'optout.db');
    const optOutDb = createTestDatabase(optOutPath);
    try {
      ensureAuthSchema(optOutDb);
      const res = setupFirstAdmin(optOutDb, {
        name: 'Kiosk Owner',
        pin: '5678',
        requireLoginForEdits: false,
      });
      expect(res.requireLoginForEdits).toBe(false);
      expect(getRequireLoginForEdits(optOutDb)).toBe(false);
    } finally {
      optOutDb.close();
    }
  });

  it('discovers legacy non-PIN operators, flags name matches, upgrades to PIN accounts, and links unowned devices cleanly', () => {
    const admin = createUser(db, { name: 'Admin', role: 'admin', pin: '1111' });
    const existingNick = createUser(db, { name: 'Nick', role: 'user', pin: '2222' });

    // Seed unlinked pwa_devices: two matching existing user "Nick" case-insensitively,
    // one new named legacy operator "Sarah" (including a revoked tablet),
    // one anonymous device, and one orphaned userId device
    db.prepare(`
      INSERT INTO pwa_devices (id, name, operator, userId, firstSeen, lastSeen, status)
      VALUES
        ('dev-nick-1', 'Nick iPhone', 'Nick', NULL, '2026-01-01', '2026-01-02', 'authorized'),
        ('dev-nick-2', 'Nick iPad', '  nick ', '', '2026-01-01', '2026-01-03', 'authorized'),
        ('dev-sarah-1', 'Sarah Pixel', 'Sarah', NULL, '2026-01-01', '2026-01-04', 'revoked'),
        ('dev-anon-1', 'Hallway Scanner', '', NULL, '2026-01-01', '2026-01-05', 'authorized'),
        ('dev-orphan-1', 'Old Tablet', 'Deleted User', 'usr_deleted_missing', '2026-01-01', '2026-01-06', 'authorized')
    `).run();

    const groups = listLegacyUnlinkedGroups(db, 'dev-sarah-1');
    expect(groups.map((g) => g.operatorKey)).toEqual(['deleted user', 'nick', 'sarah', '__unassigned__']);

    const nickGroup = groups.find((g) => g.operatorKey === 'nick')!;
    expect(nickGroup.deviceCount).toBe(2);
    expect(nickGroup.matchingUserId).toBe(existingNick.id);
    expect(nickGroup.matchingUserName).toBe('Nick');

    const sarahGroup = groups.find((g) => g.operatorKey === 'sarah')!;
    expect(sarahGroup.matchingUserId).toBeUndefined();
    expect(sarahGroup.devices[0].isCurrentDevice).toBe(true);

    const anonGroup = groups.find((g) => g.operatorKey === '__unassigned__')!;
    expect(anonGroup.isUnassigned).toBe(true);
    expect(anonGroup.deviceCount).toBe(1);

    // Link all Nick devices to the existing Nick PIN account
    const linkedNick = linkLegacyOperatorToUser(db, {
      sourceOperatorKey: 'nick',
      targetUserId: existingNick.id,
    });
    expect(linkedNick.linkedDeviceCount).toBe(2);
    expect(listDevicesForUser(db, existingNick.id).map((d) => d.id).sort()).toEqual(['dev-nick-1', 'dev-nick-2']);
    const nickSecondRow = db.prepare('SELECT operator FROM pwa_devices WHERE id = ?').get('dev-nick-2') as any;
    expect(nickSecondRow.operator).toBe('Nick');

    // Upgrade Sarah into a brand new PIN account; revoked device stays revoked
    const upgradedSarah = migrateLegacyOperatorToUser(db, {
      sourceOperatorKey: 'sarah',
      newName: 'Sarah',
      role: 'user',
      pin: '4567',
    });
    expect(upgradedSarah.migratedDeviceCount).toBe(1);
    expect(upgradedSarah.user.role).toBe('user');
    expect(authenticateUserPin(db, { name: 'Sarah', pin: '4567' })?.id).toBe(upgradedSarah.user.id);
    const sarahDevRow = db.prepare('SELECT userId, status FROM pwa_devices WHERE id = ?').get('dev-sarah-1') as any;
    expect(sarahDevRow.userId).toBe(upgradedSarah.user.id);
    expect(sarahDevRow.status).toBe('revoked');

    // Link remaining anonymous & orphaned devices cleanly and verify queue drains
    linkLegacyOperatorToUser(db, { sourceOperatorKey: '__unassigned__', targetUserId: admin.id });
    linkLegacyOperatorToUser(db, { sourceOperatorKey: 'deleted user', targetUserId: admin.id });
    expect(listLegacyUnlinkedGroups(db)).toEqual([]);
  });

  it('reassigns individual devices between users, unlinks cleanly, and revokes prior-owner sessions', () => {
    const alice = createUser(db, { name: 'Alice', role: 'admin', pin: '1111' });
    const bob = createUser(db, { name: 'Bob', role: 'user', pin: '2222' });

    linkDeviceToUser(db, { deviceId: 'dev-shared', userId: alice.id, deviceName: 'Cooler iPad' });
    const aliceSession = createSession(db, { userId: alice.id, deviceId: 'dev-shared', deviceName: 'Cooler iPad' });
    const aliceOtherSession = createSession(db, { userId: alice.id, deviceId: 'dev-alice-phone', deviceName: 'Alice Phone' });
    expect(resolveSessionToken(db, aliceSession.sessionToken)).not.toBeNull();

    // Reassigning dev-shared from Alice -> Bob revokes Alice's session on dev-shared but preserves Alice's other device session
    const reassigned = assignDeviceToUser(db, 'dev-shared', bob.id);
    expect(reassigned.userId).toBe(bob.id);
    expect(reassigned.operator).toBe('Bob');
    expect(resolveSessionToken(db, aliceSession.sessionToken)).toBeNull();
    expect(resolveSessionToken(db, aliceOtherSession.sessionToken)).not.toBeNull();
    expect(listDevicesForUser(db, bob.id).map((d) => d.id)).toEqual(['dev-shared']);

    // Start a session for Bob on dev-shared, then unlink device -> Bob's session is revoked & userId cleared
    const bobSession = createSession(db, { userId: bob.id, deviceId: 'dev-shared', deviceName: 'Cooler iPad' });
    const unlinked = assignDeviceToUser(db, 'dev-shared', null);
    expect(unlinked.userId).toBeUndefined();
    expect(resolveSessionToken(db, bobSession.sessionToken)).toBeNull();

    // Missing device or user throws typed AuthError
    expect(() => assignDeviceToUser(db, 'nonexistent-dev', bob.id)).toThrowError(AuthError);
    expect(() => assignDeviceToUser(db, 'dev-shared', 'usr_missing')).toThrowError(AuthError);
  });

  it('emits SameSite=None; Secure cookies on HTTPS/proxy/iframe requests and SameSite=Lax on plain HTTP', () => {
    expect(isHttpsRequest({ secure: true })).toBe(true);
    expect(isHttpsRequest({ headers: { 'x-forwarded-proto': 'https, http' } })).toBe(true);
    expect(isHttpsRequest({ headers: { 'x-forwarded-ssl': 'on' } })).toBe(true);
    expect(isHttpsRequest({ headers: { origin: 'https://preview.run.app' } })).toBe(true);
    expect(isHttpsRequest({ headers: { 'x-forwarded-proto': 'http', origin: 'http://homeassistant.local:8123' } })).toBe(false);

    const httpsCookie = buildSessionCookieHeader({ token: 'tok_abc+1', isHttps: true, maxAgeSeconds: 3600 });
    expect(httpsCookie).toContain('freezer_user_session=tok_abc%2B1');
    expect(httpsCookie).toContain('HttpOnly; SameSite=None; Secure; Path=/; Max-Age=3600');

    const httpCookie = buildSessionCookieHeader({ token: 'tok_abc', isHttps: false, maxAgeSeconds: 3600 });
    expect(httpCookie).toContain('HttpOnly; SameSite=Lax; Path=/; Max-Age=3600');
    expect(httpCookie).not.toContain('SameSite=None');

    const clearedHttps = buildSessionCookieHeader({ token: '', isHttps: true, maxAgeSeconds: 0 });
    expect(clearedHttps).toBe('freezer_user_session=; HttpOnly; SameSite=None; Secure; Path=/; Max-Age=0');
  });

  it('persists X-User-Session token in memory and sessionStorage fallback even when localStorage is blocked', () => {
    const origLocal = (globalThis as any).localStorage;
    const origSession = (globalThis as any).sessionStorage;

    const sessionStore = new Map<string, string>();
    (globalThis as any).localStorage = {
      getItem: () => {
        throw new Error('SecurityError: blocked in third-party iframe');
      },
      setItem: () => {
        throw new Error('SecurityError: blocked in third-party iframe');
      },
      removeItem: () => {
        throw new Error('SecurityError: blocked in third-party iframe');
      },
    };
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => sessionStore.get(k) ?? null,
      setItem: (k: string, v: string) => {
        sessionStore.set(k, String(v));
      },
      removeItem: (k: string) => {
        sessionStore.delete(k);
      },
    };

    try {
      clearSessionToken();
      expect(getSessionToken()).toBe('');

      setSessionToken('ses_iframe_token_123');
      expect(getSessionToken()).toBe('ses_iframe_token_123');
      expect(getClientAuditHeaders()['X-User-Session']).toBe('ses_iframe_token_123');

      // Even if sessionStorage is also wiped/unavailable, in-memory session survives menu transitions
      sessionStore.clear();
      expect(getSessionToken()).toBe('ses_iframe_token_123');

      clearSessionToken();
      expect(getSessionToken()).toBe('');
      expect(getClientAuditHeaders()['X-User-Session']).toBeUndefined();
    } finally {
      clearSessionToken();
      if (origLocal === undefined) delete (globalThis as any).localStorage;
      else (globalThis as any).localStorage = origLocal;
      if (origSession === undefined) delete (globalThis as any).sessionStorage;
      else (globalThis as any).sessionStorage = origSession;
    }
  });

  it('exposes App Version, Check Updates, and Refresh Cache in #sync-status-dropdown while moving Auto-Update Cache to admin per-device controls', () => {
    const appSource = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
    const syncDropdownIdx = appSource.indexOf('id="sync-status-dropdown"');
    const endDropdownIdx = appSource.indexOf('{/* Expanded Search & Filters Row */}', syncDropdownIdx);
    expect(syncDropdownIdx).toBeGreaterThan(-1);
    expect(endDropdownIdx).toBeGreaterThan(syncDropdownIdx);

    const dropdownSlice = appSource.slice(syncDropdownIdx, endDropdownIdx);
    expect(dropdownSlice).toContain('Database Freshness:');
    expect(dropdownSlice).toContain('App Version:');
    expect(dropdownSlice).toContain('v{APP_VERSION}');
    expect(dropdownSlice).not.toContain('Auto-Update Cache:');
    expect(dropdownSlice).toContain('Check Updates');
    expect(dropdownSlice).toContain('Refresh Cache');
    expect(dropdownSlice).toContain('handleSyncMenuCheckUpdates');
    expect(dropdownSlice).toContain('handleSyncMenuRefreshCache');

    // App.tsx defaults deviceAutoUpdateCache to true, strips legacy localStorage overrides, and listens for server/admin changes
    expect(appSource).toContain("localStorage.removeItem('pwa_auto_update_local')");
    expect(appSource).toContain("localStorage.removeItem('pwa_auto_update')");
    expect(appSource).toContain('const isAutoUpdateEnabled = deviceAutoUpdateCache;');
    expect(appSource).toContain("data.type === 'device_config_changed'");
    expect(appSource).toContain('deviceAutoUpdateCache');

    // LibraryView Settings removes global toggle and points admins to Users & Devices
    const librarySource = fs.readFileSync(path.resolve(__dirname, '../views/LibraryView.tsx'), 'utf-8');
    expect(librarySource).not.toContain('handleToggleAutoPwaUpdate');
    expect(librarySource).toContain('Auto by Default');
    expect(librarySource).toContain('Manage Per Device');

    // PwaDeviceManagerCard exposes per-device Auto/Manual controls backed by PUT /api/devices/:id
    const pwaCardSource = fs.readFileSync(path.resolve(__dirname, '../components/PwaDeviceManagerCard.tsx'), 'utf-8');
    expect(pwaCardSource).toContain('handleToggleAutoUpdateCache');
    expect(pwaCardSource).toContain("Auto-Update: Auto");
    expect(pwaCardSource).toContain("Auto-Update: Manual");
    expect(pwaCardSource).toContain('autoUpdateCache: modalAutoUpdateCache');

    // server.ts persists autoUpdateCache in pwa_devices, guards PUT /api/devices/:id with requireAdmin, and broadcasts SSE updates
    const serverSource = fs.readFileSync(path.resolve(__dirname, '../server.ts'), 'utf-8');
    expect(serverSource).toContain("app.put('/api/devices/:id', requireAdmin");
    expect(serverSource).toContain('autoUpdateDbVal');
    expect(serverSource).toContain("broadcastSSE({ type: 'device_config_changed', deviceId, autoUpdateCache: Boolean(autoUpdateCache) })");
    expect(serverSource).toContain('deviceAutoUpdateCache');
  });

  it('defaults pwa_devices.autoUpdateCache to Auto (1), preserves Auto vs Manual across SQLite VACUUM backups, and migrates NULL gracefully', () => {
    // New row inserted without specifying autoUpdateCache defaults to 1 (Auto)
    db.prepare(`
      INSERT INTO pwa_devices (id, name, operator, firstSeen, lastSeen, status)
      VALUES ('dev-auto-default', 'Default Tablet', 'Alice', '2026-01-01', '2026-01-01', 'authorized')
    `).run();
    const defaultRow = db.prepare('SELECT autoUpdateCache FROM pwa_devices WHERE id = ?').get('dev-auto-default') as any;
    expect(defaultRow.autoUpdateCache).toBe(1);

    // Explicitly switch a device to Manual (0) and keep another as Auto (1)
    db.prepare(`
      INSERT INTO pwa_devices (id, name, operator, firstSeen, lastSeen, status, autoUpdateCache)
      VALUES ('dev-manual-kiosk', 'Manual Kiosk', 'Bob', '2026-01-01', '2026-01-01', 'authorized', 0)
    `).run();

    // Simulate legacy pre-migration NULL value
    db.prepare(`
      INSERT INTO pwa_devices (id, name, operator, firstSeen, lastSeen, status, autoUpdateCache)
      VALUES ('dev-legacy-null', 'Legacy Device', '', '2026-01-01', '2026-01-01', 'authorized', NULL)
    `).run();

    db.prepare('VACUUM INTO ?').run(snapshotPath);
    db.prepare('DELETE FROM pwa_devices').run();
    db.close();
    db = restoreDatabaseSnapshot(dbPath, snapshotPath);

    const restoredDefault = db.prepare('SELECT autoUpdateCache FROM pwa_devices WHERE id = ?').get('dev-auto-default') as any;
    const restoredManual = db.prepare('SELECT autoUpdateCache FROM pwa_devices WHERE id = ?').get('dev-manual-kiosk') as any;
    const restoredNull = db.prepare('SELECT autoUpdateCache FROM pwa_devices WHERE id = ?').get('dev-legacy-null') as any;

    expect(restoredDefault.autoUpdateCache).toBe(1);
    expect(restoredManual.autoUpdateCache).toBe(0);
    // Application layer treats undefined/null as true (Auto)
    const resolveAutoUpdate = (val: number | null | undefined) => (val === undefined || val === null ? true : Boolean(val));
    expect(resolveAutoUpdate(restoredDefault.autoUpdateCache)).toBe(true);
    expect(resolveAutoUpdate(restoredManual.autoUpdateCache)).toBe(false);
    expect(resolveAutoUpdate(restoredNull.autoUpdateCache)).toBe(true);
  });
});


