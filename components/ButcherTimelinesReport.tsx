import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarClock,
  Download,
  Edit3,
  Clock,
} from 'lucide-react';
import { ButcherOrder, ButcherReportMode } from '../types';
import {
  ButcherTimelineReport,
  OrderTimelineMetrics,
  formatDaysAsMonths,
  formatTimelineReportCsv,
} from '../utils/butcherTimelines';

type TimelineChartMode = 'durations' | 'lifecycle' | 'age_adg';
type DurationSeriesKey =
  | 'killToPickupDays'
  | 'killToLastPackDays'
  | 'killToFirstPackDays'
  | 'lastPackToPickupDays'
  | 'packageSpanDays';

type TimelineSortKey =
  | 'orderNumber'
  | 'killDate'
  | 'daysAlive'
  | 'killToFirstPackDays'
  | 'killToLastPackDays'
  | 'packageSpanDays'
  | 'lastPackToPickupDays'
  | 'killToPickupDays'
  | 'packagedLbsPerPackDay'
  | 'daysSincePreviousHarvest';

interface DurationSeriesMeta {
  key: DurationSeriesKey;
  label: string;
  shortLabel: string;
  color: string;
}

const DURATION_SERIES: DurationSeriesMeta[] = [
  {
    key: 'killToPickupDays',
    label: 'Turnaround (Kill → Pickup)',
    shortLabel: 'Turnaround',
    color: '#22d3ee',
  },
  {
    key: 'killToLastPackDays',
    label: 'Kill → Last Pack',
    shortLabel: 'Kill → Last',
    color: '#8b5cf6',
  },
  {
    key: 'killToFirstPackDays',
    label: 'Hang Time (Kill → 1st Pack)',
    shortLabel: 'Hang',
    color: '#f59e0b',
  },
  {
    key: 'lastPackToPickupDays',
    label: 'Post-Pack Hold (Last → Pickup)',
    shortLabel: 'Hold',
    color: '#f43f5e',
  },
  {
    key: 'packageSpanDays',
    label: 'Package Span (Inclusive)',
    shortLabel: 'Pack Span',
    color: '#10b981',
  },
];

function fmtDays(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return decimals === 0 ? `${Math.round(value)}d` : `${value.toFixed(decimals)}d`;
}

function fmtRange(min: number | null, max: number | null): string {
  if (min === null || max === null) return 'No valid dates';
  if (min === max) return `${Math.round(min)}d`;
  return `${Math.round(min)}–${Math.round(max)}d`;
}

function buildSegmentedPath(points: Array<{ x: number; y: number | null }>): string {
  let d = '';
  let inSegment = false;
  for (const pt of points) {
    if (pt.y === null || !Number.isFinite(pt.y)) {
      inSegment = false;
      continue;
    }
    d += `${inSegment ? ' L ' : (d ? ' M ' : 'M ')}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    inSegment = true;
  }
  return d;
}

export interface ButcherTimelinesReportProps {
  report: ButcherTimelineReport;
  ordersById: Map<string, ButcherOrder>;
  onEditOrder: (order: ButcherOrder) => void;
  reportMode: ButcherReportMode;
  hideSummaryKpis?: boolean;
}

export const ButcherTimelinesReport: React.FC<ButcherTimelinesReportProps> = ({
  report,
  ordersById,
  onEditOrder,
  reportMode,
  hideSummaryKpis = false,
}) => {
  const [chartMode, setChartMode] = useState<TimelineChartMode>('durations');
  const [visibleSeries, setVisibleSeries] = useState<Record<DurationSeriesKey, boolean>>({
    killToPickupDays: true,
    killToLastPackDays: true,
    killToFirstPackDays: true,
    lastPackToPickupDays: true,
    packageSpanDays: false,
  });
  const [groupBy, setGroupBy] = useState<'butcher' | 'species'>('butcher');
  const [sortKey, setSortKey] = useState<TimelineSortKey>('killDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [warningsExpanded, setWarningsExpanded] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const toggleSeries = (key: DurationSeriesKey) => {
    setVisibleSeries(prev => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount <= 1) return prev; // Keep at least one curve visible
      return { ...prev, [key]: !prev[key] };
    });
  };

  const handleSort = (key: TimelineSortKey) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'orderNumber' ? 'asc' : 'desc');
    }
  };

  const handleExportCsv = () => {
    const csv = formatTimelineReportCsv(sortedTableRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `butcher-timelines-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sortedTableRows = useMemo(() => {
    const base = warningsOnly
      ? report.orders.filter(r => r.hasWarnings)
      : report.orders;

    const compareNullableNum = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return sortDir === 'asc' ? a - b : b - a;
    };

    const compareNullableStr = (a: string | null, b: string | null) => {
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    };

    return [...base].sort((a, b) => {
      switch (sortKey) {
        case 'orderNumber':
          return compareNullableStr(a.orderNumber, b.orderNumber);
        case 'killDate':
          return compareNullableStr(a.killDate, b.killDate);
        case 'daysAlive':
          return compareNullableNum(a.daysAlive, b.daysAlive);
        case 'killToFirstPackDays':
          return compareNullableNum(a.killToFirstPackDays, b.killToFirstPackDays);
        case 'killToLastPackDays':
          return compareNullableNum(a.killToLastPackDays, b.killToLastPackDays);
        case 'packageSpanDays':
          return compareNullableNum(a.packageSpanDays, b.packageSpanDays);
        case 'lastPackToPickupDays':
          return compareNullableNum(a.lastPackToPickupDays, b.lastPackToPickupDays);
        case 'killToPickupDays':
          return compareNullableNum(a.killToPickupDays, b.killToPickupDays);
        case 'packagedLbsPerPackDay':
          return compareNullableNum(a.packagedLbsPerPackDay, b.packagedLbsPerPackDay);
        case 'daysSincePreviousHarvest':
          return compareNullableNum(a.daysSincePreviousHarvest, b.daysSincePreviousHarvest);
        default:
          return 0;
      }
    });
  }, [report.orders, warningsOnly, sortKey, sortDir]);

  // SVG chart geometry (640x260)
  const SVG_W = 640;
  const SVG_H = 260;
  const PAD_L = 48;
  const PAD_R = 46;
  const PAD_T = 20;
  const PAD_B = 38;
  const PLOT_W = SVG_W - PAD_L - PAD_R;
  const PLOT_H = SVG_H - PAD_T - PAD_B;

  const chronologicalRows = report.orders;
  const pointCount = chronologicalRows.length;

  const getX = (idx: number) =>
    PAD_L + (pointCount > 1 ? (idx / (pointCount - 1)) * PLOT_W : PLOT_W / 2);

  // 1. Durations Trend scale
  const activeSeriesList = DURATION_SERIES.filter(s => visibleSeries[s.key]);
  const maxDurationValue = useMemo(() => {
    let maxVal = 0;
    for (const row of chronologicalRows) {
      for (const s of activeSeriesList) {
        const v = row[s.key];
        if (v !== null && v > maxVal) maxVal = v;
      }
    }
    return Math.max(5, Math.ceil((maxVal * 1.15) / 5) * 5);
  }, [chronologicalRows, activeSeriesList]);

  const hasAnyDurationData = useMemo(
    () => chronologicalRows.some(r => activeSeriesList.some(s => r[s.key] !== null)),
    [chronologicalRows, activeSeriesList]
  );

  // 2. Lifecycle Phase Breakdown data
  const lifecycleBars = useMemo(() => {
    return chronologicalRows.map((row, idx) => {
      const hang = row.killToFirstPackDays ?? 0;
      // Elapsed packing portion between 1st and last pack so Hang + Pack + Hold sums cleanly to Kill->Pickup
      const packElapsed =
        row.killToFirstPackDays !== null && row.killToLastPackDays !== null
          ? Math.max(0, row.killToLastPackDays - row.killToFirstPackDays)
          : row.packageSpanDays !== null
            ? Math.max(0, row.packageSpanDays - 1)
            : 0;
      const hold = row.lastPackToPickupDays ?? 0;
      const stackedTotal = hang + packElapsed + hold;
      const totalTurnaround = row.killToPickupDays ?? null;
      const hasPhases =
        row.killToFirstPackDays !== null ||
        row.packageSpanDays !== null ||
        row.lastPackToPickupDays !== null ||
        totalTurnaround !== null;
      return {
        row,
        idx,
        hang,
        packElapsed,
        hold,
        stackedTotal,
        totalTurnaround,
        maxBarValue: Math.max(stackedTotal, totalTurnaround ?? 0),
        hasPhases,
      };
    });
  }, [chronologicalRows]);

  const maxLifecycleDays = useMemo(() => {
    const m = Math.max(...lifecycleBars.map(b => b.maxBarValue), 0);
    return Math.max(5, Math.ceil((m * 1.15) / 5) * 5);
  }, [lifecycleBars]);

  const hasAnyLifecycleData = lifecycleBars.some(b => b.hasPhases);

  // 3. Age & Daily Gain scale
  const maxDaysAlive = useMemo(() => {
    const m = Math.max(...chronologicalRows.map(r => r.daysAlive ?? 0), 0);
    return Math.max(100, Math.ceil((m * 1.15) / 50) * 50);
  }, [chronologicalRows]);

  const maxAdg = useMemo(() => {
    const m = Math.max(
      ...chronologicalRows.map(r =>
        Math.max(r.liveWeightPerDayAlive ?? 0, r.hotWeightPerDayAlive ?? 0)
      ),
      0
    );
    return Math.max(1, Math.ceil((m * 1.2) * 2) / 2);
  }, [chronologicalRows]);

  const hasAnyAgeData = chronologicalRows.some(r => r.daysAlive !== null);

  const comparisonGroups = groupBy === 'butcher' ? report.byButcher : report.bySpecies;
  const { summary } = report;

  const renderSortIcon = (key: TimelineSortKey) => {
    if (sortKey !== key) return <ArrowUpDown size={12} className="inline ml-1 opacity-40" />;
    return sortDir === 'asc' ? (
      <ArrowUp size={12} className="inline ml-1 text-cyan-400" />
    ) : (
      <ArrowDown size={12} className="inline ml-1 text-cyan-400" />
    );
  };

  return (
    <div id="butcher-timelines-report" className="space-y-6">
      {/* 1. Date Warnings Banner */}
      {report.ordersWithWarnings.length > 0 && (
        <div
          data-testid="butcher-date-warnings-banner"
          className="bg-cool-gray-900 border border-amber-500/40 rounded-2xl p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-300">
                  Date Warnings on {report.ordersWithWarnings.length}{' '}
                  {report.ordersWithWarnings.length === 1 ? 'Order' : 'Orders'}
                </h4>
                <p className="text-xs text-cool-gray-400 mt-0.5">
                  Out-of-order or unreadable date intervals are automatically excluded from averages,
                  charts, and processor rankings so typos do not distort trends.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWarningsExpanded(prev => !prev)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-200 border border-cool-gray-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {warningsExpanded ? 'Hide Details' : `Show Details (${report.ordersWithWarnings.length})`}
            </button>
          </div>

          {warningsExpanded && (
            <div className="divide-y divide-cool-gray-800 border-t border-cool-gray-800 pt-2">
              {report.ordersWithWarnings.map(row => {
                const fullOrder = ordersById.get(row.orderId);
                return (
                  <div
                    key={row.orderId}
                    className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 text-cool-gray-200 font-semibold">
                        <span className="font-mono font-bold text-white">Order #{row.orderNumber}</span>
                        <span className="text-cool-gray-500" aria-hidden="true">·</span>
                        <span>{row.species}</span>
                        <span className="text-cool-gray-500" aria-hidden="true">·</span>
                        <span className="text-cool-gray-400">{row.butcherName}</span>
                      </div>
                      <ul className="space-y-0.5 text-amber-300/90">
                        {row.warnings.map((w, wIdx) => (
                          <li key={`${w.code}-${wIdx}`}>{w.message}</li>
                        ))}
                      </ul>
                    </div>
                    {fullOrder && (
                      <button
                        type="button"
                        onClick={() => onEditOrder(fullOrder)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cool-gray-800 hover:bg-cool-gray-700 text-cyan-400 border border-cool-gray-700 self-start sm:self-center whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Edit3 size={12} />
                        <span>Edit Order</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Time & Pacing Summary KPI Strip (shown standalone; hidden when parent Reports dashboard renders contextual KPIs) */}
      {!hideSummaryKpis && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl">
          <div className="text-xs font-semibold text-cool-gray-400">Avg Days Alive</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
              {fmtDays(summary.daysAlive.avg, 0)}
            </span>
            {summary.daysAlive.avg !== null && (
              <span className="text-xs font-mono tabular-nums text-cool-gray-400">
                {formatDaysAsMonths(summary.daysAlive.avg)}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-cool-gray-500 font-mono tabular-nums">
            {summary.daysAlive.count > 0
              ? `${fmtRange(summary.daysAlive.min, summary.daysAlive.max)} · n=${summary.daysAlive.count}/${report.totalOrders}`
              : 'Add birth & kill dates'}
          </div>
        </div>

        <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl">
          <div className="text-xs font-semibold text-cool-gray-400">
            Avg Daily Gain (ADG)
          </div>
          <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-extrabold text-cyan-400 font-mono tabular-nums">
              {summary.liveWeightPerDayAlive.avg !== null
                ? `${summary.liveWeightPerDayAlive.avg.toFixed(2)}`
                : '—'}
            </span>
            {summary.liveWeightPerDayAlive.avg !== null && (
              <span className="text-xs text-cool-gray-400 font-mono">live lb/d</span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-cool-gray-500 font-mono tabular-nums">
            {summary.hotWeightPerDayAlive.avg !== null
              ? `Carcass ${summary.hotWeightPerDayAlive.avg.toFixed(2)} lb/d · n=${summary.hotWeightPerDayAlive.count}/${report.totalOrders}`
              : reportMode === 'estimates'
                ? 'Uses corrected estimates when set'
                : 'Requires birth, kill & weight'}
          </div>
        </div>

        <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl">
          <div className="text-xs font-semibold text-cool-gray-400">Hang Time (Kill → 1st Pack)</div>
          <div className="mt-1.5 text-2xl font-extrabold text-amber-400 font-mono tabular-nums">
            {fmtDays(summary.killToFirstPackDays.avg, 1)}
          </div>
          <div className="mt-1 text-[11px] text-cool-gray-500 font-mono tabular-nums">
            {summary.killToFirstPackDays.count > 0
              ? `${fmtRange(summary.killToFirstPackDays.min, summary.killToFirstPackDays.max)} · n=${summary.killToFirstPackDays.count}/${report.totalOrders}`
              : 'Requires kill & pack dates'}
          </div>
        </div>

        <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl">
          <div className="text-xs font-semibold text-cool-gray-400">Kill → Last Pack</div>
          <div className="mt-1.5 text-2xl font-extrabold text-violet-400 font-mono tabular-nums">
            {fmtDays(summary.killToLastPackDays.avg, 1)}
          </div>
          <div className="mt-1 text-[11px] text-cool-gray-500 font-mono tabular-nums">
            {summary.killToLastPackDays.count > 0
              ? `${fmtRange(summary.killToLastPackDays.min, summary.killToLastPackDays.max)} · n=${summary.killToLastPackDays.count}/${report.totalOrders}`
              : 'Requires kill & pack dates'}
          </div>
        </div>

        <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl">
          <div className="text-xs font-semibold text-cool-gray-400">Total Package Time</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums">
              {fmtDays(summary.packageSpanDays.avg, 1)}
            </span>
            <span className="text-xs text-cool-gray-400">span</span>
          </div>
          <div className="mt-1 text-[11px] text-cool-gray-500 font-mono tabular-nums">
            {summary.distinctPackDays.avg !== null
              ? `${summary.distinctPackDays.avg.toFixed(1)} active d avg · n=${summary.packageSpanDays.count}/${report.totalOrders}`
              : 'Inclusive (same day = 1d)'}
          </div>
        </div>

        <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl">
          <div className="text-xs font-semibold text-cool-gray-400">Post-Pack Hold (Last → Pickup)</div>
          <div className="mt-1.5 text-2xl font-extrabold text-rose-400 font-mono tabular-nums">
            {fmtDays(summary.lastPackToPickupDays.avg, 1)}
          </div>
          <div className="mt-1 text-[11px] text-cool-gray-500 font-mono tabular-nums">
            {summary.lastPackToPickupDays.count > 0
              ? `${fmtRange(summary.lastPackToPickupDays.min, summary.lastPackToPickupDays.max)} · n=${summary.lastPackToPickupDays.count}/${report.totalOrders}`
              : 'Requires pack & pickup dates'}
          </div>
        </div>

        <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl">
          <div className="text-xs font-semibold text-cool-gray-400">Total Turnaround (Kill → Pickup)</div>
          <div className="mt-1.5 text-2xl font-extrabold text-cyan-400 font-mono tabular-nums">
            {fmtDays(summary.killToPickupDays.avg, 1)}
          </div>
          <div className="mt-1 text-[11px] text-cool-gray-500 font-mono tabular-nums">
            {summary.killToPickupDays.count > 0
              ? `${fmtRange(summary.killToPickupDays.min, summary.killToPickupDays.max)} · n=${summary.killToPickupDays.count}/${report.totalOrders}`
              : 'Requires kill & pickup dates'}
          </div>
        </div>

        <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl">
          <div className="text-xs font-semibold text-cool-gray-400">Cadence & Pack Throughput</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white font-mono tabular-nums">
              {summary.packagedLbsPerPackDay.avg !== null
                ? `${summary.packagedLbsPerPackDay.avg.toFixed(0)}`
                : '—'}
            </span>
            {summary.packagedLbsPerPackDay.avg !== null && (
              <span className="text-xs text-cool-gray-400 font-mono">lb/pack d</span>
            )}
          </div>
          <div className="mt-1 text-[11px] text-cool-gray-500 font-mono tabular-nums">
            {summary.packagesPerPackDay.avg !== null ? `${summary.packagesPerPackDay.avg.toFixed(0)} pkgs/d` : 'No throughput'}
            {summary.daysSincePreviousHarvest.avg !== null
              ? ` · ${summary.daysSincePreviousHarvest.avg.toFixed(1)}d kill gap`
              : ''}
          </div>
        </div>
      </div>
      )}

      {/* 3. Interactive Timeline Chart Panel */}
      <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-cool-gray-800 pb-3.5">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarClock size={16} className="text-cyan-400 shrink-0" />
              <span>Lifecycle Durations & Pacing Charts</span>
            </h4>
            <p className="text-xs text-cool-gray-400 mt-0.5">
              Hover any order along the timeline to inspect milestone dates, durations, and throughput.
            </p>
          </div>
          <div className="inline-flex bg-cool-gray-950 p-1 rounded-xl border border-cool-gray-700 self-start">
            {[
              { id: 'durations' as const, label: 'Durations Trend' },
              { id: 'lifecycle' as const, label: 'Lifecycle Phases' },
              { id: 'age_adg' as const, label: 'Age & Daily Gain' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setChartMode(tab.id);
                  setHoveredIdx(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  chartMode === tab.id
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* MODE 1: DURATIONS TREND LINE CHART */}
        {chartMode === 'durations' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {DURATION_SERIES.map(series => {
                const active = visibleSeries[series.key];
                return (
                  <button
                    key={series.key}
                    type="button"
                    onClick={() => toggleSeries(series.key)}
                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-cool-gray-800 text-white border-cool-gray-600'
                        : 'bg-cool-gray-950/60 text-cool-gray-500 border-cool-gray-800 hover:text-cool-gray-300'
                    }`}
                  >
                    <span
                      className="w-3 h-0.5 inline-block shrink-0"
                      style={{ backgroundColor: active ? series.color : '#4b5563' }}
                    />
                    <span>{series.label}</span>
                  </button>
                );
              })}
            </div>

            {!hasAnyDurationData ? (
              <div className="text-center py-12 text-xs text-cool-gray-400 border border-dashed border-cool-gray-750 rounded-xl">
                No valid processing duration data for the active series. Ensure orders have Kill, Pack, or Pickup dates.
              </div>
            ) : (
              <div className="relative pt-1">
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto overflow-visible">
                  {/* Horizontal Grid */}
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const val = Math.round(maxDurationValue * frac);
                    const y = PAD_T + (1 - frac) * PLOT_H;
                    return (
                      <g key={frac}>
                        <line
                          x1={PAD_L}
                          y1={y}
                          x2={SVG_W - PAD_R}
                          y2={y}
                          stroke="#374151"
                          strokeDasharray={frac === 0 ? undefined : '4 4'}
                          strokeWidth="1"
                          opacity={frac === 0 ? 0.6 : 0.35}
                        />
                        <text
                          x={PAD_L - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fill="#9ca3af"
                          fontSize="10"
                          className="font-mono"
                        >
                          {val}d
                        </text>
                      </g>
                    );
                  })}

                  {/* Series Lines & Dots */}
                  {activeSeriesList.map(series => {
                    const pts = chronologicalRows.map((row, idx) => {
                      const val = row[series.key];
                      const y =
                        val !== null ? PAD_T + (1 - val / maxDurationValue) * PLOT_H : null;
                      return { x: getX(idx), y, val };
                    });
                    const pathD = buildSegmentedPath(pts);
                    return (
                      <g key={series.key}>
                        {pathD && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke={series.color}
                            strokeWidth="2.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {pts.map((pt, idx) =>
                          pt.y !== null ? (
                            <circle
                              key={idx}
                              cx={pt.x}
                              cy={pt.y}
                              r={hoveredIdx === idx ? 4.5 : 3}
                              fill={series.color}
                              stroke="#111827"
                              strokeWidth="1.2"
                            />
                          ) : null
                        )}
                      </g>
                    );
                  })}

                  {/* Hover Guide + Hit Areas + X Labels */}
                  {chronologicalRows.map((row, idx) => {
                    const x = getX(idx);
                    const step = pointCount > 1 ? PLOT_W / (pointCount - 1) : PLOT_W;
                    const showLabel =
                      pointCount <= 10 ||
                      idx === 0 ||
                      idx === pointCount - 1 ||
                      idx % Math.ceil(pointCount / 8) === 0;
                    return (
                      <g key={row.orderId}>
                        {hoveredIdx === idx && (
                          <line
                            x1={x}
                            y1={PAD_T}
                            x2={x}
                            y2={SVG_H - PAD_B}
                            stroke="#22d3ee"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                            opacity="0.7"
                          />
                        )}
                        <rect
                          x={Math.max(PAD_L, x - step / 2)}
                          y={PAD_T}
                          width={Math.max(12, step)}
                          height={PLOT_H + PAD_B}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        />
                        {showLabel && (
                          <text
                            x={x}
                            y={SVG_H - 12}
                            textAnchor="middle"
                            fill="#9ca3af"
                            fontSize="9.5"
                            className="font-mono"
                          >
                            {row.killDate ? row.killDate.slice(5) : `#${row.orderNumber}`}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Hover Tooltip */}
                {hoveredIdx !== null && chronologicalRows[hoveredIdx] && (() => {
                  const row = chronologicalRows[hoveredIdx];
                  const leftPct = Math.min(Math.max((getX(hoveredIdx) / SVG_W) * 100, 18), 82);
                  return (
                    <div
                      className="absolute top-2 z-30 pointer-events-none bg-cool-gray-950 border border-cool-gray-700 rounded-xl p-3 shadow-2xl text-xs min-w-[235px]"
                      style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="font-bold text-white flex items-center justify-between gap-2 pb-1.5 border-b border-cool-gray-800">
                        <span className="font-mono">Order #{row.orderNumber}</span>
                        <span className="text-cool-gray-400 font-normal">{row.species}</span>
                      </div>
                      <div className="text-[11px] text-cool-gray-400 mt-1 mb-2">
                        {row.butcherName} · Kill {row.killDate || 'N/A'}
                      </div>
                      <div className="space-y-1 font-mono tabular-nums">
                        <div className="flex justify-between gap-4">
                          <span className="text-amber-400">Hang (Kill → 1st Pack)</span>
                          <span className="text-white font-bold">{fmtDays(row.killToFirstPackDays, 0)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-violet-400">Kill → Last Pack</span>
                          <span className="text-white font-bold">{fmtDays(row.killToLastPackDays, 0)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-emerald-400">Pack Time (Span / Active)</span>
                          <span className="text-white font-bold">
                            {row.packageSpanDays !== null
                              ? `${row.packageSpanDays}d / ${row.distinctPackDays ?? 0}d`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-rose-400">Post-Pack Hold</span>
                          <span className="text-white font-bold">{fmtDays(row.lastPackToPickupDays, 0)}</span>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-cool-gray-800 pt-1">
                          <span className="text-cyan-400">Turnaround (Kill → Pickup)</span>
                          <span className="text-white font-bold">{fmtDays(row.killToPickupDays, 0)}</span>
                        </div>
                      </div>
                      {row.hasWarnings && (
                        <div className="mt-2 pt-1.5 border-t border-amber-500/30 text-[11px] text-amber-300">
                          Warning: {row.warnings[0].message}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* MODE 2: LIFECYCLE STACKED PHASE BREAKDOWN */}
        {chartMode === 'lifecycle' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-cool-gray-300">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-500 inline-block" /> Hang (Kill → 1st Pack)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-violet-500 inline-block" /> Packaging Window (1st → Last)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-rose-500 inline-block" /> Post-Pack Hold (Last → Pickup)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rotate-45 bg-cyan-400 inline-block" /> Total Turnaround Marker
              </span>
            </div>

            {!hasAnyLifecycleData ? (
              <div className="text-center py-12 text-xs text-cool-gray-400 border border-dashed border-cool-gray-750 rounded-xl">
                No valid lifecycle intervals found to draw stacked phase bars.
              </div>
            ) : (
              <div className="relative pt-1">
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto overflow-visible">
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const val = Math.round(maxLifecycleDays * frac);
                    const y = PAD_T + (1 - frac) * PLOT_H;
                    return (
                      <g key={frac}>
                        <line
                          x1={PAD_L}
                          y1={y}
                          x2={SVG_W - PAD_R}
                          y2={y}
                          stroke="#374151"
                          strokeDasharray={frac === 0 ? undefined : '4 4'}
                          strokeWidth="1"
                          opacity={frac === 0 ? 0.6 : 0.35}
                        />
                        <text
                          x={PAD_L - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fill="#9ca3af"
                          fontSize="10"
                          className="font-mono"
                        >
                          {val}d
                        </text>
                      </g>
                    );
                  })}

                  {lifecycleBars.map((bar, idx) => {
                    const slotW = PLOT_W / Math.max(1, pointCount);
                    const barW = Math.min(34, Math.max(8, slotW * 0.58));
                    const cx = PAD_L + slotW * idx + slotW / 2;
                    const xLeft = cx - barW / 2;
                    const baseY = PAD_T + PLOT_H;

                    const hHang = (bar.hang / maxLifecycleDays) * PLOT_H;
                    const hPack = (bar.packElapsed / maxLifecycleDays) * PLOT_H;
                    const hHold = (bar.hold / maxLifecycleDays) * PLOT_H;

                    const yHang = baseY - hHang;
                    const yPack = yHang - hPack;
                    const yHold = yPack - hHold;

                    const yTurnaround =
                      bar.totalTurnaround !== null
                        ? baseY - (bar.totalTurnaround / maxLifecycleDays) * PLOT_H
                        : null;

                    const showLabel =
                      pointCount <= 12 ||
                      idx === 0 ||
                      idx === pointCount - 1 ||
                      idx % Math.ceil(pointCount / 10) === 0;

                    return (
                      <g
                        key={bar.row.orderId}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredIdx(idx)}
                        onMouseLeave={() => setHoveredIdx(null)}
                      >
                        {hoveredIdx === idx && (
                          <rect
                            x={PAD_L + slotW * idx + 2}
                            y={PAD_T}
                            width={Math.max(4, slotW - 4)}
                            height={PLOT_H}
                            fill="#22d3ee"
                            opacity="0.08"
                            rx="4"
                          />
                        )}
                        {hHang > 0 && (
                          <rect
                            x={xLeft}
                            y={yHang}
                            width={barW}
                            height={hHang}
                            fill="#f59e0b"
                            opacity={hoveredIdx === idx ? 1 : 0.85}
                          />
                        )}
                        {hPack > 0 && (
                          <rect
                            x={xLeft}
                            y={yPack}
                            width={barW}
                            height={hPack}
                            fill="#8b5cf6"
                            opacity={hoveredIdx === idx ? 1 : 0.88}
                          />
                        )}
                        {hHold > 0 && (
                          <rect
                            x={xLeft}
                            y={yHold}
                            width={barW}
                            height={hHold}
                            fill="#f43f5e"
                            opacity={hoveredIdx === idx ? 1 : 0.88}
                          />
                        )}
                        {yTurnaround !== null && (
                          <polygon
                            points={`${cx},${yTurnaround - 4.5} ${cx + 4.5},${yTurnaround} ${cx},${yTurnaround + 4.5} ${cx - 4.5},${yTurnaround}`}
                            fill="#22d3ee"
                            stroke="#111827"
                            strokeWidth="1"
                          />
                        )}
                        <rect
                          x={PAD_L + slotW * idx}
                          y={PAD_T}
                          width={slotW}
                          height={PLOT_H + PAD_B}
                          fill="transparent"
                        />
                        {showLabel && (
                          <text
                            x={cx}
                            y={SVG_H - 12}
                            textAnchor="middle"
                            fill="#9ca3af"
                            fontSize="9.5"
                            className="font-mono"
                          >
                            #{bar.row.orderNumber}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {hoveredIdx !== null && lifecycleBars[hoveredIdx] && (() => {
                  const bar = lifecycleBars[hoveredIdx];
                  const row = bar.row;
                  const slotW = PLOT_W / Math.max(1, pointCount);
                  const cx = PAD_L + slotW * hoveredIdx + slotW / 2;
                  const leftPct = Math.min(Math.max((cx / SVG_W) * 100, 18), 82);
                  return (
                    <div
                      className="absolute top-2 z-30 pointer-events-none bg-cool-gray-950 border border-cool-gray-700 rounded-xl p-3 shadow-2xl text-xs min-w-[235px]"
                      style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="font-bold text-white flex justify-between gap-2 pb-1.5 border-b border-cool-gray-800">
                        <span className="font-mono">Order #{row.orderNumber}</span>
                        <span className="text-cool-gray-400 font-normal">{row.butcherName}</span>
                      </div>
                      <div className="space-y-1 mt-1.5 font-mono tabular-nums">
                        <div className="flex justify-between gap-4">
                          <span className="text-amber-400">Hang (Kill → 1st Pack)</span>
                          <span className="text-white font-bold">{fmtDays(row.killToFirstPackDays, 0)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-violet-400">Pack Span (Inclusive)</span>
                          <span className="text-white font-bold">
                            {row.packageSpanDays !== null
                              ? `${row.packageSpanDays}d (${row.distinctPackDays} active)`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-rose-400">Post-Pack Hold</span>
                          <span className="text-white font-bold">{fmtDays(row.lastPackToPickupDays, 0)}</span>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-cool-gray-800 pt-1">
                          <span className="text-cyan-400">Total Turnaround</span>
                          <span className="text-white font-bold">{fmtDays(row.killToPickupDays, 0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* MODE 3: AGE & DAILY GAIN (ADG) */}
        {chartMode === 'age_adg' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-cool-gray-300">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-500/40 border border-emerald-400 inline-block" /> Days Alive (left axis)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-cyan-400 inline-block" /> Live ADG lbs/day (right axis)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-amber-400 inline-block" /> Carcass ADG lbs/day (right axis)
              </span>
            </div>

            {!hasAnyAgeData ? (
              <div className="text-center py-12 text-xs text-cool-gray-400 border border-dashed border-cool-gray-750 rounded-xl">
                No filtered orders have both Birth Date and Kill Date recorded yet. Add Birth Dates on orders to track Days Alive and Daily Gain (ADG).
              </div>
            ) : (
              <div className="relative pt-1">
                <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto overflow-visible">
                  {[0, 0.25, 0.5, 0.75, 1].map(frac => {
                    const y = PAD_T + (1 - frac) * PLOT_H;
                    const leftVal = Math.round(maxDaysAlive * frac);
                    const rightVal = (maxAdg * frac).toFixed(1);
                    return (
                      <g key={frac}>
                        <line
                          x1={PAD_L}
                          y1={y}
                          x2={SVG_W - PAD_R}
                          y2={y}
                          stroke="#374151"
                          strokeDasharray={frac === 0 ? undefined : '4 4'}
                          strokeWidth="1"
                          opacity={frac === 0 ? 0.6 : 0.35}
                        />
                        <text
                          x={PAD_L - 8}
                          y={y + 3.5}
                          textAnchor="end"
                          fill="#10b981"
                          fontSize="9.5"
                          className="font-mono"
                        >
                          {leftVal}d
                        </text>
                        <text
                          x={SVG_W - PAD_R + 6}
                          y={y + 3.5}
                          textAnchor="start"
                          fill="#22d3ee"
                          fontSize="9.5"
                          className="font-mono"
                        >
                          {rightVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Days Alive Bars */}
                  {chronologicalRows.map((row, idx) => {
                    if (row.daysAlive === null) return null;
                    const cx = getX(idx);
                    const barW = Math.min(26, Math.max(8, (PLOT_W / Math.max(1, pointCount)) * 0.45));
                    const h = (row.daysAlive / maxDaysAlive) * PLOT_H;
                    return (
                      <rect
                        key={`age-bar-${row.orderId}`}
                        x={cx - barW / 2}
                        y={PAD_T + PLOT_H - h}
                        width={barW}
                        height={h}
                        rx="3"
                        fill="#10b981"
                        opacity={hoveredIdx === idx ? 0.45 : 0.24}
                        stroke="#10b981"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Live ADG Curve */}
                  {(() => {
                    const livePts = chronologicalRows.map((row, idx) => ({
                      x: getX(idx),
                      y:
                        row.liveWeightPerDayAlive !== null
                          ? PAD_T + (1 - row.liveWeightPerDayAlive / maxAdg) * PLOT_H
                          : null,
                    }));
                    const hotPts = chronologicalRows.map((row, idx) => ({
                      x: getX(idx),
                      y:
                        row.hotWeightPerDayAlive !== null
                          ? PAD_T + (1 - row.hotWeightPerDayAlive / maxAdg) * PLOT_H
                          : null,
                    }));
                    return (
                      <>
                        <path
                          d={buildSegmentedPath(livePts)}
                          fill="none"
                          stroke="#22d3ee"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d={buildSegmentedPath(hotPts)}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {livePts.map((pt, idx) =>
                          pt.y !== null ? (
                            <circle
                              key={`ladg-${idx}`}
                              cx={pt.x}
                              cy={pt.y}
                              r={hoveredIdx === idx ? 4.5 : 3}
                              fill="#22d3ee"
                              stroke="#111827"
                              strokeWidth="1.2"
                            />
                          ) : null
                        )}
                        {hotPts.map((pt, idx) =>
                          pt.y !== null ? (
                            <circle
                              key={`hadg-${idx}`}
                              cx={pt.x}
                              cy={pt.y}
                              r={hoveredIdx === idx ? 4.5 : 3}
                              fill="#f59e0b"
                              stroke="#111827"
                              strokeWidth="1.2"
                            />
                          ) : null
                        )}
                      </>
                    );
                  })()}

                  {/* Interactive Hit Zones & X Labels */}
                  {chronologicalRows.map((row, idx) => {
                    const x = getX(idx);
                    const step = pointCount > 1 ? PLOT_W / (pointCount - 1) : PLOT_W;
                    const showLabel =
                      pointCount <= 10 ||
                      idx === 0 ||
                      idx === pointCount - 1 ||
                      idx % Math.ceil(pointCount / 8) === 0;
                    return (
                      <g key={`hit-age-${row.orderId}`}>
                        <rect
                          x={Math.max(PAD_L, x - step / 2)}
                          y={PAD_T}
                          width={Math.max(12, step)}
                          height={PLOT_H + PAD_B}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        />
                        {showLabel && (
                          <text
                            x={x}
                            y={SVG_H - 12}
                            textAnchor="middle"
                            fill="#9ca3af"
                            fontSize="9.5"
                            className="font-mono"
                          >
                            {row.killDate ? row.killDate.slice(5) : `#${row.orderNumber}`}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>

                {hoveredIdx !== null && chronologicalRows[hoveredIdx] && (() => {
                  const row = chronologicalRows[hoveredIdx];
                  const leftPct = Math.min(Math.max((getX(hoveredIdx) / SVG_W) * 100, 18), 82);
                  return (
                    <div
                      className="absolute top-2 z-30 pointer-events-none bg-cool-gray-950 border border-cool-gray-700 rounded-xl p-3 shadow-2xl text-xs min-w-[230px]"
                      style={{ left: `${leftPct}%`, transform: 'translateX(-50%)' }}
                    >
                      <div className="font-bold text-white flex justify-between gap-2 pb-1.5 border-b border-cool-gray-800">
                        <span className="font-mono">Order #{row.orderNumber}</span>
                        <span className="text-cool-gray-400 font-normal">{row.species}</span>
                      </div>
                      <div className="text-[11px] text-cool-gray-400 mt-1 mb-2 font-mono">
                        Born {row.birthDate || '—'} → Kill {row.killDate || '—'}
                      </div>
                      <div className="space-y-1 font-mono tabular-nums">
                        <div className="flex justify-between gap-4">
                          <span className="text-emerald-400">Days Alive</span>
                          <span className="text-white font-bold">
                            {row.daysAlive !== null
                              ? `${row.daysAlive}d (${formatDaysAsMonths(row.daysAlive)})`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-cyan-400">Live ADG</span>
                          <span className="text-white font-bold">
                            {row.liveWeightPerDayAlive !== null
                              ? `${row.liveWeightPerDayAlive.toFixed(2)} lb/d`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-amber-400">Hot Carcass ADG</span>
                          <span className="text-white font-bold">
                            {row.hotWeightPerDayAlive !== null
                              ? `${row.hotWeightPerDayAlive.toFixed(2)} lb/d`
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Butcher / Processor & Species Turnaround Comparison */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={15} className="text-cyan-400 shrink-0" />
              <span>Turnaround & Pacing Comparison</span>
            </h4>
            <p className="text-xs text-cool-gray-400 mt-0.5">
              Compare hanging time, packaging speed, cold hold, and total turnaround across processors or species.
            </p>
          </div>
          <div className="inline-flex bg-cool-gray-950 p-1 rounded-xl border border-cool-gray-700 self-start">
            <button
              type="button"
              onClick={() => setGroupBy('butcher')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                groupBy === 'butcher'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-cool-gray-400 hover:text-white'
              }`}
            >
              By Butcher / Processor
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('species')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                groupBy === 'species'
                  ? 'bg-cyan-600 text-white shadow'
                  : 'text-cool-gray-400 hover:text-white'
              }`}
            >
              By Species
            </button>
          </div>
        </div>

        <div
          data-testid="butcher-turnaround-comparison-grid"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {comparisonGroups.map(group => {
            const avgHang = group.killToFirstPackDays.avg ?? 0;
            const avgPackWindow =
              group.packageSpanDays.avg !== null ? Math.max(0, group.packageSpanDays.avg - 1) : 0;
            const avgHold = group.lastPackToPickupDays.avg ?? 0;
            const phaseTotal = avgHang + avgPackWindow + avgHold;
            const hangPct = phaseTotal > 0 ? (avgHang / phaseTotal) * 100 : 0;
            const packPct = phaseTotal > 0 ? (avgPackWindow / phaseTotal) * 100 : 0;
            const holdPct = phaseTotal > 0 ? (avgHold / phaseTotal) * 100 : 0;

            return (
              <div
                key={group.groupKey}
                className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-4 sm:p-5 space-y-4"
              >
                <div className="flex items-start justify-between gap-3 border-b border-cool-gray-800 pb-3">
                  <div className="min-w-0">
                    <h5 className="text-base font-bold text-white truncate">{group.label}</h5>
                    <div className="text-xs text-cool-gray-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono tabular-nums">
                        {group.orderCount} {group.orderCount === 1 ? 'order' : 'orders'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {group.animalCount} {group.animalCount === 1 ? 'animal' : 'animals'}
                      </span>
                      {group.warningOrderCount > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-400 font-semibold">
                            {group.warningOrderCount} date{' '}
                            {group.warningOrderCount === 1 ? 'warning' : 'warnings'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-cool-gray-400">Avg Turnaround</div>
                    <div className="text-xl font-extrabold text-cyan-400 font-mono tabular-nums">
                      {fmtDays(group.killToPickupDays.avg, 1)}
                    </div>
                    {group.killToPickupDays.count > 0 && (
                      <div className="text-[10px] text-cool-gray-500 font-mono tabular-nums">
                        {fmtRange(group.killToPickupDays.min, group.killToPickupDays.max)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Proportional Phase Bar */}
                {phaseTotal > 0 && (
                  <div className="space-y-1.5">
                    <div className="w-full h-2.5 bg-cool-gray-800 rounded-full overflow-hidden flex">
                      {hangPct > 0 && (
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${hangPct}%` }}
                          title={`Hang: ${avgHang.toFixed(1)}d`}
                        />
                      )}
                      {packPct > 0 && (
                        <div
                          className="h-full bg-violet-500"
                          style={{ width: `${packPct}%` }}
                          title={`Pack window: ${avgPackWindow.toFixed(1)}d`}
                        />
                      )}
                      {holdPct > 0 && (
                        <div
                          className="h-full bg-rose-500"
                          style={{ width: `${holdPct}%` }}
                          title={`Hold: ${avgHold.toFixed(1)}d`}
                        />
                      )}
                    </div>
                    <div className="flex justify-between text-[11px] text-cool-gray-400 font-mono tabular-nums">
                      <span>Hang {fmtDays(group.killToFirstPackDays.avg, 1)}</span>
                      <span>
                        Pack {fmtDays(group.packageSpanDays.avg, 1)} (
                        {group.distinctPackDays.avg !== null
                          ? `${group.distinctPackDays.avg.toFixed(1)} act`
                          : '—'}
                        )
                      </span>
                      <span>Hold {fmtDays(group.lastPackToPickupDays.avg, 1)}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-1">
                  <div>
                    <div className="text-[11px] text-cool-gray-500">Kill → 1st Pack</div>
                    <div className="font-mono tabular-nums font-bold text-amber-400 mt-0.5">
                      {fmtDays(group.killToFirstPackDays.avg, 1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-cool-gray-500">Kill → Last Pack</div>
                    <div className="font-mono tabular-nums font-bold text-violet-400 mt-0.5">
                      {fmtDays(group.killToLastPackDays.avg, 1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-cool-gray-500">Post-Pack Hold</div>
                    <div className="font-mono tabular-nums font-bold text-rose-400 mt-0.5">
                      {fmtDays(group.lastPackToPickupDays.avg, 1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-cool-gray-500">Pack Throughput</div>
                    <div className="font-mono tabular-nums font-bold text-emerald-400 mt-0.5">
                      {group.packagedLbsPerPackDay.avg !== null
                        ? `${group.packagedLbsPerPackDay.avg.toFixed(0)} lb/d`
                        : '—'}
                    </div>
                    {group.packagesPerPackDay.avg !== null && (
                      <div className="text-[10px] text-cool-gray-500 font-mono tabular-nums">
                        {group.packagesPerPackDay.avg.toFixed(0)} pkgs/d
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] text-cool-gray-500">Avg Days Alive</div>
                    <div className="font-mono tabular-nums font-bold text-white mt-0.5">
                      {fmtDays(group.daysAlive.avg, 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-cool-gray-500">Avg Live ADG</div>
                    <div className="font-mono tabular-nums font-bold text-cyan-400 mt-0.5">
                      {group.liveWeightPerDayAlive.avg !== null
                        ? `${group.liveWeightPerDayAlive.avg.toFixed(2)} lb/d`
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Sortable Per-Order Timeline & Lifecycle Matrix Table */}
      <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-cool-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-white">Order Timeline & Lifecycle Matrix</h4>
            <p className="text-xs text-cool-gray-400 mt-0.5">
              Click any column header to sort. Package time shows inclusive calendar span plus distinct active pack days.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-center">
            {report.ordersWithWarnings.length > 0 && (
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={warningsOnly}
                  onChange={e => setWarningsOnly(e.target.checked)}
                  className="rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 cursor-pointer"
                />
                <span>Warnings only ({report.ordersWithWarnings.length})</span>
              </label>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-200 border border-cool-gray-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-cool-gray-950/60 text-cool-gray-400 border-b border-cool-gray-800">
              <tr>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('orderNumber')} className="hover:text-white cursor-pointer">
                    Order {renderSortIcon('orderNumber')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('killDate')} className="hover:text-white cursor-pointer">
                    Dates (Kill / Pack / Pickup) {renderSortIcon('killDate')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('daysAlive')} className="hover:text-white cursor-pointer">
                    Days Alive / ADG {renderSortIcon('daysAlive')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('killToFirstPackDays')} className="hover:text-white cursor-pointer">
                    Kill → 1st {renderSortIcon('killToFirstPackDays')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('killToLastPackDays')} className="hover:text-white cursor-pointer">
                    Kill → Last {renderSortIcon('killToLastPackDays')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('packageSpanDays')} className="hover:text-white cursor-pointer">
                    Pack Time {renderSortIcon('packageSpanDays')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('lastPackToPickupDays')} className="hover:text-white cursor-pointer">
                    Hold {renderSortIcon('lastPackToPickupDays')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('killToPickupDays')} className="hover:text-white cursor-pointer">
                    Turnaround {renderSortIcon('killToPickupDays')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('packagedLbsPerPackDay')} className="hover:text-white cursor-pointer">
                    Throughput {renderSortIcon('packagedLbsPerPackDay')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">
                  <button type="button" onClick={() => handleSort('daysSincePreviousHarvest')} className="hover:text-white cursor-pointer">
                    Δ Kill {renderSortIcon('daysSincePreviousHarvest')}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cool-gray-800/70">
              {sortedTableRows.map((row: OrderTimelineMetrics) => {
                const fullOrder = ordersById.get(row.orderId);
                return (
                  <tr key={row.orderId} className="hover:bg-cool-gray-800/40 transition-colors">
                    <td className="px-3.5 py-2.5 align-top whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-white">#{row.orderNumber}</span>
                        {row.hasWarnings && (
                          <span
                            title={row.warnings.map(w => w.message).join(' | ')}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300"
                          >
                            <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                            <span>Check</span>
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-cool-gray-400 mt-0.5">
                        {row.species} · {row.butcherName}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-top font-mono tabular-nums text-[11px] text-cool-gray-300 whitespace-nowrap">
                      <div>Kill: {row.killDate || '—'}</div>
                      <div className="text-cool-gray-400">
                        Pack:{' '}
                        {row.firstPackDate
                          ? row.firstPackDate === row.lastPackDate
                            ? row.firstPackDate
                            : `${row.firstPackDate} → ${row.lastPackDate}`
                          : '—'}
                      </div>
                      <div className="text-cool-gray-400">Pickup: {row.pickupDate || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-emerald-400">{fmtDays(row.daysAlive, 0)}</div>
                      {row.liveWeightPerDayAlive !== null && (
                        <div className="text-[10px] text-cool-gray-400">
                          {row.liveWeightPerDayAlive.toFixed(2)} live
                          {row.hotWeightPerDayAlive !== null
                            ? ` / ${row.hotWeightPerDayAlive.toFixed(2)} hot`
                            : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums font-bold text-amber-400 whitespace-nowrap">
                      {fmtDays(row.killToFirstPackDays, 0)}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums font-bold text-violet-400 whitespace-nowrap">
                      {fmtDays(row.killToLastPackDays, 0)}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-emerald-400">
                        {fmtDays(row.packageSpanDays, 0)}
                      </div>
                      {row.distinctPackDays !== null && (
                        <div className="text-[10px] text-cool-gray-400">
                          {row.distinctPackDays} active
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums font-bold text-rose-400 whitespace-nowrap">
                      {fmtDays(row.lastPackToPickupDays, 0)}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums font-bold text-cyan-400 whitespace-nowrap">
                      {fmtDays(row.killToPickupDays, 0)}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="font-bold text-cool-gray-200">
                        {row.packagedLbsPerPackDay !== null
                          ? `${row.packagedLbsPerPackDay.toFixed(0)} lb/d`
                          : '—'}
                      </div>
                      {row.packagesPerPackDay !== null && (
                        <div className="text-[10px] text-cool-gray-400">
                          {row.packagesPerPackDay.toFixed(0)} pkgs/d
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right font-mono tabular-nums text-cool-gray-300 whitespace-nowrap">
                      {row.daysSincePreviousHarvest !== null ? `${row.daysSincePreviousHarvest}d` : '—'}
                    </td>
                    <td className="px-3 py-2.5 align-top text-right whitespace-nowrap">
                      {fullOrder && (
                        <button
                          type="button"
                          onClick={() => onEditOrder(fullOrder)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-cool-gray-800 hover:bg-cool-gray-700 text-cyan-400 border border-cool-gray-700 cursor-pointer"
                          title={`Edit Order #${row.orderNumber}`}
                        >
                          <Edit3 size={11} />
                          <span>Edit</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedTableRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-6 py-10 text-center text-cool-gray-500">
                    No orders match the current timeline filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
