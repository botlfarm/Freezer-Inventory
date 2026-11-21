import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AppConfigItem,
  ButcherDocumentLinkType,
  ButcherOrder,
  ButcherOrderTag,
  ButcherRecord,
} from '../types';
import {
  BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY,
  BUTCHER_BASELINE_GROUPING_CONFIG_KEY,
  BUTCHER_SPECIES_CONFIG_KEY,
  BUTCHER_ORDER_TAGS_CONFIG_KEY,
  BUTCHER_DOC_LINK_TYPES_CONFIG_KEY,
  hasButcherAnomalySensitivityConfig,
  parseButcherAnomalySensitivity,
  normalizeButcherBaselineGroupingMode,
  parseButcherBaselineGroupingMode,
  parseButcherSpeciesList,
  parseButcherOrderTags,
  parseButcherDocumentLinkTypes,
  getAllButcherSpeciesOptions,
  getButcherSpeciesUsageCounts,
  getButcherTagUsageCounts,
  getButcherDocLinkTypeUsageCounts,
  resolveDocumentDisplayName,
  resolveOrderTags,
  applyButcherSpeciesRename,
  applyButcherOrderTagDelete,
  applyButcherDocumentTypeRename,
  applyButcherDocumentTypeDelete,
} from '../utils/butcherSettings';
import {
  BUTCHER_USER_CONFIG_KEYS,
  canNonAdminWriteAppConfig,
} from '../utils/appConfigPermissions';
import {
  DEFAULT_ANOMALY_SENSITIVITY,
  MIN_ANOMALY_SENSITIVITY,
  MAX_ANOMALY_SENSITIVITY,
  groupRecordsByOrderId,
  computeSpeciesBaselines,
  analyzeOrderAnomalies,
  listAvailableBaselineScopesForOrder,
  analyzeOrderReviewQueue,
} from '../utils/butcherStats';
import { createTestDatabase, importButcherCutsheet } from './test-harness';
import { ButcherSettingsPanel } from '../components/ButcherSettingsPanel';
import { ButcherRecordsView } from '../views/ButcherRecordsView';
import { UserAuthProvider } from '../hooks/useUserAuth';

function makeOrder(overrides: Partial<ButcherOrder> & { id: string }): ButcherOrder {
  return {
    orderNumber: `BO-${overrides.id}`,
    species: 'Pork',
    animalCount: 1,
    killDate: '2026-08-01',
    pickupDate: '2026-08-15',
    liveWeight: 280,
    hotWeight: 207.2, // 74.0%
    coldWeight: 201.0, // ~3.0% cooler shrink
    butcherFee: 250,
    createdAt: 1700000000000,
    ...overrides,
  };
}

function makeRecord(orderId: string, netWeight: number): ButcherRecord {
  return {
    id: `rec-${orderId}`,
    serial: `SN-${orderId}`,
    productId: 'prod-pork',
    cuts: 'Pork Cuts',
    pieces: 60,
    netWeight,
    orderId,
  };
}

describe('Butcher Settings — Parsing, Zero-Default Guarantees & Usage Counters', () => {
  it('starts with zero pre-populated defaults for species, tags, and document link types', () => {
    expect(parseButcherSpeciesList([])).toEqual([]);
    expect(parseButcherOrderTags([])).toEqual([]);
    expect(parseButcherDocumentLinkTypes([])).toEqual([]);
    expect(parseButcherDocumentLinkTypes(undefined)).toEqual([]);
  });

  it('merges managed species with legacy order species case-insensitively without duplicates', () => {
    const orders = [
      makeOrder({ id: '1', species: 'Pig' }),
      makeOrder({ id: '2', species: 'beef' }),
      makeOrder({ id: '3', species: 'Pig' }),
    ];
    const merged = getAllButcherSpeciesOptions(['Beef', 'Lamb'], orders);
    expect(merged).toEqual(['Beef', 'Lamb', 'Pig']);

    const counts = getButcherSpeciesUsageCounts(orders);
    expect(counts.get('pig')).toEqual({ label: 'Pig', count: 2 });
    expect(counts.get('beef')).toEqual({ label: 'beef', count: 1 });
  });

  it('parses valid butcher order tags with fallback weightCheckMode and counts assignments', () => {
    const appConfig: AppConfigItem[] = [
      {
        key: BUTCHER_ORDER_TAGS_CONFIG_KEY,
        value: JSON.stringify([
          { id: 'tag-sow', name: 'Retired Sow', color: '#f59e0b', weightCheckMode: 'separate_baseline' },
          { id: 'tag-bad-mode', name: 'Custom Lot', weightCheckMode: 'invalid_mode' },
        ]),
      },
    ];
    const parsed = parseButcherOrderTags(appConfig);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].weightCheckMode).toBe('separate_baseline');
    expect(parsed[1].weightCheckMode).toBe('normal');

    const orders = [
      makeOrder({ id: 'o1', tagIds: ['tag-sow'] }),
      makeOrder({ id: 'o2', tagIds: ['tag-sow', 'tag-bad-mode'] }),
    ];
    const usage = getButcherTagUsageCounts(orders);
    expect(usage.get('tag-sow')).toBe(2);
    expect(usage.get('tag-bad-mode')).toBe(1);
    expect(resolveOrderTags({ tagIds: ['tag-sow', 'deleted-id'] }, parsed).map((t) => t.name)).toEqual(['Retired Sow']);
  });
});

describe('Butcher Settings — Atomic Bulk Mutations (Species Rename/Merge, Tag Delete, Doc Type Rename/Delete)', () => {
  it('bulk renames and merges Butcher Species across all orders and managed list atomically', () => {
    const orders = [
      makeOrder({ id: 'o1', species: 'Pig' }),
      makeOrder({ id: 'o2', species: 'pig' }),
      makeOrder({ id: 'o3', species: 'Pork' }),
      makeOrder({ id: 'o4', species: 'Beef' }),
    ];
    const result = applyButcherSpeciesRename(orders, ['Pig', 'Pork', 'Beef'], 'Pig', 'Pork');
    expect(result.affectedOrderCount).toBe(2);
    expect(result.mergedIntoExisting).toBe(true);
    expect(result.nextOrders.filter((o) => o.species === 'Pork')).toHaveLength(3);
    expect(result.nextOrders.filter((o) => o.species.toLowerCase() === 'pig')).toHaveLength(0);
    expect(result.nextOrders.find((o) => o.id === 'o4')?.species).toBe('Beef');
    expect(result.nextSpeciesList).toEqual(['Beef', 'Pork']);
  });

  it('strips a deleted butcher order tag ID from all butcher orders and removes it from appConfig', () => {
    const tags: ButcherOrderTag[] = [
      { id: 'tag-sow', name: 'Retired Sow', color: '#f59e0b', weightCheckMode: 'separate_baseline' },
      { id: 'tag-skinned', name: 'Skinned', color: '#8b5cf6', weightCheckMode: 'separate_baseline' },
    ];
    const orders = [
      makeOrder({ id: 'o1', tagIds: ['tag-sow', 'tag-skinned'] }),
      makeOrder({ id: 'o2', tagIds: ['tag-sow'] }),
      makeOrder({ id: 'o3', tagIds: ['tag-skinned'] }),
    ];

    const result = applyButcherOrderTagDelete(orders, tags, 'tag-sow');
    expect(result.deletedTag?.name).toBe('Retired Sow');
    expect(result.affectedOrderCount).toBe(2);
    expect(result.nextOrders.find((o) => o.id === 'o1')?.tagIds).toEqual(['tag-skinned']);
    expect(result.nextOrders.find((o) => o.id === 'o2')?.tagIds).toBeUndefined();
    expect(result.nextTags.map((t) => t.id)).toEqual(['tag-skinned']);
  });

  it('bulk renames Document Link Types across typed docs and optional legacy untyped matches, and safely deletes without removing links', () => {
    const docTypes: ButcherDocumentLinkType[] = [
      { id: 'dt-farmos', name: 'FarmOS Log' },
      { id: 'dt-invoice', name: 'Invoice' },
    ];
    const orders = [
      makeOrder({
        id: 'o1',
        documents: [
          { id: 'd1', name: 'FarmOS Log', typeId: 'dt-farmos', url: 'https://farmos.local/1' },
          { id: 'd2', name: 'Custom Misc', url: 'https://example.com/misc' },
        ],
      }),
      makeOrder({
        id: 'o2',
        documents: [
          // Legacy untyped link with exact matching name
          { id: 'd3', name: 'farmos log', url: 'https://farmos.local/2' },
        ],
      }),
    ];
    // Check usage counts include both linked and legacy name matches
    const usage = getButcherDocLinkTypeUsageCounts(orders, docTypes);
    expect(usage.get('dt-farmos')).toEqual({ byTypeId: 1, byLegacyName: 1, total: 2 });

    // Bulk rename with alsoMatchByName: true
    const renamed = applyButcherDocumentTypeRename(
      orders,
      docTypes,
      'dt-farmos',
      'FarmOS Harvest Log',
      true
    );
    expect(renamed.affectedOrderCount).toBe(2);
    expect(renamed.affectedDocumentCount).toBe(2);
    expect(renamed.nextOrders[0].documents?.[0].name).toBe('FarmOS Harvest Log');
    expect(renamed.nextOrders[1].documents?.[0].name).toBe('FarmOS Harvest Log');
    expect(renamed.nextOrders[1].documents?.[0].typeId).toBe('dt-farmos');

    // Display name resolution respects canonical type name
    expect(
      resolveDocumentDisplayName(
        { id: 'd1', name: 'Old Stale Name', typeId: 'dt-farmos', url: 'https://farmos.local/1' },
        renamed.nextLinkTypes
      )
    ).toBe('FarmOS Harvest Log');

    // Safe delete detaches typeId while keeping existing attached document names & URLs intact
    const deleted = applyButcherDocumentTypeDelete(renamed.nextOrders, renamed.nextLinkTypes, 'dt-farmos');
    expect(deleted.deletedType?.name).toBe('FarmOS Harvest Log');
    expect(deleted.detachedDocumentCount).toBe(2);
    expect(deleted.nextOrders[0].documents).toHaveLength(2);
    expect(deleted.nextOrders[0].documents?.[0].name).toBe('FarmOS Harvest Log');
    expect(deleted.nextOrders[0].documents?.[0].typeId).toBeUndefined();
    expect(deleted.nextOrders[0].documents?.[0].url).toBe('https://farmos.local/1');
    expect(deleted.nextLinkTypes.map((t) => t.id)).toEqual(['dt-invoice']);
  });
});

describe('Butcher Order Tags — Multi-Tag Yield Anomaly Baselines & Interactive Audit Scope Selection', () => {
  const tagSow: ButcherOrderTag = {
    id: 'tag-sow',
    name: 'Retired Sow',
    color: '#f59e0b',
    weightCheckMode: 'separate_baseline',
  };
  const tagSkinned: ButcherOrderTag = {
    id: 'tag-skinned',
    name: 'Skinned',
    color: '#8b5cf6',
    weightCheckMode: 'separate_baseline',
  };
  const tagTest: ButcherOrderTag = {
    id: 'tag-test',
    name: 'Test / Trial Batch',
    color: '#64748b',
    weightCheckMode: 'exclude_from_baseline',
  };
  const allTags = [tagSow, tagSkinned, tagTest];

  // Standard market hogs: ~74% dressing, ~3% cooler shrink, ~72% cutting yield
  const standardHogs: ButcherOrder[] = [
    makeOrder({ id: 'h1', liveWeight: 280, hotWeight: 207.2, coldWeight: 201.0 }),
    makeOrder({ id: 'h2', liveWeight: 290, hotWeight: 214.6, coldWeight: 208.2 }),
    makeOrder({ id: 'h3', liveWeight: 270, hotWeight: 199.8, coldWeight: 193.8 }),
    makeOrder({ id: 'h4', liveWeight: 300, hotWeight: 222.0, coldWeight: 215.3 }),
    makeOrder({ id: 'h5', liveWeight: 285, hotWeight: 210.9, coldWeight: 204.6 }),
  ];
  const standardHogRecs: ButcherRecord[] = [
    makeRecord('h1', 144.7),
    makeRecord('h2', 149.9),
    makeRecord('h3', 139.5),
    makeRecord('h4', 155.0),
    makeRecord('h5', 147.3),
  ];

  // Retired Sows (much lower ~62% dressing, ~3% shrink, ~65% cutting yield)
  const retiredSows: ButcherOrder[] = [
    makeOrder({ id: 's1', tagIds: ['tag-sow'], liveWeight: 520, hotWeight: 322.4, coldWeight: 312.7 }),
    makeOrder({ id: 's2', tagIds: ['tag-sow'], liveWeight: 550, hotWeight: 341.0, coldWeight: 330.8 }),
    makeOrder({ id: 's3', tagIds: ['tag-sow'], liveWeight: 500, hotWeight: 310.0, coldWeight: 300.7 }),
    makeOrder({ id: 's4', tagIds: ['tag-sow'], liveWeight: 540, hotWeight: 334.8, coldWeight: 324.8 }),
  ];
  const retiredSowRecs: ButcherRecord[] = [
    makeRecord('s1', 203.3),
    makeRecord('s2', 215.0),
    makeRecord('s3', 195.5),
    makeRecord('s4', 211.1),
  ];

  // Multi-tagged: Retired Sow + Skinned (~55% dressing due to skin removal)
  const skinnedSows: ButcherOrder[] = [
    makeOrder({ id: 'ss1', tagIds: ['tag-sow', 'tag-skinned'], liveWeight: 510, hotWeight: 280.5, coldWeight: 272.1 }),
    makeOrder({ id: 'ss2', tagIds: ['tag-sow', 'tag-skinned'], liveWeight: 530, hotWeight: 291.5, coldWeight: 282.8 }),
    makeOrder({ id: 'ss3', tagIds: ['tag-sow', 'tag-skinned'], liveWeight: 500, hotWeight: 275.0, coldWeight: 266.8 }),
    makeOrder({ id: 'ss4', tagIds: ['tag-sow', 'tag-skinned'], liveWeight: 525, hotWeight: 288.8, coldWeight: 280.1 }),
  ];
  const skinnedSowRecs: ButcherRecord[] = [
    makeRecord('ss1', 176.9),
    makeRecord('ss2', 183.8),
    makeRecord('ss3', 173.4),
    makeRecord('ss4', 182.1),
  ];

  it('isolates separate_baseline cohorts so retired sows do not trigger false alarms or pollute standard hogs', () => {
    const allOrders = [...standardHogs, ...retiredSows];
    const recMap = groupRecordsByOrderId([...standardHogRecs, ...retiredSowRecs]);

    // Without tags, a 62% dressing sow looks like a severe anomaly against 74% market hogs
    const untaggedCheck = analyzeOrderAnomalies(
      retiredSows[0],
      recMap.get('s1')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      []
    );
    expect(untaggedCheck.hasStatisticalAnomalies).toBe(true);

    // With separate_baseline tag, retired sow compares against other retired sows (3 peers) -> clean!
    const taggedCheck = analyzeOrderAnomalies(
      retiredSows[0],
      recMap.get('s1')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags
    );
    expect(taggedCheck.hasStatisticalAnomalies).toBe(false);
    expect(taggedCheck.cleanPeerCount).toBe(3);
    expect(taggedCheck.baselineLabel).toBe('Pork · Retired Sow');

    // Standard market hogs remain pure (4 clean standard peers, not polluted by the 4 sows)
    const hogCheck = analyzeOrderAnomalies(
      standardHogs[0],
      recMap.get('h1')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags
    );
    expect(hogCheck.cleanPeerCount).toBe(4);
    expect(hogCheck.hasStatisticalAnomalies).toBe(false);
  });

  it('handles multi-tagged orders (Retired Sow + Skinned) and exposes selectable baseline scopes for the audit window', () => {
    const allOrders = [...standardHogs, ...retiredSows, ...skinnedSows];
    const recMap = groupRecordsByOrderId([...standardHogRecs, ...retiredSowRecs, ...skinnedSowRecs]);
    const target = skinnedSows[0];

    const scopeOptions = listAvailableBaselineScopesForOrder(target, allOrders, recMap, allTags);
    const scopeIds = scopeOptions.map((o) => o.id);
    expect(scopeIds[0]).toBe('auto');
    expect(scopeIds).toContain('tag_cohort:tag-skinned+tag-sow');
    expect(scopeIds).toContain('tag_cohort:tag-sow');
    expect(scopeIds).toContain('tag_cohort:tag-skinned');
    expect(scopeIds).toContain('standard');
    expect(scopeIds).toContain('all_species');

    // Auto mode compares against the combined Retired Sow + Skinned cohort (3 peers) -> clean
    const autoAnalysis = analyzeOrderAnomalies(
      target,
      recMap.get(target.id)!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags,
      { mode: 'auto' }
    );
    expect(autoAnalysis.hasStatisticalAnomalies).toBe(false);
    expect(autoAnalysis.cleanPeerCount).toBe(3);
    expect(autoAnalysis.baselineLabel).toContain('Retired Sow');
    expect(autoAnalysis.baselineLabel).toContain('Skinned');

    // Explicitly switching the audit dropdown to Standard Species Baseline flags the 55% dressing vs 74% standard hogs
    const vsStandard = analyzeOrderAnomalies(
      target,
      recMap.get(target.id)!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags,
      { mode: 'standard' }
    );
    expect(vsStandard.hasStatisticalAnomalies).toBe(true);
    expect(vsStandard.cleanPeerCount).toBe(5);
    expect(vsStandard.baselineLabel).toBe('Pork (Standard)');
  });

  it('pauses statistical alerts for exclude_from_baseline tags in Auto mode while keeping physical checks active and allowing manual override', () => {
    const weirdValidOrder = makeOrder({
      id: 'ex-1',
      tagIds: ['tag-test'],
      liveWeight: 400,
      hotWeight: 200, // 50% dressing (huge outlier vs 74% hogs, but physically valid)
      coldWeight: 194,
    });
    const impossibleOrder = makeOrder({
      id: 'ex-phys',
      tagIds: ['tag-test'],
      liveWeight: 300,
      hotWeight: 340, // Physically impossible: hot > live
      coldWeight: 330,
    });

    const allOrders = [...standardHogs, weirdValidOrder, impossibleOrder];
    const recMap = groupRecordsByOrderId([
      ...standardHogRecs,
      makeRecord('ex-1', 120),
      makeRecord('ex-phys', 200),
    ]);

    // Auto mode skips statistical anomaly for excluded tag
    const autoExcluded = analyzeOrderAnomalies(
      weirdValidOrder,
      recMap.get('ex-1')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags,
      { mode: 'auto' }
    );
    expect(autoExcluded.excludedFromStatisticalBaseline).toBe(true);
    expect(autoExcluded.hasStatisticalAnomalies).toBe(false);
    expect(autoExcluded.needsReview).toBe(false);

    // Manual override to Standard Baseline inside the audit window still runs statistical checks on demand
    const manualCompare = analyzeOrderAnomalies(
      weirdValidOrder,
      recMap.get('ex-1')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags,
      { mode: 'standard' }
    );
    expect(manualCompare.excludedFromStatisticalBaseline).toBe(false);
    expect(manualCompare.hasStatisticalAnomalies).toBe(true);

    // Physical checks ALWAYS run even on excluded orders
    const physExcluded = analyzeOrderAnomalies(
      impossibleOrder,
      recMap.get('ex-phys')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags,
      { mode: 'auto' }
    );
    expect(physExcluded.hasPhysicalErrors).toBe(true);
    expect(physExcluded.needsReview).toBe(true);

    // Review queue honors butcherTags and does not flag excluded-but-physically-valid orders
    const queue = analyzeOrderReviewQueue(allOrders, recMap, DEFAULT_ANOMALY_SENSITIVITY, allTags);
    expect(queue.items.some((i) => i.order.id === 'ex-1')).toBe(false);
    expect(queue.items.some((i) => i.order.id === 'ex-phys')).toBe(true);
  });
});

describe('Butcher Settings — App Config Permissions, SQLite Persistence & SSR Checks', () => {
  it('permits regular signed-in users to write all 5 Butcher Settings app_config keys while blocking admin keys', () => {
    expect(Array.from(BUTCHER_USER_CONFIG_KEYS).sort()).toEqual([
      BUTCHER_BASELINE_GROUPING_CONFIG_KEY,
      BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY,
      BUTCHER_DOC_LINK_TYPES_CONFIG_KEY,
      BUTCHER_ORDER_TAGS_CONFIG_KEY,
      BUTCHER_SPECIES_CONFIG_KEY,
    ]);
    expect(canNonAdminWriteAppConfig({ key: BUTCHER_SPECIES_CONFIG_KEY, value: '["Pork","Beef"]' })).toBe(true);
    expect(canNonAdminWriteAppConfig({ key: BUTCHER_ORDER_TAGS_CONFIG_KEY, value: '[]' })).toBe(true);
    expect(canNonAdminWriteAppConfig({ key: BUTCHER_DOC_LINK_TYPES_CONFIG_KEY, value: '[]' })).toBe(true);
    expect(
      canNonAdminWriteAppConfig({
        key: BUTCHER_BASELINE_GROUPING_CONFIG_KEY,
        value: JSON.stringify('species_and_butcher'),
      })
    ).toBe(true);
    expect(
      canNonAdminWriteAppConfig({
        key: BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY,
        value: JSON.stringify(2.4),
      })
    ).toBe(true);
    expect(
      canNonAdminWriteAppConfig({
        configs: {
          [BUTCHER_SPECIES_CONFIG_KEY]: '["Pork"]',
          require_login_for_edits: 'false',
        },
      })
    ).toBe(false);
  });

  it('parses, detects, and clamps butcher_anomaly_sensitivity across raw, JSON, and record configs', () => {
    expect(hasButcherAnomalySensitivityConfig(undefined)).toBe(false);
    expect(hasButcherAnomalySensitivityConfig([])).toBe(false);
    expect(parseButcherAnomalySensitivity(undefined)).toBe(DEFAULT_ANOMALY_SENSITIVITY);
    expect(
      parseButcherAnomalySensitivity([
        { key: BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY, value: 'not-a-number' },
      ])
    ).toBe(DEFAULT_ANOMALY_SENSITIVITY);

    const rawConfig = [{ key: BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY, value: '2.6' }];
    expect(hasButcherAnomalySensitivityConfig(rawConfig)).toBe(true);
    expect(parseButcherAnomalySensitivity(rawConfig)).toBe(2.6);

    const jsonConfig = [{ key: BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY, value: JSON.stringify(1.5) }];
    expect(parseButcherAnomalySensitivity(jsonConfig)).toBe(1.5);

    expect(
      parseButcherAnomalySensitivity({
        [BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY]: JSON.stringify(0.2),
      })
    ).toBe(MIN_ANOMALY_SENSITIVITY);
    expect(
      parseButcherAnomalySensitivity({
        [BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY]: '9.9',
      })
    ).toBe(MAX_ANOMALY_SENSITIVITY);
  });

  it('persists butcher_orders.tagIds and app_config Butcher Settings JSON cleanly in SQLite', () => {
    const db = createTestDatabase(':memory:');
    try {
      const order = makeOrder({
        id: 'order-sqlite-1',
        species: 'Pork',
        tagIds: ['tag-sow', 'tag-skinned'],
      });
      importButcherCutsheet(db, order, [], 'Home Farm', 'Pallet 1');

      const saved = db
        .prepare('SELECT species, tagIds FROM butcher_orders WHERE id = ?')
        .get('order-sqlite-1') as { species: string; tagIds: string };

      expect(saved.species).toBe('Pork');
      expect(JSON.parse(saved.tagIds)).toEqual(['tag-sow', 'tag-skinned']);
    } finally {
      db.close();
    }
  });

  it('renders ButcherSettingsPanel and ButcherRecordsView cleanly via SSR with tags and link types', () => {
    const tags: ButcherOrderTag[] = [
      { id: 'tag-sow', name: 'Retired Sow', color: '#f59e0b', weightCheckMode: 'separate_baseline' },
    ];
    const docTypes: ButcherDocumentLinkType[] = [
      { id: 'dt-invoice', name: 'Butcher Invoice' },
    ];
    const appConfig: AppConfigItem[] = [
      { key: BUTCHER_SPECIES_CONFIG_KEY, value: JSON.stringify(['Pork', 'Beef']) },
      { key: BUTCHER_ORDER_TAGS_CONFIG_KEY, value: JSON.stringify(tags) },
      { key: BUTCHER_DOC_LINK_TYPES_CONFIG_KEY, value: JSON.stringify(docTypes) },
      { key: BUTCHER_BASELINE_GROUPING_CONFIG_KEY, value: JSON.stringify('species_and_butcher') },
      { key: BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY, value: JSON.stringify(2.4) },
    ];
    const orders = [
      makeOrder({
        id: 'ssr-1',
        orderNumber: '4042',
        species: 'Pork',
        tagIds: ['tag-sow'],
        documents: [{ id: 'doc-1', name: 'Old Invoice', typeId: 'dt-invoice', url: 'https://example.com/inv' }],
      }),
    ];

    const settingsHtml = renderToStaticMarkup(
      React.createElement(
        UserAuthProvider,
        null,
        React.createElement(ButcherSettingsPanel, {
          state: { butcherOrders: orders, appConfig } as any,
          dispatch: () => {},
        })
      )
    );
    expect(settingsHtml).toContain('Yield Anomaly Baseline Grouping');
    expect(settingsHtml).toContain('Species Only (All Butchers)');
    expect(settingsHtml).toContain('Species &amp; Butcher (Per Processor)');
    expect(settingsHtml).toContain('id="butcher-baseline-grouping-species_and_butcher"');
    expect(settingsHtml).toContain('id="butcher-settings-anomaly-sensitivity"');
    expect(settingsHtml).toContain('id="butcher-settings-sensitivity-slider"');
    expect(settingsHtml).toContain('id="butcher-settings-sensitivity-save"');
    expect(settingsHtml).toContain('2.4σ');
    expect(settingsHtml).toContain('Species &amp; Primal Cuts');
    expect(settingsHtml).toContain('Catalog → Species &amp; Primals');
    expect(settingsHtml).toContain('Butcher Order Tags');
    expect(settingsHtml).toContain('Document Link Types');
    expect(settingsHtml).toContain('Retired Sow');
    expect(settingsHtml).toContain('Butcher Invoice');

    const viewHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: {
          butcherOrders: orders,
          butcherRecords: [],
          products: [],
          locations: [],
          offSiteEntries: [],
          pallets: [],
          freezers: [],
          appConfig,
        },
        dispatch: () => {},
      })
    );
    expect(viewHtml).toContain('Retired Sow');
    expect(viewHtml).toContain('Butcher Invoice');
  });
});

describe('Butcher Settings — Anomaly Baseline Grouping (Species vs. Species & Butcher)', () => {
  const locationNames = new Map<string, string>([
    ['loc-valley', 'Valley Meats'],
    ['loc-ridge', 'Ridge Custom Cut'],
  ]);

  it('defaults to species-only grouping and parses both raw and JSON-encoded app_config values', () => {
    expect(parseButcherBaselineGroupingMode(undefined)).toBe('species');
    expect(parseButcherBaselineGroupingMode([])).toBe('species');
    expect(
      parseButcherBaselineGroupingMode([
        { key: BUTCHER_BASELINE_GROUPING_CONFIG_KEY, value: 'invalid_mode' },
      ])
    ).toBe('species');
    expect(
      parseButcherBaselineGroupingMode([
        { key: BUTCHER_BASELINE_GROUPING_CONFIG_KEY, value: 'species_and_butcher' },
      ])
    ).toBe('species_and_butcher');
    expect(
      parseButcherBaselineGroupingMode([
        { key: BUTCHER_BASELINE_GROUPING_CONFIG_KEY, value: JSON.stringify('species_and_butcher') },
      ])
    ).toBe('species_and_butcher');
    expect(
      parseButcherBaselineGroupingMode({
        [BUTCHER_BASELINE_GROUPING_CONFIG_KEY]: JSON.stringify('species'),
      })
    ).toBe('species');
    expect(normalizeButcherBaselineGroupingMode('species_and_butcher')).toBe('species_and_butcher');
    expect(normalizeButcherBaselineGroupingMode('anything-else')).toBe('species');
  });

  it('isolates baselines per butcher in species_and_butcher mode so processor differences do not cause cross-butcher false alerts', () => {
    // Butcher A (Valley Meats): consistent ~75% dressing yield (scalded)
    const valleyOrders = [
      makeOrder({ id: 'v1', locationId: 'loc-valley', killDate: '2026-06-01', liveWeight: 280, hotWeight: 210, coldWeight: 204 }),
      makeOrder({ id: 'v2', locationId: 'loc-valley', killDate: '2026-06-15', liveWeight: 290, hotWeight: 217.5, coldWeight: 211 }),
      makeOrder({ id: 'v3', locationId: 'loc-valley', killDate: '2026-07-01', liveWeight: 270, hotWeight: 202.5, coldWeight: 196.5 }),
      makeOrder({ id: 'v4', locationId: 'loc-valley', killDate: '2026-07-15', liveWeight: 300, hotWeight: 225, coldWeight: 218 }),
      makeOrder({ id: 'v5', locationId: 'loc-valley', killDate: '2026-08-01', liveWeight: 285, hotWeight: 213.8, coldWeight: 207.4 }),
    ];

    // Butcher B (Ridge Custom Cut): consistent ~64% dressing yield (skinned), plus one true Ridge outlier (50% dressing)
    const ridgeNormalOrders = [
      makeOrder({ id: 'r1', locationId: 'loc-ridge', killDate: '2026-06-05', liveWeight: 280, hotWeight: 179.2, coldWeight: 173.8 }),
      makeOrder({ id: 'r2', locationId: 'loc-ridge', killDate: '2026-06-20', liveWeight: 290, hotWeight: 185.6, coldWeight: 180.0 }),
      makeOrder({ id: 'r3', locationId: 'loc-ridge', killDate: '2026-07-05', liveWeight: 275, hotWeight: 176.0, coldWeight: 170.7 }),
      makeOrder({ id: 'r4', locationId: 'loc-ridge', killDate: '2026-07-20', liveWeight: 285, hotWeight: 182.4, coldWeight: 176.9 }),
    ];
    const ridgeOutlier = makeOrder({
      id: 'r-outlier',
      locationId: 'loc-ridge',
      killDate: '2026-08-10',
      liveWeight: 280,
      hotWeight: 140.0, // 50.0% — outlier even against Ridge's 64% baseline
      coldWeight: 135.8,
    });

    const allOrders = [...valleyOrders, ...ridgeNormalOrders, ridgeOutlier];
    const records: ButcherRecord[] = allOrders.map((o) =>
      makeRecord(o.id, Math.round(o.coldWeight * 0.85 * 10) / 10)
    );
    const recMap = groupRecordsByOrderId(records);

    // Under species_and_butcher, normal Ridge order compares only against Ridge peers (~64%) -> CLEAN
    const ridgePerButcher = analyzeOrderAnomalies(
      ridgeNormalOrders[0],
      recMap.get('r1')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      [],
      { mode: 'auto' },
      'species_and_butcher',
      locationNames
    );
    expect(ridgePerButcher.baselineGroupingMode).toBe('species_and_butcher');
    expect(ridgePerButcher.baselineLabel).toBe('Pork · Ridge Custom Cut');
    expect(ridgePerButcher.cleanPeerCount).toBe(4); // r2, r3, r4, r-outlier
    expect(ridgePerButcher.hasStatisticalAnomalies).toBe(false);

    // And the genuine Ridge outlier is still caught against Ridge peers
    const ridgeOutlierAnalysis = analyzeOrderAnomalies(
      ridgeOutlier,
      recMap.get('r-outlier')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      [],
      { mode: 'auto' },
      'species_and_butcher',
      locationNames
    );
    expect(ridgeOutlierAnalysis.baselineLabel).toBe('Pork · Ridge Custom Cut');
    expect(ridgeOutlierAnalysis.hasStatisticalAnomalies).toBe(true);
    expect(ridgeOutlierAnalysis.needsReview).toBe(true);

    // Under species-only mode, all 10 Pork orders pool together -> peer count includes both butchers
    const ridgeSpeciesOnly = analyzeOrderAnomalies(
      ridgeNormalOrders[0],
      recMap.get('r1')!,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      [],
      { mode: 'auto' },
      'species',
      locationNames
    );
    expect(ridgeSpeciesOnly.baselineGroupingMode).toBe('species');
    expect(ridgeSpeciesOnly.baselineLabel).toBe('Pork');
    expect(ridgeSpeciesOnly.cleanPeerCount).toBe(9);

    // Review queue propagates species_and_butcher mode and location names
    const queue = analyzeOrderReviewQueue(
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      [],
      'species_and_butcher',
      locationNames
    );
    expect(queue.allOrderAnalyses.get('r1')?.baselineLabel).toBe('Pork · Ridge Custom Cut');
    expect(queue.allOrderAnalyses.get('v1')?.baselineLabel).toBe('Pork · Valley Meats');
    expect(queue.items.some((i) => i.order.id === 'r-outlier')).toBe(true);
    expect(queue.items.some((i) => i.order.id === 'r1')).toBe(false);
  });

  it('combines species_and_butcher grouping cleanly with separate_baseline tags, unassigned butchers, and audit scope overrides', () => {
    const sowTag: ButcherOrderTag = {
      id: 'tag-sow',
      name: 'Retired Sow',
      weightCheckMode: 'separate_baseline',
    };
    const allTags = [sowTag];

    const orders: ButcherOrder[] = [
      // Valley standard
      makeOrder({ id: 'vs1', locationId: 'loc-valley', liveWeight: 280, hotWeight: 210, coldWeight: 204 }),
      makeOrder({ id: 'vs2', locationId: 'loc-valley', liveWeight: 290, hotWeight: 217.5, coldWeight: 211 }),
      makeOrder({ id: 'vs3', locationId: 'loc-valley', liveWeight: 270, hotWeight: 202.5, coldWeight: 196.5 }),
      // Valley Retired Sow cohort
      makeOrder({ id: 'vsow1', locationId: 'loc-valley', tagIds: ['tag-sow'], liveWeight: 520, hotWeight: 322.4, coldWeight: 312.7 }),
      makeOrder({ id: 'vsow2', locationId: 'loc-valley', tagIds: ['tag-sow'], liveWeight: 540, hotWeight: 334.8, coldWeight: 324.8 }),
      makeOrder({ id: 'vsow3', locationId: 'loc-valley', tagIds: ['tag-sow'], liveWeight: 510, hotWeight: 316.2, coldWeight: 306.7 }),
      // Ridge Retired Sow cohort (different processor, should not mix into Valley Retired Sow cohort)
      makeOrder({ id: 'rsow1', locationId: 'loc-ridge', tagIds: ['tag-sow'], liveWeight: 500, hotWeight: 340, coldWeight: 330 }),
      // Unassigned butcher order
      makeOrder({ id: 'un1', locationId: undefined, liveWeight: 280, hotWeight: 207.2, coldWeight: 201.0 }),
    ];

    const recMap = groupRecordsByOrderId(
      orders.map((o) => makeRecord(o.id, Math.round(o.coldWeight * 0.85 * 10) / 10))
    );

    const sowAnalysis = analyzeOrderAnomalies(
      orders[3],
      recMap.get('vsow1')!,
      orders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags,
      { mode: 'auto' },
      'species_and_butcher',
      locationNames
    );
    expect(sowAnalysis.baselineLabel).toBe('Pork · Valley Meats · Retired Sow');
    expect(sowAnalysis.cleanPeerCount).toBe(2); // vsow2 & vsow3 only, NOT rsow1

    // Unassigned butcher order gets a clean Unassigned Butcher label and does not inherit Valley/Ridge peers
    const unassignedAnalysis = analyzeOrderAnomalies(
      orders[7],
      recMap.get('un1')!,
      orders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags,
      { mode: 'auto' },
      'species_and_butcher',
      locationNames
    );
    expect(unassignedAnalysis.baselineLabel).toBe('Pork · Unassigned Butcher');
    expect(unassignedAnalysis.cleanPeerCount).toBe(0);

    // Weight Audit modal offers cross-mode override: All Butchers when in species_and_butcher mode
    const perButcherScopes = listAvailableBaselineScopesForOrder(
      orders[0],
      orders,
      recMap,
      allTags,
      'species_and_butcher',
      locationNames
    );
    const allButchersOpt = perButcherScopes.find((s) => s.id === 'standard::all_butchers');
    expect(allButchersOpt).toBeDefined();
    expect(allButchersOpt?.label).toBe('Pork · All Butchers (Standard)');
    expect(allButchersOpt?.cleanPeerCount).toBe(3); // vs2, vs3, un1

    // Evaluating with that cross-mode override switches effective grouping back to species-wide
    const overrideAnalysis = analyzeOrderAnomalies(
      orders[0],
      recMap.get('vs1')!,
      orders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      undefined,
      allTags,
      allButchersOpt!.scope,
      'species_and_butcher',
      locationNames
    );
    expect(overrideAnalysis.baselineGroupingMode).toBe('species');
    expect(overrideAnalysis.cleanPeerCount).toBe(3);

    // Conversely, when global mode is species-only, modal offers Same Butcher Only override
    const speciesScopes = listAvailableBaselineScopesForOrder(
      orders[0],
      orders,
      recMap,
      allTags,
      'species',
      locationNames
    );
    const sameButcherOpt = speciesScopes.find((s) => s.id === 'standard::same_butcher');
    expect(sameButcherOpt).toBeDefined();
    expect(sameButcherOpt?.label).toBe('Pork · Valley Meats Only (Standard)');
    expect(sameButcherOpt?.cleanPeerCount).toBe(2); // vs2, vs3 only
  });

  it('syncs app_config changes locally via SYNC_APP_CONFIG and lightweight SSE without multi-MB REPLACE_STATE uploads', () => {
    const butcherSettingsSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'components/ButcherSettingsPanel.tsx'),
      'utf8'
    );
    const offsiteSettingsSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'components/OffSiteSettingsPanel.tsx'),
      'utf8'
    );
    const useInventorySrc = fs.readFileSync(
      path.resolve(process.cwd(), 'hooks/useInventory.ts'),
      'utf8'
    );
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'App.tsx'), 'utf8');
    const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');

    expect(butcherSettingsSrc).toContain("type: 'SYNC_APP_CONFIG'");
    expect(butcherSettingsSrc).not.toContain("type: 'REPLACE_STATE'");
    expect(offsiteSettingsSrc).toContain("type: 'SYNC_APP_CONFIG'");
    expect(offsiteSettingsSrc).not.toContain("type: 'REPLACE_STATE'");
    expect(useInventorySrc).toContain("if (action.type === 'SYNC_APP_CONFIG')");
    expect(useInventorySrc).toContain("'app_config': 'appConfig'");
    expect(appSrc).toContain("data.type === 'app_config_updated'");
    expect(serverSrc).toContain("type: 'app_config_updated'");
  });
});
