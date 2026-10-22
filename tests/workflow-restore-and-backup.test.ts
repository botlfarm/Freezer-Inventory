import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDatabase, seedSampleDatabase, restoreDatabaseSnapshot, TABLE_NAMES } from './test-harness';

describe('Workflow 1: SQLite Database Restore, Backup Snapshot & Roundtrip Integrity', () => {
  let tempDir: string;
  let testDbPath: string;
  let snapshotDbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-test-restore-'));
    testDbPath = path.join(tempDir, 'active_inventory.db');
    snapshotDbPath = path.join(tempDir, 'backup_snapshot.db');
    db = createTestDatabase(testDbPath);
  });

  afterEach(() => {
    try {
      if (db) db.close();
    } catch (e) {}
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {}
  });

  it('restores a sample database and verifies all core entities across tables are loaded', () => {
    // 1. Seed baseline database state
    seedSampleDatabase(db);

    // 2. Verify locations
    const locations = db.prepare('SELECT * FROM locations ORDER BY id').all() as any[];
    expect(locations.length).toBe(3);
    const homeLoc = locations.find(l => l.isHome === 1);
    expect(homeLoc).toBeDefined();
    expect(homeLoc.name).toBe('Home Farm Freezers');
    const butcherLoc = locations.find(l => l.type === 'processor');
    expect(butcherLoc).toBeDefined();
    expect(butcherLoc.name).toBe('Valley Meat Processors');

    // 3. Verify freezers and containers
    const freezers = db.prepare('SELECT * FROM freezers').all() as any[];
    expect(freezers.length).toBe(3);
    const containers = db.prepare('SELECT * FROM containers').all() as any[];
    expect(containers.length).toBe(6);
    expect(containers.some(c => c.id === 'staging_loose')).toBe(true);

    // 4. Verify products & templates
    const products = db.prepare('SELECT * FROM products').all() as any[];
    expect(products.length).toBe(11);
    const templates = db.prepare('SELECT * FROM container_templates').all() as any[];
    expect(templates.length).toBe(3);

    // 5. Verify initial baseline meat cuts
    const cuts = db.prepare('SELECT * FROM meat_cuts').all() as any[];
    expect(cuts.length).toBe(4);
    const totalQty = cuts.reduce((sum, c) => sum + c.quantity, 0);
    expect(totalQty).toBe(32); // 5 + 20 + 2 + 5 = 32
  });

  it('takes a SQLite backup snapshot, simulates catastrophic data loss, and restores identically', () => {
    // 1. Seed sample database
    seedSampleDatabase(db);

    // 2. Create SQLite snapshot backup using VACUUM INTO
    db.prepare('VACUUM INTO ?').run(snapshotDbPath);
    expect(fs.existsSync(snapshotDbPath)).toBe(true);
    expect(fs.statSync(snapshotDbPath).size).toBeGreaterThan(0);

    // 3. Record baseline counts across all tables
    const baselineCounts: Record<string, number> = {};
    for (const tbl of TABLE_NAMES) {
      try {
        const row = db.prepare(`SELECT count(*) as count FROM ${tbl}`).get() as any;
        baselineCounts[tbl] = row ? row.count : 0;
      } catch (e) {
        baselineCounts[tbl] = 0;
      }
    }
    expect(baselineCounts['products']).toBe(11);
    expect(baselineCounts['freezers']).toBe(3);
    expect(baselineCounts['containers']).toBe(6);
    expect(baselineCounts['meat_cuts']).toBe(4);

    // 4. Perform catastrophic mutations: wipe data, alter records
    db.prepare('DELETE FROM meat_cuts').run();
    db.prepare('DELETE FROM containers WHERE id != ?').run('staging_loose');
    db.prepare('DELETE FROM freezers').run();
    db.prepare('DELETE FROM products').run();

    // Verify destruction
    const wipedCuts = (db.prepare('SELECT count(*) as count FROM meat_cuts').get() as any).count;
    const wipedFreezers = (db.prepare('SELECT count(*) as count FROM freezers').get() as any).count;
    const wipedProducts = (db.prepare('SELECT count(*) as count FROM products').get() as any).count;
    expect(wipedCuts).toBe(0);
    expect(wipedFreezers).toBe(0);
    expect(wipedProducts).toBe(0);

    // 5. Restore from the SQLite backup snapshot
    db.close();
    db = restoreDatabaseSnapshot(testDbPath, snapshotDbPath);

    // 6. Verify full restoration parity across all tables
    for (const tbl of TABLE_NAMES) {
      const restoredCount = (db.prepare(`SELECT count(*) as count FROM ${tbl}`).get() as any).count;
      expect(restoredCount).toBe(baselineCounts[tbl]);
    }

    // Verify key relational entities
    const restoredProducts = db.prepare('SELECT name, salePrice FROM products WHERE id = ?').get('prod-ribeye') as any;
    expect(restoredProducts.name).toBe('Ribeye Steak');
    expect(restoredProducts.salePrice).toBe(24.99);

    const restoredHome = db.prepare('SELECT name FROM locations WHERE isHome = 1').get() as any;
    expect(restoredHome.name).toBe('Home Farm Freezers');
  });
});
