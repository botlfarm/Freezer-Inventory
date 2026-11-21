import { ButcherOrder, ButcherRecord } from '../types';
import {
  ButcherOrderStats,
  computeOrderStats,
  normalizeButcherKey,
  normalizeSpeciesKey,
  resolveButcherDisplayName,
} from './butcherStats';

const MS_PER_DAY = 86_400_000;

export interface ParsedCalendarDate {
  iso: string; // Normalized YYYY-MM-DD
  utcMs: number;
  dayNumber: number; // Integer days since Unix epoch in UTC
}

export type ButcherDateWarningCode =
  | 'birth_after_kill'
  | 'pack_before_kill'
  | 'pickup_before_kill'
  | 'pickup_before_last_pack'
  | 'unparseable_date';

export interface ButcherDateWarning {
  code: ButcherDateWarningCode;
  field: 'birthDate' | 'killDate' | 'packDate' | 'pickupDate';
  message: string;
  rawDeltaDays?: number;
}

export interface OrderTimelineMetrics {
  orderId: string;
  orderNumber: string;
  species: string;
  butcherKey: string;
  butcherName: string;
  animalCount: number;

  // Normalized YYYY-MM-DD milestone dates
  birthDate: string | null;
  killDate: string | null;
  firstPackDate: string | null;
  lastPackDate: string | null;
  pickupDate: string | null;

  // Chronological sort key (UTC ms)
  sortTimestamp: number;

  // Core & extended duration metrics (null when missing OR invalid/negative)
  daysAlive: number | null;
  killToFirstPackDays: number | null; // Hang / dry-aging duration
  killToLastPackDays: number | null;
  packageSpanDays: number | null; // Inclusive calendar span (same day = 1)
  distinctPackDays: number | null; // Count of distinct calendar dates with packages
  lastPackToPickupDays: number | null; // Post-pack cold hold duration
  killToPickupDays: number | null; // Total butcher turnaround
  daysSincePreviousHarvest: number | null; // Spacing from previous chronological killDate
  previousHarvestOrderNumber: string | null;

  // Weight / rate efficiency metrics
  liveWeightPerAnimal: number;
  hotWeightPerAnimal: number;
  coldWeightPerAnimal: number;
  packagedWeight: number;
  packagedWeightPerAnimal: number;
  packageCount: number;
  recordsWithPackDateCount: number;

  liveWeightPerDayAlive: number | null; // Live ADG (lbs/day)
  hotWeightPerDayAlive: number | null; // Hot Carcass ADG (lbs/day)
  coldWeightPerDayAlive: number | null; // Cold Carcass ADG (lbs/day)
  packagedWeightPerDayAlive: number | null;
  packagedLbsPerPackDay: number | null; // Packaged lbs per distinct active pack day
  packagesPerPackDay: number | null; // Packages per distinct active pack day

  // Validation & anomaly reporting
  warnings: ButcherDateWarning[];
  hasWarnings: boolean;
}

export interface TimelineMetricSummary {
  count: number;
  avg: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
}

export interface TimelineGroupSummary {
  groupKey: string;
  label: string;
  orderCount: number;
  animalCount: number;
  warningOrderCount: number;
  daysAlive: TimelineMetricSummary;
  killToFirstPackDays: TimelineMetricSummary;
  killToLastPackDays: TimelineMetricSummary;
  packageSpanDays: TimelineMetricSummary;
  distinctPackDays: TimelineMetricSummary;
  lastPackToPickupDays: TimelineMetricSummary;
  killToPickupDays: TimelineMetricSummary;
  liveWeightPerDayAlive: TimelineMetricSummary;
  hotWeightPerDayAlive: TimelineMetricSummary;
  packagedLbsPerPackDay: TimelineMetricSummary;
  packagesPerPackDay: TimelineMetricSummary;
}

export interface ButcherTimelineReport {
  orders: OrderTimelineMetrics[];
  totalOrders: number;
  ordersWithWarnings: OrderTimelineMetrics[];
  summary: {
    daysAlive: TimelineMetricSummary;
    killToFirstPackDays: TimelineMetricSummary;
    killToLastPackDays: TimelineMetricSummary;
    packageSpanDays: TimelineMetricSummary;
    distinctPackDays: TimelineMetricSummary;
    lastPackToPickupDays: TimelineMetricSummary;
    killToPickupDays: TimelineMetricSummary;
    daysSincePreviousHarvest: TimelineMetricSummary;
    liveWeightPerDayAlive: TimelineMetricSummary;
    hotWeightPerDayAlive: TimelineMetricSummary;
    packagedLbsPerPackDay: TimelineMetricSummary;
    packagesPerPackDay: TimelineMetricSummary;
  };
  byButcher: TimelineGroupSummary[];
  bySpecies: TimelineGroupSummary[];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function buildValidatedUtcDate(year: number, month: number, day: number): ParsedCalendarDate | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utcMs = Date.UTC(year, month - 1, day);
  const check = new Date(utcMs);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return {
    iso: `${year}-${pad2(month)}-${pad2(day)}`,
    utcMs,
    dayNumber: Math.floor(utcMs / MS_PER_DAY),
  };
}

/**
 * Parses calendar dates into DST/timezone-safe UTC midnight coordinates.
 * Supports YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, M/D/YYYY, MM-DD-YYYY, and ISO datetime strings.
 */
export function parseCalendarDate(raw?: string | null): ParsedCalendarDate | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // 1. ISO / YYYY-MM-DD or YYYY/MM/DD (optionally followed by T... or space time)
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    return buildValidatedUtcDate(year, month, day);
  }

  // 2. US style MM/DD/YYYY or MM-DD-YYYY (supports 2-digit or 4-digit year, optional trailing time)
  const usMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s.*)?$/);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    const day = parseInt(usMatch[2], 10);
    let year = parseInt(usMatch[3], 10);
    if (usMatch[3].length === 2) {
      year += year >= 70 ? 1900 : 2000;
    }
    return buildValidatedUtcDate(year, month, day);
  }

  // 3. Fallback to Date.parse for natural language dates like "Oct 18, 2026"
  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) return null;
  const d = new Date(parsedMs);
  return buildValidatedUtcDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Computes exact integer calendar day difference (end - start) without DST drift.
 */
export function diffCalendarDays(start: ParsedCalendarDate, end: ParsedCalendarDate): number {
  return end.dayNumber - start.dayNumber;
}

export function formatDaysAsMonths(days: number | null): string {
  if (days === null || !Number.isFinite(days)) return '';
  if (days >= 730) {
    const years = days / 365.25;
    return `${years.toFixed(1)} yr`;
  }
  const months = days / 30.4375;
  return `${months.toFixed(1)} mo`;
}

export function summarizeNumericValues(values: Array<number | null | undefined>): TimelineMetricSummary {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (valid.length === 0) {
    return { count: 0, avg: null, median: null, min: null, max: null };
  }
  const sorted = [...valid].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    count: sorted.length,
    avg: sum / sorted.length,
    median,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Computes all date, duration, daily gain, throughput, and date-anomaly metrics for a single butcher order.
 */
export function computeOrderTimelineMetrics(
  order: ButcherOrder,
  matchingRecords: ButcherRecord[],
  effectiveStats?: ButcherOrderStats,
  locationNameById?: Map<string, string>
): OrderTimelineMetrics {
  const stats = effectiveStats || computeOrderStats(order, matchingRecords);
  const warnings: ButcherDateWarning[] = [];

  const birthRaw = (order.birthDate || '').trim();
  const killRaw = (order.killDate || '').trim();
  const pickupRaw = (order.pickupDate || '').trim();

  const birth = birthRaw ? parseCalendarDate(birthRaw) : null;
  if (birthRaw && !birth) {
    warnings.push({
      code: 'unparseable_date',
      field: 'birthDate',
      message: `Birth date "${birthRaw}" could not be parsed.`,
    });
  }

  const kill = killRaw ? parseCalendarDate(killRaw) : null;
  if (killRaw && !kill) {
    warnings.push({
      code: 'unparseable_date',
      field: 'killDate',
      message: `Kill date "${killRaw}" could not be parsed.`,
    });
  }

  const pickup = pickupRaw ? parseCalendarDate(pickupRaw) : null;
  if (pickupRaw && !pickup) {
    warnings.push({
      code: 'unparseable_date',
      field: 'pickupDate',
      message: `Pickup date "${pickupRaw}" could not be parsed.`,
    });
  }

  // Extract valid pack dates across all cutsheet records
  let firstPack: ParsedCalendarDate | null = null;
  let lastPack: ParsedCalendarDate | null = null;
  const uniquePackDays = new Set<string>();
  let recordsWithPackDateCount = 0;
  let unparseablePackCount = 0;
  let firstUnparseablePackRaw = '';

  for (const rec of matchingRecords) {
    const rawPack = (rec.packDate || '').trim();
    if (!rawPack) continue;
    const parsedPack = parseCalendarDate(rawPack);
    if (!parsedPack) {
      unparseablePackCount++;
      if (!firstUnparseablePackRaw) firstUnparseablePackRaw = rawPack;
      continue;
    }
    recordsWithPackDateCount++;
    uniquePackDays.add(parsedPack.iso);
    if (!firstPack || parsedPack.dayNumber < firstPack.dayNumber) {
      firstPack = parsedPack;
    }
    if (!lastPack || parsedPack.dayNumber > lastPack.dayNumber) {
      lastPack = parsedPack;
    }
  }

  if (unparseablePackCount > 0) {
    warnings.push({
      code: 'unparseable_date',
      field: 'packDate',
      message:
        unparseablePackCount === 1
          ? `1 package has an unreadable pack date ("${firstUnparseablePackRaw}").`
          : `${unparseablePackCount} packages have unreadable pack dates (e.g. "${firstUnparseablePackRaw}").`,
    });
  }

  // 1. Days Alive (Birth -> Kill)
  let daysAlive: number | null = null;
  if (birth && kill) {
    const delta = diffCalendarDays(birth, kill);
    if (delta < 0) {
      warnings.push({
        code: 'birth_after_kill',
        field: 'birthDate',
        rawDeltaDays: delta,
        message: `Birth date (${birth.iso}) is ${Math.abs(delta)}d after kill date (${kill.iso}).`,
      });
    } else {
      daysAlive = delta;
    }
  }

  // 2. Kill -> First Pack (Hang / Dry-Aging Time)
  let killToFirstPackDays: number | null = null;
  if (kill && firstPack) {
    const delta = diffCalendarDays(kill, firstPack);
    if (delta < 0) {
      warnings.push({
        code: 'pack_before_kill',
        field: 'packDate',
        rawDeltaDays: delta,
        message: `First pack date (${firstPack.iso}) is ${Math.abs(delta)}d before kill date (${kill.iso}).`,
      });
    } else {
      killToFirstPackDays = delta;
    }
  }

  // 3. Kill -> Last Pack
  let killToLastPackDays: number | null = null;
  if (kill && lastPack) {
    const delta = diffCalendarDays(kill, lastPack);
    if (delta >= 0) {
      killToLastPackDays = delta;
    } else if (!warnings.some(w => w.code === 'pack_before_kill')) {
      warnings.push({
        code: 'pack_before_kill',
        field: 'packDate',
        rawDeltaDays: delta,
        message: `Last pack date (${lastPack.iso}) is ${Math.abs(delta)}d before kill date (${kill.iso}).`,
      });
    }
  }

  // 4. Total Package Time (Inclusive calendar span: same day = 1, next day = 2) + Distinct Active Pack Days
  const packageSpanDays =
    firstPack && lastPack ? diffCalendarDays(firstPack, lastPack) + 1 : null;
  const distinctPackDays = uniquePackDays.size > 0 ? uniquePackDays.size : null;

  // 5. Post-Pack Hold Time (Last Pack -> Pickup)
  let lastPackToPickupDays: number | null = null;
  if (lastPack && pickup) {
    const delta = diffCalendarDays(lastPack, pickup);
    if (delta < 0) {
      warnings.push({
        code: 'pickup_before_last_pack',
        field: 'pickupDate',
        rawDeltaDays: delta,
        message: `Pickup date (${pickup.iso}) is ${Math.abs(delta)}d before last pack date (${lastPack.iso}).`,
      });
    } else {
      lastPackToPickupDays = delta;
    }
  }

  // 6. Total Butcher Turnaround (Kill -> Pickup)
  let killToPickupDays: number | null = null;
  if (kill && pickup) {
    const delta = diffCalendarDays(kill, pickup);
    if (delta < 0) {
      warnings.push({
        code: 'pickup_before_kill',
        field: 'pickupDate',
        rawDeltaDays: delta,
        message: `Pickup date (${pickup.iso}) is ${Math.abs(delta)}d before kill date (${kill.iso}).`,
      });
    } else {
      killToPickupDays = delta;
    }
  }

  // 7. Weight-per-Day-Alive (ADG) & Packaging Throughput
  const liveWeightPerDayAlive =
    daysAlive !== null && daysAlive > 0 && stats.liveWeightPerAnimal > 0
      ? stats.liveWeightPerAnimal / daysAlive
      : null;
  const hotWeightPerDayAlive =
    daysAlive !== null && daysAlive > 0 && stats.hotWeightPerAnimal > 0
      ? stats.hotWeightPerAnimal / daysAlive
      : null;
  const coldWeightPerDayAlive =
    daysAlive !== null && daysAlive > 0 && stats.coldWeightPerAnimal > 0
      ? stats.coldWeightPerAnimal / daysAlive
      : null;
  const packagedWeightPerDayAlive =
    daysAlive !== null && daysAlive > 0 && stats.packagedWeightPerAnimal > 0
      ? stats.packagedWeightPerAnimal / daysAlive
      : null;

  const packagedLbsPerPackDay =
    distinctPackDays !== null && distinctPackDays > 0 && stats.packagedWeight > 0
      ? stats.packagedWeight / distinctPackDays
      : null;
  const packagesPerPackDay =
    distinctPackDays !== null && distinctPackDays > 0 && stats.count > 0
      ? stats.count / distinctPackDays
      : null;

  const sortTimestamp =
    kill?.utcMs ?? firstPack?.utcMs ?? pickup?.utcMs ?? order.createdAt ?? 0;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber || order.id,
    species: (order.species || 'Unknown').trim() || 'Unknown',
    butcherKey: normalizeButcherKey(order.locationId),
    butcherName: resolveButcherDisplayName(order.locationId, locationNameById),
    animalCount: Math.max(1, order.animalCount || 1),

    birthDate: birth?.iso || null,
    killDate: kill?.iso || null,
    firstPackDate: firstPack?.iso || null,
    lastPackDate: lastPack?.iso || null,
    pickupDate: pickup?.iso || null,

    sortTimestamp,

    daysAlive,
    killToFirstPackDays,
    killToLastPackDays,
    packageSpanDays,
    distinctPackDays,
    lastPackToPickupDays,
    killToPickupDays,
    daysSincePreviousHarvest: null,
    previousHarvestOrderNumber: null,

    liveWeightPerAnimal: stats.liveWeightPerAnimal,
    hotWeightPerAnimal: stats.hotWeightPerAnimal,
    coldWeightPerAnimal: stats.coldWeightPerAnimal,
    packagedWeight: stats.packagedWeight,
    packagedWeightPerAnimal: stats.packagedWeightPerAnimal,
    packageCount: stats.count,
    recordsWithPackDateCount,

    liveWeightPerDayAlive,
    hotWeightPerDayAlive,
    coldWeightPerDayAlive,
    packagedWeightPerDayAlive,
    packagedLbsPerPackDay,
    packagesPerPackDay,

    warnings,
    hasWarnings: warnings.length > 0,
  };
}

function buildGroupSummaries(
  rows: OrderTimelineMetrics[],
  getKeyAndLabel: (row: OrderTimelineMetrics) => { key: string; label: string }
): TimelineGroupSummary[] {
  const buckets = new Map<string, { label: string; rows: OrderTimelineMetrics[] }>();

  for (const row of rows) {
    const { key, label } = getKeyAndLabel(row);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { label, rows: [] };
      buckets.set(key, bucket);
    }
    bucket.rows.push(row);
  }

  return Array.from(buckets.entries())
    .map(([groupKey, bucket]) => {
      const items = bucket.rows;
      return {
        groupKey,
        label: bucket.label,
        orderCount: items.length,
        animalCount: items.reduce((s, r) => s + r.animalCount, 0),
        warningOrderCount: items.filter(r => r.hasWarnings).length,
        daysAlive: summarizeNumericValues(items.map(r => r.daysAlive)),
        killToFirstPackDays: summarizeNumericValues(items.map(r => r.killToFirstPackDays)),
        killToLastPackDays: summarizeNumericValues(items.map(r => r.killToLastPackDays)),
        packageSpanDays: summarizeNumericValues(items.map(r => r.packageSpanDays)),
        distinctPackDays: summarizeNumericValues(items.map(r => r.distinctPackDays)),
        lastPackToPickupDays: summarizeNumericValues(items.map(r => r.lastPackToPickupDays)),
        killToPickupDays: summarizeNumericValues(items.map(r => r.killToPickupDays)),
        liveWeightPerDayAlive: summarizeNumericValues(items.map(r => r.liveWeightPerDayAlive)),
        hotWeightPerDayAlive: summarizeNumericValues(items.map(r => r.hotWeightPerDayAlive)),
        packagedLbsPerPackDay: summarizeNumericValues(items.map(r => r.packagedLbsPerPackDay)),
        packagesPerPackDay: summarizeNumericValues(items.map(r => r.packagesPerPackDay)),
      };
    })
    .sort((a, b) => b.orderCount - a.orderCount || a.label.localeCompare(b.label));
}

export interface TimelineReportOrderInput {
  order: ButcherOrder;
  records: ButcherRecord[];
  stats?: ButcherOrderStats;
}

/**
 * Computes the complete chronological timeline analytics report, cohort summaries,
 * inter-harvest cadence, and Butcher/Species turnaround comparison groups.
 */
export function computeButcherTimelineReport(
  items: TimelineReportOrderInput[],
  locationNameById?: Map<string, string>
): ButcherTimelineReport {
  const computed = items
    .map(item =>
      computeOrderTimelineMetrics(item.order, item.records, item.stats, locationNameById)
    )
    .sort((a, b) => {
      if (a.sortTimestamp !== b.sortTimestamp) return a.sortTimestamp - b.sortTimestamp;
      return a.orderNumber.localeCompare(b.orderNumber, undefined, { numeric: true });
    });

  // Compute chronological inter-harvest cadence (days between consecutive kill dates)
  let prevKillParsed: ParsedCalendarDate | null = null;
  let prevKillOrderNum: string | null = null;
  for (const row of computed) {
    if (row.killDate) {
      const currKill = parseCalendarDate(row.killDate);
      if (currKill) {
        if (prevKillParsed) {
          const gap = diffCalendarDays(prevKillParsed, currKill);
          if (gap >= 0) {
            row.daysSincePreviousHarvest = gap;
            row.previousHarvestOrderNumber = prevKillOrderNum;
          }
        }
        prevKillParsed = currKill;
        prevKillOrderNum = row.orderNumber;
      }
    }
  }

  const summary = {
    daysAlive: summarizeNumericValues(computed.map(r => r.daysAlive)),
    killToFirstPackDays: summarizeNumericValues(computed.map(r => r.killToFirstPackDays)),
    killToLastPackDays: summarizeNumericValues(computed.map(r => r.killToLastPackDays)),
    packageSpanDays: summarizeNumericValues(computed.map(r => r.packageSpanDays)),
    distinctPackDays: summarizeNumericValues(computed.map(r => r.distinctPackDays)),
    lastPackToPickupDays: summarizeNumericValues(computed.map(r => r.lastPackToPickupDays)),
    killToPickupDays: summarizeNumericValues(computed.map(r => r.killToPickupDays)),
    daysSincePreviousHarvest: summarizeNumericValues(computed.map(r => r.daysSincePreviousHarvest)),
    liveWeightPerDayAlive: summarizeNumericValues(computed.map(r => r.liveWeightPerDayAlive)),
    hotWeightPerDayAlive: summarizeNumericValues(computed.map(r => r.hotWeightPerDayAlive)),
    packagedLbsPerPackDay: summarizeNumericValues(computed.map(r => r.packagedLbsPerPackDay)),
    packagesPerPackDay: summarizeNumericValues(computed.map(r => r.packagesPerPackDay)),
  };

  const byButcher = buildGroupSummaries(computed, row => ({
    key: row.butcherKey,
    label: row.butcherName,
  }));

  const bySpecies = buildGroupSummaries(computed, row => ({
    key: normalizeSpeciesKey(row.species),
    label: row.species,
  }));

  return {
    orders: computed,
    totalOrders: computed.length,
    ordersWithWarnings: computed.filter(r => r.hasWarnings),
    summary,
    byButcher,
    bySpecies,
  };
}

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC-4180 CSV export of per-order date & timeline analytics.
 */
export function formatTimelineReportCsv(rows: OrderTimelineMetrics[]): string {
  const headers = [
    'Order Number',
    'Species',
    'Butcher / Processor',
    'Animals',
    'Birth Date',
    'Kill Date',
    'First Pack Date',
    'Last Pack Date',
    'Pickup Date',
    'Days Alive',
    'Live ADG (lbs/day)',
    'Carcass ADG (lbs/day)',
    'Kill to 1st Pack (days)',
    'Kill to Last Pack (days)',
    'Package Span Inclusive (days)',
    'Distinct Active Pack Days',
    'Post-Pack Hold (days)',
    'Kill to Pickup Turnaround (days)',
    'Days Since Prev Harvest',
    'Packaged lbs / Pack Day',
    'Packages / Pack Day',
    'Date Warnings',
  ];

  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const r of rows) {
    const line = [
      r.orderNumber,
      r.species,
      r.butcherName,
      r.animalCount,
      r.birthDate || '',
      r.killDate || '',
      r.firstPackDate || '',
      r.lastPackDate || '',
      r.pickupDate || '',
      r.daysAlive !== null ? r.daysAlive : '',
      r.liveWeightPerDayAlive !== null ? r.liveWeightPerDayAlive.toFixed(2) : '',
      r.hotWeightPerDayAlive !== null ? r.hotWeightPerDayAlive.toFixed(2) : '',
      r.killToFirstPackDays !== null ? r.killToFirstPackDays : '',
      r.killToLastPackDays !== null ? r.killToLastPackDays : '',
      r.packageSpanDays !== null ? r.packageSpanDays : '',
      r.distinctPackDays !== null ? r.distinctPackDays : '',
      r.lastPackToPickupDays !== null ? r.lastPackToPickupDays : '',
      r.killToPickupDays !== null ? r.killToPickupDays : '',
      r.daysSincePreviousHarvest !== null ? r.daysSincePreviousHarvest : '',
      r.packagedLbsPerPackDay !== null ? r.packagedLbsPerPackDay.toFixed(1) : '',
      r.packagesPerPackDay !== null ? r.packagesPerPackDay.toFixed(1) : '',
      r.warnings.map(w => w.message).join(' | '),
    ];
    lines.push(line.map(escapeCsvCell).join(','));
  }

  return lines.join('\n');
}
