import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { InventoryState, ButcherOrder, ButcherRecord, AppLocation, Product, Container, Freezer, ContainerTemplate } from '../types';

export const TABLE_NAMES = [
  'freezers',
  'container_templates',
  'containers',
  'products',
  'categories',
  'meat_cuts',
  'pallets',
  'boxes',
  'off_site_entries',
  'custom_lists',
  'notification_settings',
  'notification_logs',
  'tags',
  'locations',
  'movement_orders',
  'butcher_orders',
  'history',
  'app_config',
  'pwa_devices',
  'undo_sql_journal'
];

export function createTestDatabase(dbPath: string = ':memory:'): Database.Database {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS freezers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isSpecial INTEGER DEFAULT 0,
      isLooseOnly INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS container_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      imageUrl TEXT,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS containers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      freezerId TEXT,
      templateId TEXT,
      imageUrl TEXT,
      deleteOnEmpty INTEGER DEFAULT 0,
      icon TEXT,
      isBox INTEGER DEFAULT 0,
      color TEXT,
      isArchived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      primaryCategory TEXT NOT NULL,
      subCategory TEXT NOT NULL,
      imageUrl TEXT,
      productNumbers TEXT,
      listThresholds TEXT,
      defaultTagIds TEXT,
      listControlSources TEXT,
      barcode TEXT,
      isArchived INTEGER DEFAULT 0,
      salePrice REAL DEFAULT 0,
      salePriceUnit TEXT DEFAULT 'lb'
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subCategories TEXT,
      icon TEXT,
      imageUrl TEXT,
      cutList TEXT
    );

    CREATE TABLE IF NOT EXISTS meat_cuts (
      id TEXT PRIMARY KEY,
      productId TEXT,
      quantity INTEGER NOT NULL,
      containerId TEXT NOT NULL,
      notes TEXT,
      tagIds TEXT,
      originalCutName TEXT,
      wrongLabel TEXT,
      isWrongLabel INTEGER DEFAULT 0,
      weight REAL,
      packDate TEXT,
      lot TEXT
    );

    CREATE TABLE IF NOT EXISTS pallets (
      id TEXT PRIMARY KEY,
      name TEXT,
      notes TEXT,
      storageLocationId TEXT,
      tagIds TEXT,
      isArchived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS boxes (
      id TEXT PRIMARY KEY,
      name TEXT,
      palletId TEXT,
      notes TEXT,
      tagIds TEXT,
      isArchived INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS off_site_entries (
      id TEXT PRIMARY KEY,
      serial TEXT,
      productId TEXT,
      originalCutName TEXT,
      wrongLabel TEXT,
      packDate TEXT,
      lot TEXT,
      pieces INTEGER,
      netWeight REAL,
      box TEXT,
      notes TEXT,
      tagIds TEXT,
      orderId TEXT,
      archived INTEGER DEFAULT 0,
      staged INTEGER DEFAULT 0,
      location TEXT,
      pallet TEXT,
      currentLocation TEXT,
      storageLocationId TEXT
    );

    CREATE TABLE IF NOT EXISTS custom_lists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      allowNotes INTEGER DEFAULT 1,
      isInventoryControlled INTEGER DEFAULT 0,
      controlType TEXT,
      controlCondition TEXT,
      items TEXT,
      notificationEnabled INTEGER DEFAULT 0,
      notificationType TEXT DEFAULT 'all_items',
      lastNotifiedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_settings (
      id TEXT PRIMARY KEY,
      digestEnabled INTEGER DEFAULT 0,
      digestMode TEXT DEFAULT 'combined',
      digestTime TEXT DEFAULT '20:00',
      timezone TEXT DEFAULT 'America/New_York',
      method TEXT DEFAULT 'in_app',
      smtpHost TEXT,
      smtpPort INTEGER DEFAULT 587,
      smtpUser TEXT,
      smtpPass TEXT,
      smtpFrom TEXT,
      smtpTo TEXT,
      smtpSecure INTEGER DEFAULT 0,
      webhookUrl TEXT,
      haNotifyService TEXT DEFAULT 'notify.notify',
      haUrl TEXT,
      haToken TEXT,
      lastDigestSentAt TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY,
      sentAt TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      textColor TEXT,
      excludeFromDisplayRestock INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      contact TEXT,
      notes TEXT,
      isHome INTEGER DEFAULT 0,
      type TEXT NOT NULL,
      hasPallets INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS movement_orders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      palletsInPlay TEXT,
      locationsInPlay TEXT,
      targetDestinations TEXT,
      moves TEXT,
      executedAt TEXT,
      originalEntries TEXT,
      pickedBoxIds TEXT,
      deliveredBoxIds TEXT,
      pickedItemIds TEXT,
      deliveredItemIds TEXT,
      flags TEXT,
      confirmedPallets TEXT,
      confirmedMoveEntryIds TEXT
    );

    CREATE TABLE IF NOT EXISTS butcher_orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT NOT NULL,
      species TEXT NOT NULL,
      animalCount INTEGER,
      killDate TEXT NOT NULL,
      pickupDate TEXT,
      liveWeight REAL NOT NULL,
      hotWeight REAL NOT NULL,
      coldWeight REAL NOT NULL,
      locationId TEXT,
      createdAt INTEGER NOT NULL,
      birthDate TEXT,
      notes TEXT,
      documents TEXT,
      butcherFee REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      description TEXT NOT NULL,
      targetId TEXT NOT NULL,
      user TEXT,
      clientDevice TEXT,
      clientInfo TEXT,
      undoData TEXT
    );

    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS pwa_devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      operator TEXT,
      deviceType TEXT,
      clientDevice TEXT,
      clientInfo TEXT,
      isPwa INTEGER DEFAULT 0,
      firstSeen TEXT NOT NULL,
      lastSeen TEXT NOT NULL,
      lastIp TEXT,
      userAgent TEXT,
      status TEXT DEFAULT 'authorized',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS undo_sql_journal (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      actionType TEXT NOT NULL,
      description TEXT NOT NULL,
      user TEXT,
      clientDevice TEXT,
      clientInfo TEXT,
      targetId TEXT,
      statements TEXT NOT NULL
    );
  `);

  return db;
}

export function seedSampleDatabase(db: Database.Database): void {
  const insertLocation = db.prepare(`
    INSERT INTO locations (id, name, address, contact, notes, isHome, type, hasPallets)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertLocation.run('loc-home', 'Home Farm Freezers', '100 Farm Lane', 'John Farmer', 'Main on-site location', 1, 'home', 0);
  insertLocation.run('loc-butcher', 'Valley Meat Processors', '452 Slaughterhouse Rd', 'Dave Miller', 'Butcher harvest facility', 0, 'processor', 1);
  insertLocation.run('loc-cold-storage', 'Cold Storage Express', '800 Arctic Blvd', 'Facility Manager', 'Commercial multi-pallet freezer', 0, 'cold_storage', 1);

  const insertCategory = db.prepare(`
    INSERT INTO categories (id, name, subCategories, icon, cutList)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertCategory.run('cat-beef', 'Beef', JSON.stringify(['Steaks', 'Roasts', 'Ground', 'Ribs', 'Bones']), 'Beef', JSON.stringify(['Ribeye Steak', 'NY Strip Steak', 'Ground Beef 1lb', 'Chuck Roast', 'Brisket Whole', 'Short Ribs']));
  insertCategory.run('cat-pork', 'Pork', JSON.stringify(['Chops', 'Roasts', 'Bacon', 'Sausage']), 'Pig', JSON.stringify(['Pork Chops', 'Pork Belly', 'Pork Tenderloin']));

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, primaryCategory, subCategory, productNumbers, defaultTagIds, listThresholds, salePrice, salePriceUnit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProduct.run('prod-ribeye', 'Ribeye Steak', 'Beef', 'Steaks', JSON.stringify(['15425']), JSON.stringify([]), JSON.stringify({ minDisplay: 4, minStorage: 10 }), 24.99, 'lb');
  insertProduct.run('prod-nystrip', 'NY Strip Steak', 'Beef', 'Steaks', JSON.stringify(['15430']), JSON.stringify([]), JSON.stringify({ minDisplay: 4, minStorage: 8 }), 21.99, 'lb');
  insertProduct.run('prod-ground-beef', 'Ground Beef 1lb', 'Beef', 'Ground', JSON.stringify(['15410']), JSON.stringify([]), JSON.stringify({ minDisplay: 15, minStorage: 40 }), 9.50, 'ea');
  insertProduct.run('prod-chuck-roast', 'Chuck Roast', 'Beef', 'Roasts', JSON.stringify(['15450']), JSON.stringify([]), JSON.stringify({ minDisplay: 2, minStorage: 6 }), 12.99, 'lb');
  insertProduct.run('prod-brisket', 'Brisket Whole', 'Beef', 'Roasts', JSON.stringify(['15475']), JSON.stringify([]), JSON.stringify({ minDisplay: 1, minStorage: 3 }), 11.50, 'lb');
  insertProduct.run('prod-short-ribs', 'Short Ribs', 'Beef', 'Ribs', JSON.stringify(['15480']), JSON.stringify([]), JSON.stringify({ minDisplay: 2, minStorage: 5 }), 13.99, 'lb');
  insertProduct.run('prod-soup-bones', 'Beef Soup Bones', 'Beef', 'Bones', JSON.stringify(['15490']), JSON.stringify([]), JSON.stringify({ minDisplay: 3, minStorage: 8 }), 5.50, 'lb');
  insertProduct.run('prod-filet', 'Filet Mignon', 'Beef', 'Steaks', JSON.stringify(['15435']), JSON.stringify([]), JSON.stringify({ minDisplay: 2, minStorage: 4 }), 29.99, 'lb');
  insertProduct.run('prod-sirloin', 'Sirloin Steak', 'Beef', 'Steaks', JSON.stringify(['15460']), JSON.stringify([]), JSON.stringify({ minDisplay: 3, minStorage: 6 }), 16.99, 'lb');
  insertProduct.run('prod-flank', 'Flank Steak', 'Beef', 'Steaks', JSON.stringify(['15470']), JSON.stringify([]), JSON.stringify({ minDisplay: 2, minStorage: 4 }), 18.50, 'lb');
  insertProduct.run('prod-oxtail', 'Beef Oxtail', 'Beef', 'Roasts', JSON.stringify(['15495']), JSON.stringify([]), JSON.stringify({ minDisplay: 2, minStorage: 4 }), 14.50, 'lb');

  const insertFreezer = db.prepare(`
    INSERT INTO freezers (id, name, isSpecial, isLooseOnly)
    VALUES (?, ?, ?, ?)
  `);
  insertFreezer.run('freezer-main', 'Main Walk-In Freezer', 0, 0);
  insertFreezer.run('freezer-display', 'Retail Display Case', 1, 0);
  insertFreezer.run('freezer-chest', 'Chest Freezer #1', 0, 0);

  const insertTemplate = db.prepare(`
    INSERT INTO container_templates (id, name, icon, createdAt)
    VALUES (?, ?, ?, ?)
  `);
  insertTemplate.run('tpl-tote', 'Standard Blue Tote', 'Box', new Date().toISOString());
  insertTemplate.run('tpl-basket', 'Wire Freezer Basket', 'ShoppingBag', new Date().toISOString());
  insertTemplate.run('tpl-lug', 'Meat Lug (Deep)', 'Archive', new Date().toISOString());

  const insertContainer = db.prepare(`
    INSERT INTO containers (id, name, freezerId, templateId, deleteOnEmpty, icon, isBox, isArchived)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertContainer.run('staging_loose', 'Staging / Loose', null, null, 0, 'Layers', 0, 0);
  insertContainer.run('bin-walkin-1', 'Walk-In Shelf A - Steaks', 'freezer-main', 'tpl-tote', 0, 'Box', 0, 0);
  insertContainer.run('bin-walkin-2', 'Walk-In Shelf B - Roasts', 'freezer-main', 'tpl-tote', 0, 'Box', 0, 0);
  insertContainer.run('bin-display-steaks', 'Display Case - Prime Steaks', 'freezer-display', 'tpl-basket', 0, 'ShoppingBag', 0, 0);
  insertContainer.run('bin-display-ground', 'Display Case - Ground & Patties', 'freezer-display', 'tpl-basket', 0, 'ShoppingBag', 0, 0);
  insertContainer.run('bin-chest-overflow', 'Chest Freezer Bin 1', 'freezer-chest', 'tpl-lug', 0, 'Archive', 0, 0);

  const insertTag = db.prepare(`
    INSERT INTO tags (id, name, description, color, textColor, excludeFromDisplayRestock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertTag.run('tag-grass-fed', '100% Grass-Fed', 'Pasture raised and grass finished', '#10b981', '#ffffff', 0);
  insertTag.run('tag-not-for-sale', 'Not For Sale', 'Farm reserve or personal stock', '#ef4444', '#ffffff', 1);

  const insertCustomList = db.prepare(`
    INSERT INTO custom_lists (id, name, description, allowNotes, isInventoryControlled, items, notificationEnabled)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertCustomList.run(
    'list-restock',
    'Retail Restock Watchlist',
    'Items to transfer from Main Walk-In into Retail Display Case',
    1,
    1,
    JSON.stringify([
      { productId: 'prod-ribeye', minQuantity: 4, controlSource: 'onsite_count' },
      { productId: 'prod-ground-beef', minQuantity: 15, controlSource: 'onsite_count' }
    ]),
    0
  );

  const insertMeatCut = db.prepare(`
    INSERT INTO meat_cuts (id, productId, quantity, containerId, notes, tagIds, weight, packDate, lot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // Existing on-site baseline stock
  insertMeatCut.run('mc-init-ribeye', 'prod-ribeye', 5, 'bin-walkin-1', 'Initial stock', JSON.stringify(['tag-grass-fed']), 7.5, '2026-10-10', 'LOT-INIT-01');
  insertMeatCut.run('mc-init-ground', 'prod-ground-beef', 20, 'bin-walkin-2', 'Initial stock', JSON.stringify(['tag-grass-fed']), 20.0, '2026-10-10', 'LOT-INIT-01');
  insertMeatCut.run('mc-disp-ribeye', 'prod-ribeye', 2, 'bin-display-steaks', 'Display front', JSON.stringify(['tag-grass-fed']), 3.0, '2026-10-10', 'LOT-INIT-01');
  insertMeatCut.run('mc-disp-ground', 'prod-ground-beef', 5, 'bin-display-ground', 'Display front', JSON.stringify(['tag-grass-fed']), 5.0, '2026-10-10', 'LOT-INIT-01');

  const insertHistory = db.prepare(`
    INSERT INTO history (id, timestamp, description, targetId, user, clientDevice)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertHistory.run('hist-seed', new Date().toISOString(), 'Restored baseline farm inventory state', 'system', 'Test Suite', 'Automated Harness');
}

export function parseCutsheetCsv(csvContent: string): any[] {
  const result = Papa.parse(csvContent, { header: false, skipEmptyLines: true });
  const rows = result.data as string[][];
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(cell => String(cell).toLowerCase().includes('serial'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) throw new Error('Header row with "serial" not found in CSV.');

  const dataRows = rows.slice(headerIdx + 1);
  return dataRows.map(row => ({
    serial: String(row[0] || '').trim(),
    originalCutName: String(row[1] || '').trim(),
    packDate: String(row[2] || '').trim(),
    lot: String(row[3] || '').trim(),
    pieces: parseInt(row[4] || '0', 10) || 0,
    netWeight: parseFloat(row[5] || '0') || 0,
    box: String(row[6] || '').trim(),
    pallet: String(row[7] || '').trim(),
    location: String(row[8] || '').trim()
  }));
}

export function importButcherCutsheet(
  db: Database.Database,
  order: ButcherOrder,
  records: any[],
  targetLocationName: string,
  targetPallet: string
): { addedCount: number; updatedCount: number; totalPieces: number; totalWeight: number } {
  const products = db.prepare('SELECT id, name, productNumbers, defaultTagIds FROM products').all() as any[];
  const existingEntries = db.prepare('SELECT * FROM off_site_entries WHERE orderId = ?').all(order.id) as any[];
  const existingBySerial = new Map<string, any>();
  for (const e of existingEntries) {
    if (e.serial) existingBySerial.set(e.serial.toLowerCase().trim(), e);
  }

  // Insert or update order
  const upsertOrder = db.prepare(`
    INSERT INTO butcher_orders (id, orderNumber, species, animalCount, killDate, pickupDate, liveWeight, hotWeight, coldWeight, locationId, createdAt, notes, butcherFee)
    VALUES (@id, @orderNumber, @species, @animalCount, @killDate, @pickupDate, @liveWeight, @hotWeight, @coldWeight, @locationId, @createdAt, @notes, @butcherFee)
    ON CONFLICT(id) DO UPDATE SET
      orderNumber = excluded.orderNumber,
      species = excluded.species,
      animalCount = excluded.animalCount,
      killDate = excluded.killDate,
      pickupDate = excluded.pickupDate,
      liveWeight = excluded.liveWeight,
      hotWeight = excluded.hotWeight,
      coldWeight = excluded.coldWeight,
      locationId = excluded.locationId,
      notes = excluded.notes,
      butcherFee = excluded.butcherFee
  `);
  upsertOrder.run({
    id: order.id,
    orderNumber: order.orderNumber,
    species: order.species,
    animalCount: order.animalCount || 1,
    killDate: order.killDate,
    pickupDate: order.pickupDate || '',
    liveWeight: order.liveWeight,
    hotWeight: order.hotWeight,
    coldWeight: order.coldWeight,
    locationId: order.locationId || null,
    createdAt: order.createdAt || Date.now(),
    notes: order.notes || '',
    butcherFee: order.butcherFee || 0
  });

  const insertEntry = db.prepare(`
    INSERT INTO off_site_entries (id, serial, productId, originalCutName, packDate, lot, pieces, netWeight, box, notes, tagIds, orderId, archived, staged, location, pallet, currentLocation, storageLocationId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateEntry = db.prepare(`
    UPDATE off_site_entries
    SET pieces = ?, netWeight = ?, packDate = ?, lot = ?, box = ?, tagIds = ?, originalCutName = ?, productId = ?
    WHERE id = ?
  `);

  let addedCount = 0;
  let updatedCount = 0;
  let totalPieces = 0;
  let totalWeight = 0;

  for (const r of records) {
    totalPieces += r.pieces;
    totalWeight += r.netWeight;

    // Match product by item number or name
    let matchedProductId: string | null = null;
    let defaultTags: string[] = [];
    const orig = r.originalCutName.trim();
    const numMatch = orig.match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
    const itemNumber = numMatch ? numMatch[1] : '';
    const namePart = numMatch ? numMatch[2] : orig;

    for (const p of products) {
      const pNums: string[] = p.productNumbers ? JSON.parse(p.productNumbers) : [];
      if ((itemNumber && pNums.includes(itemNumber)) || p.name.toLowerCase() === namePart.toLowerCase() || p.name.toLowerCase() === orig.toLowerCase()) {
        matchedProductId = p.id;
        defaultTags = p.defaultTagIds ? JSON.parse(p.defaultTagIds) : [];
        break;
      }
    }

    const serialKey = r.serial ? r.serial.toLowerCase().trim() : '';
    const existing = serialKey ? existingBySerial.get(serialKey) : null;

    if (existing) {
      updateEntry.run(
        r.pieces,
        r.netWeight,
        r.packDate,
        r.lot,
        r.box,
        JSON.stringify(defaultTags),
        r.originalCutName,
        matchedProductId || existing.productId,
        existing.id
      );
      updatedCount++;
    } else {
      const newId = `offsite-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      insertEntry.run(
        newId,
        r.serial,
        matchedProductId,
        r.originalCutName,
        r.packDate,
        r.lot,
        r.pieces,
        r.netWeight,
        r.box,
        '',
        JSON.stringify(defaultTags),
        order.id,
        0,
        0,
        targetLocationName,
        targetPallet,
        targetPallet,
        order.locationId || null
      );
      addedCount++;
    }
  }

  // Ensure pallet is registered
  if (targetPallet) {
    db.prepare(`
      INSERT INTO pallets (id, name, storageLocationId, isArchived)
      VALUES (?, ?, ?, 0)
      ON CONFLICT(id) DO UPDATE SET isArchived = 0, storageLocationId = excluded.storageLocationId
    `).run(targetPallet, targetPallet, order.locationId || null);
  }

  return { addedCount, updatedCount, totalPieces, totalWeight };
}

export function restoreDatabaseSnapshot(targetDbPath: string, snapshotPath: string): Database.Database {
  const targetDb = new Database(targetDbPath);
  const srcDb = new Database(snapshotPath, { readonly: true });

  targetDb.transaction(() => {
    for (const tableName of TABLE_NAMES) {
      try {
        const tableInSrc = srcDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
        if (!tableInSrc) continue;

        const srcCols = (srcDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map(c => c.name);
        const targetCols = new Set((targetDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map(c => c.name));
        const commonCols = srcCols.filter(col => targetCols.has(col));
        if (commonCols.length === 0) continue;

        const rows = srcDb.prepare(`SELECT ${commonCols.join(', ')} FROM ${tableName}`).all();
        targetDb.prepare(`DELETE FROM ${tableName}`).run();
        if (rows.length > 0) {
          const placeholders = commonCols.map(() => '?').join(',');
          const insertStmt = targetDb.prepare(`INSERT INTO ${tableName} (${commonCols.join(',')}) VALUES (${placeholders})`);
          for (const item of rows) {
            insertStmt.run(...commonCols.map(c => (item as any)[c]));
          }
        }
      } catch (err) {
        // Table copy
      }
    }
  })();

  srcDb.close();
  return targetDb;
}
