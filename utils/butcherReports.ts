import { ButcherOrder, ButcherReportMode } from '../types';
import { ButcherOrderStats } from './butcherStats';
import { ButcherTimelineReport, formatDaysAsMonths } from './butcherTimelines';

export type ButcherReportTypeId =
  | 'yields'
  | 'weights'
  | 'cuts'
  | 'breakdown'
  | 'species'
  | 'timelines';

export type ButcherReportCategoryId =
  | 'performance'
  | 'cuts'
  | 'comparison'
  | 'operations';

export type ButcherReportKpiTone =
  | 'neutral'
  | 'cyan'
  | 'amber'
  | 'rose'
  | 'emerald'
  | 'indigo'
  | 'blue'
  | 'violet';

export interface ButcherReportKpiItem {
  id: string;
  label: string;
  value: string;
  unit?: string;
  subValue?: string;
  tone?: ButcherReportKpiTone;
}

export interface ButcherReportBadge {
  text: string;
  tone?: 'neutral' | 'amber' | 'cyan';
}

export interface ButcherReportOrderPoint {
  order: ButcherOrder;
  stats: ButcherOrderStats;
}

export interface ButcherReportAverages {
  avgLive: number;
  avgHot: number;
  avgCold: number;
  avgPackaged: number;
  avgHotYield: number;
  avgShrink: number;
  avgCutYield: number;
  avgFinishLive: number;
}

export interface ButcherReportSpeciesRow {
  species: string;
  orderCount: number;
  animalCount: number;
  avgLive: number;
  avgHotYield: number;
  avgShrink: number;
  avgCutYield: number;
  avgPackaged: number;
  totalPackaged?: number;
}

export interface ButcherReportBreakdownRow {
  name: string;
  count: number;
  totalPieces: number;
  totalWeight: number;
  productId?: string;
}

export interface ButcherReportCutTrendOrderPoint {
  orderNumber: string;
  weight: number;
  percentage: number;
}

export interface ButcherReportKpiContext {
  orderCount: number;
  animalCount: number;
  reportMode: ButcherReportMode;
  averages: ButcherReportAverages;
  ordersWithStats: ButcherReportOrderPoint[];
  totalPackagedLbs: number;
  cutTrends: {
    selectedCuts: string[];
    mode: 'additive' | 'compare';
    additivePoints: ButcherReportCutTrendOrderPoint[];
  };
  breakdown: {
    allRows: ButcherReportBreakdownRow[];
    filteredRows: ButcherReportBreakdownRow[];
    totalWeightAll: number;
    searchQuery: string;
    totalEstValue: number;
    pricedCutCount: number;
  };
  speciesComparison: ButcherReportSpeciesRow[];
  timelineReport: ButcherTimelineReport;
}

export interface ButcherReportDefinition {
  id: ButcherReportTypeId;
  label: string;
  category: ButcherReportCategoryId;
  testId: string;
  description: string;
  getBadge?: (ctx: ButcherReportKpiContext) => ButcherReportBadge | null;
  buildKpis: (ctx: ButcherReportKpiContext) => ButcherReportKpiItem[];
}

function fmtPctRange(values: number[]): string | undefined {
  if (values.length < 2) return undefined;
  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < min) min = values[i];
    if (values[i] > max) max = values[i];
  }
  return `${min.toFixed(1)}–${max.toFixed(1)}%`;
}

function fmtDaysVal(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return decimals === 0 ? `${Math.round(value)}d` : `${value.toFixed(decimals)}d`;
}

function fmtDayRange(min: number | null, max: number | null): string | undefined {
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  if (Math.round(min) === Math.round(max)) return `${Math.round(min)}d`;
  return `${Math.round(min)}–${Math.round(max)}d`;
}

function fmtWholeLbs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  return Math.round(value).toLocaleString();
}

function fmtCompactLbs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0';
  return value >= 1000 ? `${Math.round(value).toLocaleString()}` : value.toFixed(1);
}

function buildYieldKpis(ctx: ButcherReportKpiContext): ButcherReportKpiItem[] {
  const dressingVals: number[] = [];
  const shrinkVals: number[] = [];
  const cuttingVals: number[] = [];
  const standingVals: number[] = [];

  let bestStanding: { pct: number; orderNumber: string } | null = null;
  let ordersWithAnyYield = 0;

  for (const { order, stats } of ctx.ordersWithStats) {
    let hasYield = false;
    if (stats.liveWeight > 0 && stats.hotWeight > 0 && Number.isFinite(stats.hotWeightYield)) {
      dressingVals.push(stats.hotWeightYield);
      hasYield = true;
    }
    if (stats.hotWeight > 0 && stats.coldWeight > 0 && Number.isFinite(stats.coolerShrinkage)) {
      shrinkVals.push(stats.coolerShrinkage);
      hasYield = true;
    }
    if (stats.coldWeight > 0 && stats.packagedWeight > 0 && Number.isFinite(stats.cuttingYield)) {
      cuttingVals.push(stats.cuttingYield);
      hasYield = true;
    }
    if (stats.liveWeight > 0 && stats.packagedWeight > 0 && Number.isFinite(stats.finishToLiveYield)) {
      standingVals.push(stats.finishToLiveYield);
      hasYield = true;
      if (!bestStanding || stats.finishToLiveYield > bestStanding.pct) {
        bestStanding = { pct: stats.finishToLiveYield, orderNumber: order.orderNumber };
      }
    }
    if (hasYield) ordersWithAnyYield++;
  }

  const dressingRange = fmtPctRange(dressingVals);
  const shrinkRange = fmtPctRange(shrinkVals);
  const cuttingRange = fmtPctRange(cuttingVals);
  const standingRange = fmtPctRange(standingVals);

  return [
    {
      id: 'yield-orders',
      label: 'Orders / Head',
      value: `${ctx.orderCount} / ${ctx.animalCount}`,
      subValue:
        ctx.orderCount > 0
          ? `${ordersWithAnyYield} of ${ctx.orderCount} with yield data`
          : 'No matching orders',
      tone: 'neutral',
    },
    {
      id: 'yield-dressing',
      label: 'Avg Dressing',
      value: ctx.averages.avgHotYield > 0 ? `${ctx.averages.avgHotYield.toFixed(1)}%` : '—',
      subValue: dressingRange ? `Hot/Live · ${dressingRange}` : 'Hot / Live weight',
      tone: 'amber',
    },
    {
      id: 'yield-shrink',
      label: 'Avg Cooler Shrink',
      value: ctx.averages.avgShrink > 0 ? `${ctx.averages.avgShrink.toFixed(1)}%` : '—',
      subValue: shrinkRange ? `Range ${shrinkRange}` : 'Hot → Cold loss',
      tone: 'rose',
    },
    {
      id: 'yield-cutting',
      label: 'Avg Cutting Yield',
      value: ctx.averages.avgCutYield > 0 ? `${ctx.averages.avgCutYield.toFixed(1)}%` : '—',
      subValue: cuttingRange ? `Pkg/Cold · ${cuttingRange}` : 'Packaged / Cold',
      tone: 'emerald',
    },
    {
      id: 'yield-standing',
      label: 'Standing Yield',
      value: ctx.averages.avgFinishLive > 0 ? `${ctx.averages.avgFinishLive.toFixed(1)}%` : '—',
      subValue: standingRange ? `Pkg/Live · ${standingRange}` : 'Packaged / Live',
      tone: 'cyan',
    },
    {
      id: 'yield-best-standing',
      label: 'Top Standing Yield',
      value: bestStanding ? `${bestStanding.pct.toFixed(1)}%` : '—',
      subValue: bestStanding ? `Order #${bestStanding.orderNumber}` : 'Needs live & packaged wt',
      tone: 'indigo',
    },
  ];
}

function buildWeightKpis(ctx: ButcherReportKpiContext): ButcherReportKpiItem[] {
  let totalLive = 0;
  let totalHot = 0;
  let totalCold = 0;
  for (const { stats } of ctx.ordersWithStats) {
    if (stats.liveWeight > 0) totalLive += stats.liveWeight;
    if (stats.hotWeight > 0) totalHot += stats.hotWeight;
    if (stats.coldWeight > 0) totalCold += stats.coldWeight;
  }

  return [
    {
      id: 'weights-orders',
      label: 'Orders / Head',
      value: `${ctx.orderCount} / ${ctx.animalCount}`,
      subValue: 'Per-animal weight basis',
      tone: 'neutral',
    },
    {
      id: 'weights-avg-live',
      label: 'Avg Live / Head',
      value: fmtWholeLbs(ctx.averages.avgLive),
      unit: ctx.averages.avgLive > 0 ? 'lbs' : undefined,
      subValue: totalLive > 0 ? `Total ${fmtCompactLbs(totalLive)} lbs` : 'No live weights',
      tone: 'blue',
    },
    {
      id: 'weights-avg-hot',
      label: 'Avg Hot / Head',
      value: fmtWholeLbs(ctx.averages.avgHot),
      unit: ctx.averages.avgHot > 0 ? 'lbs' : undefined,
      subValue: totalHot > 0 ? `Total ${fmtCompactLbs(totalHot)} lbs` : 'No hot weights',
      tone: 'amber',
    },
    {
      id: 'weights-avg-cold',
      label: 'Avg Cold / Head',
      value: fmtWholeLbs(ctx.averages.avgCold),
      unit: ctx.averages.avgCold > 0 ? 'lbs' : undefined,
      subValue: totalCold > 0 ? `Total ${fmtCompactLbs(totalCold)} lbs` : 'No cold weights',
      tone: 'indigo',
    },
    {
      id: 'weights-avg-packaged',
      label: 'Avg Pkg / Head',
      value: fmtWholeLbs(ctx.averages.avgPackaged),
      unit: ctx.averages.avgPackaged > 0 ? 'lbs' : undefined,
      subValue: 'Take-home meat / animal',
      tone: 'cyan',
    },
    {
      id: 'weights-total-packaged',
      label: 'Total Packaged',
      value: fmtCompactLbs(ctx.totalPackagedLbs),
      unit: 'lbs',
      subValue: `Across ${ctx.orderCount} ${ctx.orderCount === 1 ? 'order' : 'orders'}`,
      tone: 'emerald',
    },
  ];
}

function buildCutTrendKpis(ctx: ButcherReportKpiContext): ButcherReportKpiItem[] {
  const { selectedCuts, mode, additivePoints } = ctx.cutTrends;
  const totalSelectedLbs = additivePoints.reduce((s, p) => s + p.weight, 0);
  const ordersWithCut = additivePoints.filter(p => p.weight > 0).length;
  const shareOfPackaged =
    ctx.totalPackagedLbs > 0 ? (totalSelectedLbs / ctx.totalPackagedLbs) * 100 : 0;
  const avgLbsPerOrder = additivePoints.length > 0 ? totalSelectedLbs / additivePoints.length : 0;
  const avgPctPerOrder =
    additivePoints.length > 0
      ? additivePoints.reduce((s, p) => s + p.percentage, 0) / additivePoints.length
      : 0;
  const avgLbsPerHead = ctx.animalCount > 0 ? totalSelectedLbs / ctx.animalCount : 0;

  let peakPoint: ButcherReportCutTrendOrderPoint | null = null;
  for (const pt of additivePoints) {
    if (pt.weight > 0 && (!peakPoint || pt.percentage > peakPoint.percentage)) {
      peakPoint = pt;
    }
  }

  return [
    {
      id: 'cuts-tracked',
      label: 'Tracked Cuts',
      value: String(selectedCuts.length),
      subValue:
        selectedCuts.length === 0
          ? 'Select cuts below'
          : mode === 'additive'
            ? 'Additive combined mode'
            : 'Side-by-side compare',
      tone: 'cyan',
    },
    {
      id: 'cuts-total-weight',
      label: 'Selected Weight',
      value: selectedCuts.length > 0 ? fmtCompactLbs(totalSelectedLbs) : '—',
      unit: selectedCuts.length > 0 ? 'lbs' : undefined,
      subValue: `${ordersWithCut} / ${ctx.orderCount} orders include cut`,
      tone: 'cyan',
    },
    {
      id: 'cuts-share',
      label: 'Share of Packaged',
      value: selectedCuts.length > 0 && ctx.totalPackagedLbs > 0 ? `${shareOfPackaged.toFixed(1)}%` : '—',
      subValue:
        ctx.totalPackagedLbs > 0
          ? `Of ${fmtCompactLbs(ctx.totalPackagedLbs)} lbs total`
          : 'No packaged weight',
      tone: 'emerald',
    },
    {
      id: 'cuts-avg-order',
      label: 'Avg / Order',
      value: selectedCuts.length > 0 && additivePoints.length > 0 ? avgLbsPerOrder.toFixed(1) : '—',
      unit: selectedCuts.length > 0 && additivePoints.length > 0 ? 'lbs' : undefined,
      subValue:
        selectedCuts.length > 0 && additivePoints.length > 0
          ? `${avgPctPerOrder.toFixed(1)}% avg order share`
          : 'No matching orders',
      tone: 'amber',
    },
    {
      id: 'cuts-peak-order',
      label: 'Peak Order Share',
      value: peakPoint ? `${peakPoint.percentage.toFixed(1)}%` : '—',
      subValue: peakPoint
        ? `Order #${peakPoint.orderNumber} · ${peakPoint.weight.toFixed(1)} lbs`
        : 'No matching cut data',
      tone: 'indigo',
    },
    {
      id: 'cuts-avg-head',
      label: 'Avg / Head',
      value: selectedCuts.length > 0 && ctx.animalCount > 0 ? avgLbsPerHead.toFixed(1) : '—',
      unit: selectedCuts.length > 0 && ctx.animalCount > 0 ? 'lbs' : undefined,
      subValue: `Across ${ctx.animalCount} head`,
      tone: 'neutral',
    },
  ];
}

function buildBreakdownKpis(ctx: ButcherReportKpiContext): ButcherReportKpiItem[] {
  const { allRows, filteredRows, totalWeightAll, searchQuery, totalEstValue, pricedCutCount } =
    ctx.breakdown;
  const isSearching = searchQuery.trim().length > 0;

  let totalPackages = 0;
  let totalPieces = 0;
  let totalWeight = 0;
  for (const row of filteredRows) {
    totalPackages += row.count;
    totalPieces += row.totalPieces;
    totalWeight += row.totalWeight;
  }

  const topCut = filteredRows[0] || null;
  const topCutShare =
    topCut && totalWeightAll > 0 ? (topCut.totalWeight / totalWeightAll) * 100 : 0;
  const visibleShare = totalWeightAll > 0 ? (totalWeight / totalWeightAll) * 100 : 0;

  return [
    {
      id: 'breakdown-unique-cuts',
      label: 'Unique Cuts',
      value: isSearching ? `${filteredRows.length} / ${allRows.length}` : String(allRows.length),
      subValue: isSearching ? 'Matching search query' : 'Distinct cut types',
      tone: 'neutral',
    },
    {
      id: 'breakdown-packages',
      label: 'Total Packages',
      value: totalPackages.toLocaleString(),
      subValue: `Across ${ctx.orderCount} ${ctx.orderCount === 1 ? 'order' : 'orders'}`,
      tone: 'neutral',
    },
    {
      id: 'breakdown-pieces',
      label: 'Total Pieces',
      value: totalPieces.toLocaleString(),
      subValue:
        totalPackages > 0 ? `${(totalPieces / totalPackages).toFixed(1)} pcs / pkg avg` : 'Individual pieces',
      tone: 'neutral',
    },
    {
      id: 'breakdown-weight',
      label: 'Total Net Weight',
      value: fmtCompactLbs(totalWeight),
      unit: 'lbs',
      subValue: isSearching ? `${visibleShare.toFixed(1)}% of all filtered cuts` : 'Packaged cut weight',
      tone: 'cyan',
    },
    {
      id: 'breakdown-top-cut',
      label: 'Top Cut by Weight',
      value: topCut ? topCut.name : '—',
      subValue: topCut
        ? `${topCut.totalWeight.toFixed(1)} lbs · ${topCutShare.toFixed(1)}%`
        : 'No cuts in view',
      tone: 'amber',
    },
    {
      id: 'breakdown-est-value',
      label: 'Est. Sales Value',
      value: totalEstValue > 0 ? `$${totalEstValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
      subValue:
        filteredRows.length > 0
          ? `${pricedCutCount} / ${filteredRows.length} cuts priced`
          : 'Set product prices to estimate',
      tone: 'emerald',
    },
  ];
}

function buildSpeciesKpis(ctx: ButcherReportKpiContext): ButcherReportKpiItem[] {
  const rows = ctx.speciesComparison;

  let topVolume: ButcherReportSpeciesRow | null = null;
  let bestDressing: ButcherReportSpeciesRow | null = null;
  let bestCutting: ButcherReportSpeciesRow | null = null;
  let lowestShrink: ButcherReportSpeciesRow | null = null;
  let heaviestLive: ButcherReportSpeciesRow | null = null;

  for (const row of rows) {
    const vol = row.totalPackaged ?? row.avgPackaged * row.animalCount;
    const topVol = topVolume ? (topVolume.totalPackaged ?? topVolume.avgPackaged * topVolume.animalCount) : -1;
    if (vol > topVol && (vol > 0 || !topVolume)) {
      topVolume = row;
    }
    if (row.avgHotYield > 0 && (!bestDressing || row.avgHotYield > bestDressing.avgHotYield)) {
      bestDressing = row;
    }
    if (row.avgCutYield > 0 && (!bestCutting || row.avgCutYield > bestCutting.avgCutYield)) {
      bestCutting = row;
    }
    if (row.avgShrink > 0 && (!lowestShrink || row.avgShrink < lowestShrink.avgShrink)) {
      lowestShrink = row;
    }
    if (row.avgLive > 0 && (!heaviestLive || row.avgLive > heaviestLive.avgLive)) {
      heaviestLive = row;
    }
  }

  const topVolumeLbs = topVolume
    ? topVolume.totalPackaged ?? topVolume.avgPackaged * topVolume.animalCount
    : 0;

  return [
    {
      id: 'species-count',
      label: 'Species Tracked',
      value: String(rows.length),
      subValue: `${ctx.orderCount} orders · ${ctx.animalCount} head`,
      tone: 'cyan',
    },
    {
      id: 'species-top-volume',
      label: 'Top Volume Species',
      value: topVolume ? topVolume.species : '—',
      subValue: topVolume
        ? `${fmtCompactLbs(topVolumeLbs)} lbs · ${topVolume.orderCount} ord`
        : 'No species data',
      tone: 'emerald',
    },
    {
      id: 'species-best-dressing',
      label: 'Highest Dressing',
      value: bestDressing ? bestDressing.species : '—',
      subValue: bestDressing ? `${bestDressing.avgHotYield.toFixed(1)}% avg dressing` : 'No dressing data',
      tone: 'amber',
    },
    {
      id: 'species-best-cutting',
      label: 'Highest Cutting',
      value: bestCutting ? bestCutting.species : '—',
      subValue: bestCutting ? `${bestCutting.avgCutYield.toFixed(1)}% avg cutting` : 'No cutting data',
      tone: 'indigo',
    },
    {
      id: 'species-lowest-shrink',
      label: 'Lowest Shrink',
      value: lowestShrink ? lowestShrink.species : '—',
      subValue: lowestShrink ? `${lowestShrink.avgShrink.toFixed(1)}% avg shrink` : 'No shrink data',
      tone: 'rose',
    },
    {
      id: 'species-heaviest-live',
      label: 'Heaviest Avg Live',
      value: heaviestLive ? heaviestLive.species : '—',
      subValue: heaviestLive ? `${Math.round(heaviestLive.avgLive).toLocaleString()} lbs / head` : 'No live weights',
      tone: 'blue',
    },
  ];
}

function buildTimelineKpis(ctx: ButcherReportKpiContext): ButcherReportKpiItem[] {
  const { timelineReport } = ctx;
  const { summary, orders, ordersWithWarnings, totalOrders } = timelineReport;

  const datedKillOrPickup = orders
    .map(r => r.killDate || r.pickupDate || r.firstPackDate || null)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => a.localeCompare(b));

  const earliestDate = datedKillOrPickup[0] || null;
  const latestDate = datedKillOrPickup[datedKillOrPickup.length - 1] || null;
  const dateSpanValue =
    earliestDate && latestDate
      ? earliestDate === latestDate
        ? earliestDate
        : `${earliestDate.slice(0, 7)} → ${latestDate.slice(0, 7)}`
      : '—';

  const hangRange = fmtDayRange(summary.killToFirstPackDays.min, summary.killToFirstPackDays.max);
  const packRange = fmtDayRange(summary.packageSpanDays.min, summary.packageSpanDays.max);
  const holdRange = fmtDayRange(summary.lastPackToPickupDays.min, summary.lastPackToPickupDays.max);
  const turnaroundRange = fmtDayRange(summary.killToPickupDays.min, summary.killToPickupDays.max);

  return [
    {
      id: 'timeline-date-span',
      label: 'Date Span',
      value: dateSpanValue,
      subValue:
        ordersWithWarnings.length > 0
          ? `${totalOrders} orders · ${ordersWithWarnings.length} date ${ordersWithWarnings.length === 1 ? 'warning' : 'warnings'}`
          : `${totalOrders} orders · All dates valid`,
      tone: ordersWithWarnings.length > 0 ? 'amber' : 'neutral',
    },
    {
      id: 'timeline-days-alive',
      label: 'Avg Days Alive',
      value: fmtDaysVal(summary.daysAlive.avg, 0),
      subValue:
        summary.daysAlive.avg !== null
          ? `${formatDaysAsMonths(summary.daysAlive.avg)} · n=${summary.daysAlive.count}/${totalOrders}`
          : 'Add birth & kill dates',
      tone: 'emerald',
    },
    {
      id: 'timeline-hang-time',
      label: 'Avg Hang Time',
      value: fmtDaysVal(summary.killToFirstPackDays.avg, 1),
      subValue: hangRange
        ? `Kill → 1st Pack · ${hangRange}`
        : 'Needs kill & pack dates',
      tone: 'amber',
    },
    {
      id: 'timeline-pack-time',
      label: 'Avg Package Span',
      value: fmtDaysVal(summary.packageSpanDays.avg, 1),
      subValue:
        summary.distinctPackDays.avg !== null
          ? `${summary.distinctPackDays.avg.toFixed(1)} active d${packRange ? ` · ${packRange}` : ''}`
          : 'Needs pack dates',
      tone: 'violet',
    },
    {
      id: 'timeline-post-pack-hold',
      label: 'Post-Pack Hold',
      value: fmtDaysVal(summary.lastPackToPickupDays.avg, 1),
      subValue: holdRange
        ? `Last → Pickup · ${holdRange}`
        : 'Needs pack & pickup dates',
      tone: 'rose',
    },
    {
      id: 'timeline-turnaround',
      label: 'Avg Turnaround',
      value: fmtDaysVal(summary.killToPickupDays.avg, 1),
      subValue: turnaroundRange
        ? `Kill → Pickup · ${turnaroundRange}`
        : 'Needs kill & pickup dates',
      tone: 'cyan',
    },
  ];
}

/**
 * Declarative registry of all Butcher Reports.
 * Adding a new report type only requires registering a definition here
 * (with its own contextual KPI builder) and adding its view renderer.
 */
export const BUTCHER_REPORT_DEFINITIONS: readonly ButcherReportDefinition[] = [
  {
    id: 'yields',
    label: 'Yield Trends',
    category: 'performance',
    testId: 'butcher-reports-yields-tab',
    description: 'Dressing, cooler shrink, cutting, and standing yields across orders.',
    buildKpis: buildYieldKpis,
  },
  {
    id: 'weights',
    label: 'Weights Timeline',
    category: 'performance',
    testId: 'butcher-reports-weights-tab',
    description: 'Per-animal live, hot carcass, cold carcass, and packaged weight trends.',
    buildKpis: buildWeightKpis,
  },
  {
    id: 'cuts',
    label: 'Cuts Over Time',
    category: 'cuts',
    testId: 'butcher-reports-cuts-tab',
    description: 'Track individual or combined cut weights and share percentages across harvests.',
    buildKpis: buildCutTrendKpis,
  },
  {
    id: 'breakdown',
    label: 'Cut Breakdown',
    category: 'cuts',
    testId: 'butcher-reports-breakdown-tab',
    description: 'Aggregated cut spreadsheet with package counts, share, and estimated sales value.',
    getBadge: (ctx) =>
      ctx.breakdown.allRows.length > 0
        ? { text: String(ctx.breakdown.allRows.length), tone: 'neutral' }
        : null,
    buildKpis: buildBreakdownKpis,
  },
  {
    id: 'species',
    label: 'Species Comparison',
    category: 'comparison',
    testId: 'butcher-reports-species-tab',
    description: 'Compare dressing, shrink, cutting yield, and weights across species.',
    buildKpis: buildSpeciesKpis,
  },
  {
    id: 'timelines',
    label: 'Timelines & Dates',
    category: 'operations',
    testId: 'butcher-reports-timelines-tab',
    description: 'Harvest age, hang time, packing pace, post-pack hold, and total turnaround.',
    getBadge: (ctx) =>
      ctx.timelineReport.ordersWithWarnings.length > 0
        ? { text: String(ctx.timelineReport.ordersWithWarnings.length), tone: 'amber' }
        : null,
    buildKpis: buildTimelineKpis,
  },
];

export function getButcherReportDefinition(id: ButcherReportTypeId): ButcherReportDefinition {
  return BUTCHER_REPORT_DEFINITIONS.find(def => def.id === id) || BUTCHER_REPORT_DEFINITIONS[0];
}

export function buildButcherReportKpis(
  id: ButcherReportTypeId,
  ctx: ButcherReportKpiContext,
): ButcherReportKpiItem[] {
  return getButcherReportDefinition(id).buildKpis(ctx);
}

export function getKpiGridColumnsClass(itemCount: number): string {
  if (itemCount <= 3) return 'grid-cols-1 sm:grid-cols-3';
  if (itemCount === 4) return 'grid-cols-2 lg:grid-cols-4';
  if (itemCount === 5) return 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5';
  if (itemCount === 6) return 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6';
  return 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-8';
}
