import {
  ControlSourceType,
  CustomList,
  CustomListItem,
  InventoryState,
  ListCustomSchedule,
  ListDailyDigestMode,
  NotificationChannel,
  NotificationChannelType,
  NotificationSettings,
  Product,
} from '../types';

export const NOTIFICATION_CHANNEL_TYPE_META: Record<
  NotificationChannelType,
  { label: string; shortLabel: string; description: string }
> = {
  smtp_email: {
    label: 'SMTP Email',
    shortLabel: 'Email',
    description: 'Deliver formatted email notifications via an SMTP server.',
  },
  webhook: {
    label: 'Webhook POST',
    shortLabel: 'Webhook',
    description: 'Send structured JSON payloads to an HTTP endpoint.',
  },
  in_app: {
    label: 'In-App Log',
    shortLabel: 'App Log',
    description: 'Record notifications directly into the Notification Delivery Log.',
  },
};

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getChannelTypeLabel(type: NotificationChannelType | string): string {
  if (type === 'smtp_email') return NOTIFICATION_CHANNEL_TYPE_META.smtp_email.label;
  if (type === 'webhook') return NOTIFICATION_CHANNEL_TYPE_META.webhook.label;
  if (type === 'in_app') return NOTIFICATION_CHANNEL_TYPE_META.in_app.label;
  return String(type || 'Unknown');
}

export function getChannelTargetSummary(channel: NotificationChannel): string {
  const cfg = channel?.config || {};
  if (channel.type === 'smtp_email') {
    const host = cfg.smtpHost ? `${cfg.smtpHost}:${cfg.smtpPort || 587}` : 'No host configured';
    const to = cfg.smtpTo ? ` → ${cfg.smtpTo}` : '';
    return `${host}${to}`;
  }
  if (channel.type === 'webhook') {
    return cfg.webhookUrl ? cfg.webhookUrl : 'No webhook URL configured';
  }
  return 'Records delivery entries in System Delivery Logs';
}

export function normalizeNotificationChannel(raw: any): NotificationChannel {
  const type: NotificationChannelType =
    raw?.type === 'smtp_email' || raw?.type === 'webhook' || raw?.type === 'in_app'
      ? raw.type
      : 'in_app';
  let parsedConfig = raw?.config;
  if (typeof parsedConfig === 'string') {
    try {
      parsedConfig = JSON.parse(parsedConfig);
    } catch {
      parsedConfig = {};
    }
  }
  if (!parsedConfig || typeof parsedConfig !== 'object') {
    parsedConfig = {};
  }

  return {
    id: String(raw?.id || ''),
    name: String(raw?.name || getChannelTypeLabel(type)),
    type,
    enabled: raw?.enabled === undefined ? true : raw.enabled === true || raw.enabled === 1,
    config: {
      ...parsedConfig,
      ...(type === 'smtp_email'
        ? {
            smtpHost: String(parsedConfig.smtpHost || ''),
            smtpPort: Number(parsedConfig.smtpPort) || 587,
            smtpUser: String(parsedConfig.smtpUser || ''),
            smtpPass: String(parsedConfig.smtpPass || ''),
            smtpFrom: String(parsedConfig.smtpFrom || ''),
            smtpTo: String(parsedConfig.smtpTo || ''),
            smtpSecure: Boolean(parsedConfig.smtpSecure),
          }
        : {}),
      ...(type === 'webhook'
        ? {
            webhookUrl: String(parsedConfig.webhookUrl || ''),
          }
        : {}),
    },
    createdAt: raw?.createdAt || undefined,
    updatedAt: raw?.updatedAt || undefined,
    lastTestedAt: raw?.lastTestedAt || undefined,
    lastTestStatus:
      raw?.lastTestStatus === 'success' || raw?.lastTestStatus === 'failed'
        ? raw.lastTestStatus
        : undefined,
  };
}

export function migrateLegacyNotificationData(
  settingsInput: NotificationSettings | undefined,
  existingChannelsInput: NotificationChannel[] | undefined,
  customListsInput: CustomList[] | undefined,
): {
  settings: NotificationSettings;
  channels: NotificationChannel[];
  customLists: CustomList[];
  migrated: boolean;
} {
  let migrated = false;
  const nowIso = new Date().toISOString();

  const settings: NotificationSettings = {
    id: settingsInput?.id || 'global',
    digestEnabled: Boolean(settingsInput?.digestEnabled),
    digestMode: settingsInput?.digestMode || 'combined',
    digestTime: settingsInput?.digestTime || '20:00',
    timezone: settingsInput?.timezone || 'America/New_York',
    method: settingsInput?.method || 'in_app',
    defaultChannelIds: Array.isArray(settingsInput?.defaultChannelIds)
      ? [...settingsInput!.defaultChannelIds!]
      : [],
    systemRoutes: {
      pinResetChannelIds: Array.isArray(settingsInput?.systemRoutes?.pinResetChannelIds)
        ? [...settingsInput!.systemRoutes!.pinResetChannelIds!]
        : [],
      systemAlertChannelIds: Array.isArray(settingsInput?.systemRoutes?.systemAlertChannelIds)
        ? [...settingsInput!.systemRoutes!.systemAlertChannelIds!]
        : [],
    },
    smtpHost: settingsInput?.smtpHost || '',
    smtpPort: Number(settingsInput?.smtpPort) || 587,
    smtpUser: settingsInput?.smtpUser || '',
    smtpPass: settingsInput?.smtpPass || '',
    smtpFrom: settingsInput?.smtpFrom || '',
    smtpTo: settingsInput?.smtpTo || '',
    smtpSecure: Boolean(settingsInput?.smtpSecure),
    webhookUrl: settingsInput?.webhookUrl || '',
    haNotifyService: settingsInput?.haNotifyService || 'notify.notify',
    haUrl: settingsInput?.haUrl || '',
    haToken: settingsInput?.haToken || '',
    lastDigestSentAt: settingsInput?.lastDigestSentAt || '',
  };

  const channels = (existingChannelsInput || []).map(normalizeNotificationChannel).filter((c) => Boolean(c.id));

  if (channels.length === 0) {
    let primaryChannelId: string | null = null;

    if (settings.smtpHost || settings.smtpTo || settings.method === 'smtp_email') {
      const smtpChannel: NotificationChannel = {
        id: 'channel-migrated-smtp',
        name: 'Primary SMTP Email',
        type: 'smtp_email',
        enabled: settings.method === 'smtp_email' || Boolean(settings.smtpHost && settings.smtpTo),
        config: {
          smtpHost: settings.smtpHost || '',
          smtpPort: Number(settings.smtpPort) || 587,
          smtpUser: settings.smtpUser || '',
          smtpPass: settings.smtpPass || '',
          smtpFrom: settings.smtpFrom || '',
          smtpTo: settings.smtpTo || '',
          smtpSecure: Boolean(settings.smtpSecure),
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      channels.push(smtpChannel);
      if (settings.method === 'smtp_email') {
        primaryChannelId = smtpChannel.id;
      }
      migrated = true;
    }

    if (settings.webhookUrl || settings.method === 'webhook') {
      const webhookChannel: NotificationChannel = {
        id: 'channel-migrated-webhook',
        name: 'Primary Webhook',
        type: 'webhook',
        enabled: settings.method === 'webhook' || Boolean(settings.webhookUrl),
        config: {
          webhookUrl: settings.webhookUrl || '',
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      channels.push(webhookChannel);
      if (settings.method === 'webhook') {
        primaryChannelId = webhookChannel.id;
      }
      migrated = true;
    }

    const inAppChannel: NotificationChannel = {
      id: 'channel-default-in-app',
      name: 'System In-App Log',
      type: 'in_app',
      enabled: true,
      config: {},
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    channels.push(inAppChannel);
    if (!primaryChannelId) {
      primaryChannelId = inAppChannel.id;
    }
    migrated = true;

    if (!settings.defaultChannelIds || settings.defaultChannelIds.length === 0) {
      settings.defaultChannelIds = primaryChannelId ? [primaryChannelId] : [];
    }
  }

  const customLists = (customListsInput || []).map((cl) => {
    const next = { ...cl };
    let listChanged = false;

    if (next.notificationEnabled && !next.notificationDailyDigestMode) {
      const hasCustom = Boolean(next.notificationCustomSchedule?.enabled);
      const hasImmediate = Boolean(next.notificationImmediate?.enabled);
      if (!hasCustom && !hasImmediate) {
        next.notificationDailyDigestMode =
          settings.digestMode === 'individual' ? 'separate' : 'combined';
        listChanged = true;
      }
    }

    if (
      next.notificationEnabled &&
      (!Array.isArray(next.notificationChannelIds) || next.notificationChannelIds.length === 0) &&
      settings.defaultChannelIds &&
      settings.defaultChannelIds.length > 0
    ) {
      next.notificationChannelIds = [...settings.defaultChannelIds];
      listChanged = true;
    }

    if (listChanged) migrated = true;
    return next;
  });

  return { settings, channels, customLists, migrated };
}

export function resolveEffectiveDailyDigestMode(list: CustomList): ListDailyDigestMode {
  if (!list.notificationEnabled) return 'none';
  if (
    list.notificationDailyDigestMode === 'none' ||
    list.notificationDailyDigestMode === 'combined' ||
    list.notificationDailyDigestMode === 'separate'
  ) {
    return list.notificationDailyDigestMode;
  }
  const hasCustom = Boolean(list.notificationCustomSchedule?.enabled);
  const hasImmediate = Boolean(list.notificationImmediate?.enabled);
  if (hasCustom || hasImmediate) {
    return 'none';
  }
  return 'combined';
}

export type NotificationTriggerKind = 'digest' | 'custom_schedule' | 'immediate';

export function resolveListChannelIdsForTrigger(
  list: CustomList,
  triggerKind: NotificationTriggerKind,
  settings?: NotificationSettings,
  channels?: NotificationChannel[],
): string[] {
  let candidateIds: string[] = [];

  if (
    triggerKind === 'digest' &&
    Array.isArray(list.notificationDigestChannelIds) &&
    list.notificationDigestChannelIds.length > 0
  ) {
    candidateIds = list.notificationDigestChannelIds;
  } else if (
    triggerKind === 'custom_schedule' &&
    Array.isArray(list.notificationCustomSchedule?.channelIds) &&
    list.notificationCustomSchedule!.channelIds!.length > 0
  ) {
    candidateIds = list.notificationCustomSchedule!.channelIds!;
  } else if (
    triggerKind === 'immediate' &&
    Array.isArray(list.notificationImmediate?.channelIds) &&
    list.notificationImmediate!.channelIds!.length > 0
  ) {
    candidateIds = list.notificationImmediate!.channelIds!;
  } else if (Array.isArray(list.notificationChannelIds) && list.notificationChannelIds.length > 0) {
    candidateIds = list.notificationChannelIds;
  } else if (Array.isArray(settings?.defaultChannelIds) && settings!.defaultChannelIds!.length > 0) {
    candidateIds = settings!.defaultChannelIds!;
  }

  const uniqueIds = Array.from(new Set(candidateIds.filter(Boolean)));
  if (!channels) return uniqueIds;
  const enabledChannelSet = new Set(channels.filter((c) => c.enabled).map((c) => c.id));
  return uniqueIds.filter((id) => enabledChannelSet.has(id));
}

export function getDateAndTimeInTz(
  date: Date,
  timeZone: string,
): {
  dateStr: string;
  totalMinutes: number;
  hour: number;
  minute: number;
  dayOfWeek: number;
} {
  const safeTz = timeZone && timeZone.trim() ? timeZone.trim() : 'America/New_York';
  const computeWithTz = (tz: string) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === 'year')?.value || '1970';
    const month = parts.find((p) => p.type === 'month')?.value || '01';
    const day = parts.find((p) => p.type === 'day')?.value || '01';
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const weekdayStr = (parts.find((p) => p.type === 'weekday')?.value || '').toLowerCase();
    const weekdayMap: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    const dayOfWeek = weekdayMap[weekdayStr.slice(0, 3)] ?? date.getUTCDay();
    return {
      dateStr: `${year}-${month}-${day}`,
      totalMinutes: hour * 60 + minute,
      hour,
      minute,
      dayOfWeek,
    };
  };

  try {
    return computeWithTz(safeTz);
  } catch {
    try {
      return computeWithTz('America/New_York');
    } catch {
      return {
        dateStr: date.toISOString().split('T')[0],
        totalMinutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        dayOfWeek: date.getUTCDay(),
      };
    }
  }
}

export function isCustomScheduleDue(
  schedule: ListCustomSchedule | undefined,
  now: Date,
  timeZone: string,
): boolean {
  if (!schedule || !schedule.enabled) return false;

  if (schedule.cadence === 'interval') {
    const intervalHours = Math.max(1, Number(schedule.intervalHours) || 1);
    const intervalMs = intervalHours * 60 * 60 * 1000;
    if (!schedule.lastSentAt) return true;
    const lastMs = new Date(schedule.lastSentAt).getTime();
    if (isNaN(lastMs)) return true;
    return now.getTime() - lastMs >= intervalMs;
  }

  const currentInfo = getDateAndTimeInTz(now, timeZone);
  const [targetHourStr, targetMinStr] = (schedule.time || '09:00').split(':');
  const targetMinutes = (parseInt(targetHourStr, 10) || 0) * 60 + (parseInt(targetMinStr, 10) || 0);

  let lastSentDateStr = '';
  if (schedule.lastSentAt) {
    const lastDate = new Date(schedule.lastSentAt);
    if (!isNaN(lastDate.getTime())) {
      lastSentDateStr = getDateAndTimeInTz(lastDate, timeZone).dateStr;
    }
  }

  if (currentInfo.dateStr === lastSentDateStr) {
    return false;
  }

  if (schedule.cadence === 'weekly') {
    const allowedDays = Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0
      ? schedule.daysOfWeek
      : [1]; // Monday fallback
    if (!allowedDays.includes(currentInfo.dayOfWeek)) {
      return false;
    }
  }

  return currentInfo.totalMinutes >= targetMinutes;
}

export interface InventoryMetricMaps {
  onsiteCount: Map<string, number>;
  onsiteWeight: Map<string, number>;
  offsiteCount: Map<string, number>;
  offsiteWeight: Map<string, number>;
}

export function buildInventoryMetricMaps(state: Partial<InventoryState>): InventoryMetricMaps {
  const onsiteCount = new Map<string, number>();
  const onsiteWeight = new Map<string, number>();
  const offsiteCount = new Map<string, number>();
  const offsiteWeight = new Map<string, number>();

  for (const mc of state.meatCuts || []) {
    if (!mc.productId) continue;
    const qty = Number(mc.quantity || 0);
    const weight = Number(mc.weight || 0) * (qty || 1);
    onsiteCount.set(mc.productId, (onsiteCount.get(mc.productId) || 0) + qty);
    onsiteWeight.set(mc.productId, (onsiteWeight.get(mc.productId) || 0) + weight);
  }

  const productById = new Map<string, Product>();
  const productByName = new Map<string, Product>();
  const productByNum = new Map<string, Product>();

  for (const p of state.products || []) {
    productById.set(p.id, p);
    if (p.name) productByName.set(p.name.trim().toLowerCase(), p);
    for (const num of p.productNumbers || []) {
      if (num) productByNum.set(String(num).trim().toLowerCase(), p);
    }
  }

  for (const entry of state.offSiteEntries || []) {
    if (entry.archived) continue;
    let matchedProd: Product | undefined;
    if ((entry as any).productId) {
      matchedProd = productById.get((entry as any).productId);
    }
    if (!matchedProd && entry.serial) {
      matchedProd = productByNum.get(String(entry.serial).trim().toLowerCase());
    }
    const rawCut = ((entry as any).normalizedCutName || entry.cuts || entry.originalCutName || '').trim().toLowerCase();
    if (!matchedProd && rawCut) {
      matchedProd = productByName.get(rawCut);
    }
    if (!matchedProd) continue;

    const pieces = Number(entry.pieces || 0);
    const weight = Number(entry.netWeight || 0);
    offsiteCount.set(matchedProd.id, (offsiteCount.get(matchedProd.id) || 0) + pieces);
    offsiteWeight.set(matchedProd.id, (offsiteWeight.get(matchedProd.id) || 0) + weight);
  }

  return { onsiteCount, onsiteWeight, offsiteCount, offsiteWeight };
}

export function getProductMetricValue(
  productId: string,
  controlSource: ControlSourceType | undefined,
  maps: InventoryMetricMaps,
): number {
  const cs = controlSource || 'onsite_count';
  switch (cs) {
    case 'onsite_count':
      return maps.onsiteCount.get(productId) || 0;
    case 'onsite_weight':
      return maps.onsiteWeight.get(productId) || 0;
    case 'offsite_count':
      return maps.offsiteCount.get(productId) || 0;
    case 'offsite_weight':
      return maps.offsiteWeight.get(productId) || 0;
    case 'total_count':
      return (maps.onsiteCount.get(productId) || 0) + (maps.offsiteCount.get(productId) || 0);
    case 'total_weight':
      return (maps.onsiteWeight.get(productId) || 0) + (maps.offsiteWeight.get(productId) || 0);
    default:
      return maps.onsiteCount.get(productId) || 0;
  }
}

export interface ThresholdEvaluationResult {
  breached: boolean;
  currentValue: number;
  thresholdValue: number;
  condition: 'min' | 'max';
  controlSource: ControlSourceType;
}

export function evaluateListItemThreshold(
  list: CustomList,
  item: CustomListItem,
  product: Product | undefined,
  maps: InventoryMetricMaps,
): ThresholdEvaluationResult | null {
  if (!list.isInventoryControlled) return null;
  const thresholdValue =
    item.threshold !== undefined && item.threshold !== null
      ? Number(item.threshold)
      : product?.listThresholds?.[list.id];
  if (thresholdValue === undefined || thresholdValue === null || isNaN(Number(thresholdValue))) {
    return null;
  }

  const controlSource =
    item.controlSource || product?.listControlSources?.[list.id] || 'onsite_count';
  const currentValue = getProductMetricValue(item.productId, controlSource, maps);
  const condition: 'min' | 'max' = list.controlCondition === 'max' ? 'max' : 'min';

  const breached =
    condition === 'max' ? currentValue > Number(thresholdValue) : currentValue < Number(thresholdValue);

  return {
    breached,
    currentValue,
    thresholdValue: Number(thresholdValue),
    condition,
    controlSource,
  };
}

export function detectNewlyBreachedListItems(
  prevState: Partial<InventoryState>,
  nextState: Partial<InventoryState>,
): Array<{
  list: CustomList;
  breaches: Array<{
    item: CustomListItem;
    product?: Product;
    evaluation: ThresholdEvaluationResult;
  }>;
}> {
  const prevMaps = buildInventoryMetricMaps(prevState);
  const nextMaps = buildInventoryMetricMaps(nextState);

  const prevProdMap = new Map<string, Product>((prevState.products || []).map((p) => [p.id, p]));
  const nextProdMap = new Map<string, Product>((nextState.products || []).map((p) => [p.id, p]));
  const prevListMap = new Map<string, CustomList>((prevState.customLists || []).map((l) => [l.id, l]));

  const triggered: Array<{
    list: CustomList;
    breaches: Array<{
      item: CustomListItem;
      product?: Product;
      evaluation: ThresholdEvaluationResult;
    }>;
  }> = [];

  for (const list of nextState.customLists || []) {
    if (!list.notificationEnabled) continue;
    if (!list.notificationImmediate?.enabled || !list.notificationImmediate?.onThresholdBreach) {
      continue;
    }
    if (!list.isInventoryControlled) continue;

    const prevList = prevListMap.get(list.id);
    const breaches: Array<{
      item: CustomListItem;
      product?: Product;
      evaluation: ThresholdEvaluationResult;
    }> = [];

    for (const item of list.items || []) {
      const nextProd = nextProdMap.get(item.productId);
      const nextEval = evaluateListItemThreshold(list, item, nextProd, nextMaps);
      if (!nextEval || !nextEval.breached) continue;

      const prevItem = prevList?.items?.find((i) => i.productId === item.productId);
      const prevProd = prevProdMap.get(item.productId);
      const prevEval =
        prevList && prevItem
          ? evaluateListItemThreshold(prevList, prevItem, prevProd, prevMaps)
          : null;

      // Edge-trigger: notify when transitioning from non-breached (or newly evaluated) into breached,
      // or if the deficit worsened compared to previous breached value.
      const newlyBreached = !prevEval || !prevEval.breached;
      const worsened =
        prevEval &&
        prevEval.breached &&
        (nextEval.condition === 'min'
          ? nextEval.currentValue < prevEval.currentValue
          : nextEval.currentValue > prevEval.currentValue);

      if (newlyBreached || worsened) {
        breaches.push({ item, product: nextProd, evaluation: nextEval });
      }
    }

    if (breaches.length > 0) {
      triggered.push({ list, breaches });
    }
  }

  return triggered;
}

export function formatListItemsReport(
  list: CustomList,
  productsMap: Map<string, Product>,
  state: Partial<InventoryState>,
  maps?: InventoryMetricMaps,
): { text: string; hasItems: boolean; itemsCount: number } {
  const metricMaps = maps || buildInventoryMetricMaps(state);
  let itemsToNotify = [...(list.items || [])];

  if (list.notificationType === 'newly_added_only') {
    const lastNotified = list.lastNotifiedAt ? new Date(list.lastNotifiedAt).getTime() : 0;
    if (lastNotified > 0) {
      itemsToNotify = itemsToNotify.filter((item) => {
        const added = item.addedAt ? new Date(item.addedAt).getTime() : 0;
        return added > lastNotified;
      });
    } else {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      itemsToNotify = itemsToNotify.filter((item) => {
        const added = item.addedAt ? new Date(item.addedAt).getTime() : 0;
        return added > oneDayAgo;
      });
    }
  } else if (list.notificationType === 'item_specific') {
    itemsToNotify = itemsToNotify.filter((item) => item.notifyEnabled);
  } else if (list.notificationType === 'threshold_breaches') {
    itemsToNotify = itemsToNotify.filter((item) => {
      const prod = productsMap.get(item.productId);
      const evalRes = evaluateListItemThreshold(list, item, prod, metricMaps);
      return Boolean(evalRes?.breached);
    });
  }

  if (itemsToNotify.length === 0) {
    return { text: '', hasItems: false, itemsCount: 0 };
  }

  let text = `List: ${list.name}\n`;
  if (list.description) text += `Description: ${list.description}\n`;
  text += `----------------------------------------\n`;

  itemsToNotify.forEach((item, index) => {
    const product = productsMap.get(item.productId);
    const prodName = product ? product.name : 'Unknown Product';
    const cat = product ? product.primaryCategory || 'Uncategorized' : 'N/A';
    const stockQty = metricMaps.onsiteCount.get(item.productId) || 0;
    const evalRes = evaluateListItemThreshold(list, item, product, metricMaps);

    let line = `${index + 1}. ${prodName} (${cat}) | On-Site: ${stockQty}`;
    if (evalRes) {
      const statusTag = evalRes.breached ? ' [BREACHED]' : '';
      line += ` | ${evalRes.condition.toUpperCase()} ${evalRes.thresholdValue} (${evalRes.controlSource}: ${evalRes.currentValue})${statusTag}`;
    }
    text += `${line}\n`;
    if (list.allowNotes && item.notes) {
      text += `   Notes: ${item.notes}\n`;
    }
    text += `\n`;
  });

  return { text, hasItems: true, itemsCount: itemsToNotify.length };
}

export function formatListNotificationSummary(
  list: CustomList,
  channels: NotificationChannel[] = [],
): string {
  if (!list.notificationEnabled) return 'Notifications Off';

  const parts: string[] = [];
  const digestMode = resolveEffectiveDailyDigestMode(list);
  if (digestMode === 'combined') parts.push('Daily Digest (Combined)');
  else if (digestMode === 'separate') parts.push('Daily Digest (Separate)');

  if (list.notificationCustomSchedule?.enabled) {
    const sched = list.notificationCustomSchedule;
    if (sched.cadence === 'daily') parts.push(`Daily @ ${sched.time || '09:00'}`);
    else if (sched.cadence === 'weekly') {
      const days = (sched.daysOfWeek || [1]).map((d) => WEEKDAY_LABELS[d] || '').filter(Boolean).join('/');
      parts.push(`Weekly (${days || 'Mon'} @ ${sched.time || '09:00'})`);
    } else if (sched.cadence === 'interval') {
      parts.push(`Every ${sched.intervalHours || 4}h`);
    }
  }

  if (list.notificationImmediate?.enabled) {
    const immParts: string[] = [];
    if (list.notificationImmediate.onItemAdded) immParts.push('Item Added');
    if (list.notificationImmediate.onThresholdBreach) immParts.push('Threshold');
    if (immParts.length > 0) parts.push(`Immediate (${immParts.join(' + ')})`);
  }

  if (parts.length === 0) parts.push('Enabled (No frequency selected)');

  const channelIds = new Set<string>(list.notificationChannelIds || []);
  (list.notificationDigestChannelIds || []).forEach((id) => channelIds.add(id));
  (list.notificationCustomSchedule?.channelIds || []).forEach((id) => channelIds.add(id));
  (list.notificationImmediate?.channelIds || []).forEach((id) => channelIds.add(id));

  const channelCount = channelIds.size;
  if (channelCount > 0) {
    const names = Array.from(channelIds)
      .map((id) => channels.find((c) => c.id === id)?.name)
      .filter(Boolean);
    const label =
      names.length > 0 && names.length <= 2
        ? names.join(', ')
        : `${channelCount} channel${channelCount === 1 ? '' : 's'}`;
    parts.push(label);
  } else {
    parts.push('Default channel');
  }

  return parts.join(' · ');
}
