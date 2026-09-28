import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Plus, Trash2, Box, Package, Calendar, Hash, Scale, 
  Layers, Tag as TagIcon, Check, AlertCircle, Sparkles, 
  ListPlus, Save, ChevronDown, ArrowRight, RefreshCw, CheckCircle2, Split
} from 'lucide-react';
import { InventoryState, Action, ButcherOrder, OffSiteEntry, Product, Tag } from '../types';
import { SearchableProductSelect } from './SearchableProductSelect';

export interface ManualCutItem {
  id: string;
  productId: string;
  cutName: string;
  originalCutName: string;
  pieces: number;
  netWeight: number;
  box: string;
  serial: string;
  packDate: string;
  lot: string;
  tagIds: string[];
  notes: string;
}

interface ManualButcherEntryModalProps {
  isOpen?: boolean;
  onClose: () => void;
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  initialOrder?: ButcherOrder | null;
  onAddToImportForm?: (cuts: ManualCutItem[]) => void;
}

export const ManualButcherEntryModal: React.FC<ManualButcherEntryModalProps> = ({
  isOpen = true,
  onClose,
  state,
  dispatch,
  initialOrder = null,
  onAddToImportForm
}) => {
  if (isOpen === false) return null;

  const orders = useMemo(() => {
    return [...(state.butcherOrders || [])].sort((a, b) => {
      const numA = (a.orderNumber || '').trim();
      const numB = (b.orderNumber || '').trim();
      if (numA && numB) {
        return numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [state.butcherOrders]);

  const products = state.products || [];
  const locations = state.locations || [];
  const tags = state.tags || [];

  // Target Order state: order id, or '__NEW__' or '__IMPORT_FORM__'
  const [targetOrderId, setTargetOrderId] = useState<string>(() => {
    if (initialOrder) return initialOrder.id;
    if (onAddToImportForm) return '__IMPORT_FORM__';
    if (orders.length > 0) return orders[0].id;
    return '__NEW__';
  });

  // If creating new order context on the fly
  const [newOrderNumber, setNewOrderNumber] = useState('');
  const [newOrderSpecies, setNewOrderSpecies] = useState('Beef');
  const [newOrderLocationId, setNewOrderLocationId] = useState('');

  // Find currently selected order object
  const selectedOrder = useMemo(() => {
    if (targetOrderId === '__NEW__' || targetOrderId === '__IMPORT_FORM__') return null;
    return orders.find(o => o.id === targetOrderId) || null;
  }, [orders, targetOrderId]);

  // Destination and Pallet placement state
  const [importToOffSite, setImportToOffSite] = useState<boolean>(true);
  const [targetLocationId, setTargetLocationId] = useState<string>('');
  const [targetPallet, setTargetPallet] = useState<string>('');

  useEffect(() => {
    if (initialOrder) {
      setTargetOrderId(initialOrder.id);
    } else if (onAddToImportForm) {
      setTargetOrderId('__IMPORT_FORM__');
    }
  }, [initialOrder, onAddToImportForm]);

  // Sync default location & pallet when selected order changes
  useEffect(() => {
    if (selectedOrder) {
      const locId = selectedOrder.targetLocation || selectedOrder.locationId || '';
      setTargetLocationId(locId);
      const pallet = selectedOrder.targetPallet || selectedOrder.pallet || '';
      setTargetPallet(pallet);
      if (selectedOrder.orderNumber && !lot) {
        setLot(selectedOrder.orderNumber);
      }
      if (selectedOrder.killDate && !packDate) {
        setPackDate(selectedOrder.killDate);
      }
    } else if (targetOrderId === '__IMPORT_FORM__') {
      // Default to first storage location if available
      const storageLoc = locations.find(l => l.type === 'storage') || locations[0];
      if (storageLoc && !targetLocationId) {
        setTargetLocationId(storageLoc.id);
      }
    }
  }, [selectedOrder, targetOrderId]);

  // Existing boxes used in this order
  const existingBoxes = useMemo(() => {
    const boxSet = new Set<string>();
    const orderNum = selectedOrder?.orderNumber;
    (state.offSiteEntries || []).forEach(e => {
      if ((selectedOrder && e.orderId === selectedOrder.id) || (orderNum && e.orderNumber === orderNum)) {
        if (e.box && e.box.trim()) {
          boxSet.add(e.box.trim());
        }
      }
    });
    // Also check queued items
    return Array.from(boxSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [state.offSiteEntries, selectedOrder]);

  // Available pallets for the active location
  const availablePallets = useMemo(() => {
    const effLocId = targetLocationId || selectedOrder?.locationId || '';
    const effLoc = locations.find(l => l.id === effLocId);
    const palletSet = new Set<string>();
    
    (state.pallets || []).forEach(p => {
      if (!p.isArchived) {
        if (!effLocId || !p.storageLocationId || p.storageLocationId === effLocId) {
          palletSet.add(p.name);
        }
      }
    });

    (state.offSiteEntries || []).forEach(e => {
      if (!e.archived && (e.pallet || e.currentLocation)) {
        const palName = (e.pallet || e.currentLocation || '').trim();
        if (palName) {
          if (!effLoc || !e.location || e.location.toLowerCase() === effLoc.name.toLowerCase()) {
            palletSet.add(palName);
          }
        }
      }
    });

    return Array.from(palletSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [state.pallets, state.offSiteEntries, targetLocationId, selectedOrder, locations]);

  // Form Inputs for current cut
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [useCustomCutName, setUseCustomCutName] = useState<boolean>(false);
  const [customCutName, setCustomCutName] = useState<string>('');
  const [originalCutName, setOriginalCutName] = useState<string>('');

  // Weight entry mode: 'individual' | 'total'
  const [weightMode, setWeightMode] = useState<'individual' | 'total'>('individual');
  const [weightInput, setWeightInput] = useState<string>('');
  const [piecesInput, setPiecesInput] = useState<string>('1');
  
  // Multi-weight batch scale entry
  const [isMultiScaleMode, setIsMultiScaleMode] = useState<boolean>(false);
  const [multiWeightsText, setMultiWeightsText] = useState<string>('');

  // Total weight split mode: 'single' | 'split'
  const [totalWeightSplitMode, setTotalWeightSplitMode] = useState<'single' | 'split'>('single');

  // Box, Serial, Dates, Lot
  const [boxNumber, setBoxNumber] = useState<string>('Box 1');
  const [serialNumber, setSerialNumber] = useState<string>('');
  const [packDate, setPackDate] = useState<string>(() => {
    return initialOrder?.killDate || initialOrder?.pickupDate || new Date().toISOString().split('T')[0];
  });
  const [lot, setLot] = useState<string>(() => {
    return initialOrder?.orderNumber || '';
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Session Queued Items
  const [queuedItems, setQueuedItems] = useState<ManualCutItem[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const activeProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // When product changes, auto-populate default tags and originalCutName if empty
  useEffect(() => {
    if (activeProduct) {
      if (activeProduct.defaultTagIds && activeProduct.defaultTagIds.length > 0) {
        setSelectedTagIds(prev => Array.from(new Set([...prev, ...(activeProduct.defaultTagIds || [])])));
      }
      if (!originalCutName) {
        setOriginalCutName(activeProduct.name);
      }
    }
  }, [activeProduct]);

  // Auto-generate serial helper
  const generateNextSerial = () => {
    const orderPrefix = selectedOrder?.orderNumber || newOrderNumber || 'ORD';
    
    // Count existing serials in this order + queue
    const allSerials = new Set<string>();
    (state.offSiteEntries || []).forEach(e => {
      if (e.serial) allSerials.add(e.serial.trim().toLowerCase());
    });
    queuedItems.forEach(q => {
      if (q.serial) allSerials.add(q.serial.trim().toLowerCase());
    });

    let seq = queuedItems.length + 1;
    let candidate = `${orderPrefix}-${String(seq).padStart(3, '0')}`;
    while (allSerials.has(candidate.toLowerCase())) {
      seq++;
      candidate = `${orderPrefix}-${String(seq).padStart(3, '0')}`;
    }
    return candidate;
  };

  // Next box helper
  const handleIncrementBox = () => {
    const trimmed = boxNumber.trim();
    const match = trimmed.match(/^(.*?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10) + 1;
      setBoxNumber(`${prefix}${num}`);
    } else if (trimmed) {
      setBoxNumber(`${trimmed} 2`);
    } else {
      setBoxNumber('Box 1');
    }
  };

  // Parse multi-weights text
  const parsedMultiWeights = useMemo(() => {
    if (!isMultiScaleMode || !multiWeightsText.trim()) return [];
    return multiWeightsText
      .split(/[\s,;\n]+/)
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0);
  }, [isMultiScaleMode, multiWeightsText]);

  // Compute calculated metrics for current input
  const currentMetrics = useMemo(() => {
    if (weightMode === 'individual') {
      if (isMultiScaleMode) {
        const count = parsedMultiWeights.length;
        const total = parsedMultiWeights.reduce((acc, w) => acc + w, 0);
        return {
          count,
          totalWeight: total,
          avgWeight: count > 0 ? total / count : 0
        };
      } else {
        const w = parseFloat(weightInput) || 0;
        const pcs = parseInt(piecesInput, 10) || 1;
        return {
          count: pcs,
          totalWeight: w,
          avgWeight: pcs > 0 ? w / pcs : w
        };
      }
    } else {
      // Total weight mode
      const totalW = parseFloat(weightInput) || 0;
      const pcs = parseInt(piecesInput, 10) || 1;
      return {
        count: pcs,
        totalWeight: totalW,
        avgWeight: pcs > 0 ? totalW / pcs : 0
      };
    }
  }, [weightMode, isMultiScaleMode, parsedMultiWeights, weightInput, piecesInput]);

  // Validate if current cut inputs are valid to add
  const canAddCurrentCut = useMemo(() => {
    const hasName = useCustomCutName ? !!customCutName.trim() : !!selectedProductId;
    if (!hasName) return false;

    if (weightMode === 'individual') {
      if (isMultiScaleMode) {
        return parsedMultiWeights.length > 0;
      }
      return (parseFloat(weightInput) || 0) > 0;
    } else {
      return (parseFloat(weightInput) || 0) > 0 && (parseInt(piecesInput, 10) || 0) > 0;
    }
  }, [useCustomCutName, customCutName, selectedProductId, weightMode, isMultiScaleMode, parsedMultiWeights, weightInput, piecesInput]);

  // Add current cut(s) to the staging queue
  const handleAddCurrentToQueue = () => {
    if (!canAddCurrentCut) return;

    const cutTitle = useCustomCutName 
      ? customCutName.trim() 
      : (activeProduct?.name || 'Custom Cut');

    const rawCut = originalCutName.trim() || cutTitle;
    const baseSerial = serialNumber.trim() || generateNextSerial();
    const effectiveBox = boxNumber.trim() || 'Box 1';
    const effectivePackDate = packDate.trim();
    const effectiveLot = lot.trim() || (selectedOrder?.orderNumber || newOrderNumber || '');

    const newItems: ManualCutItem[] = [];

    if (weightMode === 'individual') {
      if (isMultiScaleMode) {
        // Multi-scale entries: 1 item per weight
        parsedMultiWeights.forEach((w, idx) => {
          let itemSerial = baseSerial;
          if (idx > 0) {
            // Sequential serial increment
            const match = baseSerial.match(/^(.*?)(\d+)$/);
            if (match) {
              const prefix = match[1];
              const num = parseInt(match[2], 10) + idx;
              const padLen = match[2].length;
              itemSerial = `${prefix}${String(num).padStart(padLen, '0')}`;
            } else {
              itemSerial = `${baseSerial}-${idx + 1}`;
            }
          }

          newItems.push({
            id: crypto.randomUUID(),
            productId: selectedProductId,
            cutName: cutTitle,
            originalCutName: rawCut,
            pieces: 1,
            netWeight: Math.round(w * 100) / 100,
            box: effectiveBox,
            serial: itemSerial,
            packDate: effectivePackDate,
            lot: effectiveLot,
            tagIds: [...selectedTagIds],
            notes: notes.trim()
          });
        });
      } else {
        // Single individual cut entry
        const netW = parseFloat(weightInput) || 0;
        const pcs = parseInt(piecesInput, 10) || 1;
        newItems.push({
          id: crypto.randomUUID(),
          productId: selectedProductId,
          cutName: cutTitle,
          originalCutName: rawCut,
          pieces: pcs,
          netWeight: Math.round(netW * 100) / 100,
          box: effectiveBox,
          serial: baseSerial,
          packDate: effectivePackDate,
          lot: effectiveLot,
          tagIds: [...selectedTagIds],
          notes: notes.trim()
        });
      }
    } else {
      // Total weight mode
      const totalNetW = parseFloat(weightInput) || 0;
      const pcs = parseInt(piecesInput, 10) || 1;

      if (totalWeightSplitMode === 'split' && pcs > 1) {
        // Split into individual packages
        const unitWeight = Math.round((totalNetW / pcs) * 100) / 100;
        for (let i = 0; i < pcs; i++) {
          let itemSerial = baseSerial;
          if (i > 0) {
            const match = baseSerial.match(/^(.*?)(\d+)$/);
            if (match) {
              const prefix = match[1];
              const num = parseInt(match[2], 10) + i;
              const padLen = match[2].length;
              itemSerial = `${prefix}${String(num).padStart(padLen, '0')}`;
            } else {
              itemSerial = `${baseSerial}-${i + 1}`;
            }
          }

          newItems.push({
            id: crypto.randomUUID(),
            productId: selectedProductId,
            cutName: cutTitle,
            originalCutName: rawCut,
            pieces: 1,
            netWeight: unitWeight,
            box: effectiveBox,
            serial: itemSerial,
            packDate: effectivePackDate,
            lot: effectiveLot,
            tagIds: [...selectedTagIds],
            notes: notes.trim()
          });
        }
      } else {
        // Single aggregate entry
        newItems.push({
          id: crypto.randomUUID(),
          productId: selectedProductId,
          cutName: cutTitle,
          originalCutName: rawCut,
          pieces: pcs,
          netWeight: Math.round(totalNetW * 100) / 100,
          box: effectiveBox,
          serial: baseSerial,
          packDate: effectivePackDate,
          lot: effectiveLot,
          tagIds: [...selectedTagIds],
          notes: notes.trim()
        });
      }
    }

    setQueuedItems(prev => [...prev, ...newItems]);

    // Give visual confirmation
    setFeedbackMessage(`Added ${newItems.length} cut${newItems.length > 1 ? 's' : ''} to queue`);
    setTimeout(() => setFeedbackMessage(null), 2500);

    // Reset cut and weight inputs, but retain Box, PackDate, Lot, Location, Pallet
    setWeightInput('');
    setMultiWeightsText('');
    setPiecesInput('1');
    setNotes('');

    // Advance serial number if possible
    if (baseSerial) {
      const match = baseSerial.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const nextNum = parseInt(match[2], 10) + newItems.length;
        const padLen = match[2].length;
        setSerialNumber(`${prefix}${String(nextNum).padStart(padLen, '0')}`);
      } else {
        setSerialNumber('');
      }
    }
  };

  // Remove an item from the queue
  const handleRemoveFromQueue = (id: string) => {
    setQueuedItems(prev => prev.filter(item => item.id !== id));
  };

  // Total summary of all queued items
  const queueSummary = useMemo(() => {
    let totalPieces = 0;
    let totalWeight = 0;
    const boxSet = new Set<string>();
    const cutsMap = new Map<string, number>();

    queuedItems.forEach(item => {
      totalPieces += item.pieces;
      totalWeight += item.netWeight;
      if (item.box) boxSet.add(item.box);
      cutsMap.set(item.cutName, (cutsMap.get(item.cutName) || 0) + item.pieces);
    });

    return {
      count: queuedItems.length,
      totalPieces,
      totalWeight: Math.round(totalWeight * 100) / 100,
      uniqueBoxes: boxSet.size,
      cutsBreakdown: Array.from(cutsMap.entries())
    };
  }, [queuedItems]);

  // Final Commit / Save
  const handleSaveAll = () => {
    // If the user filled in the cut fields but didn't click "Add to Queue", include them now
    let itemsToSave = [...queuedItems];
    if (canAddCurrentCut) {
      const cutTitle = useCustomCutName ? customCutName.trim() : (activeProduct?.name || 'Custom Cut');
      const rawCut = originalCutName.trim() || cutTitle;
      const baseSerial = serialNumber.trim() || generateNextSerial();
      const effectiveBox = boxNumber.trim() || 'Box 1';
      const effectivePackDate = packDate.trim();
      const effectiveLot = lot.trim() || (selectedOrder?.orderNumber || newOrderNumber || '');
      const netW = parseFloat(weightInput) || 0;
      const pcs = parseInt(piecesInput, 10) || 1;

      itemsToSave.push({
        id: crypto.randomUUID(),
        productId: selectedProductId,
        cutName: cutTitle,
        originalCutName: rawCut,
        pieces: pcs,
        netWeight: Math.round(netW * 100) / 100,
        box: effectiveBox,
        serial: baseSerial,
        packDate: effectivePackDate,
        lot: effectiveLot,
        tagIds: [...selectedTagIds],
        notes: notes.trim()
      });
    }

    if (itemsToSave.length === 0) {
      setFormError('Please add at least one cut to the order before saving.');
      return;
    }

    // If pushing to import intake form
    if (targetOrderId === '__IMPORT_FORM__' && onAddToImportForm) {
      onAddToImportForm(itemsToSave);
      onClose();
      return;
    }

    // Determine target order object
    let finalOrder: ButcherOrder;
    if (targetOrderId === '__NEW__') {
      if (!newOrderNumber.trim()) {
        setFormError('Please enter an Order Number for the new butcher order.');
        return;
      }
      finalOrder = {
        id: crypto.randomUUID(),
        orderNumber: newOrderNumber.trim(),
        species: newOrderSpecies.trim() || 'Beef',
        createdAt: Date.now(),
        locationId: newOrderLocationId || undefined,
        killDate: packDate || undefined,
        liveWeight: 0,
        hotWeight: 0,
        coldWeight: 0,
        targetLocation: targetLocationId || newOrderLocationId || undefined,
        targetPallet: targetPallet.trim() || undefined
      };
    } else {
      if (!selectedOrder) {
        setFormError('Please select a target butcher order.');
        return;
      }
      finalOrder = selectedOrder;
    }

    // Destination placement
    const effLoc = locations.find(l => l.id === targetLocationId || l.name === targetLocationId);
    const locName = effLoc ? effLoc.name : (targetLocationId || finalOrder.targetLocation || '');
    const palName = targetPallet.trim();

    // Map itemsToSave into OffSiteEntry format
    const recordsToSave: OffSiteEntry[] = itemsToSave.map(item => ({
      id: item.id,
      serial: item.serial,
      productId: item.productId || undefined,
      originalCutName: item.originalCutName,
      packDate: item.packDate,
      lot: item.lot,
      pieces: item.pieces,
      netWeight: item.netWeight,
      box: item.box,
      location: importToOffSite ? locName : '',
      pallet: importToOffSite ? palName : '',
      currentLocation: importToOffSite ? palName : '',
      storageLocationId: importToOffSite && effLoc ? effLoc.id : undefined,
      notes: item.notes,
      orderId: finalOrder.id,
      orderNumber: finalOrder.orderNumber,
      archived: !importToOffSite,
      importedToOffSite: importToOffSite,
      tagIds: item.tagIds
    }));

    dispatch({
      type: 'ADD_BUTCHER_ORDER',
      payload: {
        order: finalOrder,
        records: recordsToSave,
        targetLocation: locName,
        targetPallet: palName
      }
    });

    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      id="manual-butcher-entry-modal"
    >
      <div 
        className="bg-cool-gray-900 border border-cool-gray-700 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-cool-gray-850 border-b border-cool-gray-750 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Scale size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>Manual Butcher Item Entry</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800">
                  Interactive Form
                </span>
              </h2>
              <p className="text-xs text-cool-gray-400">
                Key in butcher cuts, scale weights, serials, and boxes without requiring a CSV file.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 rounded-xl transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Error Banner */}
          {formError && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-700/80 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-3 animate-shake">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-rose-400 shrink-0" />
                <span className="font-semibold">{formError}</span>
              </div>
              <button
                type="button"
                onClick={() => setFormError(null)}
                className="text-rose-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* 1. Target Order & Destination Configuration Card */}
          <div className="bg-cool-gray-850/80 p-4 rounded-xl border border-cool-gray-750 space-y-4">
            <div className="flex items-center justify-between border-b border-cool-gray-750/70 pb-2">
              <span className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Package size={14} /> 1. Target Butcher Order & Storage Placement
              </span>
              {selectedOrder && (
                <span className="text-[11px] text-cool-gray-400">
                  {selectedOrder.species} • {selectedOrder.killDate ? `Kill: ${selectedOrder.killDate}` : 'No date'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-1.5">
                  Target Butcher Order *
                </label>
                <select
                  value={targetOrderId}
                  onChange={(e) => setTargetOrderId(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                >
                  {onAddToImportForm && (
                    <option value="__IMPORT_FORM__">📋 Queue into Current Order Intake Form</option>
                  )}
                  {orders.map(o => (
                    <option key={o.id} value={o.id}>
                      Order #{o.orderNumber} - {o.species} ({o.killDate || 'No date'})
                    </option>
                  ))}
                  <option value="__NEW__">➕ Create New Butcher Order Context...</option>
                </select>
              </div>

              {targetOrderId === '__NEW__' ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-300 mb-1">New Order # *</label>
                    <input
                      type="text"
                      placeholder="e.g. 1042"
                      value={newOrderNumber}
                      onChange={e => setNewOrderNumber(e.target.value)}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-300 mb-1">Species</label>
                    <input
                      type="text"
                      placeholder="e.g. Beef, Pork"
                      value={newOrderSpecies}
                      onChange={e => setNewOrderSpecies(e.target.value)}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 pt-4 sm:pt-0">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-cool-gray-200">
                    <input
                      type="checkbox"
                      checked={importToOffSite}
                      onChange={(e) => setImportToOffSite(e.target.checked)}
                      className="rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                    />
                    <span className="font-bold">Add Directly to Off-Site Inventory</span>
                  </label>
                </div>
              )}
            </div>

            {/* Storage Placement details if importToOffSite is checked */}
            {importToOffSite && (
              <div className="pt-2 border-t border-cool-gray-750/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                    Destination Storage Facility / Location
                  </label>
                  <select
                    value={targetLocationId}
                    onChange={(e) => setTargetLocationId(e.target.value)}
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                  >
                    <option value="">-- Select Location --</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.isHome ? '(Farm/Home)' : loc.type === 'storage' ? '(Storage)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                    Destination Pallet / Placement
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="manual-entry-pallets-list"
                      placeholder="e.g. Pallet 1, Freezer Rack A"
                      value={targetPallet}
                      onChange={(e) => setTargetPallet(e.target.value)}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                    />
                    <datalist id="manual-entry-pallets-list">
                      {availablePallets.map(p => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Cut Selection & Weight Form */}
          <div className="bg-cool-gray-850/80 p-4 rounded-xl border border-cool-gray-750 space-y-4">
            <div className="flex items-center justify-between border-b border-cool-gray-750/70 pb-2 flex-wrap gap-2">
              <span className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <Scale size={14} /> 2. Cut Details & Weights
              </span>

              <button
                type="button"
                onClick={() => setUseCustomCutName(!useCustomCutName)}
                className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition underline cursor-pointer"
              >
                {useCustomCutName ? '← Select from Product Catalog' : '✏️ Enter Custom / Uncataloged Cut'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Selection */}
              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-1.5">
                  Meat Cut / Product *
                </label>
                {useCustomCutName ? (
                  <input
                    type="text"
                    placeholder="e.g. Pork Shoulder Bone-In Roast"
                    value={customCutName}
                    onChange={(e) => {
                      setCustomCutName(e.target.value);
                      if (!originalCutName) setOriginalCutName(e.target.value);
                    }}
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    autoFocus
                  />
                ) : (
                  <SearchableProductSelect
                    products={products}
                    value={selectedProductId}
                    onChange={(val) => setSelectedProductId(val)}
                    placeholder="Search product by cut name or category..."
                  />
                )}
              </div>

              {/* Raw package text / Original name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-cool-gray-300">
                    Original Butcher Label / Raw Cut Text
                  </label>
                  <span className="text-[10px] text-cool-gray-500">As printed on package</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. BEEF CHUCK EYE STEAK 2/PK"
                  value={originalCutName}
                  onChange={(e) => setOriginalCutName(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Weight Mode Switcher */}
            <div className="pt-2 border-t border-cool-gray-750/60 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-cool-gray-300 uppercase tracking-wider">
                  Weight Input Mode
                </span>

                <div className="flex bg-cool-gray-950 p-0.5 rounded-xl border border-cool-gray-750">
                  <button
                    type="button"
                    onClick={() => setWeightMode('individual')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      weightMode === 'individual'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                  >
                    Individual Cut Weight
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightMode('total')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      weightMode === 'total'
                        ? 'bg-cyan-600 text-white shadow-sm'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                  >
                    Total / Bulk Weight
                  </button>
                </div>
              </div>

              {/* Individual Weight Mode Inputs */}
              {weightMode === 'individual' ? (
                <div className="space-y-3 bg-cool-gray-900/60 p-3.5 rounded-xl border border-cool-gray-800">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-cool-gray-400">
                      Weighing individual packages or entering one scale weight at a time:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMultiScaleMode(!isMultiScaleMode)}
                      className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles size={12} />
                      {isMultiScaleMode ? 'Single Weight Entry' : '⚡ Batch Scale Weights (Paste Multiple)'}
                    </button>
                  </div>

                  {isMultiScaleMode ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-cool-gray-300">
                        Paste or Type Scale Weights (comma, space, or newline separated)
                      </label>
                      <textarea
                        rows={3}
                        placeholder="e.g. 2.15, 2.30, 2.25, 2.40, 2.10, 1.95"
                        value={multiWeightsText}
                        onChange={(e) => setMultiWeightsText(e.target.value)}
                        className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-cyan-500 outline-none resize-none"
                      />
                      {parsedMultiWeights.length > 0 && (
                        <div className="flex items-center gap-3 text-xs bg-emerald-950/40 border border-emerald-800/40 p-2.5 rounded-lg text-emerald-300 font-semibold">
                          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                          <span>
                            Detected <strong>{parsedMultiWeights.length} packages</strong> • Total:{' '}
                            <strong className="text-white">{currentMetrics.totalWeight.toFixed(2)} lbs</strong> • Avg:{' '}
                            <strong className="text-white">{currentMetrics.avgWeight.toFixed(2)} lbs/pc</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                          Net Weight (lbs) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="e.g. 2.45"
                          value={weightInput}
                          onChange={(e) => setWeightInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && canAddCurrentCut) {
                              e.preventDefault();
                              handleAddCurrentToQueue();
                            }
                          }}
                          className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-2 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                          Number of Pieces in Package
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="1"
                          value={piecesInput}
                          onChange={(e) => setPiecesInput(e.target.value)}
                          className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Total / Bulk Weight Mode */
                <div className="space-y-3 bg-cool-gray-900/60 p-3.5 rounded-xl border border-cool-gray-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                        Total Net Weight (lbs) *
                      </label>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="e.g. 30.5"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-2 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                        Total Number of Pieces / Cuts *
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="e.g. 10"
                        value={piecesInput}
                        onChange={(e) => setPiecesInput(e.target.value)}
                        className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Split options */}
                  <div className="pt-2 border-t border-cool-gray-800/80 flex items-center justify-between flex-wrap gap-2 text-xs">
                    <span className="text-cool-gray-400">
                      Calculated Average:{' '}
                      <strong className="text-cyan-400 font-mono">
                        {currentMetrics.avgWeight > 0 ? `${currentMetrics.avgWeight.toFixed(2)} lbs/piece` : '0.00 lbs'}
                      </strong>
                    </span>

                    <div className="flex bg-cool-gray-950 p-0.5 rounded-lg border border-cool-gray-750">
                      <button
                        type="button"
                        onClick={() => setTotalWeightSplitMode('single')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer ${
                          totalWeightSplitMode === 'single'
                            ? 'bg-cyan-600 text-white'
                            : 'text-cool-gray-400 hover:text-white'
                        }`}
                      >
                        Save as 1 Bulk Record
                      </button>
                      <button
                        type="button"
                        onClick={() => setTotalWeightSplitMode('split')}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                          totalWeightSplitMode === 'split'
                            ? 'bg-cyan-600 text-white'
                            : 'text-cool-gray-400 hover:text-white'
                        }`}
                      >
                        <Split size={12} />
                        Split into Individual Packages
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Box, Serial, Pack Date, and Lot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-cool-gray-750/60">
              {/* Box Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-cool-gray-300">Box #</label>
                  <button
                    type="button"
                    onClick={handleIncrementBox}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800/80 cursor-pointer"
                    title="Increment to next box number"
                  >
                    + Next Box
                  </button>
                </div>
                <input
                  type="text"
                  list="manual-entry-boxes-list"
                  placeholder="e.g. Box 1"
                  value={boxNumber}
                  onChange={(e) => setBoxNumber(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                />
                <datalist id="manual-entry-boxes-list">
                  {existingBoxes.map(b => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              {/* Serial Number */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-cool-gray-300">Serial #</label>
                  <button
                    type="button"
                    onClick={() => setSerialNumber(generateNextSerial())}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-800/80 cursor-pointer flex items-center gap-0.5"
                    title="Auto-generate next sequential serial"
                  >
                    <Sparkles size={10} /> Auto #
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 104-001"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>

              {/* Pack Date */}
              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-1">Pack Date</label>
                <input
                  type="date"
                  value={packDate}
                  onChange={(e) => setPackDate(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>

              {/* Lot Number */}
              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-1">Lot Number</label>
                <input
                  type="text"
                  placeholder="e.g. LOT-402"
                  value={lot}
                  onChange={(e) => setLot(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Tags and Optional Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-cool-gray-750/60">
              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-1.5">
                  Item Tags
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-cool-gray-950/60 rounded-xl border border-cool-gray-800">
                  {tags.map(t => {
                    const isSelected = selectedTagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedTagIds(prev => prev.filter(id => id !== t.id));
                          } else {
                            setSelectedTagIds(prev => [...prev, t.id]);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-600 text-white'
                            : 'bg-cool-gray-800 text-cool-gray-400 hover:text-white border border-cool-gray-700'
                        }`}
                      >
                        {t.name}
                        {isSelected && <Check size={10} />}
                      </button>
                    );
                  })}
                  {tags.length === 0 && (
                    <span className="text-xs text-cool-gray-500 italic p-1">No tags defined</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-cool-gray-300 mb-1.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special cut, dry aged, sample"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>

            {/* Add to Queue Button Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-cool-gray-750 gap-3 flex-wrap">
              <div className="text-xs text-cool-gray-400 flex items-center gap-2">
                {feedbackMessage ? (
                  <span className="text-emerald-400 font-bold animate-pulse flex items-center gap-1">
                    <CheckCircle2 size={14} /> {feedbackMessage}
                  </span>
                ) : (
                  <span>
                    💡 Press <strong>Add to Queue</strong> or hit <kbd className="bg-cool-gray-800 px-1 py-0.5 rounded border border-cool-gray-700 text-cool-gray-300 font-mono">Enter</kbd> to stage item.
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddCurrentToQueue}
                disabled={!canAddCurrentCut}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <ListPlus size={16} />
                <span>+ Add Cut to Order Queue</span>
              </button>
            </div>
          </div>

          {/* 3. Session Queue & Summary Table */}
          <div className="bg-cool-gray-850/90 p-4 rounded-xl border border-cool-gray-750 space-y-3">
            <div className="flex items-center justify-between border-b border-cool-gray-750/70 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-cyan-400 uppercase tracking-wider">
                  3. Staged Cuts ({queueSummary.count})
                </span>
                {queueSummary.count > 0 && (
                  <span className="text-[11px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded-full">
                    {queueSummary.totalWeight.toFixed(2)} lbs total • {queueSummary.totalPieces} pcs
                  </span>
                )}
              </div>

              {queuedItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQueuedItems([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-bold transition cursor-pointer"
                >
                  Clear Queue
                </button>
              )}
            </div>

            {queuedItems.length === 0 ? (
              <div className="text-center py-6 bg-cool-gray-900/40 rounded-xl border border-dashed border-cool-gray-800">
                <p className="text-xs text-cool-gray-400">
                  No cuts queued in this session yet. Fill in the form above and click <strong className="text-cyan-400">+ Add Cut to Order Queue</strong>.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60 overflow-y-auto rounded-xl border border-cool-gray-750">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-cool-gray-950 text-cool-gray-400 uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-cool-gray-750">
                    <tr>
                      <th className="py-2 px-3 font-bold">Cut / Product</th>
                      <th className="py-2 px-2 font-bold">Pcs</th>
                      <th className="py-2 px-3 font-bold">Weight (lbs)</th>
                      <th className="py-2 px-3 font-bold">Box</th>
                      <th className="py-2 px-3 font-bold">Serial #</th>
                      <th className="py-2 px-3 font-bold">Date / Lot</th>
                      <th className="py-2 px-2 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cool-gray-800/80 font-mono">
                    {queuedItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-cool-gray-800/60 transition">
                        <td className="py-2 px-3 font-sans font-bold text-white max-w-[200px] truncate">
                          {item.cutName}
                          {item.originalCutName && item.originalCutName !== item.cutName && (
                            <span className="block text-[10px] text-cool-gray-400 font-normal truncate">
                              ({item.originalCutName})
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-cool-gray-300">{item.pieces}</td>
                        <td className="py-2 px-3 text-cyan-300 font-bold">{item.netWeight.toFixed(2)}</td>
                        <td className="py-2 px-3 text-cool-gray-300">{item.box || '—'}</td>
                        <td className="py-2 px-3 text-amber-300">{item.serial || '—'}</td>
                        <td className="py-2 px-3 text-cool-gray-400 text-[11px] font-sans">
                          {item.packDate || '—'} {item.lot ? `• Lot ${item.lot}` : ''}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(item.id)}
                            className="p-1 text-cool-gray-500 hover:text-rose-400 hover:bg-cool-gray-800 rounded transition cursor-pointer"
                            title="Remove cut from queue"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-4 bg-cool-gray-850 border-t border-cool-gray-750 shrink-0 flex-wrap gap-3">
          <div className="text-xs text-cool-gray-400">
            {queueSummary.count > 0 ? (
              <span>
                Ready to save <strong className="text-white font-bold">{queueSummary.count} item{queueSummary.count > 1 ? 's' : ''}</strong> ({queueSummary.totalWeight.toFixed(2)} lbs)
              </span>
            ) : canAddCurrentCut ? (
              <span className="text-cyan-400">
                1 cut ready in form (will be automatically saved)
              </span>
            ) : (
              <span>Queue items to enable saving</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={queueSummary.count === 0 && !canAddCurrentCut}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Save size={16} />
              <span>
                {targetOrderId === '__IMPORT_FORM__'
                  ? `Apply ${queueSummary.count || 1} Cut${(queueSummary.count || 1) > 1 ? 's' : ''} to Intake Form`
                  : `Save ${queueSummary.count || 1} Item${(queueSummary.count || 1) > 1 ? 's' : ''} to Order`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
