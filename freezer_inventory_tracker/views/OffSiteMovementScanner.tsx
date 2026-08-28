import React, { useState, useMemo, useEffect, useRef } from 'react';
import { compareBoxLabels } from '../utils/boxSort';
import { 
  Truck, 
  Download, 
  ClipboardList, 
  Square, 
  MinusSquare, 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Flag, 
  Wrench, 
  Camera, 
  Volume2, 
  VolumeX, 
  Search, 
  Scan, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2,
  Barcode
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { MovementOrder, MovementItem } from '../types';
import { MovementReportModal } from './MovementReportModal';

// Audio Feedback System using Web Audio API
const playBeep = (type: 'success' | 'error') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime); // low buzz
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    }
  } catch (err) {
    console.warn('Audio feedback failed:', err);
  }
};

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
            className="inline-flex items-center gap-0.5 text-[8px] border px-1 py-0.2 rounded font-black tracking-wide uppercase select-none"
            title={`Tag on item: ${tag.description || tag.name}`}
          >
            {tag.id === 'use-first' ? '🍳 ' : tag.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{tag.name}
          </span>
        );
      })}
    </div>
  );
};

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
  destinations: Array<{
    locationId: string;
    locationName: string;
    palletName?: string;
    itemCount: number;
    weight: number;
  }>;
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
  destinations?: Array<{
    locationId: string;
    locationName: string;
    palletName?: string;
    itemCount: number;
    weight: number;
  }>;
}

export const OffSiteMovementScanner = ({ 
  state, 
  dispatch,
  isSingleUserMode,
  claimSingleUserMode,
  releaseSingleUserMode
}: { 
  state: any; 
  dispatch: any;
  isSingleUserMode?: boolean;
  claimSingleUserMode?: () => Promise<{ success: boolean; message?: string }>;
  releaseSingleUserMode?: (fullStateToSync?: any) => Promise<boolean>;
}) => {
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
  const activeOrder = orders.find((o: any) => o.status === 'finalized');

  // Sound and scan states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [lastScannedBox, setLastScannedBox] = useState<{
    success: boolean;
    boxNumber?: string;
    details?: string;
    destination?: string;
    weight?: number;
    errorMsg?: string;
    timestamp: Date;
    alreadyScanned?: boolean;
    notes?: string;
    boxNotes?: string;
    expectedWeight?: number;
  } | null>(null);

  // Scanner UI modes
  const [scannerMode, setScannerMode] = useState<'bluetooth' | 'camera'>('bluetooth');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);

  // Focus ref for Bluetooth input capture
  const bluetoothInputRef = useRef<HTMLInputElement>(null);
  const globalScanBufferRef = useRef<string>('');
  const scanClearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isAutoFocusEnabled, setIsAutoFocusEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('movement_scanner_auto_focus');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const claimRef = useRef(claimSingleUserMode);
  claimRef.current = claimSingleUserMode;

  const releaseRef = useRef(releaseSingleUserMode);
  releaseRef.current = releaseSingleUserMode;

  // Automatically claim Single-User Mode when Movement Scanner tab is opened for zero-latency local operations,
  // and automatically release Single-User Mode (syncing changes) when navigating away from the scanner tab.
  useEffect(() => {
    if (claimRef.current) {
      claimRef.current().then(res => {
        if (res?.success) {
          console.log('Auto-activated Single-User Mode upon opening Movement Scanner tab.');
        }
      });
    }

    return () => {
      if (releaseRef.current) {
        releaseRef.current();
      }
    };
  }, []); // Empty dependency array ensures claim runs once on mount and release runs ONLY on tab unmount!

  // Checklist internal tabs & states
  const [checklistPhase, setChecklistPhase] = useState<'pick' | 'deliver'>('pick');
  const [expandedBoxes, setExpandedBoxes] = useState<string[]>([]);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [collapsedCompletedGroups, setCollapsedCompletedGroups] = useState<string[]>([]);

  // Modal confirm helper
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

  const allLocations = state.locations || [];
  const movesMap = useMemo(() => {
    const map = new Map<string, string>();
    if (activeOrder && activeOrder.moves) {
      activeOrder.moves.forEach((m: any) => {
        map.set(m.entryId, m.targetLocation || m.actualLocation || '');
      });
    }
    return map;
  }, [activeOrder]);

  const execBoxes = useMemo<ExecBox[]>(() => {
    if (!activeOrder) return [];
    const boxGroups = new Map<string, ExecBox>();
    
    entries.forEach((e: any) => {
      if (!movesMap.has(e.id)) return;
      const sourcePallet = e.currentLocation || 'Unknown Pallet';
      const boxLabel = e.box || e.serial || 'N/A';
      const key = `${sourcePallet}::${boxLabel}`;
      
      const targetDestId = movesMap.get(e.id);
      const dest = activeOrder.targetDestinations?.find((d: any) => d.id === targetDestId);
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

    boxGroups.forEach(group => {
      group.isSplit = group.destinations.length > 1;
    });
    
    return Array.from(boxGroups.values()).sort((a, b) => {
      const palletCompare = a.sourcePallet.localeCompare(b.sourcePallet, undefined, { numeric: true, sensitivity: 'base' });
      if (palletCompare !== 0) return palletCompare;
      return compareBoxLabels(a.boxLabel, b.boxLabel);
    });
  }, [entries, movesMap, activeOrder]);

  const deliverBoxes = useMemo<DeliverBox[]>(() => {
    if (!activeOrder) return [];
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
      
      const dest = activeOrder.targetDestinations?.find((d: any) => d.id === targetDestId);
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
      const dest = activeOrder.targetDestinations?.find((d: any) => d.id === targetDestId);
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
  }, [entries, movesMap, activeOrder]);

  const pickedBoxIds = activeOrder?.pickedBoxIds || [];
  const deliveredBoxIds = activeOrder?.deliveredBoxIds || [];
  const pickedItemIds = activeOrder?.pickedItemIds || [];
  const deliveredItemIds = activeOrder?.deliveredItemIds || [];

  const totalPickedBoxes = useMemo(() => {
    return execBoxes.filter(b => pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id))).length;
  }, [execBoxes, pickedBoxIds, pickedItemIds]);

  const totalDeliveredBoxes = useMemo(() => {
    return deliverBoxes.filter(b => deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id))).length;
  }, [deliverBoxes, deliveredBoxIds, deliveredItemIds]);

  const renderFlagBadge = (id: string) => renderFlagBadgeHelper(activeOrder?.flags, id);

  // Optional forced focus for desktop setups if auto-focus toggle is explicitly enabled
  useEffect(() => {
    if (isAutoFocusEnabled && scannerMode === 'bluetooth' && activeOrder) {
      bluetoothInputRef.current?.focus();
    }
  }, [scannerMode, lastScannedBox, checklistPhase, activeOrder, isAutoFocusEnabled]);

  // Global keydown listener for physical Bluetooth/USB barcode scanners anywhere on the screen
  useEffect(() => {
    if (scannerMode !== 'bluetooth' || !activeOrder) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputOrTextArea = (
        (activeEl && (
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          (activeEl as HTMLElement).isContentEditable
        )) ||
        (activeEl && activeEl.tagName === 'INPUT' && (activeEl as HTMLInputElement).type !== 'checkbox' && (activeEl as HTMLInputElement).type !== 'radio')
      );

      // If user is actively typing in a different form field (e.g. search bar or notes), ignore global barcode capture
      if (isInputOrTextArea && activeEl !== bluetoothInputRef.current) {
        return;
      }

      // Handle Enter key (Barcode scanner suffix)
      if (e.key === 'Enter') {
        const bufferedCode = globalScanBufferRef.current.trim();
        const currentInputValue = scanInput.trim();
        const codeToProcess = bufferedCode || currentInputValue;

        if (codeToProcess) {
          e.preventDefault();
          e.stopPropagation();
          processBarcodeString(codeToProcess);
          globalScanBufferRef.current = '';
          setScanInput('');
          if (scanClearTimeoutRef.current) clearTimeout(scanClearTimeoutRef.current);
        }
        return;
      }

      // Handle Escape key to clear buffer
      if (e.key === 'Escape') {
        globalScanBufferRef.current = '';
        setScanInput('');
        if (scanClearTimeoutRef.current) clearTimeout(scanClearTimeoutRef.current);
        return;
      }

      // Accumulate single printable characters (digits, letters, symbols)
      if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        globalScanBufferRef.current += e.key;
        setScanInput(globalScanBufferRef.current);

        // Reset buffer automatically if no new character arrives within 2.5 seconds
        if (scanClearTimeoutRef.current) clearTimeout(scanClearTimeoutRef.current);
        scanClearTimeoutRef.current = setTimeout(() => {
          globalScanBufferRef.current = '';
        }, 2500);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      if (scanClearTimeoutRef.current) clearTimeout(scanClearTimeoutRef.current);
    };
  }, [scannerMode, activeOrder, scanInput]);

  // Barcode Scanning Parser and Action Processor
  const processBarcodeString = async (barcode: string) => {
    let trimmed = barcode.trim();
    if (!trimmed) return;

    if (!isSingleUserMode && claimSingleUserMode) {
      claimSingleUserMode();
    }

    const originalInput = trimmed;

    // Clean AIM Symbology Identifier prefix if present (e.g., ]C1, ]C0, etc.)
    trimmed = trimmed.replace(/^\]C\d/, '');

    // Clean common GS1-128 enclosing delimiters (parentheses, square brackets)
    trimmed = trimmed.replace(/[()\[\]]/g, '');

    // Remove any remaining non-digits
    trimmed = trimmed.replace(/\D/g, '');

    // 36-digit standard GS1 pattern validation
    if (trimmed.length !== 36 || !/^\d+$/.test(trimmed)) {
      if (soundEnabled) playBeep('error');
      setLastScannedBox({
        success: false,
        errorMsg: `Invalid barcode structure (${originalInput.length} digits scanned, cleaned to ${trimmed.length} digits). Expected a 36-digit numeric GS1 GS1-128 barcode format.`,
        timestamp: new Date()
      });
      return;
    }

    // GS1-128 Parsing Strategy
    // 01 (digits 1-2): GTIN Application Identifier
    const ai1 = trimmed.substring(0, 2);
    // Digits 3-16 (14 digits): The GTIN
    const gtin = trimmed.substring(2, 16);
    // 3202 (digits 17-20): Net Weight AI with 2 decimals
    const ai2 = trimmed.substring(16, 20);
    // Digits 21-26 (6 digits): Net Weight (lbs / 100)
    const weightStr = trimmed.substring(20, 26);
    const parsedWeight = parseInt(weightStr, 10) / 100;
    // 21 (digits 27-28): Serial Number AI
    const ai3 = trimmed.substring(26, 28);
    // Digits 29-36 (8 digits): Unique box number (padded)
    const serialStr = trimmed.substring(28, 36);
    const parsedBoxNum = parseInt(serialStr, 10);

    // Verify GS1 structure validity
    if (ai1 !== '01' || ai2 !== '3202' || ai3 !== '21') {
      if (soundEnabled) playBeep('error');
      setLastScannedBox({
        success: false,
        errorMsg: `GS1 AI Mismatch. Expected AI prefixes '01', '3202' and '21'. Received: ${ai1}, ${ai2}, ${ai3}`,
        timestamp: new Date()
      });
      return;
    }

    const barcodeBoxNumStr = parsedBoxNum.toString();

    // Smart box label matching helper that supports 'order number-box number' format with/without leading zeros
    const matchBarcodeWithBoxLabel = (boxLabel: string): boolean => {
      if (!boxLabel) return false;
      const cleanLabel = boxLabel.trim();
      if (!cleanLabel) return false;

      // Split label by whitespace, hyphens, underscores, or slashes to isolate order vs box parts
      const labelParts = cleanLabel.split(/[\s\-_/]+/).map(p => p.trim()).filter(Boolean);
      if (labelParts.length === 0) return false;

      if (labelParts.length >= 2) {
        // Last part is assumed to be the box number (e.g. "19", "019" from "900401-19")
        const boxPart = labelParts[labelParts.length - 1];
        // Preceding parts are order/system numbers (e.g. "900401" or "00900401")
        const orderPart = labelParts.slice(0, labelParts.length - 1).join('');

        const cleanBoxPart = boxPart.replace(/^0+/, '');
        const cleanOrderPart = orderPart.replace(/^0+/, '');

        // Box part must match our barcode's parsed box number
        const boxMatches = cleanBoxPart === barcodeBoxNumStr;

        // Order part must be found within our GTIN or the overall barcode sequence
        const orderMatches = cleanOrderPart !== '' && (gtin.includes(cleanOrderPart) || trimmed.includes(cleanOrderPart));

        if (boxMatches && orderMatches) {
          return true;
        }
        return false;
      }

      // If it's a single part (e.g. just "19" or "00000019"), compare it directly to barcode box number
      const lastPart = labelParts[labelParts.length - 1];
      const cleanLastPart = lastPart.replace(/^0+/, '');
      if (cleanLastPart === barcodeBoxNumStr) {
        return true;
      }

      const cleanDirectLabel = cleanLabel.replace(/^0+/, '');
      if (cleanDirectLabel === barcodeBoxNumStr) {
        return true;
      }

      return false;
    };

    if (checklistPhase === 'pick') {
      // Find matching box in pick queue
      const matchedBox = execBoxes.find(b => matchBarcodeWithBoxLabel(b.boxLabel));

      if (!matchedBox) {
        if (soundEnabled) playBeep('error');
        setLastScannedBox({
          success: false,
          errorMsg: `Box matching barcode (Box #${barcodeBoxNumStr}, GTIN Order portion) (${parsedWeight.toFixed(2)} lbs) is not assigned to Phase 1 (Picking) in the active finalized order.`,
          timestamp: new Date()
        });
        return;
      }

      // Mark Box as Picked if not already
      const isAlreadyPicked = pickedBoxIds.includes(matchedBox.id) || matchedBox.items.every(it => pickedItemIds.includes(it.id));
      if (!isAlreadyPicked) {
        await dispatch({
          type: 'APPEND_MOVEMENT_ORDER_IDS',
          payload: {
            id: activeOrder.id,
            pickedBoxIds: [matchedBox.id],
            pickedItemIds: matchedBox.items.map(it => it.id)
          }
        });
      }

      if (soundEnabled) playBeep('success');
      const pickItemNotes = matchedBox.items
        .map((it: any) => it.notes || it.Notes)
        .filter((n: any) => n && n.trim() !== '')
        .join('; ');
      const pickBoxNotes = matchedBox.items
        .map((it: any) => it.boxNotes)
        .filter((n: any) => n && n.trim() !== '')
        .join('; ');

      setLastScannedBox({
        success: true,
        boxNumber: matchedBox.boxLabel,
        details: `${matchedBox.items[0]?.cuts || 'Meat Cuts'} (${matchedBox.totalPieces} pcs)`,
        destination: matchedBox.isSplit 
          ? `Split Box: ${matchedBox.destinations.map(d => `${d.locationName}${d.palletName ? ` (${d.palletName})` : ''}`).join(', ')}`
          : `${matchedBox.targetLocationName}${matchedBox.targetPalletName ? ` (${matchedBox.targetPalletName})` : ''}`,
        weight: parsedWeight,
        timestamp: new Date(),
        alreadyScanned: isAlreadyPicked,
        notes: pickItemNotes,
        boxNotes: pickBoxNotes,
        expectedWeight: matchedBox.totalWeight
      });

    } else {
      // Find matching box in deliver queue
      // deliverBoxes might be split parts, find any matching boxLabel that is not yet fully delivered
      const matchedBoxes = deliverBoxes.filter(b => matchBarcodeWithBoxLabel(b.boxLabel));

      if (matchedBoxes.length === 0) {
        if (soundEnabled) playBeep('error');
        setLastScannedBox({
          success: false,
          errorMsg: `Box matching barcode (Box #${barcodeBoxNumStr}, GTIN Order portion) (${parsedWeight.toFixed(2)} lbs) is not assigned to Phase 2 (Move & Deliver) in this order.`,
          timestamp: new Date()
        });
        return;
      }

      // Deliver first undelivered part of this box
      const targetBox = matchedBoxes.find(b => {
        const isDelivered = deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id));
        return !isDelivered;
      }) || matchedBoxes[0]; // fallback to first if all delivered

      const isAlreadyDelivered = deliveredBoxIds.includes(targetBox.id) || targetBox.items.every(it => deliveredItemIds.includes(it.id));
      if (!isAlreadyDelivered) {
        await dispatch({
          type: 'APPEND_MOVEMENT_ORDER_IDS',
          payload: {
            id: activeOrder.id,
            deliveredBoxIds: [targetBox.id],
            deliveredItemIds: targetBox.items.map(it => it.id)
          }
        });
      }

      if (soundEnabled) playBeep('success');
      const deliverItemNotes = targetBox.items
        .map((it: any) => it.notes || it.Notes)
        .filter((n: any) => n && n.trim() !== '')
        .join('; ');
      const deliverBoxNotes = targetBox.items
        .map((it: any) => it.boxNotes)
        .filter((n: any) => n && n.trim() !== '')
        .join('; ');

      setLastScannedBox({
        success: true,
        boxNumber: targetBox.boxLabel,
        details: `${targetBox.items[0]?.cuts || 'Meat Cuts'} (${targetBox.totalPieces} pcs) • From: ${targetBox.sourcePallet}`,
        destination: `${targetBox.targetLocationName}${targetBox.targetPalletName ? ` (${targetBox.targetPalletName})` : ''}`,
        weight: parsedWeight,
        timestamp: new Date(),
        alreadyScanned: isAlreadyDelivered,
        notes: deliverItemNotes,
        boxNotes: deliverBoxNotes,
        expectedWeight: targetBox.totalWeight
      });
    }
  };

  // Keyboard Submission for Bluetooth Scanner
  const handleBluetoothSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanInput.trim() || globalScanBufferRef.current.trim();
    if (!code) return;
    processBarcodeString(code);
    setScanInput('');
    globalScanBufferRef.current = '';
  };

  // HTML5-QRCode Video Camera Scanning Setup
  const startCameraScanner = async () => {
    // Prevent starting if already active or already loading
    if (cameraLoading || isCameraActive) {
      console.warn('Camera scanner is already loading or active.');
      return;
    }

    setCameraLoading(true);

    // Stop any existing scanner cleanly before creating a new one
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (err) {
        console.warn('Error stopping previous scanner instance:', err);
      } finally {
        html5QrcodeRef.current = null;
      }
    }
    setIsCameraActive(false);

    try {
      // Small delay to ensure React has fully rendered and mounted the viewfinder element
      await new Promise(resolve => setTimeout(resolve, 300));

      const viewfinder = document.getElementById('camera-scanner-viewfinder');
      if (!viewfinder) {
        throw new Error('Viewfinder element #camera-scanner-viewfinder not found in DOM.');
      }

      // Clear the viewfinder element to ensure no duplicated nodes are left over
      viewfinder.innerHTML = '';

      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        alert('No video camera devices found on this hardware.');
        setCameraLoading(false);
        return;
      }

      // Prefer back camera if available
      const backCamera = cameras.find(c => 
        c.label.toLowerCase().includes('back') || 
        c.label.toLowerCase().includes('environment')
      );
      const selectedCameraId = backCamera ? backCamera.id : cameras[0].id;

      const html5Qrcode = new Html5Qrcode('camera-scanner-viewfinder', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.QR_CODE
        ],
        useBarCodeDetectorIfSupported: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        verbose: false
      });
      html5QrcodeRef.current = html5Qrcode;

      // Use an optimized scanner configuration for maximum 1D barcode readability and scanning speed
      const config = {
        fps: 15, // Optimal frame rate to balance real-time decoding speed and CPU usage on mobile devices
        aspectRatio: 1.7777777778, // Standard widescreen aspect ratio to capture wide 1D barcodes
        videoConstraints: {
          deviceId: { exact: selectedCameraId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          advanced: [{ focusMode: "continuous" }] as any
        }
      };

      await html5Qrcode.start(
        selectedCameraId,
        config,
        (decodedText) => {
          processBarcodeString(decodedText);
        },
        (errorMessage) => {
          // Silently ignore frame-level failure logs
        }
      );

      setIsCameraActive(true);
    } catch (cameraErr: any) {
      console.error('Error starting video stream:', cameraErr);
      // Clean up ref if start failed
      html5QrcodeRef.current = null;
      setIsCameraActive(false);
      alert(`Camera Access Failed: ${cameraErr.message || cameraErr}`);
    } finally {
      setCameraLoading(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrcodeRef.current) {
      try {
        await html5QrcodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping QR scanner:', err);
      } finally {
        html5QrcodeRef.current = null;
      }
    }
    setIsCameraActive(false);

    // Clear the container element to ensure clean cleanup
    const viewfinder = document.getElementById('camera-scanner-viewfinder');
    if (viewfinder) {
      viewfinder.innerHTML = '';
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current) {
        html5QrcodeRef.current.stop().catch(err => console.error('Cleanup stop failed', err));
      }
    };
  }, []);

  // Sync phase selection with auto-tabbing helper
  const handlePhaseChange = (phase: 'pick' | 'deliver') => {
    setChecklistPhase(phase);
    setLastScannedBox(null);
  };

  // Action dispatches duplicated for backward compatibility
  const toggleBoxPicked = async (boxId: string) => {
    const box = execBoxes.find(b => b.id === boxId);
    if (!box) return;

    const isBoxFullyPicked = pickedBoxIds.includes(boxId) || box.items.every(it => pickedItemIds.includes(it.id));
    
    if (isBoxFullyPicked) {
      await dispatch({
        type: 'REMOVE_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          pickedBoxIds: [boxId],
          pickedItemIds: box.items.map(it => it.id)
        }
      });
    } else {
      await dispatch({
        type: 'APPEND_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          pickedBoxIds: [boxId],
          pickedItemIds: box.items.map(it => it.id)
        }
      });
    }
  };

  const toggleItemPicked = async (boxId: string, itemId: string) => {
    const box = execBoxes.find(b => b.id === boxId);
    if (!box) return;

    const isItemPicked = pickedItemIds.includes(itemId);

    if (isItemPicked) {
      await dispatch({
        type: 'REMOVE_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          pickedBoxIds: [boxId],
          pickedItemIds: [itemId]
        }
      });
    } else {
      const otherItemsAllPicked = box.items.every(it => it.id === itemId || pickedItemIds.includes(it.id));
      await dispatch({
        type: 'APPEND_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          pickedBoxIds: otherItemsAllPicked ? [boxId] : [],
          pickedItemIds: [itemId]
        }
      });
    }
  };

  const toggleBoxDelivered = async (boxId: string) => {
    const box = deliverBoxes.find(b => b.id === boxId);
    if (!box) return;

    const isBoxFullyDelivered = deliveredBoxIds.includes(boxId) || box.items.every(it => deliveredItemIds.includes(it.id));
    
    if (isBoxFullyDelivered) {
      await dispatch({
        type: 'REMOVE_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          deliveredBoxIds: [boxId],
          deliveredItemIds: box.items.map(it => it.id)
        }
      });
    } else {
      await dispatch({
        type: 'APPEND_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          deliveredBoxIds: [boxId],
          deliveredItemIds: box.items.map(it => it.id)
        }
      });
    }
  };

  const toggleItemDelivered = async (boxId: string, itemId: string) => {
    const box = deliverBoxes.find(b => b.id === boxId);
    if (!box) return;

    const isItemDelivered = deliveredItemIds.includes(itemId);

    if (isItemDelivered) {
      await dispatch({
        type: 'REMOVE_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          deliveredBoxIds: [boxId],
          deliveredItemIds: [itemId]
        }
      });
    } else {
      const otherItemsAllDelivered = box.items.every(it => it.id === itemId || deliveredItemIds.includes(it.id));
      await dispatch({
        type: 'APPEND_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          deliveredBoxIds: otherItemsAllDelivered ? [boxId] : [],
          deliveredItemIds: [itemId]
        }
      });
    }
  };

  const markAllPicked = async (val: boolean) => {
    if (val) {
      const updatedBoxIds = execBoxes.map(b => b.id);
      const updatedItemIds = execBoxes.flatMap(b => b.items.map(it => it.id));
      await dispatch({
        type: 'APPEND_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          pickedBoxIds: updatedBoxIds,
          pickedItemIds: updatedItemIds
        }
      });
    } else {
      await dispatch({
        type: 'UPDATE_MOVEMENT_ORDER',
        payload: {
          id: activeOrder.id,
          updates: {
            pickedBoxIds: [],
            pickedItemIds: []
          }
        }
      });
    }
  };

  const markAllDelivered = async (val: boolean) => {
    if (val) {
      const updatedBoxIds = deliverBoxes.map(b => b.id);
      const updatedItemIds = deliverBoxes.flatMap(b => b.items.map(it => it.id));
      await dispatch({
        type: 'APPEND_MOVEMENT_ORDER_IDS',
        payload: {
          id: activeOrder.id,
          deliveredBoxIds: updatedBoxIds,
          deliveredItemIds: updatedItemIds
        }
      });
    } else {
      await dispatch({
        type: 'UPDATE_MOVEMENT_ORDER',
        payload: {
          id: activeOrder.id,
          updates: {
            deliveredBoxIds: [],
            deliveredItemIds: []
          }
        }
      });
    }
  };

  const toggleBoxExpanded = (boxId: string) => {
    setExpandedBoxes(prev =>
      prev.includes(boxId) ? prev.filter(id => id !== boxId) : [...prev, boxId]
    );
  };

  const expandAllBoxes = (expand: boolean) => {
    if (expand) {
      const boxesToExpand = checklistPhase === 'pick' ? execBoxes.map(b => b.id) : deliverBoxes.map(b => b.id);
      setExpandedBoxes(boxesToExpand);
    } else {
      setExpandedBoxes([]);
    }
  };

  // Execution Options setup duplicated from planner
  const [moveToStaging, setMoveToStaging] = useState(true);
  const [removeFromInventoryDestIds, setRemoveFromInventoryDestIds] = useState<string[]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    if (activeOrder) {
      const dests = activeOrder.targetDestinations || [];
      const defaultRemoved = dests
        .filter((dest: any) => {
          const loc = allLocations.find(l => l.id === dest.locationId);
          return loc && loc.type === 'delivery_pickup';
        })
        .map((dest: any) => dest.id);
      setRemoveFromInventoryDestIds(defaultRemoved);
    }
  }, [activeOrder?.id, activeOrder?.targetDestinations, allLocations]);

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
      const element = document.getElementById('field-checklist-pdf-scanner');
      if (!element) {
        throw new Error('Printable element not found');
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
        filename:     `Movement_Checklist_${activeOrder.date || 'Order'}_${activeOrder.name || 'Checklist'}.pdf`,
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
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['tr', '.page-break-avoid', '.border', 'div.border'], before: ['.page-break-before'] }
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
            `${activeOrder.name || 'Movement Order'} • Checklist • ${activeOrder.date || ''}`,
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

  if (!activeOrder) {
    return (
      <div className="bg-cool-gray-800 p-8 rounded-2xl border border-cool-gray-750 text-center space-y-4">
        <div className="p-4 bg-cool-gray-750 rounded-full inline-block text-cool-gray-400">
          <Truck size={36} />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-white">No Finalized Movement Order Active</h3>
          <p className="text-sm text-cool-gray-400 max-w-md mx-auto">
            Interactive scanner and loading checklists are only available during active order execution. 
            Go to the **Workspace** tab to draft and finalize an order first!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in relative" id="offsite-movement-scanner">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* LEFT: SCANNER ENGINE (5 COLS ON XL) */}
          <div className="xl:col-span-5 space-y-6">
            <div className="bg-cool-gray-800 rounded-2xl border border-cool-gray-750 overflow-hidden shadow-lg">
              <div className="bg-cool-gray-750/40 px-5 py-3.5 border-b border-cool-gray-750 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scan size={18} className="text-cyan-400" />
                  <span className="text-sm font-bold text-white">Movement Barcode Scanner</span>
                </div>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`p-2 rounded-lg transition-colors border ${
                    soundEnabled 
                      ? 'bg-cyan-950/20 border-cyan-800/40 text-cyan-400 hover:bg-cyan-900/20' 
                      : 'bg-cool-gray-850 border-cool-gray-750 text-cool-gray-500 hover:text-cool-gray-400'
                  }`}
                  title={soundEnabled ? "Mute audio beeps" : "Unmute audio beeps"}
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Method selector */}
                <div className="flex p-0.5 rounded-lg bg-cool-gray-850 border border-cool-gray-750 text-xs font-bold">
                  <button
                    onClick={() => {
                      stopCameraScanner();
                      setScannerMode('bluetooth');
                    }}
                    className={`flex-1 py-2 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      scannerMode === 'bluetooth'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                  >
                    <Barcode size={14} />
                    <span>Bluetooth Scanner</span>
                  </button>
                  <button
                    onClick={() => {
                      setScannerMode('camera');
                      startCameraScanner();
                    }}
                    className={`flex-1 py-2 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      scannerMode === 'camera'
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                  >
                    <Camera size={14} />
                    <span>Device Camera</span>
                  </button>
                </div>

                {/* Mode description & triggers */}
                {scannerMode === 'bluetooth' ? (
                  <form onSubmit={handleBluetoothSubmit} className="space-y-3">
                    {/* Single-User Mode Status Banner */}
                    {isSingleUserMode ? (
                      <div className="flex items-center justify-between text-xs bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 p-2.5 rounded-xl font-medium">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span><strong>Single-User Mode Active:</strong> All scans execute locally at 0ms latency with auto-sync on exit.</span>
                        </div>
                        {releaseSingleUserMode && (
                          <button
                            type="button"
                            onClick={() => releaseSingleUserMode()}
                            className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 font-bold rounded-lg text-[11px] transition cursor-pointer shrink-0 ml-2"
                          >
                            Release & Sync
                          </button>
                        )}
                      </div>
                    ) : claimSingleUserMode ? (
                      <div className="flex items-center justify-between text-xs bg-amber-950/30 border border-amber-500/30 text-amber-300 p-2.5 rounded-xl font-medium">
                        <span>Multi-User Sync Active</span>
                        <button
                          type="button"
                          onClick={() => claimSingleUserMode()}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[11px] transition cursor-pointer shrink-0 ml-2"
                        >
                          Enable Single-User Mode
                        </button>
                      </div>
                    ) : null}

                    <div className="text-xs text-cool-gray-300 leading-relaxed bg-cyan-950/20 border border-cyan-800/30 p-2.5 rounded-xl">
                      <strong className="text-cyan-400">⚡ Hands-Free Global Scanner Mode Active:</strong> Point and scan any barcode directly from anywhere on this screen! No need to focus the text box. The on-screen keyboard stays hidden unless you tap the box below to type manually.
                    </div>

                    <div className="relative">
                      <input
                        ref={bluetoothInputRef}
                        type="text"
                        placeholder="Scan barcode anywhere on screen, or type here..."
                        value={scanInput}
                        onChange={(e) => {
                          setScanInput(e.target.value);
                          globalScanBufferRef.current = e.target.value;
                        }}
                        className="block w-full rounded-xl border border-cool-gray-700 bg-cool-gray-900 px-4 py-3 text-sm text-cool-gray-100 placeholder-cool-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                      />
                      <button
                        type="submit"
                        className="absolute right-2 top-2 px-3 py-1 bg-cyan-600 text-white font-bold rounded-lg text-xs hover:bg-cyan-500 transition cursor-pointer"
                      >
                        Submit
                      </button>
                    </div>

                    {/* Auto-focus toggle control */}
                    <div className="flex items-center justify-between bg-cool-gray-900/40 p-2.5 rounded-xl border border-cool-gray-750/70 mt-1 select-none">
                      <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-cool-gray-300">
                        <input
                          type="checkbox"
                          checked={isAutoFocusEnabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setIsAutoFocusEnabled(val);
                            try {
                              localStorage.setItem('movement_scanner_auto_focus', String(val));
                            } catch (err) {}
                            if (val) {
                              setTimeout(() => {
                                bluetoothInputRef.current?.focus();
                              }, 50);
                            }
                          }}
                          className="h-4 w-4 rounded border-cool-gray-700 bg-cool-gray-800 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                        />
                        <span>Force-Focus Text Input (May open touch keyboard on tablets)</span>
                      </label>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border tracking-wider ${
                        isAutoFocusEnabled 
                          ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' 
                          : 'bg-cyan-950/40 text-cyan-400 border-cyan-800/40 font-mono'
                      }`}>
                        {isAutoFocusEnabled ? 'FORCED FOCUS' : 'HANDS-FREE (RECOMMENDED)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-center gap-1.5 py-1 text-[10px] text-cyan-400 font-extrabold animate-pulse uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                      Listening for external scanner inputs anywhere on screen...
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="text-xs text-cool-gray-400">
                      Use your tablet or device camera to parse standard barcode labels on containers.
                    </div>

                    <div className="relative bg-cool-gray-900 rounded-xl overflow-hidden border border-cool-gray-700 max-w-lg mx-auto shadow-inner">
                      <div id="camera-scanner-viewfinder" className="w-full h-64 bg-black" />
                      
                      {/* Red laser scanning guide line */}
                      {isCameraActive && !cameraLoading && (
                        <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse pointer-events-none z-10" />
                      )}
                      
                      {cameraLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cool-gray-950/90 p-4 text-center space-y-2">
                          <Loader2 className="animate-spin text-cyan-400" size={24} />
                          <span className="text-xs text-cool-gray-400 font-medium">Accessing device camera streams...</span>
                        </div>
                      )}

                      {!cameraLoading && !isCameraActive && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-cool-gray-950/70 p-4 text-center space-y-3">
                          <Camera className="text-cool-gray-500" size={32} />
                          <button
                            onClick={startCameraScanner}
                            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg shadow transition cursor-pointer"
                          >
                            Restart Camera Stream
                          </button>
                        </div>
                      )}
                    </div>

                    {isCameraActive && (
                      <button
                        onClick={stopCameraScanner}
                        className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-500/20 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Stop Camera Stream</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* LARGE SORTING / DESTINATION DISPLAY PANEL (GIANT TEXT FOR TABLET VIEWING) */}
            <div className="bg-cool-gray-800 rounded-2xl border border-cool-gray-750 overflow-hidden shadow-lg min-h-[300px] flex flex-col">
              <div className="bg-cool-gray-750/40 px-5 py-3.5 border-b border-cool-gray-750 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Live Sorting & Placement Display</span>
                {lastScannedBox && (
                  <span className="text-[10px] text-cool-gray-400 font-bold font-mono">
                    Scanned at {lastScannedBox.timestamp.toLocaleTimeString()}
                  </span>
                )}
              </div>

              <div className="p-6 flex-grow flex flex-col justify-center items-center text-center">
                {!lastScannedBox ? (
                  <div className="space-y-3 p-8">
                    <Scan className="mx-auto text-cool-gray-500/50" size={48} />
                    <p className="text-sm text-cool-gray-400 italic">
                      Scan a box to show giant sorting destination instructions...
                    </p>
                  </div>
                ) : lastScannedBox.success ? (
                  <div className="space-y-6 w-full animate-fade-in">
                    <div>
                      {lastScannedBox.alreadyScanned ? (
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full inline-flex items-center gap-1 animate-pulse">
                          ⚠️ Already Scanned
                        </span>
                      ) : (
                        <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full inline-flex items-center gap-1">
                          ✅ Scan Verified & Logged
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-sm text-cool-gray-400 uppercase tracking-widest font-extrabold font-mono">SCANNED BOX</span>
                      <h1 className="text-4xl font-black text-white tracking-tight font-mono">
                        Box #{lastScannedBox.boxNumber}
                      </h1>
                      <p className="text-sm text-cool-gray-300 font-semibold">{lastScannedBox.details}</p>
                    </div>

                    {lastScannedBox.boxNotes && (
                      <div className="bg-cool-gray-850/80 border border-amber-600/30 p-3 rounded-xl max-w-md mx-auto text-center shadow-sm">
                        <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest block mb-1">📦 Box Notes</span>
                        <p className="text-xs text-amber-100 font-semibold italic">"{lastScannedBox.boxNotes}"</p>
                      </div>
                    )}

                    {lastScannedBox.notes && (
                      <div className="bg-cool-gray-850/60 border border-cool-gray-700/60 p-3 rounded-xl max-w-md mx-auto text-center">
                        <span className="text-[10px] font-extrabold text-cool-gray-400 uppercase tracking-widest block mb-1">🥩 Item Notes</span>
                        <p className="text-xs text-cool-gray-300 font-medium italic">"{lastScannedBox.notes}"</p>
                      </div>
                    )}

                    <div className="bg-cyan-950/20 border-2 border-cyan-500/40 p-6 rounded-2xl space-y-2 shadow-inner">
                      <span className="text-xs text-cyan-400 uppercase tracking-widest font-black">🏢 SORT TO DESTINATION</span>
                      <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-wide font-mono break-words leading-none">
                        {lastScannedBox.destination}
                      </h2>
                    </div>

                    <div className="space-y-2 p-3.5 bg-cool-gray-850/40 rounded-xl border border-cool-gray-750/50 max-w-xs mx-auto">
                      <div className="text-xs text-cool-gray-400 font-bold font-mono flex justify-between items-center px-2">
                        <span>Barcode Weight:</span>
                        <strong className="text-white text-sm font-black">{lastScannedBox.weight?.toFixed(2)} lbs</strong>
                      </div>
                      {lastScannedBox.expectedWeight !== undefined && (
                        <div className="text-xs text-cool-gray-400 font-bold font-mono flex justify-between items-center px-2 border-t border-cool-gray-750/30 pt-1.5">
                          <span>Expected Weight:</span>
                          <strong className="text-white text-sm font-black">{lastScannedBox.expectedWeight.toFixed(2)} lbs</strong>
                        </div>
                      )}
                      {lastScannedBox.weight !== undefined && lastScannedBox.expectedWeight !== undefined && (
                        Math.abs(lastScannedBox.weight - lastScannedBox.expectedWeight) >= 0.01 ? (
                          <div className="mt-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-extrabold uppercase tracking-wider rounded-lg animate-pulse flex items-center justify-center gap-1">
                            <span>⚠️ Weight Mismatch</span>
                            <span>({Math.abs(lastScannedBox.weight - lastScannedBox.expectedWeight).toFixed(2)} lbs diff)</span>
                          </div>
                        ) : (
                          <div className="mt-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1">
                            <span>✓ Weights Match</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-sm mx-auto animate-fade-in">
                    <AlertTriangle className="mx-auto text-amber-500" size={48} />
                    <h3 className="text-lg font-black text-white">Scan Warning</h3>
                    <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl leading-relaxed text-left">
                      {lastScannedBox.errorMsg}
                    </p>
                    <button
                      onClick={() => setLastScannedBox(null)}
                      className="px-4 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-xs font-bold rounded-lg text-cool-gray-300 cursor-pointer"
                    >
                      Clear Warning
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: MANUAL CHECKLIST FALLBACK & DETAILS (7 COLS ON XL) */}
          <div className="xl:col-span-7 space-y-6">
            
            {/* Quick Stats Summary */}
            <div className="bg-cool-gray-800 p-5 rounded-2xl border border-cool-gray-750 shadow-md space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Logistics Transfer Progress</h3>
                <button
                  onClick={saveAsPdf}
                  disabled={isPdfGenerating}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Download size={14} className={isPdfGenerating ? "animate-spin" : ""} />
                  <span>{isPdfGenerating ? "PDF..." : "Save PDF Checklist"}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Phase 1: Pick Up Progress */}
                <div className="bg-cool-gray-900 p-3.5 rounded-xl border border-cool-gray-750/50 space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-extrabold uppercase tracking-wider text-amber-400">
                    <span>Phase 1: Pick Up & Tag</span>
                    <span>{totalPickedBoxes} / {execBoxes.length} Boxes ({execBoxes.length > 0 ? Math.round((totalPickedBoxes / execBoxes.length) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full h-2 bg-cool-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-300" 
                      style={{ width: `${execBoxes.length > 0 ? (totalPickedBoxes / execBoxes.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                {/* Phase 2: Deliver Progress */}
                <div className="bg-cool-gray-900 p-3.5 rounded-xl border border-cool-gray-750/50 space-y-2">
                  <div className="flex justify-between items-center text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                    <span>Phase 2: Deliver & Confirm</span>
                    <span>{totalDeliveredBoxes} / {deliverBoxes.length} Parts ({deliverBoxes.length > 0 ? Math.round((totalDeliveredBoxes / deliverBoxes.length) * 100) : 0}%)</span>
                  </div>
                  <div className="w-full h-2 bg-cool-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300" 
                      style={{ width: `${deliverBoxes.length > 0 ? (totalDeliveredBoxes / deliverBoxes.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Checklist tabs & headers */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex bg-cool-gray-850 p-1 rounded-xl border border-cool-gray-750 w-full sm:w-auto">
                <button
                  onClick={() => handlePhaseChange('pick')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    checklistPhase === 'pick'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 font-black'
                      : 'text-cool-gray-400 hover:text-cool-gray-200'
                  }`}
                >
                  Phase 1: Pick Up Checklist
                </button>
                <button
                  onClick={() => handlePhaseChange('deliver')}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    checklistPhase === 'deliver'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black'
                      : 'text-cool-gray-400 hover:text-cool-gray-200'
                  }`}
                >
                  Phase 2: Move & Deliver
                </button>
              </div>

              <div className="flex gap-1.5 shrink-0 w-full sm:w-auto">
                <button
                  onClick={() => expandAllBoxes(true)}
                  className="flex-1 sm:flex-initial text-[10px] uppercase font-black tracking-wider text-cool-gray-300 hover:text-white bg-cool-gray-800 hover:bg-cool-gray-750 px-3 py-1.5 rounded-lg border border-cool-gray-700 transition-all cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  onClick={() => expandAllBoxes(false)}
                  className="flex-1 sm:flex-initial text-[10px] uppercase font-black tracking-wider text-cool-gray-400 hover:text-cool-gray-300 bg-cool-gray-800 hover:bg-cool-gray-750 px-3 py-1.5 rounded-lg border border-cool-gray-700 transition-all cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* List block */}
            {checklistPhase === 'pick' ? (
              <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
                {pickGroups.map(([palletName, boxes]) => {
                  const remainingBoxes = boxes.filter(b => !(pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id))));
                  const completedBoxes = boxes.filter(b => pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id)));
                  const isCompletedSectionCollapsed = collapsedCompletedGroups.includes(palletName);

                  return (
                    <div key={palletName} className="bg-cool-gray-800 rounded-2xl border border-cool-gray-750 overflow-hidden shadow-sm">
                      <div className="bg-cool-gray-750/40 px-4 py-2.5 border-b border-cool-gray-750 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-white font-bold">
                          <span>📦 Source Pallet:</span>
                          <span className="font-mono font-black text-amber-400">{palletName}</span>
                        </div>
                        <span className="text-[10px] text-cool-gray-400">({boxes.length} boxes)</span>
                      </div>

                      <div className="p-3.5 space-y-2.5">
                        {/* Remaining / Uncompleted Boxes */}
                        {remainingBoxes.length > 0 ? (
                          <div className="space-y-2.5">
                            {remainingBoxes.map((b) => {
                              const isPicked = pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id));
                              const isPartialPicked = !isPicked && b.items.some(it => pickedItemIds.includes(it.id));
                              const isExpanded = expandedBoxes.includes(b.id);
                              
                              return (
                                <div 
                                  key={b.id}
                                  className={`rounded-xl border transition-all overflow-hidden ${
                                    isPicked
                                      ? 'bg-cool-gray-850/40 border-cool-gray-750/50 opacity-60'
                                      : isPartialPicked
                                        ? 'bg-amber-950/5 border-amber-500/20'
                                        : 'bg-cool-gray-900 border-cool-gray-800 text-white hover:bg-cool-gray-800/80'
                                  }`}
                                >
                                  <div 
                                    onClick={() => toggleBoxPicked(b.id)}
                                    className="flex items-center justify-between p-2.5 cursor-pointer select-none gap-4"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleBoxPicked(b.id);
                                        }}
                                        className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-cool-gray-850 border border-cool-gray-750 text-cool-gray-400 cursor-pointer"
                                      >
                                        {isPicked ? (
                                          <span className="text-emerald-500 font-black text-sm">✓</span>
                                        ) : isPartialPicked ? (
                                          <MinusSquare size={16} className="text-amber-500" />
                                        ) : (
                                          <Square size={16} className="text-cool-gray-500" />
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-mono text-sm font-bold text-white">Box {b.boxLabel}</span>
                                          {renderFlagBadge(b.id)}
                                          {renderItemTagsHelper(state.tags, b.items)}
                                          <span className="text-[11px] text-cool-gray-500">
                                            ({b.totalWeight.toFixed(1)} lbs • {b.totalPieces} pcs)
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-cool-gray-400 truncate mt-0.5">
                                          {Array.from(new Set(b.items.map(it => it.cuts))).join(', ')}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                      {b.isSplit ? (
                                        <div className="flex flex-col items-end gap-1">
                                          <span className="text-[9px] uppercase font-extrabold text-cyan-400 tracking-wider">Split To:</span>
                                          {b.destinations?.map((d, idx) => (
                                            <span key={idx} className="text-[10px] bg-cyan-950/40 border border-cyan-800/30 text-cyan-300 px-2 py-0.5 rounded-md font-bold font-mono">
                                              {d.locationName}{d.palletName ? ` (${d.palletName})` : ''}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-xs bg-cyan-950/40 border border-cyan-800/20 text-cyan-300 px-2.5 py-1 rounded-lg font-bold flex flex-col items-end">
                                          <span>{b.targetLocationName}</span>
                                          {b.targetPalletName && <span className="text-[10px] text-amber-400 font-mono font-black">Pallet: {b.targetPalletName}</span>}
                                        </div>
                                      )}
                                      <button
                                        onClick={() => toggleBoxExpanded(b.id)}
                                        className="text-cool-gray-500 hover:text-white p-1 hover:bg-cool-gray-850 rounded"
                                      >
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                      </button>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="bg-cool-gray-950/30 p-3 border-t border-cool-gray-800/60 space-y-2">
                                      <span className="text-[9px] uppercase font-bold tracking-widest text-cool-gray-500">Box Contents Details</span>
                                      <div className="flex flex-col gap-2">
                                        {b.items.map((it: any, idx: number) => {
                                          const isItPicked = pickedItemIds.includes(it.id);
                                          const itemDestId = movesMap.get(it.id);
                                          const itemDest = activeOrder?.targetDestinations?.find((d: any) => d.id === itemDestId);
                                          const itemDestLabel = itemDest ? `${itemDest.locationName}${itemDest.palletName ? ` (${itemDest.palletName})` : ''}` : 'Unassigned';
                                          return (
                                            <div
                                              key={it.id}
                                              onClick={() => toggleItemPicked(b.id, it.id)}
                                              className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer select-none ${
                                                isItPicked 
                                                  ? 'bg-cool-gray-850 border-cool-gray-700 opacity-60' 
                                                  : 'bg-cool-gray-900 border-cool-gray-800 text-cool-gray-200 hover:bg-cool-gray-850'
                                              }`}
                                            >
                                              <div className="flex items-center gap-3 min-w-0">
                                                <div className="text-cool-gray-500 shrink-0 font-bold">
                                                  {isItPicked ? '✓' : '□'}
                                                </div>
                                                <span className="font-mono text-[11px] text-cool-gray-400 font-bold shrink-0">
                                                  {idx + 1}.
                                                </span>
                                                <div className="min-w-0">
                                                  <div className="flex flex-wrap items-center gap-1.5">
                                                    <p className="font-semibold truncate text-white">{it.cuts}</p>
                                                    {(it.isWrongLabel || it.wrongLabel || it.wrongLabelOriginal) && (
                                                      <span className="text-[9px] text-red-300 font-bold px-1.5 py-0.5 bg-red-950/80 border border-red-700/60 rounded flex items-center gap-1 shrink-0" title={`Physical Package Label: ${it.wrongLabelOriginal || it.originalCutName}`}>
                                                        <AlertTriangle size={10} className="text-red-400 shrink-0" />
                                                        <span>Labeled: {it.wrongLabelOriginal || it.originalCutName}</span>
                                                      </span>
                                                    )}
                                                  </div>
                                                  {it.notes && (
                                                    <p className="text-[10px] text-amber-400 italic mt-0.5 truncate" title={it.notes}>
                                                      Note: {it.notes}
                                                    </p>
                                                  )}
                                                  {b.isSplit && (
                                                    <p className="text-[10px] text-cyan-400 font-bold mt-1.5 flex flex-wrap items-center gap-1">
                                                      <span>👉 Target:</span>
                                                      <span className="bg-cyan-950/40 border border-cyan-800/30 text-cyan-300 px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold">{itemDestLabel}</span>
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                              <span className="font-mono text-[11px] font-bold text-cool-gray-400 shrink-0 ml-4">
                                                {it.pieces || 1} {it.pieces === 1 ? 'pc' : 'pcs'} • {it.netWeight?.toFixed(1)} lbs
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs bg-emerald-950/10 border border-emerald-500/20 text-emerald-400 px-3 py-2.5 rounded-xl font-bold flex items-center gap-2">
                            <span>🎉</span>
                            <span>All boxes on this pallet have been picked!</span>
                          </div>
                        )}

                        {/* Completed / Checked Off Boxes */}
                        {completedBoxes.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-cool-gray-750/50">
                            <button
                              onClick={() => {
                                setCollapsedCompletedGroups(prev =>
                                  prev.includes(palletName)
                                    ? prev.filter(k => k !== palletName)
                                    : [...prev, palletName]
                                );
                              }}
                              className="flex items-center gap-2 text-[10px] uppercase font-black tracking-wider text-cool-gray-400 hover:text-white transition cursor-pointer select-none py-1"
                            >
                              <span className="text-cool-gray-500 font-mono w-3 text-center">
                                {isCompletedSectionCollapsed ? '▶' : '▼'}
                              </span>
                              <span>Completed Boxes ({completedBoxes.length})</span>
                            </button>

                            {!isCompletedSectionCollapsed && (
                              <div className="space-y-2.5 mt-2">
                                {completedBoxes.map((b) => {
                                  const isPicked = pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id));
                                  const isPartialPicked = !isPicked && b.items.some(it => pickedItemIds.includes(it.id));
                                  const isExpanded = expandedBoxes.includes(b.id);
                                  
                                  return (
                                    <div 
                                      key={b.id}
                                      className={`rounded-xl border transition-all overflow-hidden ${
                                        isPicked
                                          ? 'bg-cool-gray-850/40 border-cool-gray-750/50 opacity-60'
                                          : isPartialPicked
                                            ? 'bg-amber-950/5 border-amber-500/20'
                                            : 'bg-cool-gray-900 border-cool-gray-800 text-white hover:bg-cool-gray-800/80'
                                      }`}
                                    >
                                      <div 
                                        onClick={() => toggleBoxPicked(b.id)}
                                        className="flex items-center justify-between p-2.5 cursor-pointer select-none gap-4"
                                      >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                          <div 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleBoxPicked(b.id);
                                            }}
                                            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-cool-gray-850 border border-cool-gray-750 text-cool-gray-400 cursor-pointer"
                                          >
                                            {isPicked ? (
                                              <span className="text-emerald-500 font-black text-sm">✓</span>
                                            ) : isPartialPicked ? (
                                              <MinusSquare size={16} className="text-amber-500" />
                                            ) : (
                                              <Square size={16} className="text-cool-gray-500" />
                                            )}
                                          </div>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="font-mono text-sm font-bold text-white">Box {b.boxLabel}</span>
                                              {renderFlagBadge(b.id)}
                                              {renderItemTagsHelper(state.tags, b.items)}
                                              <span className="text-[11px] text-cool-gray-500">
                                                ({b.totalWeight.toFixed(1)} lbs • {b.totalPieces} pcs)
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-cool-gray-400 truncate mt-0.5">
                                              {Array.from(new Set(b.items.map(it => it.cuts))).join(', ')}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                          {b.isSplit ? (
                                            <div className="flex flex-col items-end gap-1">
                                              <span className="text-[9px] uppercase font-extrabold text-cyan-400 tracking-wider">Split To:</span>
                                              {b.destinations?.map((d, idx) => (
                                                <span key={idx} className="text-[10px] bg-cyan-950/40 border border-cyan-800/30 text-cyan-300 px-2 py-0.5 rounded-md font-bold font-mono">
                                                  {d.locationName}{d.palletName ? ` (${d.palletName})` : ''}
                                                </span>
                                              ))}
                                            </div>
                                          ) : (
                                            <div className="text-xs bg-cyan-950/40 border border-cyan-800/20 text-cyan-300 px-2.5 py-1 rounded-lg font-bold flex flex-col items-end">
                                              <span>{b.targetLocationName}</span>
                                              {b.targetPalletName && <span className="text-[10px] text-amber-400 font-mono font-black">Pallet: {b.targetPalletName}</span>}
                                            </div>
                                          )}
                                          <button
                                            onClick={() => toggleBoxExpanded(b.id)}
                                            className="text-cool-gray-500 hover:text-white p-1 hover:bg-cool-gray-850 rounded"
                                          >
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                          </button>
                                        </div>
                                      </div>

                                      {isExpanded && (
                                        <div className="bg-cool-gray-950/30 p-3 border-t border-cool-gray-800/60 space-y-2">
                                          <span className="text-[9px] uppercase font-bold tracking-widest text-cool-gray-500">Box Contents Details</span>
                                          <div className="flex flex-col gap-2">
                                            {b.items.map((it: any, idx: number) => {
                                              const isItPicked = pickedItemIds.includes(it.id);
                                              const itemDestId = movesMap.get(it.id);
                                              const itemDest = activeOrder?.targetDestinations?.find((d: any) => d.id === itemDestId);
                                              const itemDestLabel = itemDest ? `${itemDest.locationName}${itemDest.palletName ? ` (${itemDest.palletName})` : ''}` : 'Unassigned';
                                              return (
                                                <div
                                                  key={it.id}
                                                  onClick={() => toggleItemPicked(b.id, it.id)}
                                                  className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer select-none ${
                                                    isItPicked 
                                                      ? 'bg-cool-gray-850 border-cool-gray-700 opacity-60' 
                                                      : 'bg-cool-gray-900 border-cool-gray-800 text-cool-gray-200 hover:bg-cool-gray-850'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-3 min-w-0">
                                                    <div className="text-cool-gray-500 shrink-0 font-bold">
                                                      {isItPicked ? '✓' : '□'}
                                                    </div>
                                                    <span className="font-mono text-[11px] text-cool-gray-400 font-bold shrink-0">
                                                      {idx + 1}.
                                                    </span>
                                                    <div className="min-w-0">
                                                      <div className="flex flex-wrap items-center gap-1.5">
                                                        <p className="font-semibold truncate text-white">{it.cuts}</p>
                                                        {(it.isWrongLabel || it.wrongLabel || it.wrongLabelOriginal) && (
                                                          <span className="text-[9px] text-red-300 font-bold px-1.5 py-0.5 bg-red-950/80 border border-red-700/60 rounded flex items-center gap-1 shrink-0" title={`Physical Package Label: ${it.wrongLabelOriginal || it.originalCutName}`}>
                                                            <AlertTriangle size={10} className="text-red-400 shrink-0" />
                                                            <span>Labeled: {it.wrongLabelOriginal || it.originalCutName}</span>
                                                          </span>
                                                        )}
                                                      </div>
                                                      {it.notes && (
                                                        <p className="text-[10px] text-amber-400 italic mt-0.5 truncate" title={it.notes}>
                                                          Note: {it.notes}
                                                        </p>
                                                      )}
                                                      {b.isSplit && (
                                                        <p className="text-[10px] text-cyan-400 font-bold mt-1.5 flex flex-wrap items-center gap-1">
                                                          <span>👉 Target:</span>
                                                          <span className="bg-cyan-950/40 border border-cyan-800/30 text-cyan-300 px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold">{itemDestLabel}</span>
                                                        </p>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <span className="font-mono text-[11px] font-bold text-cool-gray-400 shrink-0 ml-4">
                                                    {it.pieces || 1} {it.pieces === 1 ? 'pc' : 'pcs'} • {it.netWeight?.toFixed(1)} lbs
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {pickGroups.length === 0 && (
                  <div className="text-center py-12 text-cool-gray-500 italic">No boxes are registered in Phase 1 of this order.</div>
                )}
              </div>
            ) : (
              <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
                {deliverGroups.map(([destId, g]) => {
                  const remainingBoxes = g.boxes.filter(b => !(deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id))));
                  const completedBoxes = g.boxes.filter(b => deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id)));
                  const isCompletedSectionCollapsed = collapsedCompletedGroups.includes(destId);

                  return (
                    <div key={destId} className="bg-cool-gray-800 rounded-2xl border border-cool-gray-750 overflow-hidden shadow-sm">
                      <div className="bg-cool-gray-750/40 px-4 py-2.5 border-b border-cool-gray-750 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-white font-bold">
                          <span>🏢 Destination:</span>
                          <span className="font-mono font-black text-emerald-400">{g.label}</span>
                        </div>
                        <span className="text-[10px] text-cool-gray-400">({g.boxes.length} items)</span>
                      </div>

                      <div className="p-3.5 space-y-2.5">
                        {/* Remaining / Uncompleted Deliver Boxes */}
                        {remainingBoxes.length > 0 ? (
                          <div className="space-y-2.5">
                            {remainingBoxes.map((b) => {
                              const isDelivered = deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id));
                              const isPartialDelivered = !isDelivered && b.items.some(it => deliveredItemIds.includes(it.id));
                              const isExpanded = expandedBoxes.includes(b.id);
                              
                              return (
                                <div 
                                  key={b.id}
                                  className={`rounded-xl border transition-all overflow-hidden ${
                                    isDelivered
                                      ? 'bg-cool-gray-850/40 border-cool-gray-750/50 opacity-60'
                                      : isPartialDelivered
                                        ? 'bg-emerald-950/5 border-emerald-500/20'
                                        : 'bg-cool-gray-900 border-cool-gray-800 text-white hover:bg-cool-gray-800/80'
                                  }`}
                                >
                                  <div 
                                    onClick={() => toggleBoxDelivered(b.id)}
                                    className="flex items-center justify-between p-2.5 cursor-pointer select-none gap-4"
                                  >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                      <div 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleBoxDelivered(b.id);
                                        }}
                                        className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-cool-gray-850 border border-cool-gray-750 text-cool-gray-400 cursor-pointer"
                                      >
                                        {isDelivered ? (
                                          <span className="text-emerald-500 font-black text-sm">✓</span>
                                        ) : isPartialDelivered ? (
                                          <MinusSquare size={16} className="text-emerald-500" />
                                        ) : (
                                          <Square size={16} className="text-cool-gray-500" />
                                        )}
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-mono text-sm font-bold text-white">Box {b.boxLabel}</span>
                                          {renderFlagBadge(b.id)}
                                          {renderItemTagsHelper(state.tags, b.items)}
                                          {b.isSplitPart && (
                                            <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 rounded uppercase font-bold tracking-wide">
                                              Split Part
                                            </span>
                                          )}
                                          <span className="text-[11px] text-cool-gray-500">
                                            ({b.totalWeight.toFixed(1)} lbs • {b.totalPieces} pcs)
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-cool-gray-400 truncate mt-0.5">
                                          {Array.from(new Set(b.items.map(it => it.cuts))).join(', ')}
                                        </p>

                                        {b.isSplitPart && b.destinations && (
                                          <div className="mt-1.5 flex flex-wrap gap-1.5 items-center text-[11px] text-purple-350" onClick={(e) => e.stopPropagation()}>
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

                                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                      <span className="text-[10px] text-cool-gray-400 font-semibold uppercase bg-cool-gray-850 border border-cool-gray-750 px-2 py-1 rounded">
                                        From: {b.sourcePallet}
                                      </span>
                                      <button
                                        onClick={() => toggleBoxExpanded(b.id)}
                                        className="text-cool-gray-500 hover:text-white p-1 hover:bg-cool-gray-850 rounded"
                                      >
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                      </button>
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="bg-cool-gray-950/30 p-3 border-t border-cool-gray-800/60 space-y-2">
                                      <span className="text-[9px] uppercase font-bold tracking-widest text-cool-gray-500">Box Contents Details</span>
                                      <div className="flex flex-col gap-2">
                                        {b.items.map((it: any, idx: number) => {
                                          const isItDelivered = deliveredItemIds.includes(it.id);
                                          const itemDestId = movesMap.get(it.id);
                                          const itemDest = activeOrder?.targetDestinations?.find((d: any) => d.id === itemDestId);
                                          const itemDestLabel = itemDest ? `${itemDest.locationName}${itemDest.palletName ? ` (${itemDest.palletName})` : ''}` : 'Unassigned';
                                          return (
                                            <div
                                              key={it.id}
                                              onClick={() => toggleItemDelivered(b.id, it.id)}
                                              className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer select-none ${
                                                isItDelivered 
                                                  ? 'bg-cool-gray-850 border-cool-gray-700 opacity-60' 
                                                  : 'bg-cool-gray-900 border-cool-gray-800 text-cool-gray-200 hover:bg-cool-gray-850'
                                              }`}
                                            >
                                              <div className="flex items-center gap-3 min-w-0">
                                                <div className="text-cool-gray-500 shrink-0 font-bold">
                                                  {isItDelivered ? '✓' : '□'}
                                                </div>
                                                <span className="font-mono text-[11px] text-cool-gray-400 font-bold shrink-0">
                                                  {idx + 1}.
                                                </span>
                                                <div className="min-w-0">
                                                  <div className="flex flex-wrap items-center gap-1.5">
                                                    <p className="font-semibold truncate text-white">{it.cuts}</p>
                                                    {(it.isWrongLabel || it.wrongLabel || it.wrongLabelOriginal) && (
                                                      <span className="text-[9px] text-red-300 font-bold px-1.5 py-0.5 bg-red-950/80 border border-red-700/60 rounded flex items-center gap-1 shrink-0" title={`Physical Package Label: ${it.wrongLabelOriginal || it.originalCutName}`}>
                                                        <AlertTriangle size={10} className="text-red-400 shrink-0" />
                                                        <span>Labeled: {it.wrongLabelOriginal || it.originalCutName}</span>
                                                      </span>
                                                    )}
                                                  </div>
                                                  {it.notes && (
                                                    <p className="text-[10px] text-amber-400 italic mt-0.5 truncate" title={it.notes}>
                                                      Note: {it.notes}
                                                    </p>
                                                  )}
                                                  {b.isSplitPart && (
                                                    <p className="text-[10px] text-purple-400 font-bold mt-1.5 flex flex-wrap items-center gap-1">
                                                      <span>👉 Target:</span>
                                                      <span className="bg-purple-950/40 border border-purple-800/30 text-purple-300 px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold">{itemDestLabel}</span>
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                              <span className="font-mono text-[11px] font-bold text-cool-gray-400 shrink-0 ml-4">
                                                {it.pieces || 1} {it.pieces === 1 ? 'pc' : 'pcs'} • {it.netWeight?.toFixed(1)} lbs
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-xs bg-emerald-950/10 border border-emerald-500/20 text-emerald-400 px-3 py-2.5 rounded-xl font-bold flex items-center gap-2">
                            <span>🎉</span>
                            <span>All boxes for this destination have been delivered!</span>
                          </div>
                        )}

                        {/* Completed / Delivered Boxes */}
                        {completedBoxes.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-cool-gray-750/50">
                            <button
                              onClick={() => {
                                setCollapsedCompletedGroups(prev =>
                                  prev.includes(destId)
                                    ? prev.filter(k => k !== destId)
                                    : [...prev, destId]
                                );
                              }}
                              className="flex items-center gap-2 text-[10px] uppercase font-black tracking-wider text-cool-gray-400 hover:text-white transition cursor-pointer select-none py-1"
                            >
                              <span className="text-cool-gray-500 font-mono w-3 text-center">
                                {isCompletedSectionCollapsed ? '▶' : '▼'}
                              </span>
                              <span>Completed Boxes ({completedBoxes.length})</span>
                            </button>

                            {!isCompletedSectionCollapsed && (
                              <div className="space-y-2.5 mt-2">
                                {completedBoxes.map((b) => {
                                  const isDelivered = deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id));
                                  const isPartialDelivered = !isDelivered && b.items.some(it => deliveredItemIds.includes(it.id));
                                  const isExpanded = expandedBoxes.includes(b.id);
                                  
                                  return (
                                    <div 
                                      key={b.id}
                                      className={`rounded-xl border transition-all overflow-hidden ${
                                        isDelivered
                                          ? 'bg-cool-gray-850/40 border-cool-gray-750/50 opacity-60'
                                          : isPartialDelivered
                                            ? 'bg-emerald-950/5 border-emerald-500/20'
                                            : 'bg-cool-gray-900 border-cool-gray-800 text-white hover:bg-cool-gray-800/80'
                                      }`}
                                    >
                                      <div 
                                        onClick={() => toggleBoxDelivered(b.id)}
                                        className="flex items-center justify-between p-2.5 cursor-pointer select-none gap-4"
                                      >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                          <div 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleBoxDelivered(b.id);
                                            }}
                                            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg bg-cool-gray-850 border border-cool-gray-750 text-cool-gray-400 cursor-pointer"
                                          >
                                            {isDelivered ? (
                                              <span className="text-emerald-500 font-black text-sm">✓</span>
                                            ) : isPartialDelivered ? (
                                              <MinusSquare size={16} className="text-emerald-500" />
                                            ) : (
                                              <Square size={16} className="text-cool-gray-500" />
                                            )}
                                          </div>

                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="font-mono text-sm font-bold text-white">Box {b.boxLabel}</span>
                                              {renderFlagBadge(b.id)}
                                              {renderItemTagsHelper(state.tags, b.items)}
                                              {b.isSplitPart && (
                                                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 rounded uppercase font-bold tracking-wide">
                                                  Split Part
                                                </span>
                                              )}
                                              <span className="text-[11px] text-cool-gray-500">
                                                ({b.totalWeight.toFixed(1)} lbs • {b.totalPieces} pcs)
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-cool-gray-400 truncate mt-0.5">
                                              {Array.from(new Set(b.items.map(it => it.cuts))).join(', ')}
                                            </p>

                                            {b.isSplitPart && b.destinations && (
                                              <div className="mt-1.5 flex flex-wrap gap-1.5 items-center text-[11px] text-purple-350" onClick={(e) => e.stopPropagation()}>
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

                                        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                                          <span className="text-[10px] text-cool-gray-400 font-semibold uppercase bg-cool-gray-850 border border-cool-gray-750 px-2 py-1 rounded">
                                            From: {b.sourcePallet}
                                          </span>
                                          <button
                                            onClick={() => toggleBoxExpanded(b.id)}
                                            className="text-cool-gray-500 hover:text-white p-1 hover:bg-cool-gray-850 rounded"
                                          >
                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                          </button>
                                        </div>
                                      </div>

                                      {isExpanded && (
                                        <div className="bg-cool-gray-950/30 p-3 border-t border-cool-gray-800/60 space-y-2">
                                          <span className="text-[9px] uppercase font-bold tracking-widest text-cool-gray-500">Box Contents Details</span>
                                          <div className="flex flex-col gap-2">
                                            {b.items.map((it: any, idx: number) => {
                                              const isItDelivered = deliveredItemIds.includes(it.id);
                                              const itemDestId = movesMap.get(it.id);
                                              const itemDest = activeOrder?.targetDestinations?.find((d: any) => d.id === itemDestId);
                                              const itemDestLabel = itemDest ? `${itemDest.locationName}${itemDest.palletName ? ` (${itemDest.palletName})` : ''}` : 'Unassigned';
                                              return (
                                                <div
                                                  key={it.id}
                                                  onClick={() => toggleItemDelivered(b.id, it.id)}
                                                  className={`p-2.5 rounded-lg border flex items-center justify-between text-xs cursor-pointer select-none ${
                                                    isItDelivered 
                                                      ? 'bg-cool-gray-850 border-cool-gray-700 opacity-60' 
                                                      : 'bg-cool-gray-900 border-cool-gray-800 text-cool-gray-200 hover:bg-cool-gray-850'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-3 min-w-0">
                                                    <div className="text-cool-gray-500 shrink-0 font-bold">
                                                      {isItDelivered ? '✓' : '□'}
                                                    </div>
                                                    <span className="font-mono text-[11px] text-cool-gray-400 font-bold shrink-0">
                                                      {idx + 1}.
                                                    </span>
                                                    <div className="min-w-0">
                                                      <div className="flex flex-wrap items-center gap-1.5">
                                                        <p className="font-semibold truncate text-white">{it.cuts}</p>
                                                        {(it.isWrongLabel || it.wrongLabel || it.wrongLabelOriginal) && (
                                                          <span className="text-[9px] text-red-300 font-bold px-1.5 py-0.5 bg-red-950/80 border border-red-700/60 rounded flex items-center gap-1 shrink-0" title={`Physical Package Label: ${it.wrongLabelOriginal || it.originalCutName}`}>
                                                            <AlertTriangle size={10} className="text-red-400 shrink-0" />
                                                            <span>Labeled: {it.wrongLabelOriginal || it.originalCutName}</span>
                                                          </span>
                                                        )}
                                                      </div>
                                                      {it.notes && (
                                                        <p className="text-[10px] text-amber-400 italic mt-0.5 truncate" title={it.notes}>
                                                          Note: {it.notes}
                                                        </p>
                                                      )}
                                                      {b.isSplitPart && (
                                                        <p className="text-[10px] text-purple-400 font-bold mt-1.5 flex flex-wrap items-center gap-1">
                                                          <span>👉 Target:</span>
                                                          <span className="bg-purple-950/40 border border-purple-800/30 text-purple-300 px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold">{itemDestLabel}</span>
                                                        </p>
                                                      )}
                                                    </div>
                                                  </div>
                                                  <span className="font-mono text-[11px] font-bold text-cool-gray-400 shrink-0 ml-4">
                                                    {it.pieces || 1} {it.pieces === 1 ? 'pc' : 'pcs'} • {it.netWeight?.toFixed(1)} lbs
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {deliverGroups.length === 0 && (
                  <div className="text-center py-12 text-cool-gray-500 italic">No boxes are registered in Phase 2 of this order.</div>
                )}
              </div>
            )}
          </div>
        </div>

      {/* Confirmation overlay */}
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

      {/* Completion Report Modal */}
      {isReportModalOpen && (
        <MovementReportModal 
          state={state} 
          order={activeOrder} 
          onClose={() => {
            setIsReportModalOpen(false);
          }} 
        />
      )}

      {/* HIDDEN PRINT-READY OFF-LINE CHECKLIST SHEET (USED BY SAVE PDF ENGINE) */}
      <div className="hidden">
        <div id="field-checklist-pdf-scanner" className="p-8 text-black bg-white space-y-6 text-xs font-sans print-only">
          <div className="border-b-2 border-black pb-4 flex justify-between items-end">
            <div>
              <h1 className="text-xl font-extrabold uppercase tracking-wide">Logistics Movement Order</h1>
              <p className="text-sm font-black text-gray-700 mt-1">{activeOrder.name || "Meat Relocation Transfer"}</p>
            </div>
            <div className="text-right font-mono">
              <p className="text-sm font-bold">DATE: {activeOrder.date}</p>
              <p className="text-[9px] text-gray-500 uppercase font-bold mt-1">Status: Finalized Execution Checklist</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase border-b border-black pb-1">Phase 1: Pick Up Checklist (Source Pallets)</h2>
            {pickGroups.map(([palletName, boxes]) => (
              <div key={palletName} className="border border-gray-400 rounded-lg p-3 space-y-2">
                <p className="font-bold bg-gray-100 px-2 py-1 font-mono">Source Pallet: {palletName}</p>
                <div className="space-y-1.5 pl-2">
                  {boxes.map(b => (
                    <div key={b.id} className="flex items-start gap-3">
                      <span className="border-2 border-black h-4 w-4 rounded shrink-0 flex items-center justify-center font-bold text-[9px]">
                        {pickedBoxIds.includes(b.id) || b.items.every(it => pickedItemIds.includes(it.id)) ? "✓" : ""}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-bold">Box {b.boxLabel}</span> ({b.totalWeight.toFixed(1)} lbs • {b.totalPieces} pcs)
                        {b.isSplit && (
                          <p className="text-[10px] text-purple-700 font-bold mt-0.5">
                            ⚠️ SPLIT: {getBoxSplitSummary(b.boxLabel, b.sourcePallet, b.destinations)}
                          </p>
                        )}
                      </div>
                      <span className="font-bold font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded shrink-0">
                        Deliver to: {b.isSplit ? "[Split]" : `${b.targetLocationName}${b.targetPalletName ? ` (Pallet: ${b.targetPalletName})` : ''}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-sm font-black uppercase border-b border-black pb-1">Phase 2: Deliver Checklist (Confirm Locations)</h2>
            {deliverGroups.map(([destId, g]) => (
              <div key={destId} className="border border-gray-400 rounded-lg p-3 space-y-2">
                <p className="font-bold bg-gray-100 px-2 py-1 font-mono">Destination: {g.label}</p>
                <div className="space-y-1.5 pl-2">
                  {g.boxes.map(b => (
                    <div key={b.id} className="flex items-start gap-3">
                      <span className="border-2 border-black h-4 w-4 rounded shrink-0 flex items-center justify-center font-bold text-[9px]">
                        {deliveredBoxIds.includes(b.id) || b.items.every(it => deliveredItemIds.includes(it.id)) ? "✓" : ""}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono font-bold">Box {b.boxLabel}</span> ({b.totalWeight.toFixed(1)} lbs • {b.totalPieces} pcs)
                        {b.isSplitPart && (
                          <p className="text-[10px] text-purple-700 font-bold mt-0.5">
                            ⚠️ SPLIT PART: {getBoxSplitSummary(b.boxLabel, b.sourcePallet, b.destinations || [])}
                          </p>
                        )}
                      </div>
                      <span className="font-bold font-mono text-[10px] bg-gray-100 px-1 py-0.5 rounded shrink-0">
                        From Pallet: {b.sourcePallet}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ConfirmModalOverlay = ({ isOpen, title, message, confirmText, isDanger, onConfirm, onClose }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-cool-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-cool-gray-750">
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
