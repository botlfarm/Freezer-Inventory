import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Database from 'better-sqlite3';
import { ButcherOrder, ButcherRecord } from '../types';
import {
  DEFAULT_ANOMALY_SENSITIVITY,
  MIN_ANOMALY_SENSITIVITY,
  MAX_ANOMALY_SENSITIVITY,
  RECENCY_HALF_LIFE_DAYS,
  MIN_RECENCY_WEIGHT,
  clampSensitivity,
  getOrderHarvestTimestamp,
  computeRecencyWeight,
  groupRecordsByOrderId,
  computeSpeciesBaselines,
  computeSuggestedWeights,
  analyzeOrderAnomalies,
  computeOrderStatsWithMode,
  analyzeOrderReviewQueue,
} from '../utils/butcherStats';
import { createTestDatabase } from './test-harness';
import { ButcherRecordsView } from '../views/ButcherRecordsView';
import { ButcherAnomalyReviewModal } from '../components/ButcherAnomalyReviewModal';

function makeOrder(overrides: Partial<ButcherOrder> & { id: string }): ButcherOrder {
  return {
    orderNumber: `BO-${overrides.id}`,
    species: 'Beef',
    animalCount: 1,
    killDate: '2026-06-01',
    pickupDate: '2026-06-15',
    liveWeight: 1200,
    hotWeight: 744, // 62.0%
    coldWeight: 722, // ~2.96% shrink
    butcherFee: 450,
    createdAt: 1700000000000,
    ...overrides,
  };
}

function makePackRecord(orderId: string, netWeight: number, suffix = '1'): ButcherRecord {
  return {
    id: `rec-${orderId}-${suffix}`,
    serial: `SN-${orderId}-${suffix}`,
    productId: 'prod-1',
    cuts: 'Mixed Cuts',
    pieces: 100,
    netWeight,
    orderId,
  };
}

describe('Butcher Weight Anomaly Detection, Species Baselines & Review Queue', () => {
  const peerOrders: ButcherOrder[] = [
    makeOrder({ id: 'p1', liveWeight: 1000, hotWeight: 620, coldWeight: 601 }), // 62% hot/live, 3.06% shrink
    makeOrder({ id: 'p2', liveWeight: 1200, hotWeight: 744, coldWeight: 722 }), // 62% hot/live, 2.96% shrink
    makeOrder({ id: 'p3', liveWeight: 1400, hotWeight: 868, coldWeight: 842 }), // 62% hot/live, 3.00% shrink
    makeOrder({ id: 'p4', liveWeight: 1100, hotWeight: 682, coldWeight: 661 }), // 62% hot/live, 3.08% shrink
    makeOrder({ id: 'p5', liveWeight: 1300, hotWeight: 806, coldWeight: 782 }), // 62% hot/live, 2.98% shrink
  ];
  // ~55% cutting yield (packaged / cold) => ~33.1% packaged / live
  const peerRecords: ButcherRecord[] = [
    makePackRecord('p1', 331),
    makePackRecord('p2', 397),
    makePackRecord('p3', 463),
    makePackRecord('p4', 364),
    makePackRecord('p5', 430),
  ];

  it('normalizes yields by live weight percentage so large and small animals with normal yields do not trigger false positives', () => {
    const smallSteer = makeOrder({
      id: 'small',
      liveWeight: 850,
      hotWeight: 527, // 62.0%
      coldWeight: 511, // 3.04% shrink
    });
    const largeSteer = makeOrder({
      id: 'large',
      liveWeight: 1650,
      hotWeight: 1023, // 62.0%
      coldWeight: 992, // 3.03% shrink
    });

    const allOrders = [...peerOrders, smallSteer, largeSteer];
    const allRecords = [
      ...peerRecords,
      makePackRecord('small', 281), // 55% cutting yield
      makePackRecord('large', 546), // 55% cutting yield
    ];
    const recMap = groupRecordsByOrderId(allRecords);
    const baselines = computeSpeciesBaselines(allOrders, recMap);

    const smallAnalysis = analyzeOrderAnomalies(smallSteer, recMap.get('small')!, allOrders, recMap, DEFAULT_ANOMALY_SENSITIVITY, baselines);
    const largeAnalysis = analyzeOrderAnomalies(largeSteer, recMap.get('large')!, allOrders, recMap, DEFAULT_ANOMALY_SENSITIVITY, baselines);

    expect(smallAnalysis.hasPhysicalErrors).toBe(false);
    expect(smallAnalysis.hasStatisticalAnomalies).toBe(false);
    expect(smallAnalysis.needsReview).toBe(false);

    expect(largeAnalysis.hasPhysicalErrors).toBe(false);
    expect(largeAnalysis.hasStatisticalAnomalies).toBe(false);
    expect(largeAnalysis.needsReview).toBe(false);
  });

  it('detects deterministic physical errors (hot > live, cold > hot, packaged > cold)', () => {
    const impossibleOrder = makeOrder({
      id: 'bad-phys',
      liveWeight: 1100,
      hotWeight: 1150, // Impossible: hot > live
      coldWeight: 1180, // Impossible: cold > hot
    });
    const pack = [makePackRecord('bad-phys', 1200)]; // Impossible: pack > cold
    const allOrders = [...peerOrders, impossibleOrder];
    const recMap = groupRecordsByOrderId([...peerRecords, ...pack]);
    const analysis = analyzeOrderAnomalies(impossibleOrder, pack, allOrders, recMap);

    expect(analysis.hasPhysicalErrors).toBe(true);
    expect(analysis.needsReview).toBe(true);
    expect(analysis.findings.some(f => f.id === 'phys-hot-gt-live')).toBe(true);
    expect(analysis.findings.some(f => f.id === 'phys-cold-gt-hot')).toBe(true);
    expect(analysis.findings.some(f => f.id === 'phys-pack-gt-cold')).toBe(true);
  });

  it('uses cross-ratio triangulation to pinpoint liveWeight when only liveWeight is mistyped', () => {
    // True live ~1200 (hot=744, cold=722, pack=397), but mistyped liveWeight as 2200
    // hot/cold shrink (2.96%) and cutting yield (55.0%) match peers; hot/live, cold/live, pack/live are all ~half
    const typoLiveOrder = makeOrder({
      id: 'typo-live',
      liveWeight: 2200,
      hotWeight: 744,
      coldWeight: 722,
    });
    const pack = [makePackRecord('typo-live', 397)];
    const allOrders = [...peerOrders, typoLiveOrder];
    const recMap = groupRecordsByOrderId([...peerRecords, ...pack]);
    const analysis = analyzeOrderAnomalies(typoLiveOrder, pack, allOrders, recMap);

    expect(analysis.hasStatisticalAnomalies).toBe(true);
    expect(analysis.needsReview).toBe(true);
    expect(analysis.suspectFields[0]).toBe('liveWeight');
    // Suggested liveWeight should be close to 1200 lbs
    expect(analysis.suggestedEstimates.liveWeight).toBeGreaterThan(1150);
    expect(analysis.suggestedEstimates.liveWeight).toBeLessThan(1250);
  });

  it('uses cross-ratio triangulation to pinpoint hotWeight when only hotWeight is mistyped', () => {
    // True hot ~744, mistyped as 950; cold/live (60.2%), pack/live (33.1%), pack/cold (55%) stay normal
    // while hot/live (79.2%), coolerShrink (24.0%), and pack/hot (41.8%) all trigger
    const typoHotOrder = makeOrder({
      id: 'typo-hot',
      liveWeight: 1200,
      hotWeight: 950,
      coldWeight: 722,
    });
    const pack = [makePackRecord('typo-hot', 397)];
    const allOrders = [...peerOrders, typoHotOrder];
    const recMap = groupRecordsByOrderId([...peerRecords, ...pack]);
    const analysis = analyzeOrderAnomalies(typoHotOrder, pack, allOrders, recMap);

    expect(analysis.hasStatisticalAnomalies).toBe(true);
    expect(analysis.suspectFields[0]).toBe('hotWeight');
    expect(analysis.suggestedEstimates.hotWeight).toBeGreaterThan(710);
    expect(analysis.suggestedEstimates.hotWeight).toBeLessThan(780);
  });

  it('respects sensitivity slider thresholds between Strict (1.2σ) and Lenient (3.5σ)', () => {
    expect(clampSensitivity(0.5)).toBe(MIN_ANOMALY_SENSITIVITY);
    expect(clampSensitivity(10)).toBe(MAX_ANOMALY_SENSITIVITY);
    expect(clampSensitivity(Number.NaN)).toBe(DEFAULT_ANOMALY_SENSITIVITY);

    // Build peers with slight natural variation (~60-64% dressing) so MAD/stdDev > 0
    const variedPeers: ButcherOrder[] = [
      makeOrder({ id: 'v1', liveWeight: 1000, hotWeight: 605, coldWeight: 587 }), // 60.5%
      makeOrder({ id: 'v2', liveWeight: 1000, hotWeight: 615, coldWeight: 597 }), // 61.5%
      makeOrder({ id: 'v3', liveWeight: 1000, hotWeight: 620, coldWeight: 601 }), // 62.0%
      makeOrder({ id: 'v4', liveWeight: 1000, hotWeight: 625, coldWeight: 606 }), // 62.5%
      makeOrder({ id: 'v5', liveWeight: 1000, hotWeight: 635, coldWeight: 616 }), // 63.5%
    ];
    const variedRecs = variedPeers.map(o => makePackRecord(o.id, Math.round(o.coldWeight * 0.55)));

    // Moderate outlier: 56.5% hot/live (~5.5 pts off 62%, ~2.5-2.7 sigma)
    const moderateOutlier = makeOrder({
      id: 'mod',
      liveWeight: 1000,
      hotWeight: 565,
      coldWeight: 548,
    });
    const allOrders = [...variedPeers, moderateOutlier];
    const recMap = groupRecordsByOrderId([...variedRecs, makePackRecord('mod', 301)]);

    const strictResult = analyzeOrderAnomalies(moderateOutlier, recMap.get('mod')!, allOrders, recMap, MIN_ANOMALY_SENSITIVITY);
    const lenientResult = analyzeOrderAnomalies(moderateOutlier, recMap.get('mod')!, allOrders, recMap, MAX_ANOMALY_SENSITIVITY);

    expect(strictResult.hasStatisticalAnomalies).toBe(true);
    expect(lenientResult.hasStatisticalAnomalies).toBe(false);
  });

  it('excludes flagged weights from species baselines and computes baselines independently per species', () => {
    const corruptedBeef = makeOrder({
      id: 'corrupt-beef',
      species: 'Beef',
      liveWeight: 1000,
      hotWeight: 900, // Wrong (90%)
      coldWeight: 600,
      weightAnomalies: {
        hotWeight: {
          status: 'flagged',
          flaggedAt: '2026-06-20T00:00:00Z',
          reason: 'Scale misread',
        },
      },
    });
    const porkOrders = [
      makeOrder({ id: 'hog1', species: 'Pork', liveWeight: 280, hotWeight: 204, coldWeight: 198 }), // 72.9%
      makeOrder({ id: 'hog2', species: 'pork ', liveWeight: 300, hotWeight: 219, coldWeight: 212 }), // 73.0%
    ];
    const allOrders = [...peerOrders, corruptedBeef, ...porkOrders];
    const recMap = groupRecordsByOrderId([
      ...peerRecords,
      makePackRecord('corrupt-beef', 330),
      makePackRecord('hog1', 150),
      makePackRecord('hog2', 160),
    ]);

    const baselines = computeSpeciesBaselines(allOrders, recMap);
    const beefBaseline = baselines.get('beef')!;
    const porkBaseline = baselines.get('pork')!;

    expect(beefBaseline.metrics.hotToLive.mean).toBeCloseTo(62.0, 1);
    expect(beefBaseline.metrics.hotToLive.samples.some(s => s.orderId === 'corrupt-beef')).toBe(false);
    // coldToLive on corrupt-beef has unflagged coldWeight & liveWeight, so only hotToLive/coolerShrink/packagedToHot are excluded
    expect(beefBaseline.metrics.coolerShrink.samples.some(s => s.orderId === 'corrupt-beef')).toBe(false);

    expect(porkBaseline.metrics.hotToLive.mean).toBeCloseTo(72.9, 1);
    expect(porkBaseline.cleanOrderCount).toBe(2);
  });

  it('suggests approximate weights and switches reporting modes between actuals, corrected estimates, and exclude_flagged', () => {
    const flaggedOrder = makeOrder({
      id: 'flagged-1',
      liveWeight: 1800, // Reported wrong (actual animal was ~1200)
      hotWeight: 744,
      coldWeight: 722,
      weightAnomalies: {
        liveWeight: { status: 'flagged', flaggedAt: '2026-06-20T00:00:00Z', reason: 'Butcher double-counted calf' },
      },
      estimatedWeights: {
        liveWeight: 1205,
        note: 'Estimated from 62% average dressing',
      },
    });
    const pack = [makePackRecord('flagged-1', 397)];
    const allOrders = [...peerOrders, flaggedOrder];
    const recMap = groupRecordsByOrderId([...peerRecords, ...pack]);
    const baselines = computeSpeciesBaselines(allOrders, recMap);

    const { suggestedEstimates, estimateExplanations } = computeSuggestedWeights(
      flaggedOrder,
      397,
      baselines.get('beef')!,
      ['liveWeight']
    );
    expect(suggestedEstimates.liveWeight).toBeCloseTo(1200, -1);
    expect(estimateExplanations.liveWeight).toContain('Dressing avg');

    const analysis = analyzeOrderAnomalies(flaggedOrder, pack, allOrders, recMap, DEFAULT_ANOMALY_SENSITIVITY, baselines);

    // 1. Actuals mode keeps raw weights intact
    const actualRes = computeOrderStatsWithMode(flaggedOrder, pack, 'actuals', analysis);
    expect(actualRes.stats.liveWeight).toBe(1800);
    expect(actualRes.usedEstimates).toBe(false);
    expect(actualRes.excludedFromAverages).toBe(false);

    // 2. Estimates mode substitutes corrected estimate while preserving actualStats
    const estRes = computeOrderStatsWithMode(flaggedOrder, pack, 'estimates', analysis);
    expect(estRes.usedEstimates).toBe(true);
    expect(estRes.estimatedFields).toContain('liveWeight');
    expect(estRes.stats.liveWeight).toBe(1205);
    expect(estRes.actualStats.liveWeight).toBe(1800);
    expect(estRes.stats.hotWeightYield).toBeCloseTo((744 / 1205) * 100, 1);

    // 3. Exclude Flagged marks the order for exclusion
    const exclRes = computeOrderStatsWithMode(flaggedOrder, pack, 'exclude_flagged', analysis);
    expect(exclRes.excludedFromAverages).toBe(true);
    expect(exclRes.flaggedFields).toEqual(['liveWeight']);
  });

  it('builds unified review queue covering anomalies, missing weights, missing fees, pending cuts, and temp metadata while honoring reviewIgnoredFields', () => {
    const cleanComplete = makeOrder({ id: 'clean', orderNumber: '1001' });
    const missingWeightsOrder = makeOrder({ id: 'mw', orderNumber: '1002', liveWeight: 0, hotWeight: 0 });
    const missingFeeOrder = makeOrder({ id: 'mf', orderNumber: '1003', butcherFee: 0 });
    const missingCutsOrder = makeOrder({ id: 'mc', orderNumber: '1004' });
    const tempMetaOrder = makeOrder({
      id: 'mm',
      orderNumber: 'TEMP-999',
      killDate: '',
      animalCount: 0,
      reviewIgnoredFields: ['butcherFee'],
    });
    const ignoredMissingWeights = makeOrder({
      id: 'ignored-ok',
      orderNumber: '1005',
      liveWeight: 0,
      hotWeight: 0,
      coldWeight: 0,
      butcherFee: 0,
      reviewIgnoredFields: ['liveWeight', 'hotWeight', 'coldWeight', 'butcherFee'],
    });

    const orders = [
      cleanComplete,
      missingWeightsOrder,
      missingFeeOrder,
      missingCutsOrder,
      tempMetaOrder,
      ignoredMissingWeights,
    ];
    const recMap = groupRecordsByOrderId([
      makePackRecord('clean', 397),
      makePackRecord('mw', 397),
      makePackRecord('mf', 397),
      makePackRecord('mm', 397),
      makePackRecord('ignored-ok', 397),
    ]);

    const queue = analyzeOrderReviewQueue(orders, recMap, DEFAULT_ANOMALY_SENSITIVITY);

    expect(queue.items.some(i => i.order.id === 'clean')).toBe(false);
    expect(queue.items.some(i => i.order.id === 'ignored-ok')).toBe(false);

    const mwItem = queue.items.find(i => i.order.id === 'mw')!;
    expect(mwItem.categories.has('missing_weights')).toBe(true);

    const mfItem = queue.items.find(i => i.order.id === 'mf')!;
    expect(mfItem.categories.has('missing_fee')).toBe(true);

    const mcItem = queue.items.find(i => i.order.id === 'mc')!;
    expect(mcItem.categories.has('missing_cuts')).toBe(true);

    const mmItem = queue.items.find(i => i.order.id === 'mm')!;
    expect(mmItem.categories.has('missing_metadata')).toBe(true);
    expect(mmItem.categories.has('missing_fee')).toBe(false); // Ignored via N/A

    expect(queue.counts.totalOrdersNeedingReview).toBe(4);
    expect(queue.counts.missing_weights).toBe(1);
    expect(queue.counts.missing_fee).toBe(1);
    expect(queue.counts.missing_cuts).toBe(1);
    expect(queue.counts.missing_metadata).toBe(1);
  });

  it('persists and roundtrips anomaly flags, estimated weights, and ignored fields in SQLite butcher_orders and handles legacy null rows', () => {
    const db: Database.Database = createTestDatabase(':memory:');
    try {
      const orderWithAnomalies: ButcherOrder = makeOrder({
        id: 'sql-1',
        weightAnomalies: {
          liveWeight: { status: 'flagged', flaggedAt: '2026-06-15T12:00:00Z', autoDetected: true, reason: 'Scale glitch' },
        },
        estimatedWeights: {
          liveWeight: 1210.5,
          note: 'Estimated from baseline',
          updatedAt: '2026-06-15T12:05:00Z',
        },
        reviewIgnoredFields: ['butcherFee'],
      });

      db.prepare(`
        INSERT INTO butcher_orders (
          id, orderNumber, species, animalCount, killDate, pickupDate,
          liveWeight, hotWeight, coldWeight, locationId, createdAt,
          birthDate, notes, documents, butcherFee,
          weightAnomalies, estimatedWeights, reviewIgnoredFields
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderWithAnomalies.id,
        orderWithAnomalies.orderNumber,
        orderWithAnomalies.species,
        orderWithAnomalies.animalCount,
        orderWithAnomalies.killDate,
        orderWithAnomalies.pickupDate,
        orderWithAnomalies.liveWeight,
        orderWithAnomalies.hotWeight,
        orderWithAnomalies.coldWeight,
        null,
        orderWithAnomalies.createdAt,
        '',
        '',
        '[]',
        orderWithAnomalies.butcherFee,
        JSON.stringify(orderWithAnomalies.weightAnomalies),
        JSON.stringify(orderWithAnomalies.estimatedWeights),
        JSON.stringify(orderWithAnomalies.reviewIgnoredFields)
      );

      // Also insert legacy row with null JSON columns
      db.prepare(`
        INSERT INTO butcher_orders (
          id, orderNumber, species, animalCount, killDate, pickupDate,
          liveWeight, hotWeight, coldWeight, locationId, createdAt,
          birthDate, notes, documents, butcherFee,
          weightAnomalies, estimatedWeights, reviewIgnoredFields
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'sql-legacy',
        'BO-LEGACY',
        'Pork',
        1,
        '2025-01-10',
        '2025-01-24',
        290,
        210,
        204,
        null,
        1700000000000,
        '',
        '',
        '[]',
        180,
        null,
        null,
        null
      );

      const row = db.prepare('SELECT * FROM butcher_orders WHERE id = ?').get('sql-1') as any;
      expect(JSON.parse(row.weightAnomalies)).toEqual(orderWithAnomalies.weightAnomalies);
      expect(JSON.parse(row.estimatedWeights)).toEqual(orderWithAnomalies.estimatedWeights);
      expect(JSON.parse(row.reviewIgnoredFields)).toEqual(['butcherFee']);

      const legacyRow = db.prepare('SELECT * FROM butcher_orders WHERE id = ?').get('sql-legacy') as any;
      expect(legacyRow.weightAnomalies).toBeNull();
      expect(legacyRow.estimatedWeights).toBeNull();
      expect(legacyRow.reviewIgnoredFields).toBeNull();
    } finally {
      db.close();
    }
  });

  it('renders ButcherRecordsView with Review Queue tab and Audit Weights controls safely in SSR without browser globals', () => {
    const mockState = {
      butcherOrders: [
        makeOrder({
          id: 'ssr-1',
          orderNumber: '2048',
          liveWeight: 900,
          hotWeight: 950, // physical anomaly -> triggers alert banner + review count badge
          weightAnomalies: {
            hotWeight: { status: 'flagged', flaggedAt: '2026-06-15T00:00:00Z', reason: 'Typo' },
          },
          estimatedWeights: { hotWeight: 558 },
        }),
      ],
      butcherRecords: [],
      locations: [],
      products: [],
      pallets: [],
      offSiteEntries: [],
      freezers: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: mockState,
        dispatch: () => {},
      })
    );

    expect(html).toContain('Review Queue');
    expect(html).toContain('Audit Weights');
    expect(html).toContain('Estimate Saved');

    const reviewTabHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: mockState,
        dispatch: () => {},
        activeTab: 'review',
      })
    );
    expect(reviewTabHtml).toContain('id="butcher-review-queue-panel"');
    expect(reviewTabHtml).toContain('Review &amp; Estimate');
    expect(reviewTabHtml).not.toContain('Order Review &amp; Finalization Queue');
    expect(reviewTabHtml).not.toContain('id="review-sensitivity-slider"');

    const reviewFilterOpenHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: mockState,
        dispatch: () => {},
        activeTab: 'review',
        isFilterPanelOpen: true,
      })
    );
    expect(reviewFilterOpenHtml).toContain('id="butcher-review-filter-panel"');
    expect(reviewFilterOpenHtml).toContain('Yield Anomalies');
    expect(reviewFilterOpenHtml).toContain('Closed Audits');

    // Modal should cleanly return null on server when document is unavailable
    const modalHtml = renderToStaticMarkup(
      React.createElement(ButcherAnomalyReviewModal, {
        order: mockState.butcherOrders[0],
        allOrders: mockState.butcherOrders,
        recordsByOrderId: new Map(),
        sensitivity: DEFAULT_ANOMALY_SENSITIVITY,
        onClose: () => {},
        onSave: () => {},
      })
    );
    expect(modalHtml).toBe('');
  });

  it('weights recent harvests significantly higher than 10-year-old harvests to handle multi-year yield drift', () => {
    const t2026 = Date.parse('2026-10-01');
    const t2024 = Date.parse('2024-10-01');
    const t2016 = Date.parse('2016-10-01');

    expect(computeRecencyWeight(t2026, t2026)).toBe(1);
    expect(computeRecencyWeight(t2024, t2026)).toBeCloseTo(0.5, 2);
    expect(computeRecencyWeight(t2016, t2026)).toBe(MIN_RECENCY_WEIGHT);
    expect(RECENCY_HALF_LIFE_DAYS).toBe(730);
    expect(getOrderHarvestTimestamp(makeOrder({ id: 'ts1', killDate: '2026-10-01' }))).toBe(t2026);

    // Scenario: 6 pigs from 10 years ago (2016) dressed at ~64%, while 4 recent pigs (2025-2026)
    // drifted up to ~74% dressing due to breed/butcher changes.
    const oldPigs: ButcherOrder[] = [
      makeOrder({ id: 'old-1', species: 'Pork', killDate: '2016-05-01', liveWeight: 280, hotWeight: 179, coldWeight: 174 }), // 63.9%
      makeOrder({ id: 'old-2', species: 'Pork', killDate: '2016-07-01', liveWeight: 290, hotWeight: 186, coldWeight: 180 }), // 64.1%
      makeOrder({ id: 'old-3', species: 'Pork', killDate: '2016-09-01', liveWeight: 300, hotWeight: 192, coldWeight: 186 }), // 64.0%
      makeOrder({ id: 'old-4', species: 'Pork', killDate: '2017-05-01', liveWeight: 285, hotWeight: 182, coldWeight: 177 }), // 63.9%
      makeOrder({ id: 'old-5', species: 'Pork', killDate: '2017-07-01', liveWeight: 295, hotWeight: 189, coldWeight: 183 }), // 64.1%
      makeOrder({ id: 'old-6', species: 'Pork', killDate: '2017-09-01', liveWeight: 275, hotWeight: 176, coldWeight: 171 }), // 64.0%
    ];

    const recentPigs: ButcherOrder[] = [
      makeOrder({ id: 'new-1', species: 'Pork', killDate: '2025-10-01', liveWeight: 300, hotWeight: 222, coldWeight: 215 }), // 74.0%
      makeOrder({ id: 'new-2', species: 'Pork', killDate: '2026-02-01', liveWeight: 310, hotWeight: 229, coldWeight: 222 }), // 73.9%
      makeOrder({ id: 'new-3', species: 'Pork', killDate: '2026-06-01', liveWeight: 295, hotWeight: 218, coldWeight: 211 }), // 73.9%
      makeOrder({ id: 'new-4', species: 'Pork', killDate: '2026-09-01', liveWeight: 305, hotWeight: 226, coldWeight: 219 }), // 74.1%
    ];

    const todayNormalPig = makeOrder({
      id: 'today-ok',
      species: 'Pork',
      killDate: '2026-11-01',
      liveWeight: 300,
      hotWeight: 222, // 74.0% matches recent cohort
      coldWeight: 215,
    });

    const todayAnomalousPig = makeOrder({
      id: 'today-bad',
      species: 'Pork',
      killDate: '2026-11-10',
      liveWeight: 347, // Mistyped live weight giving 64.0% dressing (like 2016 cohort) on a 300-lb hog's carcass
      hotWeight: 222,
      coldWeight: 215,
    });

    const allPigs = [...oldPigs, ...recentPigs, todayNormalPig, todayAnomalousPig];
    const allPigRecs = allPigs.map(p => makePackRecord(p.id, Math.round(p.coldWeight * 0.72)));
    const recMap = groupRecordsByOrderId(allPigRecs);

    const baselines = computeSpeciesBaselines(allPigs, recMap);
    const porkBaseline = baselines.get('pork')!;

    // Weighted median & mean should anchor firmly near the recent ~74% yields, not the 10-year-old ~64%
    expect(porkBaseline.metrics.hotToLive.median).toBeGreaterThan(73.0);
    expect(porkBaseline.metrics.hotToLive.mean).toBeGreaterThan(71.0);

    const normalAnalysis = analyzeOrderAnomalies(
      todayNormalPig,
      recMap.get('today-ok')!,
      [...oldPigs, ...recentPigs, todayNormalPig],
      recMap
    );
    expect(normalAnalysis.hasStatisticalAnomalies).toBe(false);
    expect(normalAnalysis.needsReview).toBe(false);

    const badAnalysis = analyzeOrderAnomalies(
      todayAnomalousPig,
      recMap.get('today-bad')!,
      [...oldPigs, ...recentPigs, todayAnomalousPig],
      recMap
    );
    expect(badAnalysis.hasStatisticalAnomalies).toBe(true);
    expect(badAnalysis.needsReview).toBe(true);
    expect(badAnalysis.suspectFields[0]).toBe('liveWeight');
    // Suggested liveWeight should reconstruct ~300 lbs from recent ~74% baseline, not ~347 lbs
    expect(badAnalysis.suggestedEstimates.liveWeight).toBeGreaterThan(294);
    expect(badAnalysis.suggestedEstimates.liveWeight).toBeLessThan(306);
  });

  it('re-evaluates anomalies live when weights are flagged or adjusted: auto-clears resolved peers and updates remaining suspect suggestions', () => {
    const baseConflictOrder = makeOrder({
      id: 'conflict-1',
      liveWeight: 1000,
      hotWeight: 620,
      coldWeight: 700, // Cold exceeds hot -> initially flags both hotWeight and coldWeight
    });
    const basePack = [makePackRecord('conflict-1', 331)];
    const allOrders = [...peerOrders, baseConflictOrder];
    const recMap = groupRecordsByOrderId([...peerRecords, ...basePack]);
    const baselines = computeSpeciesBaselines(allOrders, recMap);

    // 1. Initially, cold > hot puts BOTH coldWeight and hotWeight in suspectFields
    const initial = analyzeOrderAnomalies(
      baseConflictOrder,
      basePack,
      allOrders,
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      baselines
    );
    expect(initial.hasPhysicalErrors).toBe(true);
    expect(initial.needsReview).toBe(true);
    expect(initial.suspectFields).toContain('coldWeight');
    expect(initial.suspectFields).toContain('hotWeight');

    // 2. Flagging coldWeight without an estimate yet skips coldWeight pair checks so valid hotWeight auto-clears
    const flaggedNoEst: ButcherOrder = {
      ...baseConflictOrder,
      weightAnomalies: {
        coldWeight: { status: 'flagged', flaggedAt: '2026-06-20T00:00:00Z', reason: 'Scale typo' },
      },
    };
    const afterFlagNoEst = analyzeOrderAnomalies(
      flaggedNoEst,
      basePack,
      allOrders.map(o => (o.id === flaggedNoEst.id ? flaggedNoEst : o)),
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      baselines
    );
    expect(afterFlagNoEst.hasPhysicalErrors).toBe(false);
    expect(afterFlagNoEst.suspectFields).not.toContain('hotWeight');
    expect(afterFlagNoEst.needsReview).toBe(false);

    // 3. Providing corrected coldWeight = 601 reruns all checks, clears phys-cold-gt-hot & auto-clears hotWeight
    const fixedColdOrder: ButcherOrder = {
      ...flaggedNoEst,
      estimatedWeights: { coldWeight: 601 },
    };
    const afterFixedCold = analyzeOrderAnomalies(
      fixedColdOrder,
      basePack,
      allOrders.map(o => (o.id === fixedColdOrder.id ? fixedColdOrder : o)),
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      baselines
    );
    expect(afterFixedCold.effectiveWeights.coldWeight).toBe(601);
    expect(afterFixedCold.adjustedFields).toEqual(['coldWeight']);
    expect(afterFixedCold.hasPhysicalErrors).toBe(false);
    expect(afterFixedCold.hasStatisticalAnomalies).toBe(false);
    expect(afterFixedCold.suspectFields).toEqual([]);
    expect(afterFixedCold.needsReview).toBe(false);

    // 4. Dual-bad scenario (both hot=800 and cold=850 are wrong): fixing coldWeight=601 clears cold>hot
    //    but hotWeight STAYS out of threshold and its suggested estimate uses adjusted coldWeight (601)
    const dualBadFixedCold: ButcherOrder = makeOrder({
      id: 'dual-bad',
      liveWeight: 1000,
      hotWeight: 800,
      coldWeight: 850,
      weightAnomalies: {
        coldWeight: { status: 'flagged', flaggedAt: '2026-06-20T00:00:00Z', reason: 'Fixed cold' },
      },
      estimatedWeights: { coldWeight: 601 },
    });
    const dualPack = [makePackRecord('dual-bad', 331)];
    const dualOrders = [...peerOrders, dualBadFixedCold];
    const dualRecMap = groupRecordsByOrderId([...peerRecords, ...dualPack]);
    const dualAnalysis = analyzeOrderAnomalies(
      dualBadFixedCold,
      dualPack,
      dualOrders,
      dualRecMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      baselines
    );
    expect(dualAnalysis.hasPhysicalErrors).toBe(false);
    expect(dualAnalysis.hasStatisticalAnomalies).toBe(true);
    expect(dualAnalysis.suspectFields).toEqual(['hotWeight']);
    expect(dualAnalysis.needsReview).toBe(true);
    expect(dualAnalysis.suggestedEstimates.hotWeight).toBeGreaterThan(615);
    expect(dualAnalysis.suggestedEstimates.hotWeight).toBeLessThan(625);
    expect(dualAnalysis.estimateExplanations.hotWeight).toContain('Cold (est.) 601.0 lbs');

    // 5. Confirming hotWeight valid keeps unreviewed coldWeight flagged & uses hotWeight as Tier-1 anchor
    const confirmedHotOrder: ButcherOrder = {
      ...baseConflictOrder,
      weightAnomalies: {
        hotWeight: { status: 'dismissed', flaggedAt: '2026-06-20T00:00:00Z', reason: 'Verified hot scale ticket' },
      },
    };
    const afterConfirmHot = analyzeOrderAnomalies(
      confirmedHotOrder,
      basePack,
      allOrders.map(o => (o.id === confirmedHotOrder.id ? confirmedHotOrder : o)),
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      baselines
    );
    expect(afterConfirmHot.needsReview).toBe(true);
    expect(afterConfirmHot.suspectFields).toEqual(['coldWeight']);
    expect(afterConfirmHot.estimateExplanations.coldWeight).toContain('Hot 620.0 lbs');

    // 6. Entering an adjusted coldWeight that still exceeds hotWeight (635 > 620) re-flags the physical error
    const badEstimateOrder: ButcherOrder = {
      ...flaggedNoEst,
      estimatedWeights: { coldWeight: 635 },
    };
    const afterBadEstimate = analyzeOrderAnomalies(
      badEstimateOrder,
      basePack,
      allOrders.map(o => (o.id === badEstimateOrder.id ? badEstimateOrder : o)),
      recMap,
      DEFAULT_ANOMALY_SENSITIVITY,
      baselines
    );
    expect(afterBadEstimate.hasPhysicalErrors).toBe(true);
    expect(afterBadEstimate.findings.some(f => f.id === 'phys-cold-gt-hot')).toBe(true);
    expect(afterBadEstimate.needsReview).toBe(true);
  });

  it('never derives a circular self-estimate from the target order and averages both upstream and downstream peers when available', () => {
    // Peer lamb orders have carcass weights (coolerShrink ~3%) but NO packaged cut records yet
    const lambPeers: ButcherOrder[] = [
      makeOrder({ id: 'lamb-p1', species: 'Lamb', liveWeight: 0, hotWeight: 200, coldWeight: 194 }),
      makeOrder({ id: 'lamb-p2', species: 'Lamb', liveWeight: 0, hotWeight: 250, coldWeight: 242.5 }),
      makeOrder({ id: 'lamb-p3', species: 'Lamb', liveWeight: 0, hotWeight: 300, coldWeight: 291 }),
    ];
    // Target order has physical conflict cold (305) > hot (295), and is the ONLY lamb order with packagedWeight (277 -> 90.8%)
    const targetLamb = makeOrder({
      id: 'lamb-target',
      species: 'Lamb',
      liveWeight: 0,
      hotWeight: 295,
      coldWeight: 305,
    });
    const lambRecs = [makePackRecord('lamb-target', 277)];
    const allLambOrders = [...lambPeers, targetLamb];
    const lambRecMap = groupRecordsByOrderId(lambRecs);

    const analysis = analyzeOrderAnomalies(targetLamb, lambRecs, allLambOrders, lambRecMap);
    // Must NEVER circularly suggest 305.0 from its own 277 / 305 = 90.8% ratio
    expect(analysis.suggestedEstimates.coldWeight).not.toBe(305);
    expect(analysis.estimateExplanations.coldWeight || '').not.toContain('90.8%');
    // Falls back to upstream Hot weight with 3% peer coolerShrink -> ~286.2 lbs [upstream]
    expect(analysis.suggestedEstimates.coldWeight).toBeCloseTo(286.2, 0);
    expect(analysis.estimateExplanations.coldWeight).toContain('[upstream]');

    // With zero peer orders of a species at all, no self-derived suggestion should be invented
    const soloGoat = makeOrder({
      id: 'goat-solo',
      species: 'Goat',
      liveWeight: 100,
      hotWeight: 55,
      coldWeight: 60, // cold > hot
    });
    const soloRecs = [makePackRecord('goat-solo', 40)];
    const soloAnalysis = analyzeOrderAnomalies(
      soloGoat,
      soloRecs,
      [soloGoat],
      groupRecordsByOrderId(soloRecs)
    );
    expect(soloAnalysis.suggestedEstimates.coldWeight).toBeUndefined();

    // When both upstream (hot, live) and downstream (packaged) have clean peers and coldWeight is flagged,
    // both upstream and downstream estimates are averaged and clearly labeled
    const fullBeef = makeOrder({
      id: 'beef-both',
      species: 'Beef',
      liveWeight: 1000,
      hotWeight: 620,
      coldWeight: 700, // wrong cold weight
      weightAnomalies: {
        coldWeight: { status: 'flagged', flaggedAt: '2026-06-20T00:00:00Z', reason: 'Typo' },
      },
    });
    const fullBeefRecs = [makePackRecord('beef-both', 331)];
    const fullBeefAnalysis = analyzeOrderAnomalies(
      fullBeef,
      fullBeefRecs,
      [...peerOrders, fullBeef],
      groupRecordsByOrderId([...peerRecords, ...fullBeefRecs])
    );
    expect(fullBeefAnalysis.estimateExplanations.coldWeight).toContain('[upstream]');
    expect(fullBeefAnalysis.estimateExplanations.coldWeight).toContain('[downstream]');
    expect(fullBeefAnalysis.suggestedEstimates.coldWeight).toBeCloseTo(601, -1);
  });

  it('uses nearest adjacent trusted anchors, respects physical bounds (cold <= hot), and does not cascade confirmed Live->Hot outliers onto normal Cold weight', () => {
    // Peer pigs with standard ~80% dressing, ~2.8% cooler shrink, ~84% cutting yield (~65% standing)
    const porkPeers: ButcherOrder[] = [
      makeOrder({ id: 'pg-1', species: 'Pork', liveWeight: 280, hotWeight: 224, coldWeight: 217.7 }),
      makeOrder({ id: 'pg-2', species: 'Pork', liveWeight: 290, hotWeight: 232, coldWeight: 225.5 }),
      makeOrder({ id: 'pg-3', species: 'Pork', liveWeight: 300, hotWeight: 240, coldWeight: 233.3 }),
      makeOrder({ id: 'pg-4', species: 'Pork', liveWeight: 310, hotWeight: 248, coldWeight: 241.1 }),
      makeOrder({ id: 'pg-5', species: 'Pork', liveWeight: 295, hotWeight: 236, coldWeight: 229.4 }),
    ];
    const porkPeerRecs = porkPeers.map(p => makePackRecord(p.id, Math.round(p.coldWeight * 0.84)));

    // Large skinned sow: Live=640 (Confirmed Valid), Hot=365 (Confirmed Valid, skinned 57% dressing),
    // Cold=354 (normal 3.01% cooler shrink from Hot=365), Packaged=347.8
    const skinnedSow = makeOrder({
      id: 'sow-skinned',
      species: 'Pork',
      liveWeight: 640,
      hotWeight: 365,
      coldWeight: 354,
      weightAnomalies: {
        liveWeight: { status: 'dismissed', flaggedAt: '2026-11-18T00:00:00Z', reason: 'Really large pig' },
        hotWeight: { status: 'dismissed', flaggedAt: '2026-11-18T00:00:00Z', reason: 'Had to skin her' },
      },
    });
    const sowRecs = [makePackRecord('sow-skinned', 347.8)];

    const analysis = analyzeOrderAnomalies(
      skinnedSow,
      sowRecs,
      [...porkPeers, skinnedSow],
      groupRecordsByOrderId([...porkPeerRecs, ...sowRecs])
    );

    // 1. Confirmed Live->Hot anomaly must not cascade via coldToLive onto normal Cold=354 (3.01% shrink)
    expect(analysis.suspectFields).not.toContain('coldWeight');
    expect(analysis.findings.some(f => f.id === 'stat-coldToLive')).toBe(false);
    expect(analysis.findings.some(f => f.id === 'stat-packagedToLive')).toBe(false);

    // 2. Cold Weight suggestion MUST use adjacent Hot=365 (not jump past Hot to Live=640) and MUST be <= Hot (365)
    expect(analysis.suggestedEstimates.coldWeight).toBeDefined();
    expect(analysis.suggestedEstimates.coldWeight!).toBeLessThanOrEqual(365);
    expect(analysis.suggestedEstimates.coldWeight!).toBeCloseTo(354.8, 0);
    expect(analysis.estimateExplanations.coldWeight).toContain('Hot 365.0 lbs');
    expect(analysis.estimateExplanations.coldWeight).not.toContain('Live 640.0 lbs');

    // 3. Packaged Weight suggestion MUST use nearest adjacent Cold=354 (not jump to Live=640) and MUST be <= Cold (354)
    expect(analysis.suggestedEstimates.packagedWeight).toBeDefined();
    expect(analysis.suggestedEstimates.packagedWeight!).toBeLessThanOrEqual(354);
    expect(analysis.estimateExplanations.packagedWeight).toContain('Cold 354.0 lbs');
    expect(analysis.estimateExplanations.packagedWeight).not.toContain('Live 640.0 lbs');

    // 4. Even if Packaged (347.8) is also Confirmed Valid (implying 347.8/0.84 = 414 > Hot 365),
    //    Cold Weight suggestion still stays bounded <= Hot (365) and picks plausible Hot estimate (~354.8)
    const allConfirmedSow: ButcherOrder = {
      ...skinnedSow,
      weightAnomalies: {
        ...skinnedSow.weightAnomalies,
        packagedWeight: { status: 'dismissed', flaggedAt: '2026-11-18T00:00:00Z', reason: '228 verified cuts' },
      },
    };
    const boundedAnalysis = analyzeOrderAnomalies(
      allConfirmedSow,
      sowRecs,
      [...porkPeers, allConfirmedSow],
      groupRecordsByOrderId([...porkPeerRecs, ...sowRecs])
    );
    expect(boundedAnalysis.suggestedEstimates.coldWeight!).toBeLessThanOrEqual(365);
    expect(boundedAnalysis.suggestedEstimates.coldWeight!).toBeCloseTo(354.8, 0);
  });

  it('finalizing/closing an audit silences review queue reminders even when other orders shift baselines, preserves reporting/baselines, and can be reopened', () => {
    // An order with missing fee, missing live weight, and an outlier cutting yield
    const closedHistorical = makeOrder({
      id: 'closed-hist',
      orderNumber: '1901',
      liveWeight: 0, // missing weight
      hotWeight: 700,
      coldWeight: 680,
      butcherFee: 0, // missing fee
      killDate: '', // missing metadata
      auditClosed: true,
      auditClosedAt: '2026-11-19T12:00:00.000Z',
    });
    const closedOutlier = makeOrder({
      id: 'closed-outlier',
      orderNumber: '1902',
      liveWeight: 1200,
      hotWeight: 540, // 45% dressing (huge outlier vs ~62% peers)
      coldWeight: 524,
      weightAnomalies: {
        hotWeight: { status: 'flagged', flaggedAt: '2026-11-19T12:00:00.000Z', reason: 'Scale glitch' },
      },
      estimatedWeights: { hotWeight: 744, note: 'Reviewed and finalized' },
      auditClosed: true,
      auditClosedAt: '2026-11-19T12:05:00.000Z',
    });
    const openOutlier = makeOrder({
      id: 'open-outlier',
      orderNumber: '1903',
      liveWeight: 1200,
      hotWeight: 540,
      coldWeight: 524,
    });

    const orders = [...peerOrders, closedHistorical, closedOutlier, openOutlier];
    const recMap = groupRecordsByOrderId([
      ...peerRecords,
      // closedHistorical intentionally has NO cuts either (missing_cuts)
      makePackRecord('closed-outlier', 397),
      makePackRecord('open-outlier', 397),
    ]);

    const queue = analyzeOrderReviewQueue(orders, recMap, MIN_ANOMALY_SENSITIVITY);

    // Closed orders must NOT appear in active items or increment any active backlog/anomaly counters
    expect(queue.items.some(i => i.order.id === 'closed-hist')).toBe(false);
    expect(queue.items.some(i => i.order.id === 'closed-outlier')).toBe(false);
    expect(queue.items.some(i => i.order.id === 'open-outlier')).toBe(true);
    expect(queue.counts.totalOrdersNeedingReview).toBe(1);
    expect(queue.counts.anomaly).toBe(1);
    expect(queue.counts.missing_weights).toBe(0);
    expect(queue.counts.missing_fee).toBe(0);
    expect(queue.counts.missing_cuts).toBe(0);
    expect(queue.counts.missing_metadata).toBe(0);

    // Closed orders are tracked cleanly in closedItems & counts.closed
    expect(queue.counts.closed).toBe(2);
    expect(queue.closedItems.map(i => i.order.id)).toEqual(['closed-hist', 'closed-outlier']);

    // allOrderAnalyses still exists for closed orders, with needsReview = false and auditClosed = true
    const closedOutlierAnalysis = queue.allOrderAnalyses.get('closed-outlier')!;
    expect(closedOutlierAnalysis.auditClosed).toBe(true);
    expect(closedOutlierAnalysis.needsReview).toBe(false);

    // Saved estimates & exclude_flagged reporting modes still work on closed orders
    const estStats = computeOrderStatsWithMode(
      closedOutlier,
      recMap.get('closed-outlier')!,
      'estimates',
      closedOutlierAnalysis
    );
    expect(estStats.usedEstimates).toBe(true);
    expect(estStats.stats.hotWeight).toBe(744);
    const exclStats = computeOrderStatsWithMode(
      closedOutlier,
      recMap.get('closed-outlier')!,
      'exclude_flagged',
      closedOutlierAnalysis
    );
    expect(exclStats.excludedFromAverages).toBe(true);

    // Now simulate adjusting other peer orders later (drifting peers to 68% dressing) ->
    // even a closed order with unflagged weights that would now look anomalous stays silenced!
    const closedPreviouslyNormal = makeOrder({
      id: 'closed-normal',
      orderNumber: '1904',
      liveWeight: 1200,
      hotWeight: 744, // 62%
      coldWeight: 722,
      auditClosed: true,
      auditClosedAt: '2026-11-19T12:10:00.000Z',
    });
    const shiftedPeers = peerOrders.map(p => ({
      ...p,
      hotWeight: Math.round(p.liveWeight * 0.72), // shifted +10 pts
      coldWeight: Math.round(p.liveWeight * 0.70),
    }));
    const shiftedRecMap = groupRecordsByOrderId([
      ...shiftedPeers.map(p => makePackRecord(p.id, Math.round(p.coldWeight * 0.55))),
      makePackRecord('closed-normal', 397),
    ]);
    const shiftedQueue = analyzeOrderReviewQueue(
      [...shiftedPeers, closedPreviouslyNormal],
      shiftedRecMap,
      MIN_ANOMALY_SENSITIVITY
    );
    expect(shiftedQueue.counts.totalOrdersNeedingReview).toBe(0);
    expect(shiftedQueue.counts.anomaly).toBe(0);
    expect(shiftedQueue.counts.closed).toBe(1);
    expect(shiftedQueue.allOrderAnalyses.get('closed-normal')!.needsReview).toBe(false);

    // Reopening the audit immediately restores active anomaly detection
    const reopenedQueue = analyzeOrderReviewQueue(
      [...shiftedPeers, { ...closedPreviouslyNormal, auditClosed: false, auditClosedAt: undefined }],
      shiftedRecMap,
      MIN_ANOMALY_SENSITIVITY
    );
    expect(reopenedQueue.counts.totalOrdersNeedingReview).toBe(1);
    expect(reopenedQueue.counts.anomaly).toBe(1);
    expect(reopenedQueue.counts.closed).toBe(0);
    expect(reopenedQueue.allOrderAnalyses.get('closed-normal')!.needsReview).toBe(true);
  });

  it('honors aggregate reviewIgnoredFields keys (missingWeights and missingMetadata) toggled by Mark N/A in the review modal', () => {
    const orderWithMissing = makeOrder({
      id: 'na-agg',
      orderNumber: 'TEMP-555',
      liveWeight: 0,
      hotWeight: 0,
      coldWeight: 0,
      killDate: '',
      animalCount: 0,
      reviewIgnoredFields: ['missingWeights', 'missingMetadata'],
    });
    const recMap = groupRecordsByOrderId([makePackRecord('na-agg', 350)]);
    const queue = analyzeOrderReviewQueue([orderWithMissing], recMap);

    expect(queue.counts.missing_weights).toBe(0);
    expect(queue.counts.missing_metadata).toBe(0);
    expect(queue.items).toHaveLength(0);
  });

  it('persists auditClosed and auditClosedAt in SQLite butcher_orders and renders Audit Closed state in SSR without active alert banners', () => {
    const db: Database.Database = createTestDatabase(':memory:');
    try {
      db.prepare(`
        INSERT INTO butcher_orders (
          id, orderNumber, species, animalCount, killDate, pickupDate,
          liveWeight, hotWeight, coldWeight, locationId, createdAt,
          birthDate, notes, documents, butcherFee,
          weightAnomalies, estimatedWeights, reviewIgnoredFields, tagIds,
          auditClosed, auditClosedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'sql-closed',
        'BO-CLOSED',
        'Beef',
        1,
        '2026-06-01',
        '2026-06-15',
        1200,
        744,
        722,
        null,
        1700000000000,
        '',
        '',
        '[]',
        450,
        null,
        null,
        null,
        null,
        1,
        '2026-11-19T13:00:00.000Z'
      );

      const row = db.prepare('SELECT auditClosed, auditClosedAt FROM butcher_orders WHERE id = ?').get('sql-closed') as any;
      expect(row.auditClosed).toBe(1);
      expect(row.auditClosedAt).toBe('2026-11-19T13:00:00.000Z');
    } finally {
      db.close();
    }

    const mockState = {
      butcherOrders: [
        makeOrder({
          id: 'ssr-closed-1',
          orderNumber: '3099',
          liveWeight: 900,
          hotWeight: 950, // physical conflict, but audit is explicitly closed
          auditClosed: true,
          auditClosedAt: '2026-11-19T13:00:00.000Z',
        }),
      ],
      butcherRecords: [],
      locations: [],
      products: [],
      pallets: [],
      offSiteEntries: [],
      freezers: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: mockState,
        dispatch: () => {},
      })
    );

    expect(html).toContain('Audit Closed');
    expect(html).not.toContain('Yield Alert');
    expect(html).not.toContain('awaiting review');
  });
});
