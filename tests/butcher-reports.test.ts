import { describe, it, expect } from 'vitest';
import { ButcherOrder, ButcherRecord } from '../types';
import { computeOrderStats, calculateDaysAlive, aggregateCutsByProduct } from '../utils/butcherStats';

describe('Workflow: Butcher Reports & Yield Calculations', () => {
  const sampleOrder: ButcherOrder = {
    id: 'order-101',
    orderNumber: 'BO-2026-001',
    species: 'Beef',
    animalCount: 2,
    liveWeight: 2400, // 1200 lbs per head
    hotWeight: 1488,  // 62% dressing
    coldWeight: 1440, // 3.23% cooler shrink
    createdAt: Date.now(),
  };

  const sampleRecords: ButcherRecord[] = [
    {
      id: 'rec-1',
      serial: 'SN-001',
      productId: 'prod-ribeye',
      cuts: 'Ribeye Steaks',
      pieces: 24,
      netWeight: 36.0,
      orderId: 'order-101',
    },
    {
      id: 'rec-2',
      serial: 'SN-002',
      productId: 'prod-brisket',
      cuts: 'Whole Packer Brisket',
      pieces: 4,
      netWeight: 52.0,
      orderId: 'order-101',
    },
    {
      id: 'rec-3',
      serial: 'SN-003',
      productId: 'prod-ground-beef',
      cuts: 'Ground Beef 1lb',
      pieces: 400,
      netWeight: 400.0,
      orderId: 'order-101',
    },
    {
      id: 'rec-4',
      serial: 'SN-004',
      productId: 'prod-roasts',
      cuts: 'Chuck Roast',
      pieces: 50,
      netWeight: 180.0,
      orderId: 'order-101',
    },
    {
      id: 'rec-5',
      serial: 'SN-005',
      productId: 'prod-short-ribs',
      cuts: 'Short Ribs',
      pieces: 30,
      netWeight: 92.0,
      orderId: 'order-101',
    },
  ];

  it('accurately computes packaged weight, package count, and averages', () => {
    const stats = computeOrderStats(sampleOrder, sampleRecords);

    // Sum: 36 + 52 + 400 + 180 + 92 = 760 lbs
    expect(stats.packagedWeight).toBe(760);
    // Pieces: 24 + 4 + 400 + 50 + 30 = 508 pieces
    expect(stats.totalPieces).toBe(508);
    // 5 packages/records
    expect(stats.count).toBe(5);
    expect(stats.avgPackageWeight).toBeCloseTo(760 / 5, 2);
    expect(stats.avgPiecesPerPackage).toBeCloseTo(508 / 5, 2);
  });

  it('accurately computes per-animal averages for multi-animal orders', () => {
    const stats = computeOrderStats(sampleOrder, sampleRecords);

    // animalCount = 2
    expect(stats.liveWeightPerAnimal).toBe(1200);
    expect(stats.hotWeightPerAnimal).toBe(744);
    expect(stats.coldWeightPerAnimal).toBe(720);
    expect(stats.packagedWeightPerAnimal).toBe(380);
  });

  it('accurately calculates commercial yield percentages', () => {
    const stats = computeOrderStats(sampleOrder, sampleRecords);

    // Hot yield: (1488 / 2400) * 100 = 62.0%
    expect(stats.hotWeightYield).toBeCloseTo(62.0, 1);

    // Cooler shrinkage: ((1488 - 1440) / 1488) * 100 = 3.2258%
    expect(stats.coolerShrinkage).toBeCloseTo(3.23, 2);

    // Cutting yield: (760 / 1440) * 100 = 52.78%
    expect(stats.cuttingYield).toBeCloseTo(52.78, 2);

    // Finish to live: (760 / 2400) * 100 = 31.67%
    expect(stats.finishToLiveYield).toBeCloseTo(31.67, 2);

    // Finish to hot: (760 / 1488) * 100 = 51.08%
    expect(stats.finishToHotYield).toBeCloseTo(51.08, 2);

    // Finish to cold: (760 / 1440) * 100 = 52.78%
    expect(stats.finishToColdYield).toBeCloseTo(52.78, 2);
  });

  it('calculates loss breakdown in pounds accurately', () => {
    const stats = computeOrderStats(sampleOrder, sampleRecords);

    // Total loss: 2400 - 760 = 1640 lbs
    expect(stats.totalLoss).toBe(1640);

    // Dressing loss (gut/hide/head): 2400 - 1488 = 912 lbs
    expect(stats.dressingLoss).toBe(912);

    // Cooler shrink loss: 1488 - 1440 = 48 lbs
    expect(stats.coolerLoss).toBe(48);

    // Cutting loss (bone/trim/fat): 1440 - 760 = 680 lbs
    expect(stats.cuttingLoss).toBe(680);
  });

  it('safely handles missing or zero weights without crashing or producing NaN/Infinity', () => {
    const emptyOrder: ButcherOrder = {
      id: 'order-empty',
      orderNumber: 'BO-EMPTY',
      species: 'Pork',
      animalCount: 0,
      liveWeight: 0,
      hotWeight: 0,
      coldWeight: 0,
      createdAt: Date.now(),
    };

    const stats = computeOrderStats(emptyOrder, []);

    expect(Number.isFinite(stats.hotWeightYield)).toBe(true);
    expect(Number.isFinite(stats.coolerShrinkage)).toBe(true);
    expect(Number.isFinite(stats.cuttingYield)).toBe(true);
    expect(Number.isFinite(stats.finishToLiveYield)).toBe(true);
    expect(stats.hotWeightYield).toBe(0);
    expect(stats.cuttingYield).toBe(0);
    expect(stats.packagedWeight).toBe(0);
    expect(stats.totalPieces).toBe(0);
  });

  it('calculates animal age in days correctly via calculateDaysAlive', () => {
    // 600 days between birth and slaughter
    const birthDate = '2025-01-01';
    const killDate = '2026-08-24';
    const days = calculateDaysAlive(birthDate, killDate);
    expect(days).toBe(600);

    // Gracefully handles missing dates
    expect(calculateDaysAlive(undefined, killDate)).toBeNull();
    expect(calculateDaysAlive(birthDate, undefined)).toBeNull();
    expect(calculateDaysAlive('invalid-date', killDate)).toBeNull();
  });

  it('aggregates cut breakdowns and ranks cuts by total net weight', () => {
    const aggregations = aggregateCutsByProduct(sampleRecords);

    expect(aggregations.length).toBe(5);
    // Ground beef is heaviest (400 lbs out of 760 total -> 52.63%)
    expect(aggregations[0].name).toBe('Ground Beef 1lb');
    expect(aggregations[0].weight).toBe(400);
    expect(aggregations[0].pieces).toBe(400);
    expect(aggregations[0].percentageOfTotalWeight).toBeCloseTo(52.63, 1);

    // Second heaviest is Chuck Roast (180 lbs -> 23.68%)
    expect(aggregations[1].name).toBe('Chuck Roast');
    expect(aggregations[1].weight).toBe(180);

    // Lightest is Ribeye Steaks (36 lbs -> 4.74%)
    expect(aggregations[4].name).toBe('Ribeye Steaks');
    expect(aggregations[4].weight).toBe(36);
  });
});
