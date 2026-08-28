import React, { useState, useMemo, useEffect } from 'react';
import { Truck, Calendar, Info, CheckCircle2, RotateCcw, ChevronRight, ChevronDown, Inbox, Clock, ListCollapse, Printer, FileText, X, Plus } from 'lucide-react';
import { InventoryState, Action, MovementOrder } from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { MovementReportModal, getEntryCutName } from './MovementReportModal';
import { compareBoxLabels } from '../utils/boxSort';

interface OffSiteMovementHistoryProps {
  state: InventoryState;
  dispatch: (action: Action) => Promise<boolean>;
  onPlanNewMovement: () => void;
}

export const OffSiteMovementHistory: React.FC<OffSiteMovementHistoryProps> = ({ state, dispatch, onPlanNewMovement }) => {
  const orders = state.movementOrders || [];
  const entries = state.offSiteEntries || [];

  const hasActiveMovement = useMemo(() => {
    return orders.some(o => o.status === 'planning' || o.status === 'finalized');
  }, [orders]);

  const completedOrders = useMemo(() => {
    return orders
      .filter(o => o.status === 'completed')
      .sort((a, b) => {
        const dateA = a.executedAt ? new Date(a.executedAt).getTime() : 0;
        const dateB = b.executedAt ? new Date(b.executedAt).getTime() : 0;
        return dateB - dateA; // Most recent first
      });
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [expandedBoxes, setExpandedBoxes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedBoxes({});
  }, [selectedOrderId]);

  // Auto-select the first completed order if there's any and none is selected
  useMemo(() => {
    if (completedOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(completedOrders[0].id);
    }
  }, [completedOrders, selectedOrderId]);

  const selectedOrder = completedOrders.find(o => o.id === selectedOrderId);

  // Report center states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [activeReportTab, setActiveReportTab] = useState<'delivery_slip' | 'manifest'>('delivery_slip');
  const [selectedDestinationId, setSelectedDestinationId] = useState<string>('');
  const [editablePo, setEditablePo] = useState('');
  const [editableItems, setEditableItems] = useState('');

  const destinationsInPlay = useMemo(() => {
    if (!selectedOrder) return [];
    
    // 1. Check targetDestinations first
    if (selectedOrder.targetDestinations && selectedOrder.targetDestinations.length > 0) {
      return selectedOrder.targetDestinations;
    }
    
    // 2. Fallback to extracting from moves
    const destIds = Array.from(new Set(selectedOrder.moves.map(m => m.actualLocation || m.targetLocation).filter(Boolean)));
    return destIds.map(id => {
      const loc = state.locations?.find(l => l.id === id);
      return {
        id,
        locationId: id,
        locationName: loc?.name || id,
        palletName: undefined
      };
    });
  }, [selectedOrder, state.locations]);

  const destinationMoves = useMemo(() => {
    if (!selectedOrder) return [];
    if (!selectedDestinationId) return selectedOrder.moves || [];
    return selectedOrder.moves.filter(m => {
      const destId = m.actualLocation || m.targetLocation;
      if (!destId) return true;
      if (destId === selectedDestinationId) return true;
      const targetDest = selectedOrder.targetDestinations?.find(d => d.id === destId);
      if (targetDest && (targetDest.locationId === selectedDestinationId || targetDest.id === selectedDestinationId)) return true;
      return false;
    });
  }, [selectedOrder, selectedDestinationId]);

  const sourceEntries = useMemo(() => {
    if (selectedOrder?.originalEntries && Array.isArray(selectedOrder.originalEntries) && selectedOrder.originalEntries.length > 0) {
      return selectedOrder.originalEntries;
    }
    return state.offSiteEntries || [];
  }, [selectedOrder?.originalEntries, state.offSiteEntries]);

  const destinationItems = useMemo(() => {
    if (!selectedOrder) return [];
    return destinationMoves.map(m => {
      let entry = sourceEntries.find(e => e.id === m.entryId);
      if (!entry && state.offSiteEntries) {
        entry = state.offSiteEntries.find(e => e.id === m.entryId);
      }
      if (!entry && state.meatCuts) {
        const mc = state.meatCuts.find(mCut => mCut.id === m.entryId);
        if (mc) {
          const prod = state.products?.find(p => p.id === mc.productId);
          entry = {
            id: mc.id,
            productId: mc.productId,
            cuts: prod?.name || 'Meat Cut',
            pieces: mc.quantity || 1,
            netWeight: 0,
            box: 'Staged'
          };
        }
      }
      if (!entry) {
        entry = {
          id: m.entryId,
          cuts: 'Item #' + m.entryId,
          pieces: 1,
          netWeight: 0
        };
      }
      return {
        move: m,
        entry
      };
    });
  }, [destinationMoves, sourceEntries, state.offSiteEntries, state.meatCuts, state.products]);

  const palletGroups = useMemo(() => {
    const groups: { [palletName: string]: { boxCount: number; weight: number; items: any[] } } = {};
    
    destinationItems.forEach(item => {
      const palletName = item.move.originalCurrentLocation || item.entry?.currentLocation || item.entry?.pallet || 'Other';
      if (!groups[palletName]) {
        groups[palletName] = { boxCount: 0, weight: 0, items: [] };
      }
      groups[palletName].boxCount += 1;
      groups[palletName].weight += item.entry?.netWeight || 0;
      groups[palletName].items.push(item);
    });
    
    return groups;
  }, [destinationItems]);

  const manifestGroups = useMemo(() => {
    const groups: { [cutName: string]: { boxCount: number; weight: number; pieces: number; serials: string[] } } = {};
    
    destinationItems.forEach(item => {
      const cutName = getEntryCutName(item.entry, state);
      if (!groups[cutName]) {
        groups[cutName] = { boxCount: 0, weight: 0, pieces: 0, serials: [] };
      }
      groups[cutName].boxCount += 1;
      groups[cutName].weight += item.entry?.netWeight || 0;
      groups[cutName].pieces += item.entry?.pieces || 1;
      if (item.entry?.box) groups[cutName].serials.push(item.entry.box);
    });
    
    return groups;
  }, [destinationItems, state]);

  const totalBoxes = destinationItems.length;
  const totalWeight = destinationItems.reduce((sum, item) => sum + (item.entry?.netWeight || 0), 0);

  const getAutoPoNumber = (dateStr: string) => {
    if (!dateStr) return '';
    const cleanDate = dateStr.replace(/[-/]/g, '');
    if (cleanDate.length === 8) {
      const year = cleanDate.substring(0, 4);
      const month = cleanDate.substring(4, 6);
      const day = cleanDate.substring(6, 8);
      return `${month}${day}${year}-IN`;
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${m}${d}${y}-IN`;
    }
    return 'INBOUND';
  };

  useEffect(() => {
    if (selectedOrder) {
      setEditablePo(getAutoPoNumber(selectedOrder.date));
      const uniqueCuts = Array.from(new Set(destinationItems.map(item => getEntryCutName(item.entry, state)).filter(Boolean)));
      const cutsSummary = uniqueCuts.join(', ');
      setEditableItems(cutsSummary || selectedOrder.description || 'MIXED');
    }
  }, [selectedOrder, selectedDestinationId, destinationItems.length, state]);

  // Confirm undo state
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  const handleUndoMove = async () => {
    if (!selectedOrder) return;
    await dispatch({ type: 'REVERT_MOVEMENT_ORDER', payload: { id: selectedOrder.id } });
    setShowUndoConfirm(false);
  };

  const getDestLabel = (destId: string, targetDestinations: any[]) => {
    if (!destId) return 'Unknown';
    const dest = targetDestinations?.find(d => d.id === destId);
    if (dest) {
      return dest.palletName 
        ? `${dest.locationName} (Pallet: ${dest.palletName})` 
        : dest.locationName;
    }
    // Fallback if destination structure isn't fully preserved or matches a direct name
    return destId;
  };

  const boxMovesSummary = useMemo(() => {
    if (!selectedOrder) return [];
    
    const orderSourceEntries = (selectedOrder.originalEntries && Array.isArray(selectedOrder.originalEntries) && selectedOrder.originalEntries.length > 0)
      ? selectedOrder.originalEntries
      : (state.offSiteEntries || []);
    
    // Group moves by box ID
    const groups: Record<string, {
      boxLabel: string;
      originalLocLabel: string;
      newLocLabel: string;
      totalWeight: number;
      totalPieces: number;
      moves: Array<{
        move: any;
        entry: any;
      }>;
    }> = {};

    selectedOrder.moves?.forEach(m => {
      let entry = orderSourceEntries.find(e => e.id === m.entryId);
      if (!entry && state.offSiteEntries) {
        entry = state.offSiteEntries.find(e => e.id === m.entryId);
      }
      if (!entry && state.meatCuts) {
        const mc = state.meatCuts.find(mCut => mCut.id === m.entryId);
        if (mc) {
          const prod = state.products?.find(p => p.id === mc.productId);
          entry = {
            id: mc.id,
            productId: mc.productId,
            cuts: prod?.name || 'Meat Cut',
            pieces: mc.quantity || 1,
            netWeight: 0,
            box: 'Staged'
          };
        }
      }
      if (!entry) {
        entry = {
          id: m.entryId,
          cuts: 'Item #' + m.entryId,
          pieces: 1,
          netWeight: 0
        };
      }
      const boxLabel = entry?.box || entry?.serial || m.entryId || 'Unknown Box';
      const originalLocLabel = m.originalLocation + (m.originalCurrentLocation ? ` (Pallet: ${m.originalCurrentLocation})` : '');
      const newLocLabel = getDestLabel(m.actualLocation || m.targetLocation, selectedOrder.targetDestinations || []);

      if (!groups[boxLabel]) {
        groups[boxLabel] = {
          boxLabel,
          originalLocLabel,
          newLocLabel,
          totalWeight: 0,
          totalPieces: 0,
          moves: []
        };
      }

      groups[boxLabel].totalWeight += entry?.netWeight || 0;
      groups[boxLabel].totalPieces += entry?.pieces || 1;
      groups[boxLabel].moves.push({ move: m, entry });
    });

    return Object.values(groups).sort((a, b) => compareBoxLabels(a.boxLabel, b.boxLabel));
  }, [selectedOrder, state]);

  return (
    <div className="space-y-6" id="offsite-movement-history-view">
      <div className="bg-cool-gray-800 p-6 rounded-2xl border border-cool-gray-750 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="text-emerald-400" />
            Movement History & Executed Orders
          </h2>
          <p className="text-cool-gray-400 text-sm mt-1">
            Review, analyze, and revert past off-site inventory relocation transfers.
          </p>
        </div>
        {!hasActiveMovement ? (
          <button
            onClick={onPlanNewMovement}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0 w-full md:w-auto justify-center select-none"
          >
            <Plus size={16} />
            <span>Plan New Movement</span>
          </button>
        ) : (
          <div className="bg-cool-gray-850 border border-cool-gray-750/70 px-4 py-2.5 rounded-xl text-xs text-cool-gray-400 font-medium flex items-center gap-2 shrink-0 select-none">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Movement Active (Only 1 Allowed)</span>
          </div>
        )}
      </div>

      {completedOrders.length === 0 ? (
        <div className="bg-cool-gray-850 border border-cool-gray-750 rounded-2xl p-16 text-center text-cool-gray-400 max-w-3xl mx-auto space-y-4 shadow-xs">
          <Inbox className="mx-auto text-cool-gray-600" size={48} />
          <h3 className="text-lg font-bold text-white">No Completed Movement Orders</h3>
          <p className="text-sm max-w-md mx-auto">
            Once you plan, finalize, and execute an inventory movement order from the Spreadsheet Workspace, the complete transfer trail will be archived here.
          </p>
          {!hasActiveMovement ? (
            <div className="pt-2">
              <button
                onClick={onPlanNewMovement}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all shadow-md cursor-pointer select-none"
              >
                <Plus size={16} />
                <span>Plan New Movement</span>
              </button>
            </div>
          ) : (
            <div className="pt-2 inline-flex items-center gap-2 bg-cool-gray-800 border border-cool-gray-750 px-4 py-2 rounded-xl text-xs text-cool-gray-400 font-medium select-none">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>An active movement is currently in progress</span>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Archives List */}
          <div className="lg:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
            <h3 className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider mb-2">Executed Transfers ({completedOrders.length})</h3>
            {completedOrders.map(o => {
              const isSelected = o.id === selectedOrderId;
              const formattedExecDate = o.executedAt 
                ? new Date(o.executedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'Unknown';

              return (
                <div
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-emerald-950/20 border-emerald-500/50 text-white shadow-xs'
                      : 'bg-cool-gray-850 border-cool-gray-750/70 hover:border-cool-gray-650 text-cool-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <h4 className={`font-bold text-sm ${isSelected ? 'text-emerald-400' : 'text-white'}`}>{o.name}</h4>
                    <span className="text-[10px] bg-emerald-950/60 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                      Completed
                    </span>
                  </div>
                  
                  <p className="text-xs text-cool-gray-400 mt-2 line-clamp-1">{o.description || 'No description provided.'}</p>
                  
                  <div className="mt-3 pt-3 border-t border-cool-gray-750/50 flex items-center justify-between text-[11px] text-cool-gray-400">
                    <span className="flex items-center gap-1"><Clock size={12} /> {formattedExecDate}</span>
                    <span className="font-bold bg-cool-gray-800 px-1.5 py-0.5 rounded border border-cool-gray-700">{o.moves?.length || 0} boxes</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Order Details */}
          <div className="lg:col-span-2">
            {selectedOrder ? (
              <div className="bg-cool-gray-850 rounded-2xl border border-cool-gray-750 shadow-xs overflow-hidden animate-fade-in">
                {/* Detail Header */}
                <div className="p-6 bg-cool-gray-800 border-b border-cool-gray-750 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest block mb-1">Archive Entry Details</span>
                    <h3 className="text-2xl font-bold text-white">{selectedOrder.name}</h3>
                    <p className="text-sm text-cool-gray-400 mt-1">{selectedOrder.description || 'No description provided.'}</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <button
                      onClick={() => {
                        if (destinationsInPlay.length > 0) {
                          setSelectedDestinationId(destinationsInPlay[0].id);
                        }
                        setIsReportModalOpen(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center flex-1 md:flex-none"
                    >
                      <Printer size={16} />
                      <span>View & Print Reports</span>
                    </button>
                    
                    <button
                      onClick={() => setShowUndoConfirm(true)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center flex-1 md:flex-none"
                      title="Undo this entire movement. Reverts all moved boxes back to their original locations."
                    >
                      <RotateCcw size={16} />
                      <span>Undo This Move</span>
                    </button>
                  </div>
                </div>

                {/* Detail Meta Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 border-b border-cool-gray-750/70 bg-cool-gray-850/50">
                  <div className="p-4 border-r border-b md:border-b-0 border-cool-gray-750/50">
                    <span className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider block">Planned Date</span>
                    <span className="text-sm text-cool-gray-300 font-semibold mt-1 block">{selectedOrder.date || 'N/A'}</span>
                  </div>
                  <div className="p-4 border-r border-b md:border-b-0 border-cool-gray-750/50">
                    <span className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider block">Executed Timestamp</span>
                    <span className="text-sm text-emerald-400 font-semibold mt-1 block">
                      {selectedOrder.executedAt ? new Date(selectedOrder.executedAt).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider block">Total Moved Elements</span>
                    <span className="text-sm text-white font-semibold mt-1 block">{selectedOrder.moves?.length || 0} Boxes / Pallets</span>
                  </div>
                </div>

                {/* Moved Items List */}
                <div className="p-6">
                  <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-1.5">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    Detailed Item Relocation Trail
                  </h4>

                  <div className="space-y-3">
                    {boxMovesSummary.map((boxGroup, idx) => {
                      const isExpanded = !!expandedBoxes[boxGroup.boxLabel];
                      const uniqueCutsStr = boxGroup.moves
                        .map(m => getEntryCutName(m.entry, state))
                        .filter(Boolean)
                        .filter((val, i, arr) => arr.indexOf(val) === i)
                        .join(', ');

                      return (
                        <div key={boxGroup.boxLabel} className="bg-cool-gray-900 border border-cool-gray-750/70 rounded-xl overflow-hidden transition-all duration-150">
                          {/* Box Summary Row */}
                          <div 
                            onClick={() => setExpandedBoxes(prev => ({ ...prev, [boxGroup.boxLabel]: !prev[boxGroup.boxLabel] }))}
                            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-cool-gray-800/40 select-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className="text-cool-gray-400">
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-sm text-white">{boxGroup.boxLabel}</span>
                                  <span className="text-[10px] bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-300 px-2 py-0.5 rounded-full font-semibold">
                                    {boxGroup.moves.length} {boxGroup.moves.length === 1 ? 'cut' : 'cuts'}
                                  </span>
                                </div>
                                <div className="text-xs text-cool-gray-400 mt-1 line-clamp-1 max-w-[280px] sm:max-w-[400px]">
                                  {uniqueCutsStr}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] text-cool-gray-500 block">Total Weight</span>
                                <span className="font-mono font-bold text-emerald-400">{boxGroup.totalWeight.toFixed(1)} lbs</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-cool-gray-500 block">Route</span>
                                <span className="text-cool-gray-300">
                                  {boxGroup.originalLocLabel} <span className="text-emerald-400">➔</span> <span className="text-emerald-300 font-bold">{boxGroup.newLocLabel}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expanded Cuts Detail Table/List */}
                          {isExpanded && (
                            <div className="border-t border-cool-gray-750/50 bg-cool-gray-950/40 px-4 py-3">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-cool-gray-800 text-cool-gray-500 font-semibold tracking-wider text-[10px] uppercase">
                                    <th className="py-2 px-2">Cuts Name</th>
                                    <th className="py-2 px-2">Product Category</th>
                                    <th className="py-2 px-2 text-center">Pieces</th>
                                    <th className="py-2 px-2 text-right">Weight</th>
                                    <th className="py-2 px-2">Lot Number</th>
                                    <th className="py-2 px-2">Origin</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-cool-gray-850/40 font-medium text-cool-gray-400">
                                  {boxGroup.moves.map(({ move, entry }, cIdx) => {
                                    const matchedProd = entry ? state.products?.find((p: any) => 
                                      p.id === entry.productId || 
                                      p.name?.trim().toLowerCase() === (entry.product || entry.cuts || '').trim().toLowerCase()
                                    ) : null;
                                    const catLabel = matchedProd 
                                      ? `${matchedProd.primaryCategory}${matchedProd.subCategory ? ` > ${matchedProd.subCategory}` : ''}`
                                      : 'Off-Site / Uncategorized';

                                    return (
                                      <tr key={cIdx} className="hover:bg-cool-gray-850/20">
                                        <td className="py-2 px-2 font-bold text-cool-gray-200">
                                          {getEntryCutName(entry, state)}
                                        </td>
                                        <td className="py-2 px-2 text-cool-gray-400">
                                          <span className="bg-cool-gray-850 px-1.5 py-0.5 rounded border border-cool-gray-800 text-[10px] text-cyan-400 font-semibold">
                                            {catLabel}
                                          </span>
                                        </td>
                                        <td className="py-2 px-2 text-center text-cool-gray-300">
                                          {entry?.pieces || 1} pcs
                                        </td>
                                        <td className="py-2 px-2 text-right font-mono text-emerald-400 font-semibold">
                                          {entry?.netWeight || 0} lbs
                                        </td>
                                        <td className="py-2 px-2 font-mono text-cool-gray-500">
                                          {entry?.lot || entry?.lotNumber || 'N/A'}
                                        </td>
                                        <td className="py-2 px-2 text-cool-gray-500">
                                          {entry?.supplier || entry?.sourceLocation || 'N/A'}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {(!selectedOrder.moves || selectedOrder.moves.length === 0) && (
                      <div className="py-8 text-center text-cool-gray-500 italic border border-cool-gray-750 rounded-xl bg-cool-gray-900">
                        No moves were recorded in this movement order.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-cool-gray-850 border border-cool-gray-750 rounded-2xl p-16 text-center text-cool-gray-400 space-y-3">
                <ListCollapse className="mx-auto text-cool-gray-600" size={36} />
                <h4 className="text-white font-bold">Select a Movement Order</h4>
                <p className="text-sm">Select an archived transfer order from the sidebar to inspect detailed box lists and original locations.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Undo Confirmation Overlay Modal */}
      {showUndoConfirm && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-cool-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-cool-gray-750 animate-fade-in">
            <h3 className="text-lg font-bold text-white">Undo Executed Movement Order?</h3>
            <p className="text-sm text-cool-gray-400 mt-2">
              Are you sure you want to revert all moves recorded in <span className="text-emerald-400 font-bold">"{selectedOrder.name}"</span>?
            </p>
            <p className="text-xs text-yellow-500/80 mt-2 bg-yellow-950/20 border border-yellow-850/50 p-2.5 rounded-xl">
              ⚠️ Warning: This will relocate all {selectedOrder.moves?.length || 0} boxes back to their previous storage locations ({selectedOrder.moves?.[0]?.originalLocation || 'P1'} / Pallets). Any manual edits made to these box locations after execution will be overwritten.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowUndoConfirm(false)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 text-sm font-semibold rounded-xl transition duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUndoMove}
                className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition duration-150 cursor-pointer"
              >
                Revert Movements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View & Print Reports Modal */}
      {isReportModalOpen && selectedOrder && (
        <MovementReportModal 
          isOpen={isReportModalOpen} 
          onClose={() => setIsReportModalOpen(false)} 
          order={selectedOrder} 
          state={state} 
          dispatch={dispatch}
        />
      )}
    </div>
  );
};
