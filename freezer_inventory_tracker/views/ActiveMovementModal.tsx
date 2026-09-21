import React, { useState, useMemo } from 'react';
import { Plus, X, Edit3, Trash2, Printer, CheckCircle2, RotateCcw, ClipboardList, Square, CheckSquare, Home, Info, Calendar } from 'lucide-react';
import { InventoryState, Action, MovementOrder } from '../types';
import { MovementReportModal } from './MovementReportModal';

interface ActiveMovementModalProps {
  order: MovementOrder;
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
  onSelectOrder?: (orderId: string) => void;
}

export const ActiveMovementModal: React.FC<ActiveMovementModalProps> = ({ order, state, dispatch, onClose, onSelectOrder }) => {
  const isPlanning = order.status === 'planning';
  const isFinalized = order.status === 'finalized';
  
  const [newDestLocId, setNewDestLocId] = useState('');
  const [newDestPallet, setNewDestPallet] = useState('');
  const [renamePalletModal, setRenamePalletModal] = useState<{ isOpen: boolean; oldName: string; newName: string } | null>(null);

  // Multiple movement orders selector & inline creation
  const activeOrders = useMemo(() => {
    return (state.movementOrders || []).filter((o: any) => o.status === 'planning' || o.status === 'finalized');
  }, [state.movementOrders]);

  const [isCreatingNewInline, setIsCreatingNewInline] = useState(false);
  const [inlineNewName, setInlineNewName] = useState('');
  const [inlineNewDate, setInlineNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [inlineNewDesc, setInlineNewDesc] = useState('');

  const handleCreateInlineOrder = async () => {
    if (!inlineNewName.trim()) return;
    const newOrder: MovementOrder = {
      id: 'move-' + Date.now(),
      name: inlineNewName.trim(),
      date: inlineNewDate || new Date().toISOString().split('T')[0],
      description: inlineNewDesc.trim() || undefined,
      status: 'planning',
      palletsInPlay: [],
      locationsInPlay: [],
      targetDestinations: [],
      moves: []
    };
    await dispatch({ type: 'ADD_MOVEMENT_ORDER', payload: { order: newOrder } });
    setIsCreatingNewInline(false);
    setInlineNewName('');
    setInlineNewDesc('');
    if (onSelectOrder) {
      onSelectOrder(newOrder.id);
    }
  };

  const allLocations = state.locations || [];

  // Per-pallet destination execution choices:
  const [stagingDestIds, setStagingDestIds] = useState<string[]>(() => {
    return (order.targetDestinations || [])
      .filter(dest => {
        const loc = allLocations.find(l => l.id === dest.locationId);
        return loc && loc.isHome;
      })
      .map(dest => dest.id);
  });
  const [removeFromInventoryDestIds, setRemoveFromInventoryDestIds] = useState<string[]>([]);

  const setHomeDestMode = (destId: string, mode: 'staging' | 'remove' | 'keep') => {
    if (mode === 'staging') {
      setStagingDestIds(prev => prev.includes(destId) ? prev : [...prev, destId]);
      setRemoveFromInventoryDestIds(prev => prev.filter(id => id !== destId));
    } else if (mode === 'remove') {
      setRemoveFromInventoryDestIds(prev => prev.includes(destId) ? prev : [...prev, destId]);
      setStagingDestIds(prev => prev.filter(id => id !== destId));
    } else {
      setStagingDestIds(prev => prev.filter(id => id !== destId));
      setRemoveFromInventoryDestIds(prev => prev.filter(id => id !== destId));
    }
  };

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  // Local state for transfer detail fields to prevent background sync race conditions
  const [localName, setLocalName] = useState(order.name);
  const [localDate, setLocalDate] = useState(order.date);
  const [localDesc, setLocalDesc] = useState(order.description || '');
  const loadedOrderIdRef = React.useRef(order.id);

  React.useEffect(() => {
    if (loadedOrderIdRef.current !== order.id) {
      loadedOrderIdRef.current = order.id;
      setLocalName(order.name);
      setLocalDate(order.date);
      setLocalDesc(order.description || '');
    }
  }, [order.id, order.name, order.date, order.description]);

  const flushOrderUpdates = React.useCallback((nameVal: string, dateVal: string, descVal: string) => {
    if (nameVal !== order.name || dateVal !== order.date || descVal !== (order.description || '')) {
      dispatch({
        type: 'UPDATE_MOVEMENT_ORDER',
        payload: {
          id: order.id,
          updates: { name: nameVal, date: dateVal, description: descVal }
        }
      });
    }
  }, [order.id, order.name, order.date, order.description, dispatch]);
  
  const entries = useMemo(() => {
    return (state.offSiteEntries || []).filter((e: any) => {
      if (e.archived) return false;
      if (e.box && state.containers?.some((c: any) => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
  }, [state.offSiteEntries, state.containers]);

  const movesMap = useMemo(() => {
    return new Map((order.moves || []).map(m => [m.entryId, m.actualLocation || m.targetLocation]));
  }, [order.moves]);

  const movedHomeEntries = useMemo(() => {
    return entries.filter(e => {
      if (!movesMap.has(e.id)) return false;
      const destId = movesMap.get(e.id);
      const dest = order.targetDestinations?.find(d => d.id === destId);
      if (!dest) return false;
      const loc = allLocations.find(l => l.id === dest.locationId);
      return loc && loc.isHome;
    });
  }, [entries, movesMap, order.targetDestinations, allLocations]);

  const hasMovedHome = movedHomeEntries.length > 0;

  const allPallets = useMemo(() => {
    const palletsMap = new Map<string, { palletName: string, locationId: string, locationName: string }>();
    (state.offSiteEntries || []).forEach(e => {
      if (e.currentLocation && !e.archived) {
        if (e.box && state.containers?.some((c: any) => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
          return;
        }
        const loc = state.locations?.find(l => l.name.toLowerCase() === e.location?.toLowerCase());
        palletsMap.set(e.currentLocation, { 
          palletName: e.currentLocation, 
          locationId: loc?.id || '', 
          locationName: e.location || 'Unassigned' 
        });
      }
    });
    return Array.from(palletsMap.values());
  }, [state.offSiteEntries, state.locations, state.containers]);

  const addTargetDestination = async (locId: string, palletNameStr?: string) => {
    if (!locId) return;
    const loc = allLocations.find(l => l.id === locId);
    if (!loc) return;
    
    if (!palletNameStr) return; // Requires pallet

    const dests = order.targetDestinations || [];
    // Avoid duplicates
    if (dests.some((d: any) => d.locationId === locId && d.palletName === palletNameStr)) return;

    const newDest = {
      id: 'dest-' + Date.now(),
      locationId: loc.id,
      locationName: loc.name,
      palletName: palletNameStr || undefined
    };

    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: { id: order.id, updates: { targetDestinations: [...dests, newDest] } }
    });
    setNewDestLocId('');
    setNewDestPallet('');
  };

  const removeTargetDestination = async (destId: string) => {
    const dests = order.targetDestinations || [];
    const updated = dests.filter((d: any) => d.id !== destId);
    const moves = (order.moves || []).filter((m: any) => m.targetLocation !== destId);
    
    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: { id: order.id, updates: { targetDestinations: updated, moves } }
    });
  };

  const handleRenamePallet = async () => {
    if (!renamePalletModal || !renamePalletModal.newName.trim() || renamePalletModal.newName === renamePalletModal.oldName) return;
    await dispatch({
      type: 'RENAME_PALLET',
      payload: {
        oldName: renamePalletModal.oldName,
        newName: renamePalletModal.newName
      }
    });
    setRenamePalletModal(null);
  };

  const handleCancelOrder = async () => {
    await dispatch({ type: 'DELETE_MOVEMENT_ORDER', payload: { id: order.id } });
    setCancelConfirmOpen(false);
    onClose();
  };

  const handleExecuteOrder = async () => {
    await dispatch({
      type: 'EXECUTE_MOVEMENT_ORDER',
      payload: {
        id: order.id,
        moveToStaging: stagingDestIds.length > 0,
        stagingDestIds,
        removeFromInventoryDestIds
      }
    });
    onClose();
  };

  const handleExecutePallet = async (destId: string, palletName?: string) => {
    await dispatch({
      type: 'EXECUTE_MOVEMENT_ORDER',
      payload: {
        id: order.id,
        moveToStaging: stagingDestIds.includes(destId),
        stagingDestIds,
        removeFromInventoryDestIds,
        destinationIds: [destId],
        palletNames: palletName ? [palletName] : undefined
      }
    });
  };

  const handleRevertPallet = async (destId: string, palletName?: string) => {
    await dispatch({
      type: 'REVERT_MOVEMENT_ORDER',
      payload: {
        id: order.id,
        destinationIds: [destId],
        palletNames: palletName ? [palletName] : undefined
      }
    });
  };

  const totalMovesCount = order.moves?.length || 0;
  const confirmedMoveIds = order.confirmedMoveEntryIds || [];
  const confirmedCount = order.moves?.filter(m => confirmedMoveIds.includes(m.entryId)).length || 0;
  const remainingCount = totalMovesCount - confirmedCount;

  return (
    <>
      <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div id="active-movement-modal" className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] md:w-[850px] max-w-[95vw] md:max-w-4xl bg-cool-gray-850 border border-cool-gray-700 shadow-2xl p-6 rounded-2xl z-[150] animate-scale-up max-h-[90vh] overflow-y-auto text-left flex flex-col">
        <div className="flex items-center justify-between border-b border-cool-gray-750 pb-3 mb-4 shrink-0">
          <h4 className="font-bold text-indigo-400 uppercase tracking-wider text-xs flex items-center gap-2">
            <span className="text-base">🚚</span>
            Movement Settings & Actions
          </h4>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${
              isFinalized ? 'bg-amber-950/40 text-amber-400 border-amber-800' : 'bg-blue-950/40 text-blue-400 border-blue-800'
            }`}>
              {order.status}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-cool-gray-400 hover:text-white p-1 transition-colors font-bold text-sm"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Multi-Order Selector & Switcher Banner */}
        <div className="bg-cool-gray-900 border border-cool-gray-750 p-3 rounded-xl mb-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            <span className="text-xs font-bold text-cool-gray-300 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <span>🚚 Selected Order:</span>
            </span>
            <div className="flex-1 min-w-[200px] max-w-md">
              <select
                value={order.id}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setIsCreatingNewInline(true);
                  } else if (onSelectOrder) {
                    onSelectOrder(e.target.value);
                  }
                }}
                className="w-full bg-cool-gray-850 border border-indigo-500/40 text-white font-bold text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
              >
                {activeOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({o.status === 'planning' ? 'Planning' : 'Finalized'} - {o.moves?.length || 0} cuts planned)
                  </option>
                ))}
                <option value="__new__">➕ Create New Movement Order...</option>
              </select>
            </div>
            {activeOrders.length > 1 && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-800 shrink-0">
                {activeOrders.length} Concurrent Orders
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (!isCreatingNewInline) {
                setInlineNewName(`Relocation #${Math.floor(1000 + Math.random() * 9000)}`);
              }
              setIsCreatingNewInline(!isCreatingNewInline);
            }}
            className="bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-200 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>New Order</span>
          </button>
        </div>

        {/* Inline Order Creation Drawer / Box */}
        {isCreatingNewInline && (
          <div className="bg-indigo-950/30 border border-indigo-500/40 p-3.5 rounded-xl mb-4 animate-fade-in shrink-0 space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-900/50 pb-2">
              <h5 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Plus size={14} />
                Create New Concurrent Movement Order
              </h5>
              <button
                type="button"
                onClick={() => setIsCreatingNewInline(false)}
                className="text-cool-gray-400 hover:text-white text-xs font-bold"
              >
                ✕ Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-cool-gray-400 mb-1 uppercase">Order Name / ID</label>
                <input
                  type="text"
                  value={inlineNewName}
                  onChange={e => setInlineNewName(e.target.value)}
                  placeholder="e.g. Next Week Pickup"
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-cool-gray-400 mb-1 uppercase">Date</label>
                <input
                  type="date"
                  value={inlineNewDate}
                  onChange={e => setInlineNewDate(e.target.value)}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-cool-gray-400 mb-1 uppercase">Description (Optional)</label>
                <input
                  type="text"
                  value={inlineNewDesc}
                  onChange={e => setInlineNewDesc(e.target.value)}
                  placeholder="Notes..."
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCreateInlineOrder}
                disabled={!inlineNewName.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-1.5 rounded-lg transition-colors shadow cursor-pointer"
              >
                Create & Switch To Order
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Column 1: Transfer Details & Final Execution Options */}
            <div className="space-y-5">
              <div className="space-y-3 bg-cool-gray-900/30 p-4 rounded-xl border border-cool-gray-800">
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider border-b border-cool-gray-750 pb-1">Transfer Details</div>
                
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold text-[10px] uppercase">Movement Name</label>
                  <input
                    type="text"
                    value={localName}
                    onChange={e => {
                      const val = e.target.value;
                      setLocalName(val);
                    }}
                    onBlur={() => flushOrderUpdates(localName, localDate, localDesc)}
                    disabled={!isPlanning}
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="e.g. Relocation #4123"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold text-[10px] uppercase">Planned Date</label>
                  <input
                    type="date"
                    value={localDate}
                    onChange={e => {
                      const val = e.target.value;
                      setLocalDate(val);
                      flushOrderUpdates(localName, val, localDesc);
                    }}
                    onBlur={() => flushOrderUpdates(localName, localDate, localDesc)}
                    disabled={!isPlanning}
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-cool-gray-400 font-bold text-[10px] uppercase">Notes / Description</label>
                  <textarea
                    value={localDesc}
                    onChange={e => {
                      const val = e.target.value;
                      setLocalDesc(val);
                    }}
                    onBlur={() => flushOrderUpdates(localName, localDate, localDesc)}
                    disabled={!isPlanning}
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm resize-y min-h-[90px] disabled:opacity-50 disabled:cursor-not-allowed"
                    rows={4}
                    placeholder="Optional notes..."
                  />
                </div>
              </div>

              {isFinalized && (
                <div className="space-y-3 bg-cool-gray-900/30 p-4 rounded-xl border border-cool-gray-800">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider pb-1 border-b border-cool-gray-750 flex items-center justify-between">
                    <span>Fulfillment Progress</span>
                    <span className="text-cool-gray-300 font-mono text-[11px] font-bold">{confirmedCount} / {totalMovesCount} Cuts</span>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-cool-gray-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${totalMovesCount > 0 ? (confirmedCount / totalMovesCount) * 100 : 0}%` }}
                    />
                  </div>

                  <div className="text-xs text-cool-gray-300 space-y-1.5 pt-1">
                    <p className="text-[11px] text-cool-gray-400 leading-relaxed">
                      Configure execution actions directly on each target pallet on the right and confirm drop-offs as items arrive at their destination.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Target Destinations */}
            <div className="space-y-3 bg-cool-gray-900/30 p-4 rounded-xl border border-cool-gray-800">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider border-b border-cool-gray-750 pb-1 flex items-center justify-between">
                <span>Target Destinations & Pallets</span>
                <span className="text-cool-gray-500 bg-cool-gray-800 px-1.5 py-0.5 rounded">{order.targetDestinations?.length || 0}</span>
              </div>

              {isPlanning && (
                <div className="flex flex-col gap-2 bg-cool-gray-900/50 p-2.5 rounded-xl border border-cool-gray-750">
                  <select 
                    value={newDestLocId}
                    onChange={e => {
                      setNewDestLocId(e.target.value);
                      setNewDestPallet('');
                    }}
                    className="bg-cool-gray-900 border border-cool-gray-700 rounded-xl px-2 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Select Location...</option>
                    {allLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  {newDestLocId && (
                    <input 
                      type="text" 
                      value={newDestPallet}
                      onChange={e => setNewDestPallet(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && newDestPallet.trim() && addTargetDestination(newDestLocId, newDestPallet)}
                      className="bg-cool-gray-900 border border-cool-gray-700 rounded-xl px-2 py-1.5 text-white text-xs focus:border-emerald-500 focus:outline-none" 
                      placeholder="Pallet name (required)..." 
                    />
                  )}
                  <button 
                    onClick={() => addTargetDestination(newDestLocId, newDestPallet)}
                    disabled={!newDestLocId || !newDestPallet.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 font-bold text-xs"
                  >
                    <Plus size={14} /> Add Destination
                  </button>
                </div>
              )}

              <div className="space-y-2.5 max-h-56 md:max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {(order.targetDestinations || []).map(dest => {
                  const loc = allLocations.find(l => l.id === dest.locationId);
                  const isHome = !!(loc && loc.isHome);
                  const destMoves = (order.moves || []).filter(m => (m.actualLocation || m.targetLocation) === dest.id);
                  const destConfirmedCount = destMoves.filter(m => confirmedMoveIds.includes(m.entryId)).length;
                  const isDestFullyConfirmed = destMoves.length > 0 && destConfirmedCount === destMoves.length;
                  const isDestPartiallyConfirmed = destConfirmedCount > 0 && !isDestFullyConfirmed;

                  return (
                    <div key={dest.id} className={`p-3 rounded-xl border text-xs transition-all ${
                      isDestFullyConfirmed 
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                        : isDestPartiallyConfirmed
                        ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                        : 'bg-cool-gray-900 border-cool-gray-750/70 text-cool-gray-200'
                    }`}>
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className="font-bold text-white flex items-center gap-1.5 text-xs truncate">
                            <span>{isHome ? '🏠' : '🏢'}</span>
                            <span className="truncate">{dest.locationName}</span>
                            {isHome && (
                              <span className="text-[9px] bg-amber-950/70 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                                Home
                              </span>
                            )}
                            {isDestFullyConfirmed && (
                              <span className="text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                                ✓ Confirmed
                              </span>
                            )}
                          </span>
                          {dest.palletName && (
                            <span className="text-[11px] text-emerald-300 font-medium mt-0.5 truncate">📦 Pallet: {dest.palletName}</span>
                          )}
                          <span className="text-[10px] text-cool-gray-400 mt-0.5">
                            {destMoves.length} {destMoves.length === 1 ? 'cut' : 'cuts'} assigned {destMoves.length > 0 && `(${destConfirmedCount}/${destMoves.length} confirmed)`}
                          </span>
                        </div>

                        {/* Planning actions (edit/delete destination) */}
                        {isPlanning && (
                          <div className="flex items-center gap-1">
                            {dest.palletName && (
                              <button 
                                onClick={() => setRenamePalletModal({ isOpen: true, oldName: dest.palletName!, newName: dest.palletName! })}
                                className="p-1 text-emerald-500 hover:text-amber-400 rounded hover:bg-emerald-900/50 transition-colors"
                                title="Rename Target Pallet"
                              >
                                <Edit3 size={12} />
                              </button>
                            )}
                            <button onClick={() => removeTargetDestination(dest.id)} className="p-1 text-emerald-500 hover:text-red-400 rounded hover:bg-emerald-900/50 transition-colors" title="Remove Destination">
                              <X size={12} />
                            </button>
                          </div>
                        )}

                        {/* Finalized actions (Per-pallet confirmation & revert) */}
                        {isFinalized && destMoves.length > 0 && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {!isDestFullyConfirmed ? (
                              <button
                                onClick={() => handleExecutePallet(dest.id, dest.palletName)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
                                title={`Confirm and finalize drop-off for ${dest.palletName || dest.locationName}`}
                              >
                                <CheckCircle2 size={12} />
                                <span>Confirm Drop-Off</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRevertPallet(dest.id, dest.palletName)}
                                className="px-2 py-1 bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 hover:text-white rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-cool-gray-700"
                                title="Revert this drop-off"
                              >
                                <RotateCcw size={11} />
                                <span>Revert</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Per-Pallet Options (When Finalized) */}
                      {isFinalized && destMoves.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-cool-gray-750/70 space-y-1.5">
                          {isHome ? (
                            <>
                              <label className={`flex items-start gap-2 p-2 rounded-lg border transition-all ${
                                isDestFullyConfirmed 
                                  ? 'opacity-70 pointer-events-none bg-cool-gray-950/40 border-cool-gray-800' 
                                  : stagingDestIds.includes(dest.id)
                                    ? 'bg-amber-950/20 border-amber-500/40 cursor-pointer'
                                    : 'cursor-pointer hover:bg-cool-gray-950/60 bg-cool-gray-950/30 border-cool-gray-800'
                              }`}>
                                <input
                                  type="radio"
                                  name={`dest-mode-${dest.id}`}
                                  checked={stagingDestIds.includes(dest.id)}
                                  onChange={() => setHomeDestMode(dest.id, 'staging')}
                                  disabled={isDestFullyConfirmed}
                                  className="mt-0.5 h-3.5 w-3.5 text-amber-500 focus:ring-amber-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                                    <span>📦 Move to On-Site Staging Area</span>
                                  </div>
                                  <p className="text-[10px] text-cool-gray-400 mt-0.5 leading-tight">
                                    Cuts transition into counts inside on-site staging boxes for sorting into freezers.
                                  </p>
                                </div>
                              </label>

                              <label className={`flex items-start gap-2 p-2 rounded-lg border transition-all ${
                                isDestFullyConfirmed 
                                  ? 'opacity-70 pointer-events-none bg-cool-gray-950/40 border-cool-gray-800' 
                                  : removeFromInventoryDestIds.includes(dest.id)
                                    ? 'bg-red-950/20 border-red-500/40 cursor-pointer'
                                    : 'cursor-pointer hover:bg-cool-gray-950/60 bg-cool-gray-950/30 border-cool-gray-800'
                              }`}>
                                <input
                                  type="radio"
                                  name={`dest-mode-${dest.id}`}
                                  checked={removeFromInventoryDestIds.includes(dest.id)}
                                  onChange={() => setHomeDestMode(dest.id, 'remove')}
                                  disabled={isDestFullyConfirmed}
                                  className="mt-0.5 h-3.5 w-3.5 text-red-500 focus:ring-red-500 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-bold text-red-300 flex items-center gap-1">
                                    <span>⚡ Remove from inventory immediately (Direct customer handoff / No staging)</span>
                                  </div>
                                  <p className="text-[10px] text-cool-gray-400 mt-0.5 leading-tight">
                                    Cuts are going directly to a customer upon arrival and will not hit the staging area or sorting table.
                                  </p>
                                </div>
                              </label>

                              <label className={`flex items-start gap-2 p-2 rounded-lg border transition-all ${
                                isDestFullyConfirmed 
                                  ? 'opacity-70 pointer-events-none bg-cool-gray-950/40 border-cool-gray-800' 
                                  : !stagingDestIds.includes(dest.id) && !removeFromInventoryDestIds.includes(dest.id)
                                    ? 'bg-cool-gray-800/40 border-cool-gray-600 cursor-pointer'
                                    : 'cursor-pointer hover:bg-cool-gray-950/60 bg-cool-gray-950/30 border-cool-gray-800'
                              }`}>
                                <input
                                  type="radio"
                                  name={`dest-mode-${dest.id}`}
                                  checked={!stagingDestIds.includes(dest.id) && !removeFromInventoryDestIds.includes(dest.id)}
                                  onChange={() => setHomeDestMode(dest.id, 'keep')}
                                  disabled={isDestFullyConfirmed}
                                  className="mt-0.5 h-3.5 w-3.5 text-cool-gray-400 focus:ring-cool-gray-400 cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-bold text-cool-gray-300 flex items-center gap-1">
                                    <span>🏠 Keep in storage records under Home</span>
                                  </div>
                                  <p className="text-[10px] text-cool-gray-400 mt-0.5 leading-tight">
                                    Cuts remain tracked in storage records under this Home location (Pallet: {dest.palletName || 'Default'}).
                                  </p>
                                </div>
                              </label>
                            </>
                          ) : (
                            <label className={`flex items-start gap-2 p-2 rounded-lg border transition-all ${
                              isDestFullyConfirmed 
                                ? 'opacity-70 pointer-events-none bg-cool-gray-950/40 border-cool-gray-800' 
                                : removeFromInventoryDestIds.includes(dest.id)
                                  ? 'bg-emerald-950/20 border-emerald-500/40 cursor-pointer'
                                  : 'cursor-pointer hover:bg-cool-gray-950/60 bg-cool-gray-950/30 border-cool-gray-800'
                            }`}>
                              <input
                                type="checkbox"
                                checked={removeFromInventoryDestIds.includes(dest.id)}
                                onChange={() => {
                                  setRemoveFromInventoryDestIds(prev => 
                                    prev.includes(dest.id) ? prev.filter(id => id !== dest.id) : [...prev, dest.id]
                                  );
                                }}
                                disabled={isDestFullyConfirmed}
                                className="mt-0.5 h-3.5 w-3.5 rounded border-cool-gray-600 bg-cool-gray-700 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-bold text-cool-gray-200 flex items-center gap-1">
                                  <span>Remove from inventory after delivery</span>
                                </div>
                                <p className="text-[10px] text-cool-gray-400 mt-0.5 leading-tight">
                                  {removeFromInventoryDestIds.includes(dest.id)
                                    ? 'Delivered cuts will be permanently archived and deducted from offsite inventory.'
                                    : `Cuts will be relocated in offsite inventory under ${dest.locationName} (Pallet: ${dest.palletName || 'Default'}).`}
                                </p>
                              </div>
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {!(order.targetDestinations || []).length && (
                  <div className="text-xs text-cool-gray-500 italic p-2 text-center border border-dashed border-cool-gray-750 rounded-lg">No destinations added yet.</div>
                )}
              </div>

              {isPlanning && (
                <div className="mt-3 pt-3 border-t border-cool-gray-750 space-y-2">
                  <div>
                    <div className="text-[9px] text-cool-gray-500 font-bold mb-1 uppercase tracking-wider">Quick Add Existing Pallets</div>
                    <div className="flex flex-wrap gap-1">
                      {allPallets.filter(p => p.locationId && !(order.targetDestinations || []).some(d => d.palletName === p.palletName)).map(p => (
                        <button key={p.palletName} onClick={() => addTargetDestination(p.locationId, p.palletName)} className="text-[10px] bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 px-1.5 py-0.5 rounded border border-cool-gray-700 transition-colors">
                          + {p.palletName}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Modal Actions / Footer */}
        <div className="pt-4 mt-4 border-t border-cool-gray-750 shrink-0 space-y-3">
          <div className="flex flex-wrap gap-2 justify-between items-center">
            {/* Left side actions: Cancel Order */}
            <button
              onClick={() => setCancelConfirmOpen(true)}
              className="px-3.5 py-1.5 border border-red-500/30 bg-red-950/20 hover:bg-red-950/40 text-red-400 rounded-xl transition-colors font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              title="Cancel and Delete Movement Order"
            >
              <Trash2 size={14} />
              <span>Cancel Movement</span>
            </button>

            {/* Right side actions: Reports & State Change */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsReportModalOpen(true)}
                className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-100 rounded-xl transition-colors font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                title="View & Print Movement Reports"
              >
                <Printer size={14} className="text-blue-400" />
                <span>Reports</span>
              </button>

              {isPlanning && (
                <button
                  onClick={async () => {
                    await dispatch({ type: 'UPDATE_MOVEMENT_ORDER', payload: { id: order.id, updates: { status: 'finalized' } } });
                  }}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg shadow-amber-900/20"
                >
                  <CheckCircle2 size={14} />
                  <span>Done Planning</span>
                </button>
              )}

              {isFinalized && (
                <button
                  onClick={async () => {
                    await dispatch({ type: 'UPDATE_MOVEMENT_ORDER', payload: { id: order.id, updates: { status: 'planning' } } });
                  }}
                  className="px-3.5 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-600 text-white rounded-xl transition-colors font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Back to Planning</span>
                </button>
              )}
            </div>
          </div>

          {/* Large Action Buttons (Confirm & Execute / Done) */}
          <div className="pt-2 border-t border-cool-gray-750/50 flex flex-col sm:flex-row gap-2 items-center">
            {isFinalized && totalMovesCount > 0 && (
              <div className="text-xs text-cool-gray-400 font-medium px-1 flex-1 text-left">
                Progress: <span className="font-bold text-white">{confirmedCount}</span> of <span className="font-bold text-white">{totalMovesCount}</span> cuts confirmed
              </div>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              {isFinalized && (
                <button
                  onClick={handleExecuteOrder}
                  className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/20 cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>{confirmedCount > 0 && remainingCount > 0 ? `Execute Remaining (${remainingCount})` : 'Execute Movement'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl transition-colors font-bold text-sm cursor-pointer shadow-md shadow-indigo-950/40 border border-indigo-500/30 ${
                  isFinalized ? 'w-24' : 'w-full'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rename Pallet Inner Modal */}
      {renamePalletModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[160]">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-2">Rename Pallet</h3>
            <p className="text-sm text-cool-gray-400 mb-4">
              Renaming <span className="font-mono text-amber-400">{renamePalletModal.oldName}</span> will update all existing off-site items and movement targets using this pallet.
            </p>
            <input
              type="text"
              value={renamePalletModal.newName || ''}
              onChange={(e) => setRenamePalletModal({ ...renamePalletModal, newName: e.target.value })}
              className="w-full bg-cool-gray-950 border border-cool-gray-800 rounded-xl p-3 text-white mb-6 focus:border-amber-500 focus:outline-none"
              placeholder="New Pallet Name"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRenamePalletModal(null)}
                className="px-4 py-2 rounded-xl text-cool-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRenamePallet}
                disabled={!renamePalletModal.newName.trim() || renamePalletModal.newName === renamePalletModal.oldName}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {cancelConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[160]">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scale-up">
            <h3 className="text-lg font-bold text-white mb-2">Cancel Movement Order?</h3>
            <p className="text-sm text-cool-gray-400 mb-6">
              Are you sure you want to cancel and delete the movement order <span className="font-bold text-red-400">"{order.name}"</span>? This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setCancelConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-cool-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                No, Keep It
              </button>
              <button
                onClick={handleCancelOrder}
                className="px-4 py-2 rounded-xl bg-red-650 hover:bg-red-600 text-white font-bold transition-colors cursor-pointer"
              >
                Yes, Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Modal Portal */}
      {isReportModalOpen && (
        <MovementReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          order={order}
          state={state}
          dispatch={dispatch}
        />
      )}
    </>
  );
};
