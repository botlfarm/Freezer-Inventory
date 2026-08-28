import React, { useState, useMemo } from 'react';
import { Plus, X, Edit3, Trash2, Printer, CheckCircle2, RotateCcw, ClipboardList, Square, CheckSquare, Home, Info, Calendar } from 'lucide-react';
import { InventoryState, Action, MovementOrder } from '../types';
import { MovementReportModal } from './MovementReportModal';

interface ActiveMovementModalProps {
  order: MovementOrder;
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

export const ActiveMovementModal: React.FC<ActiveMovementModalProps> = ({ order, state, dispatch, onClose }) => {
  const isPlanning = order.status === 'planning';
  const isFinalized = order.status === 'finalized';
  
  const [newDestLocId, setNewDestLocId] = useState('');
  const [newDestPallet, setNewDestPallet] = useState('');
  const [renamePalletModal, setRenamePalletModal] = useState<{ isOpen: boolean; oldName: string; newName: string } | null>(null);

  const [moveToStaging, setMoveToStaging] = useState(true);
  const [removeFromInventoryDestIds, setRemoveFromInventoryDestIds] = useState<string[]>([]);
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

  const allLocations = state.locations || [];
  
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
        moveToStaging,
        removeFromInventoryDestIds
      }
    });
    onClose();
  };

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
                <div className="space-y-4 bg-cool-gray-900/30 p-4 rounded-xl border border-cool-gray-800">
                  <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider pb-1 border-b border-cool-gray-750">Final Execution Options</div>
                  
                  {/* Staging transition choice */}
                  <div className="flex items-start gap-2.5 bg-cool-gray-900/50 p-3 rounded-xl border border-cool-gray-750">
                    <input
                      id="modal-staging-checkbox"
                      type="checkbox"
                      checked={moveToStaging}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setMoveToStaging(checked);
                        if (checked) {
                          setRemoveFromInventoryDestIds(prev => 
                            prev.filter(id => {
                              const dest = (order.targetDestinations || []).find(d => d.id === id);
                              if (!dest) return true;
                              const loc = allLocations.find(l => l.id === dest.locationId);
                              return !(loc && loc.isHome);
                            })
                          );
                        }
                      }}
                      disabled={!hasMovedHome}
                      className="mt-0.5 h-4 w-4 rounded border-cool-gray-600 bg-cool-gray-700 text-amber-500 focus:ring-amber-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    />
                    <div>
                      <label htmlFor="modal-staging-checkbox" className={`text-xs font-bold select-none cursor-pointer ${hasMovedHome ? 'text-white' : 'text-cool-gray-500'}`}>
                        Move coming-home items to Staging Area
                      </label>
                      <p className="text-[11px] text-cool-gray-400 mt-0.5">
                        Cuts designated for Home locations will transition into counts inside simple on-site staging containers.
                      </p>
                    </div>
                  </div>

                  {/* Remove from inventory after delivery */}
                  <div className="space-y-2 bg-cool-gray-900/50 p-3 rounded-xl border border-cool-gray-750">
                    <div className="text-xs font-bold text-cool-gray-300 flex items-center gap-1.5">
                      🏢 Remove from Inventory After Delivery
                    </div>
                    <p className="text-[11px] text-cool-gray-400">
                      Select any locations where delivered items should be permanently removed from offsite inventory upon confirmation.
                    </p>
                    <div className="space-y-1.5 max-h-32 md:max-h-48 overflow-y-auto pr-1">
                      {(order.targetDestinations || []).map((dest) => {
                        const loc = allLocations.find((l) => l.id === dest.locationId);
                        const isHome = loc && loc.isHome;
                        const isHandledByStaging = isHome && moveToStaging;
                        const isChecked = removeFromInventoryDestIds.includes(dest.id);
                        return (
                          <div
                            key={dest.id}
                            onClick={() => {
                              if (isHandledByStaging) return;
                              if (isChecked) {
                                setRemoveFromInventoryDestIds(removeFromInventoryDestIds.filter((id) => id !== dest.id));
                              } else {
                                setRemoveFromInventoryDestIds([...removeFromInventoryDestIds, dest.id]);
                              }
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                              isHandledByStaging 
                                ? 'bg-cool-gray-950/40 border-cool-gray-800/20 opacity-50 cursor-not-allowed' 
                                : 'bg-cool-gray-950 border-cool-gray-800 hover:bg-cool-gray-850 hover:border-cool-gray-700 cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isHandledByStaging ? (
                                <Square size={14} className="text-cool-gray-600" />
                              ) : isChecked ? (
                                <CheckSquare size={14} className="text-emerald-500" />
                              ) : (
                                <Square size={14} className="text-cool-gray-500" />
                              )}
                              <span className="font-semibold text-cool-gray-300">
                                🏢 {dest.locationName} {dest.palletName ? `(${dest.palletName})` : ''}
                              </span>
                            </div>
                            {isHandledByStaging && (
                              <span className="text-[9px] bg-amber-900/30 text-amber-400 px-1 rounded border border-amber-800/40 font-bold uppercase">Staging</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Target Destinations */}
            <div className="space-y-3 bg-cool-gray-900/30 p-4 rounded-xl border border-cool-gray-800">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider border-b border-cool-gray-750 pb-1 flex items-center justify-between">
                <span>Target Destinations</span>
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

              <div className="space-y-1.5 max-h-36 md:max-h-64 overflow-y-auto custom-scrollbar pr-1">
                {(order.targetDestinations || []).map(dest => (
                  <div key={dest.id} className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-emerald-100 text-xs font-semibold flex justify-between items-center group">
                    <div className="flex flex-col">
                      <span className="text-emerald-400">🏢 {dest.locationName}</span>
                      {dest.palletName && <span className="text-[11px] text-emerald-200">📦 {dest.palletName}</span>}
                    </div>
                    {isPlanning && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  </div>
                ))}
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
          <div className="pt-2 border-t border-cool-gray-750/50 flex gap-2">
            {isFinalized && (
              <button
                onClick={handleExecuteOrder}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/20 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Execute Movement</span>
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
