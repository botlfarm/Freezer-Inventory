import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

export const DEFAULT_HA_OPTIONS_PATH = '/data/options.json';
export const HA_BACKUP_SYNC_STATE_FILENAME = 'ha_backup_options_sync.json';

export interface HaBackupScheduleOptions {
  dbRollingEnabled?: boolean;
  dbRollingIntervalDays?: number;
  dbRollingMaxCount?: number;
  dbBackupHour?: number;
  fullZipRollingEnabled?: boolean;
  fullZipRollingIntervalDays?: number;
  fullZipRollingMaxCount?: number;
}

export interface HaBackupRecoveryConfig {
  backupRecoveryMode: boolean;
  recoveryPin: string;
  recoveryPinConfigured: boolean;
  source: 'none' | 'env' | 'ha_options';
  haBackupOptions: HaBackupScheduleOptions;
  optionsPresent: boolean;
}

export interface FailsafeSnapshotEntry {
  filename: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  type: 'sqlite' | 'zip' | 'json' | 'csv';
  isAutomatic: boolean;
}

const ALLOWED_BACKUP_EXTENSIONS = new Set(['.db', '.zip', '.json', '.csv']);

function parseOptionalBool(val: unknown): boolean | undefined {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') return true;
    if (lower === 'false' || lower === '0' || lower === 'no') return false;
  }
  return undefined;
}

function parseOptionalInt(val: unknown, min: number, max: number): number | undefined {
  if (typeof val === 'number' && Number.isFinite(val)) {
    const rounded = Math.trunc(val);
    return Math.min(max, Math.max(min, rounded));
  }
  if (typeof val === 'string' && val.trim() !== '' && /^-?\d+$/.test(val.trim())) {
    const parsed = parseInt(val.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.min(max, Math.max(min, parsed));
    }
  }
  return undefined;
}

export function readHaBackupRecoveryConfig(opts?: {
  optionsPath?: string;
  env?: Record<string, string | undefined>;
}): HaBackupRecoveryConfig {
  const env = opts?.env || process.env;
  const optionsPath = opts?.optionsPath || DEFAULT_HA_OPTIONS_PATH;

  let haBackupRecoveryMode = false;
  let haPin = '';
  let haPresent = false;
  let optionsPresent = false;
  const haBackupOptions: HaBackupScheduleOptions = {};

  try {
    if (optionsPath && fs.existsSync(optionsPath)) {
      const raw = fs.readFileSync(optionsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        optionsPresent = true;
        if (parsed.backup_recovery_mode === true || parsed.backup_recovery_mode === 'true') {
          haBackupRecoveryMode = true;
          haPresent = true;
        }
        if (typeof parsed.admin_recovery_pin === 'string' && parsed.admin_recovery_pin.trim()) {
          haPin = parsed.admin_recovery_pin.trim();
          haPresent = true;
        }

        const dbEnabled = parseOptionalBool(parsed.auto_db_backup_enabled);
        if (dbEnabled !== undefined) haBackupOptions.dbRollingEnabled = dbEnabled;

        const dbInterval = parseOptionalInt(parsed.auto_db_backup_interval_days, 1, 365);
        if (dbInterval !== undefined) haBackupOptions.dbRollingIntervalDays = dbInterval;

        const dbKeep = parseOptionalInt(parsed.auto_db_backup_keep_count, 1, 90);
        if (dbKeep !== undefined) haBackupOptions.dbRollingMaxCount = dbKeep;

        const dbHour = parseOptionalInt(parsed.auto_db_backup_hour, 0, 23);
        if (dbHour !== undefined) haBackupOptions.dbBackupHour = dbHour;

        const zipEnabled = parseOptionalBool(parsed.auto_zip_backup_enabled);
        if (zipEnabled !== undefined) haBackupOptions.fullZipRollingEnabled = zipEnabled;

        const zipInterval = parseOptionalInt(parsed.auto_zip_backup_interval_days, 1, 365);
        if (zipInterval !== undefined) haBackupOptions.fullZipRollingIntervalDays = zipInterval;

        const zipKeep = parseOptionalInt(parsed.auto_zip_backup_keep_count, 1, 30);
        if (zipKeep !== undefined) haBackupOptions.fullZipRollingMaxCount = zipKeep;
      }
    }
  } catch {
    // Ignore unreadable or malformed options.json
  }

  const envModeRaw = String(env.BACKUP_RECOVERY_MODE || '').trim().toLowerCase();
  const envMode = envModeRaw === 'true' || envModeRaw === '1' || envModeRaw === 'yes';
  const envPin = typeof env.ADMIN_RECOVERY_PIN === 'string' ? env.ADMIN_RECOVERY_PIN.trim() : '';

  const backupRecoveryMode = envMode || haBackupRecoveryMode;
  const recoveryPin = envPin || haPin;
  const source: HaBackupRecoveryConfig['source'] =
    envMode || envPin ? 'env' : haPresent ? 'ha_options' : 'none';

  return {
    backupRecoveryMode,
    recoveryPin,
    recoveryPinConfigured: Boolean(recoveryPin),
    source,
    haBackupOptions,
    optionsPresent,
  };
}

/**
 * Syncs duplicated rolling backup schedule options from Home Assistant's /data/options.json
 * into the app's AutoSnapshotSettings without clobbering existing user-configured in-app
 * settings on upgrade. Subsequent edits made in Home Assistant Configuration are detected
 * via a lightweight sync marker file and applied cleanly.
 */
export function syncHaBackupSettingsToSnapshotConfig<T extends Record<string, any>>(opts: {
  optionsPath?: string;
  syncStatePath: string;
  currentSnapshotConfig: T;
  hasExistingSnapshotConfig: boolean;
}): { changed: boolean; nextConfig: T; syncedFromHa: boolean } {
  const { optionsPath = DEFAULT_HA_OPTIONS_PATH, syncStatePath, currentSnapshotConfig, hasExistingSnapshotConfig } = opts;
  const cfg = readHaBackupRecoveryConfig({ optionsPath });
  const haOpts = cfg.haBackupOptions;
  const optionKeys = Object.keys(haOpts) as Array<keyof HaBackupScheduleOptions>;

  if (!cfg.optionsPresent || optionKeys.length === 0) {
    return { changed: false, nextConfig: currentSnapshotConfig, syncedFromHa: false };
  }

  let prevSynced: HaBackupScheduleOptions | null = null;
  try {
    if (fs.existsSync(syncStatePath)) {
      const raw = fs.readFileSync(syncStatePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        prevSynced = parsed;
      }
    }
  } catch {
    prevSynced = null;
  }

  const persistMarker = () => {
    try {
      const dir = path.dirname(syncStatePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(syncStatePath, JSON.stringify(haOpts, null, 2), 'utf-8');
    } catch {
      // Non-fatal if marker write fails
    }
  };

  // First time seeing HA options on an existing installation:
  // Record baseline HA option values without overwriting the user's in-app backup schedule.
  if (!prevSynced && hasExistingSnapshotConfig) {
    persistMarker();
    return { changed: false, nextConfig: currentSnapshotConfig, syncedFromHa: false };
  }

  const nextConfig: Record<string, any> = { ...currentSnapshotConfig };
  let changed = false;

  for (const key of optionKeys) {
    const incomingVal = haOpts[key];
    if (incomingVal === undefined) continue;

    if (!prevSynced) {
      // Fresh installation (no existing snapshot config): adopt HA Configure values
      if (nextConfig[key] !== incomingVal) {
        nextConfig[key] = incomingVal;
        changed = true;
      }
    } else if (prevSynced[key] !== incomingVal) {
      // User explicitly modified this option in Home Assistant Configure
      if (nextConfig[key] !== incomingVal) {
        nextConfig[key] = incomingVal;
        changed = true;
      }
    }
  }

  const markerDiffers = !prevSynced || optionKeys.some((k) => prevSynced![k] !== haOpts[k]);
  if (markerDiffers) {
    persistMarker();
  }

  return {
    changed,
    nextConfig: nextConfig as T,
    syncedFromHa: changed,
  };
}

export function validateBackupFilename(filename: string): { valid: boolean; safeFilename: string; ext: string; error?: string } {
  const raw = String(filename || '').trim();
  if (!raw || raw.includes('..') || raw.includes('/') || raw.includes('\\') || raw.includes('\0')) {
    return { valid: false, safeFilename: '', ext: '', error: 'Invalid backup filename.' };
  }
  const safeFilename = path.basename(raw);
  if (safeFilename !== raw || safeFilename === '.' || safeFilename === '..') {
    return { valid: false, safeFilename: '', ext: '', error: 'Invalid backup filename.' };
  }
  const ext = path.extname(safeFilename).toLowerCase();
  if (!ALLOWED_BACKUP_EXTENSIONS.has(ext)) {
    return { valid: false, safeFilename: '', ext: '', error: 'Only .db, .zip, .json, and .csv backup files are supported.' };
  }
  return { valid: true, safeFilename, ext };
}

export function resolveSafeBackupPath(backupsDir: string, filename: string): string | null {
  const check = validateBackupFilename(filename);
  if (!check.valid) return null;
  const resolvedDir = path.resolve(backupsDir);
  const resolvedTarget = path.resolve(backupsDir, check.safeFilename);
  if (!resolvedTarget.startsWith(resolvedDir + path.sep)) {
    return null;
  }
  return resolvedTarget;
}

export function listFailsafeSnapshots(backupsDir: string): FailsafeSnapshotEntry[] {
  if (!backupsDir || !fs.existsSync(backupsDir)) return [];
  try {
    const files = fs.readdirSync(backupsDir);
    const entries: FailsafeSnapshotEntry[] = [];
    for (const f of files) {
      if (f.startsWith('temp_')) continue;
      const ext = path.extname(f).toLowerCase();
      if (!['.db', '.zip', '.json', '.csv'].includes(ext)) continue;
      const fullPath = path.join(backupsDir, f);
      try {
        const stats = fs.statSync(fullPath);
        if (!stats.isFile()) continue;
        let type: FailsafeSnapshotEntry['type'] = 'json';
        if (ext === '.db') type = 'sqlite';
        else if (ext === '.zip') type = 'zip';
        else if (ext === '.csv') type = 'csv';

        const createdDate = stats.birthtimeMs && stats.birthtimeMs > 0 ? stats.birthtime : stats.mtime;
        entries.push({
          filename: f,
          size: stats.size,
          createdAt: createdDate.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
          type,
          isAutomatic: f.startsWith('auto_rolling_') || f.startsWith('pre_failsafe_restore_'),
        });
      } catch {
        // Ignore unreadable entries
      }
    }
    return entries.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  } catch {
    return [];
  }
}

export function verifySqliteSnapshotFile(filepath: string): { valid: boolean; tableCount: number; error?: string } {
  if (!filepath || !fs.existsSync(filepath)) {
    return { valid: false, tableCount: 0, error: 'Snapshot file does not exist.' };
  }
  let testDb: Database.Database | null = null;
  try {
    const stats = fs.statSync(filepath);
    if (!stats.isFile() || stats.size < 16) {
      return { valid: false, tableCount: 0, error: 'Snapshot file is empty or too small to be a valid SQLite database.' };
    }
    testDb = new Database(filepath, { readonly: true });
    const check = testDb.prepare('PRAGMA quick_check(1)').get() as { quick_check?: string } | undefined;
    if (!check || String(check.quick_check || '').toLowerCase() !== 'ok') {
      return { valid: false, tableCount: 0, error: 'SQLite integrity check failed for this snapshot.' };
    }
    const tables = testDb
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all() as Array<{ name: string }>;
    if (!Array.isArray(tables) || tables.length === 0) {
      return { valid: false, tableCount: 0, error: 'Snapshot SQLite database contains no tables.' };
    }
    return { valid: true, tableCount: tables.length };
  } catch (err: any) {
    return { valid: false, tableCount: 0, error: err?.message || 'Failed to open SQLite snapshot file.' };
  } finally {
    try {
      if (testDb) testDb.close();
    } catch {
      // ignore close errors
    }
  }
}
