import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  FileText, 
  Printer, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Truck, 
  MapPin, 
  Warehouse, 
  Package, 
  Tag as TagIcon, 
  Layers, 
  Info, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Boxes, 
  Calendar, 
  Scale, 
  ShieldCheck, 
  FileCheck2,
  ChevronRight,
  Filter,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { 
  InventoryState, 
  OffSiteEntry, 
  ButcherOrder, 
  MovementOrder, 
  MovementDestination,
  Product, 
  Container, 
  Freezer, 
  HistoryEntry, 
  AppLocation, 
  Tag, 
  MeatCut,
  View 
} from '../types';

interface TraceabilityViewProps {
  state: InventoryState;
  dispatch: React.Dispatch<any>;
  onNavigateToView?: (view: View, params?: any) => void;
  initialSearch?: string;
}

export interface TraceRecord {
  id: string;
  serial: string;
  lot?: string;
  cutName: string;
  originalCutName?: string;
  isWrongLabel?: boolean;
  wrongLabel?: string;
  product?: Product;
  packDate?: string;
  pieces: number;
  netWeight: number;
  sourceOrderId?: string;
  butcherOrder?: ButcherOrder;
  currentLocationType: 'offsite' | 'onsite' | 'archived';
  currentLocationName: string;
  currentContainerName?: string;
  currentFreezerName?: string;
  pallet?: string;
  box?: string;
  storageLocation?: AppLocation;
  tags: Tag[];
  movementOrders: MovementOrder[];
  entryRef: OffSiteEntry;
  harvestDate?: string;
  pickupDate?: string;
  offSiteIntakeDate?: string;
  onSiteArrivalDate?: string;
  onSiteContainer?: Container;
  onSiteFreezer?: Freezer;
  onSiteCohortLogs: HistoryEntry[];
  archivedDate?: string;
  archivedReason?: string;
  removalDestination?: string;
}

// Safely format dates for traceability steps
export const formatTraceDate = (dateStr?: string, includeTime: boolean = false): string => {
  if (!dateStr || !dateStr.trim()) return 'Not specified';
  const clean = dateStr.trim();
  const d = new Date(clean);
  if (isNaN(d.getTime())) {
    return clean;
  }
  if (includeTime && (clean.includes('T') || clean.includes(':'))) {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

// Safely parse potential date embedded in pallet or ID (e.g. P3-03262026 or 2026-03-26)
export const extractDateFromPalletOrId = (str?: string): string | undefined => {
  if (!str) return undefined;
  const isoMatch = str.match(/\b(20\d\d)[-_/](0[1-9]|1[0-2])[-_/](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const usMatch = str.match(/\b(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(20\d\d)\b/);
  if (usMatch) return `${usMatch[1]}/${usMatch[2]}/${usMatch[3]}`;
  return undefined;
};

export const TraceabilityView: React.FC<TraceabilityViewProps> = ({
  state,
  dispatch,
  onNavigateToView,
  initialSearch = ''
}) => {
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'offsite' | 'onsite' | 'archived'>('all');

  const barcodeRef = useRef<SVGSVGElement>(null);
  const printBarcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (initialSearch) {
      setSearchQuery(initialSearch);
    }
  }, [initialSearch]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Build high-efficiency lookup dictionaries from state
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    (state.products || []).forEach(p => map.set(p.id, p));
    return map;
  }, [state.products]);

  const butcherOrdersMap = useMemo(() => {
    const map = new Map<string, ButcherOrder>();
    (state.butcherOrders || []).forEach(bo => {
      if (bo.id) map.set(bo.id, bo);
      if (bo.orderNumber) map.set(bo.orderNumber.toLowerCase(), bo);
    });
    return map;
  }, [state.butcherOrders]);

  const locationsMap = useMemo(() => {
    const map = new Map<string, AppLocation>();
    (state.locations || []).forEach(l => map.set(l.id, l));
    return map;
  }, [state.locations]);

  const tagsMap = useMemo(() => {
    const map = new Map<string, Tag>();
    (state.tags || []).forEach(t => map.set(t.id, t));
    return map;
  }, [state.tags]);

  const containersMap = useMemo(() => {
    const map = new Map<string, Container>();
    (state.containers || []).forEach(c => map.set(c.id, c));
    return map;
  }, [state.containers]);

  const freezersMap = useMemo(() => {
    const map = new Map<string, Freezer>();
    (state.freezers || []).forEach(f => map.set(f.id, f));
    return map;
  }, [state.freezers]);

  // Aggregate all unique traceability items (all offsite entries active + archived, plus historical movement snapshots)
  const allTraceRecords = useMemo<TraceRecord[]>(() => {
    const recordsMap = new Map<string, TraceRecord>();
    const offsiteEntries = state.offSiteEntries || [];
    const movementOrders = state.movementOrders || [];
    const historyLogs = state.history || [];

    // Helper to resolve product
    const resolveProduct = (entry: OffSiteEntry): Product | undefined => {
      if (entry.productId && productsMap.has(entry.productId)) {
        return productsMap.get(entry.productId);
      }
      const rawCuts = (entry.cuts || '').trim().toLowerCase();
      if (!rawCuts) return undefined;
      return (state.products || []).find(p => 
        p.name.toLowerCase() === rawCuts || 
        (p.productNumbers && p.productNumbers.some(pn => rawCuts.startsWith(pn.toLowerCase())))
      );
    };

    // Helper to resolve butcher order
    const resolveButcherOrder = (entry: OffSiteEntry): ButcherOrder | undefined => {
      if (!entry.orderId) return undefined;
      return butcherOrdersMap.get(entry.orderId) || butcherOrdersMap.get(entry.orderId.toLowerCase());
    };

    // Process all entries from offSiteEntries
    offsiteEntries.forEach(entry => {
      if (!entry.serial && !entry.lot) return;
      const serialKey = (entry.serial || entry.id).trim();
      const product = resolveProduct(entry);
      const butcherOrder = resolveButcherOrder(entry);
      const storageLocation = entry.storageLocationId ? locationsMap.get(entry.storageLocationId) : undefined;
      
      const resolvedTags: Tag[] = (entry.tagIds || [])
        .map(tid => tagsMap.get(tid))
        .filter((t): t is Tag => Boolean(t));

      // Determine movement orders that affected this entry
      const relatedMoves = movementOrders.filter(mo => 
        mo.moves.some(m => m.entryId === entry.id) ||
        (mo.originalEntries && mo.originalEntries.some(oe => oe.id === entry.id || (oe.serial && oe.serial === entry.serial)))
      ).sort((a, b) => new Date(a.date || a.executedAt || '').getTime() - new Date(b.date || b.executedAt || '').getTime());

      // Check history logs for explicit off-site removal or consumption for this item
      const serialUpper = (entry.serial || '').trim().toUpperCase();
      const removalLog = historyLogs.find(h => {
        const desc = h.description;
        const matchesSerial = Boolean(serialUpper && desc.toUpperCase().includes(serialUpper));
        const matchesEntryId = desc.includes(entry.id);
        return (matchesSerial || matchesEntryId) && (
          h.targetId === 'offsite-removal' ||
          desc.toLowerCase().includes('from offsite inventory after delivery to') ||
          desc.toLowerCase().includes('removed from offsite inventory')
        );
      });

      let removalDestName: string | undefined;
      if (removalLog) {
        const match = removalLog.description.match(/after delivery to "(.*?)"/i);
        if (match && match[1]) {
          removalDestName = match[1].trim();
        }
      }

      // Find executed moves specifically for this entry
      const executedMovesForEntry = relatedMoves.filter(mo => 
        Boolean(mo.executedAt || mo.status === 'completed') &&
        mo.moves.some(m => m.entryId === entry.id || (entry.serial && mo.originalEntries?.some(oe => oe.serial === entry.serial && oe.id === m.entryId)))
      );
      const lastExecutedMove = executedMovesForEntry.length > 0 ? executedMovesForEntry[executedMovesForEntry.length - 1] : undefined;

      // Extract specific destination for this item in the last executed move
      let lastMoveDestId: string | undefined;
      let lastMoveTargetDest: MovementDestination | undefined;
      let lastMoveTargetLoc: AppLocation | undefined;
      let isLastMoveHome = false;

      if (lastExecutedMove) {
        const moveItem = lastExecutedMove.moves.find(m => m.entryId === entry.id || (entry.serial && lastExecutedMove.originalEntries?.some(oe => oe.serial === entry.serial && oe.id === m.entryId)));
        if (moveItem) {
          lastMoveDestId = moveItem.actualLocation || moveItem.targetLocation;
          lastMoveTargetDest = lastMoveDestId ? lastExecutedMove.targetDestinations?.find(d => d.id === lastMoveDestId) : undefined;
          lastMoveTargetLoc = lastMoveTargetDest ? locationsMap.get(lastMoveTargetDest.locationId) : (lastMoveDestId ? locationsMap.get(lastMoveDestId) : undefined);
          isLastMoveHome = Boolean(lastMoveTargetLoc?.isHome || lastMoveTargetDest?.locationName?.toLowerCase().includes('home') || lastMoveTargetDest?.locationName?.toLowerCase().includes('staging'));
        }
      }

      // Check if specifically matched to an active cut currently on site with quantity > 0
      let matchedOnSiteCut: MeatCut | undefined;
      if (product && entry.serial && entry.serial.trim()) {
        matchedOnSiteCut = (state.meatCuts || []).find(mc => 
          mc.productId === product.id && 
          mc.serial && 
          mc.serial.trim().toLowerCase() === entry.serial?.trim().toLowerCase() && 
          (mc.quantity || 0) > 0
        );
      }

      // Determine status and location
      let currentLocationType: 'offsite' | 'onsite' | 'archived' = 'offsite';
      let currentLocationName = entry.currentLocation || entry.location || storageLocation?.name || 'Off-Site Cold Storage';
      let currentContainerName: string | undefined;
      let currentFreezerName: string | undefined;
      let onSiteArrivalDate: string | undefined;
      let onSiteContainer: Container | undefined;
      let onSiteFreezer: Freezer | undefined;
      let archivedDate: string | undefined;
      let archivedReason: string | undefined;
      let removalDestination: string | undefined = removalDestName || (lastMoveTargetDest && !isLastMoveHome ? lastMoveTargetDest.locationName : undefined);

      if (entry.archived) {
        // Priority 1: Explicit removal from inventory (e.g., delivered to CLiCK, customer, or written off)
        if (removalLog || (lastMoveTargetDest && !isLastMoveHome)) {
          currentLocationType = 'archived';
          const destLabel = removalDestName || lastMoveTargetDest?.locationName || 'External Location';
          currentLocationName = `Delivered to ${destLabel} (Removed from Inventory)`;
          archivedDate = removalLog?.timestamp || lastExecutedMove?.executedAt || lastExecutedMove?.date;
          archivedReason = `Delivered to ${destLabel} and permanently removed from active inventory.`;
          removalDestination = destLabel;
        } else if (matchedOnSiteCut) {
          // Priority 2: Actively matched to an on-site cut with quantity > 0
          currentLocationType = 'onsite';
          const container = containersMap.get(matchedOnSiteCut.containerId);
          if (container && !container.isArchived) {
            onSiteContainer = container;
            currentContainerName = container.name;
            const freezer = container.freezerId ? freezersMap.get(container.freezerId) : undefined;
            if (freezer) {
              onSiteFreezer = freezer;
              currentFreezerName = freezer.name;
              currentLocationName = `${freezer.name} • ${container.name}`;
            } else {
              currentLocationName = container.name;
            }
          } else {
            currentLocationName = 'On-Site Storage / Cabinets';
          }
          onSiteArrivalDate = lastExecutedMove?.executedAt || lastExecutedMove?.date || matchedOnSiteCut.packDate;
        } else {
          // Priority 3: Archived or consumed
          currentLocationType = 'archived';
          archivedDate = lastExecutedMove?.executedAt || lastExecutedMove?.date;
          if (lastMoveTargetDest && isLastMoveHome) {
            currentLocationName = 'Archived / Consumed (Past On-Site)';
            archivedReason = 'Transferred on-site and subsequently consumed or archived.';
          } else {
            currentLocationName = 'Archived / Removed';
            archivedReason = 'Archived or removed from active inventory.';
          }
        }
      } else {
        // Active in Off-Site Storage
        currentLocationType = 'offsite';
        if (lastMoveTargetDest && !isLastMoveHome) {
          currentLocationName = `${lastMoveTargetDest.locationName}${lastMoveTargetDest.palletName ? ` • ${lastMoveTargetDest.palletName}` : ''}`;
        } else {
          currentLocationName = entry.currentLocation || entry.location || storageLocation?.name || 'Off-Site Cold Storage';
        }
      }

      // Resolve step dates
      const harvestDate = butcherOrder?.killDate;
      const pickupDate = butcherOrder?.pickupDate;

      // Off-Site Cold Storage intake date resolution
      let offSiteIntakeDate: string | undefined;

      const intakeLog = historyLogs.find(h => {
        const desc = h.description.toLowerCase();
        const matchesSerial = Boolean(serialUpper && desc.includes(serialUpper.toLowerCase()));
        const matchesEntryId = desc.includes(entry.id.toLowerCase());
        const matchesPallet = Boolean(entry.pallet && desc.includes(entry.pallet.toLowerCase()));
        return (matchesSerial || matchesEntryId || matchesPallet) &&
          (desc.includes('import') || desc.includes('intake') || desc.includes('added') || desc.includes('created') || desc.includes('off-site') || desc.includes('pallet'));
      });

      if (intakeLog) {
        offSiteIntakeDate = intakeLog.timestamp;
      } else {
        const dateFromPallet = extractDateFromPalletOrId(entry.pallet || entry.currentLocation);
        if (dateFromPallet) {
          offSiteIntakeDate = dateFromPallet;
        } else if (entry.packDate) {
          offSiteIntakeDate = entry.packDate;
        } else if (pickupDate) {
          offSiteIntakeDate = pickupDate;
        }
      }

      // On-Site Arrival date resolution fallback
      if (!onSiteArrivalDate && currentLocationType === 'onsite') {
        const arrivalLog = historyLogs.find(h => {
          const desc = h.description.toLowerCase();
          const matchesSerial = Boolean(serialUpper && desc.includes(serialUpper.toLowerCase()));
          const matchesProduct = Boolean(product && desc.includes(product.name.toLowerCase()));
          return (matchesSerial || matchesProduct) &&
            (desc.includes('staged') || desc.includes('restock') || desc.includes('on-site') || desc.includes('cabinet') || desc.includes('freezer'));
        });
        if (arrivalLog) {
          onSiteArrivalDate = arrivalLog.timestamp;
        } else if (matchedOnSiteCut?.packDate) {
          onSiteArrivalDate = matchedOnSiteCut.packDate;
        }
      }

      // Collect on-site cohort logs (movements involving the on-site container post arrival)
      const onSiteCohortLogs: HistoryEntry[] = [];
      if (onSiteContainer) {
        const containerId = onSiteContainer.id;
        const arrivalTime = onSiteArrivalDate ? new Date(onSiteArrivalDate).getTime() : 0;
        historyLogs.forEach(h => {
          if (h.targetId === containerId || (product && h.description.toLowerCase().includes(product.name.toLowerCase()))) {
            const entryTime = new Date(h.timestamp).getTime();
            if (arrivalTime === 0 || entryTime >= arrivalTime - (86400000 * 2)) {
              onSiteCohortLogs.push(h);
            }
          }
        });
      }

      recordsMap.set(serialKey, {
        id: entry.id,
        serial: entry.serial || 'NO-SERIAL',
        lot: entry.lot,
        cutName: product?.name || entry.cuts || 'Unknown Cut',
        originalCutName: entry.originalCutName,
        isWrongLabel: Boolean(entry.isWrongLabel || entry.wrongLabel),
        wrongLabel: entry.wrongLabel,
        product,
        packDate: entry.packDate,
        pieces: entry.pieces || 1,
        netWeight: Number(entry.netWeight) || 0,
        sourceOrderId: entry.orderId,
        butcherOrder,
        currentLocationType,
        currentLocationName,
        currentContainerName,
        currentFreezerName,
        pallet: entry.pallet || entry.currentLocation,
        box: entry.box,
        storageLocation,
        tags: resolvedTags,
        movementOrders: relatedMoves,
        entryRef: entry,
        harvestDate,
        pickupDate,
        offSiteIntakeDate,
        onSiteArrivalDate,
        onSiteContainer,
        onSiteFreezer,
        onSiteCohortLogs: onSiteCohortLogs.slice(0, 15),
        archivedDate,
        archivedReason,
        removalDestination
      });
    });

    // Also index on-site cuts that don't have an off-site entry
    (state.meatCuts || []).forEach(cut => {
      const serialKey = (cut.serial || cut.id).trim();
      if (recordsMap.has(serialKey)) return;
      const product = productsMap.get(cut.productId);
      const container = containersMap.get(cut.containerId);
      const freezer = container?.freezerId ? freezersMap.get(container.freezerId) : undefined;
      const resolvedTags: Tag[] = (cut.tagIds || [])
        .map(tid => tagsMap.get(tid))
        .filter((t): t is Tag => Boolean(t));

      const isArchived = (cut.quantity || 0) <= 0 || Boolean(container?.isArchived);

      recordsMap.set(serialKey, {
        id: cut.id,
        serial: cut.serial || cut.id,
        lot: cut.lot,
        cutName: product?.name || cut.originalCutName || 'Unknown Cut',
        originalCutName: cut.originalCutName,
        isWrongLabel: Boolean(cut.isWrongLabel || cut.wrongLabel),
        wrongLabel: cut.wrongLabel,
        product,
        packDate: cut.packDate,
        pieces: cut.quantity || 1,
        netWeight: cut.weight || 0,
        currentLocationType: isArchived ? 'archived' : 'onsite',
        currentLocationName: isArchived 
          ? 'Archived / Consumed' 
          : (freezer && container ? `${freezer.name} • ${container.name}` : container?.name || 'On-Site Freezers'),
        currentContainerName: container?.name,
        currentFreezerName: freezer?.name,
        tags: resolvedTags,
        movementOrders: [],
        entryRef: {
          id: cut.id,
          productId: cut.productId,
          serial: cut.serial || cut.id,
          lot: cut.lot,
          packDate: cut.packDate,
          cuts: product?.name,
          netWeight: 0,
          pieces: cut.quantity
        },
        harvestDate: undefined,
        pickupDate: undefined,
        offSiteIntakeDate: undefined,
        onSiteArrivalDate: cut.packDate,
        onSiteContainer: container,
        onSiteFreezer: freezer,
        onSiteCohortLogs: [],
        archivedDate: isArchived ? cut.packDate : undefined,
        archivedReason: isArchived ? 'Consumed or depleted on-site stock.' : undefined,
        removalDestination: undefined
      });
    });

    return Array.from(recordsMap.values());
  }, [state.offSiteEntries, state.movementOrders, state.meatCuts, state.history, productsMap, butcherOrdersMap, locationsMap, tagsMap, containersMap, freezersMap]);

  // List of unique lots for quick navigation
  const uniqueLots = useMemo(() => {
    const set = new Set<string>();
    allTraceRecords.forEach(r => {
      if (r.lot && r.lot.trim()) set.add(r.lot.trim());
    });
    return Array.from(set).sort();
  }, [allTraceRecords]);

  // List of unique butcher orders for quick navigation
  const uniqueButcherOrders = useMemo(() => {
    return (state.butcherOrders || []).map(bo => ({
      id: bo.id,
      orderNumber: bo.orderNumber,
      species: bo.species,
      date: bo.killDate || bo.pickupDate
    }));
  }, [state.butcherOrders]);

  // Filter records based on user search
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    return allTraceRecords.filter(r => {
      const matchStatus = activeStatusFilter === 'all' || r.currentLocationType === activeStatusFilter;
      if (!matchStatus) return false;

      const serialMatch = r.serial.toLowerCase().includes(q);
      const lotMatch = r.lot ? r.lot.toLowerCase().includes(q) : false;
      const orderMatch = (r.sourceOrderId && r.sourceOrderId.toLowerCase().includes(q)) || 
        (r.butcherOrder && (r.butcherOrder.orderNumber.toLowerCase().includes(q) || r.butcherOrder.species.toLowerCase().includes(q)));
      const cutMatch = r.cutName.toLowerCase().includes(q) || (r.originalCutName && r.originalCutName.toLowerCase().includes(q));
      const boxMatch = r.box ? r.box.toLowerCase().includes(q) : false;
      const palletMatch = r.pallet ? r.pallet.toLowerCase().includes(q) : false;
      const tagMatch = r.tags.some(t => t.name.toLowerCase().includes(q));

      return serialMatch || lotMatch || orderMatch || cutMatch || boxMatch || palletMatch || tagMatch;
    });
  }, [allTraceRecords, searchQuery, activeStatusFilter]);

  // Selected record deep dive
  const activeRecord = useMemo(() => {
    if (selectedSerial) {
      const found = allTraceRecords.find(r => r.serial === selectedSerial || r.id === selectedSerial);
      if (found) return found;
    }
    // If only 1 record matched in search, default to it
    if (filteredRecords.length === 1 && searchQuery.trim().length >= 3) {
      return filteredRecords[0];
    }
    return null;
  }, [selectedSerial, filteredRecords, allTraceRecords, searchQuery]);

  // Render Barcode
  useEffect(() => {
    if (activeRecord && activeRecord.serial && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, activeRecord.serial, {
          format: 'CODE128',
          width: 1.6,
          height: 48,
          displayValue: true,
          font: 'monospace',
          fontSize: 12,
          lineColor: '#06b6d4',
          background: 'transparent'
        });
      } catch (err) {
        console.warn('Barcode render fallback:', err);
      }
    }
  }, [activeRecord]);

  // Render Print Barcode
  useEffect(() => {
    if (isPrintModalOpen && activeRecord && activeRecord.serial && printBarcodeRef.current) {
      try {
        JsBarcode(printBarcodeRef.current, activeRecord.serial, {
          format: 'CODE128',
          width: 2,
          height: 60,
          displayValue: true,
          font: 'monospace',
          fontSize: 14,
          lineColor: '#000000',
          background: '#ffffff'
        });
      } catch (err) {
        console.warn('Print barcode render error:', err);
      }
    }
  }, [isPrintModalOpen, activeRecord]);

  // Aggregate Cohort Stats when multiple items match a lot / order
  const cohortSummary = useMemo(() => {
    if (filteredRecords.length <= 1) return null;
    const totalPcs = filteredRecords.reduce((acc, r) => acc + (r.pieces || 1), 0);
    const totalWeight = filteredRecords.reduce((acc, r) => acc + (r.netWeight || 0), 0);
    const offsiteCount = filteredRecords.filter(r => r.currentLocationType === 'offsite').length;
    const onsiteCount = filteredRecords.filter(r => r.currentLocationType === 'onsite').length;
    const archivedCount = filteredRecords.filter(r => r.currentLocationType === 'archived').length;

    // Distinct cut names
    const distinctCuts = Array.from(new Set(filteredRecords.map(r => r.cutName)));

    return {
      totalPackages: filteredRecords.length,
      totalPcs,
      totalWeight: Math.round(totalWeight * 100) / 100,
      offsiteCount,
      onsiteCount,
      archivedCount,
      distinctCuts
    };
  }, [filteredRecords]);

  // Chronological Journey Steps specifically verified for the active record
  const journeySteps = useMemo(() => {
    if (!activeRecord) return [];
    const steps: {
      id: string;
      stepNumber: number;
      title: string;
      badge?: string;
      icon: React.ReactNode;
      dateStr: string;
      colorTheme: 'amber' | 'cyan' | 'blue' | 'indigo' | 'emerald';
      summary: string;
      details: React.ReactNode;
    }[] = [];

    let stepNum = 1;

    // Step: Harvest & Slaughter Processing (if butcherOrder exists OR harvestDate exists)
    if (activeRecord.butcherOrder || activeRecord.harvestDate) {
      const stepDate = activeRecord.harvestDate || activeRecord.butcherOrder?.killDate || activeRecord.pickupDate || activeRecord.packDate;
      steps.push({
        id: 'harvest',
        stepNumber: stepNum++,
        title: 'Harvest & Butcher Processing',
        badge: activeRecord.butcherOrder ? `Order #${activeRecord.butcherOrder.orderNumber}` : 'Direct Harvest',
        icon: <span className="text-sm">🥩</span>,
        dateStr: formatTraceDate(stepDate),
        colorTheme: 'amber',
        summary: activeRecord.butcherOrder
          ? `Harvested and processed ${activeRecord.butcherOrder.species || 'livestock'} batch under Butcher Order #${activeRecord.butcherOrder.orderNumber}.`
          : 'Initial harvest and custom butchering intake.',
        details: activeRecord.butcherOrder ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-cool-gray-300 mt-3 pt-3 border-t border-cool-gray-800">
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Species</span>
              <span className="font-semibold text-cool-gray-200">{activeRecord.butcherOrder.species || 'Custom Meat'}</span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Slaughter / Kill Date</span>
              <span className="font-mono text-amber-300 font-bold flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 text-amber-400/80" />
                {formatTraceDate(activeRecord.butcherOrder.killDate)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Pickup / Completion Date</span>
              <span className="font-mono text-cool-gray-200 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-cool-gray-400" />
                {formatTraceDate(activeRecord.butcherOrder.pickupDate)}
              </span>
            </div>
            {activeRecord.butcherOrder.liveWeight ? (
              <div>
                <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Live Weight</span>
                <span className="font-mono text-cool-gray-200">{activeRecord.butcherOrder.liveWeight} lbs</span>
              </div>
            ) : null}
            {activeRecord.butcherOrder.coldWeight ? (
              <div>
                <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Hanging Weight</span>
                <span className="font-mono text-cool-gray-200">{activeRecord.butcherOrder.coldWeight} lbs</span>
              </div>
            ) : null}
            {activeRecord.butcherOrder.notes ? (
              <div className="sm:col-span-3">
                <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Butcher Notes</span>
                <span className="text-cool-gray-300 italic">{activeRecord.butcherOrder.notes}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-cool-gray-400 mt-2">
            Originating batch processed under Lot <strong className="text-cool-gray-200 font-mono">{activeRecord.lot || 'N/A'}</strong> with pack date <strong className="text-cool-gray-200 font-mono">{formatTraceDate(activeRecord.packDate)}</strong>.
          </p>
        )
      });
    }

    // Step: Packaging & Certification
    steps.push({
      id: 'packaging',
      stepNumber: stepNum++,
      title: 'Packaging & Certified Lot Assignment',
      badge: activeRecord.lot ? `Lot ${activeRecord.lot}` : 'Packaged',
      icon: <Package className="w-4 h-4 text-cyan-400" />,
      dateStr: formatTraceDate(activeRecord.packDate),
      colorTheme: 'cyan',
      summary: `Vacuum sealed, labeled with certified net weight (${activeRecord.netWeight ? `${activeRecord.netWeight} lbs` : 'weight unrecorded'}), and assigned Serial #${activeRecord.serial}.`,
      details: (
        <div className="space-y-3 mt-3 pt-3 border-t border-cool-gray-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Certified Pack Date</span>
              <span className="font-mono text-cyan-300 font-bold flex items-center gap-1 mt-0.5">
                <Calendar className="w-3 h-3 text-cyan-400/80" />
                {formatTraceDate(activeRecord.packDate)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Cut Specification</span>
              <span className="font-semibold text-cool-gray-200 truncate block mt-0.5">
                {activeRecord.cutName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Certified Net Weight</span>
              <span className="font-mono text-cyan-400 font-bold block mt-0.5">
                {activeRecord.netWeight ? `${activeRecord.netWeight} lbs` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Lot Identifier</span>
              <span className="font-mono text-cool-gray-200 font-bold block mt-0.5">
                {activeRecord.lot || 'Unassigned'}
              </span>
            </div>
          </div>
          {activeRecord.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-cool-gray-800/80">
              <span className="text-[10px] text-cool-gray-500 uppercase font-semibold mr-1">Inherited Tags:</span>
              {activeRecord.tags.map(t => (
                <span 
                  key={t.id} 
                  className="px-2 py-0.5 rounded text-[11px] font-semibold border"
                  style={{
                    backgroundColor: t.color ? `${t.color}22` : '#374151',
                    borderColor: t.color || '#4b5563',
                    color: t.textColor || t.color || '#f3f4f6'
                  }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )
    });

    // Step: Off-Site Cold Storage Intake (if offsiteIntakeDate or entry had off-site storage info or currently offsite)
    if (activeRecord.offSiteIntakeDate || activeRecord.storageLocation || activeRecord.pallet || activeRecord.box || activeRecord.currentLocationType === 'offsite') {
      steps.push({
        id: 'cold_storage',
        stepNumber: stepNum++,
        title: 'Commercial Cold Storage Intake',
        badge: activeRecord.storageLocation?.name || 'Cold Storage Facility',
        icon: <Warehouse className="w-4 h-4 text-blue-400" />,
        dateStr: formatTraceDate(activeRecord.offSiteIntakeDate),
        colorTheme: 'blue',
        summary: `Received at commercial blast deep-freeze storage facility (${activeRecord.storageLocation?.name || activeRecord.entryRef.location || 'Cold Storage'}) to maintain strict sub-zero temperature logs.`,
        details: (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-cool-gray-850 p-3.5 rounded-lg border border-cool-gray-800 mt-3">
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Facility Name</span>
              <span className="font-semibold text-cool-gray-200 block mt-0.5">
                {activeRecord.storageLocation?.name || activeRecord.entryRef.location || 'Off-Site Cold Facility'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Intake Timestamp</span>
              <span className="font-mono text-blue-300 font-bold flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3 text-blue-400" />
                {formatTraceDate(activeRecord.offSiteIntakeDate)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Pallet Assignment</span>
              <span className="font-mono text-cyan-400 font-semibold block mt-0.5">
                {activeRecord.pallet || 'Unassigned'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Box Designation</span>
              <span className="font-mono text-cool-gray-200 block mt-0.5">
                {activeRecord.box || 'Unboxed'}
              </span>
            </div>
          </div>
        )
      });
    }

    // Step(s): Inter-Facility Movement Orders (ONLY if movement orders actually exist!)
    if (activeRecord.movementOrders.length > 0) {
      activeRecord.movementOrders.forEach(mo => {
        const moveItem = mo.moves.find(m => m.entryId === activeRecord.id || (activeRecord.serial && mo.originalEntries?.some(oe => oe.serial === activeRecord.serial && oe.id === m.entryId)));
        const targetDestId = moveItem ? (moveItem.actualLocation || moveItem.targetLocation) : undefined;
        const targetDest = targetDestId ? mo.targetDestinations?.find(d => d.id === targetDestId) : undefined;
        const targetLoc = targetDest ? locationsMap.get(targetDest.locationId) : undefined;
        const destName = targetDest?.locationName || targetLoc?.name;
        const originName = moveItem?.originalCurrentLocation || moveItem?.originalLocation;

        let moveSummary = mo.description || 'Inter-facility logistics movement order executed between storage locations.';
        if (originName && destName) {
          moveSummary = `Transferred from "${originName}" to "${destName}"${targetDest?.palletName ? ` (Pallet ${targetDest.palletName})` : ''}.`;
        } else if (destName) {
          moveSummary = `Dispatched to destination "${destName}"${targetDest?.palletName ? ` (Pallet ${targetDest.palletName})` : ''}.`;
        }

        steps.push({
          id: `move_${mo.id}`,
          stepNumber: stepNum++,
          title: `Logistics Transfer: ${mo.name}`,
          badge: mo.status?.toUpperCase() || 'COMPLETED',
          icon: <Truck className="w-4 h-4 text-indigo-400" />,
          dateStr: formatTraceDate(mo.executedAt || mo.date, true),
          colorTheme: 'indigo',
          summary: moveSummary,
          details: (
            <div className="p-3 bg-cool-gray-850 rounded-lg border border-cool-gray-750 text-xs mt-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                <span className="font-bold text-cool-gray-200">
                  Transfer Order: {mo.name}
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded border border-indigo-800/50">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  Executed: {formatTraceDate(mo.executedAt || mo.date, true)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-cool-gray-300 mt-1">
                <span className="text-[11px] text-cool-gray-400">Order Status:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400">
                  {mo.status || 'Completed'}
                </span>
                {mo.description && (
                  <span className="text-cool-gray-400 text-[11px] truncate">
                    • {mo.description}
                  </span>
                )}
              </div>
              {(originName || destName) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-cool-gray-800 text-[11px]">
                  <div>
                    <span className="text-cool-gray-500 block text-[10px] uppercase font-semibold">Origin</span>
                    <span className="text-cool-gray-200 font-medium">{originName || 'Prior Cold Storage'}</span>
                  </div>
                  <div>
                    <span className="text-cool-gray-500 block text-[10px] uppercase font-semibold">Target Destination</span>
                    <span className="text-indigo-300 font-medium">{destName || 'Target Location'}{targetDest?.palletName ? ` • ${targetDest.palletName}` : ''}</span>
                  </div>
                </div>
              )}
            </div>
          )
        });
      });
    }

    // Step: On-Site Freezer Placement (ONLY if item is currently on-site!)
    if (activeRecord.currentLocationType === 'onsite') {
      steps.push({
        id: 'onsite_placement',
        stepNumber: stepNum++,
        title: 'On-Site Freezer Placement & In-Stock Custody',
        badge: 'Active On-Site',
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
        dateStr: formatTraceDate(activeRecord.onSiteArrivalDate || activeRecord.packDate, true),
        colorTheme: 'emerald',
        summary: `Placed into active on-site storage in ${activeRecord.currentFreezerName || 'Freezer'} • ${activeRecord.currentContainerName || 'Bin'}.`,
        details: (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-cool-gray-850 p-3.5 rounded-lg border border-cool-gray-750 mt-3">
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Cabinet / Freezer</span>
              <span className="font-bold text-cool-gray-100 text-sm block mt-0.5">
                {activeRecord.currentFreezerName || 'On-Site Warehouse'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Specific Container / Bin</span>
              <span className="font-bold text-emerald-300 text-sm block mt-0.5">
                {activeRecord.currentContainerName || 'On-Site Storage Bin'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-cool-gray-500 block uppercase font-semibold">Placement Timestamp</span>
              <span className="font-mono text-emerald-300 font-bold block mt-0.5">
                {formatTraceDate(activeRecord.onSiteArrivalDate || activeRecord.packDate, true)}
              </span>
            </div>
          </div>
        )
      });
    }

    // Step: Final Custody Disposition (Delivery / Removal / Archive)
    if (activeRecord.currentLocationType === 'archived') {
      const isDelivered = Boolean(activeRecord.removalDestination);
      steps.push({
        id: 'archived_disposition',
        stepNumber: stepNum++,
        title: isDelivered 
          ? `Delivered & Removed: ${activeRecord.removalDestination}` 
          : 'Archived / Removed from Inventory',
        badge: isDelivered ? 'Delivered to Destination' : 'Archived Record',
        icon: <FileCheck2 className="w-4 h-4 text-purple-400" />,
        dateStr: formatTraceDate(activeRecord.archivedDate || activeRecord.onSiteArrivalDate || activeRecord.packDate, true),
        colorTheme: 'indigo',
        summary: isDelivered
          ? `Package delivered to ${activeRecord.removalDestination} and permanently removed from active inventory.`
          : (activeRecord.archivedReason || 'Item has been consumed, distributed, or archived from active inventory.'),
        details: (
          <div className="p-3 bg-cool-gray-850 rounded-lg border border-purple-800/40 text-xs mt-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="font-bold text-cool-gray-200">
                {isDelivered ? `Delivered to ${activeRecord.removalDestination}` : 'Archived Status'}
              </span>
              {activeRecord.archivedDate && (
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-purple-300 bg-purple-950/80 px-2.5 py-1 rounded border border-purple-800/50">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  {formatTraceDate(activeRecord.archivedDate, true)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-cool-gray-300 mt-1">
              <span className="text-[11px] text-cool-gray-400">Inventory Status:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300">
                {isDelivered ? 'Permanently Removed upon Delivery' : 'Archived / Consumed'}
              </span>
            </div>
            {isDelivered && (
              <p className="text-[11px] text-purple-200/90 pt-1 border-t border-cool-gray-800">
                This item completed its custody journey upon delivery to <strong>{activeRecord.removalDestination}</strong> and was permanently removed from off-site storage inventory. It is not residing in on-site staging or freezers.
              </p>
            )}
          </div>
        )
      });
    }

    return steps;
  }, [activeRecord, locationsMap]);

  return (
    <div className="flex flex-col h-full animate-fade-in pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] max-w-7xl mx-auto w-full pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 mt-1 bg-cool-gray-900/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-cool-gray-800 shadow-xl z-20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                Item Traceability & Chain of Custody
              </h1>
              <p className="text-xs text-cool-gray-400 mt-0.5">
                End-to-end harvest, storage, transfer, and custody tracking from Butcher to Freezers
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-cool-gray-850 px-3.5 py-1.5 rounded-xl border border-cool-gray-750 text-right">
            <span className="text-[10px] text-cool-gray-400 block uppercase font-bold tracking-wider">Tracked Records</span>
            <span className="text-sm font-black text-cyan-400">{allTraceRecords.length} items</span>
          </div>
          <div className="bg-cool-gray-850 px-3.5 py-1.5 rounded-xl border border-cool-gray-750 text-right">
            <span className="text-[10px] text-cool-gray-400 block uppercase font-bold tracking-wider">Active Lots</span>
            <span className="text-sm font-black text-amber-400">{uniqueLots.length} lots</span>
          </div>
        </div>
      </div>

      {/* Main Search & Query Bar */}
      <div className="bg-cool-gray-850 p-4 sm:p-5 rounded-2xl border border-cool-gray-750 shadow-md mb-6 space-y-4">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
            <Search className="h-5 w-5 text-amber-400/90" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedSerial(null);
            }}
            placeholder="Enter Serial Number, Lot #, Butcher Order #, Cut name, or Box ID to trace..."
            className="block w-full rounded-xl border border-cool-gray-700 bg-cool-gray-900/90 pl-11 pr-24 text-sm text-cool-gray-100 placeholder:text-cool-gray-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 py-3 transition shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedSerial(null);
              }}
              className="absolute inset-y-0 right-3 flex items-center px-2.5 py-1 text-xs text-cool-gray-400 hover:text-white bg-cool-gray-800 hover:bg-cool-gray-700 rounded-lg cursor-pointer my-auto h-7 font-bold"
            >
              Clear ✕
            </button>
          )}
        </div>

        {/* Quick Discovery Tags & Filter Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-cool-gray-400">
          <span className="font-semibold text-cool-gray-500 uppercase text-[10px] tracking-wider mr-1">Quick Select:</span>
          
          {/* Recent lots chip pills */}
          {uniqueLots.slice(0, 5).map(lot => (
            <button
              key={lot}
              onClick={() => {
                setSearchQuery(lot);
                setSelectedSerial(null);
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition cursor-pointer ${
                searchQuery === lot 
                  ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold' 
                  : 'bg-cool-gray-800/80 border-cool-gray-700 text-cool-gray-300 hover:border-amber-400 hover:text-white'
              }`}
            >
              Lot: {lot}
            </button>
          ))}

          {/* Recent butcher orders */}
          {uniqueButcherOrders.slice(0, 3).map(bo => (
            <button
              key={bo.id}
              onClick={() => {
                setSearchQuery(bo.orderNumber);
                setSelectedSerial(null);
              }}
              className={`px-2.5 py-1 rounded-lg border text-xs font-mono transition cursor-pointer ${
                searchQuery === bo.orderNumber 
                  ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold' 
                  : 'bg-cool-gray-800/80 border-cool-gray-700 text-cool-gray-300 hover:border-cyan-400 hover:text-white'
              }`}
            >
              Order #{bo.orderNumber} ({bo.species})
            </button>
          ))}
        </div>
      </div>

      {/* Conditional Content Area */}
      {!searchQuery.trim() ? (
        /* Empty State / Discovery Dashboard */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Guide Card */}
          <div className="md:col-span-2 bg-cool-gray-850 p-6 rounded-2xl border border-cool-gray-750 shadow-md">
            <h2 className="text-base font-bold text-cool-gray-100 flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Comprehensive Chain of Custody
            </h2>
            <p className="text-xs text-cool-gray-300 leading-relaxed mb-4">
              This system unites external processor intake, off-site blast cold storage, multi-facility logistics movement orders, and on-site cabinet allocations into a unified food safety timeline.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                <span className="font-bold text-cyan-400 block mb-1">🥩 Butcher & Off-Site Phase</span>
                <p className="text-cool-gray-400 text-[11px] leading-normal">
                  Tracked at the <strong>exact individual package level</strong> using physical butcher serial numbers, harvest lots, net weights, and pack dates.
                </p>
              </div>

              <div className="p-3.5 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                <span className="font-bold text-amber-400 block mb-1">🏠 On-Site Cabinet Phase</span>
                <p className="text-cool-gray-400 text-[11px] leading-normal">
                  Correlated via <strong>high-confidence cohort tracking</strong> across movement transfer manifests, destination bins, and verified audit logs.
                </p>
              </div>
            </div>

            {/* Quick action buttons to relevant views */}
            <div className="flex flex-wrap gap-2.5 mt-6 pt-4 border-t border-cool-gray-800">
              <button
                onClick={() => onNavigateToView && onNavigateToView('offsite')}
                className="px-3.5 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-400 rounded-xl border border-cool-gray-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Warehouse className="w-3.5 h-3.5" /> View Off-Site Storage
              </button>
              <button
                onClick={() => onNavigateToView && onNavigateToView('butcher_records')}
                className="px-3.5 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-amber-400 rounded-xl border border-cool-gray-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" /> View Harvest Batches
              </button>
              <button
                onClick={() => onNavigateToView && onNavigateToView('history')}
                className="px-3.5 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-indigo-400 rounded-xl border border-cool-gray-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" /> Full Audit Log
              </button>
            </div>
          </div>

          {/* Quick Stats Sidebar */}
          <div className="bg-cool-gray-850 p-6 rounded-2xl border border-cool-gray-750 shadow-md space-y-4">
            <h3 className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" /> Recent Trackable Serials
            </h3>
            
            <div className="space-y-2">
              {allTraceRecords.slice(0, 6).map(r => (
                <div 
                  key={r.id} 
                  onClick={() => {
                    setSearchQuery(r.serial);
                    setSelectedSerial(r.serial);
                  }}
                  className="p-2.5 bg-cool-gray-900/70 hover:bg-cool-gray-800 rounded-xl border border-cool-gray-800 hover:border-amber-500/50 transition cursor-pointer flex items-center justify-between"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-mono text-xs font-bold text-amber-300 block truncate">{r.serial}</span>
                    <span className="text-[11px] text-cool-gray-400 truncate block">{r.cutName}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-cool-gray-800 text-cool-gray-300 font-mono">
                    {r.netWeight ? `${r.netWeight} lb` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : filteredRecords.length === 0 ? (
        /* No Results Found */
        <div className="bg-cool-gray-850 p-8 rounded-2xl border border-cool-gray-750 text-center py-16">
          <AlertCircle className="w-12 h-12 text-amber-400/60 mx-auto mb-3" />
          <h3 className="text-base font-bold text-cool-gray-200 mb-1">No Matching Traceability Records</h3>
          <p className="text-xs text-cool-gray-400 max-w-md mx-auto mb-4">
            Could not find any packages, lot identifiers, butcher orders, or movement manifests matching &quot;{searchQuery}&quot;.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSerial(null);
            }}
            className="px-4 py-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold hover:bg-amber-500/30 transition cursor-pointer"
          >
            Clear Search Filter
          </button>
        </div>
      ) : activeRecord ? (
        /* Deep-Dive Active Record Chain of Custody */
        <div className="space-y-6 animate-fade-in">
          {/* Return button if multiple results were found */}
          {filteredRecords.length > 1 && (
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSelectedSerial(null)}
                className="px-3.5 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-200 rounded-xl border border-cool-gray-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                ← Back to Batch Results ({filteredRecords.length} items)
              </button>
              <span className="text-xs text-cool-gray-400 font-mono">
                Item 1 of {filteredRecords.length} in cohort
              </span>
            </div>
          )}

          {/* Primary Record Header Card */}
          <div className="bg-gradient-to-r from-cool-gray-850 to-cool-gray-900 p-5 sm:p-6 rounded-2xl border border-cool-gray-750 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 font-mono font-black text-sm flex items-center gap-1.5">
                    SN: {activeRecord.serial}
                    <button
                      onClick={() => handleCopy(activeRecord.serial, 'serial')}
                      className="text-amber-400/80 hover:text-amber-300 cursor-pointer ml-1"
                      title="Copy Serial Number"
                    >
                      {copiedText === 'serial' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </span>

                  {activeRecord.lot && (
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold">
                      LOT: {activeRecord.lot}
                    </span>
                  )}

                  {/* Current Status Badge */}
                  {activeRecord.currentLocationType === 'onsite' ? (
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> On-Site Inventory
                    </span>
                  ) : activeRecord.currentLocationType === 'offsite' ? (
                    <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 text-xs font-bold flex items-center gap-1">
                      <Warehouse className="w-3.5 h-3.5" /> Off-Site Cold Storage
                    </span>
                  ) : activeRecord.removalDestination ? (
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5" /> Delivered to {activeRecord.removalDestination}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs font-bold flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5" /> Archived / Consumed
                    </span>
                  )}
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-cool-gray-100">
                  {activeRecord.cutName}
                </h2>

                {activeRecord.originalCutName && activeRecord.originalCutName !== activeRecord.cutName && (
                  <p className="text-xs text-cool-gray-400">
                    Original Processor Tag: <span className="text-cool-gray-300 font-mono italic">&quot;{activeRecord.originalCutName}&quot;</span>
                  </p>
                )}

                {activeRecord.isWrongLabel && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/60 border border-amber-600/50 rounded-lg text-amber-200 text-xs font-semibold">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    Processor Mislabel Corrected: Originally tagged as &quot;{activeRecord.wrongLabel || activeRecord.originalCutName}&quot;
                  </div>
                )}
              </div>

              {/* Barcode & Print Action */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="bg-cool-gray-900/80 p-2.5 rounded-xl border border-cool-gray-800 flex flex-col items-center">
                  <svg ref={barcodeRef} className="max-w-[200px] h-12"></svg>
                </div>

                <button
                  onClick={() => setIsPrintModalOpen(true)}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-cool-gray-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg transition cursor-pointer whitespace-nowrap"
                >
                  <Printer className="w-4 h-4" /> Print Custody Certificate
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-cool-gray-800 text-xs">
              <div className="bg-cool-gray-900/60 p-2.5 rounded-xl border border-cool-gray-800">
                <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Net Weight</span>
                <span className="font-mono font-bold text-cool-gray-100 text-sm">
                  {activeRecord.netWeight ? `${activeRecord.netWeight} lbs` : 'Not recorded'}
                </span>
              </div>

              <div className="bg-cool-gray-900/60 p-2.5 rounded-xl border border-cool-gray-800">
                <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Package Count</span>
                <span className="font-mono font-bold text-cool-gray-100 text-sm">
                  {activeRecord.pieces} pc{activeRecord.pieces > 1 ? 's' : ''}
                </span>
              </div>

              <div className="bg-cool-gray-900/60 p-2.5 rounded-xl border border-cool-gray-800">
                <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Pack Date</span>
                <span className="font-mono font-bold text-cool-gray-100 text-sm">
                  {activeRecord.packDate || 'Not specified'}
                </span>
              </div>

              <div className="bg-cool-gray-900/60 p-2.5 rounded-xl border border-cool-gray-800">
                <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Current Custody</span>
                <span className="font-bold text-amber-400 text-sm truncate block">
                  {activeRecord.currentLocationName}
                </span>
              </div>
            </div>
          </div>

          {/* Card 1: CURRENT PHYSICAL LOCATION ("Where It Is Now") */}
          <div className={`p-5 sm:p-6 rounded-2xl border shadow-lg ${
            activeRecord.currentLocationType === 'onsite'
              ? 'bg-gradient-to-br from-emerald-950/40 via-cool-gray-850 to-cool-gray-900 border-emerald-500/40'
              : activeRecord.currentLocationType === 'offsite'
              ? 'bg-gradient-to-br from-cyan-950/40 via-cool-gray-850 to-cool-gray-900 border-cyan-500/40'
              : 'bg-gradient-to-br from-purple-950/40 via-cool-gray-850 to-cool-gray-900 border-purple-500/40'
          }`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-cool-gray-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-cool-gray-400">
                    Current Physical Location
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                    activeRecord.currentLocationType === 'onsite'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : activeRecord.currentLocationType === 'offsite'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  }`}>
                    {activeRecord.currentLocationType === 'onsite' ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> In Stock On-Site</>
                    ) : activeRecord.currentLocationType === 'offsite' ? (
                      <><Warehouse className="w-3.5 h-3.5" /> In Off-Site Cold Storage</>
                    ) : activeRecord.removalDestination ? (
                      <><FileCheck2 className="w-3.5 h-3.5" /> Delivered & Removed</>
                    ) : (
                      <><FileCheck2 className="w-3.5 h-3.5" /> Archived / Consumed</>
                    )}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-cool-gray-100 flex items-center gap-2.5">
                  <MapPin className={`w-5 h-5 shrink-0 ${
                    activeRecord.currentLocationType === 'onsite' ? 'text-emerald-400' : activeRecord.currentLocationType === 'offsite' ? 'text-cyan-400' : 'text-purple-400'
                  }`} />
                  {activeRecord.currentLocationName}
                </h3>
              </div>

              <div className="text-xs font-mono text-cool-gray-400 bg-cool-gray-900/80 px-3.5 py-2 rounded-xl border border-cool-gray-800 shrink-0">
                <span className="text-[10px] uppercase block text-cool-gray-500 font-semibold">Location Type</span>
                <span className="text-cool-gray-200 font-bold">
                  {activeRecord.currentLocationType === 'onsite' ? 'On-Site Freezer' : activeRecord.currentLocationType === 'offsite' ? 'Commercial Deep Freeze' : activeRecord.removalDestination ? `Delivered to ${activeRecord.removalDestination}` : 'Historical Archive'}
                </span>
              </div>
            </div>

            {/* Location specifics */}
            {activeRecord.currentLocationType === 'offsite' && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Facility</span>
                    <span className="font-bold text-cool-gray-100 text-sm block mt-0.5">
                      {activeRecord.storageLocation?.name || activeRecord.entryRef.location || 'Commercial Facility'}
                    </span>
                  </div>
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Pallet</span>
                    <span className="font-mono font-bold text-cyan-300 text-sm block mt-0.5">
                      {activeRecord.pallet || 'Unassigned'}
                    </span>
                  </div>
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Box</span>
                    <span className="font-mono font-bold text-cool-gray-200 text-sm block mt-0.5">
                      {activeRecord.box || 'Unboxed'}
                    </span>
                  </div>
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Cold Storage Intake</span>
                    <span className="font-mono font-bold text-cyan-400 text-sm block mt-0.5">
                      {formatTraceDate(activeRecord.offSiteIntakeDate)}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-800/30 text-xs text-cyan-200/90 flex items-start gap-2">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Currently in Off-Site Storage:</strong> This item is held in sub-zero commercial blast freezer storage. It has not been moved on-site, and there is no transfer pending unless scheduled via a staging worksheet or movement order.
                  </span>
                </div>
              </div>
            )}

            {activeRecord.currentLocationType === 'onsite' && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Freezer / Cabinet</span>
                    <span className="font-bold text-cool-gray-100 text-sm block mt-0.5">
                      {activeRecord.currentFreezerName || 'On-Site Freezer'}
                    </span>
                  </div>
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Bin / Container</span>
                    <span className="font-bold text-emerald-300 text-sm block mt-0.5">
                      {activeRecord.currentContainerName || 'On-Site Storage Bin'}
                    </span>
                  </div>
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">On-Site Placement Date</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm block mt-0.5">
                      {formatTraceDate(activeRecord.onSiteArrivalDate || activeRecord.packDate, true)}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-xs text-emerald-200/90 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Actively In Stock:</strong> This item is physically placed in your on-site freezer storage and is immediately available for consumption or inventory counting.
                  </span>
                </div>
              </div>
            )}

            {activeRecord.currentLocationType === 'archived' && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">
                      {activeRecord.removalDestination ? 'Delivery Destination' : 'Custody Status'}
                    </span>
                    <span className="font-bold text-purple-300 text-sm block mt-0.5">
                      {activeRecord.removalDestination || 'Archived / Consumed'}
                    </span>
                  </div>
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Removal / Archive Date</span>
                    <span className="font-mono font-bold text-purple-300 text-sm block mt-0.5">
                      {formatTraceDate(activeRecord.archivedDate || activeRecord.onSiteArrivalDate || activeRecord.packDate, true)}
                    </span>
                  </div>
                  <div className="p-3 bg-cool-gray-900/60 rounded-xl border border-cool-gray-800">
                    <span className="text-[10px] text-cool-gray-400 block uppercase font-semibold">Disposition Type</span>
                    <span className="font-bold text-cool-gray-200 text-sm block mt-0.5">
                      {activeRecord.removalDestination ? 'Delivered & Removed' : (activeRecord.archivedReason || 'Depleted Stock')}
                    </span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-800/30 text-xs text-purple-200/90 flex items-start gap-2">
                  <FileCheck2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <span>
                    {activeRecord.removalDestination ? (
                      <><strong>Delivered to {activeRecord.removalDestination} (Removed from Inventory):</strong> This package was transferred and confirmed delivered to <strong>{activeRecord.removalDestination}</strong>. It was permanently removed from active off-site storage and is <strong>NOT</strong> located in on-site staging or freezers.</>
                    ) : (
                      <><strong>Archived Record:</strong> This cut was previously recorded and tracked, and has since been consumed, removed, or archived from active inventory.</>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: VERIFIED CUSTODY JOURNEY ("What it has gone through & when") */}
          <div className="bg-cool-gray-850 p-5 sm:p-6 rounded-2xl border border-cool-gray-750 shadow-md space-y-6">
            <div>
              <h3 className="text-sm font-bold text-cool-gray-300 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Verified Custody Journey (What it has gone through & when)
              </h3>
              <p className="text-xs text-cool-gray-400 mt-0.5">
                Linear chronological record showing each verified step this package underwent and the exact date it took place.
              </p>
            </div>

            {/* Dynamic Step Milestone Ribbon */}
            <div className="bg-cool-gray-900/90 p-3.5 rounded-xl border border-cool-gray-800 flex flex-wrap items-center gap-3 text-xs">
              {journeySteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-cool-gray-800 border border-cool-gray-700 flex items-center justify-center text-[11px] font-bold text-cool-gray-300 shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <span className="text-[10px] text-cool-gray-400 block uppercase font-bold tracking-wider truncate max-w-[130px]">
                        {step.title}
                      </span>
                      <span className="font-mono font-bold text-cool-gray-200">
                        {step.dateStr}
                      </span>
                    </div>
                  </div>
                  {idx < journeySteps.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-cool-gray-600 hidden sm:block shrink-0" />
                  )}
                </React.Fragment>
              ))}

              <ChevronRight className="w-4 h-4 text-cool-gray-600 hidden sm:block shrink-0" />

              {/* Current Destination Node */}
              <div className="flex items-center gap-2 bg-cool-gray-800/80 px-2.5 py-1.5 rounded-lg border border-cool-gray-700/70">
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${
                  activeRecord.currentLocationType === 'onsite' ? 'text-emerald-400' : activeRecord.currentLocationType === 'offsite' ? 'text-cyan-400' : 'text-purple-400'
                }`} />
                <div>
                  <span className="text-[9px] text-cool-gray-400 uppercase block font-bold">Now Residing</span>
                  <span className="font-bold text-xs text-cool-gray-100 truncate max-w-[160px] block">
                    {activeRecord.currentLocationName}
                  </span>
                </div>
              </div>
            </div>

            {/* Vertical Chronological Step List */}
            <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-cool-gray-750">
              {journeySteps.map((step, idx) => {
                const isAmber = step.colorTheme === 'amber';
                const isCyan = step.colorTheme === 'cyan';
                const isBlue = step.colorTheme === 'blue';
                const isIndigo = step.colorTheme === 'indigo';

                return (
                  <div key={step.id} className="relative">
                    {/* Step Number Circle */}
                    <div className={`absolute -left-6 sm:-left-8 top-0 w-6 sm:w-8 h-6 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                      isAmber ? 'bg-amber-500/20 border-amber-500 text-amber-300' :
                      isCyan ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' :
                      isBlue ? 'bg-blue-500/20 border-blue-500 text-blue-300' :
                      isIndigo ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' :
                      'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    }`}>
                      {idx + 1}
                    </div>

                    <div className="bg-cool-gray-900/80 p-4 sm:p-5 rounded-xl border border-cool-gray-800 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <h4 className={`text-sm font-bold flex items-center gap-2 ${
                          isAmber ? 'text-amber-300' :
                          isCyan ? 'text-cyan-300' :
                          isBlue ? 'text-blue-300' :
                          isIndigo ? 'text-indigo-300' :
                          'text-emerald-300'
                        }`}>
                          {step.title}
                        </h4>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border shadow-xs ${
                            isAmber ? 'bg-amber-950/60 text-amber-300 border-amber-800/60' :
                            isCyan ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60' :
                            isBlue ? 'bg-blue-950/60 text-blue-300 border-blue-800/60' :
                            isIndigo ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60' :
                            'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          }`}>
                            <Calendar className="w-3.5 h-3.5" />
                            Date: {step.dateStr}
                          </span>

                          {step.badge && (
                            <span className="text-[11px] px-2 py-0.5 rounded-md bg-cool-gray-800 text-cool-gray-300 font-mono font-semibold border border-cool-gray-700">
                              {step.badge}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-cool-gray-300 leading-relaxed">
                        {step.summary}
                      </p>

                      {step.details}
                    </div>
                  </div>
                );
              })}

              {/* Verified Endpoint Marker */}
              <div className="relative pt-1">
                <div className={`absolute -left-6 sm:-left-8 top-1 w-6 sm:w-8 h-6 sm:h-8 rounded-full border-2 flex items-center justify-center text-xs ${
                  activeRecord.currentLocationType === 'onsite'
                    ? 'bg-emerald-500 border-emerald-400 text-cool-gray-950 font-bold'
                    : 'bg-cyan-500 border-cyan-400 text-cool-gray-950 font-bold'
                }`}>
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <div className="bg-cool-gray-900/60 p-3.5 rounded-xl border border-cool-gray-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-cool-gray-200">Current Verified Residence:</span>
                    <span className="font-bold text-amber-400 font-mono">{activeRecord.currentLocationName}</span>
                  </div>
                  <span className="text-[11px] text-cool-gray-400">
                    Chain of custody verified up to present moment
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* On-Site Container Cohort Logs (Rendered only when active on-site and logs exist) */}
          {activeRecord.currentLocationType === 'onsite' && activeRecord.onSiteCohortLogs.length > 0 && (
            <div className="bg-cool-gray-850 p-5 sm:p-6 rounded-2xl border border-cool-gray-750 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h4 className="text-sm font-bold text-purple-300 flex items-center gap-2">
                  🔄 On-Site Container Activity Logs ({activeRecord.currentContainerName})
                </h4>
                <span className="text-[10px] px-2 py-0.5 bg-purple-500/15 text-purple-300 font-semibold rounded-md uppercase tracking-wider">
                  Associated Container Events
                </span>
              </div>

              <div className="p-2.5 bg-purple-950/30 border border-purple-800/40 rounded-lg text-[11px] text-purple-200">
                <span className="font-bold text-purple-300">Container History Notice:</span> The logs below reflect physical container relocations, restocks, and audits recorded for container &quot;{activeRecord.currentContainerName}&quot; since this item was placed in it.
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {activeRecord.onSiteCohortLogs.map(log => (
                  <div key={log.id} className="p-2.5 bg-cool-gray-850 rounded border border-cool-gray-750 text-xs flex items-center justify-between gap-3">
                    <span className="text-cool-gray-200 truncate">{log.description}</span>
                    <span className="text-[11px] text-purple-300 font-mono flex items-center gap-1.5 bg-purple-950/60 px-2.5 py-1 rounded border border-purple-800/40 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      {formatTraceDate(log.timestamp, true)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Multiple Records Cohort Overview (When searching a lot or butcher order with many packages) */
        <div className="space-y-6 animate-fade-in">
          {/* Cohort Stats Banner */}
          {cohortSummary && (
            <div className="bg-gradient-to-r from-cool-gray-850 to-cool-gray-900 p-5 rounded-2xl border border-cool-gray-750 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                    Batch / Lot Cohort Results
                  </span>
                  <h2 className="text-xl font-black text-cool-gray-100">
                    Found {cohortSummary.totalPackages} Matching Packages for &quot;{searchQuery}&quot;
                  </h2>
                  <p className="text-xs text-cool-gray-400 mt-1">
                    Cuts included: {cohortSummary.distinctCuts.slice(0, 4).join(', ')}{cohortSummary.distinctCuts.length > 4 ? ` and ${cohortSummary.distinctCuts.length - 4} more` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="bg-cool-gray-900 px-3.5 py-2 rounded-xl border border-cool-gray-750 text-right">
                    <span className="text-[10px] text-cool-gray-400 uppercase block font-semibold">Total Weight</span>
                    <span className="text-sm font-mono font-bold text-cyan-400">{cohortSummary.totalWeight} lbs</span>
                  </div>
                  <div className="bg-cool-gray-900 px-3.5 py-2 rounded-xl border border-cool-gray-750 text-right">
                    <span className="text-[10px] text-cool-gray-400 uppercase block font-semibold">Total Pieces</span>
                    <span className="text-sm font-mono font-bold text-amber-400">{cohortSummary.totalPcs} pcs</span>
                  </div>
                </div>
              </div>

              {/* Status Breakdown Filters */}
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-cool-gray-800">
                <span className="text-[10px] text-cool-gray-500 uppercase font-semibold mr-1">Filter by Status:</span>
                {[
                  { id: 'all', label: `All (${cohortSummary.totalPackages})` },
                  { id: 'offsite', label: `Off-Site Cold Storage (${cohortSummary.offsiteCount})` },
                  { id: 'onsite', label: `On-Site Freezers (${cohortSummary.onsiteCount})` },
                  { id: 'archived', label: `Archived (${cohortSummary.archivedCount})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveStatusFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      activeStatusFilter === tab.id
                        ? 'bg-amber-500 text-cool-gray-950 font-bold shadow'
                        : 'bg-cool-gray-800 text-cool-gray-300 hover:bg-cool-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Package Items Table */}
          <div className="bg-cool-gray-850 rounded-2xl border border-cool-gray-750 shadow-md overflow-hidden">
            <div className="p-4 border-b border-cool-gray-750 flex items-center justify-between">
              <h3 className="text-xs font-bold text-cool-gray-300 uppercase tracking-wider">
                Select Any Package to Inspect Full Chain-of-Custody Timeline
              </h3>
              <span className="text-xs text-cool-gray-400 font-mono">
                {filteredRecords.length} packages listed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-cool-gray-900/80 text-cool-gray-400 border-b border-cool-gray-750 font-semibold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">Serial Number</th>
                    <th className="py-3 px-4">Cut Name</th>
                    <th className="py-3 px-4">Lot #</th>
                    <th className="py-3 px-4">Pack Date</th>
                    <th className="py-3 px-4">Net Weight</th>
                    <th className="py-3 px-4">Pieces</th>
                    <th className="py-3 px-4">Current Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cool-gray-800">
                  {filteredRecords.map(record => (
                    <tr 
                      key={record.id} 
                      onClick={() => setSelectedSerial(record.serial)}
                      className="hover:bg-cool-gray-800/60 transition cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-amber-300 group-hover:text-amber-200">
                        {record.serial}
                      </td>
                      <td className="py-3 px-4 font-semibold text-cool-gray-100">
                        {record.cutName}
                        {record.isWrongLabel && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-amber-950/60 border border-amber-600/40 text-[9px] text-amber-300 rounded font-normal">
                            Corrected Label
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-cool-gray-300">
                        {record.lot || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-cyan-300 whitespace-nowrap">
                        {formatTraceDate(record.packDate)}
                      </td>
                      <td className="py-3 px-4 font-mono text-cyan-400 font-semibold">
                        {record.netWeight ? `${record.netWeight} lb` : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-cool-gray-300">
                        {record.pieces}
                      </td>
                      <td className="py-3 px-4 text-cool-gray-300 truncate max-w-[200px]">
                        {record.currentLocationName}
                      </td>
                      <td className="py-3 px-4">
                        {record.currentLocationType === 'onsite' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                            On-Site
                          </span>
                        ) : record.currentLocationType === 'offsite' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 whitespace-nowrap">
                            Off-Site
                          </span>
                        ) : record.removalDestination ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap" title={`Delivered to ${record.removalDestination}`}>
                            Delivered ({record.removalDestination})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 group-hover:translate-x-0.5 transition">
                          Trace Timeline <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Official Print Certificate Modal */}
      {isPrintModalOpen && activeRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white text-gray-900 rounded-2xl shadow-2xl p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start border-b border-gray-200 pb-4 mb-6">
              <div>
                <div className="flex items-center gap-2 text-emerald-700 font-bold uppercase tracking-wider text-xs">
                  <ShieldCheck className="w-4 h-4" /> Official Traceability & Food Safety Certificate
                </div>
                <h2 className="text-xl font-black text-gray-900 mt-1">
                  Chain of Custody Verification Report
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Generated {new Date().toLocaleString()} • Freezer Inventory Tracker
                </p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Certificate Body */}
            <div className="space-y-5 text-xs text-gray-800">
              {/* Product Header */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">Certified Cut & Specification</span>
                  <h3 className="text-lg font-black text-gray-900">{activeRecord.cutName}</h3>
                  <div className="flex gap-3 text-xs mt-1 text-gray-600 font-mono">
                    <span>SN: <strong>{activeRecord.serial}</strong></span>
                    <span>LOT: <strong>{activeRecord.lot || 'N/A'}</strong></span>
                    <span>WEIGHT: <strong>{activeRecord.netWeight ? `${activeRecord.netWeight} lbs` : '—'}</strong></span>
                  </div>
                </div>
                <div className="flex flex-col items-center bg-white p-2 rounded-lg border border-gray-200">
                  <svg ref={printBarcodeRef} className="max-w-[180px] h-14"></svg>
                </div>
              </div>

              {/* Milestones */}
              <div className="space-y-3">
                <h4 className="font-bold text-gray-900 uppercase text-[11px] tracking-wider">
                  Verified Audit Milestones & Dates
                </h4>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-700">1. Harvest & Processing</span>
                    <span className="font-mono text-emerald-800 text-[11px] font-bold">
                      {formatTraceDate(activeRecord.harvestDate || activeRecord.butcherOrder?.killDate || activeRecord.pickupDate || activeRecord.packDate)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-[11px]">
                    Batch #{activeRecord.butcherOrder?.orderNumber || activeRecord.sourceOrderId || 'Intake'} • 
                    Species: {activeRecord.butcherOrder?.species || 'Meat'} • 
                    Slaughter Date: {formatTraceDate(activeRecord.butcherOrder?.killDate || activeRecord.packDate)}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-cyan-700">2. Packaging & Verification</span>
                    <span className="font-mono text-cyan-800 text-[11px] font-bold">
                      {formatTraceDate(activeRecord.packDate)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-[11px]">
                    Pack Date: {formatTraceDate(activeRecord.packDate)} • Certified Weight: {activeRecord.netWeight ? `${activeRecord.netWeight} lbs` : '—'} • Lot: {activeRecord.lot || 'Unassigned'}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-blue-700">3. Cold Storage Intake</span>
                    <span className="font-mono text-blue-800 text-[11px] font-bold">
                      {formatTraceDate(activeRecord.offSiteIntakeDate)}
                    </span>
                  </div>
                  <p className="text-gray-600 text-[11px]">
                    Facility: {activeRecord.storageLocation?.name || 'Cold Storage'} • 
                    Pallet: {activeRecord.pallet || 'Unassigned'} • 
                    Box: {activeRecord.box || 'Unboxed'}
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-indigo-700">4. Transfer Logistics</span>
                    <span className="font-mono text-indigo-800 text-[11px] font-bold">
                      {activeRecord.movementOrders.length > 0 
                        ? formatTraceDate(activeRecord.movementOrders[activeRecord.movementOrders.length - 1].executedAt || activeRecord.movementOrders[activeRecord.movementOrders.length - 1].date, true)
                        : 'No transfers'}
                    </span>
                  </div>
                  <p className="text-gray-600 text-[11px]">
                    {activeRecord.movementOrders.length} verified movement orders executed across storage facilities.
                  </p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">5. Final Custody Placement</span>
                    <span className="font-mono text-gray-800 text-[11px] font-bold">
                      {activeRecord.currentLocationType === 'onsite' 
                        ? formatTraceDate(activeRecord.onSiteArrivalDate || activeRecord.packDate, true)
                        : 'Off-Site Residence'}
                    </span>
                  </div>
                  <p className="text-gray-600 text-[11px]">
                    Current Status: <strong>{activeRecord.currentLocationName}</strong>
                  </p>
                </div>
              </div>

              {/* Legal / Food Safety Note */}
              <div className="p-3 bg-gray-100 rounded-lg text-[10px] text-gray-500 leading-relaxed border border-gray-200">
                This certificate represents a tamper-evident audit record generated directly from the permanent inventory state. Historical movements and transactions are stored in durable system logs.
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default TraceabilityView;
