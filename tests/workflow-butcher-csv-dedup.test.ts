import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDatabase, seedSampleDatabase, parseCutsheetCsv, importButcherCutsheet } from './test-harness';
import { ButcherOrder } from '../types';

describe('Workflow 2: Butcher Order Creation, CSV Cutsheet Intake & Deduplication', () => {
  let tempDir: string;
  let testDbPath: string;
  let db: Database.Database;

  const sampleOrder: ButcherOrder = {
    id: 'order-beef-101',
    orderNumber: 'BO-2026-001',
    species: 'Beef',
    animalCount: 1,
    killDate: '2026-10-15',
    pickupDate: '2026-10-22',
    liveWeight: 1250,
    hotWeight: 775,
    coldWeight: 750,
    locationId: 'loc-butcher',
    createdAt: Date.now(),
    notes: 'Steer #4 - Pasture raised Black Angus',
    butcherFee: 650.00
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-test-butcher-'));
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

  it('creates a new butcher order and parses initial CSV cutsheet assigning cuts to the butcher location', () => {
    const csvPath = path.join(__dirname, 'fixtures', 'initial_butcher_cutsheet.csv');
    const csvText = fs.readFileSync(csvPath, 'utf-8');
    const parsedRecords = parseCutsheetCsv(csvText);
    expect(parsedRecords.length).toBe(12);

    // Import into database
    const importResult = importButcherCutsheet(
      db,
      sampleOrder,
      parsedRecords,
      'Valley Meat Processors',
      'PALLET-A'
    );

    expect(importResult.addedCount).toBe(12);
    expect(importResult.updatedCount).toBe(0);

    // Check butcher order in SQLite
    const orderInDb = db.prepare('SELECT * FROM butcher_orders WHERE id = ?').get(sampleOrder.id) as any;
    expect(orderInDb).toBeDefined();
    expect(orderInDb.orderNumber).toBe('BO-2026-001');
    expect(orderInDb.species).toBe('Beef');
    expect(orderInDb.coldWeight).toBe(750);
    expect(orderInDb.locationId).toBe('loc-butcher');

    // Check pallet was registered at the butcher location
    const palletInDb = db.prepare('SELECT * FROM pallets WHERE id = ?').get('PALLET-A') as any;
    expect(palletInDb).toBeDefined();
    expect(palletInDb.storageLocationId).toBe('loc-butcher');

    // Check off_site_entries
    const entries = db.prepare('SELECT * FROM off_site_entries WHERE orderId = ?').all(sampleOrder.id) as any[];
    expect(entries.length).toBe(12);

    // Verify all entries are assigned to the butcher location and pallet
    for (const e of entries) {
      expect(e.location).toBe('Valley Meat Processors');
      expect(e.pallet).toBe('PALLET-A');
      expect(e.currentLocation).toBe('PALLET-A');
      expect(e.storageLocationId).toBe('loc-butcher');
      expect(e.archived).toBe(0);
    }

    // Verify product matching (15425 -> prod-ribeye, 15410 -> prod-ground-beef)
    const ribeyeEntry = entries.find(e => e.serial === 'SN-BEEF-001');
    expect(ribeyeEntry).toBeDefined();
    expect(ribeyeEntry.productId).toBe('prod-ribeye');
    expect(ribeyeEntry.pieces).toBe(12);
    expect(ribeyeEntry.netWeight).toBe(18.5);

    const groundEntry = entries.find(e => e.serial === 'SN-BEEF-005');
    expect(groundEntry).toBeDefined();
    expect(groundEntry.productId).toBe('prod-ground-beef');
    expect(groundEntry.pieces).toBe(50);
    expect(groundEntry.netWeight).toBe(50.0);
  });

  it('uploads an appended CSV with existing + new records and guarantees zero duplicate entries', () => {
    // 1. First upload: initial 12 records
    const initialCsvPath = path.join(__dirname, 'fixtures', 'initial_butcher_cutsheet.csv');
    const initialRecords = parseCutsheetCsv(fs.readFileSync(initialCsvPath, 'utf-8'));
    importButcherCutsheet(db, sampleOrder, initialRecords, 'Valley Meat Processors', 'PALLET-A');

    const initialEntries = db.prepare('SELECT * FROM off_site_entries WHERE orderId = ?').all(sampleOrder.id) as any[];
    expect(initialEntries.length).toBe(12);

    // 2. Second upload: appended CSV (contains initial 12 + 6 new = 18 total)
    const appendedCsvPath = path.join(__dirname, 'fixtures', 'appended_butcher_cutsheet.csv');
    const appendedRecords = parseCutsheetCsv(fs.readFileSync(appendedCsvPath, 'utf-8'));
    expect(appendedRecords.length).toBe(18);

    const appendResult = importButcherCutsheet(
      db,
      sampleOrder,
      appendedRecords,
      'Valley Meat Processors',
      'PALLET-A'
    );

    // 3. Verify deduplication behavior
    expect(appendResult.addedCount).toBe(6);     // Exactly 6 new cuts added
    expect(appendResult.updatedCount).toBe(12); // Exactly 12 existing cuts updated in-place without duplicating

    // Total offsite entries for this order must be exactly 18 (NOT 30!)
    const totalEntries = db.prepare('SELECT * FROM off_site_entries WHERE orderId = ?').all(sampleOrder.id) as any[];
    expect(totalEntries.length).toBe(18);

    // Verify all serial numbers are completely distinct
    const serials = totalEntries.map(e => e.serial);
    const uniqueSerials = new Set(serials);
    expect(uniqueSerials.size).toBe(18);

    // Verify new cuts were matched to catalog products
    const filetEntry = totalEntries.find(e => e.serial === 'SN-BEEF-014');
    expect(filetEntry).toBeDefined();
    expect(filetEntry.productId).toBe('prod-filet');
    expect(filetEntry.pieces).toBe(8);
    expect(filetEntry.netWeight).toBe(7.2);

    const sirloinEntry = totalEntries.find(e => e.serial === 'SN-BEEF-015');
    expect(sirloinEntry).toBeDefined();
    expect(sirloinEntry.productId).toBe('prod-sirloin');
    expect(sirloinEntry.pieces).toBe(14);
  });
});
