import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { ButcherOrder, ButcherRecord } from '../types';
import {
  parseCalendarDate,
  diffCalendarDays,
  computeOrderTimelineMetrics,
  computeButcherTimelineReport,
  formatTimelineReportCsv,
  formatDaysAsMonths,
} from '../utils/butcherTimelines';
import { computeOrderStats } from '../utils/butcherStats';
import { ButcherTimelinesReport } from '../components/ButcherTimelinesReport';

describe('Butcher Date & Timeline Analytics Engine', () => {
  it('parses ISO, US, slash, and datetime strings into DST-safe UTC dates and rejects invalid calendar dates', () => {
    const iso = parseCalendarDate('2026-03-01');
    const us = parseCalendarDate('3/15/2026');
    const slash = parseCalendarDate('2026/03/20');
    const timestamp = parseCalendarDate('2026-03-22T14:30:00Z');

    expect(iso?.iso).toBe('2026-03-01');
    expect(us?.iso).toBe('2026-03-15');
    expect(slash?.iso).toBe('2026-03-20');
    expect(timestamp?.iso).toBe('2026-03-22');

    // Crosses US spring-forward DST boundary cleanly (14 exact calendar days)
    expect(diffCalendarDays(iso!, us!)).toBe(14);
    expect(diffCalendarDays(us!, slash!)).toBe(5);

    // Invalid calendar dates and malformed strings return null
    expect(parseCalendarDate('2026-02-30')).toBeNull();
    expect(parseCalendarDate('2026-13-01')).toBeNull();
    expect(parseCalendarDate('not-a-date')).toBeNull();
    expect(parseCalendarDate('')).toBeNull();
    expect(parseCalendarDate(undefined)).toBeNull();
  });

  it('computes all core and extended lifecycle metrics for a multi-day packaging order', () => {
    const order: ButcherOrder = {
      id: 'ord-1',
      orderNumber: '2026-100',
      species: 'Beef',
      animalCount: 2,
      birthDate: '2024-10-01',
      killDate: '2026-10-01', // 730 days alive (2025 & 2026 non-leap)
      pickupDate: '2026-10-22', // 21 days from kill
      liveWeight: 2555, // 1277.5 lbs/animal -> 1.75 lb/day live ADG
      hotWeight: 1606, // 803 lbs/animal -> 1.10 lb/day carcass ADG
      coldWeight: 1550,
      locationId: 'loc-valley',
      createdAt: 1700000000000,
    };

    // Packed across 2 distinct days spanning 4 inclusive calendar days (Oct 15 & Oct 18)
    const records: ButcherRecord[] = [
      { id: 'r1', serial: 'S1', orderId: 'ord-1', packDate: '2026-10-15', pieces: 10, netWeight: 200 },
      { id: 'r2', serial: 'S2', orderId: 'ord-1', packDate: '2026-10-15', pieces: 15, netWeight: 250 },
      { id: 'r3', serial: 'S3', orderId: 'ord-1', packDate: '10/18/2026', pieces: 20, netWeight: 350 },
      { id: 'r4', serial: 'S4', orderId: 'ord-1', packDate: '2026-10-18', pieces: 15, netWeight: 200 },
    ];

    const locationMap = new Map([['loc-valley', 'Valley Meat Processors']]);
    const metrics = computeOrderTimelineMetrics(order, records, undefined, locationMap);

    expect(metrics.hasWarnings).toBe(false);
    expect(metrics.butcherName).toBe('Valley Meat Processors');
    expect(metrics.daysAlive).toBe(730);
    expect(metrics.firstPackDate).toBe('2026-10-15');
    expect(metrics.lastPackDate).toBe('2026-10-18');
    expect(metrics.killToFirstPackDays).toBe(14); // Oct 1 -> Oct 15
    expect(metrics.killToLastPackDays).toBe(17); // Oct 1 -> Oct 18
    expect(metrics.packageSpanDays).toBe(4); // Oct 15..18 inclusive = 4 days
    expect(metrics.distinctPackDays).toBe(2); // Oct 15 and Oct 18
    expect(metrics.lastPackToPickupDays).toBe(4); // Oct 18 -> Oct 22
    expect(metrics.killToPickupDays).toBe(21); // Oct 1 -> Oct 22

    // Daily Gain (ADG)
    expect(metrics.liveWeightPerDayAlive).toBeCloseTo(1.75, 2);
    expect(metrics.hotWeightPerDayAlive).toBeCloseTo(1.10, 2);

    // Packaging Throughput (1000 lbs / 2 active pack days = 500 lb/day; 4 packages / 2 = 2 pkgs/day)
    expect(metrics.packagedLbsPerPackDay).toBeCloseTo(500, 1);
    expect(metrics.packagesPerPackDay).toBeCloseTo(2, 1);
    expect(formatDaysAsMonths(730)).toBe('2.0 yr');
    expect(formatDaysAsMonths(304)).toBe('10.0 mo');
  });

  it('counts same-day packaging as 1 inclusive day and 1 distinct active pack day', () => {
    const order: ButcherOrder = {
      id: 'ord-same-day',
      orderNumber: '2026-101',
      species: 'Pork',
      animalCount: 1,
      killDate: '2026-11-01',
      pickupDate: '2026-11-10',
      liveWeight: 280,
      hotWeight: 210,
      coldWeight: 205,
      createdAt: 1700000001000,
    };

    const records: ButcherRecord[] = [
      { id: 'p1', serial: 'P1', orderId: 'ord-same-day', packDate: '2026-11-08', pieces: 12, netWeight: 75 },
      { id: 'p2', serial: 'P2', orderId: 'ord-same-day', packDate: '2026-11-08', pieces: 18, netWeight: 85 },
    ];

    const metrics = computeOrderTimelineMetrics(order, records);

    expect(metrics.hasWarnings).toBe(false);
    expect(metrics.killToFirstPackDays).toBe(7);
    expect(metrics.killToLastPackDays).toBe(7);
    expect(metrics.packageSpanDays).toBe(1); // Inclusive same day = 1
    expect(metrics.distinctPackDays).toBe(1);
    expect(metrics.lastPackToPickupDays).toBe(2);
    expect(metrics.killToPickupDays).toBe(9);
    expect(metrics.packagedLbsPerPackDay).toBe(160);
    expect(metrics.packagesPerPackDay).toBe(2);
  });

  it('flags out-of-order and unparseable dates while excluding invalid intervals from cohort & processor averages', () => {
    const validOrder: ButcherOrder = {
      id: 'ord-good',
      orderNumber: '1001',
      species: 'Beef',
      animalCount: 1,
      birthDate: '2025-01-01',
      killDate: '2026-08-24', // 600 days alive
      pickupDate: '2026-09-13', // 20d turnaround
      liveWeight: 1200,
      hotWeight: 750,
      coldWeight: 730,
      locationId: 'loc-a',
      createdAt: 1700000000000,
    };
    const validRecords: ButcherRecord[] = [
      { id: 'g1', serial: 'G1', orderId: 'ord-good', packDate: '2026-09-07', pieces: 20, netWeight: 480 }, // 14d hang
    ];

    const badOrder: ButcherOrder = {
      id: 'ord-bad',
      orderNumber: '1002',
      species: 'Beef',
      animalCount: 1,
      birthDate: '2026-10-15', // AFTER killDate!
      killDate: '2026-09-23', // 30 days after validOrder killDate
      pickupDate: '2026-09-20', // BEFORE killDate and packDate!
      liveWeight: 1150,
      hotWeight: 710,
      coldWeight: 695,
      locationId: 'loc-a',
      createdAt: 1700000005000,
    };
    const badRecords: ButcherRecord[] = [
      { id: 'b1', serial: 'B1', orderId: 'ord-bad', packDate: '2026-09-21', pieces: 10, netWeight: 200 }, // BEFORE killDate!
      { id: 'b2', serial: 'B2', orderId: 'ord-bad', packDate: 'bad-date', pieces: 5, netWeight: 100 }, // Unparseable!
    ];

    const locMap = new Map([['loc-a', 'Ridge Butcher']]);
    const report = computeButcherTimelineReport(
      [
        { order: badOrder, records: badRecords, stats: computeOrderStats(badOrder, badRecords) },
        { order: validOrder, records: validRecords, stats: computeOrderStats(validOrder, validRecords) },
      ],
      locMap
    );

    expect(report.totalOrders).toBe(2);
    expect(report.ordersWithWarnings.length).toBe(1);
    expect(report.ordersWithWarnings[0].orderId).toBe('ord-bad');

    const badRow = report.orders.find(r => r.orderId === 'ord-bad')!;
    const codes = badRow.warnings.map(w => w.code);
    expect(codes).toContain('birth_after_kill');
    expect(codes).toContain('pack_before_kill');
    expect(codes).toContain('pickup_before_kill');
    expect(codes).toContain('pickup_before_last_pack');
    expect(codes).toContain('unparseable_date');

    // Invalid intervals on badOrder are null
    expect(badRow.daysAlive).toBeNull();
    expect(badRow.killToFirstPackDays).toBeNull();
    expect(badRow.killToPickupDays).toBeNull();
    expect(badRow.lastPackToPickupDays).toBeNull();
    // Chronological harvest cadence between validOrder (Aug 24) and badOrder (Sep 23) is still valid = 30d
    expect(badRow.daysSincePreviousHarvest).toBe(30);
    expect(badRow.previousHarvestOrderNumber).toBe('1001');

    // Cohort summary averages ONLY include validOrder (n = 1), unaffected by badOrder negatives
    expect(report.summary.daysAlive.count).toBe(1);
    expect(report.summary.daysAlive.avg).toBe(600);
    expect(report.summary.killToFirstPackDays.count).toBe(1);
    expect(report.summary.killToFirstPackDays.avg).toBe(14);
    expect(report.summary.killToPickupDays.count).toBe(1);
    expect(report.summary.killToPickupDays.avg).toBe(20);
    expect(report.summary.daysSincePreviousHarvest.count).toBe(1);
    expect(report.summary.daysSincePreviousHarvest.avg).toBe(30);

    // Butcher group summary reflects warning count and clean averages
    expect(report.byButcher.length).toBe(1);
    expect(report.byButcher[0].label).toBe('Ridge Butcher');
    expect(report.byButcher[0].warningOrderCount).toBe(1);
    expect(report.byButcher[0].killToPickupDays.avg).toBe(20);
  });

  it('compares turnaround across multiple processors and species and formats RFC-4180 CSV', () => {
    const o1: ButcherOrder = {
      id: 'o1',
      orderNumber: 'B-1',
      species: 'Beef',
      animalCount: 1,
      killDate: '2026-05-01',
      pickupDate: '2026-05-21', // 20d
      liveWeight: 1200,
      hotWeight: 740,
      coldWeight: 720,
      locationId: 'butcher-fast',
      createdAt: 1,
    };
    const o2: ButcherOrder = {
      id: 'o2',
      orderNumber: 'P-1',
      species: 'Pork',
      animalCount: 2,
      killDate: '2026-05-15',
      pickupDate: '2026-06-14', // 30d
      liveWeight: 540,
      hotWeight: 400,
      coldWeight: 390,
      locationId: 'butcher-slow',
      createdAt: 2,
    };

    const r1: ButcherRecord[] = [
      { id: 'r1', serial: 'S1', orderId: 'o1', packDate: '2026-05-15', pieces: 30, netWeight: 450 },
    ];
    const r2: ButcherRecord[] = [
      { id: 'r2', serial: 'S2', orderId: 'o2', packDate: '2026-05-25', pieces: 20, netWeight: 150 },
      { id: 'r3', serial: 'S3', orderId: 'o2', packDate: '2026-05-26', pieces: 25, netWeight: 170 },
    ];

    const locMap = new Map([
      ['butcher-fast', 'Fast Cuts, LLC'],
      ['butcher-slow', 'Slow Smoke Meats'],
    ]);

    const report = computeButcherTimelineReport(
      [
        { order: o1, records: r1 },
        { order: o2, records: r2 },
      ],
      locMap
    );

    expect(report.byButcher.length).toBe(2);
    const fast = report.byButcher.find(g => g.groupKey === 'butcher-fast')!;
    const slow = report.byButcher.find(g => g.groupKey === 'butcher-slow')!;
    expect(fast.killToPickupDays.avg).toBe(20);
    expect(slow.killToPickupDays.avg).toBe(30);
    expect(slow.packageSpanDays.avg).toBe(2);
    expect(slow.distinctPackDays.avg).toBe(2);
    expect(report.bySpecies.map(s => s.label).sort()).toEqual(['Beef', 'Pork']);

    // CSV properly quotes comma in butcher name
    const csv = formatTimelineReportCsv(report.orders);
    expect(csv).toContain('"Fast Cuts, LLC"');
    expect(csv).toContain('Kill to Pickup Turnaround (days)');
    expect(csv).toContain('B-1,Beef,"Fast Cuts, LLC"');
  });

  it('renders ButcherTimelinesReport via SSR with KPIs, date warnings, processor comparison, and matrix table', () => {
    const orderOk: ButcherOrder = {
      id: 'ssr-1',
      orderNumber: '4001',
      species: 'Beef',
      animalCount: 1,
      birthDate: '2025-01-01',
      killDate: '2026-08-24',
      pickupDate: '2026-09-14',
      liveWeight: 1200,
      hotWeight: 744,
      coldWeight: 720,
      locationId: 'loc-1',
      createdAt: 100,
    };
    const orderWarn: ButcherOrder = {
      id: 'ssr-2',
      orderNumber: '4002',
      species: 'Pork',
      animalCount: 1,
      killDate: '2026-09-10',
      pickupDate: '2026-09-05', // before kill date
      liveWeight: 260,
      hotWeight: 195,
      coldWeight: 190,
      locationId: 'loc-1',
      createdAt: 200,
    };
    const recs1: ButcherRecord[] = [
      { id: 'sr1', serial: 'SR1', orderId: 'ssr-1', packDate: '2026-09-07', pieces: 10, netWeight: 420 },
    ];

    const locMap = new Map([['loc-1', 'Summit Processing']]);
    const report = computeButcherTimelineReport(
      [
        { order: orderOk, records: recs1 },
        { order: orderWarn, records: [] },
      ],
      locMap
    );

    const html = renderToStaticMarkup(
      React.createElement(ButcherTimelinesReport, {
        report,
        ordersById: new Map([
          [orderOk.id, orderOk],
          [orderWarn.id, orderWarn],
        ]),
        onEditOrder: () => {},
        reportMode: 'actuals',
      })
    );

    expect(html).toContain('id="butcher-timelines-report"');
    expect(html).toContain('data-testid="butcher-date-warnings-banner"');
    expect(html).toContain('data-testid="butcher-turnaround-comparison-grid"');
    expect(html).toContain('Summit Processing');
    expect(html).toContain('Avg Days Alive');
    expect(html).toContain('Hang Time (Kill → 1st Pack)');
    expect(html).toContain('Total Package Time');
    expect(html).toContain('Post-Pack Hold (Last → Pickup)');
    expect(html).toContain('Total Turnaround (Kill → Pickup)');
    expect(html).toContain('Order Timeline &amp; Lifecycle Matrix');

    // Verify ButcherRecordsView and extensible report registry wire Timelines & Dates tab and Order card timeline strip
    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    const reportsRegistrySrc = fs.readFileSync(path.resolve(__dirname, '../utils/butcherReports.ts'), 'utf-8');
    expect(reportsRegistrySrc).toContain("testId: 'butcher-reports-timelines-tab'");
    expect(viewSrc).toContain('BUTCHER_REPORT_DEFINITIONS');
    expect(viewSrc).toContain('data-testid="butcher-order-timeline-strip"');
    expect(viewSrc).toContain('ButcherTimelinesReport');
  });
});
