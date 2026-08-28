import React, { useState, useMemo, useEffect } from 'react';
import { InventoryState, Action, OffSiteEntry, Product } from '../types';
import { compareBoxLabels } from '../utils/boxSort';
import { OffSiteSpreadsheet } from './OffSiteSpreadsheet';
import { OffSiteHierarchy } from './OffSiteHierarchy';
import { OffSiteMovementPlanner } from './OffSiteMovementPlanner';
import { OffSiteMovementHistory } from './OffSiteMovementHistory';
import { OffSiteMovementScanner } from './OffSiteMovementScanner';
import { OffSiteStagingWorksheet } from './OffSiteStagingWorksheet';
import { 
  Plus, 
  Search, 
  Trash2, 
  RotateCcw, 
  FileSpreadsheet, 
  Layers, 
  Package, 
  TrendingUp, 
  Upload, 
  ArrowUpDown, 
  Edit3, 
  Check, 
  Calendar, 
  Tag, 
  FolderPlus, 
  FileUp, 
  Download, 
  CheckSquare,
  Truck,
  Home,
  ArrowRight,
  Shuffle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Wrench,
  X
} from 'lucide-react';
import { getOffSiteSeedEntries, parseCSV } from './offSiteSeed';
import { ManagementForms } from '../components/ManagementForms';

const renderColorTags = (colorsStr: string | undefined) => {
  return null;
};

interface OffSiteStorageViewProps {
  state: InventoryState;
  dispatch: (action: Action) => Promise<boolean>;
  products: Product[];
  activeSubTab: 'sheet' | 'import' | 'hierarchy' | 'history' | 'active-movement' | 'staging-worksheet';
  setActiveSubTab: (tab: 'sheet' | 'import' | 'hierarchy' | 'history' | 'active-movement' | 'staging-worksheet') => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isAdvancedFilterOpen: boolean;
  setIsAdvancedFilterOpen: (open: boolean) => void;
  isDirectEdit: boolean;
  setIsDirectEdit: (edit: boolean) => void;
  viewOriginalNames: boolean;
  setViewOriginalNames: (view: boolean) => void;
  filterTags: Set<string>;
  setFilterTags: (tags: Set<string>) => void;
  filterLists: Set<string>;
  setFilterLists: (lists: Set<string>) => void;
  viewUngrouped: boolean;
  setViewUngrouped: (view: boolean) => void;
  visibleColumns: Set<string>;
  setVisibleColumns: (cols: Set<string>) => void;
  registerActions: (actions: { handleNewMovement: () => void; handleDownloadCSV: () => void } | null) => void;
  isSingleUserMode?: boolean;
  claimSingleUserMode?: () => Promise<{ success: boolean; message?: string }>;
  releaseSingleUserMode?: (fullStateToSync?: any) => Promise<boolean>;
}

export interface HierarchicalBox {
  boxId: string;
  lot?: string;
  packDate?: string;
  items: OffSiteEntry[];
  weight: number;
  pieces: number;
}

export interface HierarchicalPallet {
  palletName: string;
  weight: number;
  boxCount: number;
  boxes: Record<string, HierarchicalBox>;
}

export interface HierarchicalLocation {
  locationId: string;
  locationName: string;
  notes?: string;
  address?: string;
  pallets: Record<string, HierarchicalPallet>;
}

export const SearchableProductSelect = ({ 
  uncut, 
  products, 
  value, 
  onChange, 
  onCreateNew 
}: { 
  uncut: { rawCut: string, itemNumber: string, namePart: string }, 
  products: Product[], 
  value: string, 
  onChange: (val: string) => void, 
  onCreateNew: () => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
       const catCmp = (a.primaryCategory || '').localeCompare(b.primaryCategory || '');
       if (catCmp !== 0) return catCmp;
       return (a.name || '').localeCompare(b.name || '');
    });
  }, [products]);

  const filtered = sortedProducts.filter(p => 
    (p.name || '').toLowerCase().includes(search.toLowerCase()) || 
    p.productNumbers?.some(n => n.toLowerCase().includes(search.toLowerCase())) ||
    (p.primaryCategory || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = products.find(p => p.id === value);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isOpen]);

  const categories = Array.from(new Set(filtered.map(p => p.primaryCategory || 'Uncategorized')));

  return (
    <div className="relative w-full text-left" onClick={e => e.stopPropagation()}>
      <div 
         onClick={() => setIsOpen(!isOpen)}
         className="w-full border border-yellow-700/50 rounded-lg text-sm bg-cool-gray-850 font-semibold text-cool-gray-100 py-2.5 px-3 shadow-sm flex justify-between items-center cursor-pointer"
      >
        <span className="truncate">{selectedProduct ? selectedProduct.name : 'Select Mapping Action...'}</span>
        <ChevronDown size={16} className="text-cool-gray-400 shrink-0 ml-2" />
      </div>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-cool-gray-800 border border-cool-gray-700 rounded-lg shadow-xl overflow-hidden max-h-72 flex flex-col">
          <div className="p-2 border-b border-cool-gray-700">
            <input 
              autoFocus
              type="text" 
              placeholder="Search products..." 
              className="w-full bg-cool-gray-750 text-white border border-cool-gray-650 rounded px-3 py-2 text-sm focus:outline-hidden focus:border-cyan-500 font-medium"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="overflow-y-auto p-1 text-sm custom-scrollbar">
             <button onClick={() => { onCreateNew(); setIsOpen(false); }} className="w-full text-left px-3 py-2 text-cyan-400 font-bold hover:bg-cool-gray-750 rounded transition-colors duration-150">
                + Create as New Product in Catalog
             </button>
             
             {categories.map(cat => (
                <div key={cat} className="mb-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-cool-gray-500 uppercase tracking-widest bg-cool-gray-800/80 sticky top-0 backdrop-blur-xs">{cat}</div>
                  {filtered.filter(p => (p.primaryCategory || 'Uncategorized') === cat).map(p => (
                     <button 
                       key={p.id} 
                       onClick={() => { onChange(p.id); setIsOpen(false); }}
                       className="w-full text-left px-3 py-1.5 text-cool-gray-200 hover:bg-cool-gray-750 hover:text-white transition-colors flex items-center justify-between rounded gap-3"
                     >
                       <span className="font-semibold truncate pr-2">{p.name}</span>
                       {p.productNumbers && p.productNumbers.length > 0 && <span className="text-[10px] text-cool-gray-400 font-mono bg-cool-gray-750/50 border border-cool-gray-700 px-1.5 py-0.5 rounded shadow-xs shrink-0 whitespace-nowrap">#{p.productNumbers.join(', #')}</span>}
                     </button>
                  ))}
                </div>
             ))}
             {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-cool-gray-500 text-xs italic">
                    No matching products found.
                </div>
             )}
          </div>
        </div>
      )}
    </div>
  )
}

export const OffSiteStorageView: React.FC<OffSiteStorageViewProps> = ({
  state,
  dispatch,
  products,
  activeSubTab,
  setActiveSubTab,
  searchTerm,
  setSearchTerm,
  isAdvancedFilterOpen,
  setIsAdvancedFilterOpen,
  isDirectEdit,
  setIsDirectEdit,
  viewOriginalNames,
  setViewOriginalNames,
  filterTags,
  setFilterTags,
  filterLists,
  setFilterLists,
  viewUngrouped,
  setViewUngrouped,
  visibleColumns,
  setVisibleColumns,
  registerActions,
  isSingleUserMode,
  claimSingleUserMode,
  releaseSingleUserMode
}) => {
  const entries = (state.offSiteEntries || []).filter(e => {
    if (e.archived === true || e.archived === 1 || String(e.archived) === 'true') return false;
    if (e.box && state.containers?.some(c => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
      return false;
    }
    return true;
  });
  
  const [filteredSpreadsheetEntries, setFilteredSpreadsheetEntries] = useState<OffSiteEntry[] | null>(null);

  // Register hamburger action handlers
  React.useEffect(() => {
    if (registerActions) {
      registerActions({
        handleNewMovement,
        handleDownloadCSV: () => {
          handleDownloadCSV();
        }
      });
    }
    return () => {
      if (registerActions) {
        registerActions(null);
      }
    };
  }, [registerActions, entries, filteredSpreadsheetEntries, state.movementOrders, activeSubTab]);
  const [deleteConfirmBoxId, setDeleteConfirmBoxId] = useState<string | null>(null);
  const [showExecuteConfirm, setShowExecuteConfirm] = useState<boolean>(false);
  const [expandedLocations, setExpandedLocations] = useState<Record<string, boolean>>({});
  const [expandedPallets, setExpandedPallets] = useState<Record<string, boolean>>({});

  // New movement order creation states
  const [isCreatingMovementOrder, setIsCreatingMovementOrder] = useState(false);
  const [newOrderName, setNewOrderName] = useState('');
  const [newOrderDate, setNewOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [newOrderDesc, setNewOrderDesc] = useState('');

  const handleNewMovement = () => {
    setNewOrderName(`Relocation #${Math.floor(1000 + Math.random() * 9000)}`);
    setNewOrderDate(new Date().toISOString().split('T')[0]);
    setNewOrderDesc('');
    setIsCreatingMovementOrder(true);
  };

  const handleCreateMovementOrder = async () => {
    if (!newOrderName.trim()) return;
    const newOrder = {
      id: 'move-' + Date.now(),
      name: newOrderName.trim(),
      date: newOrderDate || new Date().toISOString().split('T')[0],
      description: newOrderDesc,
      status: 'planning' as const,
      palletsInPlay: [],
      locationsInPlay: [],
      targetDestinations: [],
      moves: []
    };
    await dispatch({ type: 'ADD_MOVEMENT_ORDER', payload: { order: newOrder } });
    setIsCreatingMovementOrder(false);
    setNewOrderName('');
    setNewOrderDesc('');
  };

  // --- INTERACTIVE LOGISTICS WORKSPACES FOR OFFSITE STORAGE ---
  const [logisticsMode, setLogisticsMode] = useState<'pickup' | 'intake' | 'rearrange'>('pickup');
  
  // Use Case 1: Pickup Planner
  const [pickupSearch, setPickupSearch] = useState('');
  const [pickupSelectedProduct, setPickupSelectedProduct] = useState<string | null>(null);
  const [pickupPinnedPallets, setPickupPinnedPallets] = useState<string[]>([]);
  
  // Use Case 2: Butcher Drop-off & Pallet Intake Map
  const [intakeTargetPallet, setIntakeTargetPallet] = useState('');
  const [intakeNewPalletName, setIntakeNewPalletName] = useState('');
  const [showIntakeNewPalletInput, setShowIntakeNewPalletInput] = useState(false);
  const [intakeDirectHomeSerials, setIntakeDirectHomeSerials] = useState<string[]>([]); // serial range/cut name to route straight Home
  const [intakeExistingTakeHomeBoxIds, setIntakeExistingTakeHomeBoxIds] = useState<string[]>([]); // box IDs to route home during trip
  
  // Use Case 3: Pallet Consolidation & Rearranging
  const [rearrangeSelectedPallets, setRearrangeSelectedPallets] = useState<string[]>([]);
  const [rearrangeCurrentLocDraft, setRearrangeCurrentLocDraft] = useState<Record<string, string>>({}); // Entry ID -> New currentLocation
  const [rearrangeMoveToDraft, setRearrangeMoveToDraft] = useState<Record<string, string>>({}); // Entry ID -> New moveTo destination
  const [rearrangeCustomDestInput, setRearrangeCustomDestInput] = useState<Record<string, string>>({}); // Entry ID -> user text
  
  // Spreadsheet Filter States
  const [palletFilters, setPalletFilters] = useState<string[]>([]);
  const [cutFilters, setCutFilters] = useState<string[]>([]);
  const [supplierFilters, setSupplierFilters] = useState<string[]>([]);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showCutDropdown, setShowCutDropdown] = useState(false);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [sortField, setSortField] = useState<keyof OffSiteEntry>('cuts');
  const [sortAsc, setSortAsc] = useState(true);

  // Form submission and inline edits
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<OffSiteEntry>>({});
  const [newEntry, setNewEntry] = useState<Partial<OffSiteEntry>>({
    serial: '',
    cuts: '',
    packDate: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
    lot: '',
    pieces: 1,
    netWeight: 0,
        box: '',
    moveTo: '',
    currentLocation: '',
    notes: ''
  });

  // Drag and Drop & paste states
  const [csvPasteText, setCsvPasteText] = useState('');
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedTargetLocation, setSelectedTargetLocation] = useState<string>('None');
  const [selectedTargetPallet, setSelectedTargetPallet] = useState<string>('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Custom modal triggers
  const [pendingImport, setPendingImport] = useState<{entries: OffSiteEntry[]} | null>(null);
  const [unmappedCuts, setUnmappedCuts] = useState<{ rawCut: string, itemNumber: string, namePart: string }[]>([]);
  const [cutMappings, setCutMappings] = useState<Record<string, string>>({});
  const [unmappedLocations, setUnmappedLocations] = useState<string[]>([]);
  const [locationMappings, setLocationMappings] = useState<Record<string, string>>({});
  const [palletMappings, setPalletMappings] = useState<Record<string, string>>({});
  const [createNewProductFor, setCreateNewProductFor] = useState<{ rawCut: string, itemNumber: string, namePart: string } | null>(null);
  const [customPrompt, setCustomPrompt] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    defaultValue: string;
    placeholder: string;
    onSave: (value: string) => void | Promise<void>;
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    if (customPrompt?.isOpen) {
      setPromptValue(customPrompt.defaultValue || '');
    }
  }, [customPrompt]);

  // Sorting & Routing Planner View States
  const [palletViewMode, setPalletViewMode] = useState<'allocation' | 'planner'>('allocation');
  const [selectedBoxFilter, setSelectedBoxFilter] = useState<'all' | 'unassigned' | 'home' | 'pallet'>('all');
  const [expandedAllocBoxes, setExpandedAllocBoxes] = useState<Record<string, boolean>>({});

  // Worksheet Condense/Expansion states
  const [sheetViewMode, setSheetViewMode] = useState<'condensed' | 'flat'>('condensed');
  const [expandedBoxes, setExpandedBoxes] = useState<Record<string, boolean>>({});
  const [expandedCuts, setExpandedCuts] = useState<Record<string, boolean>>({});

  // Active Move Scope & Logistics Planner
  const [selectedMoveLocations, setSelectedMoveLocations] = useState<string[]>(['Inbound', 'P1', 'P2', 'P3', 'Outbound']);
  const [limitToSelectedLocations, setLimitToSelectedLocations] = useState<boolean>(false);

  // Computed: Available Move/Planning locations
  const allAvailableLocations = useMemo(() => {
    const locs = new Set<string>();
    
    // Add all defined non-home locations
    const definedLocs = state.locations || [];
    definedLocs.filter(l => !l.isHome).forEach(l => {
      locs.add(l.name);
    });

    entries.forEach(e => {
      if (e.currentLocation) {
        const trimmed = e.currentLocation.trim();
        const clean = trimmed.toLowerCase();
        if (trimmed && !clean.includes('home') && clean !== 'none' && clean !== 'unassigned') {
          locs.add(trimmed);
        }
      }
      if (e.moveTo) {
        const trimmed = e.moveTo.trim();
        const clean = trimmed.toLowerCase();
        if (trimmed && !clean.includes('home') && clean !== 'none' && clean !== 'unassigned') {
          locs.add(trimmed);
        }
      }
    });

    const baseLocs = Array.from(locs).sort();
    
    // Fallback default presets if state.locations is missing/empty
    if (baseLocs.length === 0) {
      return ['Inbound', 'P1', 'P2', 'P3', 'Outbound'];
    }
    
    // Dynamic prepend/append fallback anchors
    if (!baseLocs.includes('Inbound')) baseLocs.unshift('Inbound');
    if (!baseLocs.includes('Outbound')) baseLocs.push('Outbound');
    
    return baseLocs;
  }, [entries, state.locations]);

  // Sync selectedMoveLocations to ensure we include newly added locations by default
  const [hasInitializedLocations, setHasInitializedLocations] = useState(false);
  useEffect(() => {
    if (allAvailableLocations.length > 0 && !hasInitializedLocations) {
      setSelectedMoveLocations(allAvailableLocations);
      setHasInitializedLocations(true);
    }
  }, [allAvailableLocations, hasInitializedLocations]);

  // Computed: unique existing locations + standard presets in active list
  const activeLocationsList = useMemo(() => {
    const locs = new Set<string>();
    
    // Add all defined locations (mapping custom home as 'Home')
    const definedLocs = state.locations || [];
    definedLocs.forEach(l => {
      locs.add(l.isHome ? 'Home' : l.name);
    });

    entries.forEach(e => {
      if (e.currentLocation) {
        const trimmed = e.currentLocation.trim();
        if (trimmed) locs.add(trimmed);
      }
      if (e.moveTo) {
        const trimmed = e.moveTo.trim();
        if (trimmed) locs.add(trimmed);
      }
    });
    return Array.from(locs).filter(Boolean).sort();
  }, [entries, state.locations]);

  // Grouped by Box
  const boxGroups = useMemo(() => {
    const groups: Record<string, OffSiteEntry[]> = {};
    entries.forEach(e => {
      const b = (e.box || '').trim() || 'Unassigned-Box';
      if (!groups[b]) groups[b] = [];
      groups[b].push(e);
    });

    return Object.entries(groups).map(([boxId, cuts]) => {
      const totalWeight = cuts.reduce((sum, c) => sum + (c.netWeight || 0), 0);
      const totalPieces = cuts.reduce((sum, c) => sum + (c.pieces || 1), 0);
      const lots = Array.from(new Set(cuts.map(c => c.lot).filter(Boolean))) as string[];
      
      let currentLoc = cuts[0]?.currentLocation || '';
      const isAllCurrentSame = cuts.every(c => c.currentLocation === currentLoc);
      if (!isAllCurrentSame) currentLoc = 'Mixed';

      let moveToLoc = cuts[0]?.moveTo || '';
      const isAllMoveSame = cuts.every(c => c.moveTo === moveToLoc);
      if (!isAllMoveSame) moveToLoc = 'Mixed';

      let sourceLoc = cuts[0]?.sourceLocation || '';
      const isAllSourceSame = cuts.every(c => c.sourceLocation === sourceLoc);
      if (!isAllSourceSame) sourceLoc = 'Mixed';

      return {
        boxId,
        currentLocation: currentLoc,
        moveTo: moveToLoc,
        sourceLocation: sourceLoc,
        cuts,
        totalWeight,
        totalPieces,
        lotCodes: lots
      };
    }).sort((a, b) => compareBoxLabels(a.boxId, b.boxId));
  }, [entries]);

  const handleRouteBox = async (boxId: string, destination: string) => {
    const updatedEntries = entries.map(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      if (bId === boxId) {
        return { ...e, moveTo: destination };
      }
      return e;
    });

    await dispatch({
      type: 'IMPORT_OFFSITE_ENTRIES',
      payload: { entries: updatedEntries, replaceAll: true }
    });
  };

  const handleUpdateBoxCurrentLocation = async (boxId: string, location: string) => {
    const updatedEntries = entries.map(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      if (bId === boxId) {
        return { ...e, currentLocation: location };
      }
      return e;
    });

    await dispatch({
      type: 'IMPORT_OFFSITE_ENTRIES',
      payload: { entries: updatedEntries, replaceAll: true }
    });
  };

  const handleAssignPalletLocation = async (palletName: string, locationId: string) => {
    await dispatch({
      type: 'ASSIGN_PALLET_LOCATION',
      payload: {
        palletName,
        storageLocationId: locationId === 'unassigned' ? '' : locationId
      }
    });
  };

  const handleExecuteDeliveryRoute = async () => {
    const plannedCount = entries.filter(e => e.moveTo).length;
    if (plannedCount === 0) {
      alert('You have no active "Move To" plans scheduled. Please assign routes/destinations to your boxes or cuts first.');
      return;
    }
    if (confirm(`Are you ready to finalize this transit route?\n\nThis will physically relocate ${plannedCount} cuts with a scheduled plan (Move To) so that their "Current Location" becomes that destination, and clear their Move-To draft. This represents picked-up/restocked cuts landing in their final freezer.`)) {
      const updatedEntries = entries.map(e => {
        if (e.moveTo) {
          return { ...e, currentLocation: e.moveTo, moveTo: '' };
        }
        return e;
      });

      await dispatch({
        type: 'IMPORT_OFFSITE_ENTRIES',
        payload: { entries: updatedEntries, replaceAll: true }
      });
      
      setImportMessage({
        type: 'success',
        text: `Transit route complete! Successfully delivered ${plannedCount} cuts to their active locations (Home or Pallets).`
      });
      setActiveSubTab('sheet');
    }
  };

  // --- OFFSITE SPECIALTY WORKSPACE EVENT HANDLERS ---

  // Use Case 1: Pickup Planner Pinned Pallets Toggle
  const handleTogglePinPallet = (palletId: string) => {
    setPickupPinnedPallets(prev => 
      prev.includes(palletId) ? prev.filter(p => p !== palletId) : [...prev, palletId]
    );
  };

  // Use Case 1: Multi-Entry Toggle to mark a box to come Home
  const handleToggleBoxToHome = async (boxId: string, palletId: string, isHomeNow: boolean) => {
    const nextMoveTo = isHomeNow ? '' : 'Home';
    const updatedEntries = entries.map(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      const loc = (e.currentLocation || '').trim();
      if (bId === boxId && loc.toLowerCase() === palletId.toLowerCase()) {
        return { ...e, moveTo: nextMoveTo };
      }
      return e;
    });

    await dispatch({
      type: 'IMPORT_OFFSITE_ENTRIES',
      payload: { entries: updatedEntries, replaceAll: true }
    });
  };

  // Use Case 2: Complete Intake of Butcher CSV onto selected/new pallet
  const handleCompleteIntake = async () => {
    if (!pendingImport) return;
    
    const targetLoc = showIntakeNewPalletInput ? intakeNewPalletName.trim() : intakeTargetPallet;
    if (!targetLoc) {
      alert('Please select an existing target pallet or enter a new pallet name.');
      return;
    }

    // 1. Map incoming items
    const parsedIncoming = pendingImport.entries.map(entry => {
      const identifier = entry.serial || entry.id;
      const isDirectHome = intakeDirectHomeSerials.includes(identifier);
      return {
        ...entry,
        currentLocation: isDirectHome ? 'Home' : targetLoc,
        moveTo: isDirectHome ? '' : ''
      };
    });

    // 2. Map existing items (if any are checked for taking home)
    const updatedMainEntries = entries.map(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      const loc = (e.currentLocation || '').trim();
      if (loc.toLowerCase() === intakeTargetPallet.toLowerCase()) {
        const uniqKey = `${loc}-${bId}`;
        const isTakeHome = intakeExistingTakeHomeBoxIds.includes(uniqKey);
        if (isTakeHome) {
          return { ...e, moveTo: 'Home' };
        }
      }
      return e;
    });

    // Merge incoming & main
    const finalMerged = [...updatedMainEntries, ...parsedIncoming];

    await dispatch({
      type: 'IMPORT_OFFSITE_ENTRIES',
      payload: { entries: finalMerged, replaceAll: true }
    });

    // Clear intake states
    setPendingImport(null);
    setUnmappedCuts([]);
    setCsvPasteText('');
    setIntakeDirectHomeSerials([]);
    setIntakeExistingTakeHomeBoxIds([]);
    setIntakeNewPalletName('');
    setShowIntakeNewPalletInput(false);

    setImportMessage({
      type: 'success',
      text: `Successfully mapped and created ${parsedIncoming.length} new records on pallet "${targetLoc}". Any designated "Bring Home" items are queued.`
    });
  };

  // Use Case 3: Apply Rearranging Drafts
  const handleApplyRearrangements = async () => {
    const updatedEntries = entries.map(e => {
      const pLoc = e.currentLocation || '';
      const isSelected = rearrangeSelectedPallets.includes(pLoc);
      const isUnassigned = !pLoc || pLoc.toLowerCase() === 'unassigned';

      if (isSelected || isUnassigned) {
        const draftLoc = rearrangeCurrentLocDraft[e.id] !== undefined ? rearrangeCurrentLocDraft[e.id] : e.currentLocation;
        const draftMove = rearrangeMoveToDraft[e.id] !== undefined ? rearrangeMoveToDraft[e.id] : e.moveTo;
        return {
          ...e,
          currentLocation: draftLoc,
          moveTo: draftMove
        };
      }
      return e;
    });

    await dispatch({
      type: 'IMPORT_OFFSITE_ENTRIES',
      payload: { entries: updatedEntries, replaceAll: true }
    });

    setImportMessage({
      type: 'success',
      text: 'Successfully saved and applied pallet rearrangements to the database!'
    });
  };

  // Use Case 3: Apply a quick change to drafts
  const handleDraftChange = (entryId: string, field: 'currentLocation' | 'moveTo', value: string) => {
    if (field === 'currentLocation') {
      setRearrangeCurrentLocDraft(prev => ({ ...prev, [entryId]: value }));
    } else {
      setRearrangeMoveToDraft(prev => ({ ...prev, [entryId]: value }));
    }
  };

  // Populate Seed Data if empty
  const handleLoadSeedData = async () => {
    const seed = getOffSiteSeedEntries();
    await dispatch({
      type: 'IMPORT_OFFSITE_ENTRIES',
      payload: { entries: seed }
    });
  };

  // Drag and Drop / file selector read handler
  const handleFileLoad = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setCsvPasteText(text);
        setImportMessage({
          type: 'success',
          text: `Loaded file "${file.name}" successfully! Now review target destination below and click import.`
        });
      }
    };
    reader.onerror = () => {
      setImportMessage({ type: 'error', text: 'Error encountered reading the uploaded file.' });
    };
    reader.readAsText(file);
  };

  // Sort and filter logic
  const filteredEntries = useMemo(() => {
    let list = [...entries];

    // Helper: Match entries to chosen active locations
    const isLocInScope = (loc: string | null | undefined) => {
      if (!loc) return selectedMoveLocations.includes('Inbound');
      const clean = loc.trim().toLowerCase();
      if (clean === '' || clean === 'unassigned' || clean === 'none' || clean === '0' || clean === 'staging' || clean === 'unassigned-box') {
        return selectedMoveLocations.includes('Inbound');
      }
      if (clean === 'home' || clean === 'farm' || clean === 'outbound') {
        return selectedMoveLocations.includes('Outbound');
      }
      if (clean.includes('p1')) return selectedMoveLocations.includes('P1');
      if (clean.includes('p2')) return selectedMoveLocations.includes('P2');
      if (clean.includes('p3') || clean.includes('transit')) return selectedMoveLocations.includes('P3');
      
      // Custom match
      return selectedMoveLocations.some(sel => sel.trim().toLowerCase() === clean);
    };

    // Filter by Active Logistics Move Scope if toggled
    if (limitToSelectedLocations) {
      list = list.filter(e => {
        return isLocInScope(e.currentLocation) || isLocInScope(e.moveTo);
      });
    }

    // Main search
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const activeOrder = (state.movementOrders || []).find((o: any) => o.status === 'planning' || o.status === 'finalized');
      
      const getMoveToName = (idOrName: string) => {
        if (activeOrder && activeOrder.targetDestinations) {
          const dest = activeOrder.targetDestinations.find((d: any) => d.id === idOrName);
          if (dest) {
            return `${dest.locationName}${dest.palletName ? ` (${dest.palletName})` : ''}`;
          }
        }
        return idOrName;
      };

      list = list.filter(e => {
        const matchesCuts = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').toLowerCase().includes(term);
        const matchesOriginalCut = (e.originalCutName || '').toLowerCase().includes(term);
        const matchesSerial = (e.serial || '').toLowerCase().includes(term);
        const matchesLot = (e.lot || '').toLowerCase().includes(term);
        const matchesBox = (e.box || '').toLowerCase().includes(term);
        const matchesPallet = (e.currentLocation || '').toLowerCase().includes(term);
        const matchesLocation = (e.location || '').toLowerCase().includes(term);

        let mt = e.moveTo || '';
        if (activeOrder) {
          const m = activeOrder.moves.find((mv: any) => mv.entryId === e.id);
          if (m && m.targetLocation) mt = m.targetLocation;
        }
        const moveToName = getMoveToName(mt);
        const matchesMoveTo = (moveToName || '').toLowerCase().includes(term);

        return matchesCuts || matchesOriginalCut || matchesSerial || matchesLot || matchesBox || matchesPallet || matchesLocation || matchesMoveTo;
      });
    }

    // Pallet Location filter
    if (palletFilters.length > 0) {
      list = list.filter(e => {
        const curr = (e.currentLocation || '').trim().toLowerCase();
        return palletFilters.some(filterVal => {
          if (filterVal === 'p1') return curr.includes('p1');
          if (filterVal === 'p2') return curr.includes('p2');
          if (filterVal === 'p3') return curr.includes('p3');
          if (filterVal === 'home') return curr.includes('home');
          if (filterVal === 'none') return curr === '' || curr === '0';
          return curr === filterVal.toLowerCase() || curr.includes(filterVal.toLowerCase());
        });
      });
    }

    // Supplier / Origin filter
    if (supplierFilters.length > 0) {
      list = list.filter(e => {
        const source = (e.sourceLocation || '').trim().toLowerCase() || 'unspecified';
        return supplierFilters.some(filterVal => {
          if (filterVal === 'unspecified') {
            return source === 'unspecified' || source === 'none' || source === '';
          }
          return source === filterVal.toLowerCase() || source.includes(filterVal.toLowerCase());
        });
      });
    }

    // Product Category filter
    if (cutFilters.length > 0) {
      list = list.filter(e => {
        const nameOnly = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').replace(/^\d+\s+/, '').trim().toLowerCase();
        const baseCuts = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').toLowerCase();
        return cutFilters.some(filterVal => {
          const lowerVal = filterVal.toLowerCase();
          return nameOnly === lowerVal || baseCuts.includes(lowerVal);
        });
      });
    }

    // Sorting
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'box' || (sortField as string) === 'boxId') {
        const cmp = compareBoxLabels(String(valA || ''), String(valB || ''));
        return sortAsc ? cmp : -cmp;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      
      const strA = String(valA || '').toLowerCase();
      const strB = String(valB || '').toLowerCase();
      if (strA < strB) return sortAsc ? -1 : 1;
      if (strA > strB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [entries, searchTerm, palletFilters, cutFilters, supplierFilters, sortField, sortAsc, selectedMoveLocations, limitToSelectedLocations, state.movementOrders]);

  // Group filtered entries by box, then by cuts within each box.
  const condensedBoxState = useMemo(() => {
    const boxes: Record<string, {
      boxId: string;
      entries: OffSiteEntry[];
      cutsGroups: Record<string, {
        cutName: string;
        items: OffSiteEntry[];
        sumWeight: number;
        sumPieces: number;
      }>;
    }> = {};

    filteredEntries.forEach(item => {
      const boxId = (item.box || '').trim() || 'Unassigned-Box';
      if (!boxes[boxId]) {
        boxes[boxId] = {
          boxId,
          entries: [],
          cutsGroups: {}
        };
      }
      boxes[boxId].entries.push(item);

      const cutKey = (item.cuts || '').trim() || 'Unnamed Cut';
      if (!boxes[boxId].cutsGroups[cutKey]) {
        boxes[boxId].cutsGroups[cutKey] = {
          cutName: cutKey,
          items: [],
          sumWeight: 0,
          sumPieces: 0
        };
      }
      const group = boxes[boxId].cutsGroups[cutKey];
      group.items.push(item);
      group.sumWeight += item.netWeight || 0;
      group.sumPieces += item.pieces || 1;
    });

    return Object.values(boxes).map(box => {
      const totalWeight = box.entries.reduce((sum, e) => sum + (e.netWeight || 0), 0);
      const totalPieces = box.entries.reduce((sum, e) => sum + (e.pieces || 1), 0);

      // Determine current location of Box based on its cuts
      let currentLoc = box.entries[0]?.currentLocation || '';
      const isAllCurrentSame = box.entries.every(e => e.currentLocation === currentLoc);
      if (!isAllCurrentSame) currentLoc = 'Mixed';

      // Determine moveTo of Box based on its cuts
      let moveToLoc = box.entries[0]?.moveTo || '';
      const isAllMoveSame = box.entries.every(e => e.moveTo === moveToLoc);
      if (!isAllMoveSame) {
        moveToLoc = 'Mixed';
      }

      return {
        ...box,
        totalWeight,
        totalPieces,
        currentLocation: currentLoc,
        moveTo: moveToLoc,
        cutsGroups: Object.values(box.cutsGroups)
      };
    }).sort((a, b) => compareBoxLabels(a.boxId, b.boxId));
  }, [filteredEntries]);

  // Bulk route cuts in box by cut description
  const handleRouteCutGroup = async (boxId: string, cutName: string, destination: string) => {
    const updatedEntries = entries.map(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      const cName = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').trim() || '';
      if (bId === boxId && cName === cutName) {
        return { ...e, moveTo: destination === 'None' ? '' : destination };
      }
      return e;
    });

    await dispatch({
      type: 'IMPORT_OFFSITE_ENTRIES',
      payload: { entries: updatedEntries, replaceAll: true }
    });
  };

  // Bulk update current locations of same cuts in box
  const handleUpdateCutGroupCurrentLocation = async (boxId: string, cutName: string, location: string) => {
    const updatedEntries = entries.map(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      const cName = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').trim() || '';
      if (bId === boxId && cName === cutName) {
        return { ...e, currentLocation: location === 'Unassigned' ? '' : location };
      }
      return e;
    });

    await dispatch({
      type: 'IMPORT_OFFSITE_ENTRIES',
      payload: { entries: updatedEntries, replaceAll: true }
    });
  };

  // Unique cut names for filter
  const uniqueCuts = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => {
      if ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)) {
        // Strip out front numbers if it has code (like "14082 PORK TRIM")
        const nameOnly = (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName).replace(/^\d+\s+/, '').trim();
        if (nameOnly) set.add(nameOnly);
      }
    });
    return Array.from(set).sort();
  }, [entries]);

  // Compute all suppliers/origins in database and defined list
  const allSuppliers = useMemo(() => {
    const sSet = new Set<string>();
    
    // Add custom processors
    const definedLocs = state.locations || [];
    definedLocs.filter(l => l.type === 'delivery_pickup').forEach(l => {
      sSet.add(l.name);
    });

    entries.forEach(e => {
      if (e.sourceLocation) {
        sSet.add(e.sourceLocation);
      }
    });
    return Array.from(sSet).filter(Boolean).sort();
  }, [entries, state.locations]);

  // Handle Sort Toggle
  const requestSort = (field: keyof OffSiteEntry) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Dispatch CRUD methods
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.cuts) return;

    const generatedId = newEntry.serial || `entry-${Date.now()}-${Math.random()}`;
    const locationName = newEntry.location || '';
    let storageLocationId = undefined;
    if (locationName) {
      const found = (state.locations || []).find(l => l.name.trim().toLowerCase() === locationName.trim().toLowerCase());
      if (found) {
        storageLocationId = found.id;
      }
    }

    const payloadEntry: OffSiteEntry = {
      id: generatedId,
      serial: newEntry.serial || '',
      cuts: newEntry.cuts,
      packDate: newEntry.packDate || '',
      lot: newEntry.lot || '',
      pieces: Number(newEntry.pieces) || 1,
      netWeight: Number(newEntry.netWeight) || 0,
            box: newEntry.box || '',
      moveTo: newEntry.moveTo || '',
      currentLocation: newEntry.currentLocation || '',
      pallet: newEntry.currentLocation || '',
      location: locationName,
      storageLocationId,
      notes: newEntry.notes || ''
    };

    const success = await dispatch({
      type: 'ADD_OFFSITE_ENTRY',
      payload: { entry: payloadEntry }
    });

    if (success) {
      setNewEntry({
        serial: '',
        cuts: '',
        packDate: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }),
        lot: '',
        pieces: 1,
        netWeight: 0,
                box: '',
        moveTo: '',
        currentLocation: '',
        notes: ''
      });
      setIsAdding(false);
    }
  };

  const handleStartEdit = (item: OffSiteEntry) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleSaveEdit = async (id: string) => {
    const success = await dispatch({
      type: 'UPDATE_OFFSITE_ENTRY',
      payload: { id, updates: editForm }
    });
    if (success) {
      setEditingId(null);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('Delete this offsite cut record?')) {
      await dispatch({
        type: 'DELETE_OFFSITE_ENTRY',
        payload: { id }
      });
    }
  };

  // CSV paste paste action
  const handleCsvPasteSubmit = async () => {
    if (!csvPasteText.trim()) {
      setImportMessage({ type: 'error', text: 'Please paste raw CSV data or drag & drop a file first.' });
      return;
    }

    try {
      const parsed = parseCSV(csvPasteText);
      if (parsed.length === 0) {
        setImportMessage({ type: 'error', text: 'Could not parse any rows. Check your columns and header format.' });
        return;
      }

      const unmappedProductsList: { rawCut: string, itemNumber: string, namePart: string }[] = [];
      const unmappedLocationsList: string[] = [];
      const prefilledLocationMappings: Record<string, string> = {};

      const mappedEntries = parsed.map(entry => {
        // 1. Map Cuts Product
        const match = entry.cuts.match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
        let itemNumber = '';
        let namePart = entry.cuts;
        
        if (match) {
          itemNumber = match[1];
          namePart = match[2];
        }
        
        const foundProduct = products.find(p => 
          (itemNumber && p.productNumbers?.includes(itemNumber)) || 
          p.name.toLowerCase() === namePart.toLowerCase() ||
          p.name.toLowerCase() === entry.cuts.toLowerCase()
        );

        let finalCutName = entry.cuts;
        if (foundProduct) {
          finalCutName = foundProduct.name;
        } else {
          if (!unmappedProductsList.find(u => u.rawCut === entry.cuts)) {
            unmappedProductsList.push({ rawCut: entry.cuts, itemNumber, namePart });
          }
        }

        // 2. Map Location strictly to catalog location
        let rawLoc = (entry.location || '').trim();
        let rawPallet = (entry.currentLocation || '').trim();

        // Apply global target location & pallet
        if ((!rawLoc || selectedTargetLocation !== 'None') && selectedTargetLocation && selectedTargetLocation !== 'None') {
          rawLoc = selectedTargetLocation;
        }
        if (selectedTargetPallet) {
          rawPallet = selectedTargetPallet;
        }

        let finalLocName = rawLoc;
        let finalLocId = '';

        if (rawLoc) {
          const foundLoc = (state.locations || []).find(l => l.name.trim().toLowerCase() === rawLoc.toLowerCase());
          const requiresPalletButMissing = foundLoc?.hasPallets && !rawPallet;
          
          if (foundLoc && !requiresPalletButMissing) {
            finalLocName = foundLoc.name;
            finalLocId = foundLoc.id;
          } else {
            if (!unmappedLocationsList.includes(rawLoc)) {
              unmappedLocationsList.push(rawLoc);
              if (requiresPalletButMissing && foundLoc) {
                prefilledLocationMappings[rawLoc] = foundLoc.id;
              }
            }
          }
        }

        return {
          ...entry,
          originalCutName: entry.cuts,
          cuts: finalCutName,
          productId: foundProduct ? foundProduct.id : undefined,
          location: finalLocName,
          storageLocationId: finalLocId,
          currentLocation: rawPallet
        };
      });

      if (unmappedProductsList.length > 0 || unmappedLocationsList.length > 0) {
         setPendingImport({ entries: mappedEntries });
         setUnmappedCuts(unmappedProductsList);
         setCutMappings({});
         setUnmappedLocations(unmappedLocationsList);
         setLocationMappings(prefilledLocationMappings);
         setPalletMappings({});
      } else {
         await executeImportFinal(mappedEntries, false);
      }
    } catch (err: any) {
      setImportMessage({ type: 'error', text: err.message || 'Parsing error occurred.' });
    }
  };

  const finalizeImportMapping = async () => {
    if (!pendingImport) return;
    let finalEntries = [...pendingImport.entries];

    // 1. Process Product Cut mappings
    for (const uncut of unmappedCuts) {
      const selection = cutMappings[uncut.rawCut];
      if (selection) {
        const existingProduct = products.find(p => p.id === selection);
        if (existingProduct) {
          if (uncut.itemNumber && !existingProduct.productNumbers?.includes(uncut.itemNumber)) {
            const newNumbers = [...(existingProduct.productNumbers || []), uncut.itemNumber];
            await dispatch({ type: 'EDIT_PRODUCT', payload: { productId: existingProduct.id, updates: { productNumbers: newNumbers } } });
          }
          finalEntries = finalEntries.map(e => (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) === uncut.rawCut ? { ...e, cuts: existingProduct.name, productId: existingProduct.id } : e);
        }
      }
    }

    // 2. Process Location mappings (including auto-creation of new locations!)
    const resolvedLocationsMap: Record<string, { id: string, name: string, assignedPallet?: string }> = {};

    for (const unloc of unmappedLocations) {
      const selection = locationMappings[unloc];
      if (!selection) continue;

      if (selection === '__create_storage__' || selection === '__create_partner__') {
        // Auto-create location
        const isStorage = selection === '__create_storage__';
        const generatedId = 'loc-' + Math.random().toString(36).substr(2, 9);
        
        await dispatch({
          type: 'ADD_LOCATION',
          payload: {
            id: generatedId,
            name: unloc,
            isHome: false,
            type: isStorage ? 'storage' : 'delivery_pickup'
          }
        });
        
        resolvedLocationsMap[unloc] = { id: generatedId, name: unloc };
      } else {
        // Map to existing location
        const foundLoc = (state.locations || []).find(l => l.id === selection);
        if (foundLoc) {
          resolvedLocationsMap[unloc] = { id: foundLoc.id, name: foundLoc.name, assignedPallet: palletMappings[unloc] };
        }
      }
    }

    // Update entries with the resolved location ID & Name
    finalEntries = finalEntries.map(e => {
      const rawLoc = (e.location || '').trim();
      if (rawLoc && resolvedLocationsMap[rawLoc]) {
        return {
          ...e,
          location: resolvedLocationsMap[rawLoc].name,
          storageLocationId: resolvedLocationsMap[rawLoc].id,
          currentLocation: resolvedLocationsMap[rawLoc].assignedPallet || e.currentLocation
        };
      }
      return e;
    });

    await executeImportFinal(finalEntries, false);
    setUnmappedCuts([]);
    setUnmappedLocations([]);
    setPendingImport(null);
  };

  const executeImportFinal = async (finalEntries: OffSiteEntry[], replaceAll: boolean) => {
    try {
      const success = await dispatch({
        type: 'IMPORT_OFFSITE_ENTRIES',
        payload: { entries: finalEntries, replaceAll }
      });

      if (success) {
        setImportMessage({ 
          type: 'success', 
          text: replaceAll ? `Successfully replaced entire off-site database with ${finalEntries.length} records!` : `Successfully imported ${finalEntries.length} new records! Skips any duplicate serials.` 
        });
        setCsvPasteText('');
      } else {
        setImportMessage({ type: 'error', text: 'Failed to complete import action dispatch.' });
      }
    } catch (err: any) {
      setImportMessage({ type: 'error', text: err.message || 'Parsing error occurred.' });
    }
  };

  // Export back to spreadsheet csv
  const handleDownloadCSV = () => {
    // Export whatever the current filtered view is (if sheet tab is active and we have filtered entries), otherwise fallback to entries.
    const exportSource = (activeSubTab === 'sheet' && filteredSpreadsheetEntries !== null) 
      ? filteredSpreadsheetEntries 
      : entries;

    if (exportSource.length === 0) return;
    
    // Exact user requested headers: Serial,cuts,Pack Date,Lot,# Pieces,Net Weight, Order Number,Box,location,Pallet,Notes,move to location
    const headers = 'Serial,cuts,Pack Date,Lot,# Pieces,Net Weight, Order Number,Box,location,Pallet,Notes,move to location';
    
    const escapeCSVField = (val: any) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const activeOrder = (state.movementOrders || []).find((o: any) => o.status === 'planning' || o.status === 'finalized');

    const rows = exportSource.map(e => {
      let mt = e.moveTo || '';
      if (activeOrder) {
        const m = activeOrder.moves.find((mv: any) => mv.entryId === e.id);
        if (m && m.targetLocation) mt = m.targetLocation;
      }

      return [
        escapeCSVField(e.serial),
        escapeCSVField((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)),
        escapeCSVField(e.packDate),
        escapeCSVField(e.lot),
        escapeCSVField(e.pieces),
        escapeCSVField(e.netWeight),
        escapeCSVField(e.box),
        escapeCSVField(e.location),
        escapeCSVField(e.currentLocation || e.pallet),
        escapeCSVField(e.notes),
        escapeCSVField(mt)
      ].join(',');
    });

    const csvContent = [headers, ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `offsite_cold_storage_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- ANALYTICS VIEWS COMPUTATIONS ---

  // --- OFFSITE SPECIALTY DYNAMIC SELECTORS ---

  // 1. Unique Dynamic list of Pallets in cold storage
  const allPallets = useMemo(() => {
    const pSet = new Set<string>();
    entries.forEach(e => {
      const loc = (e.currentLocation || '').trim();
      if (loc && loc.toLowerCase() !== 'home') {
        pSet.add(loc);
      }
    });
    // Default starting pallets if empty
    if (pSet.size === 0) {
      pSet.add('P1');
      pSet.add('P2');
      pSet.add('P3');
    }
    return Array.from(pSet).sort((a,b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
  }, [entries]);

  // Set default pinned & rearranged pallets once they load
  useEffect(() => {
    if (allPallets.length > 0) {
      if (pickupPinnedPallets.length === 0) {
        setPickupPinnedPallets(allPallets.slice(0, 3));
      }
      if (rearrangeSelectedPallets.length === 0) {
        setRearrangeSelectedPallets(allPallets.slice(0, 2));
      }
    }
  }, [allPallets]);

  // 2. Off-Site Product Summaries with deep Pallet breakdown mapping (Use Case 1)
  const productOffSiteSummary = useMemo(() => {
    const summary: Record<string, { name: string; totalWeight: number; totalPieces: number; palletBreakdown: Record<string, { weight: number, pieces: number }> }> = {};
    
    entries.forEach(e => {
      const prodName = (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || 'Unknown Product';
      const pLoc = (e.currentLocation || 'Unassigned').trim();
      
      if (!summary[prodName]) {
        summary[prodName] = {
          name: prodName,
          totalWeight: 0,
          totalPieces: 0,
          palletBreakdown: {}
        };
      }
      
      summary[prodName].totalWeight += e.netWeight || 0;
      summary[prodName].totalPieces += e.pieces || 1;
      
      if (!summary[prodName].palletBreakdown[pLoc]) {
        summary[prodName].palletBreakdown[pLoc] = { weight: 0, pieces: 0 };
      }
      summary[prodName].palletBreakdown[pLoc].weight += e.netWeight || 0;
      summary[prodName].palletBreakdown[pLoc].pieces += e.pieces || 1;
    });
    
    return Object.values(summary).sort((a, b) => b.totalWeight - a.totalWeight);
  }, [entries]);

  // 3. Unassigned Offsite Cuts detection
  const unassignedOffsiteCuts = useMemo(() => {
    return entries.filter(e => {
      const loc = (e.currentLocation || '').trim();
      return !loc || loc.toLowerCase() === 'unassigned' || loc.toLowerCase() === 'staging' || loc.toLowerCase() === 'staging_loose';
    });
  }, [entries]);

  // 4. Live Comparative Pivot Breakdowns (Use Case 3)
  const rearrangeLiveBreakdowns = useMemo(() => {
    const breakdown: Record<string, { weight: number; boxCount: number; items: string[] }> = {
      'Home': { weight: 0, boxCount: 0, items: [] },
      'Unassigned': { weight: 0, boxCount: 0, items: [] },
    };
    
    const palletAssignments: Record<string, { weight: number; boxCount: number }> = {};
    allPallets.forEach(p => {
      palletAssignments[p] = { weight: 0, boxCount: 0 };
    });
    
    const countedBoxesInDest = new Set<string>();
    const countedBoxesInPallet = new Set<string>();
    
    entries.forEach(e => {
      const pLoc = e.currentLocation || '';
      const isSelected = rearrangeSelectedPallets.includes(pLoc);
      const isUnassigned = !e.currentLocation || e.currentLocation.toLowerCase() === 'unassigned';
      
      if (isSelected || isUnassigned) {
        const draftLoc = rearrangeCurrentLocDraft[e.id] !== undefined ? rearrangeCurrentLocDraft[e.id] : pLoc;
        const draftMove = rearrangeMoveToDraft[e.id] !== undefined ? rearrangeMoveToDraft[e.id] : (e.moveTo || '');
        const bId = (e.box || '').trim() || 'Unassigned-Box';
        
        if (!draftLoc || draftLoc.toLowerCase() === 'unassigned') {
          breakdown['Unassigned'].weight += e.netWeight || 0;
          const uniqB = `Unassigned-${bId}`;
          if (!countedBoxesInDest.has(uniqB)) {
            countedBoxesInDest.add(uniqB);
            breakdown['Unassigned'].boxCount += 1;
          }
          breakdown['Unassigned'].items.push(`${(state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)} (${e.netWeight} lbs)`);
        } else if (draftMove === 'Home') {
          breakdown['Home'].weight += e.netWeight || 0;
          const uniqB = `Home-${bId}`;
          if (!countedBoxesInDest.has(uniqB)) {
            countedBoxesInDest.add(uniqB);
            breakdown['Home'].boxCount += 1;
          }
          breakdown['Home'].items.push(`${(state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)} (${e.netWeight} lbs)`);
        } else if (draftMove) {
          if (!breakdown[draftMove]) {
            breakdown[draftMove] = { weight: 0, boxCount: 0, items: [] };
          }
          breakdown[draftMove].weight += e.netWeight || 0;
          const uniqB = `${draftMove}-${bId}`;
          if (!countedBoxesInDest.has(uniqB)) {
            countedBoxesInDest.add(uniqB);
            breakdown[draftMove].boxCount += 1;
          }
          breakdown[draftMove].items.push(`${(state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)} (${e.netWeight} lbs)`);
        } else {
          if (!palletAssignments[draftLoc]) {
            palletAssignments[draftLoc] = { weight: 0, boxCount: 0 };
          }
          palletAssignments[draftLoc].weight += e.netWeight || 0;
          const uniqB = `${draftLoc}-${bId}`;
          if (!countedBoxesInPallet.has(uniqB)) {
            countedBoxesInPallet.add(uniqB);
            palletAssignments[draftLoc].boxCount += 1;
          }
        }
      }
    });
    
    return {
      destinations: breakdown,
      pallets: palletAssignments
    };
  }, [entries, rearrangeSelectedPallets, rearrangeCurrentLocDraft, rearrangeMoveToDraft, allPallets]);

  // Pre-populate rearranging drafts on pallet selection change
  useEffect(() => {
    const currentDraft: Record<string, string> = { ...rearrangeCurrentLocDraft };
    const moveDraft: Record<string, string> = { ...rearrangeMoveToDraft };
    let changed = false;
    
    entries.forEach(e => {
      const pLoc = e.currentLocation || '';
      if (rearrangeSelectedPallets.includes(pLoc)) {
        if (currentDraft[e.id] === undefined) {
          currentDraft[e.id] = pLoc;
          changed = true;
        }
        if (moveDraft[e.id] === undefined) {
          moveDraft[e.id] = e.moveTo || '';
          changed = true;
        }
      }
    });
    
    if (changed) {
      setRearrangeCurrentLocDraft(currentDraft);
      setRearrangeMoveToDraft(moveDraft);
    }
  }, [rearrangeSelectedPallets, entries]);

  // Dynamic Hierarchical Mapping: Storage Location -> Pallets -> Boxes -> Cuts
  const storageLocationHierarchy = useMemo(() => {
    // 1. Get all active non-home catalog locations (both storage and import/export partners)
    const definedLocs = (state.locations || []).filter(l => !l.isHome);
    
    // 2. Map of locationId -> Location summary
    const structure: Record<string, HierarchicalLocation> = {};

    definedLocs.forEach(loc => {
      structure[loc.id] = {
        locationId: loc.id,
        locationName: loc.name,
        notes: loc.notes,
        address: loc.address,
        pallets: {}
      };
    });

    structure['unassigned'] = {
      locationId: 'unassigned',
      locationName: 'Unassigned/Staging Area',
      notes: 'Pallets here have not been assigned to a physical storage warehouse location yet',
      pallets: {}
    };

    // First pass: Find the resolved storage location for each pallet
    const palletToLocationId: Record<string, string> = {};
    
    entries.forEach(e => {
      const pLoc = (e.currentLocation || '').trim();
      if (!pLoc || pLoc.toLowerCase() === 'home') return;
      
      const key = pLoc.toLowerCase();
      if (e.storageLocationId) {
        palletToLocationId[key] = e.storageLocationId;
      }
    });

    // Second pass: Group entries into the hierarchy
    entries.forEach(e => {
      const pLoc = (e.currentLocation || '').trim();
      if (!pLoc || pLoc.toLowerCase() === 'home') return;

      const palletKey = pLoc.toLowerCase();
      
      // Determine location ID
      let matchedLocId = palletToLocationId[palletKey] || e.storageLocationId || '';
      
      if (!matchedLocId) {
        if (palletKey.includes('p1')) {
          matchedLocId = 'loc-p1';
        } else if (palletKey.includes('p2')) {
          matchedLocId = 'loc-p2';
        } else if (palletKey.includes('p3')) {
          matchedLocId = 'loc-p3';
        } else {
          matchedLocId = 'unassigned';
        }
      }

      // Ensure target structure node exists
      if (!structure[matchedLocId]) {
        const foundLoc = (state.locations || []).find(l => l.id === matchedLocId);
        structure[matchedLocId] = {
          locationId: matchedLocId,
          locationName: foundLoc?.name || matchedLocId,
          notes: foundLoc?.notes,
          address: foundLoc?.address,
          pallets: {}
        };
      }

      const locNode = structure[matchedLocId];

      if (!locNode.pallets[pLoc]) {
        locNode.pallets[pLoc] = {
          palletName: pLoc,
          weight: 0,
          boxCount: 0,
          boxes: {}
        };
      }
      const palletNode = locNode.pallets[pLoc];
      palletNode.weight += e.netWeight || 0;

      const boxName = (e.box || '').trim() || 'Unassigned-Box';
      if (!palletNode.boxes[boxName]) {
        palletNode.boxes[boxName] = {
          boxId: boxName,
          lot: e.lot,
          packDate: e.packDate,
          items: [],
          weight: 0,
          pieces: 0
        };
        palletNode.boxCount += 1;
      }
      const boxNode = palletNode.boxes[boxName];
      boxNode.items.push(e);
      boxNode.weight += e.netWeight || 0;
      boxNode.pieces += e.pieces || 1;
    });

    return Object.values(structure).filter(loc => {
      return loc.locationId !== 'unassigned' || Object.keys(loc.pallets).length > 0;
    });
  }, [entries, state.locations]);

  // Pallet Allocation Metrics
  const palletStats = useMemo(() => {
    const stats: Record<string, { weight: number; boxCount: number; cutsList: Record<string, number> }> = {
      p1: { weight: 0, boxCount: 0, cutsList: {} },
      p2: { weight: 0, boxCount: 0, cutsList: {} },
      p3: { weight: 0, boxCount: 0, cutsList: {} },
      home: { weight: 0, boxCount: 0, cutsList: {} },
      other: { weight: 0, boxCount: 0, cutsList: {} }
    };

    const countedBoxes = new Set<string>();

    entries.forEach(e => {
      const loc = (e.currentLocation || '').trim().toLowerCase();
      let groupKey = 'other';
      if (loc.includes('p1')) groupKey = 'p1';
      else if (loc.includes('p2')) groupKey = 'p2';
      else if (loc.includes('p3')) groupKey = 'p3';
      else if (loc.includes('home')) groupKey = 'home';

      stats[groupKey].weight += e.netWeight || 0;

      // Group cuts
      const cleanC = (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName).replace(/^\d+\s+/, '').trim();
      stats[groupKey].cutsList[cleanC] = (stats[groupKey].cutsList[cleanC] || 0) + (e.netWeight || 0);

      // Unique box tracking
      if (e.box && e.box !== '0') {
        const uniqBoxKey = `${groupKey}-${e.box}`;
        if (!countedBoxes.has(uniqBoxKey)) {
          countedBoxes.add(uniqBoxKey);
          stats[groupKey].boxCount += 1;
        }
      }
    });

    return stats;
  }, [entries]);

  // Lot breakdown calculations
  const lotStats = useMemo(() => {
    const stats: Record<string, { weight: number, pieces: number, cuts: Record<string, number>, dates: Set<string> }> = {};
    
    entries.forEach(e => {
      const lotId = e.lot || 'No Lot Code';
      if (!stats[lotId]) {
        stats[lotId] = {
          weight: 0,
          pieces: 0,
          cuts: {},
          dates: new Set<string>()
        };
      }
      stats[lotId].weight += e.netWeight || 0;
      stats[lotId].pieces += e.pieces || 1;
      
      const cleanC = (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName).replace(/^\d+\s+/, '').trim();
      stats[lotId].cuts[cleanC] = (stats[lotId].cuts[cleanC] || 0) + (e.netWeight || 0);
      if (e.packDate) stats[lotId].dates.add(e.packDate);
    });

    return Object.entries(stats).map(([lot, data]) => ({
      lot,
      weight: data.weight,
      pieces: data.pieces,
      cuts: data.cuts,
      dates: Array.from(data.dates).join(', ')
    })).sort((a,b) => b.weight - a.weight);
  }, [entries]);

  // Handle active logistics location scope toggling
  const handleToggleMoveLocation = (loc: string) => {
    setSelectedMoveLocations(prev => {
      if (prev.includes(loc)) {
        if (prev.length === 1) return prev;
        return prev.filter(x => x !== loc);
      } else {
        return [...prev, loc];
      }
    });
  };

  // Compute stats on active logistics move selection scope
  const activeScopeMetrics = useMemo(() => {
    const isLocInScopeCurrent = (loc: string | null | undefined) => {
      if (!loc) return selectedMoveLocations.includes('Inbound');
      const clean = loc.trim().toLowerCase();
      if (clean === '' || clean === 'unassigned' || clean === 'none' || clean === '0' || clean === 'staging' || clean === 'unassigned-box') {
        return selectedMoveLocations.includes('Inbound');
      }
      if (clean === 'home' || clean === 'farm' || clean === 'outbound') {
        return selectedMoveLocations.includes('Outbound');
      }
      if (clean.includes('p1')) return selectedMoveLocations.includes('P1');
      if (clean.includes('p2')) return selectedMoveLocations.includes('P2');
      if (clean.includes('p3') || clean.includes('transit')) return selectedMoveLocations.includes('P3');
      return selectedMoveLocations.some(sel => sel.trim().toLowerCase() === clean);
    };

    const matches = entries.filter(e => isLocInScopeCurrent(e.currentLocation) || isLocInScopeCurrent(e.moveTo));
    const weight = matches.reduce((sum, e) => sum + (e.netWeight || 0), 0);
    const records = matches.length;
    const pieces = matches.reduce((sum, e) => sum + (e.pieces || 1), 0);
    
    const boxesSet = new Set<string>();
    matches.forEach(e => {
      if (e.box && e.box !== '0') boxesSet.add(e.box);
    });

    return { weight, records, pieces, boxCount: boxesSet.size };
  }, [entries, selectedMoveLocations]);

  // Compute Inbound Metrics
  const inboundSectionMetrics = useMemo(() => {
    const matched = entries.filter(e => {
      const curr = (e.currentLocation || '').trim().toLowerCase();
      return curr === '' || curr === 'none' || curr === '0' || curr === 'staging' || curr === 'unassigned' || curr === 'unassigned-box';
    });
    const weight = matched.reduce((sum, e) => sum + (e.netWeight || 0), 0);
    const boxSet = new Set<string>();
    matched.forEach(e => { if (e.box) boxSet.add(e.box); });
    return { weight, boxes: boxSet.size, pieces: matched.reduce((sum, e) => sum + (e.pieces || 1), 0) };
  }, [entries]);

  // Compute Outbound Metrics
  const outboundSectionMetrics = useMemo(() => {
    const matched = entries.filter(e => (e.moveTo || '').trim().toLowerCase() === 'home');
    const weight = matched.reduce((sum, e) => sum + (e.netWeight || 0), 0);
    const boxSet = new Set<string>();
    matched.forEach(e => { if (e.box) boxSet.add(e.box); });
    return { weight, boxes: boxSet.size, pieces: matched.reduce((sum, e) => sum + (e.pieces || 1), 0) };
  }, [entries]);

  // Compute Custom Location Card Metrics
  const customLocationsSummaries = useMemo(() => {
    const map: Record<string, { weight: number, boxes: Set<string>, pieces: number }> = {};
    selectedMoveLocations.forEach(loc => {
      if (!['Inbound', 'P1', 'P2', 'P3', 'Outbound'].includes(loc)) {
        map[loc] = { weight: 0, boxes: new Set<string>(), pieces: 0 };
      }
    });
    entries.forEach(e => {
      const curr = (e.currentLocation || '').trim();
      if (map[curr]) {
        map[curr].weight += e.netWeight || 0;
        map[curr].boxes.add(e.box || 'Unassigned');
        map[curr].pieces += e.pieces || 1;
      }
    });
    return Object.entries(map);
  }, [entries, selectedMoveLocations]);

  return (
    <div className="space-y-6" id="offsite-inventory-workspace">
      <OffSiteMovementPlanner state={state} dispatch={dispatch} />

      <div className="bg-cool-gray-850 rounded-2xl border border-cool-gray-750 shadow-xs overflow-visible" id="offsite-workspace-body">
        {entries.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-cool-gray-800 rounded-full text-cool-gray-400">
              <FolderPlus size={36} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">No Off-Site Storage Data Found</h3>
              <p className="text-sm text-cool-gray-400 max-w-md">
                Load the default attached worksheet database to start tracking your off-site pallets, boxes, and transfers.
              </p>
            </div>
            <button
              onClick={handleLoadSeedData}
              type="button"
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md cursor-pointer"
              id="btn-load-seed"
            >
              <FolderPlus size={16} />
              <span>Load Attached Worksheet Data</span>
            </button>
          </div>
        ) : (
          <>
            {/* --- SPREADSHEET VIEW --- */}
            {activeSubTab === 'sheet' && (
              <div className="p-6">
                <OffSiteSpreadsheet 
                  state={state} 
                  dispatch={dispatch} 
                  products={products} 
                  onFilteredEntriesChange={setFilteredSpreadsheetEntries}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  isAdvancedFilterOpen={isAdvancedFilterOpen}
                  setIsAdvancedFilterOpen={setIsAdvancedFilterOpen}
                  isDirectEdit={isDirectEdit}
                  setIsDirectEdit={setIsDirectEdit}
                  viewOriginalNames={viewOriginalNames}
                  setViewOriginalNames={setViewOriginalNames}
                  filterTags={filterTags}
                  setFilterTags={setFilterTags}
                  filterLists={filterLists}
                  setFilterLists={setFilterLists}
                  viewUngrouped={viewUngrouped}
                  setViewUngrouped={setViewUngrouped}
                  visibleColumns={visibleColumns}
                  setVisibleColumns={setVisibleColumns}
                />
              </div>
            )}

        {/* --- HIERARCHY VIEW --- */}
        {activeSubTab === 'hierarchy' && (
          <div className="p-6">
            <OffSiteHierarchy state={state} dispatch={dispatch} />
          </div>
        )}

        {/* --- VIEW 4: IMPORT LOGS WORKSPACE --- */}
        {activeSubTab === 'import' && (
          <div className="p-6 space-y-6" id="view-csv-import">
            {(unmappedCuts.length > 0 || unmappedLocations.length > 0) ? (
              <div className="bg-yellow-950/30 p-6 rounded-2xl border border-yellow-800/50 shadow-sm animate-fade-in space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-yellow-900 mb-2">Import Attribute Mapping Wizard</h3>
                  <p className="text-sm text-yellow-800 font-medium">
                    Please resolve the unmapped attributes from your CSV file below to ensure catalog data integrity.
                  </p>
                </div>

                {/* 1. Map Cuts to Product Catalog */}
                {unmappedCuts.length > 0 && (
                  <div className="space-y-4">
                    <div className="border-b border-yellow-800/30 pb-2">
                      <h4 className="font-bold text-sm text-yellow-100 uppercase tracking-wider">Unmapped Product Cuts ({unmappedCuts.length})</h4>
                      <p className="text-xs text-cool-gray-300 mt-1">Select the matching product from your catalog for each incoming processor cut.</p>
                    </div>

                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                      {unmappedCuts.map((uncut) => (
                        <div key={uncut.rawCut} className="bg-cool-gray-850 p-4 rounded-xl border border-yellow-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                          <div className="flex-1">
                            <div className="font-bold text-cool-gray-100 text-sm flex items-center gap-2">
                              {uncut.namePart}
                              <span className="bg-cool-gray-750 text-cool-gray-400 font-mono text-[10px] px-2 py-0.5 rounded-md font-bold border border-cool-gray-700">
                                Item #{uncut.itemNumber || 'N/A'}
                              </span>
                            </div>
                            <div className="text-xs text-cool-gray-400 mt-1 font-mono">Raw data: "{uncut.rawCut}"</div>
                          </div>
                          
                          <div className="w-full md:w-80 shrink-0">
                            <SearchableProductSelect
                              uncut={uncut}
                              products={products}
                              value={cutMappings[uncut.rawCut] || ''}
                              onChange={(val) => setCutMappings({ ...cutMappings, [uncut.rawCut]: val })}
                              onCreateNew={() => {
                                setCreateNewProductFor(uncut);
                                setCutMappings({ ...cutMappings, [uncut.rawCut]: '' });
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Map Locations to Catalog Locations */}
                {unmappedLocations.length > 0 && (
                  <div className="space-y-4">
                    <div className="border-b border-yellow-800/30 pb-2 col-span-full">
                      <h4 className="font-bold text-sm text-yellow-100 uppercase tracking-wider">Unmapped Locations ({unmappedLocations.length})</h4>
                      <p className="text-xs text-cool-gray-300 mt-1">Select an existing catalog location, or automatically create a new one in the catalog.</p>
                    </div>

                    <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                      {unmappedLocations.map((loc) => (
                        <div key={loc} className="bg-cool-gray-850 p-4 rounded-xl border border-yellow-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                          <div className="flex-1">
                            <div className="font-bold text-cool-gray-100 text-sm flex items-center gap-2">
                              📍 {loc}
                              <span className="bg-red-950/20 text-yellow-600 font-sans text-[10px] px-2 py-0.5 rounded-md font-bold border border-yellow-700/30">
                                Missing Catalog Link
                              </span>
                            </div>
                            <div className="text-xs text-cool-gray-400 mt-1">This location is in your offsite spreadsheet but missing in the Catalog.</div>
                          </div>
                          
                          <div className="w-full md:w-80 shrink-0">
                            <select
                              value={locationMappings[loc] || ''}
                              onChange={(e) => setLocationMappings({ ...locationMappings, [loc]: e.target.value })}
                              className="w-full border border-yellow-700/50 rounded-lg text-sm bg-cool-gray-850 font-semibold text-cool-gray-100 py-2.5 px-3 shadow-md outline-hidden focus:border-cyan-500 cursor-pointer"
                            >
                              <option value="">Select Catalog Connection...</option>
                              <option value="__create_storage__">➕ Create as New STORAGE Location</option>
                              <option value="__create_partner__">➕ Create as New Delivery & Receiving Partner</option>
                              {(state.locations || []).map((cl) => (
                                <option key={cl.id} value={cl.id}>
                                  Match with: {cl.name} ({cl.isHome ? 'Home' : cl.type === 'storage' ? 'Storage' : 'Delivery & Receiving'})
                                </option>
                              ))}
                            </select>
                            {(() => {
                              const selectedLocId = locationMappings[loc];
                              const selectedLoc = selectedLocId && selectedLocId !== '__create_storage__' && selectedLocId !== '__create_partner__' ? (state.locations || []).find(l => l.id === selectedLocId) : null;
                              if (selectedLoc?.hasPallets) {
                                return (
                                  <div className="mt-3 bg-cool-gray-900 border border-yellow-800/50 p-3 rounded-xl flex items-center justify-between gap-3 animate-fade-in shadow-inner">
                                    <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider">📦 Pallet:</span>
                                    <input 
                                      type="text" 
                                      placeholder="Name new or existing..." 
                                      value={palletMappings[loc] || ''} 
                                      onChange={(e) => setPalletMappings({ ...palletMappings, [loc]: e.target.value })} 
                                      className="flex-1 bg-cool-gray-850 border border-cool-gray-700 rounded-lg text-sm text-cool-gray-100 py-1.5 px-3 focus:outline-none focus:border-cyan-500"
                                      list={`pallets-${selectedLocId}`}
                                    />
                                    <datalist id={`pallets-${selectedLocId}`}>
                                      {Array.from(new Set((state.offSiteEntries || []).filter(e => !e.archived && e.location?.toLowerCase() === selectedLoc.name.toLowerCase() && e.currentLocation).map(e => e.currentLocation))).map(p => (
                                        <option key={p} value={p} />
                                      ))}
                                    </datalist>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-8 flex justify-end items-center gap-3 pt-4 border-t border-yellow-800/50">
                  <button 
                    onClick={() => { 
                      setUnmappedCuts([]); 
                      setUnmappedLocations([]);
                      setPendingImport(null); 
                      setCutMappings({}); 
                      setLocationMappings({});
                      setPalletMappings({});
                    }} 
                    className="px-5 py-2.5 text-yellow-800 hover:bg-yellow-900/50 font-bold rounded-xl transition-colors"
                  >
                    Cancel Import
                  </button>
                  <button 
                    onClick={() => finalizeImportMapping()} 
                    disabled={
                      unmappedCuts.some(c => !cutMappings[c.rawCut]) || 
                      unmappedLocations.some(l => !locationMappings[l] || ((state.locations || []).find(cl => cl.id === locationMappings[l])?.hasPallets && !(palletMappings[l] || '').trim()))
                    } 
                    className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
                  >
                    Save Mappings & Complete Import
                  </button>
                </div>
              </div>
            ) : (
              <>
            {/* File Drag and Drop zone */}
            <div className="space-y-2" id="drag-drop-container">
              <span className="block text-sm font-semibold text-cool-gray-200">Butcher CSV Spreadsheet Upload</span>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = e.dataTransfer.files;
                  if (files && files.length > 0) {
                    handleFileLoad(files[0]);
                  }
                }}
                onClick={() => {
                  document.getElementById('csv-file-picker')?.click();
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 select-none min-h-[140px] ${
                  isDragging
                    ? 'border-cyan-600 bg-cyan-950/30/30'
                    : 'border-cool-gray-650 hover:border-cyan-500/500 bg-cool-gray-800/50 hover:bg-cool-gray-800/90'
                }`}
                id="file-dropzone"
              >
                <input
                  type="file"
                  id="csv-file-picker"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      handleFileLoad(files[0]);
                    }
                  }}
                />
                <div className="p-3 bg-cool-gray-850 rounded-full border border-cool-gray-750 shadow-2xs text-cool-gray-400">
                  <Upload size={24} />
                </div>
                <div className="text-sm font-bold text-cool-gray-100">
                  Drag and drop your butcher CSV file here
                </div>
                <div className="text-xs text-cool-gray-400">
                  or <span className="text-cyan-600 font-semibold underline">browse directories</span> to find file (.csv, .txt)
                </div>
              </div>
            </div>

            {/* Assign Target Destination */}
            <div className="space-y-3 bg-cool-gray-850 p-4 border border-cool-gray-750/80 rounded-2xl" id="import-target-location-selector">
              <label className="block text-sm font-bold text-cool-gray-150 flex items-center space-x-2">
                <span>📍</span>
                <span>Assign Current Location (Override missing locations)</span>
              </label>
              <p className="text-xs text-cool-gray-400 leading-relaxed">
                If the CSV does not specify a location for an item, it will be placed here.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={selectedTargetLocation}
                  onChange={(e) => {
                    setSelectedTargetLocation(e.target.value);
                    setSelectedTargetPallet('');
                  }}
                  className="bg-cool-gray-800 text-white text-xs font-semibold rounded-xl px-3 py-2.5 border border-cool-gray-650 hover:border-cool-gray-600 outline-hidden max-w-sm cursor-pointer"
                  id="select-import-target-location"
                >
                  <option value="None">None / Use CSV Location</option>
                  {state.locations?.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name} {loc.isHome ? '(Farm / Home)' : loc.type === 'storage' ? '(Storage)' : '(Delivery & Receiving)'}
                    </option>
                  ))}
                </select>

                {(() => {
                  const targetLoc = state.locations?.find(l => l.name === selectedTargetLocation);
                  if (targetLoc?.hasPallets) {
                    return (
                      <div className="flex-1 flex items-center gap-2 bg-cool-gray-900 border border-yellow-800/50 p-2 rounded-xl">
                        <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider pl-2">📦 Pallet:</span>
                        <input 
                          type="text" 
                          placeholder="Name new or existing pallet..." 
                          value={selectedTargetPallet} 
                          onChange={(e) => setSelectedTargetPallet(e.target.value)} 
                          className="flex-1 bg-cool-gray-850 border border-cool-gray-700 rounded-lg text-sm text-cool-gray-100 py-1.5 px-3 focus:outline-none focus:border-cyan-500"
                          list="global-pallets-list"
                        />
                        <datalist id="global-pallets-list">
                          {Array.from(new Set((state.offSiteEntries || []).filter(e => !e.archived && e.location?.toLowerCase() === targetLoc.name.toLowerCase() && e.currentLocation).map(e => e.currentLocation))).map(p => (
                            <option key={p} value={p} />
                          ))}
                        </datalist>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            <div className="space-y-2" id="paste-csv-entry">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-semibold text-cool-gray-200">Raw CSV Spreadsheet Text Block</label>
                {csvPasteText && (
                  <span className="text-xs font-mono text-cool-gray-400 font-semibold">
                    {csvPasteText.split('\n').filter(Boolean).length} lines loaded
                  </span>
                )}
              </div>
              <textarea
                rows={10}
                placeholder="Paste butcher CSV block here... e.g.&#10;31229106,14082 PORK TRIM,03/12/26,1192007126,1,11.2,11920,11920-06,P3-03262026,P3-03262026"
                value={csvPasteText}
                onChange={(e) => setCsvPasteText(e.target.value)}
                className="w-full p-4 rounded-xl border border-cool-gray-700 font-mono text-xs focus:ring-2 focus:ring-cyan-900/50 focus:border-indigo-400 outline-hidden bg-cool-gray-800/50"
                id="textarea-csv-paste"
              />
            </div>

            {importMessage && (
              <div className={`p-4 rounded-xl border flex items-center space-x-2 text-xs font-medium animate-fadeIn ${
                importMessage.type === 'success' 
                  ? 'bg-emerald-950/30 text-emerald-300 border-emerald-300/50 animate-fade-in' 
                  : 'bg-red-950/30 text-red-400 border-red-800/50 animate-fade-in'
              }`} id="import-report">
                <span>{importMessage.text}</span>
              </div>
            )}

            <div className="flex space-x-2 justify-end" id="import-actions">
              <button
                type="button"
                onClick={() => setCsvPasteText('')}
                className="bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                id="btn-import-clear-input"
              >
                Clear Input
              </button>
              <button
                type="button"
                onClick={handleCsvPasteSubmit}
                className="flex items-center space-x-2 text-white px-5 py-2.5 rounded-xl text-sm font-medium bg-cyan-600 hover:bg-cyan-700 cursor-pointer transition-all shadow-xs"
                id="btn-import-dispatch"
              >
                <FileUp size={16} />
                <span>Parse and Append to Offsite Repository</span>
              </button>
            </div>
          </>
          )}
          </div>
        )}
          </>
        )}
      </div>

      {/* Create New Product Dialog from Import Mapping */}
      {createNewProductFor && (
        <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-850 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-cool-gray-750 animate-fade-in max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-white">Create New Product</h3>
            <p className="text-sm text-cool-gray-400 mb-6">
              Create a new product to map to <strong>{createNewProductFor.rawCut}</strong>.
            </p>
            <ManagementForms.ProductForm 
                dispatch={dispatch} 
                onClose={() => {
                  setCreateNewProductFor(null);
                  setCutMappings({...cutMappings, [createNewProductFor.rawCut]: ''}); // Reset UI
                }} 
                products={products} 
                state={state}
                existingProduct={{
                   id: '',
                   name: createNewProductFor.namePart,
                   primaryCategory: '',
                   subCategory: '',
                   productNumbers: createNewProductFor.itemNumber ? [createNewProductFor.itemNumber] : []
                } as Product}
                onProductCreated={(newProduct) => {
                   dispatch({ type: 'ADD_PRODUCT', payload: { product: newProduct } });
                   setCutMappings({ ...cutMappings, [createNewProductFor.rawCut]: newProduct.id });
                   setCreateNewProductFor(null);
                }} 
            />
          </div>
        </div>
      )}

      {/* --- MOVEMENT HISTORY VIEW --- */}
      {activeSubTab === 'history' && (
        <div className="p-6 animate-fade-in">
          <OffSiteMovementHistory 
            state={state} 
            dispatch={dispatch} 
            onPlanNewMovement={handleNewMovement} 
          />
        </div>
      )}

      {/* --- STAGING WORKSHEET VIEW --- */}
      {activeSubTab === 'staging-worksheet' && (
        <OffSiteStagingWorksheet 
          state={state} 
          dispatch={dispatch} 
          onFinalized={() => setActiveSubTab('sheet')} 
        />
      )}

      {/* --- ACTIVE MOVEMENT SCANNER VIEW --- */}
      {activeSubTab === 'active-movement' && (
        <div className="p-6 animate-fade-in">
          <OffSiteMovementScanner 
            state={state} 
            dispatch={dispatch} 
            isSingleUserMode={isSingleUserMode}
            claimSingleUserMode={claimSingleUserMode}
            releaseSingleUserMode={releaseSingleUserMode}
          />
        </div>
      )}

      {/* Create New Movement Order Modal */}
      {isCreatingMovementOrder && (
        <div className="fixed inset-0 z-50 bg-cool-gray-900/65 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" id="modal-create-movement">
          <div className="bg-cool-gray-850 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-cool-gray-750 animate-scale-up">
            <div className="flex justify-between items-center pb-4 border-b border-cool-gray-750">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Truck className="text-blue-400" size={18} />
                Plan New Inventory Movement
              </h3>
              <button 
                onClick={() => setIsCreatingMovementOrder(false)} 
                className="text-cool-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="space-y-4 py-4">
              {(state.movementOrders || []).find((o: any) => o.status === 'planning' || o.status === 'finalized') && (
                <div className="bg-amber-950/20 border border-amber-800/40 p-3.5 rounded-xl text-xs text-amber-300">
                  ⚠️ <strong>Active Planner In Progress:</strong> You already have an active movement order in progress. Creating a new movement will set the new order as active, but you can always access or revert completed moves later in the Movements tab.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-cool-gray-400 mb-1.5 uppercase tracking-wider">Movement ID / Name</label>
                <input 
                  type="text" 
                  value={newOrderName} 
                  onChange={e => setNewOrderName(e.target.value)} 
                  className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 font-semibold" 
                  placeholder="e.g. Inbound Delivery #402" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-cool-gray-400 mb-1.5 uppercase tracking-wider">Date</label>
                <input 
                  type="date" 
                  value={newOrderDate} 
                  onChange={e => setNewOrderDate(e.target.value)} 
                  className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 font-semibold" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-cool-gray-400 mb-1.5 uppercase tracking-wider">Description (Optional)</label>
                <input 
                  type="text" 
                  value={newOrderDesc} 
                  onChange={e => setNewOrderDesc(e.target.value)} 
                  className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 font-semibold" 
                  placeholder="Reason for movement or destination notes..." 
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-cool-gray-750">
              <button 
                onClick={() => setIsCreatingMovementOrder(false)} 
                className="px-4 py-2 rounded-xl font-bold text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 transition-colors text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateMovementOrder} 
                disabled={!newOrderName.trim()} 
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md text-sm transition-colors cursor-pointer"
              >
                Create Order Planner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Accessible Custom Prompt Overlay Modal (framing and iframe safe!) */}
      {customPrompt?.isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setCustomPrompt(null);
            }
          }}
        >
          <div className="bg-cool-gray-850 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-cool-gray-750 animate-fade-in">
            <h3 className="text-lg font-bold text-white">{customPrompt.title}</h3>
            <p className="text-sm text-cool-gray-200 mt-2">
              {customPrompt.description}
            </p>
            
            <div className="mt-4">
              <input
                type="text"
                autoFocus
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={customPrompt.placeholder}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    setCustomPrompt(null);
                    await customPrompt.onSave(promptValue);
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-cool-gray-700 focus:ring-2 focus:ring-cyan-900/50 focus:border-indigo-400 outline-hidden bg-cool-gray-800/50 text-sm font-medium"
              />
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setCustomPrompt(null)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 text-sm font-semibold rounded-xl transition duration-150 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setCustomPrompt(null);
                  await customPrompt.onSave(promptValue);
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-semibold rounded-xl transition duration duration-150 cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
