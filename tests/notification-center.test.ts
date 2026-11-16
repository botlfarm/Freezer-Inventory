import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  migrateLegacyNotificationData,
  resolveEffectiveDailyDigestMode,
  resolveListChannelIdsForTrigger,
  isCustomScheduleDue,
  detectNewlyBreachedListItems,
  formatListItemsReport,
  formatListNotificationSummary,
  buildInventoryMetricMaps,
} from '../utils/notifications';
import {
  CustomList,
  InventoryState,
  NotificationChannel,
  NotificationSettings,
} from '../types';
import {
  createTestDatabase,
  restoreDatabaseSnapshot,
  seedSampleDatabase,
} from './test-harness';

describe('Legacy Notification Migration & Normalization', () => {
  it('migrates legacy SMTP, webhook, default in-app channel, and legacy lists without duplication', () => {
    const legacySettings: NotificationSettings = {
      id: 'global',
      digestEnabled: true,
      digestMode: 'combined',
      digestTime: '19:30',
      timezone: 'America/Chicago',
      method: 'smtp_email',
      smtpHost: 'smtp.farm.local',
      smtpPort: 587,
      smtpUser: 'alerts@farm.local',
      smtpPass: 'secret',
      smtpFrom: 'Freezer <alerts@farm.local>',
      smtpTo: 'owner@farm.local',
      smtpSecure: false,
      webhookUrl: 'https://hooks.example.com/freezer',
    };

    const legacyLists: CustomList[] = [
      {
        id: 'list-1',
        name: 'Daily Pick List',
        description: '',
        allowNotes: true,
        isInventoryControlled: false,
        items: [{ productId: 'prod-ribeye', addedAt: '2026-11-15T10:00:00.000Z' }],
        notificationEnabled: true,
        notificationType: 'all_items',
      },
      {
        id: 'list-off',
        name: 'Silent List',
        description: '',
        allowNotes: false,
        isInventoryControlled: false,
        items: [],
        notificationEnabled: false,
      },
    ];

    const res = migrateLegacyNotificationData(legacySettings, [], legacyLists);
    expect(res.migrated).toBe(true);
    expect(res.channels.map((c) => c.id)).toEqual([
      'channel-migrated-smtp',
      'channel-migrated-webhook',
      'channel-default-in-app',
    ]);
    expect(res.settings.defaultChannelIds).toEqual(['channel-migrated-smtp']);

    const migratedList = res.customLists.find((l) => l.id === 'list-1')!;
    expect(migratedList.notificationDailyDigestMode).toBe('combined');
    expect(migratedList.notificationChannelIds).toEqual(['channel-migrated-smtp']);

    const silentList = res.customLists.find((l) => l.id === 'list-off')!;
    expect(silentList.notificationDailyDigestMode).toBeUndefined();
    expect(silentList.notificationChannelIds).toBeUndefined();

    // Idempotent second pass once channels already exist
    const secondPass = migrateLegacyNotificationData(res.settings, res.channels, res.customLists);
    expect(secondPass.migrated).toBe(false);
    expect(secondPass.channels).toHaveLength(3);
  });

  it('respects individual digestMode during legacy list migration', () => {
    const legacySettings: NotificationSettings = {
      id: 'global',
      digestEnabled: true,
      digestMode: 'individual',
      digestTime: '20:00',
      method: 'in_app',
    };
    const legacyLists: CustomList[] = [
      {
        id: 'list-ind',
        name: 'Individual Alert List',
        description: '',
        allowNotes: true,
        isInventoryControlled: false,
        items: [],
        notificationEnabled: true,
      },
    ];

    const res = migrateLegacyNotificationData(legacySettings, undefined, legacyLists);
    expect(res.channels.map((c) => c.id)).toEqual(['channel-default-in-app']);
    expect(res.customLists[0].notificationDailyDigestMode).toBe('separate');
    expect(res.customLists[0].notificationChannelIds).toEqual(['channel-default-in-app']);
  });
});

describe('Multi-Channel & Multi-Frequency Trigger Resolution', () => {
  const channels: NotificationChannel[] = [
    { id: 'ch-smtp', name: 'Manager Email', type: 'smtp_email', enabled: true, config: { smtpHost: 'smtp.local', smtpTo: 'mgr@farm.local' } },
    { id: 'ch-hook', name: 'Slack Webhook', type: 'webhook', enabled: true, config: { webhookUrl: 'https://hooks.slack.com/test' } },
    { id: 'ch-app', name: 'App Log', type: 'in_app', enabled: true, config: {} },
    { id: 'ch-disabled', name: 'Disabled Webhook', type: 'webhook', enabled: false, config: { webhookUrl: 'https://hooks.slack.com/off' } },
  ];

  const settings: NotificationSettings = {
    id: 'global',
    digestEnabled: true,
    digestMode: 'combined',
    digestTime: '20:00',
    timezone: 'America/New_York',
    method: 'in_app',
    defaultChannelIds: ['ch-app'],
  };

  it('supports simultaneous immediate + daily digest on the same list with per-trigger channel overrides', () => {
    const list: CustomList = {
      id: 'list-restock',
      name: 'Urgent Restock & Summary',
      description: '',
      allowNotes: true,
      isInventoryControlled: true,
      items: [],
      notificationEnabled: true,
      notificationChannelIds: ['ch-app', 'ch-disabled'],
      notificationDailyDigestMode: 'combined',
      notificationDigestChannelIds: ['ch-app', 'ch-hook'],
      notificationImmediate: {
        enabled: true,
        onItemAdded: true,
        onThresholdBreach: true,
        channelIds: ['ch-smtp', 'ch-disabled'],
      },
    };

    expect(resolveEffectiveDailyDigestMode(list)).toBe('combined');
    expect(resolveListChannelIdsForTrigger(list, 'immediate', settings, channels)).toEqual(['ch-smtp']);
    expect(resolveListChannelIdsForTrigger(list, 'digest', settings, channels)).toEqual(['ch-app', 'ch-hook']);
    // Custom schedule falls back to list.notificationChannelIds filtered by enabled status
    expect(resolveListChannelIdsForTrigger(list, 'custom_schedule', settings, channels)).toEqual(['ch-app']);
  });

  it('falls back to global defaultChannelIds when neither trigger override nor list channels are set', () => {
    const list: CustomList = {
      id: 'list-default-fallback',
      name: 'Default Routed List',
      description: '',
      allowNotes: true,
      isInventoryControlled: false,
      items: [],
      notificationEnabled: true,
      notificationCustomSchedule: {
        enabled: true,
        cadence: 'daily',
        time: '09:00',
      },
    };

    // Custom schedule is configured without explicit digest mode -> digest defaults to 'none'
    expect(resolveEffectiveDailyDigestMode(list)).toBe('none');
    expect(resolveListChannelIdsForTrigger(list, 'custom_schedule', settings, channels)).toEqual(['ch-app']);
  });
});

describe('Custom List Schedule Evaluator (Timezone-Aware)', () => {
  it('triggers daily custom schedule at or after local time and deduplicates same local day', () => {
    const schedule = {
      enabled: true,
      cadence: 'daily' as const,
      time: '08:30',
    };

    // 2026-11-15T13:29:00Z = 08:29 EST (not yet due)
    expect(isCustomScheduleDue(schedule, new Date('2026-11-15T13:29:00Z'), 'America/New_York')).toBe(false);

    // 2026-11-15T13:30:00Z = 08:30 EST (due!)
    expect(isCustomScheduleDue(schedule, new Date('2026-11-15T13:30:00Z'), 'America/New_York')).toBe(true);

    // Once sent at 08:31 EST, should not re-trigger on same local date
    expect(
      isCustomScheduleDue(
        { ...schedule, lastSentAt: '2026-11-15T13:31:00Z' },
        new Date('2026-11-15T18:00:00Z'),
        'America/New_York',
      ),
    ).toBe(false);

    // Next local day 08:35 EST triggers again
    expect(
      isCustomScheduleDue(
        { ...schedule, lastSentAt: '2026-11-15T13:31:00Z' },
        new Date('2026-11-16T13:35:00Z'),
        'America/New_York',
      ),
    ).toBe(true);
  });

  it('triggers weekly custom schedule only on selected days of week', () => {
    const schedule = {
      enabled: true,
      cadence: 'weekly' as const,
      time: '09:00',
      daysOfWeek: [1, 4], // Monday & Thursday
    };

    // 2026-11-15 is Sunday (day 0)
    expect(isCustomScheduleDue(schedule, new Date('2026-11-15T15:00:00Z'), 'America/New_York')).toBe(false);
    // 2026-11-16 is Monday (day 1), 15:00Z = 10:00 EST -> due
    expect(isCustomScheduleDue(schedule, new Date('2026-11-16T15:00:00Z'), 'America/New_York')).toBe(true);
  });

  it('triggers interval custom schedule when elapsed hours >= intervalHours', () => {
    const schedule = {
      enabled: true,
      cadence: 'interval' as const,
      intervalHours: 4,
      lastSentAt: '2026-11-15T10:00:00Z',
    };

    expect(isCustomScheduleDue(schedule, new Date('2026-11-15T13:59:59Z'), 'UTC')).toBe(false);
    expect(isCustomScheduleDue(schedule, new Date('2026-11-15T14:00:00Z'), 'UTC')).toBe(true);
  });
});

describe('Threshold Breach Edge Detection & Report Formatting', () => {
  const baseState: Partial<InventoryState> = {
    products: [
      { id: 'p-ribeye', name: 'Ribeye Steak', primaryCategory: 'Beef', subCategory: 'Steaks' },
      { id: 'p-brisket', name: 'Brisket Whole', primaryCategory: 'Beef', subCategory: 'Roasts' },
    ],
    meatCuts: [
      { id: 'mc-1', productId: 'p-ribeye', quantity: 5, containerId: 'c1', weight: 1.2 },
    ],
    offSiteEntries: [
      { id: 'os-1', serial: 'S-100', productId: 'p-brisket', pieces: 4, netWeight: 50, box: 'B1', archived: false },
    ],
    customLists: [
      {
        id: 'list-min',
        name: 'Low Stock Watch',
        description: '',
        allowNotes: true,
        isInventoryControlled: true,
        controlCondition: 'min',
        notificationEnabled: true,
        notificationType: 'threshold_breaches',
        notificationImmediate: {
          enabled: true,
          onItemAdded: false,
          onThresholdBreach: true,
        },
        items: [
          { productId: 'p-ribeye', threshold: 4, controlSource: 'onsite_count', notes: 'Reorder from freezer' },
          { productId: 'p-brisket', threshold: 40, controlSource: 'offsite_weight' },
        ],
      },
    ],
  };

  it('detects newly breached and worsened thresholds without re-alerting unchanged breaches', () => {
    // Drop ribeye from 5 -> 3 (breaches min 4)
    const droppedState: Partial<InventoryState> = {
      ...baseState,
      meatCuts: [{ id: 'mc-1', productId: 'p-ribeye', quantity: 3, containerId: 'c1', weight: 1.2 }],
    };

    const firstTrigger = detectNewlyBreachedListItems(baseState, droppedState);
    expect(firstTrigger).toHaveLength(1);
    expect(firstTrigger[0].breaches.map((b) => b.item.productId)).toEqual(['p-ribeye']);
    expect(firstTrigger[0].breaches[0].evaluation.currentValue).toBe(3);

    // Unrelated edit with ribeye still at 3 should NOT re-fire
    const unchangedBreach = detectNewlyBreachedListItems(droppedState, droppedState);
    expect(unchangedBreach).toHaveLength(0);

    // Further drop from 3 -> 1 worsens breach -> SHOULD re-fire
    const worsenedState: Partial<InventoryState> = {
      ...baseState,
      meatCuts: [{ id: 'mc-1', productId: 'p-ribeye', quantity: 1, containerId: 'c1', weight: 1.2 }],
    };
    const worsenedTrigger = detectNewlyBreachedListItems(droppedState, worsenedState);
    expect(worsenedTrigger).toHaveLength(1);
    expect(worsenedTrigger[0].breaches[0].evaluation.currentValue).toBe(1);
  });

  it('formats threshold_breaches reports and concise human summary strings', () => {
    const stateWithBreach: Partial<InventoryState> = {
      ...baseState,
      meatCuts: [{ id: 'mc-1', productId: 'p-ribeye', quantity: 2, containerId: 'c1', weight: 1.2 }],
    };
    const productsMap = new Map(stateWithBreach.products!.map((p) => [p.id, p]));
    const maps = buildInventoryMetricMaps(stateWithBreach);
    const list = stateWithBreach.customLists![0];

    const report = formatListItemsReport(list, productsMap, stateWithBreach, maps);
    expect(report.hasItems).toBe(true);
    expect(report.itemsCount).toBe(1);
    expect(report.text).toContain('Ribeye Steak');
    expect(report.text).toContain('[BREACHED]');
    expect(report.text).not.toContain('Brisket Whole');

    const channels: NotificationChannel[] = [
      { id: 'ch-smtp', name: 'Farm Email', type: 'smtp_email', enabled: true, config: {} },
    ];
    const summary = formatListNotificationSummary(
      {
        ...list,
        notificationDailyDigestMode: 'combined',
        notificationChannelIds: ['ch-smtp'],
        notificationImmediate: { enabled: true, onItemAdded: true, onThresholdBreach: true },
      },
      channels,
    );
    expect(summary).toContain('Daily Digest (Combined)');
    expect(summary).toContain('Immediate (Item Added + Threshold)');
    expect(summary).toContain('Farm Email');
  });
});

describe('SQLite Notification Channels & List Config Persistence + Backup Roundtrip', () => {
  let tmpDir: string;
  let dbPath: string;
  let snapshotPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freezer-notif-test-'));
    dbPath = path.join(tmpDir, 'live.db');
    snapshotPath = path.join(tmpDir, 'snapshot.db');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists named channels, system routes, log attribution, and multi-schedule lists across VACUUM backup/restore', () => {
    let db = createTestDatabase(dbPath);
    seedSampleDatabase(db);

    db.prepare(`
      INSERT INTO notification_channels (id, name, type, enabled, config, createdAt, updatedAt, lastTestedAt, lastTestStatus)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ch-smtp-ops',
      'Operations SMTP',
      'smtp_email',
      1,
      JSON.stringify({ smtpHost: 'smtp.example.org', smtpPort: 587, smtpTo: 'ops@example.org' }),
      '2026-11-15T12:00:00Z',
      '2026-11-15T12:00:00Z',
      '2026-11-15T12:05:00Z',
      'success',
    );

    db.prepare(`
      INSERT INTO notification_settings (id, digestEnabled, digestMode, digestTime, timezone, method, defaultChannelIds, systemRoutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'global',
      1,
      'combined',
      '18:30',
      'America/New_York',
      'in_app',
      JSON.stringify(['ch-smtp-ops']),
      JSON.stringify({ pinResetChannelIds: ['ch-smtp-ops'], systemAlertChannelIds: ['ch-smtp-ops'] }),
    );

    db.prepare(`
      UPDATE custom_lists
      SET notificationEnabled = 1,
          notificationChannelIds = ?,
          notificationRecipientOverride = ?,
          notificationDailyDigestMode = ?,
          notificationCustomSchedule = ?,
          notificationImmediate = ?
      WHERE id = 'list-restock'
    `).run(
      JSON.stringify(['ch-smtp-ops']),
      'butcher-desk@example.org',
      'separate',
      JSON.stringify({ enabled: true, cadence: 'weekly', time: '09:00', daysOfWeek: [1, 5] }),
      JSON.stringify({ enabled: true, onItemAdded: true, onThresholdBreach: true }),
    );

    db.prepare(`
      INSERT INTO notification_logs (id, sentAt, title, message, method, status, channelId, channelName, eventSource, listId, listName)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'log-1',
      '2026-11-15T12:10:00Z',
      'Item Added',
      'Added Ribeye Steak to Retail Restock Watchlist',
      'smtp_email',
      'success',
      'ch-smtp-ops',
      'Operations SMTP',
      'immediate_item_added',
      'list-restock',
      'Retail Restock Watchlist',
    );

    db.prepare('VACUUM INTO ?').run(snapshotPath);

    db.prepare('DELETE FROM notification_channels').run();
    db.prepare('DELETE FROM notification_settings').run();
    db.prepare('DELETE FROM notification_logs').run();
    db.prepare('DELETE FROM custom_lists').run();
    db.close();

    db = restoreDatabaseSnapshot(dbPath, snapshotPath);
    const restoredChannel = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get('ch-smtp-ops') as any;
    expect(restoredChannel.name).toBe('Operations SMTP');
    expect(JSON.parse(restoredChannel.config).smtpTo).toBe('ops@example.org');

    const restoredSettings = db.prepare('SELECT * FROM notification_settings WHERE id = ?').get('global') as any;
    expect(JSON.parse(restoredSettings.defaultChannelIds)).toEqual(['ch-smtp-ops']);
    expect(JSON.parse(restoredSettings.systemRoutes).pinResetChannelIds).toEqual(['ch-smtp-ops']);

    const restoredList = db.prepare('SELECT * FROM custom_lists WHERE id = ?').get('list-restock') as any;
    expect(restoredList.notificationDailyDigestMode).toBe('separate');
    expect(restoredList.notificationRecipientOverride).toBe('butcher-desk@example.org');
    expect(JSON.parse(restoredList.notificationImmediate).onItemAdded).toBe(true);

    const restoredLog = db.prepare('SELECT * FROM notification_logs WHERE id = ?').get('log-1') as any;
    expect(restoredLog.channelId).toBe('ch-smtp-ops');
    expect(restoredLog.eventSource).toBe('immediate_item_added');
    expect(restoredLog.listId).toBe('list-restock');

    db.close();
  });

  it('omits unimplemented System Event Routing UI controls from NotificationCenterPanel', () => {
    const panelSrc = fs.readFileSync(
      path.resolve(__dirname, '../components/NotificationCenterPanel.tsx'),
      'utf-8',
    );
    expect(panelSrc).not.toContain('System Event Routing');
    expect(panelSrc).not.toContain('pinResetChannelIds');
    expect(panelSrc).not.toContain('systemAlertChannelIds');
    expect(panelSrc).toContain('Digest &amp; Schedules');
  });
});
