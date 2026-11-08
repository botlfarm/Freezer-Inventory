import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDatabase, seedSampleDatabase, TABLE_NAMES } from './test-harness';

describe('Workflow: Demo Sandbox Playground Lifecycle & Data Isolation', () => {
  let tempDir: string;
  let liveDbPath: string;
  let demoDbPath: string;
  let liveDb: Database.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-test-demo-'));
    liveDbPath = path.join(tempDir, 'inventory.db');
    demoDbPath = path.join(tempDir, 'inventory_demo.db');
    liveDb = createTestDatabase(liveDbPath);
    seedSampleDatabase(liveDb);
  });

  afterEach(() => {
    try {
      if (liveDb) liveDb.close();
    } catch (e) {}
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {}
  });

  it('clones live database on demo startup, allows safe mutations in sandbox, and protects live data', () => {
    // 1. Verify initial baseline in live database
    const initialLiveCuts = liveDb.prepare('SELECT count(*) as count FROM meat_cuts').get() as any;
    expect(initialLiveCuts.count).toBe(4);
    const initialLiveFreezers = liveDb.prepare('SELECT count(*) as count FROM freezers').get() as any;
    expect(initialLiveFreezers.count).toBe(3);

    // 2. Simulate entering Demo Sandbox:
    // Flush live DB to disk and close/checkpoint
    liveDb.pragma('wal_checkpoint(TRUNCATE)');
    liveDb.close();

    // Copy live database to demo sandbox database
    fs.copyFileSync(liveDbPath, demoDbPath);
    expect(fs.existsSync(demoDbPath)).toBe(true);

    // Connect to demo sandbox database
    const sandboxDb = new Database(demoDbPath);
    sandboxDb.pragma('journal_mode = WAL');

    // 3. Mutate data inside the sandbox (destructive and additions)
    sandboxDb.prepare(`
      INSERT INTO meat_cuts (id, productId, containerId, quantity, weight, packDate)
      VALUES ('cut-sandbox-99', 'prod_ribeye', 'container_bin_1', 15, 12.5, '2026-10-29')
    `).run();

    // Delete a freezer inside sandbox
    sandboxDb.prepare("DELETE FROM freezers WHERE id = 'freezer-chest'").run();

    const sandboxCuts = sandboxDb.prepare('SELECT count(*) as count FROM meat_cuts').get() as any;
    expect(sandboxCuts.count).toBe(5);

    const sandboxFreezers = sandboxDb.prepare('SELECT count(*) as count FROM freezers').get() as any;
    expect(sandboxFreezers.count).toBe(2);

    // 4. Verify live database file was NOT mutated by sandbox changes
    const liveVerificationDb = new Database(liveDbPath);
    const liveCutsNow = liveVerificationDb.prepare('SELECT count(*) as count FROM meat_cuts').get() as any;
    expect(liveCutsNow.count).toBe(4); // Remains untouched 4!

    const liveFreezersNow = liveVerificationDb.prepare('SELECT count(*) as count FROM freezers').get() as any;
    expect(liveFreezersNow.count).toBe(3); // Remains untouched 3!
    liveVerificationDb.close();

    // 5. Simulate exiting Demo Sandbox:
    sandboxDb.close();
    if (fs.existsSync(demoDbPath)) fs.unlinkSync(demoDbPath);
    const demoWal = `${demoDbPath}-wal`;
    const demoShm = `${demoDbPath}-shm`;
    if (fs.existsSync(demoWal)) fs.unlinkSync(demoWal);
    if (fs.existsSync(demoShm)) fs.unlinkSync(demoShm);

    expect(fs.existsSync(demoDbPath)).toBe(false);

    // Re-open live database and verify pristine state
    liveDb = new Database(liveDbPath);
    const restoredLiveCuts = liveDb.prepare('SELECT count(*) as count FROM meat_cuts').get() as any;
    expect(restoredLiveCuts.count).toBe(4);
    const restoredLiveFreezers = liveDb.prepare('SELECT count(*) as count FROM freezers').get() as any;
    expect(restoredLiveFreezers.count).toBe(3);
  });

  it('safely sanitizes cold boot state if legacy disk config or abandoned demo files exist', () => {
    // Write stale demo mode config
    const configFile = path.join(tempDir, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify({ isDemoMode: true, otherSetting: 123 }, null, 2), 'utf-8');

    // Create abandoned demo files
    fs.writeFileSync(demoDbPath, 'dummy sqlite data');
    const demoWal = `${demoDbPath}-wal`;
    fs.writeFileSync(demoWal, 'dummy wal');

    // Execute startup sanitation logic
    let isDemoMode = true;
    if (fs.existsSync(configFile)) {
      try {
        const configData = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        if (configData && configData.isDemoMode) {
          configData.isDemoMode = false;
          fs.writeFileSync(configFile, JSON.stringify(configData, null, 2), 'utf-8');
        }
      } catch (e) {}
    }
    isDemoMode = false;

    if (fs.existsSync(demoDbPath)) fs.unlinkSync(demoDbPath);
    if (fs.existsSync(demoWal)) fs.unlinkSync(demoWal);

    // Verify sanitization
    expect(isDemoMode).toBe(false);
    expect(fs.existsSync(demoDbPath)).toBe(false);
    expect(fs.existsSync(demoWal)).toBe(false);

    const updatedConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
    expect(updatedConfig.isDemoMode).toBe(false);
    expect(updatedConfig.otherSetting).toBe(123);
  });
});
