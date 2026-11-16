import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import {
  ensureAuthSchema,
  listUsersSummary,
  createUser,
  resetUserPin,
  updateUser,
  revokeAllSessionsForUser,
  normalizeUsername,
} from '../utils/userAuthServer';

function resolveDefaultDbPath(): string {
  if (process.env.DB_PATH && process.env.DB_PATH.trim()) {
    return path.resolve(process.env.DB_PATH.trim());
  }
  if (fs.existsSync('/data/inventory.db') || fs.existsSync('/data/options.json')) {
    return '/data/inventory.db';
  }
  const localDataDb = path.join(process.cwd(), 'data', 'inventory.db');
  return localDataDb;
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = 'true';
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

function findUserByNameOrId(db: Database.Database, identifier: string) {
  const clean = normalizeUsername(identifier);
  return (
    (db.prepare('SELECT id, name, role, isActive FROM app_users WHERE id = ?').get(clean) as any) ||
    (db.prepare('SELECT id, name, role, isActive FROM app_users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))').get(clean) as any)
  );
}

function printUsage() {
  console.log(`
Freezer Inventory Tracker — Admin Recovery CLI

Usage:
  npm run admin:recover -- <command> [options]
  npx tsx scripts/admin-recovery.ts <command> [options]

Commands:
  list                                     List all users, roles, and active status
  create-admin <name> <pin>                Create a new active admin user
  reset-pin <name-or-id> <new-pin>         Reset any user's PIN (and activate account)
  promote <name-or-id>                     Promote an existing user to admin & activate
  revoke-sessions <name-or-id>             Sign out all sessions for a user

Options:
  --db <path>                              Path to SQLite inventory.db (auto-detected by default)
`);
}

export function runRecoveryCli(argv: string[]): number {
  const { positional, flags } = parseArgs(argv);
  const cmd = positional[0];
  const dbPath = flags.db ? path.resolve(flags.db) : resolveDefaultDbPath();

  if (!cmd || cmd === 'help' || flags.help) {
    printUsage();
    return 0;
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  ensureAuthSchema(db);

  try {
    switch (cmd) {
      case 'list': {
        const users = listUsersSummary(db);
        if (users.length === 0) {
          console.log(`No users configured in ${dbPath}. App is currently in first-run bootstrap mode.`);
        } else {
          console.log(`Users in ${dbPath}:`);
          for (const u of users) {
            console.log(
              `- ${u.name} (${u.id}) | role=${u.role} | active=${u.isActive ? 'yes' : 'no'} | lastLogin=${u.lastLoginAt || 'never'}`
            );
          }
        }
        return 0;
      }

      case 'create-admin': {
        const name = positional[1] || flags.name;
        const pin = positional[2] || flags.pin;
        if (!name || !pin) {
          console.error('Error: create-admin requires <name> and <pin>.');
          return 1;
        }
        const created = createUser(db, { name, role: 'admin', pin, isActive: true });
        console.log(`Created admin user "${created.name}" (${created.id}).`);
        return 0;
      }

      case 'reset-pin': {
        const identifier = positional[1] || flags.user || flags.name;
        const newPin = positional[2] || flags.pin;
        if (!identifier || !newPin) {
          console.error('Error: reset-pin requires <name-or-id> and <new-pin>.');
          return 1;
        }
        const target = findUserByNameOrId(db, identifier);
        if (!target) {
          console.error(`Error: User "${identifier}" not found.`);
          return 1;
        }
        resetUserPin(db, target.id, newPin);
        if (target.isActive !== 1) {
          updateUser(db, target.id, { isActive: true });
        }
        console.log(`PIN reset for "${target.name}" (${target.id}).`);
        return 0;
      }

      case 'promote': {
        const identifier = positional[1] || flags.user || flags.name;
        if (!identifier) {
          console.error('Error: promote requires <name-or-id>.');
          return 1;
        }
        const target = findUserByNameOrId(db, identifier);
        if (!target) {
          console.error(`Error: User "${identifier}" not found.`);
          return 1;
        }
        const updated = updateUser(db, target.id, { role: 'admin', isActive: true });
        console.log(`User "${updated.name}" (${updated.id}) is now an active admin.`);
        return 0;
      }

      case 'revoke-sessions': {
        const identifier = positional[1] || flags.user || flags.name;
        if (!identifier) {
          console.error('Error: revoke-sessions requires <name-or-id>.');
          return 1;
        }
        const target = findUserByNameOrId(db, identifier);
        if (!target) {
          console.error(`Error: User "${identifier}" not found.`);
          return 1;
        }
        const count = revokeAllSessionsForUser(db, target.id);
        console.log(`Revoked ${count} active session(s) for "${target.name}".`);
        return 0;
      }

      default:
        console.error(`Unknown command: ${cmd}`);
        printUsage();
        return 1;
    }
  } catch (err: any) {
    console.error(`Recovery command failed: ${err?.message || err}`);
    return 1;
  } finally {
    db.close();
  }
}

const isDirectRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] &&
  process.argv[1].includes('admin-recovery');

if (isDirectRun) {
  const code = runRecoveryCli(process.argv.slice(2));
  process.exit(code);
}
