import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { compareBoxLabels } from '../utils/boxSort';
import { Truck, Plus, ChevronRight, Calendar, CheckCircle2, ArrowRightCircle, PackageOpen, Info, Edit3, X, Trash2, RotateCcw, Home, ClipboardList, CheckSquare, Square, ShieldAlert, Printer, Wrench, ChevronDown, Download, MinusSquare, FileText, Flag } from 'lucide-react';
import { MovementOrder, MovementItem } from '../types';
import { MovementReportModal } from './MovementReportModal';

const flagColors = [
  { name: 'Red', value: 'red', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', fill: 'fill-red-500', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { name: 'Orange', value: 'orange', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-500', fill: 'fill-amber-500', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', fill: 'fill-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { name: 'Green', value: 'green', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', fill: 'fill-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { name: 'Blue', value: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', fill: 'fill-blue-500', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { name: 'Purple', value: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', fill: 'fill-purple-500', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
];

const renderFlagBadgeHelper = (flags: Record<string, string> | undefined, id: string) => {
  if (!flags) return null;
  const flagColor = flags[id];
  if (!flagColor) return null;
  const colorObj = flagColors.find(c => c.value === flagColor);
  if (!colorObj) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${colorObj.badge}`}>
      <Flag size={10} className={`${colorObj.fill} ${colorObj.text}`} />
      {colorObj.name}
    </span>
  );
};

const renderItemTagsHelper = (tags: any[] | undefined, items: any[]) => {
  if (!tags || !items) return null;
  const uniqueTagIds = Array.from(new Set(items.flatMap(it => it.tagIds || [])));
  if (uniqueTagIds.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {uniqueTagIds.map(tagId => {
        const tag = tags.find(t => t.id === tagId);
        if (!tag) return null;
        return (
          <span 
            key={tag.id}
            style={{ 
              backgroundColor: `${tag.color}15`, 
              borderColor: `${tag.color}35`, 
              color: tag.color || '#60a5fa' 
            }}
            className="inline-flex items-center gap-0.5 text-[8px] border px-1 py-0.2 rounded font-black tracking-wide uppercase select-none animate-fade-in"
            title={`Tag on item: ${tag.description || tag.name}`}
          >
            {tag.id === 'use-first' ? '🍳 ' : tag.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{tag.name}
          </span>
        );
      })}
    </div>
  );
};

export const OffSiteMovementPlanner = ({ state, dispatch }) => {
  const rawEntries = (state.offSiteEntries || []).filter((e: any) => {
    if (e.archived) return false;
    if (e.box && state.containers?.some((c: any) => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
      return false;
    }
    return true;
  });
  const products = state.products || [];
  const entries = useMemo(() => {
    return rawEntries.map((e: any) => {
      const cutsStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').trim();
      const origStr = (e.originalCutName || '').trim();
      const normStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || '').trim();

      let matchedProduct = null;
      if (normStr) {
        matchedProduct = products.find((p: any) => p.name.trim().toLowerCase() === normStr.toLowerCase());
      }
      if (!matchedProduct) {
        const getPrefixNumber = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const origNum = getPrefixNumber(origStr) || getPrefixNumber(cutsStr);
        if (origNum) {
          matchedProduct = products.find((p: any) => 
            p.productNumbers && p.productNumbers.some((num: string) => 
              num.toLowerCase() === origNum.toLowerCase()
            )
          );
        }
      }
      if (!matchedProduct) {
        const getNamePart = (str: string) => {
          const m = str.match(/^\d+\s+(.*)$/);
          return m ? m[1].trim() : str.trim();
        };
        const origNamePart = getNamePart(origStr) || getNamePart(cutsStr);
        if (origNamePart) {
          matchedProduct = products.find((p: any) => p.name.trim().toLowerCase() === origNamePart.toLowerCase());
        }
      }

      return {
        ...e,
        cuts: matchedProduct ? matchedProduct.name : ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)),
        matchedProduct
      };
    });
  }, [rawEntries, products]);

  const orders = state.movementOrders || [];

  // Custom state-based confirm modal to bypass iframe blockages
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    isDanger?: boolean;
    onConfirm?: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const allPallets = useMemo(() => {
    const palletsMap = new Map<string, { palletName: string, locationId: string, locationName: string }>();
    entries.forEach(e => {
      if (e.currentLocation) {
        const loc = state.locations?.find((l: any) => l.name.toLowerCase() === e.location?.toLowerCase());
        palletsMap.set(e.currentLocation, { 
          palletName: e.currentLocation, 
          locationId: loc?.id || '', 
          locationName: e.location || 'Unassigned' 
        });
      }
    });
    return Array.from(palletsMap.values());
  }, [entries, state.locations]);

  const allLocations = state.locations || [];

  const lastCompletedOrder = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed' && o.executedAt);
    if (completed.length === 0) return null;
    return [...completed].sort((a, b) => new Date(b.executedAt!).getTime() - new Date(a.executedAt!).getTime())[0];
  }, [orders]);

  const askConfirm = (
    title: string,
    message: string,
    isDanger: boolean,
    confirmText: string,
    onConfirm: () => void | Promise<void>
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      isDanger,
      confirmText,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        await onConfirm();
      }
    });
  };

  const activeOrder = orders.find(o => o.status === 'planning' || o.status === 'finalized');

  if (!activeOrder) {
    return null;
  }

  // If the active movement order is finalized, we don't render any banner
  if (activeOrder.status === 'finalized') {
    return null;
  }

  const renderFlagBadge = (id: string) => renderFlagBadgeHelper(activeOrder?.flags, id);

  // Active Order View
  return (
    <>
      <ActiveOrderPlanner 
        order={activeOrder} 
        entries={entries} 
        dispatch={dispatch} 
        onBack={() => {}} 
        allPallets={allPallets} 
        allLocations={allLocations} 
        lastCompletedOrderId={lastCompletedOrder?.id} 
        askConfirm={askConfirm} 
        state={state}
      />
      <ConfirmModalOverlay 
        isOpen={confirmModal.isOpen} 
        title={confirmModal.title} 
        message={confirmModal.message} 
        confirmText={confirmModal.confirmText} 
        isDanger={confirmModal.isDanger} 
        onConfirm={() => {
          if (confirmModal.onConfirm) confirmModal.onConfirm();
        }} 
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} 
      />
    </>
  );
};

const ConfirmModalOverlay = ({ isOpen, title, message, confirmText, isDanger, onConfirm, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-cool-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-cool-gray-750 animate-fade-in">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-cool-gray-400 mt-2">
          {message}
        </p>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 text-sm font-semibold rounded-xl transition duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-white text-sm font-semibold rounded-xl transition duration-150 cursor-pointer ${
              isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ActiveOrderPlanner = ({ order, entries, dispatch, onBack, allPallets, allLocations, lastCompletedOrderId, askConfirm, state }) => {
  const isPlanning = order.status === 'planning';
  const isFinalized = order.status === 'finalized';
  const isCompleted = order.status === 'completed';
  const isLastCompleted = lastCompletedOrderId && lastCompletedOrderId === order.id;

  const renderFlagBadge = (id: string) => renderFlagBadgeHelper(order.flags, id);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const [moveToStaging, setMoveToStaging] = useState(true);
  const [removeFromInventoryDestIds, setRemoveFromInventoryDestIds] = useState<string[]>([]);

  const [finalizedTab, setFinalizedTab] = useState<'checklist' | 'options'>('checklist');
  const [checklistPhase, setChecklistPhase] = useState<'pick' | 'deliver'>('pick');

  const [editingItemNoteId, setEditingItemNoteId] = useState<string | null>(null);
  const [itemNoteValue, setItemNoteValue] = useState<string>('');

  const handleSaveItemNote = (itemId: string) => {
    dispatch({
      type: 'UPDATE_OFFSITE_ENTRY',
      payload: { id: itemId, updates: { notes: itemNoteValue.trim() } }
    });
    setEditingItemNoteId(null);
  };

  const movesMap = useMemo(() => {
    return new Map(order.moves.map(m => [m.entryId, m.actualLocation || m.targetLocation]));
  }, [order.moves]);

  interface ExecBox {
    id: string;
    boxLabel: string;
    sourcePallet: string;
    items: any[];
    totalWeight: number;
    totalPieces: number;
    targetLocationId: string;
    targetLocationName: string;
    targetPalletName?: string;
    isSplit: boolean;
    destinations: {
      locationId: string;
      locationName: string;
      palletName?: string;
      itemCount: number;
      weight: number;
    }[];
  }

  interface DeliverBox {
    id: string;
    boxLabel: string;
    sourcePallet: string;
    items: any[];
    totalWeight: number;
    totalPieces: number;
    targetLocationId: string;
    targetLocationName: string;
    targetPalletName?: string;
    isSplitPart: boolean;
    destinations?: {
      locationId: string;
      locationName: string;
      palletName?: string;
      itemCount: number;
      weight: number;
    }[];
  }

  const execBoxes = useMemo(() => {
    const boxGroups = new Map<string, ExecBox>();
    
    entries.forEach((e: any) => {
      if (!movesMap.has(e.id)) return;
      const sourcePallet = e.currentLocation || 'Unknown Pallet';
      const boxLabel = e.box || e.serial || 'N/A';
      const key = `${sourcePallet}::${boxLabel}`;
      
      const targetDestId = movesMap.get(e.id);
      const dest = order.targetDestinations?.find((d: any) => d.id === targetDestId);
      const targetLocationName = dest ? dest.locationName : 'Unknown Location';
      const targetPalletName = dest ? dest.palletName : undefined;
      
      if (!boxGroups.has(key)) {
        boxGroups.set(key, {
          id: key,
          boxLabel,
          sourcePallet,
          items: [],
          totalWeight: 0,
          totalPieces: 0,
          targetLocationId: targetDestId || '',
          targetLocationName,
          targetPalletName,
          isSplit: false,
          destinations: []
        });
      }
      
      const group = boxGroups.get(key)!;
      group.items.push(e);
      group.totalWeight += e.netWeight || 0;
      group.totalPieces += e.pieces || 1;

      // Track item specific destinations
      const destKey = targetDestId || 'unassigned';
      let existingDest = group.destinations.find(d => d.locationId === destKey);
      if (!existingDest) {
        group.destinations.push({
          locationId: destKey,
          locationName: targetLocationName,
          palletName: targetPalletName,
          itemCount: 1,
          weight: e.netWeight || 0
        });
      } else {
        existingDest.itemCount += 1;
        existingDest.weight += e.netWeight || 0;
      }
    });

    // Mark as split if more than 1 destination is present
    boxGroups.forEach(group => {
      group.isSplit = group.destinations.length > 1;
    });
    
    return Array.from(boxGroups.values()).sort((a, b) => {
      const palletCompare = a.sourcePallet.localeCompare(b.sourcePallet, undefined, { numeric: true, sensitivity: 'base' });
      if (palletCompare !== 0) return palletCompare;
      return compareBoxLabels(a.boxLabel, b.boxLabel);
    });
  }, [entries, movesMap, order.targetDestinations]);

  const deliverBoxes = useMemo(() => {
    const boxGroups = new Map<string, DeliverBox>();
    const destinationCounts = new Map<string, Set<string>>();
    const boxDestinations = new Map<string, Array<{
      locationId: string;
      locationName: string;
      palletName?: string;
      itemCount: number;
      weight: number;
    }>>();
    
    entries.forEach((e: any) => {
      if (!movesMap.has(e.id)) return;
      const sourcePallet = e.currentLocation || 'Unknown Pallet';
      const boxLabel = e.box || e.serial || 'N/A';
      const boxKey = `${sourcePallet}::${boxLabel}`;
      const targetDestId = movesMap.get(e.id) || 'unassigned';
      
      const dest = order.targetDestinations?.find((d: any) => d.id === targetDestId);
      const targetLocationName = dest ? dest.locationName : 'Unknown Location';
      const targetPalletName = dest ? dest.palletName : undefined;

      if (!destinationCounts.has(boxKey)) {
        destinationCounts.set(boxKey, new Set());
      }
      destinationCounts.get(boxKey)!.add(targetDestId);

      if (!boxDestinations.has(boxKey)) {
        boxDestinations.set(boxKey, []);
      }
      const dests = boxDestinations.get(boxKey)!;
      let existingDest = dests.find(d => d.locationId === targetDestId);
      if (!existingDest) {
        dests.push({
          locationId: targetDestId,
          locationName: targetLocationName,
          palletName: targetPalletName,
          itemCount: 1,
          weight: e.netWeight || 0
        });
      } else {
        existingDest.itemCount += 1;
        existingDest.weight += e.netWeight || 0;
      }
    });

    entries.forEach((e: any) => {
      if (!movesMap.has(e.id)) return;
      const sourcePallet = e.currentLocation || 'Unknown Pallet';
      const boxLabel = e.box || e.serial || 'N/A';
      const targetDestId = movesMap.get(e.id);
      const dest = order.targetDestinations?.find((d: any) => d.id === targetDestId);
      const targetLocationName = dest ? dest.locationName : 'Unknown Location';
      const targetPalletName = dest ? dest.palletName : undefined;
      
      const boxKey = `${sourcePallet}::${boxLabel}`;
      const key = `${sourcePallet}::${boxLabel}::${targetDestId}`;
      const isSplitPart = (destinationCounts.get(boxKey)?.size || 0) > 1;
      
      if (!boxGroups.has(key)) {
        boxGroups.set(key, {
          id: key,
          boxLabel,
          sourcePallet,
          items: [],
          totalWeight: 0,
          totalPieces: 0,
          targetLocationId: targetDestId || '',
          targetLocationName,
          targetPalletName,
          isSplitPart,
          destinations: boxDestinations.get(boxKey) || []
        });
      }
      
      const group = boxGroups.get(key)!;
      group.items.push(e);
      group.totalWeight += e.netWeight || 0;
      group.totalPieces += e.pieces || 1;
    });
    
    return Array.from(boxGroups.values()).sort((a, b) => {
      const palletCompare = a.sourcePallet.localeCompare(b.sourcePallet, undefined, { numeric: true, sensitivity: 'base' });
      if (palletCompare !== 0) return palletCompare;
      return compareBoxLabels(a.boxLabel, b.boxLabel);
    });
  }, [entries, movesMap, order.targetDestinations]);

  const pickGroups = useMemo(() => {
    const groups: Record<string, ExecBox[]> = {};
    execBoxes.forEach(b => {
      if (!groups[b.sourcePallet]) groups[b.sourcePallet] = [];
      groups[b.sourcePallet].push(b);
    });
    return Object.entries(groups);
  }, [execBoxes]);

  const deliverGroups = useMemo(() => {
    const groups: Record<string, { label: string, boxes: DeliverBox[] }> = {};
    deliverBoxes.forEach(b => {
      const destKey = `${b.targetLocationId}::${b.targetPalletName || ''}`;
      const destLabel = b.targetPalletName 
        ? `Pallet: ${b.targetPalletName} (${b.targetLocationName})` 
        : `Location: ${b.targetLocationName} (No Pallet)`;
      if (!groups[destKey]) {
        groups[destKey] = { label: destLabel, boxes: [] };
      }
      groups[destKey].boxes.push(b);
    });
    return Object.entries(groups);
  }, [deliverBoxes]);

  const pickedBoxIds = order.pickedBoxIds || [];
  const deliveredBoxIds = order.deliveredBoxIds || [];
  const pickedItemIds = order.pickedItemIds || [];
  const deliveredItemIds = order.deliveredItemIds || [];

  const totalPickedBoxes = useMemo(() => {
    return execBoxes.filter(b => pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id))).length;
  }, [execBoxes, pickedBoxIds, pickedItemIds]);

  const totalDeliveredBoxes = useMemo(() => {
    return deliverBoxes.filter(b => deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id))).length;
  }, [deliverBoxes, deliveredBoxIds, deliveredItemIds]);

  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [expandedBoxes, setExpandedBoxes] = useState<string[]>([]);

  const toggleBoxExpanded = (boxId: string) => {
    setExpandedBoxes(prev =>
      prev.includes(boxId) ? prev.filter(id => id !== boxId) : [...prev, boxId]
    );
  };

  const expandAllBoxes = (expand: boolean) => {
    if (expand) {
      setExpandedBoxes(execBoxes.map(b => b.id));
    } else {
      setExpandedBoxes([]);
    }
  };

  const getBoxSplitSummary = (boxLabel: string, sourcePallet: string, destinations: any[]) => {
    const allBoxItems = entries.filter((e: any) => {
      const label = e.box || e.serial || 'N/A';
      const source = e.currentLocation || 'Unknown Pallet';
      return label === boxLabel && source === sourcePallet && movesMap.has(e.id);
    });

    return destinations.map(d => {
      const matchingItems = allBoxItems.filter(it => {
        const itemDestId = movesMap.get(it.id);
        return itemDestId === d.locationId;
      });

      const cutGroup: Record<string, number> = {};
      matchingItems.forEach(it => {
        const cutName = it.cuts || 'Unknown';
        cutGroup[cutName] = (cutGroup[cutName] || 0) + (it.pieces || 1);
      });

      const cutString = Object.entries(cutGroup)
        .map(([cutName, pcs]) => `${pcs} ${cutName}`)
        .join(', ');

      return `${cutString} to ${d.locationName}${d.palletName ? ` (${d.palletName})` : ''}`;
    }).join(', ');
  };

  const saveAsPdf = async () => {
    setIsPdfGenerating(true);
    try {
      const loadHtml2Pdf = () => {
        return new Promise<any>((resolve, reject) => {
          if ((window as any).html2pdf) {
            resolve((window as any).html2pdf);
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
          script.crossOrigin = 'anonymous';
          script.onload = () => resolve((window as any).html2pdf);
          script.onerror = () => reject(new Error('Failed to load html2pdf.js'));
          document.head.appendChild(script);
        });
      };

      const html2pdf = await loadHtml2Pdf();
      const element = document.getElementById('field-checklist-pdf');
      if (!element) {
        throw new Error('Checklist printable element not found');
      }

      // Create an offscreen wrapper placed at (0, 0) of viewport to guarantee 0px top/left offset
      const tempWrapper = document.createElement('div');
      tempWrapper.style.position = 'fixed';
      tempWrapper.style.top = '0px';
      tempWrapper.style.left = '0px';
      tempWrapper.style.width = '720px';
      tempWrapper.style.backgroundColor = '#ffffff';
      tempWrapper.style.zIndex = '-99999';
      tempWrapper.style.margin = '0px';
      tempWrapper.style.padding = '0px';

      const clone = element.cloneNode(true) as HTMLElement;
      // Remove any no-print elements
      clone.querySelectorAll('.no-print').forEach(el => el.remove());

      clone.style.margin = '0px';
      clone.style.padding = '0px';
      clone.style.width = '720px';

      tempWrapper.appendChild(clone);
      document.body.appendChild(tempWrapper);

      const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4],
        filename:     `Movement_Checklist_${order.date || 'Order'}_${order.name || 'Checklist'}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { 
          scale: 2, 
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0,
          windowWidth: 720,
          logging: false
        },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['tr', '.page-break-avoid', '.border', 'table'], before: ['.page-break-before'] }
      };

      try {
        const worker = html2pdf().set(opt).from(clone);
        const pdf = await worker.toPdf().get('pdf');
        const pdfTotalPages = pdf.internal.getNumberOfPages();

        // Stamp page numbers & header metadata on all pages
        for (let i = 1; i <= pdfTotalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(100, 100, 100);
          
          // Left footer: Document info
          pdf.text(
            `${order.name || 'Movement Order'} • Checklist • ${order.date || ''}`,
            0.4,
            10.65
          );
          
          // Right footer: Page count
          pdf.text(
            `Page ${i} of ${pdfTotalPages}`,
            pdf.internal.pageSize.getWidth() - 0.4,
            10.65,
            { align: 'right' }
          );
        }

        await worker.save();
      } finally {
        if (document.body.contains(tempWrapper)) {
          document.body.removeChild(tempWrapper);
        }
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const toggleBoxPicked = async (boxId: string) => {
    const box = execBoxes.find(b => b.id === boxId);
    if (!box) return;

    const isBoxFullyPicked = pickedBoxIds.includes(boxId) || box.items.every(it => pickedItemIds.includes(it.id));
    
    let updatedBoxIds = [...pickedBoxIds];
    let updatedItemIds = [...pickedItemIds];

    if (isBoxFullyPicked) {
      updatedBoxIds = updatedBoxIds.filter(id => id !== boxId);
      const boxItemIds = box.items.map(it => it.id);
      updatedItemIds = updatedItemIds.filter(id => !boxItemIds.includes(id));
    } else {
      if (!updatedBoxIds.includes(boxId)) {
        updatedBoxIds.push(boxId);
      }
      box.items.forEach(it => {
        if (!updatedItemIds.includes(it.id)) {
          updatedItemIds.push(it.id);
        }
      });
    }

    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: { 
        id: order.id, 
        updates: { 
          pickedBoxIds: updatedBoxIds,
          pickedItemIds: updatedItemIds 
        } 
      }
    });
  };

  const toggleItemPicked = async (boxId: string, itemId: string) => {
    const box = execBoxes.find(b => b.id === boxId);
    if (!box) return;

    const isItemPicked = pickedItemIds.includes(itemId);
    let updatedItemIds = [...pickedItemIds];
    let updatedBoxIds = [...pickedBoxIds];

    if (isItemPicked) {
      updatedItemIds = updatedItemIds.filter(id => id !== itemId);
      updatedBoxIds = updatedBoxIds.filter(id => id !== boxId);
    } else {
      updatedItemIds.push(itemId);
      const allBoxItemsPicked = box.items.every(it => it.id === itemId || updatedItemIds.includes(it.id));
      if (allBoxItemsPicked && !updatedBoxIds.includes(boxId)) {
        updatedBoxIds.push(boxId);
      }
    }

    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: {
        id: order.id,
        updates: {
          pickedBoxIds: updatedBoxIds,
          pickedItemIds: updatedItemIds
        }
      }
    });
  };

  const toggleBoxDelivered = async (boxId: string) => {
    const box = deliverBoxes.find(b => b.id === boxId);
    if (!box) return;

    const isBoxFullyDelivered = deliveredBoxIds.includes(boxId) || box.items.every(it => deliveredItemIds.includes(it.id));
    
    let updatedBoxIds = [...deliveredBoxIds];
    let updatedItemIds = [...deliveredItemIds];

    if (isBoxFullyDelivered) {
      updatedBoxIds = updatedBoxIds.filter(id => id !== boxId);
      const boxItemIds = box.items.map(it => it.id);
      updatedItemIds = updatedItemIds.filter(id => !boxItemIds.includes(id));
    } else {
      if (!updatedBoxIds.includes(boxId)) {
        updatedBoxIds.push(boxId);
      }
      box.items.forEach(it => {
        if (!updatedItemIds.includes(it.id)) {
          updatedItemIds.push(it.id);
        }
      });
    }

    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: { 
        id: order.id, 
        updates: { 
          deliveredBoxIds: updatedBoxIds,
          deliveredItemIds: updatedItemIds 
        } 
      }
    });
  };

  const toggleItemDelivered = async (boxId: string, itemId: string) => {
    const box = deliverBoxes.find(b => b.id === boxId);
    if (!box) return;

    const isItemDelivered = deliveredItemIds.includes(itemId);
    let updatedItemIds = [...deliveredItemIds];
    let updatedBoxIds = [...deliveredBoxIds];

    if (isItemDelivered) {
      updatedItemIds = updatedItemIds.filter(id => id !== itemId);
      updatedBoxIds = updatedBoxIds.filter(id => id !== boxId);
    } else {
      updatedItemIds.push(itemId);
      const allBoxItemsDelivered = box.items.every(it => it.id === itemId || updatedItemIds.includes(it.id));
      if (allBoxItemsDelivered && !updatedBoxIds.includes(boxId)) {
        updatedBoxIds.push(boxId);
      }
    }

    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: {
        id: order.id,
        updates: {
          deliveredBoxIds: updatedBoxIds,
          deliveredItemIds: updatedItemIds
        }
      }
    });
  };

  const markAllPicked = async (val: boolean) => {
    const updatedBoxIds = val ? execBoxes.map(b => b.id) : [];
    const updatedItemIds = val ? execBoxes.flatMap(b => b.items.map(it => it.id)) : [];
    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: { 
        id: order.id, 
        updates: { 
          pickedBoxIds: updatedBoxIds,
          pickedItemIds: updatedItemIds 
        } 
      }
    });
  };

  const markAllDelivered = async (val: boolean) => {
    const updatedBoxIds = val ? deliverBoxes.map(b => b.id) : [];
    const updatedItemIds = val ? deliverBoxes.flatMap(b => b.items.map(it => it.id)) : [];
    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: { 
        id: order.id, 
        updates: { 
          deliveredBoxIds: updatedBoxIds,
          deliveredItemIds: updatedItemIds 
        } 
      }
    });
  };

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

  useEffect(() => {
    if (isFinalized) {
      const dests = order.targetDestinations || [];
      const defaultRemoved = dests
        .filter(dest => {
          const loc = allLocations.find(l => l.id === dest.locationId);
          return loc && loc.type === 'delivery_pickup';
        })
        .map(dest => dest.id);
      setRemoveFromInventoryDestIds(defaultRemoved);
    }
  }, [isFinalized, order.targetDestinations, allLocations]);

  const togglePallet = async (pallet: string) => {
    if (!isPlanning) return;
    const isSelected = order.palletsInPlay.includes(pallet);
    const updated = isSelected ? order.palletsInPlay.filter(p => p !== pallet) : [...order.palletsInPlay, pallet];
    await dispatch({ type: 'UPDATE_MOVEMENT_ORDER', payload: { id: order.id, updates: { palletsInPlay: updated } } });
  };

  const updateMoveTarget = async (entryId: string, target: string) => {
    if (!isPlanning) return;
    let moves = [...order.moves];
    const existingIdx = moves.findIndex(m => m.entryId === entryId);
    if (existingIdx >= 0) {
      if (target) moves[existingIdx] = { ...moves[existingIdx], targetLocation: target };
      else moves.splice(existingIdx, 1);
    } else if (target) {
      moves.push({ entryId, targetLocation: target });
    }
    await dispatch({ type: 'UPDATE_MOVEMENT_ORDER', payload: { id: order.id, updates: { moves } } });
  };

  const updateMoveActual = async (entryId: string, actual: string) => {
    if (!isFinalized) return;
    let moves = [...order.moves];
    const existingIdx = moves.findIndex(m => m.entryId === entryId);
    if (existingIdx >= 0) {
      moves[existingIdx] = { ...moves[existingIdx], actualLocation: actual };
      await dispatch({ type: 'UPDATE_MOVEMENT_ORDER', payload: { id: order.id, updates: { moves } } });
    }
  };

  const itemsInPlay = useMemo(() => {
    return entries.filter(e => order.palletsInPlay.includes(e.currentLocation || ''));
  }, [entries, order.palletsInPlay]);

  return (
    <div className="space-y-6 animate-fade-in" id="offsite-movement-planner">
      {isFinalized && (
        <div className="flex bg-cool-gray-850 p-1.5 rounded-2xl border border-cool-gray-750 gap-1 mb-6 no-print">
          <button
            onClick={() => setFinalizedTab('checklist')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              finalizedTab === 'checklist'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-cool-gray-300 hover:text-white hover:bg-cool-gray-800'
            }`}
          >
            <ClipboardList size={18} />
            <span>📋 Field Execution Checklist</span>
          </button>
          <button
            onClick={() => setFinalizedTab('options')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              finalizedTab === 'options'
                ? 'bg-cool-gray-700 text-white border border-cool-gray-600'
                : 'text-cool-gray-300 hover:text-white hover:bg-cool-gray-800'
            }`}
          >
            <Wrench size={18} />
            <span>⚙️ Execution Options & Setup</span>
          </button>
        </div>
      )}

      {/* FIELD EXECUTION CHECKLIST TAB VIEW */}
      {isFinalized && finalizedTab === 'checklist' && (
        <div className="space-y-6 no-print animate-fade-in">
          {/* Print Stylesheet Dynamic Injector */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body {
                background: white !important;
                color: black !important;
              }
              header, nav, aside, footer, button, .no-print, #offsite-inventory-workspace, #offsite-workspace-body {
                display: none !important;
              }
              .print-only {
                display: block !important;
              }
            }
          `}} />

          {/* Guidelines / Guidance banner */}
          <div className="bg-cool-gray-800 p-5 rounded-2xl border border-cool-gray-700 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="text-amber-400" size={22} />
                <h3 className="text-lg font-bold text-white">Interactive Field Helper</h3>
              </div>
              <button
                onClick={saveAsPdf}
                disabled={isPdfGenerating}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
                title="Save clean paper checklist to take offline into the freezer room"
              >
                <Download size={16} className={isPdfGenerating ? "animate-spin" : ""} />
                <span>{isPdfGenerating ? "Saving PDF..." : "Save PDF"}</span>
              </button>
            </div>
            <p className="text-sm text-cool-gray-300">
              This workflow guide is designed to help you execute your finalized movement order in the field. 
              If you are working in a cold storage unit with **no internet connection**, click **Save PDF** 
              above to save and print a physical paper manifest. Use a pen to check the boxes on-site, and update these checkmarks when you return online!
            </p>

            {/* Quick Actions and Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-cool-gray-750/50">
              {/* Phase 1 Stats & Progress */}
              <div className="bg-cool-gray-900 p-4 rounded-xl border border-cool-gray-750/30 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-amber-400">
                  <span>Phase 1: Pick & Label Boxes</span>
                  <span>{totalPickedBoxes} / {execBoxes.length} Boxes ({execBoxes.length > 0 ? Math.round((totalPickedBoxes / execBoxes.length) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-2.5 bg-cool-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-300" 
                    style={{ width: `${execBoxes.length > 0 ? (totalPickedBoxes / execBoxes.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-[11px] text-cool-gray-400">Find boxes on source pallets and tag their destinations.</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button 
                      onClick={() => markAllPicked(true)}
                      className="text-[10px] font-bold text-cool-gray-300 hover:text-white bg-cool-gray-800 hover:bg-cool-gray-750 px-2 py-1 rounded border border-cool-gray-700 transition-colors cursor-pointer"
                    >
                      All Picked
                    </button>
                    <button 
                      onClick={() => markAllPicked(false)}
                      className="text-[10px] font-bold text-cool-gray-400 hover:text-cool-gray-300 bg-cool-gray-800 hover:bg-cool-gray-750 px-2 py-1 rounded border border-cool-gray-700 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Phase 2 Stats & Progress */}
              <div className="bg-cool-gray-900 p-4 rounded-xl border border-cool-gray-750/30 space-y-2.5">
                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <span>Phase 2: Deliver & Confirm Moves</span>
                  <span>{totalDeliveredBoxes} / {deliverBoxes.length} Parts ({deliverBoxes.length > 0 ? Math.round((totalDeliveredBoxes / deliverBoxes.length) * 100) : 0}%)</span>
                </div>
                <div className="w-full h-2.5 bg-cool-gray-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300" 
                    style={{ width: `${deliverBoxes.length > 0 ? (totalDeliveredBoxes / deliverBoxes.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-[11px] text-cool-gray-400">Move boxes to targets and confirm placement.</span>
                  <div className="flex gap-1.5 shrink-0">
                    <button 
                      onClick={() => markAllDelivered(true)}
                      className="text-[10px] font-bold text-cool-gray-300 hover:text-white bg-cool-gray-800 hover:bg-cool-gray-750 px-2 py-1 rounded border border-cool-gray-700 transition-colors cursor-pointer"
                    >
                      All Delivered
                    </button>
                    <button 
                      onClick={() => markAllDelivered(false)}
                      className="text-[10px] font-bold text-cool-gray-400 hover:text-cool-gray-300 bg-cool-gray-800 hover:bg-cool-gray-750 px-2 py-1 rounded border border-cool-gray-700 transition-colors cursor-pointer"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tabs for Phase selections with Details expand/collapse */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex bg-cool-gray-850 p-1 rounded-xl border border-cool-gray-750 w-full sm:w-auto max-w-md">
              <button
                onClick={() => setChecklistPhase('pick')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  checklistPhase === 'pick'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'text-cool-gray-400 hover:text-cool-gray-200'
                }`}
              >
                Phase 1: Pick Up & Label
              </button>
              <button
                onClick={() => setChecklistPhase('deliver')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  checklistPhase === 'deliver'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'text-cool-gray-400 hover:text-cool-gray-200'
                }`}
              >
                Phase 2: Move & Deliver
              </button>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => expandAllBoxes(true)}
                className="text-xs font-bold text-cool-gray-300 hover:text-white bg-cool-gray-800 hover:bg-cool-gray-750 px-3 py-1.5 rounded-lg border border-cool-gray-700 transition-colors cursor-pointer"
              >
                Expand All Details
              </button>
              <button
                onClick={() => expandAllBoxes(false)}
                className="text-xs font-bold text-cool-gray-400 hover:text-cool-gray-300 bg-cool-gray-800 hover:bg-cool-gray-750 px-3 py-1.5 rounded-lg border border-cool-gray-700 transition-colors cursor-pointer"
              >
                Collapse All Details
              </button>
            </div>
          </div>

          {/* Phase List Display */}
          {checklistPhase === 'pick' ? (
            <div className="space-y-6">
              {pickGroups.map(([palletName, boxes]) => (
                <div key={palletName} className="bg-cool-gray-800 rounded-2xl border border-cool-gray-750 overflow-hidden shadow-xs">
                  <div className="bg-cool-gray-750/40 px-5 py-3 border-b border-cool-gray-750 flex items-center gap-2">
                    <span className="text-sm font-bold text-white">📦 Source Pallet:</span>
                    <span className="text-sm font-black text-amber-400 font-mono">{palletName}</span>
                    <span className="text-xs text-cool-gray-400 font-normal">({boxes.length} unique boxes)</span>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    {(() => {
                      const uncheckedBoxes = boxes.filter(b => {
                        const isPicked = pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id));
                        return !isPicked;
                      });
                      const checkedBoxes = boxes.filter(b => {
                        const isPicked = pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id));
                        return isPicked;
                      });

                      return (
                        <>
                          <div className="space-y-3">
                            {uncheckedBoxes.map((b) => {
                              const isPicked = false;
                              const isPartialPicked = b.items.some(it => pickedItemIds.includes(it.id));
                              const isExpanded = expandedBoxes.includes(b.id);
                              return (
                                <div 
                                  key={b.id}
                                  className={`rounded-xl border transition-all overflow-hidden ${
                                    isPartialPicked
                                      ? 'bg-amber-950/5 border-amber-500/20 text-cool-gray-200'
                                      : 'bg-cool-gray-900 border-cool-gray-800 text-white hover:bg-cool-gray-800/80 hover:border-cool-gray-700'
                                  }`}
                                >
                                  {/* Main Row */}
                                  <div 
                                    onClick={() => toggleBoxPicked(b.id)}
                                    className="flex flex-col md:flex-row md:items-center justify-between py-2 px-3 gap-4 cursor-pointer select-none"
                                  >
                                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                      {/* Checkbox Trigger with propagation stopped */}
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleBoxPicked(b.id);
                                        }}
                                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-750 text-cool-gray-400 transition-all cursor-pointer"
                                        title="Mark as Picked"
                                      >
                                        {isPartialPicked ? (
                                          <MinusSquare size={18} className="text-amber-500 animate-pulse" />
                                        ) : (
                                          <Square size={18} className="text-cool-gray-500 hover:text-cool-gray-300" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-mono text-base font-black tracking-wide text-white">
                                            Box {b.boxLabel}
                                          </span>
                                          {renderFlagBadge(b.id)}
                                          {renderItemTagsHelper(state.tags, b.items)}
                                          {isPartialPicked && (
                                            <span className="text-[9px] font-extrabold uppercase tracking-widest bg-amber-600/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-600/20 animate-pulse">
                                              Part Picked
                                            </span>
                                          )}
                                          {b.isSplit && (
                                            <span className="text-[9px] font-extrabold uppercase tracking-widest bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">
                                              Split Box ({b.destinations.length} Targets)
                                            </span>
                                          )}
                                          <span className="text-xs text-cool-gray-500 font-normal">
                                            ({b.totalWeight.toFixed(2)} lbs • {b.totalPieces} pcs)
                                          </span>
                                          {(() => {
                                            const hasBoxNotes = b.items.some((it: any) => it.boxNotes && it.boxNotes.trim() !== '');
                                            const hasItemNotes = b.items.some((it: any) => it.notes && it.notes.trim() !== '');
                                            if (hasBoxNotes || hasItemNotes) {
                                              return (
                                                <span 
                                                  className="inline-flex items-center gap-1 text-[9px] bg-amber-950/40 text-amber-400 font-bold px-1.5 py-0.5 rounded border border-amber-500/25 animate-fade-in cursor-help"
                                                  title={hasBoxNotes ? (hasItemNotes ? "Box and item notes present" : "Box notes present") : "Item notes present"}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <FileText size={10} className="text-amber-500" />
                                                  Notes
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* PREVALENT TARGET DESTINATION */}
                                    <div className="flex items-center gap-3 shrink-0 self-start md:self-auto pl-14 md:pl-0" onClick={(e) => e.stopPropagation()}>
                                      <div className={`flex ${b.isSplit ? 'items-start' : 'items-center'} gap-2 bg-blue-950/50 border border-blue-800/40 text-blue-100 px-3.5 py-2 rounded-xl font-bold text-sm`}>
                                        <span className="text-blue-400 font-extrabold text-[10px] uppercase tracking-wider shrink-0 mt-0.5">🎯 Deliver To:</span>
                                        <span className="text-white font-mono font-black text-left">
                                          {b.isSplit ? (
                                            <span className="flex flex-col gap-1">
                                              {b.destinations.map((d, idx) => (
                                                <span key={idx} className="text-xs text-blue-300 block">
                                                  {d.locationName}{d.palletName ? ` (${d.palletName})` : ''} <span className="text-[10px] text-cool-gray-400 font-normal">({d.itemCount} pcs)</span>
                                                </span>
                                              ))}
                                            </span>
                                          ) : `${b.targetLocationName}${b.targetPalletName ? ` (${b.targetPalletName})` : ''}`}
                                        </span>
                                      </div>
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleBoxExpanded(b.id);
                                        }}
                                        className="text-cool-gray-500 hover:text-cool-gray-300 transition-colors p-2 hover:bg-cool-gray-800 rounded-lg cursor-pointer"
                                        title={isExpanded ? "Collapse Details" : "Expand Details"}
                                      >
                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Expanded Details Panel */}
                                  {isExpanded && (() => {
                                    const uncheckedItems = b.items.filter((it: any) => !pickedItemIds.includes(it.id));
                                    const checkedItems = b.items.filter((it: any) => pickedItemIds.includes(it.id));
                                    return (
                                      <div className="px-5 py-3.5 bg-cool-gray-950/40 border-t border-cool-gray-800/50 animate-fade-in space-y-2.5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cool-gray-800 pb-2 mb-2" onClick={(e) => e.stopPropagation()}>
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400">
                                            Box Contents Details {b.isSplit && "(Optional Item-by-Item Pick Check-off)"}:
                                          </div>
                                          <div className="flex items-center gap-2 text-xs">
                                            <span className="text-cool-gray-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                                              <FileText size={11} className="text-cool-gray-500" />
                                              Box Note:
                                            </span>
                                            <input
                                              type="text"
                                              placeholder="No box note (click to add)..."
                                              className="bg-cool-gray-950 border border-cool-gray-800 rounded px-2.5 py-1 text-cool-gray-200 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-amber-500/50 placeholder-cool-gray-700 transition-all"
                                              defaultValue={b.items.find((it: any) => it.boxNotes)?.boxNotes || b.items[0]?.boxNotes || ''}
                                              onBlur={async (e) => {
                                                const val = e.target.value.trim();
                                                const itemIds = b.items.map((it: any) => it.id);
                                                await dispatch({
                                                  type: 'BULK_EDIT_OFFSITE_ENTRIES',
                                                  payload: { ids: itemIds, updates: { boxNotes: val } }
                                                });
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  (e.target as HTMLInputElement).blur();
                                                }
                                              }}
                                            />
                                          </div>
                                        </div>

                                        <div className="space-y-3.5">
                                          {uncheckedItems.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                              {uncheckedItems.map((it: any, i: number) => {
                                                const itemTargetDestId = movesMap.get(it.id);
                                                const itemDest = order.targetDestinations?.find((d: any) => d.id === itemTargetDestId);
                                                const itemTargetLabel = itemDest 
                                                  ? `${itemDest.locationName}${itemDest.palletName ? ` (${itemDest.palletName})` : ''}`
                                                  : 'Unknown Destination';

                                                return (
                                                  <div 
                                                    key={it.id || i}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleItemPicked(b.id, it.id);
                                                    }}
                                                    className="p-3 rounded-lg border transition-all flex flex-col justify-between gap-2.5 select-none bg-cool-gray-900 hover:bg-cool-gray-850 border-cool-gray-800 text-white cursor-pointer"
                                                  >
                                                    <div className="flex items-start gap-3 w-full">
                                                      <div className="shrink-0 mt-0.5">
                                                        <Square size={18} className="text-cool-gray-500 hover:text-cool-gray-300" />
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-xs text-cool-gray-200 flex items-center gap-1.5 flex-wrap">
                                                          <span className="truncate">{it.cuts || it.product}</span>
                                                          {renderFlagBadge(it.id)}
                                                        </div>
                                                        <div className="flex justify-between items-center mt-1 text-[11px] text-cool-gray-400">
                                                          <span>Qty: <strong className="text-cool-gray-300">{it.pieces || 1} pcs</strong></span>
                                                          <span>Weight: <strong className="text-cool-gray-300 font-mono">{it.netWeight || 0} lbs</strong></span>
                                                        </div>
                                                        {b.isSplit && (
                                                          <div className="mt-1.5 pt-1.5 border-t border-cool-gray-800/40 text-[10px] text-blue-400 font-semibold flex items-center gap-1">
                                                            <span>🎯 Target:</span>
                                                            <span className="truncate max-w-[150px]" title={itemTargetLabel}>{itemTargetLabel}</span>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {/* Item level Notes */}
                                                    <div className="pt-1.5 border-t border-cool-gray-850 w-full" onClick={(e) => e.stopPropagation()}>
                                                      {editingItemNoteId === it.id ? (
                                                        <div className="flex items-center gap-1.5">
                                                          <input
                                                            type="text"
                                                            className="bg-cool-gray-950 border border-cool-gray-700 rounded px-1.5 py-0.5 text-white text-[11px] w-full focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                            value={itemNoteValue}
                                                            onChange={(e) => setItemNoteValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                              if (e.key === 'Enter') {
                                                                handleSaveItemNote(it.id);
                                                              } else if (e.key === 'Escape') {
                                                                setEditingItemNoteId(null);
                                                              }
                                                            }}
                                                            autoFocus
                                                          />
                                                          <button
                                                            onClick={() => handleSaveItemNote(it.id)}
                                                            className="text-[10px] bg-amber-500 hover:bg-amber-400 text-cool-gray-950 font-extrabold px-1.5 py-0.5 rounded cursor-pointer"
                                                          >
                                                            Save
                                                          </button>
                                                          <button
                                                            onClick={() => setEditingItemNoteId(null)}
                                                            className="text-[10px] text-cool-gray-400 hover:text-white cursor-pointer"
                                                          >
                                                            Cancel
                                                          </button>
                                                        </div>
                                                      ) : (
                                                        <div className="flex items-center justify-between gap-2">
                                                          <div className="text-[10px] text-cool-gray-400 italic truncate max-w-[170px]">
                                                            {it.notes ? (
                                                              <span className="flex items-center gap-1 text-amber-300/80">
                                                                <span>📝</span> {it.notes}
                                                              </span>
                                                            ) : (
                                                              <span className="text-cool-gray-600">No notes</span>
                                                            )}
                                                          </div>
                                                          <button
                                                            onClick={() => {
                                                              setEditingItemNoteId(it.id);
                                                              setItemNoteValue(it.notes || '');
                                                            }}
                                                            className="text-[9px] text-cool-gray-400 hover:text-white underline cursor-pointer"
                                                          >
                                                            {it.notes ? 'Edit' : '+ Add Note'}
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {checkedItems.length > 0 && (
                                            <div className={uncheckedItems.length > 0 ? "mt-4 pt-3 border-t border-cool-gray-800/60" : ""}>
                                              <div className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <span>Picked Items ({checkedItems.length})</span>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {checkedItems.map((it: any, i: number) => {
                                                  return (
                                                    <div 
                                                      key={it.id || i}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleItemPicked(b.id, it.id);
                                                      }}
                                                      className="p-1.5 px-3 rounded bg-amber-950/10 hover:bg-amber-950/20 border border-amber-500/20 text-cool-gray-400 hover:text-white hover:border-amber-500/40 transition-all flex items-center justify-between gap-2 text-xs select-none cursor-pointer"
                                                    >
                                                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                                        <CheckSquare size={14} className="text-amber-500/80 shrink-0" />
                                                        <span className="line-through text-cool-gray-500 text-[11px] truncate">{it.cuts || it.product}</span>
                                                        {renderFlagBadge(it.id)}
                                                        <span className="text-[10px] text-cool-gray-600">({it.pieces || 1} pcs • {it.netWeight || 0} lbs)</span>
                                                        {it.notes && <span className="text-amber-500/60 text-[10px]" title={it.notes}>📝</span>}
                                                      </div>
                                                      <span className="text-[9px] text-amber-500/50 hover:text-amber-400 underline uppercase tracking-wider shrink-0 font-bold">Uncheck</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>

                          {checkedBoxes.length > 0 && (
                            <div className={uncheckedBoxes.length > 0 ? "mt-4 pt-3 border-t border-cool-gray-750" : ""}>
                              <div className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                                <span>Picked Boxes ({checkedBoxes.length})</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {checkedBoxes.map((b) => (
                                  <div 
                                    key={b.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleBoxPicked(b.id);
                                    }}
                                    className="p-2 px-3 rounded-xl bg-amber-950/10 hover:bg-amber-950/20 border border-amber-500/20 text-cool-gray-400 hover:text-white hover:border-amber-500/40 transition-all flex items-center justify-between gap-2 text-xs select-none cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                      <CheckSquare size={14} className="text-amber-500/80 shrink-0" />
                                      <span className="text-cool-gray-300 font-bold truncate">Box {b.boxLabel}</span>
                                      {renderFlagBadge(b.id)}
                                      {renderItemTagsHelper(state.tags, b.items)}
                                      <span className="text-[10px] text-cool-gray-600">({b.totalWeight.toFixed(1)} lbs • {b.totalPieces} pcs)</span>
                                      <span 
                                        className="text-[9px] text-blue-400/75 truncate font-semibold"
                                        title={b.isSplit ? b.destinations.map(d => `${d.locationName}${d.palletName ? ` (${d.palletName})` : ''}`).join(', ') : undefined}
                                      >
                                        → {b.isSplit 
                                          ? `Split: ${b.destinations.map(d => `${d.locationName}${d.palletName ? ` (${d.palletName})` : ''}`).join(', ')}` 
                                          : `${b.targetLocationName}${b.targetPalletName ? ` (${b.targetPalletName})` : ''}`}
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-amber-500/50 hover:text-amber-400 underline uppercase tracking-wider shrink-0 font-bold">Unpick</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {pickGroups.length === 0 && (
                <div className="text-center py-12 text-cool-gray-500 italic">No boxes require picking in this order.</div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {deliverGroups.map(([destId, g]) => (
                <div key={destId} className="bg-cool-gray-800 rounded-2xl border border-cool-gray-750 overflow-hidden shadow-xs">
                  <div className="bg-cool-gray-750/40 px-5 py-3 border-b border-cool-gray-750 flex items-center gap-2">
                    <span className="text-sm font-bold text-white">🏢 Destination Location:</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">{g.label}</span>
                    <span className="text-xs text-cool-gray-400 font-normal">({g.boxes.length} boxes)</span>
                  </div>
                  
                  <div className="p-4 space-y-3">
                    {(() => {
                      const uncheckedBoxes = g.boxes.filter(b => {
                        const isDelivered = deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id));
                        return !isDelivered;
                      });
                      const checkedBoxes = g.boxes.filter(b => {
                        const isDelivered = deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id));
                        return isDelivered;
                      });

                      return (
                        <>
                          <div className="space-y-3">
                            {uncheckedBoxes.map((b) => {
                              const isDelivered = false;
                              const isPartialDelivered = b.items.some(it => deliveredItemIds.includes(it.id));
                              const isExpanded = expandedBoxes.includes(b.id);
                              return (
                                <div 
                                  key={b.id}
                                  className={`rounded-xl border transition-all overflow-hidden ${
                                    isPartialDelivered
                                      ? 'bg-emerald-950/5 border-emerald-500/20 text-cool-gray-200'
                                      : 'bg-cool-gray-900 border-cool-gray-800 text-white hover:bg-cool-gray-800/80 hover:border-cool-gray-700'
                                  }`}
                                >
                                  {/* Main Row */}
                                  <div 
                                    onClick={() => toggleBoxDelivered(b.id)}
                                    className="flex flex-col md:flex-row md:items-center justify-between py-2 px-3 gap-4 cursor-pointer select-none"
                                  >
                                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                      {/* Checkbox Trigger with propagation stopped */}
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleBoxDelivered(b.id);
                                        }}
                                        className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-750 text-cool-gray-400 transition-all cursor-pointer"
                                        title="Mark as Delivered"
                                      >
                                        {isPartialDelivered ? (
                                          <MinusSquare size={18} className="text-emerald-500 animate-pulse" />
                                        ) : (
                                          <Square size={18} className="text-cool-gray-500 hover:text-cool-gray-300" />
                                        )}
                                      </div>
                                      
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-mono text-base font-black tracking-wide text-white">
                                            Box {b.boxLabel}
                                          </span>
                                          {renderFlagBadge(b.id)}
                                          {renderItemTagsHelper(state.tags, b.items)}
                                          {isPartialDelivered && (
                                            <span className="text-[9px] font-extrabold uppercase tracking-widest bg-emerald-600/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-600/20 animate-pulse">
                                              Part Delivered
                                            </span>
                                          )}
                                          {b.isSplitPart && (
                                            <span className="text-[9px] font-extrabold uppercase tracking-widest bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/20">
                                              Split Box Part
                                            </span>
                                          )}
                                          <span className="text-xs text-cool-gray-500 font-normal">
                                            ({b.totalWeight.toFixed(2)} lbs • {b.totalPieces} pcs)
                                          </span>
                                          {(() => {
                                            const hasBoxNotes = b.items.some((it: any) => it.boxNotes && it.boxNotes.trim() !== '');
                                            const hasItemNotes = b.items.some((it: any) => it.notes && it.notes.trim() !== '');
                                            if (hasBoxNotes || hasItemNotes) {
                                              return (
                                                <span 
                                                  className="inline-flex items-center gap-1 text-[9px] bg-amber-950/40 text-amber-400 font-bold px-1.5 py-0.5 rounded border border-amber-500/25 animate-fade-in cursor-help"
                                                  title={hasBoxNotes ? (hasItemNotes ? "Box and item notes present" : "Box notes present") : "Item notes present"}
                                                  onClick={(e) => e.stopPropagation()}
                                                >
                                                  <FileText size={10} className="text-amber-500" />
                                                  Notes
                                                </span>
                                              );
                                            }
                                            return null;
                                          })()}
                                        </div>

                                        {b.isSplitPart && b.destinations && (
                                          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center text-[11px] text-purple-300" onClick={(e) => e.stopPropagation()}>
                                            <span className="font-extrabold uppercase text-[9px] text-purple-400 tracking-wider">All Targets:</span>
                                            {b.destinations.map((d, idx) => (
                                              <span 
                                                key={idx} 
                                                className={`px-1.5 py-0.5 rounded border text-[10px] ${
                                                  d.locationId === b.targetLocationId 
                                                    ? 'bg-purple-500/25 text-white border-purple-500/50 font-bold' 
                                                    : 'bg-cool-gray-950/60 text-purple-300/75 border-cool-gray-800'
                                                }`}
                                              >
                                                {d.locationName}{d.palletName ? ` (${d.palletName})` : ''} ({d.itemCount} pcs)
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* ORIGIN & ACTIONS */}
                                    <div className="flex items-center gap-3 shrink-0 self-start md:self-auto pl-14 md:pl-0" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center gap-2 bg-cool-gray-850 px-3 py-1.5 rounded-lg border border-cool-gray-750 text-xs text-cool-gray-300 font-semibold">
                                        <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">📦 From Source:</span>
                                        <span className="font-mono font-bold text-white">{b.sourcePallet}</span>
                                      </div>
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleBoxExpanded(b.id);
                                        }}
                                        className="text-cool-gray-500 hover:text-cool-gray-300 transition-colors p-2 hover:bg-cool-gray-800 rounded-lg cursor-pointer"
                                        title={isExpanded ? "Collapse Details" : "Expand Details"}
                                      >
                                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* Expanded Details Panel */}
                                  {isExpanded && (() => {
                                    const uncheckedItems = b.items.filter((it: any) => !deliveredItemIds.includes(it.id));
                                    const checkedItems = b.items.filter((it: any) => deliveredItemIds.includes(it.id));
                                    return (
                                      <div className="px-5 py-3.5 bg-cool-gray-950/40 border-t border-cool-gray-800/50 animate-fade-in space-y-2.5">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cool-gray-800 pb-2 mb-2" onClick={(e) => e.stopPropagation()}>
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400">
                                            Box Contents Details {b.isSplitPart && "(Optional Item-by-Item Delivery Check-off)"}:
                                          </div>
                                          <div className="flex items-center gap-2 text-xs">
                                            <span className="text-cool-gray-400 font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                                              <FileText size={11} className="text-cool-gray-500" />
                                              Box Note:
                                            </span>
                                            <input
                                              type="text"
                                              placeholder="No box note (click to add)..."
                                              className="bg-cool-gray-950 border border-cool-gray-800 rounded px-2.5 py-1 text-cool-gray-200 text-xs w-64 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-cool-gray-700 transition-all"
                                              defaultValue={b.items.find((it: any) => it.boxNotes)?.boxNotes || b.items[0]?.boxNotes || ''}
                                              onBlur={async (e) => {
                                                const val = e.target.value.trim();
                                                const itemIds = b.items.map((it: any) => it.id);
                                                await dispatch({
                                                  type: 'BULK_EDIT_OFFSITE_ENTRIES',
                                                  payload: { ids: itemIds, updates: { boxNotes: val } }
                                                });
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  (e.target as HTMLInputElement).blur();
                                                }
                                              }}
                                            />
                                          </div>
                                        </div>

                                        <div className="space-y-3.5">
                                          {uncheckedItems.length > 0 && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                              {uncheckedItems.map((it: any, i: number) => {
                                                const itemTargetDestId = movesMap.get(it.id);
                                                const itemDest = order.targetDestinations?.find((d: any) => d.id === itemTargetDestId);
                                                const itemTargetLabel = itemDest 
                                                  ? `${itemDest.locationName}${itemDest.palletName ? ` (${itemDest.palletName})` : ''}`
                                                  : 'Unknown Destination';

                                                return (
                                                  <div 
                                                    key={it.id || i}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      toggleItemDelivered(b.id, it.id);
                                                    }}
                                                    className="p-3 rounded-lg border transition-all flex flex-col justify-between gap-2.5 select-none bg-cool-gray-900 hover:bg-cool-gray-850 border-cool-gray-800 text-white cursor-pointer"
                                                  >
                                                    <div className="flex items-start gap-3 w-full">
                                                      <div className="shrink-0 mt-0.5">
                                                        <Square size={18} className="text-cool-gray-500 hover:text-cool-gray-300" />
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <div className="font-bold text-xs text-cool-gray-200 flex items-center gap-1.5 flex-wrap">
                                                          <span className="truncate">{it.cuts || it.product}</span>
                                                          {renderFlagBadge(it.id)}
                                                        </div>
                                                        <div className="flex justify-between items-center mt-1 text-[11px] text-cool-gray-400">
                                                          <span>Qty: <strong className="text-cool-gray-300">{it.pieces || 1} pcs</strong></span>
                                                          <span>Weight: <strong className="text-cool-gray-300 font-mono">{it.netWeight || 0} lbs</strong></span>
                                                        </div>
                                                        {b.isSplitPart && (
                                                          <div className="mt-1.5 pt-1.5 border-t border-cool-gray-800/40 text-[10px] text-purple-400 font-semibold flex flex-col gap-1">
                                                            <div className="flex items-center gap-1">
                                                              <span>📦 Origin:</span>
                                                              <span className="truncate max-w-[150px] font-mono text-cool-gray-300">{b.sourcePallet}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                              <span>🎯 Target:</span>
                                                              <span className="truncate max-w-[150px] text-emerald-400 font-bold">{itemTargetLabel}</span>
                                                            </div>
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {/* Item level Notes */}
                                                    <div className="pt-1.5 border-t border-cool-gray-850 w-full" onClick={(e) => e.stopPropagation()}>
                                                      {editingItemNoteId === it.id ? (
                                                        <div className="flex items-center gap-1.5">
                                                          <input
                                                            type="text"
                                                            className="bg-cool-gray-950 border border-cool-gray-700 rounded px-1.5 py-0.5 text-white text-[11px] w-full focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                            value={itemNoteValue}
                                                            onChange={(e) => setItemNoteValue(e.target.value)}
                                                            onKeyDown={(e) => {
                                                              if (e.key === 'Enter') {
                                                                handleSaveItemNote(it.id);
                                                              } else if (e.key === 'Escape') {
                                                                setEditingItemNoteId(null);
                                                              }
                                                            }}
                                                            autoFocus
                                                          />
                                                          <button
                                                            onClick={() => handleSaveItemNote(it.id)}
                                                            className="text-[10px] bg-emerald-500 hover:bg-emerald-400 text-cool-gray-950 font-extrabold px-1.5 py-0.5 rounded cursor-pointer"
                                                          >
                                                            Save
                                                          </button>
                                                          <button
                                                            onClick={() => setEditingItemNoteId(null)}
                                                            className="text-[10px] text-cool-gray-400 hover:text-white cursor-pointer"
                                                          >
                                                            Cancel
                                                          </button>
                                                        </div>
                                                      ) : (
                                                        <div className="flex items-center justify-between gap-2">
                                                          <div className="text-[10px] text-cool-gray-400 italic truncate max-w-[170px]">
                                                            {it.notes ? (
                                                              <span className="flex items-center gap-1 text-amber-300/80">
                                                                <span>📝</span> {it.notes}
                                                              </span>
                                                            ) : (
                                                              <span className="text-cool-gray-600">No notes</span>
                                                            )}
                                                          </div>
                                                          <button
                                                            onClick={() => {
                                                              setEditingItemNoteId(it.id);
                                                              setItemNoteValue(it.notes || '');
                                                            }}
                                                            className="text-[9px] text-cool-gray-400 hover:text-white underline cursor-pointer"
                                                          >
                                                            {it.notes ? 'Edit' : '+ Add Note'}
                                                          </button>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {checkedItems.length > 0 && (
                                            <div className={uncheckedItems.length > 0 ? "mt-4 pt-3 border-t border-cool-gray-800/60" : ""}>
                                              <div className="text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                <span>Delivered Items ({checkedItems.length})</span>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                {checkedItems.map((it: any, i: number) => {
                                                  return (
                                                    <div 
                                                      key={it.id || i}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleItemDelivered(b.id, it.id);
                                                      }}
                                                      className="p-1.5 px-3 rounded bg-emerald-950/10 hover:bg-emerald-950/20 border border-emerald-500/20 text-cool-gray-400 hover:text-white hover:border-emerald-500/40 transition-all flex items-center justify-between gap-2 text-xs select-none cursor-pointer"
                                                    >
                                                      <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                                        <CheckCircle2 size={14} className="text-emerald-400 animate-scale-up" />
                                                        <span className="line-through text-cool-gray-500 text-[11px] truncate">{it.cuts || it.product}</span>
                                                        <span className="text-[10px] text-cool-gray-600">({it.pieces || 1} pcs • {it.netWeight || 0} lbs)</span>
                                                        {it.notes && <span className="text-emerald-500/60 text-[10px]" title={it.notes}>📝</span>}
                                                      </div>
                                                      <span className="text-[9px] text-emerald-500/50 hover:text-emerald-400 underline uppercase tracking-wider shrink-0 font-bold">Uncheck</span>
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>

                          {checkedBoxes.length > 0 && (
                            <div className={uncheckedBoxes.length > 0 ? "mt-4 pt-3 border-t border-cool-gray-750" : ""}>
                              <div className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-2">
                                <span>Delivered Boxes ({checkedBoxes.length})</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {checkedBoxes.map((b) => (
                                  <div 
                                    key={b.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleBoxDelivered(b.id);
                                    }}
                                    className="p-2 px-3 rounded-xl bg-emerald-950/10 hover:bg-emerald-950/20 border border-emerald-500/20 text-cool-gray-400 hover:text-white hover:border-emerald-500/40 transition-all flex items-center justify-between gap-2 text-xs select-none cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                                      <CheckCircle2 size={14} className="text-emerald-400/80 shrink-0" />
                                      <span className="text-cool-gray-300 font-bold truncate">Box {b.boxLabel}</span>
                                      {renderItemTagsHelper(state.tags, b.items)}
                                      <span className="text-[10px] text-cool-gray-600">({b.totalWeight.toFixed(1)} lbs • {b.totalPieces} pcs)</span>
                                      <span className="text-[9px] text-amber-500/60 font-mono">From: {b.sourcePallet}</span>
                                    </div>
                                    <span className="text-[9px] text-emerald-500/50 hover:text-emerald-400 underline uppercase tracking-wider shrink-0 font-bold">Uncheck</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              ))}
              {deliverGroups.length === 0 && (
                <div className="text-center py-12 text-cool-gray-500 italic">No destinations configured.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Hidden container for PDF Generation (Targeted by html2pdf via React Portal under document.body) */}
      {isFinalized && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', left: 0, top: 0, width: '720px', zIndex: -99999, pointerEvents: 'none', opacity: 1, backgroundColor: '#ffffff' }}>
          <div id="field-checklist-pdf" className="text-black bg-white p-5 font-sans space-y-6" style={{ width: '720px', minWidth: '720px' }}>
            <style dangerouslySetInnerHTML={{__html: `
              #field-checklist-pdf tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #field-checklist-pdf thead {
                display: table-header-group !important;
              }
              #field-checklist-pdf h2, #field-checklist-pdf h1 {
                page-break-after: avoid !important;
                break-after: avoid !important;
              }
              .page-break-before {
                page-break-before: always !important;
                break-before: page !important;
              }
            `}} />
            <div className="border-b-2 border-black pb-4">
              <h1 className="text-2xl font-bold uppercase tracking-wider">Field Inventory Movement & Delivery Slip</h1>
              <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-gray-800">
                <div><strong>Movement Order:</strong> {order.name}</div>
                <div><strong>Planned Date:</strong> {order.date}</div>
                {order.description && <div className="col-span-2"><strong>Notes / Instructions:</strong> {order.description}</div>}
              </div>
            </div>
            
            <div className="space-y-6">
              {/* Phase 1 Print: Grouped by Source Pallet */}
              <div>
                <h2 className="text-base font-bold uppercase tracking-wide border-b-2 border-black pb-1 mb-2">Phase 1: Pick Up List (Grouped by Source Pallet)</h2>
                <table className="w-full text-left text-xs border-collapse border border-gray-300" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr className="border-b border-gray-400 bg-gray-100 font-bold">
                      <th className="py-1.5 px-1.5 border border-gray-300 text-center" style={{ width: '10%' }}>Picked</th>
                      <th className="py-1.5 px-2 border border-gray-300" style={{ width: '15%' }}>Source Pallet</th>
                      <th className="py-1.5 px-2 border border-gray-300" style={{ width: '22%' }}>Box Label / Serial</th>
                      <th className="py-1.5 px-2 border border-gray-300 text-center" style={{ width: '13%' }}>Pieces</th>
                      <th className="py-1.5 px-2 border border-gray-300 text-right" style={{ width: '15%' }}>Weight (lbs)</th>
                      <th className="py-1.5 px-2 border border-gray-300" style={{ width: '25%' }}>Target Destination</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execBoxes.map((b, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="py-1.5 px-1.5 border border-gray-300 text-center text-base font-bold font-mono">[  ]</td>
                        <td className="py-1.5 px-2 border border-gray-300 font-bold truncate">{b.sourcePallet}</td>
                        <td className="py-1.5 px-2 border border-gray-300 font-mono font-bold text-xs truncate" title={b.boxLabel}>{b.boxLabel}</td>
                        <td className="py-1.5 px-2 border border-gray-300 text-center font-bold truncate">{b.totalPieces} pcs</td>
                        <td className="py-1.5 px-2 border border-gray-300 text-right font-mono font-bold truncate">{b.totalWeight.toFixed(2)}</td>
                        <td className="py-1.5 px-2 border border-gray-300 font-bold text-blue-800" style={{ wordBreak: 'break-word' }}>
                          {b.isSplit ? (
                            <div className="space-y-0.5" style={{ fontSize: '10px' }}>
                              <span className="font-extrabold text-purple-700 block text-[9px] uppercase tracking-wider">⚠️ SPLIT:</span>
                              <span className="text-gray-700 font-medium block">
                                {getBoxSplitSummary(b.boxLabel, b.sourcePallet, b.destinations)}
                              </span>
                            </div>
                          ) : (
                            <span>{b.targetLocationName}{b.targetPalletName ? ` (Pallet: ${b.targetPalletName})` : ''}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phase 2 Print: Grouped by Destination */}
              <div className="pt-2">
                <h2 className="text-base font-bold uppercase tracking-wide border-b-2 border-black pb-1 mb-2">Phase 2: Delivery & Confirmation List (Grouped by Destination)</h2>
                <table className="w-full text-left text-xs border-collapse border border-gray-300" style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr className="border-b border-gray-400 bg-gray-100 font-bold">
                      <th className="py-1.5 px-1.5 border border-gray-300 text-center" style={{ width: '10%' }}>Delivered</th>
                      <th className="py-1.5 px-2 border border-gray-300" style={{ width: '30%' }}>Target Destination</th>
                      <th className="py-1.5 px-2 border border-gray-300" style={{ width: '22%' }}>Box Label / Serial</th>
                      <th className="py-1.5 px-2 border border-gray-300 text-center" style={{ width: '11%' }}>Pieces</th>
                      <th className="py-1.5 px-2 border border-gray-300 text-right" style={{ width: '12%' }}>Weight (lbs)</th>
                      <th className="py-1.5 px-2 border border-gray-300" style={{ width: '15%' }}>Origin Pallet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliverBoxes.map((b, idx) => (
                      <tr key={idx} className="border-b border-gray-200">
                        <td className="py-1.5 px-1.5 border border-gray-300 text-center text-base font-bold font-mono">[  ]</td>
                        <td className="py-1.5 px-2 border border-gray-300 font-bold text-emerald-800" style={{ wordBreak: 'break-word' }}>
                          {b.targetPalletName ? `Pallet: ${b.targetPalletName} (${b.targetLocationName})` : `Location: ${b.targetLocationName}`}
                        </td>
                        <td className="py-1.5 px-2 border border-gray-300 font-mono font-bold text-xs truncate" title={b.boxLabel}>
                          Box {b.boxLabel}
                          {b.isSplitPart && (
                            <span className="text-[9px] font-extrabold text-purple-700 tracking-wider block" style={{ fontSize: '8px' }}>⚠️ SPLIT PART</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 border border-gray-300 text-center font-bold truncate">{b.totalPieces} pcs</td>
                        <td className="py-1.5 px-2 border border-gray-300 text-right font-mono font-bold truncate">{b.totalWeight.toFixed(2)}</td>
                        <td className="py-1.5 px-2 border border-gray-300 font-mono font-semibold truncate">{b.sourcePallet}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PRINT-ONLY COMPONENT (Hides completely on screen, renders perfectly on Ctrl+P/window.print) */}
      {isFinalized && (
        <div className="hidden print-only text-black bg-white p-6 font-sans">
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              @page {
                size: letter portrait;
                margin: 0.5in;
              }
              body {
                background: white;
                color: black;
              }
              .print-only {
                display: block !important;
                max-width: 100% !important;
                width: 100% !important;
              }
              .break-before-page {
                page-break-before: always !important;
              }
              tr {
                page-break-inside: avoid !important;
              }
              thead {
                display: table-header-group !important;
              }
              h2, h1 {
                page-break-after: avoid !important;
              }
            }
          `}} />
          <div className="border-b-2 border-black pb-4 mb-4">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Field Inventory Movement & Delivery Slip</h1>
            <div className="grid grid-cols-2 gap-4 mt-2 text-sm text-gray-800">
              <div><strong>Movement Order:</strong> {order.name}</div>
              <div><strong>Planned Date:</strong> {order.date}</div>
              {order.description && <div className="col-span-2"><strong>Notes / Instructions:</strong> {order.description}</div>}
            </div>
          </div>
          
          <div className="space-y-6">
            {/* Phase 1 Print: Grouped by Source Pallet */}
            <div>
              <h2 className="text-base font-bold uppercase tracking-wide border-b-2 border-black pb-1 mb-2">Phase 1: Pick Up List (Grouped by Source Pallet)</h2>
              <table className="w-full text-left text-xs border-collapse border border-gray-300">
                <thead>
                  <tr className="border-b border-gray-400 bg-gray-100 font-bold">
                    <th className="py-1.5 px-1.5 border border-gray-300 w-16 text-center">Picked</th>
                    <th className="py-1.5 px-2 border border-gray-300">Source Pallet</th>
                    <th className="py-1.5 px-2 border border-gray-300 w-32">Box Label / Serial</th>
                    <th className="py-1.5 px-2 border border-gray-300 text-center w-20">Pieces</th>
                    <th className="py-1.5 px-2 border border-gray-300 text-right w-24">Weight (lbs)</th>
                    <th className="py-1.5 px-2 border border-gray-300">Target Destination</th>
                  </tr>
                </thead>
                <tbody>
                  {execBoxes.map((b, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1.5 px-1.5 border border-gray-300 text-center text-base font-bold font-mono">[  ]</td>
                      <td className="py-1.5 px-2 border border-gray-300 font-bold">{b.sourcePallet}</td>
                      <td className="py-1.5 px-2 border border-gray-300 font-mono font-bold text-xs">{b.boxLabel}</td>
                      <td className="py-1.5 px-2 border border-gray-300 text-center font-bold">{b.totalPieces} pcs</td>
                      <td className="py-1.5 px-2 border border-gray-300 text-right font-mono font-bold">{b.totalWeight.toFixed(2)}</td>
                      <td className="py-1.5 px-2 border border-gray-300 font-bold text-blue-800" style={{ wordBreak: 'break-word' }}>
                        {b.isSplit ? (
                          <div className="space-y-0.5" style={{ fontSize: '10px' }}>
                            <span className="font-extrabold text-purple-700 block text-[9px] uppercase tracking-wider">⚠️ SPLIT:</span>
                            <span className="text-gray-700 font-medium block">
                              {getBoxSplitSummary(b.boxLabel, b.sourcePallet, b.destinations)}
                            </span>
                          </div>
                        ) : (
                          <span>{b.targetLocationName}{b.targetPalletName ? ` (Pallet: ${b.targetPalletName})` : ''}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phase 2 List (Grouped by Destination) */}
            <div className="pt-4">
              <h2 className="text-base font-bold uppercase tracking-wide border-b-2 border-black pb-1 mb-2">Phase 2: Delivery & Confirmation List (Grouped by Destination)</h2>
              <table className="w-full text-left text-xs border-collapse border border-gray-300">
                <thead>
                  <tr className="border-b border-gray-400 bg-gray-100 font-bold">
                    <th className="py-1.5 px-1.5 border border-gray-300 w-20 text-center">Delivered</th>
                    <th className="py-1.5 px-2 border border-gray-300">Target Destination</th>
                    <th className="py-1.5 px-2 border border-gray-300 w-32">Box Label / Serial</th>
                    <th className="py-1.5 px-2 border border-gray-300 text-center w-20">Pieces</th>
                    <th className="py-1.5 px-2 border border-gray-300 text-right w-24">Weight (lbs)</th>
                    <th className="py-1.5 px-2 border border-gray-300">Origin Pallet</th>
                  </tr>
                </thead>
                <tbody>
                  {deliverBoxes.map((b, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1.5 px-1.5 border border-gray-300 text-center text-base font-bold font-mono">[  ]</td>
                      <td className="py-1.5 px-2 border border-gray-300 font-bold text-emerald-800" style={{ wordBreak: 'break-word' }}>
                        {b.targetPalletName ? `Pallet: ${b.targetPalletName} (${b.targetLocationName})` : `Location: ${b.targetLocationName}`}
                      </td>
                      <td className="py-1.5 px-2 border border-gray-300 font-mono font-bold text-xs">
                        Box {b.boxLabel}
                        {b.isSplitPart && (
                          <span className="text-[9px] font-extrabold text-purple-700 tracking-wider block" style={{ fontSize: '8px' }}>⚠️ SPLIT PART</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2 border border-gray-300 text-center font-bold">{b.totalPieces} pcs</td>
                      <td className="py-1.5 px-2 border border-gray-300 text-right font-mono font-bold">{b.totalWeight.toFixed(2)}</td>
                      <td className="py-1.5 px-2 border border-gray-300 font-mono font-bold">{b.sourcePallet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {isFinalized && finalizedTab === 'options' && (
        <div className="bg-cool-gray-800 p-6 rounded-2xl border border-cool-gray-700 shadow-sm space-y-6 no-print">
          <div className="flex items-center gap-2 border-b border-cool-gray-700 pb-3">
            <ClipboardList className="text-amber-400" size={20} />
            <h3 className="text-lg font-bold text-white">Movement Execution Options</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Staging transition choice */}
            <div className="space-y-3 bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-750/50">
              <div className="flex items-start gap-3">
                <input
                  id="staging-checkbox"
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
                  className="mt-1 h-5 w-5 rounded-md border-cool-gray-600 bg-cool-gray-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-cool-gray-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                />
                <div>
                  <label htmlFor="staging-checkbox" className={`text-base font-bold select-none cursor-pointer ${hasMovedHome ? 'text-white' : 'text-cool-gray-500'}`}>
                    Move coming-home items to Staging Area
                  </label>
                  <p className="text-sm text-cool-gray-400 mt-1">
                    If checked, cuts designated for Home locations will transition into counts inside simple on-site staging containers. Detailed weights and serial numbers will be removed from off-site.
                  </p>
                </div>
              </div>

              {hasMovedHome ? (
                <div className="mt-4 bg-cool-gray-900/60 p-3 rounded-lg border border-cool-gray-800 space-y-2">
                  <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Home size={12} /> Staging Candidates ({movedHomeEntries.length} items):
                  </div>
                  <div className="max-h-24 overflow-y-auto text-xs text-cool-gray-300 space-y-1 divide-y divide-cool-gray-800/40 pr-2">
                    {movedHomeEntries.map((e, idx) => (
                      <div key={e.id || idx} className="pt-1 first:pt-0 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0 truncate">
                          <span>{e.serial ? `${e.serial} | ` : ''}{(state.products?.find((p: any) => p.id === e.productId)?.name || e.cuts || e.originalCutName)}</span>
                          {(e.isWrongLabel || e.wrongLabel || e.wrongLabelOriginal) && (
                            <span className="text-[9px] text-red-300 font-bold px-1.5 py-0.2 bg-red-950/80 border border-red-700/60 rounded shrink-0">
                              ⚠️ Labeled: {e.wrongLabelOriginal || e.originalCutName}
                            </span>
                          )}
                        </span>
                        <span className="font-bold text-cool-gray-400 shrink-0">{e.pieces || 1} pcs</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-cool-gray-500 italic mt-1 flex items-center gap-1.5">
                  <Info size={12} /> No items in this order are destined for Home locations.
                </div>
              )}
            </div>

            {/* Remove from inventory choice */}
            <div className="space-y-3 bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-750/50">
              <div className="text-base font-bold text-white flex items-center gap-1.5">
                <Truck size={18} className="text-blue-400" />
                Remove from Inventory After Delivery
              </div>
              <p className="text-sm text-cool-gray-400">
                Check any locations below where delivered items should be permanently removed from offsite inventory upon confirming execution (e.g., delivered to customers).
              </p>

              <div className="space-y-2 mt-3 max-h-40 overflow-y-auto pr-2">
                {(order.targetDestinations || []).map((dest) => {
                  const loc = allLocations.find((l) => l.id === dest.locationId);
                  const isHome = loc && loc.isHome;
                  const isDelivery = loc && loc.type === 'delivery_pickup';
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
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        isHandledByStaging 
                          ? 'bg-cool-gray-900/45 border-cool-gray-800/40 opacity-50 cursor-not-allowed' 
                          : 'bg-cool-gray-900 border-cool-gray-800 hover:bg-cool-gray-800 hover:border-cool-gray-700 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isHandledByStaging ? (
                          <Square size={18} className="text-cool-gray-600" />
                        ) : isChecked ? (
                          <CheckSquare size={18} className="text-emerald-500" />
                        ) : (
                          <Square size={18} className="text-cool-gray-500" />
                        )}
                        <span className={`text-sm font-semibold ${isHandledByStaging ? 'text-cool-gray-500 line-through decoration-cool-gray-600/50' : 'text-white'}`}>
                          {dest.locationName}
                          {dest.palletName && <span className="text-xs text-cool-gray-400 ml-1">({dest.palletName})</span>}
                        </span>
                      </div>
                      {isHandledByStaging ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                          <Home size={10} /> Handled by Staging
                        </span>
                      ) : isDelivery ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
                          Delivery
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {(order.targetDestinations || []).length === 0 && (
                  <div className="text-xs text-cool-gray-500 italic">No destinations configured.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isReportModalOpen && (
        <MovementReportModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          order={order}
          state={state}
          dispatch={dispatch}
        />
      )}
    </div>
  );
};
