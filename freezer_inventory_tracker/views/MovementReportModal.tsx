import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Printer, X, CheckSquare, Square, Info, Layers, Download, ArrowRight, Barcode, Copy, Check, ArrowRightLeft, Scan, ChevronLeft, ChevronRight, Maximize2, List, Focus } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { InventoryState, MovementOrder, MovementItem, Product } from '../types';
import { compareBoxLabels } from '../utils/boxSort';
import { generateWeightEmbeddedUpc, generateDefaultUpcABarcode } from '../utils/barcode';

export function formatUpcDisplay(upc: string): string {
  const clean = String(upc || '').replace(/\D/g, '');
  if (clean.length === 12) {
    return `${clean[0]} ${clean.slice(1, 6)} ${clean.slice(6, 11)} ${clean[11]}`;
  }
  return upc;
}

export const ScannableBarcode: React.FC<{
  value: string;
  width?: number;
  height?: number;
  className?: string;
}> = ({ value, width = 1.25, height = 34, className = '' }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    const cleanVal = String(value).trim().replace(/[\s-]/g, '');
    if (!cleanVal) return;

    try {
      setRenderError(false);
      let format = 'CODE128';
      if (/^\d{12}$/.test(cleanVal)) {
        format = 'UPC';
      } else if (/^\d{13}$/.test(cleanVal)) {
        format = 'EAN13';
      }

      JsBarcode(svgRef.current, cleanVal, {
        format,
        width,
        height,
        displayValue: false,
        margin: 2,
        background: '#ffffff',
        lineColor: '#000000',
      });
    } catch (e) {
      console.warn('JsBarcode fallback to CODE128:', e);
      try {
        if (svgRef.current) {
          JsBarcode(svgRef.current, cleanVal, {
            format: 'CODE128',
            width,
            height,
            displayValue: false,
            margin: 2,
            background: '#ffffff',
            lineColor: '#000000',
          });
        }
      } catch {
        setRenderError(true);
      }
    }
  }, [value, width, height]);

  if (renderError || !value) {
    return <span className="font-mono text-[10px] text-gray-500 font-bold">{value}</span>;
  }

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`}>
      <svg ref={svgRef} className="max-w-full h-auto block" />
    </div>
  );
};

export const getEntryProduct = (entry: any, state?: InventoryState): Product | undefined => {
  if (!entry || !state?.products || state.products.length === 0) return undefined;

  // 1. By direct productId
  if (entry.productId) {
    const p = state.products.find((prod: any) => prod.id === entry.productId);
    if (p) return p;
  }

  // 2. By item number extracted from entry properties (cuts, product, originalCutName, originalEntryName, etc.)
  const rawText = [entry.cuts, entry.product, entry.originalCutName, entry.originalEntryName]
    .filter(Boolean)
    .join(' ');

  const numberMatches = rawText.match(/\b\d{3,6}\b/g);
  if (numberMatches) {
    for (const numStr of numberMatches) {
      const cleanNum = numStr.replace(/^0+/, '') || '0';
      const p = state.products.find((prod: any) => 
        prod.productNumbers && prod.productNumbers.some((pn: string) => {
          const cleanPn = String(pn).replace(/^0+/, '') || '0';
          return String(pn).trim() === numStr.trim() || cleanPn === cleanNum;
        })
      );
      if (p) return p;
    }
  }

  // 3. By cut / product name matching product name
  const candidateNames = [entry.product, entry.cuts, entry.originalCutName]
    .filter(name => typeof name === 'string' && name.trim() && name.trim().toLowerCase() !== 'unknown cut')
    .map(name => name.trim());

  for (const nameStr of candidateNames) {
    // Exact match
    let p = state.products.find((prod: any) => prod.name?.toLowerCase() === nameStr.toLowerCase());
    if (p) return p;

    // Match after stripping leading item numbers / punctuation, e.g. "15425 - Beef Ribeye" -> "Beef Ribeye"
    const cleanedName = nameStr.replace(/^[\d\s\-_:#\[\]]+/, '').trim();
    if (cleanedName) {
      p = state.products.find((prod: any) => prod.name?.toLowerCase() === cleanedName.toLowerCase());
      if (p) return p;
    }
  }

  // 4. Meat cut lookup by ID
  if ((entry.id || entry.entryId) && state?.meatCuts) {
    const mc = state.meatCuts.find((m: any) => m.id === (entry.id || entry.entryId));
    if (mc && mc.productId) {
      const p = state.products.find((prod: any) => prod.id === mc.productId);
      if (p) return p;
    }
  }

  return undefined;
};

export const getBoxCutSummary = (items: any[], state?: InventoryState): string => {
  if (!items || items.length === 0) return '';
  const cutCounts: Record<string, number> = {};
  items.forEach((it: any) => {
    const cutName = getEntryCutName(it, state) || 'Unknown Cut';
    const pcs = it.pieces || 1;
    cutCounts[cutName] = (cutCounts[cutName] || 0) + pcs;
  });
  return Object.entries(cutCounts)
    .map(([cutName, count]) => `${count} ${cutName}`)
    .join(', ');
};

export const getEntryCutName = (entry: any, state?: InventoryState): string => {
  if (!entry) return 'Unknown Cut';

  // 1. Direct productId lookup first for canonical name
  if (entry.productId && state?.products) {
    const p = state.products.find((prod: any) => prod.id === entry.productId);
    if (p && p.name) return p.name;
  }

  // 2. Direct product property if valid non-empty string
  if (entry.product && typeof entry.product === 'string' && entry.product.trim() && entry.product.trim().toLowerCase() !== 'unknown cut') {
    return entry.product.trim();
  }

  // 3. Direct cuts property if valid non-empty string
  if (entry.cuts && typeof entry.cuts === 'string' && entry.cuts.trim() && entry.cuts.trim().toLowerCase() !== 'unknown cut') {
    return entry.cuts.trim();
  }

  // 4. Look up originalCutName
  if (entry.originalCutName && typeof entry.originalCutName === 'string' && entry.originalCutName.trim()) {
    if (state?.products) {
      const p = state.products.find((prod: any) => 
        prod.name?.toLowerCase() === entry.originalCutName.trim().toLowerCase() ||
        (prod.productNumbers && prod.productNumbers.some((n: string) => entry.originalCutName.toLowerCase().startsWith(n.toLowerCase())))
      );
      if (p && p.name) return p.name;
    }
    return entry.originalCutName.trim();
  }

  // 5. Try matching prefix product number on entry.cuts or entry.product
  const rawStr = entry.cuts || entry.product || '';
  if (rawStr && state?.products) {
    const match = rawStr.match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
    if (match) {
      const pNum = match[1];
      const pName = match[2];
      const p = state.products.find((prod: any) => 
        (prod.productNumbers && prod.productNumbers.some((n: string) => n.toLowerCase() === pNum.toLowerCase())) ||
        prod.name?.toLowerCase() === pName.toLowerCase()
      );
      if (p && p.name) return p.name;
    }
  }

  // 6. Look up in state.meatCuts if entry.id or entry.entryId matches a meat cut
  if ((entry.id || entry.entryId) && state?.meatCuts) {
    const mc = state.meatCuts.find((m: any) => m.id === (entry.id || entry.entryId));
    if (mc && mc.productId && state?.products) {
      const p = state.products.find((prod: any) => prod.id === mc.productId);
      if (p && p.name) return p.name;
    }
  }

  return 'Unknown Cut';
};

export const getMovePalletName = (move: MovementItem, order?: MovementOrder, state?: InventoryState): string => {
  // 1. Check entry's source pallet in order.originalEntries, state.offSiteEntries, or state.containers
  const entryId = move.entryId;
  let entry: any = order?.originalEntries?.find(e => e.id === entryId) || state?.offSiteEntries?.find(e => e.id === entryId);
  
  if (entry) {
    if (entry.currentLocation && entry.currentLocation.trim()) {
      return entry.currentLocation.trim();
    }
    if (entry.pallet && entry.pallet.trim()) {
      return entry.pallet.trim();
    }
    if (entry.palletName && entry.palletName.trim()) {
      return entry.palletName.trim();
    }
    if (entry.lot && entry.lot.trim()) {
      return entry.lot.trim();
    }
  }

  // 2. Check originalCurrentLocation on move
  if (move.originalCurrentLocation && move.originalCurrentLocation.trim()) {
    return move.originalCurrentLocation.trim();
  }

  // 3. Check destination pallet on targetDestinations / destId
  const destId = move.actualLocation || move.targetLocation;
  if (destId) {
    const dest = order?.targetDestinations?.find(d => d.id === destId);
    if (dest?.palletName && dest.palletName.trim()) {
      return dest.palletName.trim();
    }
    if (destId.includes('::')) {
      const parts = destId.split('::');
      if (parts[1] && parts[1].trim()) return parts[1].trim();
    }
  }

  return 'Unassigned / Floor';
};

export interface StockTransferPair {
  key: string;
  sourceLocationId: string;
  sourceLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  moves: MovementItem[];
  itemCount: number;
  totalWeight: number;
}

interface MovementReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: MovementOrder;
  state: InventoryState;
  dispatch: (action: any) => Promise<boolean>;
}

export const MovementReportModal: React.FC<MovementReportModalProps> = ({
  isOpen,
  onClose,
  order,
  state,
  dispatch
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'delivery_slip' | 'manifest' | 'stock_transfers' | 'logistics_checklist'>('delivery_slip');
  const [checklistMode, setChecklistMode] = useState<'detailed' | 'simplified'>('detailed');
  const [selectedPairKey, setSelectedPairKey] = useState<string>('');
  // Map of selected pallets per segment pairKey: { [pairKey: string]: string[] }
  const [segmentPalletSelections, setSegmentPalletSelections] = useState<Record<string, string[]>>({});
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  
  // Barcode Scan Mode State
  const [isScanModeOpen, setIsScanModeOpen] = useState(false);
  const [scanDisplayMode, setScanDisplayMode] = useState<'focused' | 'spaced_list'>('focused');
  const [scanItemIndex, setScanItemIndex] = useState(0);
  const [scanPalletFilter, setScanPalletFilter] = useState<string>('all');
  
  // From section fields - loaded from localStorage with default fallbacks
  const [fromName, setFromName] = useState(() => localStorage.getItem("report-from-name") || "");
  const [fromAddress, setFromAddress] = useState(() => localStorage.getItem("report-from-address") || "");

  // Purchase Order & Items summary fields
  const [editablePo, setEditablePo] = useState('');
  const [editableItems, setEditableItems] = useState('');
  const [reportBottomNotes, setReportBottomNotes] = useState(() => localStorage.getItem("report-bottom-notes") || "");

  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // Document container reference for height measuring and multi-page detection
  const printableRef = React.useRef<HTMLDivElement>(null);
  const [documentHeight, setDocumentHeight] = useState<number>(0);

  const PAGE_HEIGHT_PX = 910; // Standard 8.5x11 letter page printable height at 96 DPI with 0.5in margins
  const totalPages = Math.max(1, Math.ceil(documentHeight / PAGE_HEIGHT_PX));
  const isMultiPage = totalPages > 1;

  const saveAsPdf = async () => {
    if (destinationItems.length === 0) return;
    setIsPdfGenerating(true);
    const wasDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    if (wasDark) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }

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
      const element = document.getElementById('printable-document');
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
      tempWrapper.style.color = '#000000';
      tempWrapper.style.colorScheme = 'light';
      tempWrapper.style.zIndex = '-99999';
      tempWrapper.style.margin = '0px';
      tempWrapper.style.padding = '0px';
      tempWrapper.className = 'light';

      const clone = element.cloneNode(true) as HTMLElement;
      clone.classList.remove('dark');
      clone.classList.add('light', 'printable-pdf-document');
      clone.style.backgroundColor = '#ffffff';
      clone.style.color = '#000000';
      clone.style.colorScheme = 'light';

      // Ensure all child nodes strip dark mode and enforce light color scheme
      clone.querySelectorAll('*').forEach((child) => {
        if (child instanceof HTMLElement) {
          child.classList.remove('dark');
          child.style.colorScheme = 'light';
        }
      });

      // Remove any no-print elements
      clone.querySelectorAll('.no-print').forEach(el => el.remove());

      clone.style.margin = '0px';
      clone.style.padding = '0px';
      clone.style.width = '720px';

      tempWrapper.appendChild(clone);
      document.body.appendChild(tempWrapper);

      const getPdfFilename = () => {
        if (activeReportTab === 'stock_transfers') {
          const src = activeTransferPair?.sourceLocationName || 'Source';
          const dst = activeTransferPair?.destinationLocationName || 'Dest';
          return `Stock_Transfer_${order.date || 'Date'}_${src}_to_${dst}.pdf`.replace(/\s+/g, '_');
        }
        if (activeReportTab === 'logistics_checklist') {
          return `Logistics_Checklist_${checklistMode}_${order.date || 'Order'}_${order.name || 'Movement'}.pdf`.replace(/\s+/g, '_');
        }
        return `${activeReportTab === 'delivery_slip' ? 'Delivery_Slip' : 'Manifest'}_${order.date || 'Order'}_${selectedLocation?.name || 'Report'}.pdf`.replace(/\s+/g, '_');
      };

      const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4],
        filename:     getPdfFilename(),
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
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['tr', '.page-break-avoid'] }
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
            `${fromName} • PO#${editablePo} • ${order.date}`,
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
      if (wasDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
      setIsPdfGenerating(false);
    }
  };

  const saveAllAsPdf = async () => {
    setIsPdfGenerating(true);
    const wasDark = document.documentElement.classList.contains('dark') || document.body.classList.contains('dark');
    if (wasDark) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }

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
      const element = document.getElementById('all-printable-documents');
      if (!element) {
        throw new Error('All printable element not found');
      }

      const tempWrapper = document.createElement('div');
      tempWrapper.style.position = 'fixed';
      tempWrapper.style.top = '0px';
      tempWrapper.style.left = '0px';
      tempWrapper.style.width = '720px';
      tempWrapper.style.backgroundColor = '#ffffff';
      tempWrapper.style.color = '#000000';
      tempWrapper.style.colorScheme = 'light';
      tempWrapper.style.zIndex = '-99999';
      tempWrapper.style.margin = '0px';
      tempWrapper.style.padding = '0px';
      tempWrapper.className = 'light';

      const clone = element.cloneNode(true) as HTMLElement;
      clone.classList.remove('hidden', 'dark');
      clone.classList.add('light', 'printable-pdf-document');
      clone.style.display = 'block';
      clone.style.backgroundColor = '#ffffff';
      clone.style.color = '#000000';
      clone.style.colorScheme = 'light';

      // Ensure all child nodes strip dark mode and enforce light color scheme
      clone.querySelectorAll('*').forEach((child) => {
        if (child instanceof HTMLElement) {
          child.classList.remove('dark');
          child.style.colorScheme = 'light';
        }
      });

      clone.querySelectorAll('.no-print').forEach(el => el.remove());

      clone.style.margin = '0px';
      clone.style.padding = '0px';
      clone.style.width = '720px';

      tempWrapper.appendChild(clone);
      document.body.appendChild(tempWrapper);

      const getFilename = () => {
        if (activeReportTab === 'stock_transfers') {
          return `All_Stock_Transfers_${order.date || 'Order'}.pdf`.replace(/\s+/g, '_');
        }
        if (activeReportTab === 'logistics_checklist') {
          return `Logistics_Checklist_${checklistMode}_${order.date || 'Order'}_${order.name || 'Movement'}.pdf`.replace(/\s+/g, '_');
        }
        return `All_${activeReportTab === 'delivery_slip' ? 'Delivery_Slips' : 'Manifests'}_${order.date || 'Order'}.pdf`.replace(/\s+/g, '_');
      };

      const opt = {
        margin:       [0.4, 0.4, 0.4, 0.4],
        filename:     getFilename(),
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
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['tr', '.page-break-avoid'] }
      };

      try {
        const worker = html2pdf().set(opt).from(clone);
        const pdf = await worker.toPdf().get('pdf');
        const pdfTotalPages = pdf.internal.getNumberOfPages();

        for (let i = 1; i <= pdfTotalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(100, 100, 100);
          
          pdf.text(
            `${fromName} • All Reports • ${order.date}`,
            0.4,
            10.65
          );
          
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
      console.error('Error generating combined PDF:', err);
    } finally {
      if (wasDark) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      }
      setIsPdfGenerating(false);
    }
  };

  // 1. Destinations in play for this order
  const destinationsInPlay = useMemo(() => {
    if (!order) return [];
    
    // Check targetDestinations first
    if (order.targetDestinations && order.targetDestinations.length > 0) {
      return order.targetDestinations;
    }
    
    // Fallback to extracting from moves
    const destIds = Array.from(new Set(order.moves.map(m => m.actualLocation || m.targetLocation).filter(Boolean)));
    return destIds.map(id => {
      const loc = state.locations?.find(l => l.id === id);
      return {
        id,
        locationId: id,
        locationName: loc?.name || id,
        palletName: undefined
      };
    });
  }, [order, state.locations]);

  // Grouped destinations by location name, to allow "1 delivery slip for all pallets going to Pyramid"
  const locationsInPlay = useMemo(() => {
    const map: Record<string, { locationId: string; locationName: string; destinations: typeof destinationsInPlay }> = {};
    destinationsInPlay.forEach(dest => {
      const locId = dest.locationId;
      if (!map[locId]) {
        map[locId] = {
          locationId: locId,
          locationName: dest.locationName,
          destinations: []
        };
      }
      map[locId].destinations.push(dest);
    });
    return Object.values(map);
  }, [destinationsInPlay]);

  // State to manage the selected location and the specific checked destination/pallet IDs
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedDestinationIds, setSelectedDestinationIds] = useState<string[]>([]);

  // Initialize selected location on load
  useEffect(() => {
    if (locationsInPlay.length > 0 && !selectedLocationId) {
      setSelectedLocationId(locationsInPlay[0].locationId);
    }
  }, [locationsInPlay.length, selectedLocationId]);

  // When selectedLocationId changes, select all of its pallets/destinations by default
  useEffect(() => {
    if (selectedLocationId) {
      const relatedDests = destinationsInPlay.filter(d => d.locationId === selectedLocationId);
      setSelectedDestinationIds(relatedDests.map(d => d.id));
    } else {
      setSelectedDestinationIds([]);
    }
  }, [selectedLocationId, order?.id, destinationsInPlay]);

  // Selected location reference object
  const selectedLocation = useMemo(() => {
    if (!selectedLocationId) return undefined;
    return state.locations?.find(l => l.id === selectedLocationId || l.name === selectedLocationId);
  }, [selectedLocationId, state.locations]);

  // Auto-generate PO# and default items list
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

  // Helper to extract destination pallet name
  const getDestinationPallet = (move: MovementItem) => {
    const destId = move.actualLocation || move.targetLocation;
    if (!destId) return 'Other';
    const dest = order.targetDestinations?.find(d => d.id === destId);
    if (dest && dest.palletName) {
      return dest.palletName;
    }
    if (destId.includes('::')) {
      const parts = destId.split('::');
      return parts[1] || 'Other';
    }
    return 'Other';
  };

  // Filter moves to only those going to the checked destination/pallet IDs or selected location
  const destinationMoves = useMemo(() => {
    if (!order) return [];
    if (!selectedLocationId) return order.moves || [];
    
    const relatedDests = destinationsInPlay.filter(d => d.locationId === selectedLocationId);
    const hasPalletDestinations = relatedDests.some(d => Boolean(d.palletName));

    return (order.moves || []).filter(m => {
      const destId = m.actualLocation || m.targetLocation;
      if (!destId) return false;

      const targetDest = order.targetDestinations?.find(d => d.id === destId);
      const moveLocationId = targetDest ? targetDest.locationId : (destId.includes('::') ? destId.split('::')[0] : destId);

      // Must belong to the currently selected location
      if (moveLocationId !== selectedLocationId) {
        return false;
      }

      // If there are specific pallets/destinations for this location, filter strictly by selectedDestinationIds
      if (hasPalletDestinations) {
        if (targetDest) {
          return selectedDestinationIds.includes(targetDest.id);
        }
        return selectedDestinationIds.includes(destId);
      }

      return true;
    });
  }, [order, destinationsInPlay, selectedDestinationIds, selectedLocationId]);

  // Source entries array with robust fallback
  const sourceEntries = useMemo(() => {
    if (order?.originalEntries && Array.isArray(order.originalEntries) && order.originalEntries.length > 0) {
      return order.originalEntries;
    }
    return state.offSiteEntries || [];
  }, [order?.originalEntries, state.offSiteEntries]);

  // Resolve source location ID / Name for a given move item
  const resolveSourceLocation = React.useCallback((move: MovementItem): { id: string; name: string } => {
    // 1. Check move.originalLocation
    if (move.originalLocation && move.originalLocation.trim()) {
      const trimmed = move.originalLocation.trim();
      const loc = state.locations?.find(l => l.id === trimmed || l.name?.toLowerCase() === trimmed.toLowerCase());
      return { id: loc?.id || trimmed, name: loc?.name || trimmed };
    }
    // 2. Check sourceEntries or offSiteEntries
    const entry = sourceEntries.find(e => e.id === move.entryId) || state.offSiteEntries?.find(e => e.id === move.entryId);
    if (entry?.location && entry.location.trim()) {
      const trimmed = entry.location.trim();
      const loc = state.locations?.find(l => l.id === trimmed || l.name?.toLowerCase() === trimmed.toLowerCase());
      return { id: loc?.id || trimmed, name: loc?.name || trimmed };
    }
    // 3. Check meat cuts location or fallback to order description / 'Origin'
    return { id: 'Origin', name: 'Origin' };
  }, [sourceEntries, state.locations, state.offSiteEntries]);

  // Resolve destination location ID / Name for a given move item
  const resolveDestinationLocation = React.useCallback((move: MovementItem): { id: string; name: string } => {
    const destId = move.actualLocation || move.targetLocation;
    if (!destId) return { id: 'Destination', name: 'Destination' };

    const targetDest = order.targetDestinations?.find(d => d.id === destId);
    if (targetDest) {
      return { id: targetDest.locationId, name: targetDest.locationName || targetDest.locationId };
    }
    const pureLocId = destId.includes('::') ? destId.split('::')[0] : destId;
    const loc = state.locations?.find(l => l.id === pureLocId || l.name === pureLocId);
    return { id: pureLocId, name: loc?.name || pureLocId };
  }, [order.targetDestinations, state.locations]);

  // Segment all moves into unique Source ➔ Destination transfer pairs for Stock Transfer reporting
  const stockTransferPairs = useMemo<StockTransferPair[]>(() => {
    if (!order || !order.moves || order.moves.length === 0) return [];

    const map = new Map<string, StockTransferPair>();

    order.moves.forEach(m => {
      const source = resolveSourceLocation(m);
      const dest = resolveDestinationLocation(m);
      const pairKey = `${source.id}==>${dest.id}`;

      if (!map.has(pairKey)) {
        map.set(pairKey, {
          key: pairKey,
          sourceLocationId: source.id,
          sourceLocationName: source.name,
          destinationLocationId: dest.id,
          destinationLocationName: dest.name,
          moves: [],
          itemCount: 0,
          totalWeight: 0
        });
      }

      const pair = map.get(pairKey)!;
      pair.moves.push(m);
      pair.itemCount += 1;

      const entry = sourceEntries.find(e => e.id === m.entryId) || state.offSiteEntries?.find(e => e.id === m.entryId);
      pair.totalWeight += entry?.netWeight || 0;
    });

    return Array.from(map.values()).sort((a, b) => {
      const srcCmp = a.sourceLocationName.localeCompare(b.sourceLocationName);
      if (srcCmp !== 0) return srcCmp;
      return a.destinationLocationName.localeCompare(b.destinationLocationName);
    });
  }, [order, resolveSourceLocation, resolveDestinationLocation, sourceEntries, state.offSiteEntries]);

  // Map moves to entries with fail-safe entry construction
  const destinationItems = useMemo(() => {
    if (!order) return [];
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

  // Helper for Save All in Delivery Slips and Manifests
  const allLocationsList = useMemo(() => {
    if (locationsInPlay.length > 0) return locationsInPlay;
    return [{
      locationId: selectedLocationId || 'default',
      locationName: selectedLocation?.name || 'Destination',
      destinations: []
    }];
  }, [locationsInPlay, selectedLocationId, selectedLocation]);

  const getItemsForLocation = React.useCallback((locId: string) => {
    const moves = (order?.moves || []).filter(m => {
      const destId = m.actualLocation || m.targetLocation;
      if (!destId) return false;
      const targetDest = order.targetDestinations?.find(d => d.id === destId);
      const moveLocationId = targetDest ? targetDest.locationId : (destId.includes('::') ? destId.split('::')[0] : destId);
      return moveLocationId === locId;
    });

    return moves.map(m => {
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
      return { move: m, entry };
    });
  }, [order?.moves, order?.targetDestinations, sourceEntries, state.offSiteEntries, state.meatCuts, state.products]);

  // --- LOGISTICS TRANSFER CHECKLIST COMPUTATIONS ---
  const movesMap = useMemo(() => {
    const map = new Map<string, string>();
    if (order && order.moves) {
      order.moves.forEach((m: any) => {
        map.set(m.entryId, m.targetLocation || m.actualLocation || '');
      });
    }
    return map;
  }, [order]);

  const execBoxes = useMemo(() => {
    if (!order) return [];
    const boxGroups = new Map<string, any>();
    
    sourceEntries.forEach((e: any) => {
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

      const destKey = targetDestId || 'unassigned';
      let existingDest = group.destinations.find((d: any) => d.locationId === destKey);
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
  }, [sourceEntries, movesMap, order]);

  const deliverBoxes = useMemo(() => {
    if (!order) return [];
    const boxGroups = new Map<string, any>();
    const destinationCounts = new Map<string, Set<string>>();
    const boxDestinations = new Map<string, Array<{
      locationId: string;
      locationName: string;
      palletName?: string;
      itemCount: number;
      weight: number;
    }>>();
    
    sourceEntries.forEach((e: any) => {
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

    sourceEntries.forEach((e: any) => {
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
  }, [sourceEntries, movesMap, order]);

  const pickGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    execBoxes.forEach(b => {
      if (!groups[b.sourcePallet]) groups[b.sourcePallet] = [];
      groups[b.sourcePallet].push(b);
    });
    return Object.entries(groups);
  }, [execBoxes]);

  const deliverGroups = useMemo(() => {
    const groups: Record<string, { label: string, boxes: any[] }> = {};
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

  const pickedBoxIds = order?.pickedBoxIds || [];
  const deliveredBoxIds = order?.deliveredBoxIds || [];
  const pickedItemIds = order?.pickedItemIds || [];
  const deliveredItemIds = order?.deliveredItemIds || [];

  const totalPickedBoxes = useMemo(() => {
    return execBoxes.filter(b => pickedBoxIds.includes(b.id) || b.items.every((it: any) => pickedItemIds.includes(it.id))).length;
  }, [execBoxes, pickedBoxIds, pickedItemIds]);

  const totalDeliveredBoxes = useMemo(() => {
    return deliverBoxes.filter(b => deliveredBoxIds.includes(b.id) || b.items.every((it: any) => deliveredItemIds.includes(it.id))).length;
  }, [deliverBoxes, deliveredBoxIds, deliveredItemIds]);

  const getBoxSplitSummary = (boxLabel: string, sourcePallet: string, destinations: any[]) => {
    const allBoxItems = sourceEntries.filter((e: any) => {
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
        const cutName = getEntryCutName(it, state) || 'Unknown';
        cutGroup[cutName] = (cutGroup[cutName] || 0) + (it.pieces || 1);
      });

      const cutString = Object.entries(cutGroup)
        .map(([cutName, pcs]) => `${pcs} ${cutName}`)
        .join(', ');

      return `${cutString} to ${d.locationName}${d.palletName ? ` (${d.palletName})` : ''}`;
    }).join(', ');
  };

  // Current active segment/location key for isolation
  const activeReportScopeKey = useMemo(() => {
    if (activeReportTab === 'stock_transfers') {
      return selectedPairKey ? `segment:${selectedPairKey}` : (stockTransferPairs[0]?.key ? `segment:${stockTransferPairs[0].key}` : 'segment:none');
    }
    if (activeReportTab === 'logistics_checklist') {
      return 'checklist:global';
    }
    return selectedLocationId ? `loc:${selectedLocationId}` : 'loc:none';
  }, [activeReportTab, selectedPairKey, stockTransferPairs, selectedLocationId]);

  // Track loaded order+scope key to prevent background state refreshes from overwriting active user typing
  const loadedKeyRef = React.useRef<string>('');

  // Function to flush local report fields to parent order state
  const syncToOrderState = React.useCallback((poVal: string, itemsVal: string, notesVal: string) => {
    if (!order || !activeReportScopeKey || activeReportScopeKey.endsWith(':none')) return;
    const currentPo = order.flags?.[`report_po:${activeReportScopeKey}`];
    const currentItems = order.flags?.[`report_items:${activeReportScopeKey}`];
    const currentNotes = order.flags?.[`report_notes:${activeReportScopeKey}`];

    if (poVal !== currentPo || itemsVal !== currentItems || notesVal !== currentNotes) {
      dispatch({
        type: 'UPDATE_MOVEMENT_ORDER',
        payload: {
          id: order.id,
          updates: {
            flags: {
              ...(order.flags || {}),
              [`report_po:${activeReportScopeKey}`]: poVal,
              [`report_items:${activeReportScopeKey}`]: itemsVal,
              [`report_notes:${activeReportScopeKey}`]: notesVal
            }
          }
        }
      });
    }
  }, [order, activeReportScopeKey, dispatch]);

  // Initialize PO#, Items, and Bottom Notes ONLY when order, tab, or scope key changes
  useEffect(() => {
    if (order && activeReportScopeKey && !activeReportScopeKey.endsWith(':none')) {
      const currentKey = `${order.id}::${activeReportScopeKey}`;
      if (loadedKeyRef.current !== currentKey) {
        loadedKeyRef.current = currentKey;

        const savedPo = order.flags?.[`report_po:${activeReportScopeKey}`];
        const savedItems = order.flags?.[`report_items:${activeReportScopeKey}`];
        const savedBottomNotes = order.flags?.[`report_notes:${activeReportScopeKey}`];

        if (savedPo !== undefined) {
          setEditablePo(savedPo);
        } else {
          setEditablePo(getAutoPoNumber(order.date));
        }

        if (savedItems !== undefined) {
          setEditableItems(savedItems);
        } else {
          if (activeReportTab === 'stock_transfers') {
            const pair = stockTransferPairs.find(p => p.key === selectedPairKey) || stockTransferPairs[0];
            const pairEntries = (pair?.moves || []).map(m => sourceEntries.find(e => e.id === m.entryId) || state.offSiteEntries?.find(e => e.id === m.entryId)).filter(Boolean);
            const uniqueCuts = Array.from(new Set(pairEntries.map(e => getEntryCutName(e, state)).filter(Boolean)));
            setEditableItems(uniqueCuts.join(', ') || order.description || 'Stock Transfer');
          } else if (activeReportTab === 'logistics_checklist') {
            setEditableItems(`Checklist: ${execBoxes.length} Boxes (${totalPickedBoxes} Picked, ${totalDeliveredBoxes} Delivered)`);
          } else {
            const uniqueCuts = Array.from(new Set(destinationItems.map(item => getEntryCutName(item.entry, state)).filter(Boolean)));
            setEditableItems(uniqueCuts.join(', ') || order.description || 'MIXED');
          }
        }

        if (savedBottomNotes !== undefined) {
          setReportBottomNotes(savedBottomNotes);
        } else {
          setReportBottomNotes(localStorage.getItem("report-bottom-notes") || "");
        }
      }
    }
  }, [order?.id, activeReportScopeKey, activeReportTab, selectedPairKey, stockTransferPairs, destinationItems, sourceEntries, state]);

  // Debounced save for report fields
  useEffect(() => {
    if (!order || !activeReportScopeKey || activeReportScopeKey.endsWith(':none')) return;
    
    const timeoutId = setTimeout(() => {
      syncToOrderState(editablePo, editableItems, reportBottomNotes);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [editablePo, editableItems, reportBottomNotes, order?.id, activeReportScopeKey, syncToOrderState]);

  // Document container resize observer to measure printable height and calculate total pages
  useEffect(() => {
    if (printableRef.current) {
      const observer = new ResizeObserver(() => {
        if (printableRef.current) {
          setDocumentHeight(printableRef.current.scrollHeight);
        }
      });
      observer.observe(printableRef.current);
      return () => observer.disconnect();
    }
  }, [destinationItems, activeReportTab, editablePo, editableItems, reportBottomNotes, selectedLocationId]);

  // Group by destination pallet name (Lot#) for the summary table
  const palletGroups = useMemo<{ [palletName: string]: { boxCount: number; weight: number; items: any[] } }>(() => {
    const groups: { [palletName: string]: { boxCount: number; weight: number; items: any[] } } = {};
    const palletUniqueBoxes = new Map<string, Set<string>>();
    
    destinationItems.forEach(item => {
      const palletName = getDestinationPallet(item.move);
      if (!groups[palletName]) {
        groups[palletName] = { boxCount: 0, weight: 0, items: [] };
      }
      if (!palletUniqueBoxes.has(palletName)) {
        palletUniqueBoxes.set(palletName, new Set());
      }
      const boxId = item.entry?.box || item.entry?.serial || item.entry?.id || 'N/A';
      palletUniqueBoxes.get(palletName)!.add(boxId);

      groups[palletName].weight += item.entry?.netWeight || 0;
      groups[palletName].items.push(item);
    });

    for (const palletName of Object.keys(groups)) {
      groups[palletName].boxCount = palletUniqueBoxes.get(palletName)?.size || 0;
    }
    
    return groups;
  }, [destinationItems, order?.targetDestinations]);

  // Group by cut for the manifest
  const manifestGroups = useMemo<{ [cutName: string]: { boxCount: number; weight: number; pieces: number; serials: string[] } }>(() => {
    const groups: { [cutName: string]: { boxCount: number; weight: number; pieces: number; serials: string[] } } = {};
    const groupUniqueBoxes = new Map<string, Set<string>>();
    
    destinationItems.forEach(item => {
      const cutName = getEntryCutName(item.entry, state);
      if (!groups[cutName]) {
        groups[cutName] = { boxCount: 0, weight: 0, pieces: 0, serials: [] };
      }
      if (!groupUniqueBoxes.has(cutName)) {
        groupUniqueBoxes.set(cutName, new Set());
      }
      const boxId = item.entry?.box || item.entry?.serial || item.entry?.id || 'N/A';
      groupUniqueBoxes.get(cutName)!.add(boxId);

      groups[cutName].weight += item.entry?.netWeight || 0;
      groups[cutName].pieces += item.entry?.pieces || 1;
      if (item.entry?.box) groups[cutName].serials.push(item.entry.box);
    });

    for (const cutName of Object.keys(groups)) {
      groups[cutName].boxCount = groupUniqueBoxes.get(cutName)?.size || 0;
      groups[cutName].serials = Array.from(new Set(groups[cutName].serials));
    }
    
    return groups;
  }, [destinationItems, state]);

  const totalBoxes = useMemo(() => {
    const uniqueBoxes = new Set<string>();
    destinationItems.forEach(item => {
      const palletName = getDestinationPallet(item.move);
      const boxId = `${palletName}::${item.entry?.box || item.entry?.serial || item.entry?.id || 'N/A'}`;
      uniqueBoxes.add(boxId);
    });
    return uniqueBoxes.size;
  }, [destinationItems, order?.targetDestinations]);

  const totalWeight = destinationItems.reduce((sum, item) => sum + (item.entry?.netWeight || 0), 0);

  const sortedDestinationBoxes = useMemo(() => {
    const boxGroups = new Map<string, { palletName: string; boxLabel: string; weight: number; items: any[] }>();

    destinationItems.forEach(item => {
      const palletName = getDestinationPallet(item.move);
      const boxLabel = item.entry?.box || item.entry?.serial || 'N/A';
      const key = `${palletName}::${boxLabel}`;

      if (!boxGroups.has(key)) {
        boxGroups.set(key, {
          palletName,
          boxLabel,
          weight: 0,
          items: []
        });
      }

      const grp = boxGroups.get(key)!;
      grp.weight += item.entry?.netWeight || 0;
      grp.items.push(item);
    });

    return Array.from(boxGroups.values()).sort((a, b) => {
      const palletCompare = a.palletName.localeCompare(b.palletName, undefined, { numeric: true, sensitivity: 'base' });
      if (palletCompare !== 0) return palletCompare;
      return compareBoxLabels(a.boxLabel, b.boxLabel);
    });
  }, [destinationItems, order?.targetDestinations]);

  // Initialize selectedPairKey when transfer pairs change
  useEffect(() => {
    if (stockTransferPairs.length > 0) {
      if (!selectedPairKey || !stockTransferPairs.some(p => p.key === selectedPairKey)) {
        setSelectedPairKey(stockTransferPairs[0].key);
      }
    } else {
      setSelectedPairKey('');
    }
  }, [stockTransferPairs, selectedPairKey]);

  // Current active transfer pair
  const activeTransferPair = useMemo(() => {
    if (!selectedPairKey) return stockTransferPairs[0] || null;
    return stockTransferPairs.find(p => p.key === selectedPairKey) || stockTransferPairs[0] || null;
  }, [stockTransferPairs, selectedPairKey]);

  // Pallet statistics specifically for the selected segment
  const segmentPalletStats = useMemo(() => {
    if (!activeTransferPair) return [];
    const map = new Map<string, { palletName: string; count: number; weight: number }>();

    activeTransferPair.moves.forEach(m => {
      const pName = getMovePalletName(m, order, state);
      if (!map.has(pName)) {
        map.set(pName, { palletName: pName, count: 0, weight: 0 });
      }
      const st = map.get(pName)!;
      st.count += 1;
      const entry = sourceEntries.find(e => e.id === m.entryId) || state.offSiteEntries?.find(e => e.id === m.entryId);
      st.weight += entry?.netWeight || 0;
    });

    return Array.from(map.values()).sort((a, b) => 
      a.palletName.localeCompare(b.palletName, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [activeTransferPair, order, state, sourceEntries]);

  // Current segment selected pallets list
  const currentSegmentSelectedPallets = useMemo(() => {
    if (!activeTransferPair) return [];
    const key = activeTransferPair.key;
    if (segmentPalletSelections[key] !== undefined) {
      return segmentPalletSelections[key];
    }
    // Default to selecting all pallets for this segment if not yet explicitly modified
    return segmentPalletStats.map(p => p.palletName);
  }, [activeTransferPair, segmentPalletSelections, segmentPalletStats]);

  // Handler to toggle or select pallets for the current segment
  const handleSetCurrentSegmentPallets = (pallets: string[]) => {
    if (!activeTransferPair) return;
    const key = activeTransferPair.key;
    setSegmentPalletSelections(prev => ({
      ...prev,
      [key]: pallets
    }));
  };

  // Reusable helper to compute pallet groups for any transfer segment pair
  const computePalletGroupsForSegment = React.useCallback((pair: StockTransferPair, selectedPallets: string[] = []) => {
    const filteredMoves = pair.moves.filter(m => {
      const pName = getMovePalletName(m, order, state);
      return selectedPallets.length === 0 || selectedPallets.includes(pName);
    });

    const items = filteredMoves.map(m => {
      let entry = sourceEntries.find(e => e.id === m.entryId) || state.offSiteEntries?.find(e => e.id === m.entryId);
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
      return { move: m, entry };
    });

    const palletMap = new Map<string, {
      palletName: string;
      items: typeof items;
      cuts: {
        cutName: string;
        product?: Product;
        productNumber: string;
        baseBarcode: string;
        weightEmbeddedBarcode: string;
        hasValidBarcode: boolean;
        boxCount: number;
        pieces: number;
        weight: number;
        serials: string[];
      }[];
      totalBoxes: number;
      totalPieces: number;
      totalWeight: number;
    }>();

    items.forEach(item => {
      const pName = getMovePalletName(item.move, order, state);
      if (!palletMap.has(pName)) {
        palletMap.set(pName, {
          palletName: pName,
          items: [],
          cuts: [],
          totalBoxes: 0,
          totalPieces: 0,
          totalWeight: 0
        });
      }
      palletMap.get(pName)!.items.push(item);
    });

    for (const [pName, grp] of palletMap.entries()) {
      const cutMap: { [key: string]: any } = {};
      const groupUniqueBoxes = new Map<string, Set<string>>();

      grp.items.forEach(item => {
        const rawCutName = getEntryCutName(item.entry, state);
        const product = getEntryProduct(item.entry, state);

        const displayName = product?.name || rawCutName;

        let prodNum = '';
        if (product?.productNumbers && product.productNumbers.length > 0) {
          prodNum = String(product.productNumbers[0]);
        } else {
          const textSources = [rawCutName, item.entry?.cuts, item.entry?.product, item.entry?.originalCutName];
          for (const txt of textSources) {
            if (!txt) continue;
            const match = String(txt).match(/^(\d+[a-zA-Z0-9-]*)\s+/);
            if (match) {
              prodNum = match[1];
              break;
            }
          }
          if (!prodNum && product?.barcode && /^\d{12}$/.test(product.barcode) && product.barcode.startsWith('2')) {
            prodNum = product.barcode.substring(1, 6).replace(/^0+/, '') || '0';
          }
          if (!prodNum && item.entry?.productId) {
            prodNum = String(item.entry.productId);
          }
        }

        const mapKey = product?.id ? `prod_${product.id}` : displayName.toLowerCase().trim();

        if (!cutMap[mapKey]) {
          const baseBc = product?.barcode ? String(product.barcode).trim() : '';

          cutMap[mapKey] = {
            mapKey,
            cutName: displayName,
            product,
            productNumber: prodNum,
            baseBarcode: baseBc,
            weightEmbeddedBarcode: '',
            hasValidBarcode: false,
            boxCount: 0,
            pieces: 0,
            weight: 0,
            serials: []
          };
        } else {
          if (!cutMap[mapKey].product && product) {
            cutMap[mapKey].product = product;
          }
          if ((!cutMap[mapKey].productNumber || cutMap[mapKey].productNumber === '') && prodNum) {
            cutMap[mapKey].productNumber = prodNum;
          }
          if (product?.name && cutMap[mapKey].cutName !== product.name) {
            cutMap[mapKey].cutName = product.name;
          }
          if (product?.barcode && !cutMap[mapKey].baseBarcode) {
            cutMap[mapKey].baseBarcode = String(product.barcode).trim();
          }
        }

        if (!groupUniqueBoxes.has(mapKey)) {
          groupUniqueBoxes.set(mapKey, new Set());
        }
        const boxId = item.entry?.box || item.entry?.serial || item.entry?.id || 'N/A';
        groupUniqueBoxes.get(mapKey)!.add(boxId);

        cutMap[mapKey].weight += item.entry?.netWeight || 0;
        cutMap[mapKey].pieces += item.entry?.pieces || 1;
        if (item.entry?.box) cutMap[mapKey].serials.push(item.entry.box);
      });

      const cutsList = Object.values(cutMap).map((c: any) => {
        c.boxCount = groupUniqueBoxes.get(c.mapKey)?.size || 0;
        c.serials = Array.from(new Set(c.serials));

        // Use the product's base barcode as primary source.
        // If missing or unassigned, weightEmbeddedBarcode will be empty and user will be alerted to configure it.
        const baseBc = c.product?.barcode || c.baseBarcode || '';
        const weightBc = baseBc ? generateWeightEmbeddedUpc(baseBc, c.weight) : '';
        c.baseBarcode = baseBc;
        c.weightEmbeddedBarcode = weightBc;
        c.hasValidBarcode = Boolean(weightBc && weightBc.length === 12);
        return c;
      }).sort((a: any, b: any) => a.cutName.localeCompare(b.cutName));

      grp.cuts = cutsList;

      const uniquePalletBoxes = new Set<string>();
      grp.items.forEach(it => {
        uniquePalletBoxes.add(it.entry?.box || it.entry?.serial || it.entry?.id || 'N/A');
      });
      grp.totalBoxes = uniquePalletBoxes.size;
      grp.totalPieces = cutsList.reduce((sum: number, c: any) => sum + c.pieces, 0);
      grp.totalWeight = cutsList.reduce((sum: number, c: any) => sum + c.weight, 0);
    }

    return Array.from(palletMap.values()).sort((a, b) => 
      a.palletName.localeCompare(b.palletName, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [order, state, sourceEntries]);

  // Group active pair items by Pallet with weight-embedded barcodes per pallet group
  const activePairPalletGroups = useMemo(() => {
    if (!activeTransferPair) return [];
    return computePalletGroupsForSegment(activeTransferPair, currentSegmentSelectedPallets);
  }, [activeTransferPair, currentSegmentSelectedPallets, computePalletGroupsForSegment]);

  // Track any cuts missing assigned base barcodes across the active transfer segment
  const missingBarcodeCuts = useMemo(() => {
    const list: { cutName: string; productNumber?: string }[] = [];
    const seen = new Set<string>();
    activePairPalletGroups.forEach(grp => {
      grp.cuts.forEach(c => {
        if (!c.hasValidBarcode && !seen.has(c.cutName)) {
          seen.add(c.cutName);
          list.push({ cutName: c.cutName, productNumber: c.productNumber });
        }
      });
    });
    return list;
  }, [activePairPalletGroups]);

  // Overall totals across all filtered pallets in the active segment
  const activeSegmentTotals = useMemo(() => {
    return activePairPalletGroups.reduce((acc, grp) => {
      acc.boxes += grp.totalBoxes;
      acc.pieces += grp.totalPieces;
      acc.weight += grp.totalWeight;
      return acc;
    }, { boxes: 0, pieces: 0, weight: 0 });
  }, [activePairPalletGroups]);

  // Flatten cuts from activePairPalletGroups for Scan Mode
  const flatScannableCuts = useMemo(() => {
    const items: Array<{
      palletName: string;
      cutName: string;
      productNumber: string;
      baseBarcode: string;
      weightEmbeddedBarcode: string;
      hasValidBarcode: boolean;
      boxCount: number;
      pieces: number;
      weight: number;
      serials: string[];
    }> = [];

    activePairPalletGroups.forEach(grp => {
      grp.cuts.forEach((cut: any) => {
        items.push({
          palletName: grp.palletName,
          cutName: cut.cutName,
          productNumber: cut.productNumber,
          baseBarcode: cut.baseBarcode,
          weightEmbeddedBarcode: cut.weightEmbeddedBarcode,
          hasValidBarcode: cut.hasValidBarcode,
          boxCount: cut.boxCount,
          pieces: cut.pieces,
          weight: cut.weight,
          serials: cut.serials || []
        });
      });
    });

    return items;
  }, [activePairPalletGroups]);

  const filteredScanCuts = useMemo(() => {
    if (scanPalletFilter === 'all') return flatScannableCuts;
    return flatScannableCuts.filter(c => c.palletName === scanPalletFilter);
  }, [flatScannableCuts, scanPalletFilter]);

  // Keep scanItemIndex within valid bounds
  useEffect(() => {
    if (scanItemIndex >= filteredScanCuts.length && filteredScanCuts.length > 0) {
      setScanItemIndex(filteredScanCuts.length - 1);
    }
  }, [filteredScanCuts.length, scanItemIndex]);

  // Keyboard navigation for Focused Scan Mode (ArrowLeft, ArrowRight, Escape)
  useEffect(() => {
    if (!isScanModeOpen || scanDisplayMode !== 'focused' || filteredScanCuts.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setScanItemIndex(prev => (prev > 0 ? prev - 1 : filteredScanCuts.length - 1));
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        setScanItemIndex(prev => (prev < filteredScanCuts.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'Escape') {
        setIsScanModeOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isScanModeOpen, scanDisplayMode, filteredScanCuts.length]);

  // Copy helper with visual checkmark feedback
  const handleCopyBarcode = (barcodeStr: string) => {
    navigator.clipboard.writeText(barcodeStr);
    setCopiedBarcode(barcodeStr);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div id="movement-report-modal" className="fixed inset-0 z-[200] bg-cool-gray-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto no-print animate-fade-in">
      <div className="bg-cool-gray-850 rounded-2xl border border-cool-gray-700/80 w-full max-w-6xl shadow-2xl flex flex-col md:flex-row h-[90vh] overflow-hidden">
        
        {/* Sidebar Controls */}
        <div className="w-full md:w-80 bg-cool-gray-900 p-6 border-r border-cool-gray-700/60 flex flex-col justify-between shrink-0 overflow-y-auto custom-scrollbar">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Printer className="text-blue-400" size={20} />
                Report Center
              </h3>
              <p className="text-xs text-cool-gray-400 mt-1">Configure and preview print-ready documents.</p>
            </div>

            <div className="space-y-4">
              {/* Report Template Tab Selector */}
              <div>
                <label className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-2">Report Template</label>
                <div className="grid grid-cols-4 gap-1 bg-cool-gray-800 p-1 rounded-xl">
                  <button
                    onClick={() => setActiveReportTab('delivery_slip')}
                    className={`py-2 px-0.5 text-[10.5px] font-bold rounded-lg transition-all text-center truncate ${
                      activeReportTab === 'delivery_slip'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                  >
                    Delivery Slip
                  </button>
                  <button
                    onClick={() => setActiveReportTab('manifest')}
                    className={`py-2 px-0.5 text-[10.5px] font-bold rounded-lg transition-all text-center truncate ${
                      activeReportTab === 'manifest'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                  >
                    Manifest
                  </button>
                  <button
                    onClick={() => setActiveReportTab('stock_transfers')}
                    className={`py-2 px-0.5 text-[10.5px] font-bold rounded-lg transition-all text-center truncate flex items-center justify-center gap-1 ${
                      activeReportTab === 'stock_transfers'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                    title="Segmented Stock Transfer Manifests with Scannable Weight-Embedded Barcodes"
                  >
                    <ArrowRightLeft size={11} />
                    Transfers
                  </button>
                  <button
                    onClick={() => setActiveReportTab('logistics_checklist')}
                    className={`py-2 px-0.5 text-[10.5px] font-bold rounded-lg transition-all text-center truncate flex items-center justify-center gap-1 ${
                      activeReportTab === 'logistics_checklist'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                    title="Logistics Transfer Execution Checklist (Phase 1 Pick Up & Phase 2 Deliver)"
                  >
                    <CheckSquare size={11} />
                    Checklist
                  </button>
                </div>
              </div>

              {/* Stock Transfer Segment Selector (Active when in stock_transfers mode) */}
              {activeReportTab === 'stock_transfers' && (
                <div className="space-y-3 bg-cool-gray-800/80 border border-emerald-500/30 p-3 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRight size={12} />
                      Transfer Segment ({stockTransferPairs.length})
                    </label>
                    <span className="text-[10px] font-mono font-bold text-cool-gray-400">
                      Manifest
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {stockTransferPairs.map((pair) => {
                      const isSelected = selectedPairKey === pair.key;
                      return (
                        <button
                          key={pair.key}
                          onClick={() => setSelectedPairKey(pair.key)}
                          className={`w-full text-left p-2 rounded-lg border transition-all text-xs flex flex-col gap-1 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-950/60 border-emerald-500/60 text-white shadow-sm'
                              : 'bg-cool-gray-850/60 border-cool-gray-700/60 text-cool-gray-300 hover:bg-cool-gray-750 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-emerald-300 truncate max-w-[110px]">{pair.sourceLocationName}</span>
                            <ArrowRight size={11} className="text-cool-gray-500 shrink-0 mx-1" />
                            <span className="text-cyan-300 truncate max-w-[110px] text-right">{pair.destinationLocationName}</span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-cool-gray-400">
                            <span>{pair.itemCount} item{pair.itemCount !== 1 ? 's' : ''}</span>
                            <span className="font-mono font-semibold text-emerald-400">{pair.totalWeight.toFixed(2)} lbs</span>
                          </div>
                        </button>
                      );
                    })}
                    {stockTransferPairs.length === 0 && (
                      <p className="text-xs text-cool-gray-500 italic p-2 text-center">No transfer segments detected in this order.</p>
                    )}
                  </div>

                  {/* Stock Transfer Pallet Multi-Select for Active Segment */}
                  {segmentPalletStats.length > 0 && (
                    <div className="border-t border-cool-gray-700/60 pt-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                          <Layers size={11} />
                          Segment Pallets ({segmentPalletStats.length})
                        </label>
                        {(() => {
                          const allSelected = segmentPalletStats.length > 0 && segmentPalletStats.every(p => currentSegmentSelectedPallets.includes(p.palletName));
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (allSelected) {
                                  handleSetCurrentSegmentPallets([]);
                                } else {
                                  handleSetCurrentSegmentPallets(segmentPalletStats.map(p => p.palletName));
                                }
                              }}
                              className="text-[9px] text-emerald-400 hover:underline font-bold cursor-pointer"
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          );
                        })()}
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar bg-cool-gray-900/60 p-2 rounded-lg border border-cool-gray-700/50">
                        {segmentPalletStats.map((pal) => {
                          const isChecked = currentSegmentSelectedPallets.includes(pal.palletName);
                          return (
                            <div
                              key={pal.palletName}
                              onClick={() => {
                                if (isChecked) {
                                  handleSetCurrentSegmentPallets(currentSegmentSelectedPallets.filter(p => p !== pal.palletName));
                                } else {
                                  handleSetCurrentSegmentPallets([...currentSegmentSelectedPallets, pal.palletName]);
                                }
                              }}
                              className="flex items-center justify-between gap-2 cursor-pointer py-0.5 hover:text-white text-cool-gray-300 text-xs select-none"
                            >
                              <div className="flex items-center gap-1.5 truncate">
                                {isChecked ? (
                                  <CheckSquare size={13} className="text-emerald-400 shrink-0" />
                                ) : (
                                  <Square size={13} className="text-cool-gray-500 shrink-0" />
                                )}
                                <span className="font-mono text-[11px] font-semibold truncate">
                                  {pal.palletName}
                                </span>
                              </div>
                              <span className="text-[9.5px] font-mono text-cool-gray-400 shrink-0">
                                {pal.count} bx • {pal.weight.toFixed(1)} lb
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Barcode Scan Mode Launcher */}
                  <div className="border-t border-cool-gray-700/60 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setScanItemIndex(0);
                        setIsScanModeOpen(true);
                      }}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer border border-emerald-400/30 active:scale-95"
                    >
                      <Scan size={15} />
                      <span>Launch Barcode Scan Mode</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Logistics Transfer Checklist Sidebar Summary */}
              {activeReportTab === 'logistics_checklist' && (
                <div className="space-y-3 bg-cool-gray-800/80 border border-purple-500/30 p-3 rounded-xl">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckSquare size={12} />
                      Logistics Checklist
                    </label>
                    <span className="text-[10px] font-mono font-bold text-cool-gray-400">
                      Execution
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-1.5">Format & Detail Level</label>
                    <div className="grid grid-cols-2 gap-1.5 bg-cool-gray-900/80 p-1 rounded-xl border border-cool-gray-700/60">
                      <button
                        onClick={() => setChecklistMode('detailed')}
                        className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all text-center truncate ${
                          checklistMode === 'detailed'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-cool-gray-400 hover:text-white'
                        }`}
                        title="Summarizes cut quantities per box (e.g. 40 Ground Pork, 10 Bacon) with weights and pieces"
                      >
                        Detailed Cuts
                      </button>
                      <button
                        onClick={() => setChecklistMode('simplified')}
                        className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all text-center truncate ${
                          checklistMode === 'simplified'
                            ? 'bg-purple-600 text-white shadow-md'
                            : 'text-cool-gray-400 hover:text-white'
                        }`}
                        title="Minimal box checklist for rapid scanning (Box Labels & Locations only)"
                      >
                        Simplified
                      </button>
                    </div>
                  </div>
                  
                  <div className="text-xs text-cool-gray-300 space-y-2 bg-cool-gray-900/60 p-2.5 rounded-lg border border-cool-gray-700/50">
                    <div className="flex justify-between items-center">
                      <span className="text-cool-gray-400 font-medium">Order Name:</span>
                      <strong className="text-white font-mono text-[11px] truncate max-w-[150px]">{order.name || "Meat Relocation Transfer"}</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-cool-gray-400 font-medium">Order Date:</span>
                      <strong className="text-white font-mono text-[11px]">{order.date}</strong>
                    </div>
                    <div className="flex justify-between items-center border-t border-cool-gray-800 pt-1.5">
                      <span className="text-amber-400 font-bold">Phase 1 (Pick Up):</span>
                      <strong className="text-amber-300 font-mono text-[11px]">{totalPickedBoxes} / {execBoxes.length} Boxes</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-emerald-400 font-bold">Phase 2 (Deliver):</span>
                      <strong className="text-emerald-300 font-mono text-[11px]">{totalDeliveredBoxes} / {deliverBoxes.length} Parts</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Destination Location & Delivery Slip Specific Controls */}
              {activeReportTab !== 'stock_transfers' && activeReportTab !== 'logistics_checklist' && (
                <>
                  <div>
                    <label className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-1.5">Destination Location</label>
                    <select
                      value={selectedLocationId}
                      onChange={(e) => setSelectedLocationId(e.target.value)}
                      className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {locationsInPlay.map((loc) => (
                        <option key={loc.locationId} value={loc.locationId}>
                          {loc.locationName}
                        </option>
                      ))}
                      {locationsInPlay.length === 0 && (
                        <option value="">No locations identified</option>
                      )}
                    </select>
                  </div>

                  {/* Location Reference Information */}
                  {selectedLocation && (selectedLocation.contact || selectedLocation.notes) && (
                    <div className="bg-cool-gray-800/40 border border-cool-gray-750 p-3 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                        <Info size={12} />
                        Location Reference
                      </div>
                      {selectedLocation.contact && (
                        <div className="text-[11px] text-cool-gray-200">
                          <span className="font-bold text-cool-gray-400">Contact: </span>
                          {selectedLocation.contact}
                        </div>
                      )}
                      {selectedLocation.notes && (
                        <div className="text-[11px] text-cool-gray-300 italic bg-cool-gray-900/50 p-2 rounded-lg border border-cool-gray-700/50">
                          {selectedLocation.notes}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pallets Multi-select (Checkboxes) for Delivery Slip / Manifest */}
                  {selectedLocationId && destinationsInPlay.filter(d => d.locationId === selectedLocationId && d.palletName).length > 0 && (
                    <div>
                      <label className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>Include Pallets (Lot#)</span>
                        {(() => {
                          const related = destinationsInPlay.filter(d => d.locationId === selectedLocationId);
                          const allSelected = related.length > 0 && related.every(d => selectedDestinationIds.includes(d.id));
                          return (
                            <button 
                              type="button"
                              onClick={() => {
                                if (allSelected) {
                                  setSelectedDestinationIds([]);
                                } else {
                                  setSelectedDestinationIds(related.map(d => d.id));
                                }
                              }}
                              className="text-[9px] text-cyan-400 hover:underline font-bold cursor-pointer"
                            >
                              {allSelected ? 'Deselect All' : 'Select All'}
                            </button>
                          );
                        })()}
                      </label>
                      <div className="bg-cool-gray-800/50 border border-cool-gray-750 p-2.5 rounded-xl space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                        {destinationsInPlay
                          .filter(d => d.locationId === selectedLocationId)
                          .map((dest) => {
                            const isChecked = selectedDestinationIds.includes(dest.id);
                            return (
                              <div
                                key={dest.id}
                                onClick={() => {
                                  if (isChecked) {
                                    setSelectedDestinationIds(prev => prev.filter(id => id !== dest.id));
                                  } else {
                                    setSelectedDestinationIds(prev => [...prev, dest.id]);
                                  }
                                }}
                                className="flex items-center gap-2 cursor-pointer py-1 hover:text-white text-cool-gray-300 text-xs select-none"
                              >
                                {isChecked ? (
                                  <CheckSquare size={14} className="text-blue-500" />
                                ) : (
                                  <Square size={14} className="text-cool-gray-500" />
                                )}
                                <span className="font-mono font-semibold truncate">
                                  {dest.palletName || 'Unassigned Pallet'}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Editable From / Shipper Section */}
                  <div className="border-t border-cool-gray-700/60 pt-4 space-y-3">
                    <label className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider">Shipper / Origin Details</label>
                    <div>
                      <input
                        type="text"
                        value={fromName}
                        onChange={(e) => {
                          setFromName(e.target.value);
                          localStorage.setItem("report-from-name", e.target.value);
                        }}
                        className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold"
                        placeholder="Origin shipper name"
                      />
                    </div>
                    <div>
                      <textarea
                        value={fromAddress}
                        onChange={(e) => {
                          setFromAddress(e.target.value);
                          localStorage.setItem("report-from-address", e.target.value);
                        }}
                        rows={2}
                        className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none font-semibold leading-snug"
                        placeholder="Origin address"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Purchase Order / Reference Modifier */}
              <div>
                <label className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-1.5">
                  {activeReportTab === 'stock_transfers' ? 'Transfer Reference / PO#' : 'Purchase Order (PO#)'}
                </label>
                <input
                  type="text"
                  value={editablePo}
                  onChange={(e) => setEditablePo(e.target.value)}
                  onBlur={() => syncToOrderState(editablePo, editableItems, reportBottomNotes)}
                  className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono font-bold"
                  placeholder={activeReportTab === 'stock_transfers' ? "e.g. WH-TRANSFER-01" : "e.g. 05052026-IN"}
                />
              </div>

              {/* Items Text modifier */}
              <div>
                <label className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-1.5">
                  {activeReportTab === 'stock_transfers' ? 'Transfer Header Summary / Notes' : 'Items / Description Notes'}
                </label>
                <textarea
                  value={editableItems}
                  onChange={(e) => setEditableItems(e.target.value)}
                  onBlur={() => syncToOrderState(editablePo, editableItems, reportBottomNotes)}
                  rows={3}
                  className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y min-h-[75px] font-medium leading-relaxed"
                  placeholder={activeReportTab === 'stock_transfers' ? "Transfer description or product summary..." : "List of item descriptions..."}
                />
              </div>

              {/* Bottom Notes modifier */}
              <div>
                <label className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-1.5">
                  {activeReportTab === 'stock_transfers' ? 'Transfer Bottom Notes (Segment Scoped)' : 'Bottom Notes (Optional)'}
                </label>
                <textarea
                  value={reportBottomNotes}
                  onChange={(e) => setReportBottomNotes(e.target.value)}
                  onBlur={() => syncToOrderState(editablePo, editableItems, reportBottomNotes)}
                  rows={3}
                  className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-y min-h-[75px] font-medium leading-relaxed"
                  placeholder="Special instructions or notes for bottom of reports..."
                />
              </div>
            </div>
          </div>

          {/* Page Count & Single/Multi-Page Indicator Badge */}
          <div className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all my-4 ${
            isMultiPage 
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' 
              : 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
          }`}>
            <div className="flex items-center gap-2.5">
              <Layers size={16} className={isMultiPage ? 'text-amber-400 shrink-0' : 'text-emerald-400 shrink-0'} />
              <div>
                <div className="font-bold text-xs">{isMultiPage ? `Multi-Page Document (${totalPages} Pages)` : 'Single Page Document'}</div>
                <div className="text-[10px] opacity-80 leading-tight mt-0.5">
                  {isMultiPage ? 'Items break cleanly across pages without cutoff' : 'Fits completely on 1 page'}
                </div>
              </div>
            </div>
            <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-black/40 shrink-0 ml-2">
              {totalPages} {totalPages === 1 ? 'Page' : 'Pages'}
            </span>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5 pt-4 border-t border-cool-gray-700/60 mt-4">
            <button
              onClick={saveAsPdf}
              disabled={destinationItems.length === 0 || isPdfGenerating}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-emerald-900/20 transition-all cursor-pointer"
            >
              <Download size={14} className={isPdfGenerating ? "animate-spin" : ""} />
              <span>{isPdfGenerating ? "Saving as PDF..." : "Save Selected as PDF"}</span>
            </button>
            <button
              onClick={saveAllAsPdf}
              disabled={isPdfGenerating}
              className="w-full bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-900/20 transition-all cursor-pointer"
            >
              <Layers size={14} className={isPdfGenerating ? "animate-spin" : ""} />
              <span>{isPdfGenerating ? "Saving All..." : "Save All to Single PDF"}</span>
            </button>
            <button
              onClick={onClose}
              className="w-full bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 border border-cool-gray-700 transition-all cursor-pointer"
            >
              <X size={12} />
              <span>Close Preview Center</span>
            </button>
          </div>
        </div>

        {/* Document Live Preview Area */}
        <div className="flex-1 bg-cool-gray-950 p-6 overflow-auto flex justify-center items-start custom-scrollbar">
          <div className="bg-white text-black p-6 shadow-2xl w-[792px] min-h-[1020px] shrink-0">
            
            {/* Print layout overrides */}
            <style>{`
              @media print {
                @page {
                  margin: 0.5in;
                  size: letter portrait;
                }
                body * {
                  visibility: hidden !important;
                }
                #printable-document, #printable-document * {
                  visibility: visible !important;
                }
                #printable-document {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  color: black !important;
                  padding: 0 !important;
                  margin: 0 !important;
                }
                .no-print {
                  display: none !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                thead {
                  display: table-header-group !important;
                }
                .page-break-avoid {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
              #printable-document tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              #printable-document thead {
                display: table-header-group;
              }
              #printable-document .page-break-avoid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            `}</style>

            {/* Actual Document Content */}
            <div id="printable-document" ref={printableRef} className="printable-pdf-document space-y-3.5 text-black font-sans bg-white leading-normal w-[720px]">
              
              {/* Multi-Cell Structured Top Grid Header */}
              <div className="border border-gray-400 divide-x divide-gray-400 text-xs grid grid-cols-12 bg-white rounded-lg overflow-hidden page-break-avoid">
                {/* Source (From) Cell */}
                <div className="col-span-4 p-3 bg-gray-50 flex flex-col justify-between min-h-[88px]">
                  <div>
                    <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">
                      {activeReportTab === 'stock_transfers' ? 'Source Location (From):' : (activeReportTab === 'logistics_checklist' ? 'Movement Order:' : 'From:')}
                    </div>
                    <div className="text-xs font-black text-gray-900 mt-0.5">
                      {activeReportTab === 'stock_transfers'
                        ? (activeTransferPair?.sourceLocationName || fromName)
                        : (activeReportTab === 'logistics_checklist' ? (order.name || 'Meat Relocation Transfer') : fromName)}
                    </div>
                  </div>
                  <div className="text-[10.5px] text-gray-600 font-semibold mt-1 whitespace-pre-line leading-snug">
                    {activeReportTab === 'stock_transfers'
                      ? (state.locations?.find(l => l.id === activeTransferPair?.sourceLocationId || l.name === activeTransferPair?.sourceLocationName)?.address || fromAddress)
                      : fromAddress}
                  </div>
                </div>

                {/* Destination (Inbound) Cell */}
                <div className="col-span-4 p-3 bg-white flex flex-col justify-between min-h-[88px]">
                  <div>
                    <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">
                      {activeReportTab === 'stock_transfers' ? 'Destination (To):' : (activeReportTab === 'logistics_checklist' ? 'Destinations:' : 'Inbound:')}
                    </div>
                    <div className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">
                      {activeReportTab === 'stock_transfers'
                        ? (activeTransferPair?.destinationLocationName || 'No Destination')
                        : (activeReportTab === 'logistics_checklist' ? `${destinationsInPlay.length} Location(s)` : (selectedLocation ? selectedLocation.name : 'No Destination'))}
                    </div>
                  </div>
                  <div className="text-[10.5px] text-gray-600 mt-1 font-semibold italic">
                    {activeReportTab === 'stock_transfers'
                      ? (state.locations?.find(l => l.id === activeTransferPair?.destinationLocationId || l.name === activeTransferPair?.destinationLocationName)?.address || 'Transfer Destination Location')
                      : (activeReportTab === 'logistics_checklist' ? 'Logistics Execution Checklist' : (selectedLocation?.address || 'Direct Transfer Location'))}
                  </div>
                </div>

                {/* Metadata (Date, Items, PO) Cell */}
                <div className="col-span-4 divide-y divide-gray-300 flex flex-col justify-between text-[10.5px] bg-white">
                  <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                    <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase">Transfer Date:</span>
                    <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{order.date}</span>
                  </div>
                  <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-start">
                    <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase mt-0.5">Summary:</span>
                    <span className="col-span-7 font-bold text-gray-800 leading-tight">
                      {editableItems || (activeReportTab === 'stock_transfers'
                        ? `${activePairPalletGroups.reduce((sum, g) => sum + g.cuts.length, 0)} Cut(s) on ${activePairPalletGroups.length} Pallet(s)`
                        : 'MIXED')}
                    </span>
                  </div>
                  <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                    <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase font-bold">
                      {activeReportTab === 'stock_transfers' ? 'Ref / PO#' : 'PO#'}
                    </span>
                    <span className="col-span-7 font-black text-gray-900 font-mono text-xs">
                      {editablePo || (activeReportTab === 'stock_transfers' ? (order.description || '—') : '—')}
                    </span>
                  </div>
                </div>
              </div>

              {/* REPORT TEMPLATE 1: DELIVERY SLIP */}
              {activeReportTab === 'delivery_slip' && (
                <div className="grid grid-cols-12 gap-4 items-start">
                  
                  {/* Left Block: Pallet Summary Table */}
                  <div className="col-span-5 space-y-3 page-break-avoid">
                    <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
                      <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 font-black text-xs uppercase text-gray-750 tracking-wider">
                        Pallet Summary
                      </div>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-400 text-gray-600 font-extrabold uppercase tracking-wider text-[9px]">
                            <th className="py-1 px-2.5 border-r border-gray-300">Lot# (pallets)</th>
                            <th className="py-1 px-2.5 text-right border-r border-gray-300">Box Count</th>
                            <th className="py-1 px-2.5 text-right">Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300 text-gray-800 font-semibold">
                          {(Object.entries(palletGroups) as Array<[string, { boxCount: number; weight: number; items: any[] }]>).map(([palletName, data]) => (
                            <tr key={palletName} className="hover:bg-gray-50">
                              <td className="py-1 px-2.5 border-r border-gray-300 font-mono font-bold text-gray-900 text-[11px]">{palletName}</td>
                              <td className="py-1 px-2.5 text-right border-r border-gray-300 font-bold text-[11px]">{data.boxCount}</td>
                              <td className="py-1 px-2.5 text-right font-mono font-bold text-gray-900 text-[11px]">{data.weight.toFixed(2)}</td>
                            </tr>
                          ))}
                          {Object.keys(palletGroups).length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-gray-500 italic">No entries for this destination.</td>
                            </tr>
                          )}
                          {/* Grand Total Row */}
                          <tr className="bg-gray-100 font-bold border-t-2 border-b-2 border-gray-800 text-gray-950">
                            <td className="py-1 px-2.5 border-r border-gray-300 text-[11px] font-black">Grand Total</td>
                            <td className="py-1 px-2.5 text-right border-r border-gray-300 text-[11px] font-black">{totalBoxes}</td>
                            <td className="py-1 px-2.5 text-right font-mono text-[11px] font-black">{totalWeight.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right Block: Pallet Breakdown By Box Detail list */}
                  <div className="col-span-7">
                    <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
                      <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 font-black text-xs uppercase text-gray-750 tracking-wider">
                        Pallet Breakdown By Box
                      </div>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-400 text-gray-600 font-extrabold uppercase tracking-wider text-[9px]">
                            <th className="py-1 px-2 border-r border-gray-300 w-1/3">Lot# (pallets)</th>
                            <th className="py-1 px-2 border-r border-gray-300 w-1/3">Box</th>
                            <th className="py-1 px-2 text-right w-1/3">Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {sortedDestinationBoxes.map((box, idx) => {
                            return (
                              <tr key={idx} className="hover:bg-gray-50 text-gray-800">
                                <td className="py-0.5 px-2 border-r border-gray-200 font-mono text-[10px] font-medium text-gray-500">{box.palletName}</td>
                                <td className="py-0.5 px-2 border-r border-gray-200 font-mono font-bold text-gray-900 text-[11px]">{box.boxLabel}</td>
                                <td className="py-0.5 px-2 text-right font-mono font-bold text-gray-900 text-[11px]">{box.weight.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                          {sortedDestinationBoxes.length === 0 && (
                            <tr>
                              <td colSpan={3} className="py-4 text-center text-gray-500 italic">No boxes recorded.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* REPORT TEMPLATE 2: TRANSFER MANIFEST */}
              {activeReportTab === 'manifest' && (
                <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
                  <div className="bg-gray-100 px-3 py-2 border-b border-gray-400 font-black text-xs uppercase text-gray-750 tracking-wider">
                    Product / Meat Cut Transfer Summary
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-400 text-gray-600 font-extrabold uppercase tracking-wider text-[9.5px]">
                        <th className="py-1.5 px-3 border-r border-gray-300">Product Cut Name</th>
                        <th className="py-1.5 px-3 text-right border-r border-gray-300 w-32">Total Pieces</th>
                        <th className="py-1.5 px-3 text-right w-36">Total Net Weight</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300 text-gray-800 font-semibold">
                      {(Object.entries(manifestGroups) as Array<[string, { boxCount: number; weight: number; pieces: number; serials: string[] }]>).map(([cutName, data]) => (
                        <tr key={cutName} className="hover:bg-gray-50">
                          <td className="py-1.5 px-3 border-r border-gray-300 font-black text-gray-900 text-xs">{cutName}</td>
                          <td className="py-1.5 px-3 text-right border-r border-gray-300 font-bold font-mono text-xs">{data.pieces}</td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-gray-900 text-xs">{data.weight.toFixed(2)} lbs</td>
                        </tr>
                      ))}
                      {Object.keys(manifestGroups).length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-gray-500 italic">No items identified for this destination.</td>
                        </tr>
                      )}
                      {/* Grand Total */}
                      <tr className="bg-gray-100 font-bold border-t-2 border-b-2 border-gray-800 text-gray-950">
                        <td className="py-1.5 px-3 border-r border-gray-300 text-xs font-black">Grand Total</td>
                        <td className="py-1.5 px-3 text-right border-r border-gray-300 text-xs font-black font-mono">
                          {destinationItems.reduce((sum, item) => sum + (item.entry?.pieces || 0), 0)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-xs font-black">{totalWeight.toFixed(2)} lbs</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* REPORT TEMPLATE 3: STOCK TRANSFER MANIFEST WITH SCANNABLE WEIGHT-EMBEDDED BARCODES & PALLET GROUPING */}
              {activeReportTab === 'stock_transfers' && (
                <div className="space-y-4">
                  {/* Missing Barcode Warning Banner */}
                  {missingBarcodeCuts.length > 0 && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl flex items-start gap-3 text-amber-200 text-xs no-print shadow-sm">
                      <Info className="text-amber-400 shrink-0 mt-0.5" size={16} />
                      <div className="space-y-1">
                        <div className="font-bold text-amber-300 flex items-center gap-1.5">
                          <span>{missingBarcodeCuts.length} Product{missingBarcodeCuts.length > 1 ? 's' : ''} Missing Base Barcode</span>
                        </div>
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          The following item(s) do not have a base 12-digit barcode in the product catalog: <strong className="text-amber-100">{missingBarcodeCuts.map(c => c.cutName + (c.productNumber ? ` (#${c.productNumber})` : '')).join(', ')}</strong>.
                          Because transfer barcodes must match your Odoo product barcodes to scan properly, please assign each general barcode in <strong>Product Management</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Render Table per Pallet Group */}
                  {activePairPalletGroups.map((grp) => (
                    <div key={grp.palletName} className="border border-gray-400 rounded-lg overflow-hidden bg-white shadow-2xs page-break-avoid">
                      {/* Pallet Title Bar */}
                      <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Layers size={13} className="text-gray-700" />
                          <span className="font-mono font-black text-xs uppercase text-gray-900 tracking-wide">
                            Pallet / Lot: {grp.palletName}
                          </span>
                        </div>
                        <div className="text-[10.5px] font-bold text-gray-700">
                          <span className="font-mono">{grp.totalBoxes}</span> Box{grp.totalBoxes !== 1 ? 'es' : ''} • <span className="font-mono">{grp.totalPieces}</span> Pcs • <span className="font-mono text-gray-900">{grp.totalWeight.toFixed(2)} lbs</span>
                        </div>
                      </div>

                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-300 text-gray-700 font-extrabold uppercase tracking-wider text-[9px]">
                            <th className="py-1.5 px-2.5 border-r border-gray-300">Product / Cut Name</th>
                            <th className="py-1.5 px-2 text-center border-r border-gray-300 w-20">Item #</th>
                            <th className="py-1.5 px-2 text-right border-r border-gray-300 w-14">Boxes</th>
                            <th className="py-1.5 px-2 text-right border-r border-gray-300 w-14">Pcs</th>
                            <th className="py-1.5 px-2.5 text-right border-r border-gray-300 w-24">Weight</th>
                            <th className="py-1.5 px-2 text-center w-56">Scannable Barcode</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-300 text-gray-800 font-semibold">
                          {grp.cuts.map((cut) => {
                            const isCopied = copiedBarcode === cut.weightEmbeddedBarcode;
                            return (
                              <tr key={cut.cutName} className="bg-white hover:bg-gray-50">
                                <td className="py-1.5 px-2.5 border-r border-gray-300">
                                  <div className="font-black text-gray-900 text-xs">{cut.cutName}</div>
                                  {cut.serials.length > 0 && (
                                    <div className="text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-xs">
                                      Boxes: {cut.serials.slice(0, 4).join(', ')}{cut.serials.length > 4 ? ` +${cut.serials.length - 4} more` : ''}
                                    </div>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-center border-r border-gray-300 font-mono text-[10.5px] font-bold text-gray-700">
                                  {cut.productNumber || '—'}
                                </td>
                                <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-xs text-gray-900">
                                  {cut.boxCount}
                                </td>
                                <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-xs text-gray-900">
                                  {cut.pieces}
                                </td>
                                <td className="py-1.5 px-2.5 text-right border-r border-gray-300 font-mono font-bold text-gray-900 text-xs">
                                  {cut.weight.toFixed(2)} lbs
                                </td>
                                <td className="py-1 px-2 text-center bg-gray-50">
                                  {cut.hasValidBarcode ? (
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                      <ScannableBarcode 
                                        value={cut.weightEmbeddedBarcode} 
                                        width={1.15} 
                                        height={28} 
                                        displayValue={false} 
                                      />
                                      <div className="flex items-center justify-center gap-1 mt-0.5">
                                        <span className="font-mono font-bold text-gray-900 text-[10.5px] tracking-wider select-all">
                                          {formatUpcDisplay(cut.weightEmbeddedBarcode)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyBarcode(cut.weightEmbeddedBarcode)}
                                          className="no-print p-0.5 rounded hover:bg-emerald-100 text-gray-500 hover:text-emerald-800 transition-all cursor-pointer"
                                          title="Copy barcode number"
                                        >
                                          {isCopied ? <Check size={10} className="text-emerald-700" /> : <Copy size={10} />}
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center p-1.5 bg-amber-50 border border-amber-300 rounded text-amber-900 text-center">
                                      <div className="flex items-center gap-1 font-bold text-[9.5px] text-amber-800">
                                        <Info size={11} className="text-amber-600 shrink-0" />
                                        Missing Base Barcode
                                      </div>
                                      <span className="text-[8.5px] text-amber-700 leading-tight mt-0.5">
                                        Set in Product Management
                                      </span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Pallet Subtotal Row */}
                          <tr className="bg-gray-100 font-bold border-t border-gray-400 text-gray-900">
                            <td className="py-1 px-2.5 border-r border-gray-300 text-[10.5px] font-black italic">
                              Subtotal ({grp.palletName})
                            </td>
                            <td className="py-1 px-2 text-center border-r border-gray-300 font-mono text-[9.5px] text-gray-600 font-bold">
                              {grp.cuts.length} Cuts
                            </td>
                            <td className="py-1 px-2 text-right border-r border-gray-300 text-xs font-black font-mono">
                              {grp.totalBoxes}
                            </td>
                            <td className="py-1 px-2 text-right border-r border-gray-300 text-xs font-black font-mono">
                              {grp.totalPieces}
                            </td>
                            <td className="py-1 px-2.5 text-right font-mono text-xs font-black border-r border-gray-300 text-gray-950">
                              {grp.totalWeight.toFixed(2)} lbs
                            </td>
                            <td className="py-1 px-2 text-center text-[9px] font-mono text-gray-500">
                              Pallet Total
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}

                  {activePairPalletGroups.length === 0 && (
                    <div className="border border-gray-300 rounded-lg p-6 text-center text-gray-500 italic bg-white">
                      No items found for the selected pallets or transfer segment.
                    </div>
                  )}

                  {/* Segment Grand Total Box */}
                  {activePairPalletGroups.length > 0 && (
                    <div className="border-2 border-gray-900 rounded-lg overflow-hidden bg-emerald-50 p-2.5 px-3 flex items-center justify-between page-break-avoid">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs uppercase text-gray-950 tracking-wider">
                          Transfer Segment Grand Total
                        </span>
                        <span className="text-[10px] font-mono font-bold text-gray-600">
                          ({activePairPalletGroups.length} Pallet{activePairPalletGroups.length !== 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs font-black font-mono text-gray-950">
                        <span>{activeSegmentTotals.boxes} Boxes</span>
                        <span>•</span>
                        <span>{activeSegmentTotals.pieces} Pcs</span>
                        <span>•</span>
                        <span className="text-emerald-950 text-sm">{activeSegmentTotals.weight.toFixed(2)} lbs</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* REPORT TEMPLATE 4: LOGISTICS TRANSFER CHECKLIST */}
              {activeReportTab === 'logistics_checklist' && (
                <div className="space-y-5">
                  {/* Phase 1: Pick Up Checklist */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 page-break-avoid">
                      <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider">
                        Phase 1: Pick Up Checklist (Source Pallets)
                      </h2>
                      <span className="text-[10.5px] font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                        {totalPickedBoxes} / {execBoxes.length} Boxes Picked ({execBoxes.length > 0 ? Math.round((totalPickedBoxes / execBoxes.length) * 100) : 0}%)
                      </span>
                    </div>

                    {pickGroups.map(([palletName, boxes]) => (
                      <div key={palletName} className="border border-gray-400 rounded-lg overflow-hidden bg-white shadow-2xs page-break-avoid space-y-0">
                        <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 font-black text-xs font-mono text-gray-900 flex justify-between items-center">
                          <span>Source Pallet: {palletName}</span>
                          <span className="text-[10px] text-gray-600 font-bold">({boxes.length} Box{boxes.length !== 1 ? 'es' : ''})</span>
                        </div>

                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-300 text-gray-600 font-extrabold uppercase tracking-wider text-[9px]">
                              <th className="py-1 px-2 text-center border-r border-gray-300 w-8">Status</th>
                              <th className="py-1 px-2.5 border-r border-gray-300">Box Label & Description</th>
                              <th className="py-1 px-2 text-right border-r border-gray-300 w-20">Weight</th>
                              <th className="py-1 px-2 text-right border-r border-gray-300 w-12">Pcs</th>
                              <th className="py-1 px-2.5 border-r border-gray-300">Destination</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-gray-900 font-medium">
                            {boxes.map((b: any) => {
                              const isBoxPicked = pickedBoxIds.includes(b.id) || b.items.every((it: any) => pickedItemIds.includes(it.id));
                              return (
                                <tr key={b.id} className={isBoxPicked ? "bg-emerald-50/40" : "bg-white"}>
                                  <td className="py-1.5 px-2 text-center border-r border-gray-300 font-mono font-black text-xs">
                                    {isBoxPicked ? "✓" : "☐"}
                                  </td>
                                  <td className="py-1.5 px-2.5 border-r border-gray-300">
                                    <span className="font-mono font-bold text-gray-950">Box {b.boxLabel}</span>
                                    {checklistMode === 'detailed' && b.items && b.items.length > 0 && (
                                      <div className="text-[9.5px] text-gray-600 font-normal mt-0.5">
                                        {getBoxCutSummary(b.items, state)}
                                      </div>
                                    )}
                                    {b.isSplit && (
                                      <p className="text-[9.5px] text-purple-900 font-bold mt-0.5">
                                        ⚠️ SPLIT: {getBoxSplitSummary(b.boxLabel, b.sourcePallet, b.destinations)}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono font-bold text-gray-900">
                                    {b.totalWeight.toFixed(2)} lbs
                                  </td>
                                  <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-gray-800">
                                    {b.totalPieces}
                                  </td>
                                  <td className="py-1.5 px-2.5 font-bold font-mono text-[10.5px] text-gray-900">
                                    {b.isSplit ? "[Split Box]" : `${b.targetLocationName}${b.targetPalletName ? ` (${b.targetPalletName})` : ''}`}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {pickGroups.length === 0 && (
                      <div className="text-center py-6 text-gray-500 italic border border-gray-300 rounded-lg">
                        No items found for Phase 1 Pick Up.
                      </div>
                    )}
                  </div>

                  {/* Phase 2: Deliver Checklist */}
                  <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 page-break-avoid">
                      <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider">
                        Phase 2: Deliver Checklist (Confirm Locations)
                      </h2>
                      <span className="text-[10.5px] font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                        {totalDeliveredBoxes} / {deliverBoxes.length} Parts Delivered ({deliverBoxes.length > 0 ? Math.round((totalDeliveredBoxes / deliverBoxes.length) * 100) : 0}%)
                      </span>
                    </div>

                    {deliverGroups.map(([destId, g]) => (
                      <div key={destId} className="border border-gray-400 rounded-lg overflow-hidden bg-white shadow-2xs page-break-avoid space-y-0">
                        <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 font-black text-xs font-mono text-gray-900 flex justify-between items-center">
                          <span>Destination: {g.label}</span>
                          <span className="text-[10px] text-gray-600 font-bold">({g.boxes.length} Box Part{g.boxes.length !== 1 ? 's' : ''})</span>
                        </div>

                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-300 text-gray-600 font-extrabold uppercase tracking-wider text-[9px]">
                              <th className="py-1 px-2 text-center border-r border-gray-300 w-8">Status</th>
                              <th className="py-1 px-2.5 border-r border-gray-300">Box Label & Description</th>
                              <th className="py-1 px-2 text-right border-r border-gray-300 w-20">Weight</th>
                              <th className="py-1 px-2 text-right border-r border-gray-300 w-12">Pcs</th>
                              <th className="py-1 px-2.5 border-r border-gray-300">From Source Pallet</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 text-gray-900 font-medium">
                            {g.boxes.map((b: any) => {
                              const isBoxDelivered = deliveredBoxIds.includes(b.id) || b.items.every((it: any) => deliveredItemIds.includes(it.id));
                              return (
                                <tr key={b.id} className={isBoxDelivered ? "bg-emerald-50/40" : "bg-white"}>
                                  <td className="py-1.5 px-2 text-center border-r border-gray-300 font-mono font-black text-xs">
                                    {isBoxDelivered ? "✓" : "☐"}
                                  </td>
                                  <td className="py-1.5 px-2.5 border-r border-gray-300">
                                    <span className="font-mono font-bold text-gray-950">Box {b.boxLabel}</span>
                                    {checklistMode === 'detailed' && b.items && b.items.length > 0 && (
                                      <div className="text-[9.5px] text-gray-600 font-normal mt-0.5">
                                        {getBoxCutSummary(b.items, state)}
                                      </div>
                                    )}
                                    {b.isSplitPart && (
                                      <p className="text-[9.5px] text-purple-900 font-bold mt-0.5">
                                        ⚠️ SPLIT PART: {getBoxSplitSummary(b.boxLabel, b.sourcePallet, b.destinations || [])}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono font-bold text-gray-900">
                                    {b.totalWeight.toFixed(2)} lbs
                                  </td>
                                  <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-gray-800">
                                    {b.totalPieces}
                                  </td>
                                  <td className="py-1.5 px-2.5 font-bold font-mono text-[10.5px] text-gray-900">
                                    {b.sourcePallet}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    {deliverGroups.length === 0 && (
                      <div className="text-center py-6 text-gray-500 italic border border-gray-300 rounded-lg">
                        No items found for Phase 2 Deliver.
                      </div>
                    )}
                  </div>
                </div>
              )}
              {reportBottomNotes.trim() && (
                <div className="border border-gray-400 rounded-lg p-3 bg-white mt-3 text-xs text-left page-break-avoid">
                  <div className="text-[9.5px] font-extrabold text-gray-500 uppercase tracking-widest mb-1">Notes:</div>
                  <div className="text-gray-950 font-semibold whitespace-pre-line leading-relaxed text-xs">
                    {reportBottomNotes}
                  </div>
                </div>
              )}
            </div>

            {/* Hidden element for Save All as Single PDF */}
            <div id="all-printable-documents" className="printable-pdf-document hidden space-y-8 text-black font-sans bg-white leading-normal w-[720px]">
              {activeReportTab === 'logistics_checklist' && (
                <div className="bg-white text-black space-y-5">
                  <div className="border border-gray-400 divide-x divide-gray-400 text-xs grid grid-cols-12 bg-white rounded-lg overflow-hidden page-break-avoid mb-3.5">
                    <div className="col-span-4 p-3 bg-gray-50 flex flex-col justify-between min-h-[88px]">
                      <div>
                        <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Movement Order:</div>
                        <div className="text-xs font-black text-gray-900 mt-0.5">{order.name || 'Meat Relocation Transfer'}</div>
                      </div>
                      <div className="text-[10.5px] text-gray-600 font-semibold mt-1 whitespace-pre-line leading-snug">{fromAddress}</div>
                    </div>
                    <div className="col-span-4 p-3 bg-white flex flex-col justify-between min-h-[88px]">
                      <div>
                        <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Destinations:</div>
                        <div className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">{destinationsInPlay.length} Location(s)</div>
                      </div>
                      <div className="text-[10.5px] text-gray-600 mt-1 font-semibold italic">Logistics Execution Checklist</div>
                    </div>
                    <div className="col-span-4 divide-y divide-gray-300 flex flex-col justify-between text-[10.5px] bg-white">
                      <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                        <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase">Transfer Date:</span>
                        <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{order.date}</span>
                      </div>
                      <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-start">
                        <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase mt-0.5">Summary:</span>
                        <span className="col-span-7 font-bold text-gray-800 leading-tight">Checklist: {execBoxes.length} Boxes ({totalPickedBoxes} Picked, {totalDeliveredBoxes} Delivered)</span>
                      </div>
                      <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                        <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase font-bold">PO#</span>
                        <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{editablePo || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Phase 1 & 2 Checklists */}
                  <div className="space-y-5">
                    {/* Phase 1 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 page-break-avoid">
                        <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider">Phase 1: Pick Up Checklist (Source Pallets)</h2>
                        <span className="text-[10.5px] font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                          {totalPickedBoxes} / {execBoxes.length} Boxes Picked ({execBoxes.length > 0 ? Math.round((totalPickedBoxes / execBoxes.length) * 100) : 0}%)
                        </span>
                      </div>
                      {pickGroups.map(([palletName, boxes]) => (
                        <div key={palletName} className="border border-gray-400 rounded-lg overflow-hidden bg-white shadow-2xs page-break-avoid space-y-0">
                          <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 font-black text-xs font-mono text-gray-900 flex justify-between items-center">
                            <span>Source Pallet: {palletName}</span>
                            <span className="text-[10px] text-gray-600 font-bold">({boxes.length} Box{boxes.length !== 1 ? 'es' : ''})</span>
                          </div>
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-300 text-gray-600 font-extrabold uppercase tracking-wider text-[9px]">
                                <th className="py-1 px-2 text-center border-r border-gray-300 w-8">Status</th>
                                <th className="py-1 px-2.5 border-r border-gray-300">Box Label & Description</th>
                                <th className="py-1 px-2 text-right border-r border-gray-300 w-20">Weight</th>
                                <th className="py-1 px-2 text-right border-r border-gray-300 w-12">Pcs</th>
                                <th className="py-1 px-2.5 border-r border-gray-300">Destination</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-gray-900 font-medium">
                              {boxes.map((b: any) => {
                                const isBoxPicked = pickedBoxIds.includes(b.id) || b.items.every((it: any) => pickedItemIds.includes(it.id));
                                return (
                                  <tr key={b.id} className={isBoxPicked ? "bg-emerald-50/40" : "bg-white"}>
                                    <td className="py-1.5 px-2 text-center border-r border-gray-300 font-mono font-black text-xs">
                                      {isBoxPicked ? "✓" : "☐"}
                                    </td>
                                    <td className="py-1.5 px-2.5 border-r border-gray-300">
                                      <span className="font-mono font-bold text-gray-950">Box {b.boxLabel}</span>
                                      {checklistMode === 'detailed' && b.items && b.items.length > 0 && (
                                        <div className="text-[9.5px] text-gray-600 font-normal mt-0.5">
                                          {getBoxCutSummary(b.items, state)}
                                        </div>
                                      )}
                                      {b.isSplit && (
                                        <p className="text-[9.5px] text-purple-900 font-bold mt-0.5">
                                          ⚠️ SPLIT: {getBoxSplitSummary(b.boxLabel, b.sourcePallet, b.destinations)}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono font-bold text-gray-900">
                                      {b.totalWeight.toFixed(2)} lbs
                                    </td>
                                    <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-gray-800">
                                      {b.totalPieces}
                                    </td>
                                    <td className="py-1.5 px-2.5 font-bold font-mono text-[10.5px] text-gray-900">
                                      {b.isSplit ? "[Split Box]" : `${b.targetLocationName}${b.targetPalletName ? ` (${b.targetPalletName})` : ''}`}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>

                    {/* Phase 2 */}
                    <div className="space-y-3 pt-3">
                      <div className="flex items-center justify-between border-b-2 border-gray-900 pb-1 page-break-avoid">
                        <h2 className="text-xs font-black uppercase text-gray-900 tracking-wider">Phase 2: Deliver Checklist (Confirm Locations)</h2>
                        <span className="text-[10.5px] font-mono font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                          {totalDeliveredBoxes} / {deliverBoxes.length} Parts Delivered ({deliverBoxes.length > 0 ? Math.round((totalDeliveredBoxes / deliverBoxes.length) * 100) : 0}%)
                        </span>
                      </div>
                      {deliverGroups.map(([destId, g]) => (
                        <div key={destId} className="border border-gray-400 rounded-lg overflow-hidden bg-white shadow-2xs page-break-avoid space-y-0">
                          <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 font-black text-xs font-mono text-gray-900 flex justify-between items-center">
                            <span>Destination: {g.label}</span>
                            <span className="text-[10px] text-gray-600 font-bold">({g.boxes.length} Box Part{g.boxes.length !== 1 ? 's' : ''})</span>
                          </div>
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-300 text-gray-600 font-extrabold uppercase tracking-wider text-[9px]">
                                <th className="py-1 px-2 text-center border-r border-gray-300 w-8">Status</th>
                                <th className="py-1 px-2.5 border-r border-gray-300">Box Label & Description</th>
                                <th className="py-1 px-2 text-right border-r border-gray-300 w-20">Weight</th>
                                <th className="py-1 px-2 text-right border-r border-gray-300 w-12">Pcs</th>
                                <th className="py-1 px-2.5 border-r border-gray-300">From Source Pallet</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 text-gray-900 font-medium">
                              {g.boxes.map((b: any) => {
                                const isBoxDelivered = deliveredBoxIds.includes(b.id) || b.items.every((it: any) => deliveredItemIds.includes(it.id));
                                return (
                                  <tr key={b.id} className={isBoxDelivered ? "bg-emerald-50/40" : "bg-white"}>
                                    <td className="py-1.5 px-2 text-center border-r border-gray-300 font-mono font-black text-xs">
                                      {isBoxDelivered ? "✓" : "☐"}
                                    </td>
                                    <td className="py-1.5 px-2.5 border-r border-gray-300">
                                      <span className="font-mono font-bold text-gray-950">Box {b.boxLabel}</span>
                                      {checklistMode === 'detailed' && b.items && b.items.length > 0 && (
                                        <div className="text-[9.5px] text-gray-600 font-normal mt-0.5">
                                          {getBoxCutSummary(b.items, state)}
                                        </div>
                                      )}
                                      {b.isSplitPart && (
                                        <p className="text-[9.5px] text-purple-900 font-bold mt-0.5">
                                          ⚠️ SPLIT PART: {getBoxSplitSummary(b.boxLabel, b.sourcePallet, b.destinations || [])}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono font-bold text-gray-900">
                                      {b.totalWeight.toFixed(2)} lbs
                                    </td>
                                    <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-gray-800">
                                      {b.totalPieces}
                                    </td>
                                    <td className="py-1.5 px-2.5 font-bold font-mono text-[10.5px] text-gray-900">
                                      {b.sourcePallet}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </div>

                  {reportBottomNotes.trim() && (
                    <div className="border border-gray-400 rounded-lg p-3 bg-white mt-3 text-xs text-left page-break-avoid">
                      <div className="text-[9.5px] font-extrabold text-gray-500 uppercase tracking-widest mb-1">Notes:</div>
                      <div className="text-gray-950 font-semibold whitespace-pre-line leading-relaxed text-xs">
                        {reportBottomNotes}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeReportTab === 'stock_transfers' && (
                stockTransferPairs.map((pair, pIdx) => {
                  const pPallets = segmentPalletSelections[pair.key] || [];
                  const pGroups = computePalletGroupsForSegment(pair, pPallets);
                  const pScopeKey = `stock_transfers:segment:${pair.key}`;
                  const pPo = order.flags?.[`report_po:${pScopeKey}`] || (selectedPairKey === pair.key ? editablePo : (order.description || '—'));
                  const pItems = order.flags?.[`report_items:${pScopeKey}`] || (selectedPairKey === pair.key ? editableItems : `${pGroups.reduce((sum, g) => sum + g.cuts.length, 0)} Cut(s) on ${pGroups.length} Pallet(s)`);
                  const pNotes = order.flags?.[`report_notes:${pScopeKey}`] !== undefined ? order.flags?.[`report_notes:${pScopeKey}`] : (selectedPairKey === pair.key ? reportBottomNotes : (localStorage.getItem("report-bottom-notes") || ""));
                  const pTotals = pGroups.reduce((acc, grp) => {
                    acc.boxes += grp.totalBoxes;
                    acc.pieces += grp.totalPieces;
                    acc.weight += grp.totalWeight;
                    return acc;
                  }, { boxes: 0, pieces: 0, weight: 0 });

                  return (
                    <div key={pair.key} className={`bg-white text-black ${pIdx > 0 ? "pt-8 border-t-2 border-dashed border-gray-400 page-break-avoid" : ""}`} style={pIdx > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}>
                      {/* Header */}
                      <div className="border border-gray-400 divide-x divide-gray-400 text-xs grid grid-cols-12 bg-white rounded-lg overflow-hidden page-break-avoid mb-3.5">
                        {/* Source (From) Cell */}
                        <div className="col-span-4 p-3 bg-gray-50 flex flex-col justify-between min-h-[88px]">
                          <div>
                            <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">
                              Source Location (From):
                            </div>
                            <div className="text-xs font-black text-gray-900 mt-0.5">
                              {pair.sourceLocationName || fromName}
                            </div>
                          </div>
                          <div className="text-[10.5px] text-gray-600 font-semibold mt-1 whitespace-pre-line leading-snug">
                            {state.locations?.find(l => l.id === pair.sourceLocationId || l.name === pair.sourceLocationName)?.address || fromAddress}
                          </div>
                        </div>

                        {/* Destination (To) Cell */}
                        <div className="col-span-4 p-3 bg-white flex flex-col justify-between min-h-[88px]">
                          <div>
                            <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">
                              Destination (To):
                            </div>
                            <div className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">
                              {pair.destinationLocationName || 'No Destination'}
                            </div>
                          </div>
                          <div className="text-[10.5px] text-gray-600 mt-1 font-semibold italic">
                            {state.locations?.find(l => l.id === pair.destinationLocationId || l.name === pair.destinationLocationName)?.address || 'Transfer Destination Location'}
                          </div>
                        </div>

                        {/* Metadata Cell */}
                        <div className="col-span-4 divide-y divide-gray-300 flex flex-col justify-between text-[10.5px] bg-white">
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase">Transfer Date:</span>
                            <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{order.date}</span>
                          </div>
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-start">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase mt-0.5">Summary:</span>
                            <span className="col-span-7 font-bold text-gray-800 leading-tight">{pItems}</span>
                          </div>
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase font-bold">Ref / PO#</span>
                            <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{pPo}</span>
                          </div>
                        </div>
                      </div>

                      {/* Pallet groups tables */}
                      <div className="space-y-4">
                        {pGroups.map((grp) => (
                          <div key={grp.palletName} className="border border-gray-400 rounded-lg overflow-hidden bg-white shadow-2xs page-break-avoid">
                            <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Layers size={13} className="text-gray-700" />
                                <span className="font-mono font-black text-xs uppercase text-gray-900 tracking-wide">
                                  Pallet / Lot: {grp.palletName}
                                </span>
                              </div>
                              <div className="text-[10.5px] font-bold text-gray-700">
                                <span className="font-mono">{grp.totalBoxes}</span> Box{grp.totalBoxes !== 1 ? 'es' : ''} • <span className="font-mono">{grp.totalPieces}</span> Pcs • <span className="font-mono text-gray-900">{grp.totalWeight.toFixed(2)} lbs</span>
                              </div>
                            </div>

                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-300 text-gray-700 font-extrabold uppercase tracking-wider text-[9px]">
                                  <th className="py-1.5 px-2.5 border-r border-gray-300">Product / Cut Name</th>
                                  <th className="py-1.5 px-2 text-center border-r border-gray-300 w-20">Item #</th>
                                  <th className="py-1.5 px-2 text-right border-r border-gray-300 w-14">Boxes</th>
                                  <th className="py-1.5 px-2 text-right border-r border-gray-300 w-14">Pcs</th>
                                  <th className="py-1.5 px-2.5 text-right border-r border-gray-300 w-24">Weight</th>
                                  <th className="py-1.5 px-2 text-center w-56">Scannable Barcode</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-300 text-gray-800 font-semibold">
                                {grp.cuts.map((cut) => (
                                  <tr key={cut.cutName} className="bg-white hover:bg-gray-50">
                                    <td className="py-1.5 px-2.5 border-r border-gray-300">
                                      <div className="font-black text-gray-900 text-xs">{cut.cutName}</div>
                                      {cut.serials.length > 0 && (
                                        <div className="text-[9px] text-gray-500 font-mono mt-0.5 truncate max-w-xs">
                                          Boxes: {cut.serials.slice(0, 4).join(', ')}{cut.serials.length > 4 ? ` +${cut.serials.length - 4} more` : ''}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 text-center border-r border-gray-300 font-mono text-[10.5px] font-bold text-gray-700">
                                      {cut.productNumber || '—'}
                                    </td>
                                    <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-xs text-gray-900">
                                      {cut.boxCount}
                                    </td>
                                    <td className="py-1.5 px-2 text-right border-r border-gray-300 font-mono text-xs text-gray-900">
                                      {cut.pieces}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-right border-r border-gray-300 font-mono font-bold text-gray-900 text-xs">
                                      {cut.weight.toFixed(2)} lbs
                                    </td>
                                    <td className="py-1 px-2 text-center bg-gray-50">
                                      {cut.hasValidBarcode ? (
                                        <div className="flex flex-col items-center justify-center gap-0.5">
                                          <ScannableBarcode 
                                            value={cut.weightEmbeddedBarcode} 
                                            width={1.15} 
                                            height={28} 
                                            displayValue={false} 
                                          />
                                          <div className="flex items-center justify-center gap-1 mt-0.5">
                                            <span className="font-mono font-bold text-gray-900 text-[10.5px] tracking-wider select-all">
                                              {formatUpcDisplay(cut.weightEmbeddedBarcode)}
                                            </span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-dashed border-amber-400 rounded px-1.5 py-1 text-center leading-tight">
                                          Missing Base Barcode
                                          <div className="text-[8px] font-normal text-amber-700">Set in Product Catalog</div>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-gray-100 font-bold border-t border-gray-400 text-gray-900">
                                  <td className="py-1 px-2.5 border-r border-gray-300 text-[10.5px] font-black italic">
                                    Subtotal ({grp.palletName})
                                  </td>
                                  <td className="py-1 px-2 text-center border-r border-gray-300 font-mono text-[9.5px] text-gray-600 font-bold">
                                    {grp.cuts.length} Cuts
                                  </td>
                                  <td className="py-1 px-2 text-right border-r border-gray-300 text-xs font-black font-mono">
                                    {grp.totalBoxes}
                                  </td>
                                  <td className="py-1 px-2 text-right border-r border-gray-300 text-xs font-black font-mono">
                                    {grp.totalPieces}
                                  </td>
                                  <td className="py-1 px-2.5 text-right font-mono text-xs font-black border-r border-gray-300 text-gray-950">
                                    {grp.totalWeight.toFixed(2)} lbs
                                  </td>
                                  <td className="py-1 px-2 text-center text-[9px] font-mono text-gray-500">
                                    Pallet Total
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        ))}

                        {pGroups.length > 0 && (
                          <div className="border-2 border-gray-900 rounded-lg overflow-hidden bg-emerald-50 p-2.5 px-3 flex items-center justify-between page-break-avoid">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-xs uppercase text-gray-950 tracking-wider">
                                Transfer Segment Grand Total
                              </span>
                              <span className="text-[10px] font-mono font-bold text-gray-600">
                                ({pGroups.length} Pallet{pGroups.length !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-black font-mono text-gray-950">
                              <span>{pTotals.boxes} Boxes</span>
                              <span>•</span>
                              <span>{pTotals.pieces} Pcs</span>
                              <span>•</span>
                              <span className="text-emerald-950 text-sm">{pTotals.weight.toFixed(2)} lbs</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {pNotes.trim() && (
                        <div className="border border-gray-400 rounded-lg p-3 bg-white mt-3 text-xs text-left page-break-avoid">
                          <div className="text-[9.5px] font-extrabold text-gray-500 uppercase tracking-widest mb-1">Notes:</div>
                          <div className="text-gray-950 font-semibold whitespace-pre-line leading-relaxed text-xs">
                            {pNotes}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {activeReportTab === 'delivery_slip' && (
                allLocationsList.map((locItem, lIdx) => {
                  const locId = locItem.locationId;
                  const locObj = state.locations?.find(l => l.id === locId || l.name === locId);
                  const locName = locObj?.name || locItem.locationName || 'Destination';
                  const locAddress = locObj?.address || 'Direct Transfer Location';

                  const locItems = getItemsForLocation(locId);

                  const locPalletGroups: { [palletName: string]: { boxCount: number; weight: number; items: any[] } } = {};
                  const palletUniqueBoxes = new Map<string, Set<string>>();

                  locItems.forEach(item => {
                    const palletName = getDestinationPallet(item.move);
                    if (!locPalletGroups[palletName]) {
                      locPalletGroups[palletName] = { boxCount: 0, weight: 0, items: [] };
                    }
                    if (!palletUniqueBoxes.has(palletName)) {
                      palletUniqueBoxes.set(palletName, new Set());
                    }
                    const boxId = item.entry?.box || item.entry?.serial || item.entry?.id || 'N/A';
                    palletUniqueBoxes.get(palletName)!.add(boxId);

                    locPalletGroups[palletName].weight += item.entry?.netWeight || 0;
                    locPalletGroups[palletName].items.push(item);
                  });

                  for (const pName of Object.keys(locPalletGroups)) {
                    locPalletGroups[pName].boxCount = palletUniqueBoxes.get(pName)?.size || 0;
                  }

                  const locTotalWeight = locItems.reduce((sum, item) => sum + (item.entry?.netWeight || 0), 0);
                  const locTotalBoxes = (() => {
                    const uBoxes = new Set<string>();
                    locItems.forEach(item => {
                      const palletName = getDestinationPallet(item.move);
                      const boxId = `${palletName}::${item.entry?.box || item.entry?.serial || item.entry?.id || 'N/A'}`;
                      uBoxes.add(boxId);
                    });
                    return uBoxes.size;
                  })();

                  const locBoxGroups = new Map<string, { palletName: string; boxLabel: string; weight: number; items: any[] }>();
                  locItems.forEach(item => {
                    const palletName = getDestinationPallet(item.move);
                    const boxLabel = item.entry?.box || item.entry?.serial || 'N/A';
                    const key = `${palletName}::${boxLabel}`;

                    if (!locBoxGroups.has(key)) {
                      locBoxGroups.set(key, { palletName, boxLabel, weight: 0, items: [] });
                    }
                    const grp = locBoxGroups.get(key)!;
                    grp.weight += item.entry?.netWeight || 0;
                    grp.items.push(item);
                  });

                  const locSortedBoxes = Array.from(locBoxGroups.values()).sort((a, b) => {
                    const palletCompare = a.palletName.localeCompare(b.palletName, undefined, { numeric: true, sensitivity: 'base' });
                    if (palletCompare !== 0) return palletCompare;
                    return compareBoxLabels(a.boxLabel, b.boxLabel);
                  });

                  const locScopeKey = `loc:${locId}`;
                  const lPo = order.flags?.[`report_po:${locScopeKey}`] || (selectedLocationId === locId ? editablePo : getAutoPoNumber(order.date));
                  const lItems = order.flags?.[`report_items:${locScopeKey}`] || (selectedLocationId === locId ? editableItems : (Array.from(new Set(locItems.map(i => getEntryCutName(i.entry, state)).filter(Boolean))).join(', ') || 'MIXED'));
                  const lNotes = order.flags?.[`report_notes:${locScopeKey}`] !== undefined ? order.flags?.[`report_notes:${locScopeKey}`] : (selectedLocationId === locId ? reportBottomNotes : (localStorage.getItem("report-bottom-notes") || ""));

                  return (
                    <div key={locId} className={`bg-white text-black ${lIdx > 0 ? "pt-8 border-t-2 border-dashed border-gray-400 page-break-avoid" : ""}`} style={lIdx > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}>
                      <div className="border border-gray-400 divide-x divide-gray-400 text-xs grid grid-cols-12 bg-white rounded-lg overflow-hidden page-break-avoid mb-3.5">
                        <div className="col-span-4 p-3 bg-gray-50 flex flex-col justify-between min-h-[88px]">
                          <div>
                            <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">From:</div>
                            <div className="text-xs font-black text-gray-900 mt-0.5">{fromName}</div>
                          </div>
                          <div className="text-[10.5px] text-gray-600 font-semibold mt-1 whitespace-pre-line leading-snug">{fromAddress}</div>
                        </div>
                        <div className="col-span-4 p-3 bg-white flex flex-col justify-between min-h-[88px]">
                          <div>
                            <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Inbound:</div>
                            <div className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">{locName}</div>
                          </div>
                          <div className="text-[10.5px] text-gray-600 mt-1 font-semibold italic">{locAddress}</div>
                        </div>
                        <div className="col-span-4 divide-y divide-gray-300 flex flex-col justify-between text-[10.5px] bg-white">
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase">Transfer Date:</span>
                            <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{order.date}</span>
                          </div>
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-start">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase mt-0.5">Summary:</span>
                            <span className="col-span-7 font-bold text-gray-800 leading-tight">{lItems}</span>
                          </div>
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase font-bold">PO#</span>
                            <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{lPo}</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-12 gap-4 items-start">
                        <div className="col-span-5 space-y-3 page-break-avoid">
                          <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
                            <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 font-black text-xs uppercase text-gray-750 tracking-wider">
                              Pallet Summary
                            </div>
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-400 text-gray-600 font-extrabold uppercase tracking-wider text-[9px]">
                                  <th className="py-1 px-2.5 border-r border-gray-300">Lot# (pallets)</th>
                                  <th className="py-1 px-2.5 text-right border-r border-gray-300">Box Count</th>
                                  <th className="py-1 px-2.5 text-right">Weight</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-300 text-gray-800 font-semibold">
                                {(Object.entries(locPalletGroups) as Array<[string, { boxCount: number; weight: number; items: any[] }]>).map(([palletName, data]) => (
                                  <tr key={palletName} className="hover:bg-gray-50">
                                    <td className="py-1 px-2.5 border-r border-gray-300 font-mono font-bold text-gray-900 text-[11px]">{palletName}</td>
                                    <td className="py-1 px-2.5 text-right border-r border-gray-300 font-bold text-[11px]">{data.boxCount}</td>
                                    <td className="py-1 px-2.5 text-right font-mono font-bold text-gray-900 text-[11px]">{data.weight.toFixed(2)}</td>
                                  </tr>
                                ))}
                                {Object.keys(locPalletGroups).length === 0 && (
                                  <tr>
                                    <td colSpan={3} className="py-4 text-center text-gray-500 italic">No entries for this destination.</td>
                                  </tr>
                                )}
                                <tr className="bg-gray-100 font-bold border-t-2 border-b-2 border-gray-800 text-gray-950">
                                  <td className="py-1 px-2.5 border-r border-gray-300 text-[11px] font-black">Grand Total</td>
                                  <td className="py-1 px-2.5 text-right border-r border-gray-300 text-[11px] font-black">{locTotalBoxes}</td>
                                  <td className="py-1 px-2.5 text-right font-mono text-[11px] font-black">{locTotalWeight.toFixed(2)}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="col-span-7">
                          <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
                            <div className="bg-gray-100 px-3 py-1.5 border-b border-gray-400 font-black text-xs uppercase text-gray-750 tracking-wider">
                              Pallet Breakdown By Box
                            </div>
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-400 text-gray-600 font-extrabold uppercase tracking-wider text-[9px]">
                                  <th className="py-1 px-2 border-r border-gray-300 w-1/3">Lot# (pallets)</th>
                                  <th className="py-1 px-2 border-r border-gray-300 w-1/3">Box</th>
                                  <th className="py-1 px-2 text-right w-1/3">Weight</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {locSortedBoxes.map((box, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50 text-gray-800">
                                    <td className="py-0.5 px-2 border-r border-gray-200 font-mono text-[10px] font-medium text-gray-500">{box.palletName}</td>
                                    <td className="py-0.5 px-2 border-r border-gray-200 font-mono font-bold text-gray-900 text-[11px]">{box.boxLabel}</td>
                                    <td className="py-0.5 px-2 text-right font-mono font-bold text-gray-900 text-[11px]">{box.weight.toFixed(2)}</td>
                                  </tr>
                                ))}
                                {locSortedBoxes.length === 0 && (
                                  <tr>
                                    <td colSpan={3} className="py-4 text-center text-gray-500 italic">No boxes recorded.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {lNotes.trim() && (
                        <div className="border border-gray-400 rounded-lg p-3 bg-white mt-3 text-xs text-left page-break-avoid">
                          <div className="text-[9.5px] font-extrabold text-gray-500 uppercase tracking-widest mb-1">Notes:</div>
                          <div className="text-gray-950 font-semibold whitespace-pre-line leading-relaxed text-xs">
                            {lNotes}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {activeReportTab === 'manifest' && (
                allLocationsList.map((locItem, lIdx) => {
                  const locId = locItem.locationId;
                  const locObj = state.locations?.find(l => l.id === locId || l.name === locId);
                  const locName = locObj?.name || locItem.locationName || 'Destination';
                  const locAddress = locObj?.address || 'Direct Transfer Location';

                  const locItems = getItemsForLocation(locId);

                  const locManifestGroups: { [cutName: string]: { boxCount: number; weight: number; pieces: number; serials: string[] } } = {};
                  const groupUniqueBoxes = new Map<string, Set<string>>();

                  locItems.forEach(item => {
                    const cutName = getEntryCutName(item.entry, state);
                    if (!locManifestGroups[cutName]) {
                      locManifestGroups[cutName] = { boxCount: 0, weight: 0, pieces: 0, serials: [] };
                    }
                    if (!groupUniqueBoxes.has(cutName)) {
                      groupUniqueBoxes.set(cutName, new Set());
                    }
                    const boxId = item.entry?.box || item.entry?.serial || item.entry?.id || 'N/A';
                    groupUniqueBoxes.get(cutName)!.add(boxId);

                    locManifestGroups[cutName].weight += item.entry?.netWeight || 0;
                    locManifestGroups[cutName].pieces += item.entry?.pieces || 1;
                    if (item.entry?.box) locManifestGroups[cutName].serials.push(item.entry.box);
                  });

                  for (const cutName of Object.keys(locManifestGroups)) {
                    locManifestGroups[cutName].boxCount = groupUniqueBoxes.get(cutName)?.size || 0;
                    locManifestGroups[cutName].serials = Array.from(new Set(locManifestGroups[cutName].serials));
                  }

                  const locTotalWeight = locItems.reduce((sum, item) => sum + (item.entry?.netWeight || 0), 0);
                  const locTotalPieces = locItems.reduce((sum, item) => sum + (item.entry?.pieces || 0), 0);

                  const locScopeKey = `loc:${locId}`;
                  const lPo = order.flags?.[`report_po:${locScopeKey}`] || (selectedLocationId === locId ? editablePo : getAutoPoNumber(order.date));
                  const lItems = order.flags?.[`report_items:${locScopeKey}`] || (selectedLocationId === locId ? editableItems : (Array.from(new Set(locItems.map(i => getEntryCutName(i.entry, state)).filter(Boolean))).join(', ') || 'MIXED'));
                  const lNotes = order.flags?.[`report_notes:${locScopeKey}`] !== undefined ? order.flags?.[`report_notes:${locScopeKey}`] : (selectedLocationId === locId ? reportBottomNotes : (localStorage.getItem("report-bottom-notes") || ""));

                  return (
                    <div key={locId} className={`bg-white text-black ${lIdx > 0 ? "pt-8 border-t-2 border-dashed border-gray-400 page-break-avoid" : ""}`} style={lIdx > 0 ? { pageBreakBefore: 'always', breakBefore: 'page' } : {}}>
                      <div className="border border-gray-400 divide-x divide-gray-400 text-xs grid grid-cols-12 bg-white rounded-lg overflow-hidden page-break-avoid mb-3.5">
                        <div className="col-span-4 p-3 bg-gray-50 flex flex-col justify-between min-h-[88px]">
                          <div>
                            <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">From:</div>
                            <div className="text-xs font-black text-gray-900 mt-0.5">{fromName}</div>
                          </div>
                          <div className="text-[10.5px] text-gray-600 font-semibold mt-1 whitespace-pre-line leading-snug">{fromAddress}</div>
                        </div>
                        <div className="col-span-4 p-3 bg-white flex flex-col justify-between min-h-[88px]">
                          <div>
                            <div className="text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">Inbound:</div>
                            <div className="text-sm font-black text-gray-900 mt-0.5 uppercase tracking-tight">{locName}</div>
                          </div>
                          <div className="text-[10.5px] text-gray-600 mt-1 font-semibold italic">{locAddress}</div>
                        </div>
                        <div className="col-span-4 divide-y divide-gray-300 flex flex-col justify-between text-[10.5px] bg-white">
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase">Transfer Date:</span>
                            <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{order.date}</span>
                          </div>
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-start">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase mt-0.5">Summary:</span>
                            <span className="col-span-7 font-bold text-gray-800 leading-tight">{lItems}</span>
                          </div>
                          <div className="p-1.5 px-2.5 grid grid-cols-12 gap-1.5 items-center">
                            <span className="col-span-5 text-[9.5px] font-extrabold text-gray-500 uppercase font-bold">PO#</span>
                            <span className="col-span-7 font-black text-gray-900 font-mono text-xs">{lPo}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border border-gray-400 rounded-lg overflow-hidden bg-white">
                        <div className="bg-gray-100 px-3 py-2 border-b border-gray-400 font-black text-xs uppercase text-gray-750 tracking-wider">
                          Product / Meat Cut Transfer Summary
                        </div>
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-400 text-gray-600 font-extrabold uppercase tracking-wider text-[9.5px]">
                              <th className="py-1.5 px-3 border-r border-gray-300">Product Cut Name</th>
                              <th className="py-1.5 px-3 text-right border-r border-gray-300 w-32">Total Pieces</th>
                              <th className="py-1.5 px-3 text-right w-36">Total Net Weight</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-300 text-gray-800 font-semibold">
                            {(Object.entries(locManifestGroups) as Array<[string, { boxCount: number; weight: number; pieces: number; serials: string[] }]>).map(([cutName, data]) => (
                              <tr key={cutName} className="hover:bg-gray-50">
                                <td className="py-1.5 px-3 border-r border-gray-300 font-black text-gray-900 text-xs">{cutName}</td>
                                <td className="py-1.5 px-3 text-right border-r border-gray-300 font-bold font-mono text-xs">{data.pieces}</td>
                                <td className="py-1.5 px-3 text-right font-mono font-bold text-gray-900 text-xs">{data.weight.toFixed(2)} lbs</td>
                              </tr>
                            ))}
                            {Object.keys(locManifestGroups).length === 0 && (
                              <tr>
                                <td colSpan={3} className="py-6 text-center text-gray-500 italic">No items identified for this destination.</td>
                              </tr>
                            )}
                            <tr className="bg-gray-100 font-bold border-t-2 border-b-2 border-gray-800 text-gray-950">
                              <td className="py-1.5 px-3 border-r border-gray-300 text-xs font-black">Grand Total</td>
                              <td className="py-1.5 px-3 text-right border-r border-gray-300 text-xs font-black font-mono">
                                {locTotalPieces}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono text-xs font-black">{locTotalWeight.toFixed(2)} lbs</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {lNotes.trim() && (
                        <div className="border border-gray-400 rounded-lg p-3 bg-white mt-3 text-xs text-left page-break-avoid">
                          <div className="text-[9.5px] font-extrabold text-gray-500 uppercase tracking-widest mb-1">Notes:</div>
                          <div className="text-gray-950 font-semibold whitespace-pre-line leading-relaxed text-xs">
                            {lNotes}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BARCODE SCANNER MODE FULL-SCREEN OVERLAY */}
      {isScanModeOpen && (
        <div className="fixed inset-0 z-[250] bg-cool-gray-950/95 backdrop-blur-md flex flex-col p-3 md:p-6 no-print overflow-hidden animate-fade-in text-white">
          {/* Scan Mode Header */}
          <div className="flex items-center justify-between border-b border-cool-gray-800 pb-4 mb-3 gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-400">
                <Scan size={22} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base md:text-lg font-black tracking-tight text-white">Barcode Scan Mode</h3>
                  <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {scanDisplayMode === 'focused' ? 'Focused 1-at-a-Time' : 'Spaced-Out List'}
                  </span>
                </div>
                {stockTransferPairs.length > 1 ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] font-extrabold text-cool-gray-400 uppercase tracking-wider">Segment:</span>
                    <select
                      value={selectedPairKey}
                      onChange={(e) => {
                        setSelectedPairKey(e.target.value);
                        setScanItemIndex(0);
                        setScanPalletFilter('all');
                      }}
                      className="bg-cool-gray-900 border border-emerald-500/50 text-emerald-300 text-xs font-black rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {stockTransferPairs.map(p => (
                        <option key={p.key} value={p.key} className="bg-cool-gray-900 text-white font-bold">
                          {p.sourceLocationName} ➔ {p.destinationLocationName} ({p.itemCount} items)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="text-xs text-cool-gray-400 flex items-center gap-1.5 mt-0.5">
                    <span className="font-semibold text-emerald-300">{activeTransferPair?.sourceLocationName}</span>
                    <ArrowRight size={11} className="text-cool-gray-500" />
                    <span className="font-semibold text-cyan-300">{activeTransferPair?.destinationLocationName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mode Controls & Exit */}
            <div className="flex items-center gap-2 md:gap-3">
              {/* Toggle Mode Buttons */}
              <div className="hidden sm:flex items-center bg-cool-gray-900 border border-cool-gray-750 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScanDisplayMode('focused')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    scanDisplayMode === 'focused'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-cool-gray-400 hover:text-white'
                  }`}
                >
                  <Focus size={13} />
                  <span>1 at a Time</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScanDisplayMode('spaced_list')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    scanDisplayMode === 'spaced_list'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-cool-gray-400 hover:text-white'
                  }`}
                >
                  <List size={13} />
                  <span>Spaced-Out List</span>
                </button>
              </div>

              {/* Pallet Filter Dropdown */}
              {segmentPalletStats.length > 1 && (
                <select
                  value={scanPalletFilter}
                  onChange={(e) => {
                    setScanPalletFilter(e.target.value);
                    setScanItemIndex(0);
                  }}
                  className="bg-cool-gray-900 border border-cool-gray-750 text-white text-xs rounded-xl px-2.5 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="all">All Pallets ({segmentPalletStats.length})</option>
                  {segmentPalletStats.map(p => (
                    <option key={p.palletName} value={p.palletName}>Pallet: {p.palletName}</option>
                  ))}
                </select>
              )}

              {/* Exit Button */}
              <button
                type="button"
                onClick={() => setIsScanModeOpen(false)}
                className="bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-200 hover:text-white font-bold p-2.5 rounded-xl border border-cool-gray-700 transition-all cursor-pointer flex items-center gap-1.5 text-xs"
                title="Close Scan Mode (Esc)"
              >
                <X size={16} />
                <span className="hidden md:inline">Exit Scan Mode</span>
              </button>
            </div>
          </div>

          {/* Small screen mode toggle */}
          <div className="flex sm:hidden items-center justify-center bg-cool-gray-900 border border-cool-gray-750 p-1 rounded-xl mb-3 shrink-0">
            <button
              type="button"
              onClick={() => setScanDisplayMode('focused')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                scanDisplayMode === 'focused'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-cool-gray-400 hover:text-white'
              }`}
            >
              <Focus size={13} />
              <span>1 at a Time</span>
            </button>
            <button
              type="button"
              onClick={() => setScanDisplayMode('spaced_list')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                scanDisplayMode === 'spaced_list'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-cool-gray-400 hover:text-white'
              }`}
            >
              <List size={13} />
              <span>Spaced-Out List</span>
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start py-2">
            {filteredScanCuts.length === 0 ? (
              <div className="m-auto text-center p-8 bg-cool-gray-900 border border-cool-gray-800 rounded-2xl max-w-md">
                <Info size={32} className="text-cool-gray-500 mx-auto mb-3" />
                <h4 className="font-bold text-white text-sm">No Scannable Items</h4>
                <p className="text-xs text-cool-gray-400 mt-1">There are no cuts available in the current pallet selection or segment.</p>
              </div>
            ) : scanDisplayMode === 'focused' ? (
              /* MODE 1: FOCUSED 1-AT-A-TIME CAROUSEL */
              (() => {
                const currentCut = filteredScanCuts[scanItemIndex] || filteredScanCuts[0];
                const isCopied = copiedBarcode === currentCut.weightEmbeddedBarcode;

                return (
                  <div className="w-full max-w-2xl my-auto space-y-4 flex flex-col items-center">
                    {/* Item Counter & Direct Jump Selector */}
                    <div className="w-full flex items-center justify-between text-xs px-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-emerald-400 font-mono text-sm">
                          ITEM {scanItemIndex + 1} OF {filteredScanCuts.length}
                        </span>
                        <span className="text-cool-gray-500 text-xs hidden sm:inline">
                          (Use ← → arrow keys)
                        </span>
                      </div>
                      <select
                        value={scanItemIndex}
                        onChange={(e) => setScanItemIndex(Number(e.target.value))}
                        className="bg-cool-gray-900 border border-cool-gray-750 text-emerald-300 text-xs rounded-xl px-2.5 py-1.5 font-bold focus:outline-none cursor-pointer"
                      >
                        {filteredScanCuts.map((cut, idx) => (
                          <option key={idx} value={idx}>
                            {idx + 1}. {cut.cutName} ({cut.weight.toFixed(1)} lbs)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Huge Focus Card */}
                    <div className="w-full bg-cool-gray-900 border-2 border-cool-gray-700/90 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
                      {/* Pallet Tag Badge */}
                      <div className="flex items-center justify-between border-b border-cool-gray-800 pb-3">
                        <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-full text-xs font-black font-mono">
                          <Layers size={13} />
                          <span>PALLET: {currentCut.palletName}</span>
                        </div>
                        {currentCut.productNumber && (
                          <span className="font-mono text-xs font-bold text-cool-gray-400">
                            ITEM #{currentCut.productNumber}
                          </span>
                        )}
                      </div>

                      {/* Product Name */}
                      <div>
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
                          {currentCut.cutName}
                        </h2>
                        <div className="flex items-center justify-center gap-3 text-xs md:text-sm font-bold text-cool-gray-300 mt-2 flex-wrap">
                          <span className="bg-cool-gray-800 px-2.5 py-1 rounded-lg border border-cool-gray-700">
                            {currentCut.boxCount} Box{currentCut.boxCount !== 1 ? 'es' : ''}
                          </span>
                          <span className="bg-cool-gray-800 px-2.5 py-1 rounded-lg border border-cool-gray-700">
                            {currentCut.pieces} Pieces
                          </span>
                          <span className="bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 px-3 py-1 rounded-lg font-mono font-black">
                            {currentCut.weight.toFixed(2)} LBS
                          </span>
                        </div>
                      </div>

                      {/* GIANT SCANNABLE BARCODE BOX */}
                      <div className="bg-white p-6 rounded-2xl border-4 border-gray-300 shadow-xl flex flex-col items-center justify-center space-y-3 my-2">
                        {currentCut.hasValidBarcode ? (
                          <>
                            <div className="p-2 bg-white rounded flex justify-center w-full overflow-hidden">
                              <ScannableBarcode
                                value={currentCut.weightEmbeddedBarcode}
                                width={2.5}
                                height={100}
                                className="max-w-full"
                              />
                            </div>
                            <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-200 w-full">
                              <span className="font-mono font-black text-gray-950 text-2xl md:text-3xl tracking-widest select-all">
                                {formatUpcDisplay(currentCut.weightEmbeddedBarcode)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyBarcode(currentCut.weightEmbeddedBarcode)}
                                className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                                  isCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-emerald-900 border border-gray-300'
                                }`}
                                title="Copy barcode number"
                              >
                                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                                <span className="hidden sm:inline">{isCopied ? 'Copied!' : 'Copy'}</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-6 bg-amber-50 border-2 border-amber-400 rounded-xl text-amber-900 text-center space-y-1">
                            <div className="font-black text-sm flex items-center justify-center gap-1.5 text-amber-800">
                              <Info size={16} />
                              Missing Base 12-Digit Barcode
                            </div>
                            <p className="text-xs text-amber-700 font-medium">
                              Assign a general barcode for <strong>{currentCut.cutName}</strong> in Product Management to generate scannable transfer barcodes.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Serials preview */}
                      {currentCut.serials.length > 0 && (
                        <div className="text-xs text-cool-gray-400 font-mono text-center truncate">
                          Box Serials: {currentCut.serials.join(', ')}
                        </div>
                      )}
                    </div>

                    {/* Navigation Arrows */}
                    <div className="w-full flex items-center justify-between gap-4 pt-2">
                      <button
                        type="button"
                        onClick={() => setScanItemIndex(prev => (prev > 0 ? prev - 1 : filteredScanCuts.length - 1))}
                        className="flex-1 bg-cool-gray-800 hover:bg-cool-gray-750 text-white font-black py-4 px-5 rounded-2xl border border-cool-gray-700 flex items-center justify-center gap-2 shadow-xl text-sm md:text-base transition-all cursor-pointer active:scale-95"
                      >
                        <ChevronLeft size={22} />
                        <span>Previous</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setScanItemIndex(prev => (prev < filteredScanCuts.length - 1 ? prev + 1 : 0))}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-5 rounded-2xl shadow-xl flex items-center justify-center gap-2 text-sm md:text-base transition-all cursor-pointer active:scale-95 border border-emerald-400/30"
                      >
                        <span>Next Barcode</span>
                        <ChevronRight size={22} />
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              /* MODE 2: SPACED-OUT FULL LIST VIEW */
              <div className="w-full max-w-3xl space-y-8 py-4">
                <div className="text-center bg-cool-gray-900 border border-cool-gray-800 p-3 rounded-xl text-xs text-cool-gray-300">
                  Showing <strong className="text-emerald-400">{filteredScanCuts.length}</strong> barcode card(s) with high-contrast spacing for error-free handheld scanning.
                </div>

                {filteredScanCuts.map((cut, idx) => {
                  const isCopied = copiedBarcode === cut.weightEmbeddedBarcode;
                  return (
                    <div
                      key={idx}
                      className="bg-cool-gray-900 border-2 border-cool-gray-700/80 rounded-3xl p-6 md:p-8 shadow-2xl space-y-5"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-cool-gray-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-3 py-1 rounded-full text-xs font-black font-mono">
                            PALLET: {cut.palletName}
                          </span>
                          <span className="font-mono text-xs font-bold text-cool-gray-400">
                            #{idx + 1} of {filteredScanCuts.length}
                          </span>
                        </div>
                        {cut.productNumber && (
                          <span className="font-mono text-xs font-bold text-cool-gray-400">
                            Item #{cut.productNumber}
                          </span>
                        )}
                      </div>

                      {/* Title & Stats */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <h3 className="text-xl md:text-2xl font-black text-white">{cut.cutName}</h3>
                        <div className="flex items-center gap-3 text-xs font-bold text-cool-gray-300">
                          <span>{cut.boxCount} Box(es)</span>
                          <span>•</span>
                          <span>{cut.pieces} Pcs</span>
                          <span>•</span>
                          <span className="font-mono font-black text-emerald-300 text-sm">{cut.weight.toFixed(2)} lbs</span>
                        </div>
                      </div>

                      {/* Giant Barcode Box */}
                      <div className="bg-white p-6 rounded-2xl border-4 border-gray-300 shadow-lg flex flex-col items-center justify-center space-y-3">
                        {cut.hasValidBarcode ? (
                          <>
                            <div className="p-2 bg-white rounded flex justify-center w-full overflow-hidden">
                              <ScannableBarcode
                                value={cut.weightEmbeddedBarcode}
                                width={2.4}
                                height={90}
                                className="max-w-full"
                              />
                            </div>
                            <div className="flex items-center justify-center gap-3 pt-2 border-t border-gray-200 w-full">
                              <span className="font-mono font-black text-gray-950 text-xl md:text-2xl tracking-widest select-all">
                                {formatUpcDisplay(cut.weightEmbeddedBarcode)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyBarcode(cut.weightEmbeddedBarcode)}
                                className={`p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                                  isCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 hover:bg-emerald-100 text-gray-700 hover:text-emerald-900 border border-gray-300'
                                }`}
                              >
                                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-center text-xs font-bold">
                            Missing Base Barcode (Set in Product Management)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
