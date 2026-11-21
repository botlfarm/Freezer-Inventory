import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';
import { createTestDatabase, seedSampleDatabase } from './test-harness';
import {
  readHaBackupRecoveryConfig,
  syncHaBackupSettingsToSnapshotConfig,
  validateBackupFilename,
  resolveSafeBackupPath,
  listFailsafeSnapshots,
  verifySqliteSnapshotFile,
} from '../utils/haBackupRecoveryConfig';

describe('Home Assistant Configure Parity & Failsafe Backup Recovery', () => {
  let tempDir: string;
  let optionsPath: string;
  let syncStatePath: string;
  let backupsDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-failsafe-'));
    optionsPath = path.join(tempDir, 'options.json');
    syncStatePath = path.join(tempDir, 'ha_backup_options_sync.json');
    backupsDir = path.join(tempDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });
  });

  afterEach(() => {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('reads Home Assistant options safely, clamps bounds, and supports env overrides', () => {
    const missing = readHaBackupRecoveryConfig({ optionsPath, env: {} });
    expect(missing.optionsPresent).toBe(false);
    expect(missing.backupRecoveryMode).toBe(false);
    expect(missing.recoveryPinConfigured).toBe(false);
    expect(missing.source).toBe('none');

    fs.writeFileSync(
      optionsPath,
      JSON.stringify({
        backup_recovery_mode: true,
        admin_recovery_pin: ' 4321 ',
        auto_db_backup_enabled: false,
        auto_db_backup_interval_days: 0,
        auto_db_backup_keep_count: 500,
        auto_db_backup_hour: 99,
        auto_zip_backup_enabled: true,
        auto_zip_backup_interval_days: 14,
        auto_zip_backup_keep_count: 99,
      }),
      'utf-8'
    );

    const parsed = readHaBackupRecoveryConfig({ optionsPath, env: {} });
    expect(parsed.optionsPresent).toBe(true);
    expect(parsed.backupRecoveryMode).toBe(true);
    expect(parsed.recoveryPin).toBe('4321');
    expect(parsed.recoveryPinConfigured).toBe(true);
    expect(parsed.source).toBe('ha_options');
    expect(parsed.haBackupOptions).toEqual({
      dbRollingEnabled: false,
      dbRollingIntervalDays: 1,
      dbRollingMaxCount: 90,
      dbBackupHour: 23,
      fullZipRollingEnabled: true,
      fullZipRollingIntervalDays: 14,
      fullZipRollingMaxCount: 30,
    });

    const envOverridden = readHaBackupRecoveryConfig({
      optionsPath: path.join(tempDir, 'nonexistent.json'),
      env: {
        BACKUP_RECOVERY_MODE: 'true',
        ADMIN_RECOVERY_PIN: '9988',
      },
    });
    expect(envOverridden.backupRecoveryMode).toBe(true);
    expect(envOverridden.recoveryPin).toBe('9988');
    expect(envOverridden.source).toBe('env');
  });

  it('preserves existing in-app backup schedule on upgrade and applies subsequent HA Configure edits', () => {
    // User already customized in-app schedules prior to upgrading add-on
    const existingInAppConfig = {
      dbRollingEnabled: true,
      dbRollingIntervalDays: 3,
      dbRollingMaxCount: 14,
      dbBackupHour: 4,
      fullZipRollingEnabled: false,
      fullZipRollingIntervalDays: 30,
      fullZipRollingMaxCount: 5,
      timezone: 'America/New_York',
    };

    // HA starts with default options from config.yaml
    fs.writeFileSync(
      optionsPath,
      JSON.stringify({
        auto_db_backup_enabled: true,
        auto_db_backup_interval_days: 1,
        auto_db_backup_keep_count: 7,
        auto_db_backup_hour: 2,
        auto_zip_backup_enabled: true,
        auto_zip_backup_interval_days: 7,
        auto_zip_backup_keep_count: 2,
      }),
      'utf-8'
    );

    // First run on existing install must NOT clobber user's in-app config
    const upgradeSync = syncHaBackupSettingsToSnapshotConfig({
      optionsPath,
      syncStatePath,
      currentSnapshotConfig: existingInAppConfig,
      hasExistingSnapshotConfig: true,
    });
    expect(upgradeSync.changed).toBe(false);
    expect(upgradeSync.nextConfig).toEqual(existingInAppConfig);
    expect(fs.existsSync(syncStatePath)).toBe(true);

    // Repeating with unchanged HA options stays a no-op
    const repeatSync = syncHaBackupSettingsToSnapshotConfig({
      optionsPath,
      syncStatePath,
      currentSnapshotConfig: existingInAppConfig,
      hasExistingSnapshotConfig: true,
    });
    expect(repeatSync.changed).toBe(false);

    // User subsequently changes auto_db_backup_hour and auto_zip_backup_enabled in HA Configure
    fs.writeFileSync(
      optionsPath,
      JSON.stringify({
        auto_db_backup_enabled: true,
        auto_db_backup_interval_days: 1,
        auto_db_backup_keep_count: 7,
        auto_db_backup_hour: 5,
        auto_zip_backup_enabled: true,
        auto_zip_backup_interval_days: 7,
        auto_zip_backup_keep_count: 4,
      }),
      'utf-8'
    );

    const editSync = syncHaBackupSettingsToSnapshotConfig({
      optionsPath,
      syncStatePath,
      currentSnapshotConfig: existingInAppConfig,
      hasExistingSnapshotConfig: true,
    });
    expect(editSync.changed).toBe(true);
    expect(editSync.syncedFromHa).toBe(true);
    expect(editSync.nextConfig.dbBackupHour).toBe(5);
    expect(editSync.nextConfig.fullZipRollingMaxCount).toBe(4);
    // Unchanged in-app custom fields remain untouched
    expect(editSync.nextConfig.dbRollingIntervalDays).toBe(3);
    expect(editSync.nextConfig.timezone).toBe('America/New_York');
  });

  it('adopts HA Configure backup schedule automatically on fresh install without existing config', () => {
    fs.writeFileSync(
      optionsPath,
      JSON.stringify({
        auto_db_backup_enabled: true,
        auto_db_backup_interval_days: 2,
        auto_db_backup_keep_count: 10,
        auto_db_backup_hour: 1,
        auto_zip_backup_enabled: false,
        auto_zip_backup_interval_days: 14,
        auto_zip_backup_keep_count: 3,
      }),
      'utf-8'
    );

    const defaults = {
      dbRollingEnabled: true,
      dbRollingIntervalDays: 1,
      dbRollingMaxCount: 7,
      dbBackupHour: 2,
      fullZipRollingEnabled: true,
      fullZipRollingIntervalDays: 7,
      fullZipRollingMaxCount: 2,
    };

    const fresh = syncHaBackupSettingsToSnapshotConfig({
      optionsPath,
      syncStatePath,
      currentSnapshotConfig: defaults,
      hasExistingSnapshotConfig: false,
    });

    expect(fresh.changed).toBe(true);
    expect(fresh.nextConfig).toEqual({
      dbRollingEnabled: true,
      dbRollingIntervalDays: 2,
      dbRollingMaxCount: 10,
      dbBackupHour: 1,
      fullZipRollingEnabled: false,
      fullZipRollingIntervalDays: 14,
      fullZipRollingMaxCount: 3,
    });
  });

  it('validates snapshot filenames strictly to prevent path traversal and unsupported file types', () => {
    expect(validateBackupFilename('auto_rolling_db_2026-11-18.db').valid).toBe(true);
    expect(validateBackupFilename('full_backup.zip').valid).toBe(true);
    expect(validateBackupFilename('state.json').valid).toBe(true);
    expect(validateBackupFilename('../etc/passwd').valid).toBe(false);
    expect(validateBackupFilename('sub/backup.db').valid).toBe(false);
    expect(validateBackupFilename('..\\backup.db').valid).toBe(false);
    expect(validateBackupFilename('malware.sh').valid).toBe(false);

    expect(resolveSafeBackupPath(backupsDir, '../inventory.db')).toBeNull();
    expect(resolveSafeBackupPath(backupsDir, 'snapshot.db')).toBe(
      path.resolve(backupsDir, 'snapshot.db')
    );
  });

  it('lists snapshots newest-first while excluding temp files and verifying SQLite integrity', () => {
    const dbSnap = path.join(backupsDir, 'auto_rolling_db_2026-11-18.db');
    const jsonSnap = path.join(backupsDir, 'manual_export.json');
    const tempFile = path.join(backupsDir, 'temp_upload_123.db');
    const corruptSnap = path.join(backupsDir, 'corrupt.db');
    const emptySqliteSnap = path.join(backupsDir, 'empty_tables.db');

    const db = createTestDatabase(dbSnap);
    seedSampleDatabase(db);
    db.close();

    fs.writeFileSync(jsonSnap, JSON.stringify({ products: [] }), 'utf-8');
    fs.writeFileSync(tempFile, 'temp-data', 'utf-8');
    fs.writeFileSync(corruptSnap, 'not a sqlite file at all', 'utf-8');

    const emptyDb = new Database(emptySqliteSnap);
    emptyDb.exec('CREATE TABLE __tmp (id INTEGER); DROP TABLE __tmp;');
    emptyDb.close();

    // Ensure deterministic mtimes so ordering can be asserted
    const oldTime = new Date(Date.now() - 60_000);
    const newTime = new Date(Date.now() - 5_000);
    fs.utimesSync(jsonSnap, oldTime, oldTime);
    fs.utimesSync(dbSnap, newTime, newTime);

    const listed = listFailsafeSnapshots(backupsDir);
    const names = listed.map((s) => s.filename);
    expect(names).not.toContain('temp_upload_123.db');
    expect(names).toContain('auto_rolling_db_2026-11-18.db');
    expect(names).toContain('manual_export.json');
    expect(listed.findIndex((s) => s.filename === 'auto_rolling_db_2026-11-18.db')).toBeLessThan(
      listed.findIndex((s) => s.filename === 'manual_export.json')
    );

    const dbEntry = listed.find((s) => s.filename === 'auto_rolling_db_2026-11-18.db');
    expect(dbEntry?.type).toBe('sqlite');
    expect(dbEntry?.isAutomatic).toBe(true);

    // SQLite integrity checks for safe last-resort restore
    const validCheck = verifySqliteSnapshotFile(dbSnap);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.tableCount).toBeGreaterThan(5);

    const corruptCheck = verifySqliteSnapshotFile(corruptSnap);
    expect(corruptCheck.valid).toBe(false);

    const emptyTablesCheck = verifySqliteSnapshotFile(emptySqliteSnap);
    expect(emptyTablesCheck.valid).toBe(false);

    // Roundtrip restore simulation from verified snapshot
    const restoredDbPath = path.join(tempDir, 'active_inventory.db');
    fs.writeFileSync(restoredDbPath, 'corrupted active db header', 'utf-8');
    fs.copyFileSync(dbSnap, restoredDbPath);

    const verifyRestored = verifySqliteSnapshotFile(restoredDbPath);
    expect(verifyRestored.valid).toBe(true);

    const reopened = new Database(restoredDbPath, { readonly: true });
    const countRow = reopened.prepare('SELECT COUNT(*) as cnt FROM products').get() as { cnt: number };
    reopened.close();
    expect(countRow.cnt).toBeGreaterThan(0);
  });

  it('exposes backup_recovery_mode and rolling backup options in HA config.json and config.yaml', () => {
    const rootDir = path.resolve(__dirname, '..');
    const configJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'config.json'), 'utf-8'));
    const configYaml = fs.readFileSync(path.join(rootDir, 'config.yaml'), 'utf-8');

    const expectedKeys = [
      'backup_recovery_mode',
      'auto_db_backup_enabled',
      'auto_db_backup_interval_days',
      'auto_db_backup_keep_count',
      'auto_db_backup_hour',
      'auto_zip_backup_enabled',
      'auto_zip_backup_interval_days',
      'auto_zip_backup_keep_count',
    ];

    for (const key of expectedKeys) {
      expect(configJson.options).toHaveProperty(key);
      expect(configJson.schema).toHaveProperty(key);
      expect(configYaml).toContain(`${key}:`);
    }
  });
});
