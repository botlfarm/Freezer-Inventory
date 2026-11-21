import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createTestDatabase, seedSampleDatabase, parseCutsheetCsv, importButcherCutsheet } from './test-harness';
import { ButcherOrder, MovementOrder } from '../types';
import { OffSiteStorageView } from '../views/OffSiteStorageView';

describe('Workflow 3: Off-Site Logistics, Cold Storage Pallet Transfer & Home Staging Intake', () => {
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
    createdAt: Date.now()
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-test-logistics-'));
    testDbPath = path.join(tempDir, 'active_inventory.db');
    db = createTestDatabase(testDbPath);
    seedSampleDatabase(db);

    // Ingest the 18 records at Butcher location
    const csvPath = path.join(__dirname, 'fixtures', 'appended_butcher_cutsheet.csv');
    const records = parseCutsheetCsv(fs.readFileSync(csvPath, 'utf-8'));
    importButcherCutsheet(db, sampleOrder, records, 'Valley Meat Processors', 'PALLET-A');
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

  it('dispatches cuts from butcher: moves half to cold storage on a pallet, and brings remainder home into staging', () => {
    const entries = db.prepare('SELECT * FROM off_site_entries WHERE orderId = ?').all(sampleOrder.id) as any[];
    expect(entries.length).toBe(18);

    // Split entries:
    // First 12 entries -> Cold Storage Express on pallet PALLET-CS-1
    // Last 6 entries -> Home Farm Freezers (On-Site Staging)
    const coldStorageEntries = entries.slice(0, 12);
    const homeEntries = entries.slice(12);

    const coldStorageDestId = 'dest-cold-storage';
    const homeDestId = 'dest-home-staging';

    const moves: any[] = [];
    coldStorageEntries.forEach(e => {
      moves.push({
        entryId: e.id,
        targetLocation: coldStorageDestId,
        actualLocation: coldStorageDestId,
        originalLocation: e.location,
        originalCurrentLocation: e.currentLocation
      });
    });

    homeEntries.forEach(e => {
      moves.push({
        entryId: e.id,
        targetLocation: homeDestId,
        actualLocation: homeDestId,
        originalLocation: e.location,
        originalCurrentLocation: e.currentLocation
      });
    });

    const movementOrder: MovementOrder = {
      id: 'mo-2026-harvest-dispatch',
      name: 'Harvest Dispatch: Cold Storage & Home Staging',
      description: 'Split butcher harvest between off-site bulk freezer and on-site retail prep',
      date: '2026-10-22',
      status: 'planning',
      palletsInPlay: ['PALLET-A', 'PALLET-CS-1'],
      locationsInPlay: ['loc-butcher', 'loc-cold-storage', 'loc-home'],
      targetDestinations: [
        {
          id: coldStorageDestId,
          locationId: 'loc-cold-storage',
          locationName: 'Cold Storage Express',
          palletName: 'PALLET-CS-1'
        },
        {
          id: homeDestId,
          locationId: 'loc-home',
          locationName: 'Home Farm Freezers',
          palletName: 'Unassigned Staging'
        }
      ],
      moves,
      pickedBoxIds: [],
      deliveredBoxIds: [],
      pickedItemIds: [],
      deliveredItemIds: []
    };

    // Save movement order
    db.prepare(`
      INSERT INTO movement_orders (id, name, description, date, status, palletsInPlay, locationsInPlay, targetDestinations, moves)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      movementOrder.id,
      movementOrder.name,
      movementOrder.description,
      movementOrder.date,
      movementOrder.status,
      JSON.stringify(movementOrder.palletsInPlay),
      JSON.stringify(movementOrder.locationsInPlay),
      JSON.stringify(movementOrder.targetDestinations),
      JSON.stringify(movementOrder.moves)
    );

    // EXECUTE MOVEMENT ORDER (Simulating server.ts EXECUTE_MOVEMENT_ORDER logic)
    db.transaction(() => {
      // 1. Ensure target pallet PALLET-CS-1 exists at Cold Storage
      db.prepare(`
        INSERT INTO pallets (id, name, storageLocationId, isArchived)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(id) DO UPDATE SET storageLocationId = excluded.storageLocationId, isArchived = 0
      `).run('PALLET-CS-1', 'PALLET-CS-1', 'loc-cold-storage');

      // 2. Cold Storage Entries: update location, pallet, and currentLocation
      const updateColdStorage = db.prepare(`
        UPDATE off_site_entries
        SET location = 'Cold Storage Express',
            pallet = 'PALLET-CS-1',
            currentLocation = 'PALLET-CS-1',
            storageLocationId = 'loc-cold-storage'
        WHERE id = ?
      `);
      for (const e of coldStorageEntries) {
        updateColdStorage.run(e.id);
      }

      // 3. Home Entries: convert into on-site Staging
      const insertStagingContainer = db.prepare(`
        INSERT INTO containers (id, name, freezerId, deleteOnEmpty, icon, isBox, isArchived)
        VALUES (?, ?, NULL, 1, 'Box', 1, 0)
        ON CONFLICT(id) DO NOTHING
      `);

      const insertHomeCut = db.prepare(`
        INSERT INTO meat_cuts (id, productId, quantity, containerId, notes, tagIds, weight, packDate, lot, originalCutName)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const archiveOffsiteHome = db.prepare(`
        UPDATE off_site_entries
        SET archived = 1, location = '', pallet = '', currentLocation = '', storageLocationId = ''
        WHERE id = ?
      `);

      for (const e of homeEntries) {
        const boxName = `Box ${e.box || 'Staging'}`;
        const containerId = `cont-staging-${(e.box || 'staged').toLowerCase()}`;
        insertStagingContainer.run(containerId, boxName);

        const cutId = `cut-staged-${e.id}`;
        insertHomeCut.run(
          cutId,
          e.productId,
          e.pieces,
          containerId,
          `Inbound from Butcher (Lot: ${e.lot})`,
          e.tagIds,
          e.netWeight,
          e.packDate,
          e.lot,
          e.originalCutName
        );

        archiveOffsiteHome.run(e.id);
      }

      // 4. Mark movement order completed
      db.prepare(`
        UPDATE movement_orders
        SET status = 'completed', executedAt = ?
        WHERE id = ?
      `).run(new Date().toISOString(), movementOrder.id);
    })();

    // VERIFICATION:
    // A. Cold Storage entries verification:
    const activeOffsite = db.prepare('SELECT * FROM off_site_entries WHERE archived = 0').all() as any[];
    expect(activeOffsite.length).toBe(12);

    for (const e of activeOffsite) {
      expect(e.location).toBe('Cold Storage Express');
      expect(e.pallet).toBe('PALLET-CS-1');
      expect(e.currentLocation).toBe('PALLET-CS-1');
      expect(e.storageLocationId).toBe('loc-cold-storage');
    }

    const palletInDb = db.prepare('SELECT * FROM pallets WHERE id = ?').get('PALLET-CS-1') as any;
    expect(palletInDb).toBeDefined();
    expect(palletInDb.storageLocationId).toBe('loc-cold-storage');

    // B. Home Staging items verification:
    // Staging containers created (freezerId is NULL)
    const stagingContainers = db.prepare('SELECT * FROM containers WHERE freezerId IS NULL AND id != ?').all('staging_loose') as any[];
    expect(stagingContainers.length).toBeGreaterThanOrEqual(1);

    // Meat cuts in staging containers
    const homeCuts = db.prepare(`
      SELECT mc.*, c.name as containerName, p.name as productName
      FROM meat_cuts mc
      JOIN containers c ON mc.containerId = c.id
      JOIN products p ON mc.productId = p.id
      WHERE c.freezerId IS NULL AND c.id != 'staging_loose'
    `).all() as any[];

    expect(homeCuts.length).toBe(6);
    const totalHomePieces = homeCuts.reduce((sum, c) => sum + c.quantity, 0);
    // Pieces of the 6 home entries: 12 (Ribeye) + 8 (Filet) + 14 (Sirloin) + 50 (Ground) + 4 (Flank) + 3 (Oxtail) = 91 pieces
    expect(totalHomePieces).toBe(91);

    // Verify Movement Order status
    const finishedOrder = db.prepare('SELECT status, executedAt FROM movement_orders WHERE id = ?').get(movementOrder.id) as any;
    expect(finishedOrder.status).toBe('completed');
    expect(finishedOrder.executedAt).toBeDefined();
  });

  it('renders OffSiteStorageView safely when off-site entries have undefined originalCutName and no matching product', () => {
    const mockState = {
      offSiteEntries: [
        {
          id: 'os-missing-cut-1',
          serial: 'SN-999',
          productId: 'non-existent-product',
          originalCutName: undefined,
          cuts: undefined,
          packDate: '2026-10-15',
          lot: 'LOT-99',
          pieces: 4,
          netWeight: 12.5,
          box: '1',
          currentLocation: 'P1',
          pallet: 'P1',
          location: 'Cold Storage',
        },
        {
          id: 'os-legacy-cuts-2',
          serial: 'SN-1000',
          productId: undefined,
          originalCutName: undefined,
          cuts: '14082 PORK TRIM',
          packDate: '2026-10-15',
          lot: 'LOT-99',
          pieces: 2,
          netWeight: 10.0,
          box: '2',
          currentLocation: 'P2',
          pallet: 'P2',
          location: 'Cold Storage',
        },
      ],
      products: [],
      locations: [],
      pallets: [],
      movementOrders: [],
      tags: [],
      customLists: [],
      butcherOrders: [],
      butcherRecords: [],
      freezers: [],
      containers: [],
      meatCuts: [],
      history: [],
      containerTemplates: [],
      appConfig: [],
    };

    const prevLocalStorage = (globalThis as any).localStorage;
    (globalThis as any).localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
    try {
      const html = renderToStaticMarkup(
        React.createElement(OffSiteStorageView, {
          state: mockState as any,
          dispatch: async () => true,
          products: [],
          activeSubTab: 'sheet',
          setActiveSubTab: () => {},
          searchTerm: '',
          setSearchTerm: () => {},
          isAdvancedFilterOpen: false,
          setIsAdvancedFilterOpen: () => {},
          isDirectEdit: false,
          setIsDirectEdit: () => {},
          viewOriginalNames: false,
          setViewOriginalNames: () => {},
          filterTags: new Set<string>(),
          setFilterTags: () => {},
          filterLists: new Set<string>(),
          setFilterLists: () => {},
          viewUngrouped: false,
          setViewUngrouped: () => {},
          visibleColumns: new Set<string>(),
          setVisibleColumns: () => {},
          registerActions: () => {},
        }),
      );

      expect(html).toContain('offsite');
    } finally {
      if (prevLocalStorage === undefined) {
        delete (globalThis as any).localStorage;
      } else {
        (globalThis as any).localStorage = prevLocalStorage;
      }
    }
  });
});
