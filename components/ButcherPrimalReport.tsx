import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Search, X, AlertTriangle, TrendingUp } from 'lucide-react';
import { ButcherPrimalReportData, ButcherPrimalReportRow } from '../utils/speciesPrimals';
import { computeChartYAxisScale, formatCompactAxisNumber } from '../utils/butcherStats';

interface ButcherPrimalReportProps {
  report: ButcherPrimalReportData;
  availableSpecies: string[];
  selectedSpeciesScope: string;
  onChangeSpeciesScope: (species: string) => void;
  totalMatchingOrdersBeforeScope: number;
}

const PRIMAL_SERIES_COLORS = [
  '#22d3ee', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#a78bfa', // violet
  '#f43f5e', // rose
  '#38bdf8', // sky
  '#fb923c', // orange
  '#34d399', // mint
];

export const ButcherPrimalReport: React.FC<ButcherPrimalReportProps> = ({
  report,
  availableSpecies,
  selectedSpeciesScope,
  onChangeSpeciesScope,
  totalMatchingOrdersBeforeScope,
}) => {
  const [search, setSearch] = useState('');
  const [expandedPrimalIds, setExpandedPrimalIds] = useState<Set<string>>(() => new Set());
  const [chartMetric, setChartMetric] = useState<'pct' | 'weight'>('pct');
  const [selectedTrendPrimalIds, setSelectedTrendPrimalIds] = useState<string[]>([]);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);

  // Sync default selected primals for trend chart (top 5 assigned primals by weight)
  useEffect(() => {
    const validIds = new Set(report.assignedRows.map((r) => r.primalId));
    setSelectedTrendPrimalIds((prev) => {
      const kept = prev.filter((id) => validIds.has(id));
      if (kept.length > 0) return kept;
      return report.assignedRows.slice(0, 5).map((r) => r.primalId);
    });
  }, [report.assignedRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return report.rows;
    return report.rows.filter((row) => {
      if (row.primalName.toLowerCase().includes(q)) return true;
      if (row.speciesName.toLowerCase().includes(q)) return true;
      return row.cuts.some((c) => c.name.toLowerCase().includes(q));
    });
  }, [report.rows, search]);

  const toggleExpand = (primalId: string) => {
    setExpandedPrimalIds((prev) => {
      const next = new Set(prev);
      if (next.has(primalId)) next.delete(primalId);
      else next.add(primalId);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedPrimalIds(new Set(filteredRows.map((r) => r.primalId)));
  };

  const collapseAll = () => {
    setExpandedPrimalIds(new Set());
  };

  const toggleTrendPrimal = (primalId: string) => {
    setSelectedTrendPrimalIds((prev) => {
      if (prev.includes(primalId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((id) => id !== primalId);
      }
      return [...prev, primalId];
    });
  };

  const showSpeciesColumn = selectedSpeciesScope === 'ALL' && availableSpecies.length > 1;
  const maxPct = useMemo(
    () => Math.max(1, ...report.rows.map((r) => r.pctOfPackaged)),
    [report.rows]
  );

  // Chart calculations
  const trendSeries = useMemo(() => {
    const byId = new Map<string, ButcherPrimalReportRow>(
      report.assignedRows.map((r) => [r.primalId, r])
    );
    return selectedTrendPrimalIds
      .map((id, idx) => {
        const row = byId.get(id);
        if (!row) return null;
        return {
          primalId: id,
          label: showSpeciesColumn ? `${row.speciesName} · ${row.primalName}` : row.primalName,
          color: PRIMAL_SERIES_COLORS[idx % PRIMAL_SERIES_COLORS.length],
          points: report.trendPoints.map((pt) => ({
            orderId: pt.orderId,
            orderNumber: pt.orderNumber,
            killDate: pt.killDate,
            species: pt.species,
            weight: pt.weightsByPrimalId[id] || 0,
            pct: pt.pctByPrimalId[id] || 0,
            value: chartMetric === 'pct' ? (pt.pctByPrimalId[id] || 0) : (pt.weightsByPrimalId[id] || 0),
          })),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [report.assignedRows, report.trendPoints, selectedTrendPrimalIds, chartMetric, showSpeciesColumn]);

  const allSeriesValues = useMemo(
    () => trendSeries.flatMap((s) => s.points.map((p) => p.value)),
    [trendSeries]
  );

  const SVG_W = 860;
  const SVG_H = 260;
  const PAD_LEFT = 54;
  const PAD_RIGHT = 24;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 42;
  const plotW = SVG_W - PAD_LEFT - PAD_RIGHT;
  const plotH = SVG_H - PAD_TOP - PAD_BOTTOM;

  const yScale = useMemo(
    () =>
      computeChartYAxisScale(allSeriesValues, {
        baselineMin: 0,
        baselineMax: chartMetric === 'pct' ? 10 : 25,
        allowNegative: false,
      }),
    [allSeriesValues, chartMetric]
  );

  const totalTrendPoints = report.trendPoints.length;
  const getX = (idx: number) => {
    if (totalTrendPoints <= 1) return PAD_LEFT + plotW / 2;
    return PAD_LEFT + (idx / (totalTrendPoints - 1)) * plotW;
  };

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.packages += r.packageCount;
        acc.pieces += r.totalPieces;
        acc.weight += r.totalWeight;
        acc.estValue += r.estValue;
        return acc;
      },
      { packages: 0, pieces: 0, weight: 0, estValue: 0 }
    );
  }, [filteredRows]);

  return (
    <div data-testid="butcher-reports-primals-panel" className="space-y-4">
      {/* Toolbar: Species Scope + Search + Expand/Collapse */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {availableSpecies.length > 1 && (
            <div className="inline-flex items-center bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => onChangeSpeciesScope('ALL')}
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  selectedSpeciesScope === 'ALL'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                All Species
              </button>
              {availableSpecies.map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => onChangeSpeciesScope(sp)}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    selectedSpeciesScope === sp
                      ? 'bg-cyan-600 text-white shadow'
                      : 'text-cool-gray-400 hover:text-white'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          )}

          <div className="relative min-w-[210px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
              <Search size={13} className="text-cool-gray-400" />
            </div>
            <input
              type="text"
              data-testid="butcher-reports-primals-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search primals or child cuts..."
              className="block w-full rounded-lg border border-cool-gray-700 bg-cool-gray-900 pl-8 pr-7 py-1.5 text-xs text-cool-gray-100 placeholder:text-cool-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2 text-cool-gray-400 hover:text-white cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {report.rows.length > 0 && (
            <>
              <button
                type="button"
                onClick={expandAll}
                className="px-2.5 py-1 text-xs font-semibold text-cool-gray-300 hover:text-white bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-700 rounded-lg transition cursor-pointer"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-2.5 py-1 text-xs font-semibold text-cool-gray-300 hover:text-white bg-cool-gray-900 hover:bg-cool-gray-800 border border-cool-gray-700 rounded-lg transition cursor-pointer"
              >
                Collapse All
              </button>
            </>
          )}
          <span className="text-xs font-mono tabular-nums text-cool-gray-400 bg-cool-gray-900 border border-cool-gray-700 px-2.5 py-1 rounded-lg">
            {report.assignedRows.length} {report.assignedRows.length === 1 ? 'primal' : 'primals'}
            {report.unassignedRow ? ' + Unassigned' : ''}
          </span>
        </div>
      </div>

      {/* Coverage Banner when unassigned weight exists */}
      {report.unassignedRow && report.unassignedRow.totalWeight > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-amber-950/25 border border-amber-500/35 text-xs">
          <div className="flex items-center gap-2 text-amber-200">
            <AlertTriangle size={14} className="text-amber-400 shrink-0" />
            <span>
              <strong className="font-mono tabular-nums">{report.unassignedRow.totalWeight.toFixed(1)} lbs</strong>{' '}
              ({report.unassignedRow.pctOfPackaged.toFixed(1)}% of packaged across {report.unassignedRow.cuts.length}{' '}
              {report.unassignedRow.cuts.length === 1 ? 'cut' : 'cuts'}) are not linked to a primal cut yet.
            </span>
          </div>
          <span className="text-[11px] text-amber-300/80">
            Assign primals to products in Catalog → Products to include them in carcass share totals.
          </span>
        </div>
      )}

      {/* Primal Carcass Share & Breakdown Table */}
      <div className="overflow-x-auto border border-cool-gray-750 rounded-xl bg-cool-gray-900/40">
        <table className="w-full text-left text-sm">
          <thead className="bg-cool-gray-900/90 text-cool-gray-400 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 font-bold">Primal Cut</th>
              <th className="px-3 py-3 font-bold text-right">Packages</th>
              <th className="px-3 py-3 font-bold text-right">Pieces</th>
              <th className="px-3 py-3 font-bold text-right">Net Weight</th>
              <th className="px-3 py-3 font-bold text-right min-w-[155px]">% of Packaged</th>
              <th className="px-3 py-3 font-bold text-right">% of Cold</th>
              <th className="px-3 py-3 font-bold text-right">Avg / Head</th>
              <th className="px-4 py-3 font-bold text-right">Est. Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cool-gray-750/60">
            {filteredRows.map((row) => {
              const isExpanded = expandedPrimalIds.has(row.primalId);
              const barWidth = Math.min(100, Math.max(2, (row.pctOfPackaged / maxPct) * 100));
              return (
                <React.Fragment key={row.primalId}>
                  <tr
                    onClick={() => toggleExpand(row.primalId)}
                    className={`cursor-pointer transition-colors ${
                      row.isUnassigned
                        ? 'bg-amber-950/15 hover:bg-amber-950/25'
                        : 'hover:bg-cool-gray-800/60'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-cool-gray-400 shrink-0">
                          {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {row.isUnassigned && (
                              <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                            )}
                            <span
                              className={`font-bold truncate ${
                                row.isUnassigned ? 'text-amber-200' : 'text-cool-gray-100'
                              }`}
                            >
                              {row.primalName}
                            </span>
                            {showSpeciesColumn && !row.isUnassigned && (
                              <span className="text-xs text-cool-gray-500 font-medium">
                                · {row.speciesName}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-cool-gray-500">
                            {row.cuts.length} {row.cuts.length === 1 ? 'cut' : 'cuts'} · {row.orderCount}{' '}
                            {row.orderCount === 1 ? 'order' : 'orders'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-cool-gray-300">
                      {row.packageCount}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-cool-gray-300">
                      {row.totalPieces}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-extrabold text-cyan-400">
                      {row.totalWeight.toFixed(1)} <span className="text-[10px] font-normal text-cool-gray-500">lbs</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-cool-gray-800 overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${
                              row.isUnassigned ? 'bg-amber-500/80' : 'bg-cyan-500'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums font-bold text-cool-gray-200 w-12 text-right">
                          {row.pctOfPackaged.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-cool-gray-300">
                      {row.pctOfColdCarcass !== null ? `${row.pctOfColdCarcass.toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-cool-gray-200">
                      {row.avgWeightPerHead.toFixed(1)} <span className="text-[10px] text-cool-gray-500">lbs</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-emerald-400">
                      {row.estValue > 0 ? `$${row.estValue.toFixed(2)}` : '—'}
                    </td>
                  </tr>

                  {/* Expandable Child Cuts */}
                  {isExpanded &&
                    row.cuts.map((cut) => (
                      <tr
                        key={`${row.primalId}::${cut.productId || cut.name}`}
                        className="bg-cool-gray-950/60 hover:bg-cool-gray-900/80 text-xs"
                      >
                        <td className="pl-11 pr-4 py-2 text-cool-gray-300 font-medium">
                          <span className="text-cool-gray-600 mr-1.5">↳</span>
                          {cut.name}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-cool-gray-400">
                          {cut.packageCount}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-cool-gray-400">
                          {cut.totalPieces}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-cool-gray-200 font-semibold">
                          {cut.totalWeight.toFixed(2)} lbs
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-cool-gray-400">
                          <span title="% of this primal">{cut.pctOfPrimal.toFixed(1)}% of primal</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-cool-gray-500">
                          {cut.pctOfPackaged.toFixed(1)}% pack
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-cool-gray-500">
                          {report.totalAnimalCount > 0
                            ? `${(cut.totalWeight / report.totalAnimalCount).toFixed(1)} lbs`
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-400/90">
                          {cut.estValue > 0 ? `$${cut.estValue.toFixed(2)}` : '—'}
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              );
            })}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-cool-gray-500">
                  {totalMatchingOrdersBeforeScope === 0
                    ? 'No butcher orders match the current filters.'
                    : search.trim()
                      ? `No primals or cuts matching "${search.trim()}".`
                      : 'No packaged cut records available for this scope.'}
                </td>
              </tr>
            )}
          </tbody>

          {filteredRows.length > 0 && (
            <tfoot className="bg-cool-gray-900/95 border-t border-cool-gray-700 text-xs font-bold">
              <tr>
                <td className="px-4 py-2.5 text-cool-gray-300 uppercase tracking-wider">
                  Totals ({report.totalOrderCount} {report.totalOrderCount === 1 ? 'order' : 'orders'} ·{' '}
                  {report.totalAnimalCount} {report.totalAnimalCount === 1 ? 'head' : 'head'})
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white">
                  {totals.packages}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-white">
                  {totals.pieces}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-cyan-400">
                  {totals.weight.toFixed(1)} lbs
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-cool-gray-200">
                  {report.totalPackagedWeight > 0
                    ? `${((totals.weight / report.totalPackagedWeight) * 100).toFixed(1)}%`
                    : '0.0%'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-cool-gray-300">
                  {report.totalColdWeight > 0
                    ? `${((totals.weight / report.totalColdWeight) * 100).toFixed(1)}%`
                    : '—'}
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums text-cool-gray-200">
                  {report.totalAnimalCount > 0
                    ? `${(totals.weight / report.totalAnimalCount).toFixed(1)} lbs`
                    : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-emerald-400">
                  {totals.estValue > 0 ? `$${totals.estValue.toFixed(2)}` : '—'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Primal Yield Over Time Trend Chart */}
      {report.trendPoints.length >= 2 && report.assignedRows.length > 0 && (
        <div
          data-testid="butcher-primal-trend-chart"
          className="bg-cool-gray-900/70 border border-cool-gray-750 rounded-xl p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <TrendingUp size={15} className="text-cyan-400" />
                <span>Primal Yield Over Time</span>
              </h4>
              <p className="text-[11px] text-cool-gray-400">
                Compare primal cut share or weight across {report.trendPoints.length} chronological butcher orders.
              </p>
            </div>

            <div className="inline-flex items-center bg-cool-gray-950 border border-cool-gray-750 rounded-lg p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setChartMetric('pct')}
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  chartMetric === 'pct'
                    ? 'bg-cyan-600 text-white'
                    : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                % of Packaged
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('weight')}
                className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                  chartMetric === 'weight'
                    ? 'bg-cyan-600 text-white'
                    : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                Net Weight (lbs)
              </button>
            </div>
          </div>

          {/* Series toggle chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {report.assignedRows.map((row) => {
              const selectedIdx = selectedTrendPrimalIds.indexOf(row.primalId);
              const isSelected = selectedIdx >= 0;
              const color = isSelected
                ? PRIMAL_SERIES_COLORS[selectedIdx % PRIMAL_SERIES_COLORS.length]
                : undefined;
              return (
                <button
                  key={row.primalId}
                  type="button"
                  onClick={() => toggleTrendPrimal(row.primalId)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                    isSelected
                      ? 'bg-cool-gray-800 border-cool-gray-600 text-white'
                      : 'bg-cool-gray-950/60 border-cool-gray-800 text-cool-gray-500 hover:text-cool-gray-300'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color || '#4b5563' }}
                  />
                  <span>
                    {showSpeciesColumn ? `${row.speciesName} · ${row.primalName}` : row.primalName}
                  </span>
                </button>
              );
            })}
          </div>

          {/* SVG Line Chart */}
          <div
            className="relative w-full overflow-x-auto"
            onMouseLeave={() => setHoveredTrendIdx(null)}
          >
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              className="w-full h-64 min-w-[540px] select-none"
            >
              {/* Horizontal gridlines & Y ticks */}
              {yScale.ticks.map((tick) => {
                const y = yScale.mapY(tick, PAD_TOP, plotH);
                return (
                  <g key={tick}>
                    <line
                      x1={PAD_LEFT}
                      y1={y}
                      x2={SVG_W - PAD_RIGHT}
                      y2={y}
                      stroke="#334155"
                      strokeDasharray="3,3"
                      strokeWidth={1}
                      opacity={0.45}
                    />
                    <text
                      x={PAD_LEFT - 8}
                      y={y + 3.5}
                      textAnchor="end"
                      className="fill-cool-gray-400 text-[10px] font-mono"
                    >
                      {chartMetric === 'pct'
                        ? `${formatCompactAxisNumber(tick)}%`
                        : `${formatCompactAxisNumber(tick)}`}
                    </text>
                  </g>
                );
              })}

              {/* X-axis labels */}
              {report.trendPoints.map((pt, idx) => {
                const x = getX(idx);
                const maxLabels = 10;
                const step = Math.max(1, Math.ceil(totalTrendPoints / maxLabels));
                if (idx % step !== 0 && idx !== totalTrendPoints - 1) return null;
                return (
                  <text
                    key={pt.orderId}
                    x={x}
                    y={SVG_H - 12}
                    textAnchor="middle"
                    className="fill-cool-gray-400 text-[10px] font-mono"
                  >
                    #{pt.orderNumber}
                  </text>
                );
              })}

              {/* Hover vertical guide */}
              {hoveredTrendIdx !== null && (
                <line
                  x1={getX(hoveredTrendIdx)}
                  y1={PAD_TOP}
                  x2={getX(hoveredTrendIdx)}
                  y2={PAD_TOP + plotH}
                  stroke="#94a3b8"
                  strokeDasharray="3,3"
                  strokeWidth={1}
                  opacity={0.7}
                />
              )}

              {/* Series polylines and point dots */}
              {trendSeries.map((series) => {
                const polyPoints = series.points
                  .map((pt, idx) => `${getX(idx)},${yScale.mapY(pt.value, PAD_TOP, plotH)}`)
                  .join(' ');
                return (
                  <g key={series.primalId}>
                    <polyline
                      fill="none"
                      stroke={series.color}
                      strokeWidth={2.2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={polyPoints}
                    />
                    {series.points.map((pt, idx) => {
                      const cx = getX(idx);
                      const cy = yScale.mapY(pt.value, PAD_TOP, plotH);
                      const isHovered = hoveredTrendIdx === idx;
                      return (
                        <circle
                          key={`${series.primalId}-${pt.orderId}`}
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 4.5 : 3}
                          fill={series.color}
                          stroke="#0f172a"
                          strokeWidth={1.5}
                        />
                      );
                    })}
                  </g>
                );
              })}

              {/* Invisible hover columns */}
              {report.trendPoints.map((pt, idx) => {
                const x = getX(idx);
                const colWidth = totalTrendPoints > 1 ? plotW / (totalTrendPoints - 1) : plotW;
                return (
                  <rect
                    key={`hover-${pt.orderId}`}
                    x={Math.max(PAD_LEFT, x - colWidth / 2)}
                    y={PAD_TOP}
                    width={colWidth}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHoveredTrendIdx(idx)}
                  />
                );
              })}
            </svg>

            {/* Hover Tooltip */}
            {hoveredTrendIdx !== null && report.trendPoints[hoveredTrendIdx] && (() => {
              const pt = report.trendPoints[hoveredTrendIdx];
              const ptX = getX(hoveredTrendIdx);
              return (
                <div
                  className="absolute top-2 bg-cool-gray-950/95 backdrop-blur border border-cool-gray-700 rounded-xl p-3 shadow-2xl text-xs w-64 pointer-events-none z-10 space-y-1.5"
                  style={{
                    left: `${Math.min(82, Math.max(18, (ptX / SVG_W) * 100))}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className="flex items-center justify-between border-b border-cool-gray-800 pb-1">
                    <span className="font-bold text-white">Order #{pt.orderNumber}</span>
                    <span className="text-[10px] font-semibold text-cyan-400">{pt.species}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-cool-gray-400">
                    <span>{pt.killDate || 'No kill date'}</span>
                    <span className="font-mono tabular-nums">{pt.orderPackagedWeight.toFixed(0)} lbs pkg</span>
                  </div>
                  <div className="space-y-1 pt-1">
                    {trendSeries.map((series) => {
                      const spt = series.points[hoveredTrendIdx];
                      if (!spt) return null;
                      return (
                        <div key={series.primalId} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="flex items-center gap-1.5 text-cool-gray-300 truncate">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: series.color }}
                            />
                            <span className="truncate">{series.label}</span>
                          </span>
                          <span className="font-mono tabular-nums text-white font-semibold shrink-0">
                            {spt.weight.toFixed(1)} lb ({spt.pct.toFixed(1)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
