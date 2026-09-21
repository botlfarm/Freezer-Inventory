import React, { useState, useMemo, useEffect } from 'react';
import { 
  Truck, Calendar, Info, CheckCircle2, RotateCcw, ChevronRight, ChevronDown, 
  Inbox, Clock, ListCollapse, Printer, FileText, X, Plus, Trash2, Edit3, 
  AlertTriangle, Search, FileSpreadsheet 
} from 'lucide-react';
import { InventoryState, Action, MovementOrder } from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { MovementReportModal, getEntryCutName } from './MovementReportModal';
import { compareBoxLabels } from '../utils/boxSort';

interface OffSiteMovementHistoryProps {
  state: InventoryState;
  dispatch: (action: Action) => Promise<boolean>;
  onPlanNewMovement: () => void;
  onSelectActiveOrder?: (orderId: string) => void;
  onNavigateToWorkspace?: () => void;
  onNavigateToScanner?: () => void;
}

export const OffSiteMovementHistory: React.FC<OffSiteMovementHistoryProps> = ({ 
  state, 
  dispatch, 
  onPlanNewMovement,
  onSelectActiveOrder,
  onNavigateToWorkspace,
  onNavigateToScanner
}) => {
  const orders = state.movementOrders || [];
  const entries = state.offSiteEntries || [];

  type StatusFilter = 'all' | 'planning' | 'finalized' | 'completed';
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const plannedOrders = useMemo(() => orders.filter(o => o.status === 'planning'), [orders]);
  const finalizedOrders = useMemo(() => orders.filter(o => o.status === 'finalized'), [orders]);
  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders]);

  // Compute multi-order conflicts across open orders (planning or finalized)
  const openOrderConflicts = useMemo(() => {
    const openOrders = orders.filter(o => o.status === 'planning' || o.status === 'finalized');
    const entryToOrders = new Map<string, string[]>();
    openOrders.forEach(o => {
      o.moves?.forEach(m => {
        const list = entryToOrders.get(m.entryId) || [];
        if (!list.includes(o.id)) list.push(o.id);
        entryToOrders.set(m.entryId, list);
      });
    });

    const orderConflictCounts = new Map<string, number>();
    entryToOrders.forEach(orderIds => {
      if (orderIds.length > 1) {
        orderIds.forEach(oid => {
          orderConflictCounts.set(oid, (orderConflictCounts.get(oid) || 0) + 1);
        });
      }
    });

    return orderConflictCounts;
  }, [orders]);

  // Sorted orders: Active first (finalized, then planning), then completed
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const weight = (s: string) => (s === 'finalized' ? 3 : s === 'planning' ? 2 : 1);
      const diff = weight(b.status) - weight(a.status);
      if (diff !== 0) return diff;

      if (a.status === 'completed' && b.status === 'completed') {
        const dateA = a.executedAt ? new Date(a.executedAt).getTime() : 0;
        const dateB = b.executedAt ? new Date(b.executedAt).getTime() : 0;
        return dateB - dateA;
      }
      return (b.date || '').localeCompare(a.date || '');
    });
  }, [orders]);

  const displayedOrders = useMemo(() => {
    return sortedOrders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = o.name?.toLowerCase().includes(q);
        const matchesDesc = o.description?.toLowerCase().includes(q);
        const matchesDate = o.date?.toLowerCase().includes(q);
        const matchesDest = o.targetDestinations?.some(d => 
          d.locationName?.toLowerCase().includes(q) || d.palletName?.toLowerCase().includes(q)
        );
        return matchesName || matchesDesc || matchesDate || matchesDest;
      }
      return true;
    });
  }, [sortedOrders, statusFilter, searchQuery]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [expandedBoxes, setExpandedBoxes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setExpandedBoxes({});
  }, [selectedOrderId]);

  // Auto-select the first order in displayed list if nothing is selected or previous selected was removed
  useEffect(() => {
    if (displayedOrders.length > 0) {
      if (!selectedOrderId || !orders.some(o => o.id === selectedOrderId)) {
        setSelectedOrderId(displayedOrders[0].id);
      }
    } else if (orders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(orders[0].id);
    }
  }, [displayedOrders, selectedOrderId, orders]);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Modals state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRevertToPlanningConfirm, setShowRevertToPlanningConfirm] = useState(false);

  const selectedOrderConflicts = useMemo(() => {
    if (!selectedOrder || selectedOrder.status === 'completed') return [];
    const otherOpenOrders = orders.filter(o => 
      o.id !== selectedOrder.id && (o.status === 'planning' || o.status === 'finalized')
    );
    const myEntryIds = new Set(selectedOrder.moves.map(m => m.entryId));
    
    const conflicts: { otherOrder: MovementOrder; overlappingCount: number }[] = [];
    otherOpenOrders.forEach(oo => {
      const overlapping = oo.moves.filter(m => myEntryIds.has(m.entryId));
      if (overlapping.length > 0) {
        conflicts.push({
          otherOrder: oo,
          overlappingCount: overlapping.length
        });
      }
    });
    return conflicts;
  }, [selectedOrder, orders]);

  const handleDeleteOrder = async () => {
    if (!selectedOrder) return;
    await dispatch({ type: 'DELETE_MOVEMENT_ORDER', payload: { id: selectedOrder.id } });
    setShowDeleteConfirm(false);
    setSelectedOrderId(null);
  };

  const handleRevertToPlanning = async () => {
    if (!selectedOrder) return;
    await dispatch({ 
      type: 'UPDATE_MOVEMENT_ORDER', 
      payload: { 
        id: selectedOrder.id, 
        updates: { status: 'planning' } 
      } 
    });
    setShowRevertToPlanningConfirm(false);
  };

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
      const origLoc = m.originalLocation || entry?.location || 'Unknown Location';
      const origPallet = m.originalCurrentLocation || entry?.currentLocation || entry?.pallet;
      const originalLocLabel = origLoc + (origPallet ? ` (Pallet: ${origPallet})` : '');
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

  const totalSelectedOrderWeight = useMemo(() => {
    return boxMovesSummary.reduce((acc, b) => acc + b.totalWeight, 0);
  }, [boxMovesSummary]);

  return (
    <div className="space-y-6" id="offsite-movement-history-view">
      <div className="bg-cool-gray-800 p-6 rounded-2xl border border-cool-gray-750 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Truck className="text-emerald-400" />
            Movement Orders & History
          </h2>
          <p className="text-cool-gray-400 text-sm mt-1">
            Review planned, active, and completed inventory relocation transfers across all orders.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {plannedOrders.length + finalizedOrders.length > 0 && (
            <div className="bg-blue-950/40 border border-blue-800/60 px-3 py-2 rounded-xl text-xs text-blue-300 font-semibold flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>{plannedOrders.length + finalizedOrders.length} Active Plan{plannedOrders.length + finalizedOrders.length > 1 ? 's' : ''}</span>
            </div>
          )}
          <button
            onClick={onPlanNewMovement}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer shrink-0 w-full md:w-auto justify-center select-none"
            id="btn-plan-new-movement"
          >
            <Plus size={16} />
            <span>Plan New Movement</span>
          </button>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-cool-gray-850 border border-cool-gray-750 rounded-2xl p-16 text-center text-cool-gray-400 max-w-3xl mx-auto space-y-4 shadow-xs">
          <Inbox className="mx-auto text-cool-gray-600" size={48} />
          <h3 className="text-lg font-bold text-white">No Movement Orders Found</h3>
          <p className="text-sm max-w-md mx-auto">
            You have not created any inventory movement orders yet. Click below to plan your first movement order.
          </p>
          <div className="pt-2">
            <button
              onClick={onPlanNewMovement}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all shadow-md cursor-pointer select-none"
            >
              <Plus size={16} />
              <span>Plan New Movement</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Orders List */}
          <div className="lg:col-span-1 space-y-3">
            {/* Filter Tabs */}
            <div className="bg-cool-gray-850 p-1.5 rounded-xl border border-cool-gray-750 flex items-center gap-1 text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center ${
                  statusFilter === 'all'
                    ? 'bg-cool-gray-750 text-white shadow-xs'
                    : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                All ({orders.length})
              </button>
              <button
                onClick={() => setStatusFilter('planning')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 ${
                  statusFilter === 'planning'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                <span>Planned</span>
                {plannedOrders.length > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${statusFilter === 'planning' ? 'bg-blue-800' : 'bg-cool-gray-800 text-blue-300'}`}>
                    {plannedOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setStatusFilter('finalized')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 ${
                  statusFilter === 'finalized'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                <span>Ready</span>
                {finalizedOrders.length > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${statusFilter === 'finalized' ? 'bg-cyan-800' : 'bg-cool-gray-800 text-cyan-300'}`}>
                    {finalizedOrders.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all text-center flex items-center justify-center gap-1 ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                <span>Done</span>
                {completedOrders.length > 0 && (
                  <span className={`text-[10px] px-1 rounded-full ${statusFilter === 'completed' ? 'bg-emerald-800' : 'bg-cool-gray-800 text-emerald-300'}`}>
                    {completedOrders.length}
                  </span>
                )}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-cool-gray-500" size={14} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search orders, notes, destinations..."
                className="w-full bg-cool-gray-850 border border-cool-gray-750 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-cool-gray-500 focus:outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-cool-gray-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Orders Cards List */}
            <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1 custom-scrollbar">
              {displayedOrders.length === 0 ? (
                <div className="p-8 text-center bg-cool-gray-850/50 border border-cool-gray-750/70 rounded-xl text-cool-gray-400 text-xs">
                  No orders found matching the filter.
                </div>
              ) : (
                displayedOrders.map(o => {
                  const isSelected = o.id === selectedOrderId;
                  const conflictCount = openOrderConflicts.get(o.id) || 0;
                  const dateStr = o.status === 'completed'
                    ? (o.executedAt ? new Date(o.executedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Done')
                    : (o.date ? `Planned: ${o.date}` : 'No date set');

                  // Destination summary
                  const destSummary = o.targetDestinations && o.targetDestinations.length > 0
                    ? o.targetDestinations.map(d => d.palletName ? `${d.locationName} (${d.palletName})` : d.locationName).join(', ')
                    : '';

                  let borderClass = 'bg-cool-gray-850 border-cool-gray-750/70 hover:border-cool-gray-650 text-cool-gray-300';
                  if (isSelected) {
                    if (o.status === 'planning') {
                      borderClass = 'bg-blue-950/20 border-blue-500/60 text-white shadow-xs';
                    } else if (o.status === 'finalized') {
                      borderClass = 'bg-cyan-950/20 border-cyan-500/60 text-white shadow-xs';
                    } else {
                      borderClass = 'bg-emerald-950/20 border-emerald-500/60 text-white shadow-xs';
                    }
                  }

                  return (
                    <div
                      key={o.id}
                      onClick={() => setSelectedOrderId(o.id)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${borderClass}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h4 className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-cool-gray-200'} truncate`}>
                          {o.name}
                        </h4>
                        
                        {o.status === 'planning' && (
                          <span className="text-[10px] bg-blue-950/80 border border-blue-800 text-blue-300 px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 flex items-center gap-1">
                            <Edit3 size={10} /> Planning
                          </span>
                        )}
                        {o.status === 'finalized' && (
                          <span className="text-[10px] bg-cyan-950/80 border border-cyan-700 text-cyan-300 px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 flex items-center gap-1">
                            <Truck size={10} /> Ready
                          </span>
                        )}
                        {o.status === 'completed' && (
                          <span className="text-[10px] bg-emerald-950/80 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Completed
                          </span>
                        )}
                      </div>

                      {conflictCount > 0 && (
                        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300 font-medium">
                          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                          <span>{conflictCount} conflicting cut{conflictCount > 1 ? 's' : ''} with other orders</span>
                        </div>
                      )}

                      <p className="text-xs text-cool-gray-400 mt-1 line-clamp-1">
                        {o.description || destSummary || 'No notes or destinations specified.'}
                      </p>

                      <div className="mt-2.5 pt-2.5 border-t border-cool-gray-750/50 flex items-center justify-between text-[11px] text-cool-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {dateStr}
                        </span>
                        <span className="font-bold bg-cool-gray-800 px-1.5 py-0.5 rounded border border-cool-gray-700 text-cool-gray-300">
                          {o.moves?.length || 0} items
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Order Details */}
          <div className="lg:col-span-2">
            {selectedOrder ? (
              <div className="bg-cool-gray-850 rounded-2xl border border-cool-gray-750 shadow-xs overflow-hidden animate-fade-in">
                {/* Detail Header */}
                <div className="p-6 bg-cool-gray-800 border-b border-cool-gray-750 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {selectedOrder.status === 'planning' && (
                        <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest bg-blue-950/60 border border-blue-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Edit3 size={10} /> Planned Movement Order (In Planning)
                        </span>
                      )}
                      {selectedOrder.status === 'finalized' && (
                        <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Truck size={10} /> Finalized Movement Order (Ready for Scanner)
                        </span>
                      )}
                      {selectedOrder.status === 'completed' && (
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <CheckCircle2 size={10} /> Executed & Archived Transfer
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-white">{selectedOrder.name}</h3>
                    <p className="text-sm text-cool-gray-400 mt-1">{selectedOrder.description || 'No description provided.'}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Action buttons depending on order status */}
                    {selectedOrder.status === 'planning' && (
                      <>
                        {onNavigateToWorkspace && (
                          <button
                            onClick={() => {
                              onSelectActiveOrder?.(selectedOrder.id);
                              onNavigateToWorkspace();
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center flex-1 md:flex-none"
                            title="Open this order in the Spreadsheet Workspace to assign or edit targets"
                          >
                            <FileSpreadsheet size={15} />
                            <span>Open in Workspace</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (destinationsInPlay.length > 0) {
                              setSelectedDestinationId(destinationsInPlay[0].id);
                            }
                            setIsReportModalOpen(true);
                          }}
                          className="bg-cool-gray-700 hover:bg-cool-gray-650 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center flex-1 md:flex-none"
                        >
                          <Printer size={15} />
                          <span>Reports & Manifest</span>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center"
                          title="Delete this planned order"
                        >
                          <Trash2 size={15} />
                          <span>Delete</span>
                        </button>
                      </>
                    )}

                    {selectedOrder.status === 'finalized' && (
                      <>
                        {onNavigateToScanner && (
                          <button
                            onClick={() => {
                              onSelectActiveOrder?.(selectedOrder.id);
                              onNavigateToScanner();
                            }}
                            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center flex-1 md:flex-none"
                            title="Launch live interactive scanning to verify and deliver items"
                          >
                            <Truck size={15} />
                            <span>Launch Scanner</span>
                          </button>
                        )}
                        {onNavigateToWorkspace && (
                          <button
                            onClick={() => {
                              onSelectActiveOrder?.(selectedOrder.id);
                              onNavigateToWorkspace();
                            }}
                            className="bg-cool-gray-700 hover:bg-cool-gray-650 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center"
                          >
                            <FileSpreadsheet size={15} />
                            <span>Workspace</span>
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (destinationsInPlay.length > 0) {
                              setSelectedDestinationId(destinationsInPlay[0].id);
                            }
                            setIsReportModalOpen(true);
                          }}
                          className="bg-cool-gray-700 hover:bg-cool-gray-650 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center"
                        >
                          <Printer size={15} />
                          <span>Reports</span>
                        </button>
                        <button
                          onClick={() => setShowRevertToPlanningConfirm(true)}
                          className="bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800/80 text-amber-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center"
                          title="Unlock and move back to planning status to edit destinations or items"
                        >
                          <Edit3 size={15} />
                          <span>Revert to Planning</span>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center"
                          title="Delete this order"
                        >
                          <Trash2 size={15} />
                          <span>Delete</span>
                        </button>
                      </>
                    )}

                    {selectedOrder.status === 'completed' && (
                      <>
                        <button
                          onClick={() => {
                            if (destinationsInPlay.length > 0) {
                              setSelectedDestinationId(destinationsInPlay[0].id);
                            }
                            setIsReportModalOpen(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center flex-1 md:flex-none"
                        >
                          <Printer size={15} />
                          <span>View & Print Reports</span>
                        </button>
                        <button
                          onClick={() => setShowUndoConfirm(true)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer justify-center flex-1 md:flex-none"
                          title="Undo this entire movement. Reverts all moved boxes back to their original locations."
                        >
                          <RotateCcw size={15} />
                          <span>Undo This Move</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Overlap / Conflict Warning Banner */}
                {selectedOrderConflicts.length > 0 && (
                  <div className="mx-6 mt-6 p-4 bg-amber-950/40 border border-amber-500/50 rounded-xl text-amber-200 text-xs flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-amber-300">Multi-Order Overlap Warning</div>
                      <p className="text-amber-200/80 mt-0.5">
                        This order shares items or boxes with other active orders:{' '}
                        <span className="font-semibold text-amber-100">
                          {selectedOrderConflicts.map(c => `"${c.otherOrder.name}" (${c.overlappingCount} cuts)`).join(', ')}
                        </span>.
                      </p>
                    </div>
                  </div>
                )}

                {/* Detail Meta Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 border-b border-cool-gray-750/70 bg-cool-gray-850/50">
                  <div className="p-4 border-r border-b md:border-b-0 border-cool-gray-750/50">
                    <span className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider block">Planned Date</span>
                    <span className="text-sm text-cool-gray-300 font-semibold mt-1 block">{selectedOrder.date || 'N/A'}</span>
                  </div>
                  <div className="p-4 border-r border-b md:border-b-0 border-cool-gray-750/50">
                    <span className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider block">Execution Status</span>
                    {selectedOrder.status === 'completed' ? (
                      <span className="text-sm text-emerald-400 font-semibold mt-1 block">
                        {selectedOrder.executedAt ? new Date(selectedOrder.executedAt).toLocaleString() : 'Executed'}
                      </span>
                    ) : selectedOrder.status === 'finalized' ? (
                      <span className="text-sm text-cyan-300 font-semibold mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                        Ready for Scanner
                      </span>
                    ) : (
                      <span className="text-sm text-blue-400 font-semibold mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                        In Planning
                      </span>
                    )}
                  </div>
                  <div className="p-4 border-r border-b md:border-b-0 border-cool-gray-750/50">
                    <span className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider block">Target Destinations</span>
                    <span className="text-sm text-white font-semibold mt-1 block truncate" title={(selectedOrder.targetDestinations || []).map(d => d.palletName ? `${d.locationName} (${d.palletName})` : d.locationName).join(', ')}>
                      {(selectedOrder.targetDestinations || []).length > 0 
                        ? `${selectedOrder.targetDestinations.length} destination${selectedOrder.targetDestinations.length > 1 ? 's' : ''}`
                        : 'None assigned'}
                    </span>
                  </div>
                  <div className="p-4">
                    <span className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider block">Items & Weight</span>
                    <span className="text-sm text-white font-semibold mt-1 block">
                      {selectedOrder.moves?.length || 0} items {totalSelectedOrderWeight > 0 ? `(${totalSelectedOrderWeight.toFixed(1)} lbs)` : ''}
                    </span>
                  </div>
                </div>

                {/* Items & Trail Section */}
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                      {selectedOrder.status === 'completed' ? (
                        <>
                          <CheckCircle2 size={16} className="text-emerald-400" />
                          Detailed Item Relocation Trail
                        </>
                      ) : selectedOrder.status === 'finalized' ? (
                        <>
                          <Truck size={16} className="text-cyan-400" />
                          Staged Items Ready for Transfer ({selectedOrder.moves?.length || 0} items)
                        </>
                      ) : (
                        <>
                          <Edit3 size={16} className="text-blue-400" />
                          Planned Box & Item Assignments ({selectedOrder.moves?.length || 0} items)
                        </>
                      )}
                    </h4>

                    {selectedOrder.moves && selectedOrder.moves.length > 0 && (
                      <span className="text-xs text-cool-gray-400 font-medium">
                        {boxMovesSummary.length} {boxMovesSummary.length === 1 ? 'Box' : 'Boxes'}
                      </span>
                    )}
                  </div>

                  {(!selectedOrder.moves || selectedOrder.moves.length === 0) ? (
                    <div className="py-12 text-center text-cool-gray-400 space-y-3 bg-cool-gray-900 border border-cool-gray-750/70 rounded-xl p-6">
                      <Inbox size={36} className="mx-auto text-cool-gray-600" />
                      <h5 className="text-white font-bold text-base">No Items Assigned to This Order Yet</h5>
                      <p className="text-xs max-w-sm mx-auto text-cool-gray-400">
                        This order is created but has no boxes targeted yet. Open it in the Spreadsheet Workspace to pick items and configure destinations.
                      </p>
                      {onNavigateToWorkspace && (
                        <div className="pt-2">
                          <button
                            onClick={() => {
                              onSelectActiveOrder?.(selectedOrder.id);
                              onNavigateToWorkspace();
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                          >
                            <FileSpreadsheet size={14} />
                            <span>Open in Spreadsheet Workspace</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
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
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-cool-gray-850 border border-cool-gray-750 rounded-2xl p-16 text-center text-cool-gray-400 space-y-3">
                <ListCollapse className="mx-auto text-cool-gray-600" size={36} />
                <h4 className="text-white font-bold">Select a Movement Order</h4>
                <p className="text-sm">Select any planned, ready, or completed movement order from the list to view its destinations, boxes, and details.</p>
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

      {/* Delete Order Confirmation Overlay Modal */}
      {showDeleteConfirm && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-cool-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-cool-gray-750 animate-fade-in">
            <h3 className="text-lg font-bold text-white">Delete Movement Order?</h3>
            <p className="text-sm text-cool-gray-400 mt-2">
              Are you sure you want to delete <span className="text-white font-bold">"{selectedOrder.name}"</span>?
            </p>
            <p className="text-xs text-cool-gray-400 mt-2 bg-cool-gray-900 border border-cool-gray-750 p-2.5 rounded-xl">
              This will remove the planned movement order without altering your physical inventory.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 text-sm font-semibold rounded-xl transition duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteOrder}
                className="px-4 py-2 bg-red-650 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition duration-150 cursor-pointer"
              >
                Delete Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert to Planning Confirmation Overlay Modal */}
      {showRevertToPlanningConfirm && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-cool-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-cool-gray-750 animate-fade-in">
            <h3 className="text-lg font-bold text-white">Revert to Planning?</h3>
            <p className="text-sm text-cool-gray-400 mt-2">
              Are you sure you want to unlock <span className="text-white font-bold">"{selectedOrder.name}"</span> and return it to planning status?
            </p>
            <p className="text-xs text-blue-300 mt-2 bg-blue-950/40 border border-blue-800/60 p-2.5 rounded-xl">
              ℹ️ This allows you to add or remove boxes, reassign destinations, and edit target locations in the Spreadsheet Workspace.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowRevertToPlanningConfirm(false)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 text-sm font-semibold rounded-xl transition duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRevertToPlanning}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-xl transition duration-150 cursor-pointer"
              >
                Revert to Planning
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
