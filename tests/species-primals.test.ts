import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  AppConfigItem,
  ButcherOrder,
  InventoryState,
  Product,
  SpeciesPrimal,
} from '../types';
import {
  UNASSIGNED_PRIMAL_ID,
  applyAddSpeciesPrimal,
  applyDeleteSpeciesPrimal,
  applyEditSpeciesPrimal,
  applyRenameOrMergeSpecies,
  applyReorderSpeciesPrimals,
  buildButcherPrimalReport,
  buildSpeciesPrimalIndex,
  getAllManagedSpeciesNames,
  migrateLegacySpeciesIntoTable,
  resolvePrimalById,
  resolveProductPrimal,
} from '../utils/speciesPrimals';
import {
  BUTCHER_SPECIES_CONFIG_KEY,
  countActiveButcherFilters,
  createEmptyButcherOrderFilter,
  matchesButcherOrderFilters,
  matchesButcherRecordFilter,
} from '../utils/butcherSettings';
import {
  BUTCHER_REPORT_DEFINITIONS,
  buildButcherReportKpis,
} from '../utils/butcherReports';
import { computeOrderStats } from '../utils/butcherStats';
import { computeButcherTimelineReport } from '../utils/butcherTimelines';
import { SpeciesPrimalsManager } from '../components/SpeciesPrimalsManager';
import { ButcherPrimalReport } from '../components/ButcherPrimalReport';
import { ButcherRecordsView } from '../views/ButcherRecordsView';
import {
  createTestDatabase,
  restoreDatabaseSnapshot,
  seedSampleDatabase,
} from './test-harness';

function makeOrder(overrides: Partial<ButcherOrder> & { id: string; orderNumber: string; species: string }): ButcherOrder {
  return {
    killDate: '2026-09-15',
    pickupDate: '2026-10-01',
    liveWeight: 1200,
    hotWeight: 744,
    coldWeight: 720,
    animalCount: 1,
    createdAt: 1700000000000,
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> & { id: string; name: string }): Product {
  return {
    primaryCategory: 'Beef',
    subCategory: 'Steaks',
    ...overrides,
  };
}

describe('Species & Primal Cuts — Legacy Migration (Empty Primal Lists)', () => {
  it('migrates species from app_config and butcher_orders with empty primal lists and links speciesId idempotently', () => {
    const appConfig: AppConfigItem[] = [
      { key: BUTCHER_SPECIES_CONFIG_KEY, value: JSON.stringify(['Beef', 'Pork', 'Lamb']) },
    ];
    const orders: ButcherOrder[] = [
      makeOrder({ id: 'o1', orderNumber: '1001', species: 'Beef' }),
      makeOrder({ id: 'o2', orderNumber: '1002', species: 'Bison' }),
      makeOrder({ id: 'o3', orderNumber: '1003', species: 'pork' }),
    ];

    const first = migrateLegacySpeciesIntoTable([], appConfig, orders);
    expect(first.changedSpeciesPrimals).toBe(true);
    expect(first.changedButcherOrders).toBe(true);

    // Must migrate species ONLY — zero auto-seeded primals
    const speciesRows = first.speciesPrimals.filter((r) => r.type === 'species');
    const primalRows = first.speciesPrimals.filter((r) => r.type === 'primal');
    expect(primalRows).toHaveLength(0);
    expect(speciesRows.map((s) => s.name)).toEqual(['Beef', 'Lamb', 'Pork', 'Bison']);

    // All orders linked to canonical speciesId and canonical casing
    const beefSp = speciesRows.find((s) => s.name === 'Beef')!;
    const porkSp = speciesRows.find((s) => s.name === 'Pork')!;
    const bisonSp = speciesRows.find((s) => s.name === 'Bison')!;

    expect(first.butcherOrders.find((o) => o.id === 'o1')?.speciesId).toBe(beefSp.id);
    expect(first.butcherOrders.find((o) => o.id === 'o2')?.speciesId).toBe(bisonSp.id);
    expect(first.butcherOrders.find((o) => o.id === 'o3')?.speciesId).toBe(porkSp.id);
    expect(first.butcherOrders.find((o) => o.id === 'o3')?.species).toBe('Pork');

    // Second pass is strictly idempotent
    const second = migrateLegacySpeciesIntoTable(
      first.speciesPrimals,
      appConfig,
      first.butcherOrders,
    );
    expect(second.changedSpeciesPrimals).toBe(false);
    expect(second.changedButcherOrders).toBe(false);
    expect(second.speciesPrimals).toEqual(first.speciesPrimals);
    expect(second.butcherOrders).toEqual(first.butcherOrders);
  });

  it('merges managed species names from species_primals, legacy appConfig, and orders without duplicates', () => {
    const table: SpeciesPrimal[] = [
      { id: 'sp_beef', name: 'Beef', type: 'species', sortOrder: 0 },
      { id: 'pr_rib', name: 'Rib', type: 'primal', parentSpeciesId: 'sp_beef', sortOrder: 0 },
    ];
    const appConfig: AppConfigItem[] = [
      { key: BUTCHER_SPECIES_CONFIG_KEY, value: JSON.stringify(['beef', 'Lamb']) },
    ];
    const orders: ButcherOrder[] = [
      makeOrder({ id: 'o1', orderNumber: '1', species: 'Pork' }),
    ];

    expect(getAllManagedSpeciesNames(table, appConfig, orders)).toEqual([
      'Beef',
      'Lamb',
      'Pork',
    ]);
  });
});

describe('Species & Primal Cuts — CRUD, Reordering, Delete Guards & Atomic Merge', () => {
  it('supports adding, editing, reordering, and validating duplicates for species and primals', () => {
    let list: SpeciesPrimal[] = [];
    let orders: ButcherOrder[] = [
      makeOrder({ id: 'o1', orderNumber: '101', species: 'Beef', speciesId: 'sp_beef' }),
    ];

    const addBeef = applyAddSpeciesPrimal(list, { id: 'sp_beef', name: 'Beef', type: 'species' });
    expect(addBeef.error).toBeUndefined();
    list = addBeef.nextList;

    const dupBeef = applyAddSpeciesPrimal(list, { id: 'sp_beef_2', name: 'beef', type: 'species' });
    expect(dupBeef.error).toContain('already exists');

    const addRib = applyAddSpeciesPrimal(list, {
      id: 'pr_rib',
      name: 'Rib',
      type: 'primal',
      parentSpeciesId: 'sp_beef',
    });
    expect(addRib.error).toBeUndefined();
    list = addRib.nextList;

    const addChuck = applyAddSpeciesPrimal(list, {
      id: 'pr_chuck',
      name: 'Chuck',
      type: 'primal',
      parentSpeciesId: 'sp_beef',
    });
    expect(addChuck.error).toBeUndefined();
    list = addChuck.nextList;

    const dupRib = applyAddSpeciesPrimal(list, {
      id: 'pr_rib_dup',
      name: 'RIB',
      type: 'primal',
      parentSpeciesId: 'sp_beef',
    });
    expect(dupRib.error).toContain('already exists');

    // Reorder primals: Chuck before Rib
    list = applyReorderSpeciesPrimals(list, ['pr_chuck', 'pr_rib'], 'sp_beef');
    const idxAfterReorder = buildSpeciesPrimalIndex(list);
    expect(idxAfterReorder.primalsBySpeciesId.get('sp_beef')?.map((p) => p.id)).toEqual([
      'pr_chuck',
      'pr_rib',
    ]);

    // Edit species name propagates to linked butcher orders
    const renamed = applyEditSpeciesPrimal(list, orders, 'sp_beef', { name: 'Grass-Fed Beef' });
    expect(renamed.error).toBeUndefined();
    expect(renamed.affectedOrderCount).toBe(1);
    expect(renamed.nextOrders[0].species).toBe('Grass-Fed Beef');
    list = renamed.nextList;
    orders = renamed.nextOrders;

    // Resolve product primal dynamically
    const index = buildSpeciesPrimalIndex(list);
    const prod = makeProduct({ id: 'p1', name: 'Ribeye Steak', primalId: 'pr_rib' });
    const resolved = resolveProductPrimal(prod, index);
    expect(resolved?.fullLabel).toBe('Grass-Fed Beef · Rib');
    expect(resolvePrimalById('pr_rib', index)?.speciesId).toBe('sp_beef');
  });

  it('guards deleting species referenced by orders and reassigns or clears products on primal delete', () => {
    const list: SpeciesPrimal[] = [
      { id: 'sp_beef', name: 'Beef', type: 'species', sortOrder: 0 },
      { id: 'sp_goat', name: 'Goat', type: 'species', sortOrder: 1 },
      { id: 'pr_rib', name: 'Rib', type: 'primal', parentSpeciesId: 'sp_beef', sortOrder: 0 },
      { id: 'pr_loin', name: 'Loin', type: 'primal', parentSpeciesId: 'sp_beef', sortOrder: 1 },
      { id: 'pr_goat_leg', name: 'Leg', type: 'primal', parentSpeciesId: 'sp_goat', sortOrder: 0 },
    ];
    const products: Product[] = [
      makeProduct({ id: 'p1', name: 'Ribeye', primalId: 'pr_rib' }),
      makeProduct({ id: 'p2', name: 'Goat Roast', primalId: 'pr_goat_leg' }),
    ];
    const orders: ButcherOrder[] = [
      makeOrder({ id: 'o1', orderNumber: '101', species: 'Beef', speciesId: 'sp_beef' }),
    ];

    // Deleting Beef is blocked because o1 references it
    const blocked = applyDeleteSpeciesPrimal(list, products, orders, 'sp_beef');
    expect(blocked.deleted).toBeNull();
    expect(blocked.error).toContain('1 butcher order');

    // Deleting primal Rib with reassignment to Loin updates product p1
    const reassigned = applyDeleteSpeciesPrimal(list, products, orders, 'pr_rib', 'pr_loin');
    expect(reassigned.deleted?.id).toBe('pr_rib');
    expect(reassigned.affectedProductCount).toBe(1);
    expect(reassigned.nextProducts.find((p) => p.id === 'p1')?.primalId).toBe('pr_loin');

    // Deleting unused species Goat cascades to its child primals and clears p2.primalId
    const deletedGoat = applyDeleteSpeciesPrimal(
      reassigned.nextList,
      reassigned.nextProducts,
      orders,
      'sp_goat',
    );
    expect(deletedGoat.deleted?.id).toBe('sp_goat');
    expect(deletedGoat.deletedChildPrimalCount).toBe(1);
    expect(deletedGoat.affectedProductCount).toBe(1);
    expect(deletedGoat.nextProducts.find((p) => p.id === 'p2')?.primalId).toBeUndefined();
    expect(deletedGoat.nextList.some((i) => i.id === 'pr_goat_leg')).toBe(false);
  });

  it('merges two species atomically, deduplicating colliding primals and remapping products & orders', () => {
    const list: SpeciesPrimal[] = [
      { id: 'sp_hog', name: 'Hog', type: 'species', sortOrder: 0 },
      { id: 'sp_pork', name: 'Pork', type: 'species', sortOrder: 1 },
      { id: 'pr_hog_loin', name: 'Loin', type: 'primal', parentSpeciesId: 'sp_hog', sortOrder: 0 },
      { id: 'pr_hog_jowl', name: 'Jowl', type: 'primal', parentSpeciesId: 'sp_hog', sortOrder: 1 },
      { id: 'pr_pork_loin', name: 'Loin', type: 'primal', parentSpeciesId: 'sp_pork', sortOrder: 0 },
    ];
    const products: Product[] = [
      makeProduct({ id: 'p_chop', name: 'Hog Chop', primalId: 'pr_hog_loin' }),
      makeProduct({ id: 'p_jowl', name: 'Jowl Bacon', primalId: 'pr_hog_jowl' }),
    ];
    const orders: ButcherOrder[] = [
      makeOrder({ id: 'o1', orderNumber: '301', species: 'Hog', speciesId: 'sp_hog' }),
      makeOrder({ id: 'o2', orderNumber: '302', species: 'Pork', speciesId: 'sp_pork' }),
    ];

    const merged = applyRenameOrMergeSpecies(list, products, orders, 'Hog', 'Pork');
    expect(merged.mergedIntoExisting).toBe(true);
    expect(merged.targetSpeciesId).toBe('sp_pork');
    expect(merged.affectedOrderCount).toBe(1);
    expect(merged.affectedProductCount).toBe(1);

    // Source species and duplicate 'Loin' primal removed; unique 'Jowl' re-parented to sp_pork
    expect(merged.nextList.some((i) => i.id === 'sp_hog')).toBe(false);
    expect(merged.nextList.some((i) => i.id === 'pr_hog_loin')).toBe(false);
    const jowl = merged.nextList.find((i) => i.id === 'pr_hog_jowl');
    expect(jowl?.parentSpeciesId).toBe('sp_pork');

    // Colliding product remapped to target species' Loin primal
    expect(merged.nextProducts.find((p) => p.id === 'p_chop')?.primalId).toBe('pr_pork_loin');
    expect(merged.nextProducts.find((p) => p.id === 'p_jowl')?.primalId).toBe('pr_hog_jowl');

    // Both orders point to Pork / sp_pork
    expect(merged.nextOrders.every((o) => o.species === 'Pork' && o.speciesId === 'sp_pork')).toBe(true);
  });
});

describe('Species & Primal Cuts — Butcher Filtering, Primal Report Analytics & KPIs', () => {
  const speciesPrimals: SpeciesPrimal[] = [
    { id: 'sp_beef', name: 'Beef', type: 'species', sortOrder: 0 },
    { id: 'pr_rib', name: 'Rib', type: 'primal', parentSpeciesId: 'sp_beef', sortOrder: 0 },
    { id: 'pr_chuck', name: 'Chuck', type: 'primal', parentSpeciesId: 'sp_beef', sortOrder: 1 },
  ];

  const products: Product[] = [
    makeProduct({ id: 'prod-ribeye', name: 'Ribeye Steak', primalId: 'pr_rib', salePrice: 24, salePriceUnit: 'lb' }),
    makeProduct({ id: 'prod-chuck', name: 'Chuck Roast', primalId: 'pr_chuck', salePrice: 12, salePriceUnit: 'lb' }),
    makeProduct({ id: 'prod-bones', name: 'Soup Bones', salePrice: 5, salePriceUnit: 'lb' }), // Unassigned
  ];

  const order1 = makeOrder({
    id: 'ord-1',
    orderNumber: '5001',
    species: 'Beef',
    speciesId: 'sp_beef',
    animalCount: 2,
    killDate: '2026-08-01',
    liveWeight: 2400,
    hotWeight: 1480,
    coldWeight: 1400,
  });
  const order2 = makeOrder({
    id: 'ord-2',
    orderNumber: '5002',
    species: 'Beef',
    speciesId: 'sp_beef',
    animalCount: 1,
    killDate: '2026-09-01',
    liveWeight: 1200,
    hotWeight: 740,
    coldWeight: 700,
  });

  const recordsByOrderId = new Map<string, any[]>([
    [
      'ord-1',
      [
        { orderId: 'ord-1', productId: 'prod-ribeye', originalCutName: 'Ribeye', normalizedCutName: 'Ribeye Steak', pieces: 20, netWeight: 60 },
        { orderId: 'ord-1', productId: 'prod-chuck', originalCutName: 'Chuck', normalizedCutName: 'Chuck Roast', pieces: 15, netWeight: 120 },
        { orderId: 'ord-1', productId: 'prod-bones', originalCutName: 'Bones', normalizedCutName: 'Soup Bones', pieces: 10, netWeight: 20 },
      ],
    ],
    [
      'ord-2',
      [
        { orderId: 'ord-2', productId: 'prod-ribeye', originalCutName: 'Ribeye', normalizedCutName: 'Ribeye Steak', pieces: 12, netWeight: 40 },
        { orderId: 'ord-2', productId: 'prod-chuck', originalCutName: 'Chuck', normalizedCutName: 'Chuck Roast', pieces: 8, netWeight: 60 },
      ],
    ],
  ]);

  it('filters butcher records and orders by primalIds including UNASSIGNED_PRIMAL_ID', () => {
    const empty = createEmptyButcherOrderFilter();
    expect(empty.primalIds).toEqual([]);
    expect(countActiveButcherFilters(empty)).toBe(0);

    const ribFilter = { ...empty, primalIds: ['pr_rib'] };
    expect(countActiveButcherFilters(ribFilter)).toBe(1);
    expect(matchesButcherRecordFilter({ primalId: 'pr_rib' }, ribFilter)).toBe(true);
    expect(matchesButcherRecordFilter({ primalId: 'pr_chuck' }, ribFilter)).toBe(false);
    expect(matchesButcherRecordFilter({ primalId: undefined }, ribFilter)).toBe(false);

    const unassignedFilter = { ...empty, primalIds: [UNASSIGNED_PRIMAL_ID] };
    expect(matchesButcherRecordFilter({ primalId: undefined }, unassignedFilter)).toBe(true);
    expect(matchesButcherRecordFilter({ primalId: 'pr_rib' }, unassignedFilter)).toBe(false);

    // Order-level filter: ord-1 has unassigned bones, ord-2 does not
    expect(
      matchesButcherOrderFilters(
        order1,
        recordsByOrderId.get('ord-1')!.map((r) => ({
          ...r,
          primalId: products.find((p) => p.id === r.productId)?.primalId,
        })),
        unassignedFilter,
      ),
    ).toBe(true);
    expect(
      matchesButcherOrderFilters(
        order2,
        recordsByOrderId.get('ord-2')!.map((r) => ({
          ...r,
          primalId: products.find((p) => p.id === r.productId)?.primalId,
        })),
        unassignedFilter,
      ),
    ).toBe(false);
  });

  it('builds accurate Butcher Primal Report aggregates, child cuts, unassigned audit bucket, trendPoints, and KPIs', () => {
    const ordersWithStats = [order1, order2].map((order) => ({
      order,
      stats: computeOrderStats(order, recordsByOrderId.get(order.id) || []),
    }));

    const report = buildButcherPrimalReport(
      ordersWithStats,
      recordsByOrderId,
      products,
      speciesPrimals,
    );

    // Total weight = 60 + 120 + 20 + 40 + 60 = 300 lbs; Assigned = 280; Unassigned = 20
    expect(report.totalPackagedWeight).toBeCloseTo(300, 4);
    expect(report.totalAssignedWeight).toBeCloseTo(280, 4);
    expect(report.totalUnassignedWeight).toBeCloseTo(20, 4);
    expect(report.assignedCoveragePct).toBeCloseTo((280 / 300) * 100, 3);
    expect(report.totalAnimalCount).toBe(3);
    expect(report.totalColdWeight).toBeCloseTo(2100, 4);

    // Assigned rows sorted descending by weight: Chuck (180 lbs), Rib (100 lbs); Unassigned last (20 lbs)
    expect(report.rows.map((r) => r.primalId)).toEqual(['pr_chuck', 'pr_rib', UNASSIGNED_PRIMAL_ID]);
    const chuckRow = report.rows[0];
    expect(chuckRow.totalWeight).toBeCloseTo(180, 4);
    expect(chuckRow.pctOfPackaged).toBeCloseTo(60, 4);
    expect(chuckRow.pctOfColdCarcass).toBeCloseTo((180 / 2100) * 100, 3);
    expect(chuckRow.avgWeightPerHead).toBeCloseTo(60, 4);
    expect(chuckRow.estValue).toBeCloseTo(180 * 12, 2);
    expect(chuckRow.cuts).toHaveLength(1);
    expect(chuckRow.cuts[0].name).toBe('Chuck Roast');

    const ribRow = report.rows[1];
    expect(ribRow.totalWeight).toBeCloseTo(100, 4);
    expect(ribRow.estValue).toBeCloseTo(100 * 24, 2);

    expect(report.unassignedRow?.totalWeight).toBeCloseTo(20, 4);

    // Multi-order trend points
    expect(report.trendPoints).toHaveLength(2);
    expect(report.trendPoints[0].orderNumber).toBe('5001');
    expect(report.trendPoints[0].pctByPrimalId['pr_chuck']).toBeCloseTo(60, 3);
    expect(report.trendPoints[1].pctByPrimalId['pr_rib']).toBeCloseTo(40, 3);

    // Contextual KPIs for 'primals' report
    expect(BUTCHER_REPORT_DEFINITIONS.some((d) => d.id === 'primals')).toBe(true);
    const kpis = buildButcherReportKpis('primals', {
      orderCount: 2,
      animalCount: 3,
      reportMode: 'actuals',
      averages: {
        avgLive: 1200,
        avgHot: 740,
        avgCold: 700,
        avgPackaged: 100,
        avgHotYield: 61.67,
        avgShrink: 5.41,
        avgCutYield: 14.29,
        avgFinishLive: 8.33,
      },
      ordersWithStats,
      totalPackagedLbs: 300,
      cutTrends: { selectedCuts: [], mode: 'compare', additivePoints: [] },
      breakdown: {
        allRows: [],
        filteredRows: [],
        totalWeightAll: 300,
        searchQuery: '',
        totalEstValue: 0,
        pricedCutCount: 0,
      },
      primalReport: report,
      speciesComparison: [],
      timelineReport: computeButcherTimelineReport([], new Map()),
    });

    expect(kpis.length).toBeGreaterThanOrEqual(5);
    expect(kpis.find((k) => k.id === 'primal-tracked')?.value).toBe('2');
    expect(kpis.find((k) => k.id === 'primal-top')?.value).toBe('Chuck');
    expect(kpis.find((k) => k.id === 'primal-coverage')?.value).toBe('93.3%');
    expect(kpis.find((k) => k.id === 'primal-unassigned')?.value).toBe('20.0');
  });

  it('renders SSR smoke output for SpeciesPrimalsManager, ButcherPrimalReport, and ButcherRecordsView primals & grouped breakdown tabs', () => {
    const ordersWithStats = [order1, order2].map((order) => ({
      order,
      stats: computeOrderStats(order, recordsByOrderId.get(order.id) || []),
    }));
    const report = buildButcherPrimalReport(
      ordersWithStats,
      recordsByOrderId,
      products,
      speciesPrimals,
    );

    const mockState = {
      freezers: [],
      containers: [],
      containerTemplates: [],
      products,
      categories: [],
      speciesPrimals,
      meatCuts: [],
      history: [],
      customLists: [],
      tags: [],
      locations: [],
      pallets: [],
      boxes: [],
      offSiteEntries: [],
      movementOrders: [],
      butcherOrders: [order1, order2],
      butcherRecords: [
        ...recordsByOrderId.get('ord-1')!.map((r, i) => ({ id: `r1-${i}`, serial: `S1-${i}`, ...r })),
        ...recordsByOrderId.get('ord-2')!.map((r, i) => ({ id: `r2-${i}`, serial: `S2-${i}`, ...r })),
      ],
      appConfig: [],
    } as unknown as InventoryState;

    const managerHtml = renderToStaticMarkup(
      React.createElement(SpeciesPrimalsManager, {
        state: mockState,
        dispatch: () => {},
      }),
    );
    expect(managerHtml).toContain('Species &amp; Primal Cuts');
    expect(managerHtml).toContain('Beef');
    expect(managerHtml).toContain('Rib');
    expect(managerHtml).toContain('Chuck');

    const primalReportHtml = renderToStaticMarkup(
      React.createElement(ButcherPrimalReport, {
        report,
        availableSpecies: ['Beef'],
        selectedSpeciesScope: 'ALL',
        onChangeSpeciesScope: () => {},
        totalMatchingOrdersBeforeScope: 2,
      }),
    );
    expect(primalReportHtml).toContain('data-testid="butcher-reports-primals-panel"');
    expect(primalReportHtml).toContain('data-testid="butcher-primal-trend-chart"');
    expect(primalReportHtml).toContain('Primal Yield Over Time');
    expect(primalReportHtml).toContain('Totals (2 orders · 3 head)');
    expect(primalReportHtml).toContain('Chuck');
    expect(primalReportHtml).toContain('Rib');
    expect(primalReportHtml).toContain('Unassigned Primal');

    const recordsPrimalsViewHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: mockState,
        dispatch: () => {},
        activeTab: 'reports',
        initialReportType: 'primals',
      }),
    );
    expect(recordsPrimalsViewHtml).toContain('data-report-type="primals"');
    expect(recordsPrimalsViewHtml).toContain('data-testid="butcher-reports-primals-panel"');
    expect(recordsPrimalsViewHtml).toContain('Primals Tracked');

    const recordsBreakdownViewHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: mockState,
        dispatch: () => {},
        activeTab: 'reports',
        initialReportType: 'breakdown',
      }),
    );
    expect(recordsBreakdownViewHtml).toContain('data-testid="butcher-breakdown-flat-toggle"');
    expect(recordsBreakdownViewHtml).toContain('data-testid="butcher-breakdown-primal-toggle"');
    expect(recordsBreakdownViewHtml).toContain('Group by Primal');
    expect(recordsBreakdownViewHtml).toContain('Beef · Chuck');
    expect(recordsBreakdownViewHtml).toContain('Beef · Rib');
  });
});

describe('Species & Primal Cuts — SQLite Backup & Restore Integrity (25-Table Schema)', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()!;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('preserves species_primals table, products.primalId, and butcher_orders.speciesId across SQLite snapshot & restore', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fit-species-primals-'));
    tempDirs.push(tmpDir);

    const liveDbPath = path.join(tmpDir, 'live.db');
    const backupPath = path.join(tmpDir, 'backup.db');

    const liveDb = createTestDatabase(liveDbPath);
    seedSampleDatabase(liveDb);

    // Populate species_primals, link product primalId, and link butcher_order speciesId
    liveDb
      .prepare(
        `INSERT INTO species_primals (id, name, type, parentSpeciesId, icon, description, sortOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('sp_beef', 'Beef', 'species', null, 'Beef', 'Cattle', 0);
    liveDb
      .prepare(
        `INSERT INTO species_primals (id, name, type, parentSpeciesId, icon, description, sortOrder)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('pr_rib', 'Rib', 'primal', 'sp_beef', null, 'Ribeye & Prime Rib', 0);

    liveDb.prepare('UPDATE products SET primalId = ? WHERE id = ?').run('pr_rib', 'prod-ribeye');
    liveDb
      .prepare(
        `INSERT INTO butcher_orders (id, orderNumber, species, speciesId, animalCount, killDate, liveWeight, hotWeight, coldWeight, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run('ord-bkp-1', '7701', 'Beef', 'sp_beef', 1, '2026-10-01', 1250, 775, 750, Date.now());

    // Create SQLite snapshot via VACUUM INTO
    liveDb.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

    // Wipe live tables to simulate corruption / deletion
    liveDb.prepare('DELETE FROM species_primals').run();
    liveDb.prepare('UPDATE products SET primalId = NULL').run();
    liveDb.prepare('DELETE FROM butcher_orders').run();
    liveDb.close();

    // Restore from backup snapshot
    const restoredDb = restoreDatabaseSnapshot(liveDbPath, backupPath);

    const spRows = restoredDb.prepare('SELECT * FROM species_primals ORDER BY type DESC, sortOrder ASC').all() as any[];
    expect(spRows).toHaveLength(2);
    expect(spRows.find((r) => r.id === 'sp_beef')?.name).toBe('Beef');
    expect(spRows.find((r) => r.id === 'pr_rib')?.parentSpeciesId).toBe('sp_beef');

    const restoredRibeye = restoredDb.prepare('SELECT primalId FROM products WHERE id = ?').get('prod-ribeye') as any;
    expect(restoredRibeye?.primalId).toBe('pr_rib');

    const restoredOrder = restoredDb.prepare('SELECT species, speciesId FROM butcher_orders WHERE id = ?').get('ord-bkp-1') as any;
    expect(restoredOrder?.species).toBe('Beef');
    expect(restoredOrder?.speciesId).toBe('sp_beef');

    restoredDb.close();
  });
});
