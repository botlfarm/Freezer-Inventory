import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDatabase, seedSampleDatabase } from './test-harness';

describe('Workflow 5: Reverse Movement - Moving Home Inventory to Staging and Dispatching Off-Site', () => {
  let tempDir: string;
  let testDbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-test-reverse-'));
    testDbPath = path.join(tempDir, 'active_inventory.db');
    db = createTestDatabase(testDbPath);
    seedSampleDatabase(db);
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

  it('moves items from home freezer into staging, packs them into an off-site box with weights, and finalizes transfer offsite', () => {
    // 1. Home cut in Walk-In (mc-init-ribeye has 5 Ribeyes, 7.5 lbs)
    const initialCut = db.prepare('SELECT * FROM meat_cuts WHERE id = ?').get('mc-init-ribeye') as any;
    expect(initialCut).toBeDefined();
    expect(initialCut.quantity).toBe(5);

    // 2. Move 3 Ribeyes from Walk-In to Staging (staging_loose)
    db.transaction(() => {
      // Reduce original cut in walk-in
      db.prepare('UPDATE meat_cuts SET quantity = 2 WHERE id = ?').run('mc-init-ribeye');

      // Create staged cut in staging_loose
      db.prepare(`
        INSERT INTO meat_cuts (id, productId, quantity, containerId, notes, tagIds, weight, packDate, lot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'cut-staged-for-offsite',
        initialCut.productId,
        3,
        'staging_loose',
        'Staged for transfer to cold storage',
        initialCut.tagIds,
        4.5, // 3 cuts @ 1.5 lb each
        initialCut.packDate,
        initialCut.lot
      );

      // Audit history
      db.prepare(`
        INSERT INTO history (id, timestamp, description, targetId, user)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'hist-move-to-staging',
        new Date().toISOString(),
        'Moved 3x "Ribeye Steak" to Staging for off-site transfer.',
        'staging_loose',
        'Logistics Manager'
      );
    })();

    // Verify on-site staging
    const stagedCuts = db.prepare("SELECT * FROM meat_cuts WHERE containerId = 'staging_loose'").all() as any[];
    expect(stagedCuts.length).toBe(1);
    expect(stagedCuts[0].quantity).toBe(3);

    // 3. Stage for off-site transfer: pack into off-site box with assigned weights and inventory box number
    const boxNumber = 'BOX-EXP-501';
    const targetPallet = 'PALLET-CS-1';
    const targetLocationName = 'Cold Storage Express';
    const targetLocationId = 'loc-cold-storage';
    const netWeight = 4.5;
    const tareWeight = 1.2;
    const grossWeight = netWeight + tareWeight; // 5.7 lbs

    const offSiteEntryId = `offsite-transfer-${Date.now()}`;

    // Execute FINALIZE_OFFSITE_STAGING
    db.transaction(() => {
      // Remove from on-site meat_cuts
      db.prepare("DELETE FROM meat_cuts WHERE id = 'cut-staged-for-offsite'").run();

      // Create box record with tare and notes
      db.prepare(`
        INSERT INTO boxes (id, name, palletId, notes, isArchived)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET notes = excluded.notes
      `).run(boxNumber, boxNumber, targetPallet, `Tare: ${tareWeight} lbs, Gross: ${grossWeight} lbs`);

      // Create active off_site_entry
      db.prepare(`
        INSERT INTO off_site_entries (
          id, serial, productId, originalCutName, packDate, lot, pieces, netWeight, box,
          location, pallet, currentLocation, storageLocationId, archived, staged, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
      `).run(
        offSiteEntryId,
        'SN-EXP-001',
        initialCut.productId,
        'Ribeye Steak',
        initialCut.packDate,
        initialCut.lot,
        3,
        netWeight,
        boxNumber,
        targetLocationName,
        targetPallet,
        targetPallet,
        targetLocationId,
        `Gross Wt: ${grossWeight} lbs`
      );

      // Create completed Movement Order
      db.prepare(`
        INSERT INTO movement_orders (id, name, description, date, status, palletsInPlay, locationsInPlay, targetDestinations, moves, executedAt)
        VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?)
      `).run(
        'mo-reverse-001',
        `Dispatch to Cold Storage (${boxNumber})`,
        `Transferred 3x Ribeye Steak in ${boxNumber} (${netWeight} lbs) to ${targetLocationName}`,
        new Date().toISOString(),
        JSON.stringify([targetPallet]),
        JSON.stringify(['loc-home', targetLocationId]),
        JSON.stringify([{ id: 'dest-cs', locationId: targetLocationId, locationName: targetLocationName, palletName: targetPallet }]),
        JSON.stringify([{ entryId: offSiteEntryId, targetLocation: targetPallet, actualLocation: targetPallet, originalLocation: 'On-Site Staging' }]),
        new Date().toISOString()
      );

      // Audit history
      db.prepare(`
        INSERT INTO history (id, timestamp, description, targetId, user)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'hist-finalize-offsite',
        new Date().toISOString(),
        `Finalized off-site transfer: Moved 3 items in "${boxNumber}" to "${targetLocationName}".`,
        offSiteEntryId,
        'Logistics Manager'
      );
    })();

    // 4. VERIFY:
    // Staging is empty
    const remainingStaging = db.prepare("SELECT * FROM meat_cuts WHERE containerId = 'staging_loose'").all() as any[];
    expect(remainingStaging.length).toBe(0);

    // Box record exists in SQLite
    const createdBox = db.prepare('SELECT * FROM boxes WHERE id = ?').get(boxNumber) as any;
    expect(createdBox).toBeDefined();
    expect(createdBox.palletId).toBe(targetPallet);
    expect(createdBox.notes).toContain('Tare: 1.2 lbs');

    // Off-site entry exists with exact weights and location
    const createdOffsite = db.prepare('SELECT * FROM off_site_entries WHERE id = ?').get(offSiteEntryId) as any;
    expect(createdOffsite).toBeDefined();
    expect(createdOffsite.location).toBe('Cold Storage Express');
    expect(createdOffsite.pallet).toBe('PALLET-CS-1');
    expect(createdOffsite.pieces).toBe(3);
    expect(createdOffsite.netWeight).toBe(4.5);
    expect(createdOffsite.box).toBe('BOX-EXP-501');
    expect(createdOffsite.archived).toBe(0);

    // Movement order was created and marked completed
    const reverseOrder = db.prepare("SELECT * FROM movement_orders WHERE id = 'mo-reverse-001'").get() as any;
    expect(reverseOrder).toBeDefined();
    expect(reverseOrder.status).toBe('completed');
  });
});
