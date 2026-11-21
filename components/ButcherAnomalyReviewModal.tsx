import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Flag,
  Calculator,
  RotateCcw,
  ShieldCheck,
  Edit3,
  Check,
  SlidersHorizontal,
  Tag as TagIcon,
  Lock,
} from 'lucide-react';
import {
  ButcherBaselineGroupingMode,
  ButcherOrder,
  ButcherOrderTag,
  ButcherRecord,
  ButcherWeightField,
  ButcherWeightAnomaliesMap,
  ButcherEstimatedWeights,
} from '../types';
import {
  BUTCHER_WEIGHT_FIELD_LABELS,
  ButcherBaselineComparisonScope,
  ButcherOrderAnomalyAnalysis,
  analyzeOrderAnomalies,
  computeOrderStatsWithMode,
  listAvailableBaselineScopesForOrder,
  OrderReviewIssue,
  resolveButcherDisplayName,
} from '../utils/butcherStats';

interface ButcherAnomalyReviewModalProps {
  order: ButcherOrder;
  allOrders: ButcherOrder[];
  recordsByOrderId: Map<string, ButcherRecord[]>;
  sensitivity: number;
  butcherTags?: ButcherOrderTag[];
  baselineGroupingMode?: ButcherBaselineGroupingMode;
  locationNameById?: Map<string, string>;
  reviewIssues?: OrderReviewIssue[];
  onClose: () => void;
  onSave: (
    orderId: string,
    updates: {
      weightAnomalies?: ButcherWeightAnomaliesMap;
      estimatedWeights?: ButcherEstimatedWeights;
      reviewIgnoredFields?: string[];
      tagIds?: string[];
      auditClosed?: boolean;
      auditClosedAt?: string;
    }
  ) => void;
  onOpenEditOrder?: (order: ButcherOrder) => void;
}

const WEIGHT_FIELDS: ButcherWeightField[] = [
  'liveWeight',
  'hotWeight',
  'coldWeight',
  'packagedWeight',
];

export const ButcherAnomalyReviewModal: React.FC<ButcherAnomalyReviewModalProps> = ({
  order,
  allOrders,
  recordsByOrderId,
  sensitivity,
  butcherTags = [],
  baselineGroupingMode = 'species' as ButcherBaselineGroupingMode,
  locationNameById,
  reviewIssues = [],
  onClose,
  onSave,
  onOpenEditOrder,
}) => {
  const [draftAnomalies, setDraftAnomalies] = useState<ButcherWeightAnomaliesMap>(() => ({
    ...(order.weightAnomalies || {}),
  }));

  const [draftEstimates, setDraftEstimates] = useState<Record<ButcherWeightField, string>>(() => ({
    liveWeight:
      order.estimatedWeights?.liveWeight !== undefined && order.estimatedWeights.liveWeight > 0
        ? String(order.estimatedWeights.liveWeight)
        : '',
    hotWeight:
      order.estimatedWeights?.hotWeight !== undefined && order.estimatedWeights.hotWeight > 0
        ? String(order.estimatedWeights.hotWeight)
        : '',
    coldWeight:
      order.estimatedWeights?.coldWeight !== undefined && order.estimatedWeights.coldWeight > 0
        ? String(order.estimatedWeights.coldWeight)
        : '',
    packagedWeight:
      order.estimatedWeights?.packagedWeight !== undefined && order.estimatedWeights.packagedWeight > 0
        ? String(order.estimatedWeights.packagedWeight)
        : '',
  }));

  const [estimateNote, setEstimateNote] = useState<string>(order.estimatedWeights?.note || '');
  const [draftIgnoredFields, setDraftIgnoredFields] = useState<string[]>(
    () => order.reviewIgnoredFields || []
  );
  const [draftTagIds, setDraftTagIds] = useState<string[]>(() =>
    Array.isArray(order.tagIds) ? [...order.tagIds] : []
  );
  const [draftAuditClosed, setDraftAuditClosed] = useState<boolean>(() =>
    Boolean(order.auditClosed)
  );
  const [selectedScopeId, setSelectedScopeId] = useState<string>('auto');
  const [autoFilledFields, setAutoFilledFields] = useState<
    Partial<Record<ButcherWeightField, boolean>>
  >({});

  // Build an interactive preview order reflecting draft flags, estimates & tags so suggestions & yields update live
  const previewOrder: ButcherOrder = useMemo(() => {
    const parsedEst: ButcherEstimatedWeights = {};
    WEIGHT_FIELDS.forEach((f) => {
      const n = parseFloat(draftEstimates[f]);
      if (Number.isFinite(n) && n > 0) {
        parsedEst[f] = n;
      }
    });
    if (estimateNote.trim()) {
      parsedEst.note = estimateNote.trim();
    }
    return {
      ...order,
      weightAnomalies: draftAnomalies,
      estimatedWeights: parsedEst,
      reviewIgnoredFields: draftIgnoredFields,
      tagIds: draftTagIds,
      auditClosed: draftAuditClosed,
    };
  }, [order, draftAnomalies, draftEstimates, estimateNote, draftIgnoredFields, draftTagIds, draftAuditClosed]);

  const matchingRecords = useMemo(
    () => recordsByOrderId.get(order.id) || [],
    [recordsByOrderId, order.id]
  );

  const patchedOrders = useMemo(
    () => allOrders.map((o) => (o.id === order.id ? previewOrder : o)),
    [allOrders, order.id, previewOrder]
  );

  const scopeOptions = useMemo(
    () =>
      listAvailableBaselineScopesForOrder(
        previewOrder,
        patchedOrders,
        recordsByOrderId,
        butcherTags,
        baselineGroupingMode,
        locationNameById
      ),
    [
      previewOrder,
      patchedOrders,
      recordsByOrderId,
      butcherTags,
      baselineGroupingMode,
      locationNameById,
    ]
  );

  const activeScopeOption = useMemo(
    () => scopeOptions.find((opt) => opt.id === selectedScopeId) || scopeOptions[0],
    [scopeOptions, selectedScopeId]
  );

  const activeComparisonScope: ButcherBaselineComparisonScope = useMemo(
    () => activeScopeOption?.scope || { mode: 'auto' },
    [activeScopeOption]
  );

  // Recompute anomaly analysis with draft flags, draft tags, and selected comparison baseline
  const analysis: ButcherOrderAnomalyAnalysis = useMemo(() => {
    return analyzeOrderAnomalies(
      previewOrder,
      matchingRecords,
      patchedOrders,
      recordsByOrderId,
      sensitivity,
      undefined,
      butcherTags,
      activeComparisonScope,
      baselineGroupingMode,
      locationNameById
    );
  }, [
    patchedOrders,
    previewOrder,
    matchingRecords,
    recordsByOrderId,
    sensitivity,
    butcherTags,
    activeComparisonScope,
    baselineGroupingMode,
    locationNameById,
  ]);

  const orderButcherLabel = useMemo(
    () => ((order.locationId || '').trim() ? resolveButcherDisplayName(order.locationId, locationNameById) : null),
    [order.locationId, locationNameById]
  );

  const actualModeStats = useMemo(
    () => computeOrderStatsWithMode(previewOrder, matchingRecords, 'actuals', analysis),
    [previewOrder, matchingRecords, analysis]
  );
  const estimatedModeStats = useMemo(
    () => computeOrderStatsWithMode(previewOrder, matchingRecords, 'estimates', analysis),
    [previewOrder, matchingRecords, analysis]
  );

  const handleToggleFlag = (field: ButcherWeightField) => {
    const current = draftAnomalies[field];
    const next = { ...draftAnomalies };
    if (current?.status === 'flagged') {
      delete next[field];
      if (autoFilledFields[field]) {
        setDraftEstimates((prev) => ({ ...prev, [field]: '' }));
        setAutoFilledFields((prev) => {
          const updated = { ...prev };
          delete updated[field];
          return updated;
        });
      }
    } else {
      const isSuspect = analysis.suspectFields.includes(field);
      next[field] = {
        status: 'flagged',
        flaggedAt: new Date().toISOString(),
        autoDetected: isSuspect,
        reason: current?.reason || (isSuspect ? 'Yield anomaly detected' : 'Flagged during review'),
      };
      // Auto-populate suggested estimate into input if empty and available
      const suggested = analysis.suggestedEstimates[field];
      if (!draftEstimates[field] && suggested && suggested > 0) {
        setDraftEstimates((prev) => ({ ...prev, [field]: String(suggested) }));
        setAutoFilledFields((prev) => ({ ...prev, [field]: true }));
      }
    }
    setDraftAnomalies(next);
  };

  const handleEstimateInputChange = (field: ButcherWeightField, value: string) => {
    setDraftEstimates((prev) => ({ ...prev, [field]: value }));
    if (autoFilledFields[field]) {
      setAutoFilledFields((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleClearEstimate = (field: ButcherWeightField) => {
    setDraftEstimates((prev) => ({ ...prev, [field]: '' }));
    if (autoFilledFields[field]) {
      setAutoFilledFields((prev) => {
        const updated = { ...prev };
        delete updated[field];
        return updated;
      });
    }
  };

  const handleDismissAutoAlert = (field: ButcherWeightField) => {
    setDraftAnomalies((prev) => ({
      ...prev,
      [field]: {
        status: 'dismissed',
        flaggedAt: new Date().toISOString(),
        autoDetected: true,
        reason: prev[field]?.reason || 'Confirmed accurate by user',
      },
    }));
  };

  const handleClearFieldStatus = (field: ButcherWeightField) => {
    setDraftAnomalies((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleReasonChange = (field: ButcherWeightField, reason: string) => {
    setDraftAnomalies((prev) => {
      const existing = prev[field];
      if (!existing) return prev;
      return {
        ...prev,
        [field]: { ...existing, reason },
      };
    });
  };

  const handleApplySuggested = (field: ButcherWeightField) => {
    const suggested = analysis.suggestedEstimates[field];
    if (!suggested || suggested <= 0) return;
    setDraftEstimates((prev) => ({ ...prev, [field]: String(suggested) }));
    setAutoFilledFields((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    if (draftAnomalies[field]?.status !== 'flagged') {
      setDraftAnomalies((prev) => ({
        ...prev,
        [field]: {
          status: 'flagged',
          flaggedAt: new Date().toISOString(),
          autoDetected: analysis.suspectFields.includes(field),
          reason: prev[field]?.reason || 'Replaced with species baseline approximation',
        },
      }));
    }
  };

  const handleToggleIgnoreIssue = (fieldKey: string) => {
    setDraftIgnoredFields((prev) =>
      prev.includes(fieldKey) ? prev.filter((k) => k !== fieldKey) : [...prev, fieldKey]
    );
  };

  const handleToggleDraftTag = (tagId: string) => {
    setDraftTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleSave = (closeAuditOverride?: boolean) => {
    const cleanedAnomalies: ButcherWeightAnomaliesMap = {};
    WEIGHT_FIELDS.forEach((f) => {
      if (draftAnomalies[f]) {
        cleanedAnomalies[f] = draftAnomalies[f];
      }
    });

    const cleanedEstimates: ButcherEstimatedWeights = {};
    let hasAnyEst = false;
    WEIGHT_FIELDS.forEach((f) => {
      const parsed = parseFloat(draftEstimates[f]);
      if (Number.isFinite(parsed) && parsed > 0) {
        cleanedEstimates[f] = Math.round(parsed * 100) / 100;
        hasAnyEst = true;
      }
    });
    if (estimateNote.trim()) {
      cleanedEstimates.note = estimateNote.trim();
      hasAnyEst = true;
    }
    if (hasAnyEst) {
      cleanedEstimates.updatedAt = new Date().toISOString();
    }

    const finalAuditClosed =
      closeAuditOverride !== undefined ? closeAuditOverride : draftAuditClosed;
    const finalAuditClosedAt = finalAuditClosed
      ? order.auditClosedAt || new Date().toISOString()
      : undefined;

    onSave(order.id, {
      weightAnomalies: cleanedAnomalies,
      estimatedWeights: hasAnyEst ? cleanedEstimates : {},
      reviewIgnoredFields: draftIgnoredFields,
      tagIds: draftTagIds,
      auditClosed: finalAuditClosed,
      auditClosedAt: finalAuditClosedAt,
    });
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="butcher-anomaly-review-modal"
      className="fixed inset-0 z-[110] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-cool-gray-900 border border-cool-gray-700 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-cool-gray-850 border-b border-cool-gray-750 shrink-0 gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-extrabold text-white truncate">
                Weight Audit & Yield Review — Order #{order.orderNumber}
              </h2>
              {draftAuditClosed && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
                  <Lock size={11} />
                  Audit Closed
                </span>
              )}
              <span className="text-xs font-semibold text-cool-gray-400">
                {order.species}
                {orderButcherLabel ? ` · ${orderButcherLabel}` : ''} · {order.killDate || 'No Kill Date'} ·{' '}
                {Math.max(1, order.animalCount || 1)}{' '}
                {Math.max(1, order.animalCount || 1) === 1 ? 'animal' : 'animals'}
              </span>
            </div>
            <p className="text-xs text-cool-gray-400 mt-0.5">
              Actual butcher numbers stay intact. Flag inaccurate weights to exclude them from
              averages and apply baseline approximations for reporting.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 rounded-xl transition cursor-pointer shrink-0"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Closed Audit Banner */}
          {draftAuditClosed && (
            <div className="p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-emerald-200">
                    Audit Finalized & Closed
                    {order.auditClosedAt && (
                      <span className="font-normal text-emerald-300/80 ml-1.5">
                        ({new Date(order.auditClosedAt).toLocaleDateString()})
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-200/80">
                    This order is silenced from the Review Queue and anomaly reminders—even when other orders shift baselines or sensitivity changes. Saved flags and estimates remain active in reports.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDraftAuditClosed(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cool-gray-900 hover:bg-cool-gray-800 text-cool-gray-200 border border-cool-gray-700 transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw size={12} />
                Reopen Audit
              </button>
            </div>
          )}

          {/* Diagnostic Findings */}
          <section className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-cool-gray-400 flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-cyan-400" />
                  Automated Yield Diagnostics ({analysis.baselineLabel} ·{' '}
                  {analysis.cleanPeerCount} clean peer{analysis.cleanPeerCount === 1 ? '' : 's'} ·
                  Sensitivity {sensitivity.toFixed(1)}σ)
                </h3>
                <p className="text-[11px] text-cool-gray-500">
                  Recency-weighted across matching peer harvests (2-year half-life) so newer genetics and butchery practices carry more weight than older orders.
                </p>
              </div>
              {analysis.suspectFields.length > 0 ? (
                <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  Likely source:{' '}
                  {analysis.suspectFields.map((f) => BUTCHER_WEIGHT_FIELD_LABELS[f]).join(', ')}
                </span>
              ) : (analysis.adjustedFields.length > 0 || analysis.flaggedFields.length > 0) &&
                !analysis.needsReview ? (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Conflicts resolved — remaining weights normal
                </span>
              ) : null}
            </div>

            {/* Baseline Comparison Selector & Quick Order Tag Toggles */}
            {(scopeOptions.length > 1 || butcherTags.length > 0) && (
              <div className="p-3.5 rounded-xl bg-cool-gray-850 border border-cool-gray-750 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                  <div className="space-y-1">
                    <label
                      htmlFor="butcher-audit-baseline-scope"
                      className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-400"
                    >
                      Compare Against Baseline
                    </label>
                    <select
                      id="butcher-audit-baseline-scope"
                      value={activeScopeOption?.id || 'auto'}
                      onChange={(e) => setSelectedScopeId(e.target.value)}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-lg px-3 py-2 text-xs font-semibold text-white outline-none focus:border-cyan-500"
                    >
                      {scopeOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} ({opt.cleanPeerCount} peer{opt.cleanPeerCount === 1 ? '' : 's'})
                        </option>
                      ))}
                    </select>
                    {activeScopeOption?.description && (
                      <p className="text-[11px] text-cool-gray-500 leading-snug">
                        {activeScopeOption.description}
                      </p>
                    )}
                  </div>

                  {butcherTags.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-cool-gray-400 flex items-center gap-1.5">
                          <TagIcon size={12} className="text-cyan-400" />
                          Order Event Tags (Live Preview)
                        </span>
                        <span className="text-[10px] text-cool-gray-500">
                          Saved with audit
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {butcherTags.map((tag) => {
                          const isSelected = draftTagIds.includes(tag.id);
                          const modeHint =
                            tag.weightCheckMode === 'separate_baseline'
                              ? 'Split'
                              : tag.weightCheckMode === 'exclude_from_baseline'
                                ? 'Exclude'
                                : null;
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => handleToggleDraftTag(tag.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                                isSelected
                                  ? 'bg-cool-gray-800 border-cyan-500/70 text-white shadow-xs'
                                  : 'bg-cool-gray-950 border-cool-gray-750 text-cool-gray-400 hover:text-cool-gray-200 hover:border-cool-gray-600'
                              }`}
                              title={
                                tag.weightCheckMode === 'separate_baseline'
                                  ? 'Uses a separate cohort baseline for yield checks'
                                  : tag.weightCheckMode === 'exclude_from_baseline'
                                    ? 'Excludes order from statistical species baseline alerts'
                                    : 'Standard tag for filtering and reporting'
                              }
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: tag.color || '#06b6d4' }}
                              />
                              <span>{tag.name}</span>
                              {modeHint && (
                                <span className="text-[10px] text-cool-gray-400 font-normal">
                                  · {modeHint}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notice when statistical alerts are paused by an Exclude tag in Auto mode */}
            {analysis.excludedFromStatisticalBaseline && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
                <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-amber-100">
                    Statistical yield checks paused by tag:{' '}
                    {analysis.excludedByTags.map((t) => t.name).join(', ')}
                  </div>
                  <p className="text-[11px] text-amber-200/80">
                    Physical weight constraints (e.g., Cold ≤ Hot ≤ Live) still run automatically. To run a manual statistical comparison anyway, select any baseline from the dropdown above.
                  </p>
                </div>
              </div>
            )}

            {analysis.findings.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-cool-gray-850 border border-cool-gray-750 flex items-center justify-between gap-3 text-xs text-cool-gray-300">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>
                    {analysis.excludedFromStatisticalBaseline
                      ? `No physical weight conflicts found. Statistical alerts are excluded in Auto mode.`
                      : analysis.adjustedFields.length > 0
                        ? `All physical weight checks and ${analysis.baselineLabel} yields pass using your adjusted estimates.`
                        : analysis.cleanPeerCount >= 3
                          ? `All reported carcass yields align within ${sensitivity.toFixed(1)}σ of your recency-weighted ${analysis.baselineLabel} history. You can still manually flag or estimate any weight below.`
                          : `No physical weight conflicts found. Statistical comparison activates once 3+ clean orders exist in ${analysis.baselineLabel} (currently ${analysis.cleanPeerCount}). Manual flagging is available below.`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-cool-gray-800 rounded-xl border border-cool-gray-750 bg-cool-gray-850 overflow-hidden">
                {analysis.findings.map((finding) => (
                  <div
                    key={finding.id}
                    className="p-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {finding.severity === 'critical' ? (
                        <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <p className="font-semibold text-cool-gray-100">{finding.message}</p>
                        <p className="text-[11px] text-cool-gray-400">
                          {finding.type === 'physical'
                            ? 'Physical weight constraint violation'
                            : finding.type === 'manual'
                              ? 'Manual anomaly flag (excluded from baseline averages)'
                              : `Statistically significant yield deviation vs. clean ${analysis.baselineLabel} peers`}
                          {finding.likelyFields.length > 0 &&
                            ` · Suspect: ${finding.likelyFields
                              .map((lf) => BUTCHER_WEIGHT_FIELD_LABELS[lf])
                              .join(', ')}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Weight Audit & Estimation Table */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cool-gray-400 flex items-center gap-1.5">
                <Calculator size={14} className="text-cyan-400" />
                Carcass Weights, Flags & Baseline Approximations
              </h3>
              <span className="text-[11px] text-cool-gray-500">
                All weights in lbs (total order weight)
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-cool-gray-750 bg-cool-gray-850">
              <table className="w-full text-left text-xs">
                <thead className="bg-cool-gray-900/70 text-cool-gray-400 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Weight Stage</th>
                    <th className="px-4 py-3 font-bold text-right">Actual Reported</th>
                    <th className="px-4 py-3 font-bold">Audit Status</th>
                    <th className="px-4 py-3 font-bold text-right">Suggested Approx.</th>
                    <th className="px-4 py-3 font-bold">Corrected Estimate (lbs)</th>
                    <th className="px-4 py-3 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cool-gray-800">
                  {WEIGHT_FIELDS.map((field) => {
                    const actualVal = analysis.actualWeights[field];
                    const flagState = draftAnomalies[field];
                    const isFlagged = flagState?.status === 'flagged';
                    const isDismissed = flagState?.status === 'dismissed';
                    const isSuspect =
                      analysis.suspectFields.includes(field) && !isFlagged && !isDismissed;
                    const suggestedVal = analysis.suggestedEstimates[field];
                    const explanation = analysis.estimateExplanations[field];

                    return (
                      <tr key={field} className="align-top">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-white">
                            {BUTCHER_WEIGHT_FIELD_LABELS[field]}
                          </div>
                          {field === 'packagedWeight' && (
                            <div className="text-[11px] text-cool-gray-500 mt-0.5">
                              Sum of {matchingRecords.length} cut records
                            </div>
                          )}
                          {isFlagged && (
                            <input
                              type="text"
                              value={flagState?.reason || ''}
                              onChange={(e) => handleReasonChange(field, e.target.value)}
                              placeholder="Optional reason (e.g. butcher confirmed scale typo)"
                              className="mt-2 w-full bg-cool-gray-950 border border-cool-gray-700 rounded-lg px-2.5 py-1 text-[11px] text-cool-gray-200 outline-none focus:border-cyan-500"
                            />
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right font-mono tabular-nums font-bold text-white whitespace-nowrap">
                          <div>{actualVal > 0 ? `${actualVal.toFixed(1)} lbs` : '—'}</div>
                          {analysis.adjustedFields.includes(field) && (
                            <div className="text-[10px] font-semibold text-cyan-400 mt-0.5">
                              Eval: {analysis.effectiveWeights[field].toFixed(1)} lbs
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          {isFlagged ? (
                            <span className="inline-flex items-center gap-1.5 text-rose-400 font-bold">
                              <Flag size={13} />
                              Flagged Wrong
                            </span>
                          ) : isDismissed ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
                              <ShieldCheck size={13} />
                              Confirmed Valid
                            </span>
                          ) : isSuspect ? (
                            <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold">
                              <AlertTriangle size={13} />
                              Suspect Outlier
                            </span>
                          ) : (
                            <span className="text-cool-gray-400 font-medium">Normal</span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          {suggestedVal ? (
                            <div className="space-y-1">
                              <div className="font-mono tabular-nums font-bold text-cyan-400 whitespace-nowrap">
                                ~{suggestedVal.toFixed(1)} lbs
                              </div>
                              {explanation && (
                                <div className="text-[10px] text-cool-gray-500 max-w-[240px] ml-auto leading-tight">
                                  {explanation}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span
                              className="text-cool-gray-500 text-[11px]"
                              title="Requires at least 1 other unflagged order of this species with matching weight stages (never estimates from the current order's own ratio)."
                            >
                              Need peer baseline
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={draftEstimates[field]}
                                onChange={(e) => handleEstimateInputChange(field, e.target.value)}
                                placeholder={suggestedVal ? suggestedVal.toFixed(1) : 'Estimate'}
                                className="w-28 bg-cool-gray-950 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 pr-6 text-xs font-mono tabular-nums text-white outline-none focus:border-cyan-500"
                              />
                              {draftEstimates[field] && (
                                <button
                                  type="button"
                                  onClick={() => handleClearEstimate(field)}
                                  className="absolute right-1.5 text-cool-gray-500 hover:text-white transition cursor-pointer"
                                  title="Clear estimate and revert to actual weight"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            {suggestedVal && (
                              <button
                                type="button"
                                onClick={() => handleApplySuggested(field)}
                                className="px-2 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer"
                                title="Apply suggested approximation and flag actual weight"
                              >
                                Use Suggested
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleToggleFlag(field)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition whitespace-nowrap cursor-pointer border ${
                                isFlagged
                                  ? 'bg-rose-600/20 text-rose-300 border-rose-500/40 hover:bg-rose-600/30'
                                  : 'bg-cool-gray-800 text-cool-gray-200 border-cool-gray-700 hover:border-rose-500/50 hover:text-rose-300'
                              }`}
                            >
                              {isFlagged ? 'Unflag' : 'Flag Wrong'}
                            </button>

                            {isSuspect && (
                              <button
                                type="button"
                                onClick={() => handleDismissAutoAlert(field)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-600/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/25 transition whitespace-nowrap cursor-pointer"
                              >
                                Confirm Valid
                              </button>
                            )}

                            {isDismissed && (
                              <button
                                type="button"
                                onClick={() => handleClearFieldStatus(field)}
                                className="p-1.5 rounded-lg text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 transition cursor-pointer"
                                title="Reset confirmation status"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Actuals vs Corrected Yield Impact Comparison */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-cool-gray-850 border border-cool-gray-750 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cool-gray-400">
                Yield Impact Preview (Actuals vs. Corrected)
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="text-[11px] text-cool-gray-400">Dressing (Hot/Live)</div>
                  <div className="font-mono tabular-nums font-bold text-white">
                    {actualModeStats.stats.hotWeightYield > 0
                      ? `${actualModeStats.stats.hotWeightYield.toFixed(1)}%`
                      : '—'}
                    {estimatedModeStats.usedEstimates &&
                      estimatedModeStats.stats.hotWeightYield !==
                        actualModeStats.stats.hotWeightYield && (
                        <span className="text-cyan-400 ml-1.5">
                          → {estimatedModeStats.stats.hotWeightYield.toFixed(1)}%
                        </span>
                      )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-cool-gray-400">Cooler Shrink %</div>
                  <div className="font-mono tabular-nums font-bold text-white">
                    {actualModeStats.stats.coolerShrinkage > 0
                      ? `${actualModeStats.stats.coolerShrinkage.toFixed(1)}%`
                      : '—'}
                    {estimatedModeStats.usedEstimates &&
                      estimatedModeStats.stats.coolerShrinkage !==
                        actualModeStats.stats.coolerShrinkage && (
                        <span className="text-cyan-400 ml-1.5">
                          → {estimatedModeStats.stats.coolerShrinkage.toFixed(1)}%
                        </span>
                      )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-cool-gray-400">Cutting Yield (Pack/Cold)</div>
                  <div className="font-mono tabular-nums font-bold text-white">
                    {actualModeStats.stats.cuttingYield > 0
                      ? `${actualModeStats.stats.cuttingYield.toFixed(1)}%`
                      : '—'}
                    {estimatedModeStats.usedEstimates &&
                      estimatedModeStats.stats.cuttingYield !==
                        actualModeStats.stats.cuttingYield && (
                        <span className="text-cyan-400 ml-1.5">
                          → {estimatedModeStats.stats.cuttingYield.toFixed(1)}%
                        </span>
                      )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-cool-gray-400">Standing Yield (Pack/Live)</div>
                  <div className="font-mono tabular-nums font-bold text-white">
                    {actualModeStats.stats.finishToLiveYield > 0
                      ? `${actualModeStats.stats.finishToLiveYield.toFixed(1)}%`
                      : '—'}
                    {estimatedModeStats.usedEstimates &&
                      estimatedModeStats.stats.finishToLiveYield !==
                        actualModeStats.stats.finishToLiveYield && (
                        <span className="text-cyan-400 ml-1.5">
                          → {estimatedModeStats.stats.finishToLiveYield.toFixed(1)}%
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-cool-gray-850 border border-cool-gray-750 space-y-2.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-cool-gray-400">
                Estimation / Audit Note
              </label>
              <textarea
                rows={3}
                value={estimateNote}
                onChange={(e) => setEstimateNote(e.target.value)}
                placeholder="Document why weights were flagged or how approximations were confirmed with the butcher..."
                className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500 resize-none"
              />
            </div>
          </section>

          {/* Finalization / Backlog Completeness Checklist */}
          {reviewIssues.filter((i) => i.category !== 'anomaly').length > 0 && (
            <section className="p-4 rounded-xl bg-cool-gray-850 border border-cool-gray-750 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-cool-gray-400">
                  Order Finalization Backlog
                </h4>
                {onOpenEditOrder && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEditOrder(order);
                    }}
                    className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-700 text-cyan-400 border border-cool-gray-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Edit3 size={13} />
                    Edit Order Details
                  </button>
                )}
              </div>
              <div className="divide-y divide-cool-gray-800">
                {reviewIssues
                  .filter((i) => i.category !== 'anomaly')
                  .map((issue) => {
                    const isIgnored = draftIgnoredFields.includes(issue.fieldKey);
                    return (
                      <div
                        key={issue.id}
                        className="py-2 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-cool-gray-200">{issue.title}</div>
                          <div className="text-[11px] text-cool-gray-400">{issue.description}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleIgnoreIssue(issue.fieldKey)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                            isIgnored
                              ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-cool-gray-900 text-cool-gray-300 border-cool-gray-700 hover:text-white'
                          }`}
                        >
                          <Check size={12} />
                          {isIgnored ? 'Marked N/A' : 'Mark N/A'}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-cool-gray-850 border-t border-cool-gray-750 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="text-xs text-cool-gray-400">
            {WEIGHT_FIELDS.filter((f) => draftAnomalies[f]?.status === 'flagged').length} flagged ·{' '}
            {
              WEIGHT_FIELDS.filter((f) => {
                const n = parseFloat(draftEstimates[f]);
                return Number.isFinite(n) && n > 0;
              }).length
            }{' '}
            custom estimate(s) saved
            {butcherTags.length > 0 && ` · ${draftTagIds.length} tag${draftTagIds.length === 1 ? '' : 's'}`}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-cool-gray-300 bg-cool-gray-800 hover:bg-cool-gray-700 border border-cool-gray-700 transition cursor-pointer"
            >
              Cancel
            </button>
            {draftAuditClosed ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 transition cursor-pointer flex items-center gap-1.5"
                  title="Save changes and reopen this order for active Review Queue monitoring"
                >
                  <RotateCcw size={13} />
                  Reopen & Save
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition shadow-sm cursor-pointer"
                  title="Save flags, estimates, and tags while keeping this order open for future review"
                >
                  Save Audit
                </button>
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-sm cursor-pointer flex items-center gap-1.5"
                  title="Save and close this audit so it will no longer appear in the Review Queue or alert when other orders change"
                >
                  <Lock size={13} />
                  Save & Close Audit
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
