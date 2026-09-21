import React, { useState, useMemo, useEffect } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  Clock,
  User,
  X,
  Loader2,
  Info,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Package,
  Box,
  MapPin,
  History,
  CheckCircle2,
  Layers,
  AlertCircle
} from 'lucide-react';
import { UndoSnapshotItem, HistoryEntry, InventoryState, MeatCut, Container, Product, Freezer } from '../types';

interface UndoConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recentSnapshots: UndoSnapshotItem[];
  historyEntries: HistoryEntry[];
  state?: InventoryState;
  onConfirmUndo: (snapshotId?: string, historyId?: string) => Promise<{ success: boolean; undoneDescription?: string; error?: string }>;
  preselectedSnapshotId?: string | null;
  preselectedHistoryId?: string | null;
}

export const UndoConfirmationModal: React.FC<UndoConfirmationModalProps> = ({
  isOpen,
  onClose,
  recentSnapshots,
  historyEntries,
  state,
  onConfirmUndo,
  preselectedSnapshotId,
  preselectedHistoryId
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConflictDetails, setShowConflictDetails] = useState(false);

  // Reset internal states on open/close
  useEffect(() => {
    if (isOpen) {
      setIsProcessing(false);
      setErrorMessage(null);
      setShowConflictDetails(false);
    }
  }, [isOpen]);

  // Determine the target snapshot to undo
  const targetSnapshot = useMemo(() => {
    if (preselectedSnapshotId) {
      return recentSnapshots.find(s => s.id === preselectedSnapshotId) || null;
    }
    if (preselectedHistoryId) {
      const match = recentSnapshots.find(s => s.historyId === preselectedHistoryId || s.targetId === preselectedHistoryId);
      if (match) return match;
      const hist = historyEntries.find(h => h.id === preselectedHistoryId);
      if (hist) {
        return {
          id: hist.id,
          historyId: hist.id,
          actionType: (hist as any).undoData?.type || 'AUDIT_LOG_ACTION',
          description: hist.description,
          timestamp: hist.timestamp,
          user: hist.user || 'User',
          targetId: hist.targetId,
          createdAt: new Date(hist.timestamp).getTime() || Date.now()
        };
      }
    }
    return recentSnapshots[0] || null;
  }, [preselectedSnapshotId, preselectedHistoryId, recentSnapshots, historyEntries]);

  // Target historical audit entry with its rich undoData
  const targetHistoryEntry = useMemo(() => {
    const targetId = preselectedHistoryId || targetSnapshot?.historyId || targetSnapshot?.id;
    if (targetId) {
      return historyEntries.find(h => h.id === targetId) || null;
    }
    if (historyEntries.length > 0) {
      return historyEntries[0];
    }
    return null;
  }, [preselectedHistoryId, targetSnapshot, historyEntries]);

  // Determine the position in the chronological history (0 = newest / latest action)
  const historyIndex = useMemo(() => {
    if (!targetHistoryEntry) return -1;
    return historyEntries.findIndex(h => h.id === targetHistoryEntry.id);
  }, [targetHistoryEntry, historyEntries]);

  // Downstream Conflict Analysis: Find actions recorded AFTER this entry (index 0 to historyIndex - 1)
  const downstreamAnalysis = useMemo(() => {
    if (historyIndex <= 0 || !targetHistoryEntry) {
      return {
        hasDownstream: false,
        stepsBack: 0,
        subsequentCount: 0,
        conflictingEntries: [] as HistoryEntry[]
      };
    }

    const stepsBack = historyIndex;
    const subsequentEntries = historyEntries.slice(0, historyIndex);

    // Extract target entity identifiers from undoData or description
    const undoData = targetHistoryEntry.undoData || {};
    const relevantCutIds = new Set<string>();
    const relevantProductIds = new Set<string>();
    const relevantContainerIds = new Set<string>();

    if (undoData.meatCutId) relevantCutIds.add(undoData.meatCutId);
    if (undoData.sourceCutId) relevantCutIds.add(undoData.sourceCutId);
    if (undoData.destCutId) relevantCutIds.add(undoData.destCutId);
    if (undoData.originalCutId) relevantCutIds.add(undoData.originalCutId);
    if (undoData.createdSplitCutId) relevantCutIds.add(undoData.createdSplitCutId);
    if (targetHistoryEntry.targetId && !targetHistoryEntry.targetId.startsWith('local-')) {
      relevantCutIds.add(targetHistoryEntry.targetId);
    }

    if (undoData.productId) relevantProductIds.add(undoData.productId);
    if (undoData.previousProductId) relevantProductIds.add(undoData.previousProductId);

    if (undoData.containerId) relevantContainerIds.add(undoData.containerId);
    if (undoData.container?.id) relevantContainerIds.add(undoData.container.id);
    if (undoData.sourceContainer?.id) relevantContainerIds.add(undoData.sourceContainer.id);

    // Also look up associated product / container from state to cross-check by name
    let productName = '';
    if (state && undoData.productId) {
      const p = state.products?.find(pr => pr.id === undoData.productId);
      if (p) productName = p.name.toLowerCase();
    }
    let containerName = '';
    if (state && undoData.containerId) {
      const c = state.containers?.find(co => co.id === undoData.containerId);
      if (c) containerName = c.name.toLowerCase();
    }

    const conflictingEntries: HistoryEntry[] = [];

    for (const sub of subsequentEntries) {
      const subUndo = sub.undoData || {};
      let isConflict = false;

      // Direct ID matches
      if (sub.targetId && (relevantCutIds.has(sub.targetId) || relevantContainerIds.has(sub.targetId) || relevantProductIds.has(sub.targetId))) {
        isConflict = true;
      } else if (subUndo.meatCutId && relevantCutIds.has(subUndo.meatCutId)) {
        isConflict = true;
      } else if (subUndo.sourceCutId && relevantCutIds.has(subUndo.sourceCutId)) {
        isConflict = true;
      } else if (subUndo.containerId && relevantContainerIds.has(subUndo.containerId)) {
        isConflict = true;
      } else if (subUndo.productId && relevantProductIds.has(subUndo.productId)) {
        isConflict = true;
      } else {
        // Text keyword heuristic if names match
        const descLower = (sub.description || '').toLowerCase();
        if (productName && productName.length > 3 && descLower.includes(productName)) {
          isConflict = true;
        } else if (containerName && containerName.length > 3 && descLower.includes(containerName)) {
          isConflict = true;
        }
      }

      if (isConflict) {
        conflictingEntries.push(sub);
      }
    }

    return {
      hasDownstream: stepsBack > 0,
      stepsBack,
      subsequentCount: subsequentEntries.length,
      conflictingEntries
    };
  }, [historyIndex, targetHistoryEntry, historyEntries, state]);

  // Compute Current State vs Proposed State Comparison
  const stateComparison = useMemo(() => {
    if (!state || !targetHistoryEntry) return null;

    const undoData = targetHistoryEntry.undoData || {};
    const undoType = undoData.type || '';

    // 1. Meat Cut Quantity Update or Reconciliation
    if (undoType === 'RESTORE_MEAT_CUT_QUANTITY' || undoType === 'UPDATE_MEAT_QUANTITY') {
      const cutId = undoData.meatCutId || targetHistoryEntry.targetId;
      const liveCut = state.meatCuts?.find(c => c.id === cutId);
      const targetProductId = undoData.productId || liveCut?.productId;
      const product = state.products?.find(p => p.id === targetProductId);
      const targetContainerId = undoData.containerId || liveCut?.containerId;
      const liveContainer = state.containers?.find(c => c.id === targetContainerId);
      const liveFreezer = state.freezers?.find(f => f.id === liveContainer?.freezerId);

      const prevQty = Number(undoData.previousQuantity ?? 0);
      const currentQty = liveCut ? liveCut.quantity : 0;
      const qtyDiff = prevQty - currentQty;

      const currentLocStr = liveContainer
        ? `${liveContainer.name}${liveFreezer ? ` (${liveFreezer.name})` : liveContainer.isArchived ? ' [Archived]' : ''}`
        : 'Removed / Not Placed';

      let targetLocStr = currentLocStr;
      if (undoData.container) {
        const targetFreezer = state.freezers?.find(f => f.id === (undoData.container.previousFreezerId || undoData.container.freezerId));
        targetLocStr = `${undoData.container.name || 'Container'}${targetFreezer ? ` (${targetFreezer.name})` : ''} [Will be unarchived]`;
      }

      return {
        entityType: 'Item Quantity',
        title: product?.name || undoData.originalCutName || 'Inventory Cut',
        subtitle: undoData.notes ? `Note: "${undoData.notes}"` : undefined,
        current: {
          quantityText: currentQty > 0 ? `${currentQty} pkgs in stock` : '0 pkgs (Not in active inventory)',
          locationText: currentLocStr,
          statusText: currentQty > 0 ? 'Active' : 'Empty / Consumed'
        },
        proposed: {
          quantityText: `${prevQty} pkgs (${qtyDiff > 0 ? `+${qtyDiff}` : qtyDiff < 0 ? `${qtyDiff}` : 'no change'})`,
          locationText: targetLocStr,
          statusText: prevQty > 0 ? 'Restored to inventory' : 'Removed from inventory',
          isAddition: qtyDiff > 0,
          isReduction: qtyDiff < 0
        }
      };
    }

    // 2. Meat Cut Move
    if (undoType === 'RESTORE_MOVE_MEAT') {
      const sourceCut = state.meatCuts?.find(c => c.id === undoData.sourceCutId);
      const destCut = state.meatCuts?.find(c => c.id === undoData.destCutId);
      const product = state.products?.find(p => p.id === sourceCut?.productId || p.id === destCut?.productId);

      const prevSourceQty = Number(undoData.prevSourceQuantity ?? 0);
      const currentSourceQty = sourceCut ? sourceCut.quantity : 0;

      const sourceContainer = state.containers?.find(c => c.id === (sourceCut?.containerId || undoData.sourceContainer?.id));
      const destContainer = state.containers?.find(c => c.id === destCut?.containerId);

      return {
        entityType: 'Item Movement',
        title: product?.name || 'Moved Cut',
        subtitle: `Move reversion`,
        current: {
          quantityText: `Source: ${currentSourceQty} pkgs, Dest: ${destCut?.quantity || 0} pkgs`,
          locationText: `Dest: ${destContainer?.name || 'Target Bin'}`,
          statusText: 'Moved'
        },
        proposed: {
          quantityText: `Source restored to ${prevSourceQty} pkgs`,
          locationText: `Restored to ${sourceContainer?.name || undoData.sourceContainer?.name || 'Original Container'}`,
          statusText: 'Reverted to source location',
          isAddition: true
        }
      };
    }

    // 3. Container Archival / Restore
    if (undoType === 'RESTORE_EMPTIED_CONTAINER' || undoType === 'RESTORE_CONTAINER_ARCHIVE') {
      const containerId = undoData.containerId;
      const liveContainer = state.containers?.find(c => c.id === containerId);
      const targetFreezer = state.freezers?.find(f => f.id === (undoData.previousFreezerId || undoData.container?.freezerId));

      return {
        entityType: 'Container Status',
        title: liveContainer?.name || undoData.container?.name || 'Container',
        current: {
          quantityText: `${(state.meatCuts || []).filter(c => c.containerId === containerId).length} cuts currently inside`,
          locationText: liveContainer?.isArchived ? 'Archived / Retired' : 'Active',
          statusText: liveContainer?.isArchived ? 'Archived' : 'Active'
        },
        proposed: {
          quantityText: 'Restores container active state',
          locationText: targetFreezer ? `Active in ${targetFreezer.name}` : 'Unarchived',
          statusText: 'Unarchived & returned to freezer',
          isAddition: true
        }
      };
    }

    // Generic fallback comparison from description
    return null;
  }, [state, targetHistoryEntry]);

  if (!isOpen) return null;

  const handleExecuteUndo = async () => {
    const histId = targetHistoryEntry?.id || targetSnapshot?.historyId || preselectedHistoryId || undefined;
    const snapId = targetSnapshot?.id || undefined;

    if (!targetSnapshot && !histId) {
      setErrorMessage('No action found to undo.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await onConfirmUndo(snapId, histId);
      setIsProcessing(false);

      if (result.success) {
        onClose();
      } else {
        setErrorMessage(result.error || 'Failed to rollback action.');
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Unexpected error during undo.');
    }
  };

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      let relative = '';
      if (diffMins < 1) relative = 'Just now';
      else if (diffMins < 60) relative = `${diffMins}m ago`;
      else if (diffHours < 24) relative = `${diffHours}h ago`;
      else relative = `${Math.floor(diffHours / 24)}d ago`;

      return `${relative} (${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    } catch {
      return isoString;
    }
  };

  const displayDescription = targetSnapshot?.description || targetHistoryEntry?.description || 'Last inventory action';
  const displayUser = targetSnapshot?.user || targetHistoryEntry?.user || 'User';
  const displayTime = targetSnapshot?.timestamp || targetHistoryEntry?.timestamp;
  const canUndo = Boolean(targetSnapshot || targetHistoryEntry);

  return (
    <div
      id="undo-confirmation-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isProcessing) onClose();
      }}
    >
      <div
        id="undo-confirmation-modal-dialog"
        className="relative w-full max-w-xl bg-cool-gray-900 border border-cool-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-cool-gray-100 animate-scale-up max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cool-gray-800 bg-cool-gray-950/70">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl border ${canUndo ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-cool-gray-800 border-cool-gray-700 text-cool-gray-400'}`}>
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-cool-gray-100 flex items-center gap-2">
                {downstreamAnalysis.hasDownstream ? 'Undo Historical Action' : 'Undo Last Action'}
              </h2>
              <p className="text-xs text-cool-gray-400">
                {downstreamAnalysis.hasDownstream
                  ? `Reverting an action from ${downstreamAnalysis.stepsBack} step(s) ago`
                  : 'Review and confirm the change to revert'}
              </p>
            </div>
          </div>

          <button
            id="close-undo-modal-button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-cool-gray-400 hover:text-cool-gray-200 hover:bg-cool-gray-800 rounded-lg transition-colors cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(92vh-140px)]">
          {/* Error banner */}
          {errorMessage && (
            <div
              id="undo-error-banner"
              className="p-3.5 rounded-xl border bg-rose-950/40 border-rose-500/40 text-rose-300 flex items-center gap-3 text-xs leading-relaxed"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {canUndo ? (
            <>
              {/* Downstream Conflict Alert Banner */}
              {downstreamAnalysis.conflictingEntries.length > 0 ? (
                <div
                  id="downstream-conflict-warning-card"
                  className="p-4 rounded-xl border bg-amber-950/40 border-amber-500/40 text-amber-200 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>Downstream Conflict Detected ({downstreamAnalysis.conflictingEntries.length} newer modification(s))</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConflictDetails(!showConflictDetails)}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showConflictDetails ? 'Hide Details' : 'View Subsequent Logs'}</span>
                      {showConflictDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-xs text-amber-300/90 leading-relaxed">
                    This item or container was modified <strong>{downstreamAnalysis.conflictingEntries.length} time(s)</strong> after this event. Undoing this historical log may overwrite or conflict with those newer changes.
                  </p>

                  {/* Expandable subsequent conflict logs */}
                  {showConflictDetails && (
                    <div className="mt-2 pt-2 border-t border-amber-500/30 space-y-1.5 max-h-36 overflow-y-auto">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">
                        Subsequent Actions on this Entity:
                      </div>
                      {downstreamAnalysis.conflictingEntries.map((sub, idx) => (
                        <div
                          key={sub.id || idx}
                          className="text-[11px] bg-amber-950/60 p-2 rounded-lg border border-amber-500/20 text-cool-gray-200 flex flex-col gap-0.5"
                        >
                          <div className="flex justify-between items-center text-[10px] text-amber-300/80">
                            <span>👤 {sub.user || 'User'}</span>
                            <span className="font-mono">{formatTimestamp(sub.timestamp)}</span>
                          </div>
                          <div className="font-medium">{sub.description}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : downstreamAnalysis.hasDownstream ? (
                <div
                  id="historical-undo-notice"
                  className="p-3 rounded-xl border bg-cyan-950/30 border-cyan-700/40 text-cyan-300 flex items-center gap-2.5 text-xs"
                >
                  <History className="w-4 h-4 shrink-0 text-cyan-400" />
                  <span>
                    Historical Action (<strong>{downstreamAnalysis.stepsBack} step(s) back</strong>). No direct downstream conflicts detected for this specific item.
                  </span>
                </div>
              ) : (
                <div
                  id="immediate-undo-notice"
                  className="p-2.5 rounded-xl border bg-emerald-950/30 border-emerald-700/40 text-emerald-300 flex items-center gap-2 text-xs font-medium"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Most recent action • Immediate, safe rollback</span>
                </div>
              )}

              {/* Action Overview Card */}
              <div className="p-4 rounded-xl bg-cool-gray-950 border border-cool-gray-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-cool-gray-400">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-cool-gray-500" />
                    <strong className="text-cool-gray-200">{displayUser}</strong>
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-cool-gray-500" />
                    {formatTimestamp(displayTime)}
                  </span>
                </div>

                <div className="text-sm font-semibold text-cool-gray-100 leading-snug bg-cool-gray-900/90 p-3 rounded-lg border border-cool-gray-750">
                  "{displayDescription}"
                </div>
              </div>

              {/* Status Comparison: Current Live State vs State After Undo */}
              {stateComparison && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-cool-gray-300 px-1">
                    <span className="flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{stateComparison.entityType}: {stateComparison.title}</span>
                    </span>
                    <span className="text-[11px] font-normal text-cool-gray-400">Preview of State Changes</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Column 1: Current Live Status */}
                    <div className="p-3.5 rounded-xl bg-cool-gray-950/80 border border-cool-gray-800 space-y-2">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-cool-gray-400 flex items-center gap-1">
                        <Box className="w-3 h-3 text-cool-gray-500" />
                        <span>Current Live Status</span>
                      </div>
                      <div className="text-xs font-bold text-cool-gray-200">
                        {stateComparison.current.quantityText}
                      </div>
                      <div className="text-[11px] text-cool-gray-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-cool-gray-500 shrink-0" />
                        <span className="truncate">{stateComparison.current.locationText}</span>
                      </div>
                    </div>

                    {/* Column 2: After Undo (Proposed) */}
                    <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <RotateCcw className="w-3 h-3 text-amber-400" />
                        <span>State After Undo</span>
                      </div>
                      <div className="text-xs font-bold text-amber-300">
                        {stateComparison.proposed.quantityText}
                      </div>
                      <div className="text-[11px] text-amber-200/80 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{stateComparison.proposed.locationText}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-xs text-cool-gray-400 leading-relaxed px-1">
                Reverting will restore the cut quantities, locations, and container states as recorded in this audit log snapshot.
              </div>
            </>
          ) : (
            <div className="py-6 text-center space-y-3">
              <div className="inline-flex p-3 rounded-full bg-cool-gray-800 text-cool-gray-400">
                <Info className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-cool-gray-200">Nothing to Undo</h3>
              <p className="text-xs text-cool-gray-400 max-w-sm mx-auto leading-relaxed">
                There are no actions available to undo in active history.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-cool-gray-800 bg-cool-gray-950/70">
          <button
            id="cancel-undo-button"
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            {canUndo ? 'Cancel' : 'Close'}
          </button>

          {canUndo && (
            <button
              id="confirm-undo-button"
              type="button"
              onClick={handleExecuteUndo}
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-cool-gray-950 flex items-center gap-2 shadow-lg shadow-amber-500/10 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Reverting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  {downstreamAnalysis.conflictingEntries.length > 0 ? 'Confirm Undo (Apply Changes)' : 'Confirm Undo'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

