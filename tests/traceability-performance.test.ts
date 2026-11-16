import { describe, it, expect } from 'vitest';
import {
  buildTraceRecords,
  enrichTraceRecordWithHistory,
  formatTraceDate,
  extractDateFromPalletOrId
} from '../views/TraceabilityView';
import { calculateHistoryRetention } from '../utils/historyRetention';
import { parseHistoryTimestampMs, formatHistoryTimestamp } from '../views/HistoryView';
import {
  Product,
  ButcherOrder,
  AppLocation,
  Tag,
  Container,
  Freezer,
  OffSiteEntry,
  MovementOrder,
  MeatCut,
  HistoryEntry
} from '../types';

describe('Item Traceability Index & Lazy History Enrichment', () => {
  const sampleProducts: Product[] = [
    {
      id: 'prod-ribeye',
      name: 'Ribeye Steak',
      primaryCategory: 'Beef',
      subCategory: 'Steaks',
      productNumbers: ['101']
    },
    {
      id: 'prod-bacon',
      name: 'Smoked Bacon',
      primaryCategory: 'Pork',
      subCategory: 'Cured',
      productNumbers: ['205']
    }
  ];

  const sampleButcherOrders: ButcherOrder[] = [
    {
      id: 'bo-1',
      orderNumber: '2026-BEEF-01',
      species: 'Beef',
      killDate: '2026-03-10',
      pickupDate: '2026-03-24',
      animalCount: 2,
      liveWeight: 2400,
      hotWeight: 1500,
      coldWeight: 1460,
      createdAt: 1773129600000
    }
  ];

  const sampleLocations: AppLocation[] = [
    { id: 'loc-cold', name: 'Polar Cold Storage', isHome: false, type: 'storage' },
    { id: 'loc-home', name: 'Home Staging', isHome: true, type: 'storage' },
    { id: 'loc-click', name: 'CLiCK Commercial Kitchen', isHome: false, type: 'delivery_pickup' }
  ];

  const sampleTags: Tag[] = [
    { id: 'tag-prime', name: 'Prime Reserve', color: '#f59e0b' }
  ];

  const sampleFreezers: Freezer[] = [
    { id: 'fz-1', name: 'Walk-In Freezer' }
  ];

  const sampleContainers: Container[] = [
    { id: 'cont-1', name: 'Bin A1', freezerId: 'fz-1', icon: 'box' }
  ];

  it('resolves off-site active entries, on-site correlated cuts, and delivered/archived dispositions accurately', () => {
    const offSiteEntries: OffSiteEntry[] = [
      {
        id: 'ose-1',
        serial: 'SN-1001',
        lot: 'LOT-A',
        cuts: '101 Ribeye Steak',
        packDate: '2026-03-24',
        pieces: 2,
        netWeight: 3.45,
        orderId: '2026-beef-01',
        storageLocationId: 'loc-cold',
        pallet: 'P1-03262026',
        box: 'B1',
        tagIds: ['tag-prime'],
        archived: false
      },
      {
        id: 'ose-2',
        productId: 'prod-ribeye',
        serial: 'SN-1002',
        lot: 'LOT-A',
        cuts: 'Ribeye Steak',
        packDate: '2026-03-24',
        pieces: 1,
        netWeight: 1.8,
        orderId: 'bo-1',
        storageLocationId: 'loc-cold',
        pallet: 'P1',
        box: 'B2',
        archived: true
      },
      {
        id: 'ose-3',
        productId: 'prod-bacon',
        serial: 'SN-1003',
        lot: 'LOT-B',
        cuts: 'Smoked Bacon',
        packDate: '2026-03-25',
        pieces: 1,
        netWeight: 1.0,
        archived: true
      }
    ];

    const meatCuts: MeatCut[] = [
      {
        id: 'mc-onsite-2',
        productId: 'prod-ribeye',
        containerId: 'cont-1',
        quantity: 1,
        serial: 'sn-1002',
        lot: 'LOT-A',
        packDate: '2026-03-24',
        weight: 1.8
      },
      {
        id: 'mc-direct-1',
        productId: 'prod-bacon',
        containerId: 'cont-1',
        quantity: 3,
        serial: 'SN-DIRECT-9',
        lot: 'LOT-C',
        packDate: '2026-04-01',
        weight: 3.0
      }
    ];

    const movementOrders: MovementOrder[] = [
      {
        id: 'mo-1',
        name: 'Bring Home Order #1',
        date: '2026-04-02T10:00:00Z',
        executedAt: '2026-04-02T14:30:00Z',
        status: 'completed',
        palletsInPlay: ['P1'],
        locationsInPlay: ['loc-cold', 'loc-home'],
        targetDestinations: [
          { id: 'dest-home', locationId: 'loc-home', locationName: 'Home Staging' }
        ],
        originalEntries: [
          {
            id: 'ose-legacy-2',
            serial: 'SN-1002',
            cuts: 'Ribeye Steak',
            pieces: 1,
            netWeight: 1.8
          }
        ],
        moves: [
          {
            entryId: 'ose-legacy-2',
            targetLocation: 'dest-home',
            actualLocation: 'dest-home'
          }
        ]
      }
    ];

    const history: HistoryEntry[] = [
      {
        id: 'h-intake-1',
        timestamp: '2026-03-26T09:15:00Z',
        description: 'Imported pallet P1-03262026 into off-site storage',
        targetId: 'offsite'
      },
      {
        id: 'h-removal-3',
        timestamp: '2026-04-05T16:00:00Z',
        description: 'Removed SN-1003 from offsite inventory after delivery to "CLiCK Commercial Kitchen"',
        targetId: 'offsite-removal'
      },
      {
        id: 'h-cohort-1',
        timestamp: '2026-04-03T11:00:00Z',
        description: 'Audited Bin A1 in Walk-In Freezer',
        targetId: 'cont-1'
      }
    ];

    const index = buildTraceRecords({
      products: sampleProducts,
      butcherOrders: sampleButcherOrders,
      locations: sampleLocations,
      tags: sampleTags,
      containers: sampleContainers,
      freezers: sampleFreezers,
      offSiteEntries,
      movementOrders,
      meatCuts,
      history
    });

    expect(index.records).toHaveLength(4);
    expect(index.uniqueLots).toEqual(['LOT-A', 'LOT-B', 'LOT-C']);

    // 1. Active Off-Site Record (resolved via productNumbers prefix '101' and case-insensitive orderNumber)
    const rec1 = index.recordsByKey.get('SN-1001')!;
    expect(rec1).toBeDefined();
    expect(rec1.cutName).toBe('Ribeye Steak');
    expect(rec1.butcherOrder?.id).toBe('bo-1');
    expect(rec1.currentLocationType).toBe('offsite');
    expect(rec1.offSiteIntakeDate).toBe('03/26/2026');
    expect(rec1.tags.map(t => t.name)).toEqual(['Prime Reserve']);

    // Enrich rec1 lazily with history logs -> picks up exact intake timestamp
    const enriched1 = enrichTraceRecordWithHistory(rec1, history);
    expect(enriched1.offSiteIntakeDate).toBe('2026-03-26T09:15:00Z');

    // 2. Correlated On-Site Record (matched via productId + case-insensitive serial & movement order via originalEntries)
    const rec2 = index.recordsByKey.get('SN-1002')!;
    expect(rec2).toBeDefined();
    expect(rec2.currentLocationType).toBe('onsite');
    expect(rec2.currentLocationName).toBe('Walk-In Freezer • Bin A1');
    expect(rec2.movementOrders).toHaveLength(1);
    expect(rec2.onSiteArrivalDate).toBe('2026-04-02T14:30:00Z');

    const enriched2 = enrichTraceRecordWithHistory(rec2, history);
    expect(enriched2.onSiteCohortLogs).toHaveLength(1);
    expect(enriched2.onSiteCohortLogs[0].id).toBe('h-cohort-1');

    // 3. Delivered & Removed Record (matched via pre-filtered removal log)
    const rec3 = index.recordsByKey.get('SN-1003')!;
    expect(rec3).toBeDefined();
    expect(rec3.currentLocationType).toBe('archived');
    expect(rec3.removalDestination).toBe('CLiCK Commercial Kitchen');
    expect(rec3.currentLocationName).toContain('Delivered to CLiCK Commercial Kitchen');

    // 4. Direct On-Site Cut without off-site entry
    const rec4 = index.recordsByKey.get('SN-DIRECT-9')!;
    expect(rec4).toBeDefined();
    expect(rec4.currentLocationType).toBe('onsite');
    expect(rec4.currentLocationName).toBe('Walk-In Freezer • Bin A1');
  });

  it('formats dates and extracts embedded pallet dates reliably', () => {
    expect(extractDateFromPalletOrId('P3-03262026')).toBe('03/26/2026');
    expect(extractDateFromPalletOrId('Pallet_2026-03-26_A')).toBe('2026-03-26');
    expect(extractDateFromPalletOrId('NoDateHere')).toBeUndefined();

    expect(formatTraceDate('')).toBe('Not specified');
    expect(formatTraceDate('invalid-date-str')).toBe('invalid-date-str');
    expect(formatTraceDate('2026-03-26T12:00:00Z', false)).toContain('2026');
    expect(formatTraceDate('2026-03-26T12:00:00Z', true)).toContain('2026');

    expect(parseHistoryTimestampMs('2026-03-26T12:00:00Z')).toBeGreaterThan(0);
    expect(formatHistoryTimestamp('2026-03-26T12:00:00Z')).toContain('2026');
  });

  it('indexes 5,000 off-site entries, 2,000 on-site cuts, 40 movement orders, and 10,000 history logs in under 300ms', () => {
    const offSiteEntries: OffSiteEntry[] = [];
    for (let i = 0; i < 5000; i++) {
      offSiteEntries.push({
        id: `ose-${i}`,
        productId: i % 2 === 0 ? 'prod-ribeye' : undefined,
        cuts: i % 2 === 0 ? 'Ribeye Steak' : '205 Smoked Bacon',
        serial: `SN-${100000 + i}`,
        lot: `LOT-${i % 25}`,
        packDate: '2026-03-24',
        pieces: 1,
        netWeight: 2.25,
        orderId: 'bo-1',
        storageLocationId: 'loc-cold',
        pallet: `P-${i % 10}-03262026`,
        box: `B-${i % 50}`,
        archived: i % 3 === 0
      });
    }

    const meatCuts: MeatCut[] = [];
    for (let i = 0; i < 2000; i++) {
      meatCuts.push({
        id: `mc-${i}`,
        productId: 'prod-ribeye',
        containerId: 'cont-1',
        quantity: 1,
        serial: `SN-${100000 + i * 2}`,
        lot: `LOT-${i % 25}`,
        packDate: '2026-03-24',
        weight: 2.25
      });
    }

    const movementOrders: MovementOrder[] = [];
    for (let m = 0; m < 40; m++) {
      const moves = [];
      const originalEntries = [];
      for (let k = 0; k < 200; k++) {
        const entryIdx = (m * 100 + k) % 5000;
        moves.push({
          entryId: `ose-${entryIdx}`,
          targetLocation: 'dest-home',
          actualLocation: 'dest-home'
        });
        originalEntries.push({
          id: `ose-${entryIdx}`,
          serial: `SN-${100000 + entryIdx}`,
          cuts: 'Ribeye Steak',
          pieces: 1,
          netWeight: 2.25
        });
      }
      movementOrders.push({
        id: `mo-${m}`,
        name: `Order ${m}`,
        date: '2026-04-01T10:00:00Z',
        executedAt: '2026-04-01T12:00:00Z',
        status: 'completed',
        palletsInPlay: ['P-1'],
        locationsInPlay: ['loc-cold'],
        targetDestinations: [
          { id: 'dest-home', locationId: 'loc-home', locationName: 'Home Staging' }
        ],
        originalEntries,
        moves
      });
    }

    const history: HistoryEntry[] = [];
    for (let h = 0; h < 10000; h++) {
      history.push({
        id: `hist-${h}`,
        timestamp: '2026-04-01T08:00:00Z',
        description:
          h === 9999
            ? 'Removed SN-100003 from offsite inventory after delivery to "CLiCK Commercial Kitchen"'
            : `Routine inventory adjustment #${h} on container Bin A1`,
        targetId: h === 9999 ? 'offsite-removal' : 'cont-1'
      });
    }

    const start = performance.now();
    const index = buildTraceRecords({
      products: sampleProducts,
      butcherOrders: sampleButcherOrders,
      locations: sampleLocations,
      tags: sampleTags,
      containers: sampleContainers,
      freezers: sampleFreezers,
      offSiteEntries,
      movementOrders,
      meatCuts,
      history
    });

    const active = enrichTraceRecordWithHistory(index.recordsByKey.get('SN-100000')!, history);
    const elapsedMs = performance.now() - start;

    expect(index.records).toHaveLength(5000);
    expect(active.serial).toBe('SN-100000');
    expect(index.recordsByKey.get('SN-100003')?.removalDestination).toBe('CLiCK Commercial Kitchen');
    expect(elapsedMs).toBeLessThan(300);

    // Verify O(H + S) calculateHistoryRetention across 10,000 history logs and 5,000 serials
    const retentionStart = performance.now();
    const retention = calculateHistoryRetention(
      history,
      { offSiteEntries, meatCuts, containers: sampleContainers, movementOrders },
      365
    );
    const retentionElapsed = performance.now() - retentionStart;

    expect(retention.totalEntries).toBe(10000);
    expect(retention.keptCount).toBe(10000);
    expect(retentionElapsed).toBeLessThan(300);
  });

  it('protects active packages and purges only departed packages older than threshold in calculateHistoryRetention', () => {
    const threeYearsAgoIso = new Date(Date.now() - 3 * 365 * 86400 * 1000).toISOString();
    const twoMonthsAgoIso = new Date(Date.now() - 60 * 86400 * 1000).toISOString();

    const offSiteEntries: OffSiteEntry[] = [
      {
        id: 'ose-active',
        serial: 'SN-ACTIVE-1',
        lot: 'LOT-ACTIVE',
        cuts: 'Ribeye Steak',
        pieces: 1,
        netWeight: 2,
        archived: false
      },
      {
        id: 'ose-departed-old',
        serial: 'SN-OLD-99',
        lot: 'LOT-OLD',
        cuts: 'Ribeye Steak',
        pieces: 0,
        netWeight: 2,
        archived: true
      },
      {
        id: 'ose-departed-recent',
        serial: 'SN-RECENT-77',
        lot: 'LOT-RECENT',
        cuts: 'Ribeye Steak',
        pieces: 0,
        netWeight: 2,
        archived: true
      }
    ];

    const history: HistoryEntry[] = [
      {
        id: 'h-1',
        timestamp: threeYearsAgoIso,
        description: 'Imported SN-ACTIVE-1 into cold storage 3 years ago',
        targetId: 'ose-active'
      },
      {
        id: 'h-2',
        timestamp: threeYearsAgoIso,
        description: 'Consumed SN-OLD-99 3 years ago',
        targetId: 'ose-departed-old'
      },
      {
        id: 'h-3',
        timestamp: threeYearsAgoIso,
        description: 'Imported SN-RECENT-77 3 years ago',
        targetId: 'ose-departed-recent'
      },
      {
        id: 'h-4',
        timestamp: twoMonthsAgoIso,
        description: 'Consumed SN-RECENT-77 2 months ago',
        targetId: 'ose-departed-recent'
      }
    ];

    const res = calculateHistoryRetention(history, { offSiteEntries }, 365);
    // h-1 is kept (active), h-3 & h-4 are kept (SN-RECENT-77 departed only 2 months ago), h-2 is purged (departed 3 years ago > 365 days)
    expect(res.purgedCount).toBe(1);
    expect(res.toPurge.map(h => h.id)).toEqual(['h-2']);
    expect(res.toKeep.map(h => h.id)).toEqual(['h-1', 'h-3', 'h-4']);
  });
});

