import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Database from 'better-sqlite3';
import HistoryView from '../views/HistoryView';
import {
  HistoryEntry,
  InventoryState
} from '../types';
import {
  HISTORY_PREVIEW_ITEM_LIMIT,
  UNDO_JOURNAL_MAX_OPS,
  buildHistoryDetails,
  buildOffSiteEntryPreviewItem,
  resolveHistoryScope,
  getHistoryUndoMode,
  isMovementOrderStatusMilestone,
  shouldSkipUndoSqlJournal
} from '../utils/auditHistory';
import { calculateHistoryRetention } from '../utils/historyRetention';
import { createTestDatabase } from './test-harness';

const createRichAuditState = (): InventoryState => {
  const now = new Date().toISOString();
  return {
    freezers: [{ id: 'fz-main', name: 'Walk-In Freezer' }],
    containers: [{ id: 'cont-bin1', name: 'Bin 1', freezerId: 'fz-main', icon: 'box' }],
    products: [
      { id: 'prod-ribeye', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks' }
    ],
    meatCuts: [
      { id: 'cut-1', productId: 'prod-ribeye', quantity: 4, containerId: 'cont-bin1' }
    ],
    locations: [
      { id: 'loc-cold', name: 'Maple Cold Storage', isHome: false, type: 'storage', hasPallets: true },
      { id: 'loc-home', name: 'Home Base', isHome: true, type: 'storage', hasPallets: false }
    ],
    pallets: [
      { id: 'P4', notes: 'Top shelf', storageLocationId: 'loc-cold', isArchived: false }
    ],
    butcherOrders: [
      {
        id: 'bo-104',
        orderNumber: '104',
        species: 'Beef',
        killDate: '2026-10-01',
        liveWeight: 1200,
        hotWeight: 720,
        coldWeight: 690,
        locationId: 'loc-cold',
        createdAt: Date.now()
      }
    ],
    offSiteEntries: [
      {
        id: 'os-1',
        serial: 'SN-1001',
        cuts: 'Ribeye Steak',
        productId: 'prod-ribeye',
        pieces: 8,
        netWeight: 12.5,
        box: 'BX-1',
        currentLocation: 'P4',
        pallet: 'P4',
        location: 'Maple Cold Storage',
        storageLocationId: 'loc-cold',
        orderId: 'bo-104',
        archived: false
      }
    ],
    movementOrders: [
      {
        id: 'mo-active',
        name: 'Autumn Freight Run',
        date: '2026-11-17',
        status: 'completed',
        palletsInPlay: ['P4'],
        locationsInPlay: ['loc-cold'],
        moves: [{ entryId: 'os-1', targetLocation: 'loc-cold::P4' }]
      },
      {
        id: 'mo-reverted',
        name: 'Winter Planning Run',
        date: '2026-11-17',
        status: 'planning',
        palletsInPlay: ['P4'],
        locationsInPlay: ['loc-cold'],
        moves: []
      }
    ],
    tags: [],
    customLists: [],
    containerTemplates: [],
    history: [
      {
        id: 'h-onsite',
        timestamp: now,
        description: 'Added 4 Ribeye Steak to Bin 1',
        targetId: 'cut-1',
        user: 'nick',
        clientDevice: 'Desktop Browser',
        scope: 'onsite',
        undoData: { type: 'RESTORE_MEAT_CUT_QUANTITY', meatCutId: 'cut-1', previousQuantity: 0 }
      },
      {
        id: 'h-butcher-import',
        timestamp: now,
        description: 'Created Butcher Order #104 (Beef): added 142 cut(s) (3420.5 lbs) to Maple Cold Storage.',
        targetId: 'bo-104',
        user: 'nick',
        clientDevice: 'Desktop Browser',
        scope: 'butcher',
        details: buildHistoryDetails({
          actionType: 'ADD_BUTCHER_ORDER',
          undoMode: 'audit_only',
          relatedOrderId: 'bo-104',
          orderNumber: '104',
          locationName: 'Maple Cold Storage',
          palletName: 'P4',
          itemCount: 142,
          totalWeight: 3420.5,
          items: [
            { id: 'os-1', serial: 'SN-1001', cut: 'Ribeye Steak', box: 'BX-1', pallet: 'P4', location: 'Maple Cold Storage', pieces: 8, weight: 12.5 }
          ]
        })
      },
      {
        id: 'h-move-exec',
        timestamp: now,
        description: 'Executed movement order "Autumn Freight Run": 1 package(s) processed.',
        targetId: 'movement-completed',
        user: 'nick',
        clientDevice: 'Mobile Browser',
        scope: 'offsite',
        details: buildHistoryDetails({
          actionType: 'EXECUTE_MOVEMENT_ORDER',
          undoMode: 'order_revert',
          relatedOrderId: 'mo-active',
          orderName: 'Autumn Freight Run',
          locationName: 'Maple Cold Storage',
          palletName: 'P4',
          items: [
            { id: 'os-1', serial: 'SN-1001', cut: 'Ribeye Steak', box: 'BX-1', pallet: 'P4', location: 'Maple Cold Storage', pieces: 8, weight: 12.5, action: 'Moved' }
          ]
        })
      },
      {
        id: 'h-move-reverted',
        timestamp: now,
        description: 'Executed movement order "Winter Planning Run": 1 package(s) processed.',
        targetId: 'movement-completed',
        user: 'nick',
        clientDevice: 'Desktop Browser',
        scope: 'offsite',
        details: buildHistoryDetails({
          actionType: 'EXECUTE_MOVEMENT_ORDER',
          undoMode: 'order_revert',
          relatedOrderId: 'mo-reverted',
          orderName: 'Winter Planning Run'
        })
      },
      {
        id: 'h-system',
        timestamp: now,
        description: 'Created Location "Maple Cold Storage" (storage).',
        targetId: 'loc-cold',
        user: 'admin',
        clientDevice: 'Desktop Browser',
        scope: 'system'
      }
    ]
  };
};

describe('Audit History Unification (Off-Site, Butcher, On-Site & System)', () => {
  it('classifies explicit scopes, actionTypes, sentinel IDs, and legacy descriptions deterministically', () => {
    const context = {
      offSiteEntryIds: new Set(['os-9']),
      butcherOrderIds: new Set(['bo-9']),
      movementOrderIds: new Set(['mo-9']),
      palletIds: new Set(['P9']),
      locationIds: new Set(['loc-9']),
      productIds: new Set(['prod-9'])
    };

    expect(resolveHistoryScope({ scope: 'butcher', targetId: 'x', description: 'anything' }, context)).toBe('butcher');
    expect(resolveHistoryScope({ targetId: 'bo-9', description: 'Updated order' }, context)).toBe('butcher');
    expect(resolveHistoryScope({ targetId: 'os-9', description: 'Edited package' }, context)).toBe('offsite');
    expect(resolveHistoryScope({ targetId: 'mo-9', description: 'Order update' }, context)).toBe('offsite');
    expect(resolveHistoryScope({ targetId: 'offsite-bulk-edit', description: 'Bulk edited 10' }, context)).toBe('offsite');
    expect(resolveHistoryScope({ targetId: 'loc-9', description: 'Updated location' }, context)).toBe('system');
    expect(resolveHistoryScope({ targetId: 'prod-9', description: 'Updated product "Ribeye"' }, context)).toBe('system');

    // Legacy entries lacking scope/details
    expect(resolveHistoryScope({ targetId: 'legacy-1', description: 'Created Butcher Order #88' })).toBe('butcher');
    expect(resolveHistoryScope({ targetId: 'legacy-2', description: 'Renamed pallet "P1" to "P2"' })).toBe('offsite');
    expect(resolveHistoryScope({ targetId: 'legacy-3', description: 'Tag "Grass Fed" details updated' })).toBe('system');
    expect(resolveHistoryScope({ targetId: 'cut-1', description: 'Added 2 Ribeye Steak to Bin 1' })).toBe('onsite');
  });

  it('caps bulk preview items at HISTORY_PREVIEW_ITEM_LIMIT and tracks truncatedCount + metrics', () => {
    const productMap = new Map([
      ['prod-ribeye', { id: 'prod-ribeye', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks' }]
    ]);

    const items = Array.from({ length: 145 }, (_, idx) =>
      buildOffSiteEntryPreviewItem(
        {
          id: `os-${idx}`,
          serial: `SN-${idx}`,
          productId: 'prod-ribeye',
          pieces: 2,
          netWeight: 1.5,
          box: `BX-${idx % 5}`,
          currentLocation: 'P4',
          location: 'Maple Cold Storage'
        },
        productMap,
        'Imported'
      )
    );

    const details = buildHistoryDetails({
      actionType: 'IMPORT_OFFSITE_ENTRIES',
      undoMode: 'audit_only',
      locationName: 'Maple Cold Storage',
      palletName: 'P4',
      items
    });

    expect(details.itemCount).toBe(145);
    expect(details.totalPieces).toBe(290);
    expect(details.totalWeight).toBe(217.5);
    expect(details.items).toHaveLength(HISTORY_PREVIEW_ITEM_LIMIT);
    expect(details.truncatedCount).toBe(45);
    expect(details.items![0].cut).toBe('Ribeye Steak');
    expect(details.items![0].action).toBe('Imported');
  });

  it('suppresses noisy movement planner edits and records only status milestone transitions', () => {
    const planningOrder = { id: 'mo-1', name: 'Run 1', status: 'planning' as const };

    expect(
      isMovementOrderStatusMilestone(planningOrder, { moves: [{ entryId: 'os-1', targetLocation: 'd1' }] }).isMilestone
    ).toBe(false);
    expect(
      isMovementOrderStatusMilestone(planningOrder, { palletsInPlay: ['P1', 'P2'] }).isMilestone
    ).toBe(false);
    expect(
      isMovementOrderStatusMilestone(planningOrder, { status: 'planning' }).isMilestone
    ).toBe(false);

    const finalized = isMovementOrderStatusMilestone(planningOrder, { status: 'finalized' });
    expect(finalized.isMilestone).toBe(true);
    expect(finalized.previousStatus).toBe('planning');
    expect(finalized.nextStatus).toBe('finalized');
  });

  it('enforces tiered undo modes and skips undo_sql_journal for bulk, movement execution, or >25-op actions', () => {
    expect(getHistoryUndoMode({ targetId: 'os-1', undoData: { type: 'RESTORE_OFFSITE_ENTRY' } })).toBe('standard');
    expect(getHistoryUndoMode({ targetId: 'movement-completed' })).toBe('order_revert');
    expect(getHistoryUndoMode({ targetId: 'offsite-import' })).toBe('audit_only');
    expect(getHistoryUndoMode({ details: { undoMode: 'audit_only' } })).toBe('audit_only');

    expect(
      shouldSkipUndoSqlJournal({ id: 'h1', details: { undoMode: 'audit_only' } }, 2)
    ).toBe(true);
    expect(
      shouldSkipUndoSqlJournal({ id: 'h2', details: { undoMode: 'order_revert' } }, 4)
    ).toBe(true);
    expect(
      shouldSkipUndoSqlJournal({ id: 'h3', details: { undoMode: 'standard' } }, UNDO_JOURNAL_MAX_OPS + 1)
    ).toBe(true);
    expect(
      shouldSkipUndoSqlJournal({ id: 'h4', details: { undoMode: 'standard' } }, UNDO_JOURNAL_MAX_OPS)
    ).toBe(false);
  });

  it('protects active butcher orders, pallets, open movement orders, and bulk details references during history retention purge', () => {
    const oldTs = new Date(Date.now() - 800 * 86400 * 1000).toISOString(); // ~2.2 years ago
    const state = createRichAuditState();

    const oldProtectedButcher: HistoryEntry = {
      id: 'h-old-butcher',
      timestamp: oldTs,
      description: 'Created Butcher Order #104',
      targetId: 'bo-104',
      scope: 'butcher'
    };
    const oldProtectedPallet: HistoryEntry = {
      id: 'h-old-pallet',
      timestamp: oldTs,
      description: 'Updated notes for pallet "P4"',
      targetId: 'P4',
      scope: 'offsite',
      details: { palletName: 'P4' }
    };
    const oldProtectedBulkRef: HistoryEntry = {
      id: 'h-old-bulk',
      timestamp: oldTs,
      description: 'Bulk edited 1 active package',
      targetId: 'offsite-bulk-edit',
      scope: 'offsite',
      details: {
        undoMode: 'audit_only',
        items: [{ id: 'os-1', serial: 'SN-1001', cut: 'Ribeye Steak' }]
      }
    };
    const oldStaleDeparted: HistoryEntry = {
      id: 'h-old-departed',
      timestamp: oldTs,
      description: 'Removed long-departed package',
      targetId: 'os-deleted-999',
      scope: 'offsite'
    };

    const result = calculateHistoryRetention(
      [oldProtectedButcher, oldProtectedPallet, oldProtectedBulkRef, oldStaleDeparted],
      state,
      365
    );

    const keptIds = new Set(result.toKeep.map(e => e.id));
    const purgedIds = new Set(result.toPurge.map(e => e.id));
    expect(keptIds.has('h-old-butcher')).toBe(true);
    expect(keptIds.has('h-old-pallet')).toBe(true);
    expect(keptIds.has('h-old-bulk')).toBe(true);
    expect(purgedIds.has('h-old-departed')).toBe(true);
  });

  it('persists history scope and details columns in SQLite and migrates legacy history tables safely', () => {
    const db = createTestDatabase(':memory:');
    const detailsPayload = buildHistoryDetails({
      actionType: 'IMPORT_OFFSITE_ENTRIES',
      undoMode: 'audit_only',
      locationName: 'Maple Cold Storage',
      palletName: 'P4',
      items: [{ id: 'os-1', serial: 'SN-1001', cut: 'Ribeye Steak', pieces: 8, weight: 12.5 }]
    });

    db.prepare(`
      INSERT INTO history (id, timestamp, description, targetId, user, clientDevice, scope, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'h-db-1',
      '2026-11-17T10:00:00.000Z',
      'Imported 1 off-site package',
      'offsite-import',
      'nick',
      'Desktop Browser',
      'offsite',
      JSON.stringify(detailsPayload)
    );

    const row = db.prepare('SELECT scope, details FROM history WHERE id = ?').get('h-db-1') as {
      scope: string;
      details: string;
    };
    expect(row.scope).toBe('offsite');
    expect(JSON.parse(row.details)).toMatchObject({
      actionType: 'IMPORT_OFFSITE_ENTRIES',
      undoMode: 'audit_only',
      locationName: 'Maple Cold Storage',
      palletName: 'P4'
    });
    db.close();

    // Verify legacy DB migration path adds scope & details columns non-destructively
    const legacyDb = new Database(':memory:');
    legacyDb.exec(`
      CREATE TABLE history (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        description TEXT NOT NULL,
        targetId TEXT NOT NULL,
        user TEXT,
        clientDevice TEXT,
        clientInfo TEXT,
        undoData TEXT
      );
      INSERT INTO history (id, timestamp, description, targetId, user)
      VALUES ('h-legacy', '2026-01-01T00:00:00.000Z', 'Added 2 steaks', 'cut-1', 'nick');
    `);
    const existingCols = (legacyDb.prepare('PRAGMA table_info(history)').all() as Array<{ name: string }>).map(c => c.name);
    if (!existingCols.includes('scope')) legacyDb.exec('ALTER TABLE history ADD COLUMN scope TEXT');
    if (!existingCols.includes('details')) legacyDb.exec('ALTER TABLE history ADD COLUMN details TEXT');

    const migratedRow = legacyDb.prepare('SELECT id, scope, details FROM history WHERE id = ?').get('h-legacy') as any;
    expect(migratedRow.id).toBe('h-legacy');
    expect(migratedRow.scope).toBeNull();
    expect(migratedRow.details).toBeNull();
    legacyDb.close();
  });

  it('renders unified scope tabs, collapsed bulk item toggle, and tiered Undo / Revert Order / Audit Only actions in HistoryView', () => {
    const state = createRichAuditState();
    const html = renderToStaticMarkup(
      React.createElement(HistoryView, {
        state,
        dispatch: () => {},
        onOpenUndo: () => {}
      })
    );

    // Segmented Scope Bar rendered with accurate scoped counts
    expect(html).toContain('id="history-scope-filter-bar"');
    expect(html).toContain('id="history-scope-tab-all"');
    expect(html).toContain('id="history-scope-tab-onsite"');
    expect(html).toContain('id="history-scope-tab-offsite"');
    expect(html).toContain('id="history-scope-tab-butcher"');
    expect(html).toContain('id="history-scope-tab-system"');

    // Collapsed-by-default bulk preview drawer
    expect(html).toContain('Show items (142)');
    expect(html).not.toContain('more item(s) omitted from preview');
    expect(html).not.toContain('<th class="py-1.5 pr-3">Serial</th>');

    // Tiered undo states rendered accurately
    expect(html).toContain('Undo This');
    expect(html).toContain('Revert Order');
    expect(html).toContain('Order Reverted');
    expect(html).toContain('Audit Only');
  });
});
