import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fs from 'node:fs';
import path from 'node:path';
import { ButcherOrder, ButcherOrderTag, ButcherRecord } from '../types';
import {
  computeOrderStats,
  calculateDaysAlive,
  aggregateCutsByProduct,
  filterCutBreakdown,
  computeChartYAxisScale,
  formatCompactAxisNumber,
  buildSegmentedSvgPath,
  buildSegmentedAreaPath,
} from '../utils/butcherStats';
import {
  matchesButcherOrderSearch,
  createEmptyButcherOrderFilter,
  countActiveButcherFilters,
  computeDateRangePreset,
  matchesButcherDateRange,
  matchesButcherRecordFilter,
  matchesButcherOrderFilters,
  mergeOrderNumbersForReportFilter,
  mergeOrderIdsForSpreadsheetFilter,
  FilterableButcherRecord,
} from '../utils/butcherSettings';
import {
  BUTCHER_REPORT_DEFINITIONS,
  ButcherReportTypeId,
  buildButcherReportKpis,
  getButcherReportDefinition,
  getKpiGridColumnsClass,
} from '../utils/butcherReports';
import { computeButcherTimelineReport } from '../utils/butcherTimelines';
import { ButcherRecordsView } from '../views/ButcherRecordsView';
import { ButcherSpreadsheetView } from '../views/ButcherSpreadsheetView';

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

describe('ButcherRecordsView Main Order Species Badge', () => {
  it('renders the species badge with high-contrast theme variables instead of light-on-light styling', () => {
    const mockState = {
      butcherOrders: [
        {
          id: 'order-species-1',
          orderNumber: '1042',
          species: 'Beef',
          animalCount: 1,
          liveWeight: 1200,
          hotWeight: 740,
          coldWeight: 720,
          createdAt: 1700000000000,
        },
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
      }),
    );

    expect(html).toContain('data-testid="butcher-order-species-badge"');
    expect(html).toContain('bg-[var(--ha-bg-chip)]');
    expect(html).toContain('text-[var(--ha-text-primary)]');
    expect(html).toContain('Beef');
    expect(html).not.toContain('bg-[#9ca7b5]');

    const src = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    expect(src).not.toContain('bg-[#9ca7b5]');
    expect(src).not.toContain('bg-[#9ca7b5] text-cool-gray-300');
  });

  it('renders distinct elevated Butcher Logs cards and theme-aware expanded drawer styles without transparent dark-on-dark surfaces', () => {
    const mockState = {
      butcherOrders: [
        {
          id: 'order-log-1',
          orderNumber: '2026-01',
          species: 'Beef',
          animalCount: 1,
          birthDate: '2024-06-01',
          killDate: '2026-06-01',
          pickupDate: '2026-06-18',
          liveWeight: 1200,
          hotWeight: 740,
          coldWeight: 715,
          butcherFee: 850,
          notes: 'Dry aged 14 days',
          createdAt: 1700000000000,
        },
        {
          id: 'order-log-2',
          orderNumber: '2026-02',
          species: 'Pork',
          animalCount: 2,
          killDate: '2026-06-10',
          liveWeight: 560,
          hotWeight: 410,
          coldWeight: 398,
          createdAt: 1700000001000,
        },
      ],
      butcherRecords: [
        {
          id: 'rec-log-1',
          serial: 'SN-101',
          orderId: 'order-log-1',
          originalCutName: 'Ribeye Steak',
          normalizedCutName: 'Ribeye Steak',
          packDate: '2026-06-15',
          pieces: 12,
          netWeight: 24.5,
        },
      ],
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
      }),
    );

    expect(html).toContain('data-testid="butcher-order-card"');
    expect(html).toContain('butcher-log-card');
    expect(html).toContain('butcher-log-card-header');
    expect(html).toContain('butcher-log-summary-panel');
    expect(html).toContain('butcher-log-toggle-bar');
    expect(html).toContain('butcher-stat-card');
    expect(html).toContain('aria-expanded="false"');

    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    expect(viewSrc).toContain('butcher-log-card--expanded');
    expect(viewSrc).toContain('data-testid="butcher-order-expanded-drawer"');
    expect(viewSrc).toContain('butcher-log-expanded-drawer');
    expect(viewSrc).toContain('butcher-log-subpanel');
    expect(viewSrc).toContain('butcher-progress-track');
    expect(viewSrc).toContain('Collapse Breakdown');

    const cssSrc = fs.readFileSync(path.resolve(__dirname, '../index.css'), 'utf-8');
    expect(cssSrc).toContain('.butcher-log-card');
    expect(cssSrc).toContain('.butcher-log-card--expanded');
    expect(cssSrc).toContain('.butcher-log-card-header');
    expect(cssSrc).toContain('.butcher-log-summary-panel');
    expect(cssSrc).toContain('.butcher-log-toggle-bar');
    expect(cssSrc).toContain('.butcher-log-expanded-drawer');
    expect(cssSrc).toContain('.butcher-log-subpanel');
    expect(cssSrc).toContain('.butcher-progress-track');
  });

  it('hosts Butcher main views (Logs, Spreadsheet, Reports, Review Queue) in the top header banner and scopes New Order exclusively to the Butcher status menu', () => {
    const appSrc = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');

    // Top banner hosts the 4 main Butcher views when currentView === 'butcher_records'
    const headerStart = appSrc.indexOf("{currentView === 'butcher_records' && (");
    const headerEnd = appSrc.indexOf("{currentView === 'traceability' && (", headerStart);
    expect(headerStart).toBeGreaterThan(-1);
    expect(headerEnd).toBeGreaterThan(headerStart);

    const butcherHeaderBlock = appSrc.slice(headerStart, headerEnd);
    expect(butcherHeaderBlock).toContain('id="butcher-header-subtabs"');
    expect(butcherHeaderBlock).toContain('id="butcher-tab-orders"');
    expect(butcherHeaderBlock).toContain('id="butcher-tab-spreadsheet"');
    expect(butcherHeaderBlock).toContain('id="butcher-tab-reports"');
    expect(butcherHeaderBlock).toContain('id="butcher-tab-review"');
    expect(butcherHeaderBlock).toContain('id="butcher-tab-review-badge"');
    expect(butcherHeaderBlock).not.toContain('New Order');
    expect(butcherHeaderBlock).not.toContain("handleButcherSubTabChange('import')");

    // Status dropdown menu gates New Order strictly behind isButcherMode (currentView === 'butcher_records')
    expect(appSrc).toContain("const isButcherMode = currentView === 'butcher_records';");
    expect(appSrc).toContain('const hasContextualInbound = isOnSiteContext || isOffSiteMode || isButcherMode;');
    const menuBlockStart = appSrc.indexOf('{isButcherMode && (');
    const menuBlockEnd = appSrc.indexOf('</button>', menuBlockStart);
    expect(menuBlockStart).toBeGreaterThan(-1);
    expect(menuBlockEnd).toBeGreaterThan(menuBlockStart);
    const butcherMenuBtnBlock = appSrc.slice(menuBlockStart, menuBlockEnd);
    expect(butcherMenuBtnBlock).toContain('id="menu-butcher-new-order-btn"');
    expect(butcherMenuBtnBlock).toContain("handleButcherSubTabChange('import')");
    expect(butcherMenuBtnBlock).toContain('New Order');

    // ButcherRecordsView itself no longer renders the inline tab bar or New Order button
    expect(viewSrc).not.toContain('id="butcher-tab-review"');
    expect(viewSrc).not.toContain("onClick={() => setActiveTab('spreadsheet')}");
    expect(viewSrc).not.toContain("onClick={() => setActiveTab('reports')}");
    expect(viewSrc).not.toContain("onClick={() => setActiveTab('import')}");

    // Controlled activeTab prop renders each Butcher sub-view cleanly in SSR
    const baseState = {
      butcherOrders: [],
      butcherRecords: [],
      locations: [],
      products: [],
      pallets: [],
      offSiteEntries: [],
      freezers: [],
      appConfig: [],
    };
    const importHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: baseState,
        dispatch: () => {},
        activeTab: 'import',
      })
    );
    expect(importHtml).not.toContain('New Butcher Order</h2>');
    expect(importHtml).not.toContain('Start a new order when dropping off animals');
    expect(importHtml).toContain('Butcher / Location Source');
    expect(importHtml).toContain('Start Butcher Order');

    const reviewHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: baseState,
        dispatch: () => {},
        activeTab: 'review',
      })
    );
    expect(reviewHtml).toContain('id="butcher-review-queue-panel"');
  });

  it('removes redundant page titles/subtitles and inline sensitivity sliders on Butcher views and moves search & filters to the sticky top bar', () => {
    const appSrc = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf-8');
    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    const sheetSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherSpreadsheetView.tsx'), 'utf-8');

    // Top bar includes Filters toggle button and header filter portal slot on Butcher views
    expect(appSrc).toContain('id="butcher-header-filters-toggle"');
    expect(appSrc).toContain('id="butcher-header-filter-slot"');
    expect(appSrc).toContain('isFilterPanelOpen={butcherSearchFilterOpen}');
    expect(appSrc).toContain('filterPanelContainer={butcherFilterPortalEl}');

    // Redundant page titles & subtitles are removed across Butcher pages
    expect(viewSrc).not.toContain('Manage incoming processing logs and order statistics.');
    expect(viewSrc).not.toContain('Order Review & Finalization Queue');
    expect(viewSrc).not.toContain('>New Butcher Order</h2>');
    expect(viewSrc).not.toContain('Start a new order when dropping off animals');
    expect(sheetSrc).not.toContain('Butcher Cuts Repository Spreadsheet');
    expect(sheetSrc).not.toContain('Complete, un-archived and archived cut history across processing logs.');

    // Inline sensitivity sliders are removed from Butcher pages (now in ButcherSettingsPanel)
    expect(viewSrc).not.toContain('id="review-sensitivity-slider"');
    expect(viewSrc).not.toContain('id="reports-sensitivity-slider"');

    const baseState = {
      butcherOrders: [],
      butcherRecords: [],
      locations: [],
      products: [],
      pallets: [],
      offSiteEntries: [],
      freezers: [],
      tags: [],
      appConfig: [],
    };

    // Collapsed by default: inline filter drawers stay hidden
    const ordersClosed = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, { state: baseState, dispatch: () => {}, activeTab: 'orders', isFilterPanelOpen: false })
    );
    expect(ordersClosed).not.toContain('id="butcher-orders-filter-panel"');
    expect(ordersClosed).not.toContain('Butcher Records');

    // Open state renders each tab's top-bar filter drawer cleanly
    const ordersOpen = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, { state: baseState, dispatch: () => {}, activeTab: 'orders', isFilterPanelOpen: true })
    );
    expect(ordersOpen).toContain('id="butcher-orders-filter-panel"');

    const sheetOpen = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, { state: baseState, dispatch: () => {}, activeTab: 'spreadsheet', isFilterPanelOpen: true })
    );
    expect(sheetOpen).toContain('id="butcher-spreadsheet-filter-panel"');
    expect(sheetOpen).not.toContain('Butcher Cuts Repository Spreadsheet');

    const reportsOpen = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, { state: baseState, dispatch: () => {}, activeTab: 'reports', isFilterPanelOpen: true })
    );
    expect(reportsOpen).toContain('id="butcher-reports-filter-panel"');
    expect(reportsOpen).not.toContain('id="reports-sensitivity-slider"');

    const reviewOpen = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, { state: baseState, dispatch: () => {}, activeTab: 'review', isFilterPanelOpen: true })
    );
    expect(reviewOpen).toContain('id="butcher-review-filter-panel"');
  });

  it('matches Butcher Logs and Review search queries across order notes, weight anomaly flag notes, and audit/estimate notes', () => {
    const tags: ButcherOrderTag[] = [
      { id: 'tag-sow', name: 'Retired Sow', color: '#f59e0b', weightCheckMode: 'separate_baseline' },
    ];
    const order: ButcherOrder = {
      id: 'ord-search-1',
      orderNumber: '4099',
      species: 'Pork',
      liveWeight: 310,
      hotWeight: 225,
      coldWeight: 218,
      notes: 'Extra thick cut bacon requested by farm stand',
      tagIds: ['tag-sow'],
      weightAnomalies: {
        hotWeight: {
          status: 'flagged',
          reason: 'Butcher confirmed scale typo on hanging ticket',
          flaggedAt: '2026-11-18T12:00:00Z',
        },
      },
      estimatedWeights: {
        hotWeight: 230,
        note: 'Adjusted using autumn herd average after phone call',
      },
      createdAt: Date.now(),
    };
    const legacyOrder: ButcherOrder = {
      id: 'ord-search-legacy',
      orderNumber: '1001',
      species: 'Beef',
      liveWeight: 1200,
      hotWeight: 740,
      coldWeight: 720,
      createdAt: Date.now(),
    };

    // Blank/whitespace query always matches
    expect(matchesButcherOrderSearch(order, '   ', tags, 'Valley Meats')).toBe(true);
    // Order number, species, tag, and butcher location
    expect(matchesButcherOrderSearch(order, '4099', tags, 'Valley Meats')).toBe(true);
    expect(matchesButcherOrderSearch(order, 'pork', tags, 'Valley Meats')).toBe(true);
    expect(matchesButcherOrderSearch(order, 'retired sow', tags, 'Valley Meats')).toBe(true);
    expect(matchesButcherOrderSearch(order, 'valley meats', tags, 'Valley Meats')).toBe(true);
    // Order notes
    expect(matchesButcherOrderSearch(order, 'thick cut bacon', tags, 'Valley Meats')).toBe(true);
    // Per-field weight anomaly flag notes
    expect(matchesButcherOrderSearch(order, 'scale typo', tags, 'Valley Meats')).toBe(true);
    // Audit / estimate flag notes
    expect(matchesButcherOrderSearch(order, 'autumn herd average', tags, 'Valley Meats')).toBe(true);
    // Non-matching query
    expect(matchesButcherOrderSearch(order, 'unmatched-phrase-xyz', tags, 'Valley Meats')).toBe(false);
    // Legacy orders with missing notes / weightAnomalies / estimatedWeights fail safely without crashing
    expect(matchesButcherOrderSearch(legacyOrder, 'scale typo', tags)).toBe(false);
    expect(matchesButcherOrderSearch(legacyOrder, '1001', tags)).toBe(true);
  });

  it('renders identical quick metrics and order statistics on every collapsed Butcher order card regardless of missing dates or data, and keeps detailed non-swapping timeline metrics in the expanded drawer', () => {
    const completeOrder: ButcherOrder = {
      id: 'ord-complete',
      orderNumber: '5001',
      species: 'Beef',
      animalCount: 2,
      birthDate: '2024-10-01',
      killDate: '2026-10-01',
      pickupDate: '2026-10-22',
      liveWeight: 2500,
      hotWeight: 1550,
      coldWeight: 1500,
      butcherFee: 1200,
      createdAt: 1700000010000,
    };
    const sparseOrder: ButcherOrder = {
      id: 'ord-sparse',
      orderNumber: '5002',
      species: 'Pork',
      liveWeight: 0,
      hotWeight: 0,
      coldWeight: 0,
      createdAt: 1700000005000,
    };
    const badDateOrder: ButcherOrder = {
      id: 'ord-warn',
      orderNumber: '5003',
      species: 'Lamb',
      killDate: '2026-10-10',
      pickupDate: '2026-10-05', // before kill date
      liveWeight: 0,
      hotWeight: 0,
      coldWeight: 0,
      createdAt: 1700000001000,
    };

    const html = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: {
          butcherOrders: [completeOrder, sparseOrder, badDateOrder],
          butcherRecords: [
            {
              id: 'rec-c1',
              serial: 'SC-1',
              orderId: 'ord-complete',
              packDate: '2026-10-15',
              pieces: 20,
              netWeight: 600,
            },
          ],
          locations: [],
          products: [],
          pallets: [],
          offSiteEntries: [],
          freezers: [],
          tags: [],
          appConfig: [],
        },
        dispatch: () => {},
        activeTab: 'orders',
      })
    );

    const cardMatches = html.split('<article data-testid="butcher-order-card"').slice(1);
    expect(cardMatches.length).toBe(3);

    const extractOverviewHeaders = (cardHtml: string) => {
      const quickStart = cardHtml.indexOf('data-testid="butcher-order-quick-metrics"');
      expect(quickStart).toBeGreaterThan(-1);
      const toggleStart = cardHtml.indexOf('butcher-log-toggle-bar', quickStart);
      const quickChunk = cardHtml.slice(quickStart, toggleStart);
      return Array.from(quickChunk.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)).map(m => m[1]);
    };

    const expectedPanelHeaders = [
      'Dates &amp; Timeline',
      'Weights &amp; Yields',
      'Order Statistics',
    ];

    const expectedOverviewLabels = [
      'Birth Date',
      'Kill Date',
      'Pickup Date',
      'Days Alive',
      'Turnaround',
      'Animals',
      'Live Weight',
      'Cold Weight',
      'Yield (Cold / Live)',
      'Finished Yield',
      'Total Records',
      'Total Pieces',
      'Net Weight',
      'Butcher Fee',
      'Cost / packaged lb',
    ];

    for (const cardHtml of cardMatches) {
      expect(extractOverviewHeaders(cardHtml)).toEqual(expectedPanelHeaders);
      for (const label of expectedOverviewLabels) {
        expect(cardHtml).toContain(`>${label}<`);
      }
      // Detailed Processing Timeline & Pacing strip is tucked inside the expanded drawer, not on collapsed cards
      expect(cardHtml).not.toContain('data-testid="butcher-order-timeline-strip"');
      expect(cardHtml).toContain('View Timeline, Yields &amp; Cut Breakdown');
    }

    const completeCard = cardMatches.find(c => c.includes('Order #5001'))!;
    const sparseCard = cardMatches.find(c => c.includes('Order #5002'))!;
    const warnCard = cardMatches.find(c => c.includes('Order #5003'))!;

    // Complete order shows populated quick values, yields, and calculated cost/lb
    expect(completeCard).toContain('730d');
    expect(completeCard).toContain('21d');
    expect(completeCard).toContain('1500 lbs');
    expect(completeCard).toContain('60.0%');
    expect(completeCard).toContain('24.0%');
    expect(completeCard).toContain('$2.00/lb');

    // Sparse order falls back cleanly to em-dash without dropping rows
    expect(sparseCard).toContain('—');

    // Date warning banner remains surfaced on orders with invalid dates
    expect(warnCard).toContain('data-testid="butcher-order-date-warning"');

    // Expanded drawer always includes the fixed 8-metric Processing Timeline & Pacing panel without swapping Daily Gain and Pack Throughput
    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    const drawerStart = viewSrc.indexOf('data-testid="butcher-order-expanded-drawer"');
    const timelineStart = viewSrc.indexOf('data-testid="butcher-order-timeline-strip"');
    expect(drawerStart).toBeGreaterThan(-1);
    expect(timelineStart).toBeGreaterThan(drawerStart);
    const timelineEnd = viewSrc.indexOf('{(orderAnalysis?.needsReview', timelineStart);
    expect(timelineEnd).toBeGreaterThan(timelineStart);
    const timelineBlock = viewSrc.slice(timelineStart, timelineEnd);
    expect(timelineBlock).toContain('>Birth Date<');
    expect(timelineBlock).toContain('>Days Alive<');
    expect(timelineBlock).toContain('>Kill → 1st Pack<');
    expect(timelineBlock).toContain('>Kill → Last Pack<');
    expect(timelineBlock).toContain('>Package Time<');
    expect(timelineBlock).toContain('>Post-Pack Hold<');
    expect(timelineBlock).toContain('>Daily Gain (ADG)<');
    expect(timelineBlock).toContain('>Pack Throughput<');
    expect(timelineBlock).not.toContain("? 'Daily Gain (ADG)' : 'Pack Throughput'");
  });

  it('live-filters order Cuts Breakdown by multi-token case-insensitive query and wires the search input inside the expanded card drawer', () => {
    const cuts = [
      { name: 'Ground Beef 1lb', count: 40, totalPieces: 40, totalWeight: 40 },
      { name: 'Ribeye Steak', count: 12, totalPieces: 24, totalWeight: 22.5 },
      { name: 'Beef Short Ribs', count: 6, totalPieces: 12, totalWeight: 18 },
      { name: 'Chuck Roast', count: 4, totalPieces: 4, totalWeight: 14.5 },
    ];

    // Blank/whitespace returns full list
    expect(filterCutBreakdown(cuts, '')).toHaveLength(4);
    expect(filterCutBreakdown(cuts, '   ')).toHaveLength(4);

    // Partial substring matches case-insensitively
    expect(filterCutBreakdown(cuts, 'rib').map(c => c.name)).toEqual([
      'Ribeye Steak',
      'Beef Short Ribs',
    ]);

    // Multi-word tokens match in any order
    expect(filterCutBreakdown(cuts, 'ribs beef').map(c => c.name)).toEqual([
      'Beef Short Ribs',
    ]);
    expect(filterCutBreakdown(cuts, '1lb ground').map(c => c.name)).toEqual([
      'Ground Beef 1lb',
    ]);

    // Unmatched query returns empty array
    expect(filterCutBreakdown(cuts, 'tenderloin')).toEqual([]);

    // ButcherRecordsView renders the live search input inside the expanded drawer Cuts Breakdown pane and resets on expandedOrder change
    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    expect(viewSrc).toContain('data-testid="butcher-cut-breakdown-search"');
    expect(viewSrc).toContain('filterCutBreakdown(breakdown, cutBreakdownSearch)');
    expect(viewSrc).toContain("setCutBreakdownSearch('')");
  });

  it('evaluates unified Butcher date ranges (before, after, bounded, and field-specific) accurately without cross-field date leaks', () => {
    const order: ButcherOrder = {
      id: 'ord-date-1',
      orderNumber: '6001',
      species: 'Beef',
      killDate: '2026-08-01',
      pickupDate: '2026-08-25',
      liveWeight: 1200,
      hotWeight: 740,
      coldWeight: 720,
      createdAt: Date.now(),
    };
    const records: ButcherRecord[] = [
      {
        id: 'rec-d1',
        serial: 'SD-1',
        orderId: 'ord-date-1',
        packDate: '08/15/2026', // US slash format
        pieces: 10,
        netWeight: 20,
      },
    ];
    const noDatesOrder: ButcherOrder = {
      id: 'ord-date-empty',
      orderNumber: '6002',
      species: 'Pork',
      liveWeight: 0,
      hotWeight: 0,
      coldWeight: 0,
      createdAt: Date.now(),
    };

    // Unbounded matches even when dates are missing
    expect(matchesButcherDateRange(noDatesOrder, [], 'any', '', '')).toBe(true);
    // Missing dates fail once any bound is active
    expect(matchesButcherDateRange(noDatesOrder, [], 'any', '2026-01-01', '')).toBe(false);
    expect(matchesButcherDateRange(noDatesOrder, [], 'any', '', '2026-12-31')).toBe(false);

    // After-only (On / After Date)
    expect(matchesButcherDateRange(order, records, 'killDate', '2026-08-01', '')).toBe(true);
    expect(matchesButcherDateRange(order, records, 'killDate', '2026-08-02', '')).toBe(false);
    expect(matchesButcherDateRange(order, records, 'pickupDate', '2026-08-20', '')).toBe(true);

    // Before-only (On / Before Date)
    expect(matchesButcherDateRange(order, records, 'pickupDate', '', '2026-08-25')).toBe(true);
    expect(matchesButcherDateRange(order, records, 'pickupDate', '', '2026-08-24')).toBe(false);

    // Pack date parses US MM/DD/YYYY dates cleanly
    expect(matchesButcherDateRange(order, records, 'packDate', '2026-08-10', '2026-08-20')).toBe(true);
    expect(matchesButcherDateRange(order, records, 'packDate', '2026-08-16', '2026-08-20')).toBe(false);

    // Prevents cross-field leak where killDate < startDate and pickupDate > endDate with no date actually inside [start, end]
    expect(matchesButcherDateRange(order, [], 'any', '2026-08-10', '2026-08-20')).toBe(false);
    // With packDate 08/15/2026 inside [2026-08-10, 2026-08-20], 'any' matches legitimately
    expect(matchesButcherDateRange(order, records, 'any', '2026-08-10', '2026-08-20')).toBe(true);
  });

  it('filters orders and cuts with exact order numbers, species, butcher, tags, cuts, categories, presets, and report selection merging', () => {
    const tags: ButcherOrderTag[] = [
      { id: 'tag-grass', name: 'Grass Fed', color: '#10b981', weightCheckMode: 'normal' },
    ];
    const order12: ButcherOrder = {
      id: 'ord-12',
      orderNumber: '12',
      species: 'Beef',
      locationId: 'loc-valley',
      killDate: '2026-10-10',
      tagIds: ['tag-grass'],
      notes: 'Prime pasture finish',
      liveWeight: 1200,
      hotWeight: 740,
      coldWeight: 720,
      createdAt: Date.now(),
    };
    const order120: ButcherOrder = {
      id: 'ord-120',
      orderNumber: '120',
      species: 'Pork',
      killDate: '2026-10-12',
      liveWeight: 280,
      hotWeight: 205,
      coldWeight: 198,
      createdAt: Date.now(),
    };
    const rec12: Array<ButcherRecord & FilterableButcherRecord> = [
      {
        id: 'rec-12-1',
        serial: 'S12-1',
        orderId: 'ord-12',
        originalCutName: 'RIBEYE RAW 1IN',
        normalizedCutName: 'Ribeye Steak',
        primaryCategory: 'Steaks',
        subCategory: 'Rib',
        pieces: 8,
        netWeight: 16,
      },
    ];

    // Exact orderNumber matching prevents '#12' from matching '#120'
    const exactOrderFilter = createEmptyButcherOrderFilter({ orderNumber: ['12'] });
    expect(matchesButcherOrderFilters(order12, rec12, exactOrderFilter, { tags, locationName: 'Valley Meats' })).toBe(true);
    expect(matchesButcherOrderFilters(order120, [], exactOrderFilter, { tags })).toBe(false);

    // Location filter supports assigned IDs and '__unassigned__'
    expect(
      matchesButcherOrderFilters(order12, rec12, createEmptyButcherOrderFilter({ locationIds: ['loc-valley'] })),
    ).toBe(true);
    expect(
      matchesButcherOrderFilters(order120, [], createEmptyButcherOrderFilter({ locationIds: ['__unassigned__'] })),
    ).toBe(true);
    expect(
      matchesButcherOrderFilters(order12, rec12, createEmptyButcherOrderFilter({ locationIds: ['__unassigned__'] })),
    ).toBe(false);

    // Tag, cutName (normalized vs raw), and category filters
    expect(
      matchesButcherOrderFilters(order12, rec12, createEmptyButcherOrderFilter({ tagIds: ['tag-grass'] })),
    ).toBe(true);
    expect(
      matchesButcherOrderFilters(
        order12,
        rec12,
        createEmptyButcherOrderFilter({ cutName: ['Ribeye Steak'] }),
        { viewOriginalNames: false },
      ),
    ).toBe(true);
    expect(
      matchesButcherOrderFilters(
        order12,
        rec12,
        createEmptyButcherOrderFilter({ cutName: ['RIBEYE RAW 1IN'] }),
        { viewOriginalNames: true },
      ),
    ).toBe(true);
    expect(
      matchesButcherRecordFilter(
        rec12[0],
        { cutName: [], primaryCategory: ['Steaks'], subCategory: ['Rib'] },
        false,
      ),
    ).toBe(true);
    expect(
      matchesButcherRecordFilter(
        rec12[0],
        { cutName: [], primaryCategory: ['Roasts'], subCategory: [] },
        false,
      ),
    ).toBe(false);

    // Date presets compute deterministic YYYY-MM-DD windows
    const refDate = new Date(2026, 10, 20); // 2026-11-20
    expect(computeDateRangePreset('30d', refDate)).toEqual({ startDate: '2026-10-21', endDate: '2026-11-20' });
    expect(computeDateRangePreset('90d', refDate)).toEqual({ startDate: '2026-08-22', endDate: '2026-11-20' });
    expect(computeDateRangePreset('12m', refDate)).toEqual({ startDate: '2025-11-20', endDate: '2026-11-20' });
    expect(computeDateRangePreset('ytd', refDate)).toEqual({ startDate: '2026-01-01', endDate: '2026-11-20' });

    // Active filter counter ignores default dateField alone and sums all populated facets
    expect(countActiveButcherFilters(createEmptyButcherOrderFilter({ dateField: 'killDate' }))).toBe(0);
    expect(
      countActiveButcherFilters(
        createEmptyButcherOrderFilter({
          search: 'prime',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
          species: ['Beef'],
          cutName: ['Ribeye Steak', 'Brisket'],
        }),
      ),
    ).toBe(6);

    // Merging checked order numbers into Reports filter supports replace & case-insensitive deduped append
    expect(mergeOrderNumbersForReportFilter(['100', '101'], ['200', '201'], 'replace')).toEqual(['200', '201']);
    expect(mergeOrderNumbersForReportFilter(['100', 'BO-1'], ['bo-1', ' 202 ', ''], 'append')).toEqual([
      '100',
      'BO-1',
      '202',
    ]);
  });

  it('renders identical unified filter controls on both Butcher Logs and Reports tabs and renders per-card checkboxes to send orders to Reports', () => {
    const sampleState = {
      butcherOrders: [
        {
          id: 'ord-ui-1',
          orderNumber: '7001',
          species: 'Beef',
          killDate: '2026-10-05',
          liveWeight: 1200,
          hotWeight: 740,
          coldWeight: 720,
          createdAt: 1700000010000,
        },
        {
          id: 'ord-ui-2',
          orderNumber: '7002',
          species: 'Pork',
          killDate: '2026-10-15',
          liveWeight: 290,
          hotWeight: 210,
          coldWeight: 204,
          createdAt: 1700000005000,
        },
      ],
      butcherRecords: [
        {
          id: 'rec-ui-1',
          serial: 'SU-1',
          orderId: 'ord-ui-1',
          originalCutName: 'Ribeye Steak',
          normalizedCutName: 'Ribeye Steak',
          primaryCategory: 'Steaks',
          subCategory: 'Rib',
          packDate: '2026-10-12',
          pieces: 10,
          netWeight: 20,
        },
      ],
      locations: [{ id: 'loc-1', name: 'Valley Butcher', isButcher: true }],
      products: [],
      pallets: [],
      offSiteEntries: [],
      freezers: [],
      tags: [],
      appConfig: [],
    };

    const logsHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: sampleState,
        dispatch: () => {},
        activeTab: 'orders',
        isFilterPanelOpen: true,
      }),
    );

    const reportsHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: sampleState,
        dispatch: () => {},
        activeTab: 'reports',
        isFilterPanelOpen: true,
      }),
    );

    // Both Logs and Reports expose identical unified filter panels (search, date field, before/after dates, presets, and facets)
    for (const [panelId, html] of [
      ['butcher-orders-filter-panel', logsHtml],
      ['butcher-reports-filter-panel', reportsHtml],
    ] as const) {
      expect(html).toContain(`id="${panelId}"`);
      expect(html).toContain(`data-testid="${panelId}-search"`);
      expect(html).toContain(`data-testid="${panelId}-date-field"`);
      expect(html).toContain(`data-testid="${panelId}-start-date"`);
      expect(html).toContain(`data-testid="${panelId}-end-date"`);
      expect(html).toContain('Date Type');
      expect(html).toContain('On / After Date');
      expect(html).toContain('On / Before Date');
      expect(html).toContain('>30d<');
      expect(html).toContain('>90d<');
      expect(html).toContain('>12m<');
      expect(html).toContain('>YTD<');
      expect(html).toContain('Order Number');
      expect(html).toContain('Species');
      expect(html).toContain('Butcher / Processor');
      expect(html).toContain('Order Tags');
      expect(html).toContain('Cut Name');
      expect(html).toContain('Categories');
    }

    // Logs page renders the selection toolbar and a checkbox on every order card
    expect(logsHtml).toContain('data-testid="butcher-logs-selection-bar"');
    expect(logsHtml).toContain('data-testid="butcher-select-all-orders-checkbox"');
    const checkboxCount = (logsHtml.match(/data-testid="butcher-order-select-checkbox"/g) || []).length;
    expect(checkboxCount).toBe(2);

    // Source verifies Send to Reports, Add to Reports, and Open Filtered View in Reports actions
    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    expect(viewSrc).toContain('data-testid="butcher-send-to-reports-btn"');
    expect(viewSrc).toContain('data-testid="butcher-append-to-reports-btn"');
    expect(viewSrc).toContain('data-testid="butcher-copy-filters-to-reports-btn"');
    expect(viewSrc).toContain('handleSendOrdersToReports');
  });

  it('auto-scales chart Y-axes so extreme actuals (>100% yield, negative shrink, or large weights) never go off-chart and breaks cleanly on null gaps', () => {
    const plotTop = 20;
    const plotHeight = 242;

    // 1. Normal yields stay on a clean 0%..100% grid
    const normalScale = computeChartYAxisScale([3.5, 34, 58, 63], {
      baselineMin: 0,
      baselineMax: 100,
      headroomRatio: 0.1,
      targetIntervals: 4,
      allowNegative: true,
    });
    expect(normalScale.min).toBe(0);
    expect(normalScale.max).toBe(100);
    expect(normalScale.ticks).toEqual([0, 25, 50, 75, 100]);

    // 2. Extreme Actuals outliers (>100% dressing and negative cooler shrink) expand domain so every value fits strictly within [plotTop, plotTop + plotHeight]
    const outlierValues = [165, -18, 122, 45];
    const outlierScale = computeChartYAxisScale(outlierValues, {
      baselineMin: 0,
      baselineMax: 100,
      headroomRatio: 0.1,
      targetIntervals: 4,
      allowNegative: true,
    });
    expect(outlierScale.min).toBeLessThanOrEqual(-18);
    expect(outlierScale.max).toBeGreaterThanOrEqual(165);
    for (const v of outlierValues) {
      const y = outlierScale.mapY(v, plotTop, plotHeight);
      expect(y).toBeGreaterThanOrEqual(plotTop);
      expect(y).toBeLessThanOrEqual(plotTop + plotHeight);
    }

    // 3. Small species weights (e.g. 65 lb goat) and large outlier weights (e.g. 18,000 lb typo) both scale cleanly
    const goatScale = computeChartYAxisScale([65, 38, 35, 24], {
      baselineMin: 0,
      baselineMax: 10,
      headroomRatio: 0.12,
      targetIntervals: 4,
    });
    expect(goatScale.min).toBe(0);
    expect(goatScale.max).toBeGreaterThanOrEqual(65);
    expect(goatScale.max).toBeLessThanOrEqual(100);

    const typoWeightScale = computeChartYAxisScale([18000, 740, 420], {
      baselineMin: 0,
      baselineMax: 10,
      headroomRatio: 0.12,
      targetIntervals: 4,
    });
    expect(typoWeightScale.max).toBeGreaterThanOrEqual(18000);
    expect(formatCompactAxisNumber(18000)).toBe('18k');
    expect(formatCompactAxisNumber(1500000)).toBe('1.5M');
    expect(formatCompactAxisNumber(-25, '%')).toBe('-25%');

    // 4. Segmented SVG path skips null gaps instead of plummeting to zero
    const segPath = buildSegmentedSvgPath([
      { x: 10, y: 100 },
      { x: 20, y: 80 },
      { x: 30, y: null },
      { x: 40, y: 90 },
      { x: 50, y: 70 },
    ]);
    expect(segPath).toBe('M 10.0 100.0 L 20.0 80.0 M 40.0 90.0 L 50.0 70.0');

    const areaPath = buildSegmentedAreaPath(
      [
        { x: 10, y: 100 },
        { x: 20, y: 80 },
        { x: 30, y: null },
        { x: 40, y: 90 },
      ],
      262,
    );
    // Only contiguous segments with >= 2 points produce closed fill areas
    expect(areaPath).toBe('M 10.0 100.0 L 20.0 80.0 L 20.0 262.0 L 10.0 262.0 Z');
  });

  it('moves Reporting Basis into the Reports Filters drawer, makes the whole Reports page the Trends dashboard with Cut Breakdown as a selectable report type, and keeps outlier points inside the SVG bounds', () => {
    const outlierState = {
      butcherOrders: [
        {
          id: 'ord-rep-normal',
          orderNumber: '8001',
          species: 'Beef',
          animalCount: 1,
          killDate: '2026-09-01',
          liveWeight: 1200,
          hotWeight: 740,
          coldWeight: 720,
          createdAt: 1700000001000,
        },
        {
          id: 'ord-rep-outlier',
          orderNumber: '8002',
          species: 'Beef',
          animalCount: 1,
          killDate: '2026-09-15',
          liveWeight: 1000,
          hotWeight: 1800, // 180% dressing typo in actuals mode
          coldWeight: 1950, // -8.3% negative cooler shrink typo
          createdAt: 1700000002000,
        },
      ],
      butcherRecords: [
        {
          id: 'rec-rep-1',
          serial: 'SR-1',
          orderId: 'ord-rep-normal',
          originalCutName: 'Ribeye Steak',
          normalizedCutName: 'Ribeye Steak',
          pieces: 12,
          netWeight: 24,
        },
      ],
      locations: [],
      products: [],
      pallets: [],
      offSiteEntries: [],
      freezers: [],
      tags: [],
      appConfig: [],
    };

    // 1. Main Reports view with Filters closed: Reporting Basis is NOT rendered on main page body
    const reportsClosedHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: outlierState,
        dispatch: () => {},
        activeTab: 'reports',
        isFilterPanelOpen: false,
      }),
    );

    expect(reportsClosedHtml).not.toContain('id="butcher-report-mode-switcher"');
    expect(reportsClosedHtml).not.toContain('data-testid="butcher-reports-basis-control"');
    // Redundant dashboard title/subtitle and always-visible bottom Aggregated Cut Breakdown Spreadsheet are removed
    expect(reportsClosedHtml).not.toContain('Butcher Analytics &amp; Trends Interactive Dashboard');
    expect(reportsClosedHtml).not.toContain('Aggregated Cut Breakdown Spreadsheet');
    expect(reportsClosedHtml).not.toContain('data-testid="butcher-reports-breakdown-panel"');

    // Full-page dashboard exposes all 6 selectable report types including Cut Breakdown
    expect(reportsClosedHtml).toContain('data-testid="butcher-reports-dashboard"');
    expect(reportsClosedHtml).toContain('data-testid="butcher-report-type-selector"');
    expect(reportsClosedHtml).toContain('data-testid="butcher-reports-yields-tab"');
    expect(reportsClosedHtml).toContain('data-testid="butcher-reports-weights-tab"');
    expect(reportsClosedHtml).toContain('data-testid="butcher-reports-cuts-tab"');
    expect(reportsClosedHtml).toContain('data-testid="butcher-reports-breakdown-tab"');
    expect(reportsClosedHtml).toContain('data-testid="butcher-reports-species-tab"');
    expect(reportsClosedHtml).toContain('data-testid="butcher-reports-timelines-tab"');

    // Auto-scaled Yield Trends SVG clips cleanly and places EVERY circle cy inside [20, 262] even for the 180% / -8.3% outlier!
    expect(reportsClosedHtml).toContain('data-testid="butcher-yield-trends-svg"');
    expect(reportsClosedHtml).toContain('data-testid="butcher-yield-autoscale-badge"');
    expect(reportsClosedHtml).toContain('id="butcher-yield-plot-clip"');
    expect(reportsClosedHtml).toContain('overflow-hidden');

    const svgStart = reportsClosedHtml.indexOf('data-testid="butcher-yield-trends-svg"');
    const svgEnd = reportsClosedHtml.indexOf('</svg>', svgStart);
    const svgChunk = reportsClosedHtml.slice(svgStart, svgEnd);
    const cyMatches = Array.from(svgChunk.matchAll(/cy="([^"]+)"/g)).map(m => parseFloat(m[1]));
    expect(cyMatches.length).toBeGreaterThan(0);
    for (const cy of cyMatches) {
      expect(Number.isFinite(cy)).toBe(true);
      expect(cy).toBeGreaterThanOrEqual(20);
      expect(cy).toBeLessThanOrEqual(262);
    }

    // 2. Reports with Filters open: Reporting Basis controls render inside #butcher-reports-filter-panel
    const reportsOpenHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: outlierState,
        dispatch: () => {},
        activeTab: 'reports',
        isFilterPanelOpen: true,
      }),
    );
    expect(reportsOpenHtml).toContain('id="butcher-reports-filter-panel"');
    expect(reportsOpenHtml).toContain('data-testid="butcher-reports-basis-control"');
    expect(reportsOpenHtml).toContain('id="butcher-report-mode-switcher"');
    expect(reportsOpenHtml).toContain('Actuals');
    expect(reportsOpenHtml).toContain('Corrected Estimates');
    expect(reportsOpenHtml).toContain('Exclude Flagged');

    // 3. Logs with Filters open: Reporting Basis stays exclusive to Reports
    const logsOpenHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: outlierState,
        dispatch: () => {},
        activeTab: 'orders',
        isFilterPanelOpen: true,
      }),
    );
    expect(logsOpenHtml).toContain('id="butcher-orders-filter-panel"');
    expect(logsOpenHtml).not.toContain('data-testid="butcher-reports-basis-control"');
  });

  it('places the Report Selector above the statistics strip and renders only contextual, report-specific KPIs for every report type', () => {
    // 1. Registry integrity & adaptive KPI column classes
    expect(BUTCHER_REPORT_DEFINITIONS.map(d => d.id)).toEqual([
      'yields',
      'weights',
      'cuts',
      'breakdown',
      'species',
      'timelines',
    ]);
    expect(getButcherReportDefinition('timelines').testId).toBe('butcher-reports-timelines-tab');
    expect(getKpiGridColumnsClass(3)).toContain('sm:grid-cols-3');
    expect(getKpiGridColumnsClass(4)).toContain('lg:grid-cols-4');
    expect(getKpiGridColumnsClass(6)).toContain('xl:grid-cols-6');
    expect(getKpiGridColumnsClass(8)).toContain('xl:grid-cols-8');

    const richState = {
      butcherOrders: [
        {
          id: 'ord-ctx-1',
          orderNumber: '9001',
          species: 'Beef',
          animalCount: 2,
          birthDate: '2024-09-01',
          killDate: '2026-09-01',
          pickupDate: '2026-09-20',
          liveWeight: 2400,
          hotWeight: 1488,
          coldWeight: 1440,
          createdAt: 1700000001000,
        },
        {
          id: 'ord-ctx-2',
          orderNumber: '9002',
          species: 'Pork',
          animalCount: 1,
          birthDate: '2026-02-01',
          killDate: '2026-10-01',
          pickupDate: '2026-10-12',
          liveWeight: 280,
          hotWeight: 210,
          coldWeight: 204,
          createdAt: 1700000002000,
        },
      ],
      butcherRecords: [
        {
          id: 'rec-ctx-1',
          serial: 'SC-1',
          orderId: 'ord-ctx-1',
          productId: 'prod-ribeye',
          originalCutName: 'Ribeye Steak',
          normalizedCutName: 'Ribeye Steak',
          packDate: '2026-09-14',
          pieces: 24,
          netWeight: 48,
        },
        {
          id: 'rec-ctx-2',
          serial: 'SC-2',
          orderId: 'ord-ctx-1',
          productId: 'prod-ground',
          originalCutName: 'Ground Beef',
          normalizedCutName: 'Ground Beef',
          packDate: '2026-09-15',
          pieces: 100,
          netWeight: 100,
        },
        {
          id: 'rec-ctx-3',
          serial: 'SC-3',
          orderId: 'ord-ctx-2',
          productId: 'prod-chop',
          originalCutName: 'Pork Chops',
          normalizedCutName: 'Pork Chops',
          packDate: '2026-10-08',
          pieces: 30,
          netWeight: 60,
        },
      ],
      locations: [],
      products: [
        { id: 'prod-ribeye', name: 'Ribeye Steak', salePrice: 22, salePriceUnit: 'lb' },
        { id: 'prod-ground', name: 'Ground Beef', salePrice: 8, salePriceUnit: 'lb' },
      ],
      pallets: [],
      offSiteEntries: [],
      freezers: [],
      tags: [],
      appConfig: [],
    };

    const renderReport = (reportType: ButcherReportTypeId) =>
      renderToStaticMarkup(
        React.createElement(ButcherRecordsView, {
          state: richState,
          dispatch: () => {},
          activeTab: 'reports',
          initialReportType: reportType,
        }),
      );

    const extractKpiStrip = (html: string) => {
      const selectorPos = html.indexOf('data-testid="butcher-report-selector-bar"');
      const kpiPos = html.indexOf('data-testid="butcher-reports-kpi-strip"');
      const dashPos = html.indexOf('data-testid="butcher-reports-dashboard"');
      expect(selectorPos).toBeGreaterThan(-1);
      expect(kpiPos).toBeGreaterThan(selectorPos);
      expect(dashPos).toBeGreaterThan(kpiPos);
      return html.slice(kpiPos, dashPos);
    };

    // Yields report: only yield metrics, no weight-per-head or timeline cards
    const yieldsKpis = extractKpiStrip(renderReport('yields'));
    expect(yieldsKpis).toContain('data-report-type="yields"');
    expect(yieldsKpis).toContain('Avg Dressing');
    expect(yieldsKpis).toContain('Avg Cooler Shrink');
    expect(yieldsKpis).toContain('Avg Cutting Yield');
    expect(yieldsKpis).toContain('Standing Yield');
    expect(yieldsKpis).toContain('Top Standing Yield');
    expect(yieldsKpis).not.toContain('Avg Live / Head');
    expect(yieldsKpis).not.toContain('Avg Turnaround');

    // Weights report: live/hot/cold/packaged weights, no dressing/shrink yield cards
    const weightsKpis = extractKpiStrip(renderReport('weights'));
    expect(weightsKpis).toContain('data-report-type="weights"');
    expect(weightsKpis).toContain('Avg Live / Head');
    expect(weightsKpis).toContain('Avg Hot / Head');
    expect(weightsKpis).toContain('Avg Cold / Head');
    expect(weightsKpis).toContain('Avg Pkg / Head');
    expect(weightsKpis).toContain('Total Packaged');
    expect(weightsKpis).not.toContain('Avg Dressing');
    expect(weightsKpis).not.toContain('Avg Cooler Shrink');

    // Cuts Over Time report: cut-specific tracking stats
    const cutsKpis = extractKpiStrip(renderReport('cuts'));
    expect(cutsKpis).toContain('data-report-type="cuts"');
    expect(cutsKpis).toContain('Tracked Cuts');
    expect(cutsKpis).toContain('Selected Weight');
    expect(cutsKpis).toContain('Share of Packaged');
    expect(cutsKpis).toContain('Peak Order Share');
    expect(cutsKpis).not.toContain('Avg Dressing');

    // Cut Breakdown report: cut counts, packages, pieces, net weight, top cut, sales value
    const breakdownHtml = renderReport('breakdown');
    const breakdownKpis = extractKpiStrip(breakdownHtml);
    expect(breakdownKpis).toContain('data-report-type="breakdown"');
    expect(breakdownKpis).toContain('Unique Cuts');
    expect(breakdownKpis).toContain('Total Packages');
    expect(breakdownKpis).toContain('Total Pieces');
    expect(breakdownKpis).toContain('Top Cut by Weight');
    expect(breakdownKpis).toContain('Ground Beef');
    expect(breakdownKpis).toContain('Est. Sales Value');
    expect(breakdownKpis).toContain('$1,856.00');
    expect(breakdownKpis).not.toContain('Avg Dressing');
    expect(breakdownHtml).toContain('data-testid="butcher-reports-breakdown-panel"');

    // Species Comparison report: species leaders
    const speciesKpis = extractKpiStrip(renderReport('species'));
    expect(speciesKpis).toContain('data-report-type="species"');
    expect(speciesKpis).toContain('Species Tracked');
    expect(speciesKpis).toContain('Top Volume Species');
    expect(speciesKpis).toContain('Highest Dressing');
    expect(speciesKpis).toContain('Highest Cutting');
    expect(speciesKpis).toContain('Lowest Shrink');
    expect(speciesKpis).toContain('Heaviest Avg Live');
    expect(speciesKpis).toContain('Beef');
    expect(speciesKpis).toContain('Pork');

    // Timelines & Dates report: date span, age, hang time, pack span, hold, turnaround — and NO duplicate inner KPI strip
    const timelinesHtml = renderReport('timelines');
    const timelinesKpis = extractKpiStrip(timelinesHtml);
    expect(timelinesKpis).toContain('data-report-type="timelines"');
    expect(timelinesKpis).toContain('Date Span');
    expect(timelinesKpis).toContain('2026-09 → 2026-10');
    expect(timelinesKpis).toContain('Avg Days Alive');
    expect(timelinesKpis).toContain('Avg Hang Time');
    expect(timelinesKpis).toContain('Avg Package Span');
    expect(timelinesKpis).toContain('Post-Pack Hold');
    expect(timelinesKpis).toContain('Avg Turnaround');
    expect(timelinesKpis).not.toContain('Avg Dressing');
    // Inside #butcher-timelines-report, the standalone duplicate KPI grid is hidden when embedded
    const innerTimelinesChunk = timelinesHtml.slice(timelinesHtml.indexOf('id="butcher-timelines-report"'));
    expect(innerTimelinesChunk).not.toContain('Cadence &amp; Pack Throughput');
    expect(innerTimelinesChunk).not.toContain('Avg Daily Gain (ADG)');

    // Empty dataset handles all report types gracefully without NaN or crashes
    const emptyKpiCtx = {
      orderCount: 0,
      animalCount: 0,
      reportMode: 'actuals' as const,
      averages: {
        avgLive: 0,
        avgHot: 0,
        avgCold: 0,
        avgPackaged: 0,
        avgHotYield: 0,
        avgShrink: 0,
        avgCutYield: 0,
        avgFinishLive: 0,
      },
      ordersWithStats: [],
      totalPackagedLbs: 0,
      cutTrends: { selectedCuts: [], mode: 'compare' as const, additivePoints: [] },
      breakdown: {
        allRows: [],
        filteredRows: [],
        totalWeightAll: 0,
        searchQuery: '',
        totalEstValue: 0,
        pricedCutCount: 0,
      },
      speciesComparison: [],
      timelineReport: computeButcherTimelineReport([], new Map()),
    };
    for (const def of BUTCHER_REPORT_DEFINITIONS) {
      const kpis = buildButcherReportKpis(def.id, emptyKpiCtx);
      expect(kpis.length).toBeGreaterThanOrEqual(4);
      for (const item of kpis) {
        expect(item.value).not.toContain('NaN');
        expect(item.subValue || '').not.toContain('NaN');
      }
    }
  });

  it('supports sending and appending checked Butcher Logs orders directly into the Butcher Spreadsheet filter', () => {
    // 1. mergeOrderIdsForSpreadsheetFilter unit tests
    expect(mergeOrderIdsForSpreadsheetFilter(['ord-1'], ['ord-2', 'ord-3'], 'replace')).toEqual([
      'ord-2',
      'ord-3',
    ]);
    expect(mergeOrderIdsForSpreadsheetFilter(['ALL', 'ord-1'], ['ord-2', 'ord-1', 'ALL', ''], 'append')).toEqual([
      'ord-1',
      'ord-2',
    ]);
    expect(mergeOrderIdsForSpreadsheetFilter([], ['  ord-9  ', 'ord-9'], 'replace')).toEqual([
      'ord-9',
    ]);

    // 2. ButcherSpreadsheetView applies incoming orderSelectionRequest immediately on mount
    const spreadsheetState: any = {
      butcherOrders: [
        {
          id: 'ord-ss-1',
          orderNumber: '201',
          species: 'Beef',
          killDate: '2026-08-01',
          liveWeight: 1200,
          hotWeight: 740,
          coldWeight: 720,
          createdAt: 1700000001000,
        },
        {
          id: 'ord-ss-2',
          orderNumber: '202',
          species: 'Pork',
          killDate: '2026-09-01',
          liveWeight: 280,
          hotWeight: 210,
          coldWeight: 204,
          createdAt: 1700000002000,
        },
        {
          id: 'ord-ss-3',
          orderNumber: '203',
          species: 'Lamb',
          killDate: '2026-10-01',
          liveWeight: 120,
          hotWeight: 62,
          coldWeight: 60,
          createdAt: 1700000003000,
        },
      ],
      butcherRecords: [
        {
          id: 'rec-ss-1',
          serial: 'SS-101',
          orderId: 'ord-ss-1',
          orderNumber: '201',
          boxNumber: 'BOX-201',
          originalCutName: 'Beef Ribeye Alpha',
          normalizedCutName: 'Beef Ribeye Alpha',
          pieces: 4,
          netWeight: 12.5,
          status: 'active',
        },
        {
          id: 'rec-ss-2',
          serial: 'SS-202',
          orderId: 'ord-ss-2',
          orderNumber: '202',
          boxNumber: 'BOX-202',
          originalCutName: 'Pork Loin Beta',
          normalizedCutName: 'Pork Loin Beta',
          pieces: 6,
          netWeight: 18.0,
          status: 'active',
        },
        {
          id: 'rec-ss-3',
          serial: 'SS-303',
          orderId: 'ord-ss-3',
          orderNumber: '203',
          boxNumber: 'BOX-203',
          originalCutName: 'Lamb Chop Gamma',
          normalizedCutName: 'Lamb Chop Gamma',
          pieces: 8,
          netWeight: 9.25,
          status: 'active',
        },
      ],
      offSiteEntries: [
        {
          id: 'rec-ss-1',
          serial: 'SS-101',
          orderId: 'ord-ss-1',
          orderNumber: '201',
          boxNumber: 'BOX-201',
          originalCutName: 'Beef Ribeye Alpha',
          cuts: 'Beef Ribeye Alpha',
          pieces: 4,
          netWeight: 12.5,
          status: 'active',
        },
        {
          id: 'rec-ss-2',
          serial: 'SS-202',
          orderId: 'ord-ss-2',
          orderNumber: '202',
          boxNumber: 'BOX-202',
          originalCutName: 'Pork Loin Beta',
          cuts: 'Pork Loin Beta',
          pieces: 6,
          netWeight: 18.0,
          status: 'active',
        },
        {
          id: 'rec-ss-3',
          serial: 'SS-303',
          orderId: 'ord-ss-3',
          orderNumber: '203',
          boxNumber: 'BOX-203',
          originalCutName: 'Lamb Chop Gamma',
          cuts: 'Lamb Chop Gamma',
          pieces: 8,
          netWeight: 9.25,
          status: 'active',
        },
      ],
      locations: [],
      products: [],
      pallets: [],
      freezers: [],
      tags: [],
      appConfig: [],
    };

    const twoOrdersHtml = renderToStaticMarkup(
      React.createElement(ButcherSpreadsheetView, {
        state: spreadsheetState,
        dispatch: () => {},
        isFilterPanelOpen: true,
        orderSelectionRequest: {
          orderIds: ['ord-ss-1', 'ord-ss-3'],
          mode: 'replace',
          requestId: 1,
        },
      }),
    );

    expect(twoOrdersHtml).toContain('2 Orders Selected');
    expect(twoOrdersHtml).toContain('Beef Ribeye Alpha');
    expect(twoOrdersHtml).toContain('Lamb Chop Gamma');
    expect(twoOrdersHtml).not.toContain('Pork Loin Beta');

    const singleOrderHtml = renderToStaticMarkup(
      React.createElement(ButcherSpreadsheetView, {
        state: spreadsheetState,
        dispatch: () => {},
        isFilterPanelOpen: true,
        orderSelectionRequest: {
          orderIds: ['ord-ss-2'],
          mode: 'replace',
          requestId: 2,
        },
      }),
    );

    expect(singleOrderHtml).toContain('Order #202');
    expect(singleOrderHtml).toContain('Pork Loin Beta');
    expect(singleOrderHtml).not.toContain('Beef Ribeye Alpha');
    expect(singleOrderHtml).not.toContain('Lamb Chop Gamma');

    // 3. ButcherRecordsView Logs selection bar wires Send to Spreadsheet & Add to Spreadsheet alongside Reports
    const logsHtml = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: spreadsheetState,
        dispatch: () => {},
        activeTab: 'orders',
      }),
    );
    expect(logsHtml).toContain('Check orders to send them to Reports or Spreadsheet');

    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    expect(viewSrc).toContain('data-testid="butcher-send-to-spreadsheet-btn"');
    expect(viewSrc).toContain('data-testid="butcher-append-to-spreadsheet-btn"');
    expect(viewSrc).toContain('handleSendOrdersToSpreadsheet');
    expect(viewSrc).toContain('orderSelectionRequest={spreadsheetSelectionRequest}');
  });

  it('keeps the Butcher Logs selection bar sticky directly below the top menu bar without an ancestor overflow-auto sticky trap', () => {
    const mockState: any = {
      butcherOrders: [
        {
          id: 'ord-sticky-1',
          orderNumber: '501',
          species: 'Beef',
          animalCount: 1,
          liveWeight: 1200,
          hotWeight: 740,
          coldWeight: 720,
          createdAt: 1700000000000,
        },
      ],
      butcherRecords: [],
      locations: [],
      products: [],
      pallets: [],
      freezers: [],
      tags: [],
      appConfig: [],
    };

    const html = renderToStaticMarkup(
      React.createElement(ButcherRecordsView, {
        state: mockState,
        dispatch: () => {},
        activeTab: 'orders',
      }),
    );

    // Ancestor wrapper uses overflow-x-clip (not overflow-auto) so window-level position: sticky works
    const rootMatch = html.match(/<div id="butcher-records-view"[^>]*>/);
    expect(rootMatch).not.toBeNull();
    expect(rootMatch![0]).toContain('overflow-x-clip');
    expect(rootMatch![0]).not.toContain('overflow-auto');

    // Selection bar is sticky right below --header-height, layered under #main-app-header (z-40)
    const barMatch = html.match(/<div data-testid="butcher-logs-selection-bar"[^>]*>/);
    expect(barMatch).not.toBeNull();
    expect(barMatch![0]).toContain('sticky');
    expect(barMatch![0]).toContain('z-30');
    expect(barMatch![0]).toContain('top:var(--header-height, 68px)');
    expect(barMatch![0]).toContain('backdrop-blur-md');

    // Selected state also uses high-opacity backdrop so scrolling cards do not bleed through
    const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/ButcherRecordsView.tsx'), 'utf-8');
    expect(viewSrc).toContain('bg-cyan-950/95 border border-cyan-500/60 shadow-lg');
  });
});




