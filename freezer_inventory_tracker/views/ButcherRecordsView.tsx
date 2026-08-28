import React, { useState, useMemo, useEffect } from 'react';
import { Upload, Search, List, Trash2, ArrowRight, Edit3, X, ChevronDown, Check, CheckCircle2, FileSpreadsheet, PlusCircle, Plus, Link, ExternalLink, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import { ButcherOrder, ButcherRecord, AppLocation, Product, ButcherOrderDocument } from '../types';
import { SearchableProductSelect } from './OffSiteStorageView';
import { ManagementForms } from '../components/ManagementForms';
import { ButcherSpreadsheetView } from './ButcherSpreadsheetView';

const MultiSelectDropdown = ({ 
  options, 
  selected, 
  onChange, 
  placeholder 
}: { 
  options: string[], 
  selected: string[], 
  onChange: (selected: string[]) => void, 
  placeholder: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(x => x !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative">
      <div 
        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate text-sm">
          {selected.length > 0 ? `${selected.length} selected` : placeholder}
        </span>
        <ChevronDown size={16} className="text-cool-gray-400" />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-20 w-full mt-1 bg-cool-gray-800 border border-cool-gray-600 rounded-lg shadow-xl max-h-60 flex flex-col">
            <div className="p-2 border-b border-cool-gray-700">
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-cool-gray-900 text-white px-2 py-1 rounded text-sm outline-none border border-cool-gray-700 focus:border-cyan-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto p-1 flex-1">
              {filtered.map(opt => (
                <label key={opt} className="flex items-center gap-2 p-2 hover:bg-cool-gray-700 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="rounded bg-cool-gray-900 border-cool-gray-600 text-cyan-500 focus:ring-cyan-500"
                    checked={selected.includes(opt)}
                    onChange={() => toggleSelect(opt)}
                  />
                  <span className="text-sm text-cool-gray-200">{opt}</span>
                </label>
              ))}
              {filtered.length === 0 && <div className="p-2 text-cool-gray-500 text-sm text-center">No options found</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const NestedCategoryMultiSelect = ({ 
  primaryOptions,
  subOptions, 
  selectedPrimary,
  selectedSub,
  onChange,
  placeholder
}: {
  primaryOptions: string[],
  subOptions: Record<string, string[]>,
  selectedPrimary: string[],
  selectedSub: string[],
  onChange: (primary: string[], sub: string[]) => void,
  placeholder: string
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div 
        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate text-sm">
          {selectedPrimary.length > 0 || selectedSub.length > 0 ? `${selectedPrimary.length}P / ${selectedSub.length}S selected` : placeholder}
        </span>
        <ChevronDown size={16} className="text-cool-gray-400" />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-20 w-full mt-1 bg-cool-gray-800 border border-cool-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {primaryOptions.map(p => (
              <div key={p}>
                <label className="flex items-center gap-2 p-2 hover:bg-cool-gray-700 rounded cursor-pointer font-bold">
                  <input type="checkbox" checked={selectedPrimary.includes(p)} onChange={() => {
                    const nextPrimary = selectedPrimary.includes(p) ? selectedPrimary.filter(x => x !== p) : [...selectedPrimary, p];
                    onChange(nextPrimary, selectedSub);
                  }} />
                  {p}
                </label>
                <div className="pl-4">
                  {(subOptions[p] || []).map(s => (
                    <label key={s} className="flex items-center gap-2 p-1 hover:bg-cool-gray-700 rounded cursor-pointer text-sm">
                      <input type="checkbox" checked={selectedSub.includes(s)} onChange={() => {
                        const nextSub = selectedSub.includes(s) ? selectedSub.filter(x => x !== s) : [...selectedSub, s];
                        onChange(selectedPrimary, nextSub);
                      }} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const CreatableDropdown = ({ 
  options, 
  value = '', 
  onChange, 
  placeholder 
}: { 
  options: string[], 
  value?: string, 
  onChange: (val: string) => void, 
  placeholder: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  const filtered = options.filter(o => o.toLowerCase().includes((search || '').toLowerCase()) && o !== search);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input 
          type="text" 
          value={search || ''}
          onChange={e => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none pr-8"
        />
        <ChevronDown size={16} className="text-cool-gray-400 absolute right-3 pointer-events-none" />
      </div>
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-cool-gray-800 border border-cool-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <div 
              key={opt} 
              className="p-2 hover:bg-cool-gray-700 cursor-pointer text-sm text-cool-gray-200"
              onMouseDown={(e) => {
                e.preventDefault();
                setSearch(opt);
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PalletCreatableSelect = ({ 
  options, 
  value = '', 
  onChange, 
  placeholder = 'Select existing active pallet or type to create new...',
  destinationName = '',
  palletLocationMap = new Map<string, string>()
}: { 
  options: string[], 
  value?: string, 
  onChange: (val: string) => void, 
  placeholder?: string,
  destinationName?: string,
  palletLocationMap?: Map<string, string>
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  const trimmedSearch = (search || '').trim();
  const isExisting = options.some(o => o.toLowerCase() === (value || '').toLowerCase().trim());
  const otherLocationName = value && !isExisting ? palletLocationMap.get(value.toLowerCase().trim()) : null;
  const searchMatchesExactExisting = options.some(o => o.toLowerCase() === trimmedSearch.toLowerCase());

  const filtered = options.filter(o => 
    !trimmedSearch || o.toLowerCase().includes(trimmedSearch.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input 
          type="text" 
          value={search || ''}
          onChange={e => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 250)}
          placeholder={placeholder}
          className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-cool-gray-600 focus:ring-2 focus:ring-cyan-500 outline-none pr-14"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                onChange('');
              }}
              className="p-1 text-cool-gray-500 hover:text-white rounded transition cursor-pointer"
              title="Clear selection"
            >
              <X size={13} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-cool-gray-400 hover:text-white rounded transition cursor-pointer"
            title="Toggle options"
          >
            <ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-cool-gray-900 border border-cool-gray-700 rounded-lg shadow-2xl py-1 text-xs">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase text-cool-gray-400 bg-cool-gray-950/80 border-b border-cool-gray-800 flex justify-between items-center">
            <span>{destinationName ? `Active Pallets at ${destinationName} (${options.length})` : `Active Pallets (${options.length})`}</span>
            <span className="text-[9px] text-emerald-400 font-normal">Active at Destination</span>
          </div>

          {filtered.length > 0 ? (
            filtered.map(opt => {
              const isSelected = opt.toLowerCase() === (value || '').toLowerCase().trim();
              return (
                <div
                  key={opt}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearch(opt);
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between cursor-pointer transition ${
                    isSelected 
                      ? 'bg-cyan-950/60 text-cyan-300 font-bold' 
                      : 'text-cool-gray-200 hover:bg-cool-gray-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-cool-gray-400">📦</span>
                    <span className="font-mono">{opt}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-cyan-400" />}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2.5 text-xs text-cool-gray-400 italic">
              {options.length === 0 ? (destinationName ? `No active pallets currently at ${destinationName}. Type above to create one.` : 'No active pallets at this location.') : 'No matching active pallets found.'}
            </div>
          )}

          {trimmedSearch && !searchMatchesExactExisting && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setSearch(trimmedSearch);
                onChange(trimmedSearch);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 cursor-pointer transition flex items-center justify-between font-bold border-t border-cool-gray-800"
            >
              <div className="flex items-center gap-2">
                <PlusCircle size={14} className="text-cyan-400 shrink-0" />
                <span>+ Create New Pallet <span className="font-mono underline">"{trimmedSearch}"</span> {destinationName ? <span className="text-cool-gray-400 font-normal">at {destinationName}</span> : ''}</span>
              </div>
              <span className="text-[10px] bg-cyan-800/60 text-cyan-200 px-1.5 py-0.5 rounded font-normal">New</span>
            </div>
          )}
        </div>
      )}

      {/* Helper Status Info */}
      <div className="mt-1.5 flex flex-col gap-1 text-[11px]">
        {value ? (
          isExisting ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 w-fit">
              <Check size={11} /> Existing Pallet at {destinationName || 'Destination'}: <span className="font-mono font-bold text-white">{value}</span>
            </span>
          ) : otherLocationName ? (
            <span className="inline-flex items-center gap-1 text-amber-300 font-medium bg-amber-950/50 px-2 py-1 rounded border border-amber-800/50 leading-tight">
              <AlertTriangle size={12} className="shrink-0 text-amber-400" />
              <span>Note: Pallet <strong className="font-mono text-white">"{value}"</strong> is already at <strong>{otherLocationName}</strong>. Importing will assign this new intake batch to <strong>{destinationName || 'this destination'}</strong>.</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-cyan-400 font-medium bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 w-fit">
              <Plus size={11} /> New Pallet will be created at {destinationName || 'Destination'}: <span className="font-mono font-bold text-white">{value}</span>
            </span>
          )
        ) : (
          <span className="text-cool-gray-500">
            {destinationName ? `Select a pallet at ${destinationName} or type to create a new one.` : 'Assigns this pallet destination to all imported cuts.'}
          </span>
        )}
      </div>
    </div>
  );
};

const calculateDaysAlive = (birthDate?: string, killDate?: string) => {
  if (!birthDate || !killDate) return null;
  const birth = new Date(birthDate);
  const kill = new Date(killDate);
  if (isNaN(birth.getTime()) || isNaN(kill.getTime())) return null;
  const diffTime = kill.getTime() - birth.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : null;
};

export const ButcherRecordsView = ({ state, dispatch }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'spreadsheet' | 'import' | 'reports'>('orders');
  const [search, setSearch] = useState('');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<ButcherOrder | null>(null);
  
  // Report filters
  const [reportFilter, setReportFilter] = useState({
    startDate: '',
    endDate: '',
    orderNumber: [] as string[],
    species: [] as string[],
    cutName: [] as string[],
    primaryCategory: [] as string[],
    subCategory: [] as string[]
  });
  const [viewOriginalNames, setViewOriginalNames] = useState(false);

  // New Reporting & Graphing states
  const [reportGraphTab, setReportGraphTab] = useState<'yields' | 'weights' | 'cuts' | 'species'>('yields');
  const [selectedCutForTrend, setSelectedCutForTrend] = useState<string | null>(null);
  const [selectedCutsForTrend, setSelectedCutsForTrend] = useState<string[]>([]);
  const [cutTrendMode, setCutTrendMode] = useState<'comparison' | 'additive'>('comparison');
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [hoveredWeightPointIdx, setHoveredWeightPointIdx] = useState<number | null>(null);
  const [hoveredCutTrendIdx, setHoveredCutTrendIdx] = useState<number | null>(null);

  // Advanced Yield Calculator
  const computeOrderStats = (order: ButcherOrder, matchingRecords: ButcherRecord[]) => {
    let totalPieces = 0;
    let totalWeight = 0;
    matchingRecords.forEach(r => {
      totalPieces += r.pieces;
      totalWeight += r.netWeight;
    });

    const count = matchingRecords.length;
    const live = order.liveWeight || 0;
    const hot = order.hotWeight || 0;
    const cold = order.coldWeight || 0;
    const animalCount = Math.max(1, order.animalCount || 1);

    return {
      count,
      totalPieces,
      packagedWeight: totalWeight,
      avgPackageWeight: count > 0 ? totalWeight / count : 0,
      avgPiecesPerPackage: count > 0 ? totalPieces / count : 0,
      
      // Original Weights
      liveWeight: live,
      hotWeight: hot,
      coldWeight: cold,

      // Per Animal Weights
      liveWeightPerAnimal: live / animalCount,
      hotWeightPerAnimal: hot / animalCount,
      coldWeightPerAnimal: cold / animalCount,
      packagedWeightPerAnimal: totalWeight / animalCount,

      // Yield percentages
      hotWeightYield: live > 0 ? (hot / live) * 100 : 0,
      coolerShrinkage: hot > 0 ? ((hot - cold) / hot) * 100 : 0,
      cuttingYield: cold > 0 ? (totalWeight / cold) * 100 : 0,
      finishToLiveYield: live > 0 ? (totalWeight / live) * 100 : 0,
      finishToHotYield: hot > 0 ? (totalWeight / hot) * 100 : 0,
      finishToColdYield: cold > 0 ? (totalWeight / cold) * 100 : 0,

      // Loss weights in lbs
      totalLoss: Math.max(0, live - totalWeight),
      dressingLoss: Math.max(0, live - hot),
      coolerLoss: Math.max(0, hot - cold),
      cuttingLoss: Math.max(0, cold - totalWeight),
    };
  };
  
  // Form for import
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [importForm, setImportForm] = useState<{
    orderNumber: string;
    species: string;
    animalCount: string;
    killDate: string;
    pickupDate: string;
    birthDate: string;
    notes: string;
    liveWeight: string;
    hotWeight: string;
    coldWeight: string;
    locationId: string;
    importToOffSite: boolean;
    targetLocationId: string;
    targetPallet: string;
    documents: ButcherOrderDocument[];
    butcherFee: string;
  }>({
    orderNumber: '',
    species: '',
    animalCount: '',
    killDate: '',
    pickupDate: '',
    birthDate: '',
    notes: '',
    liveWeight: '',
    hotWeight: '',
    coldWeight: '',
    locationId: '',
    importToOffSite: false,
    targetLocationId: '',
    targetPallet: '',
    documents: [],
    butcherFee: ''
  });

  // Target order for receiving additional cuts into existing log
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const handleClearImportForm = () => {
    setCsvContent(null);
    setParsedRecords([]);
    setTargetOrderId(null);
    setPendingImport(null);
    setUnmappedCuts([]);
    setCutMappings({});
    setCreateNewProductFor(null);
    setImportForm({
      orderNumber: '',
      species: '',
      animalCount: '',
      killDate: '',
      pickupDate: '',
      birthDate: '',
      notes: '',
      liveWeight: '',
      hotWeight: '',
      coldWeight: '',
      locationId: '',
      importToOffSite: false,
      targetLocationId: '',
      targetPallet: '',
      documents: [],
      butcherFee: ''
    });
    setFileInputKey(prev => prev + 1);
  };

  // Import mapping wizard states
  const [pendingImport, setPendingImport] = useState<{order: ButcherOrder, records: ButcherRecord[]} | null>(null);
  const [unmappedCuts, setUnmappedCuts] = useState<{ rawCut: string, itemNumber: string, namePart: string }[]>([]);
  const [cutMappings, setCutMappings] = useState<Record<string, string>>({});
  const [createNewProductFor, setCreateNewProductFor] = useState<{ rawCut: string, itemNumber: string, namePart: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Document link input states
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [importNewDocName, setImportNewDocName] = useState('');
  const [importNewDocUrl, setImportNewDocUrl] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState('');
  const [editingDocUrl, setEditingDocUrl] = useState('');

  const compareOrderNumbersDesc = (a: ButcherOrder, b: ButcherOrder) => {
    const numA = (a.orderNumber || '').trim();
    const numB = (b.orderNumber || '').trim();
    if (numA && numB) {
      const cmp = numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    } else if (numB) {
      return 1;
    } else if (numA) {
      return -1;
    }
    const dateA = a.killDate || a.pickupDate || '';
    const dateB = b.killDate || b.pickupDate || '';
    if (dateA || dateB) {
      const dateCmp = dateB.localeCompare(dateA);
      if (dateCmp !== 0) return dateCmp;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  };

  const orders = useMemo(() => {
    return [...(state.butcherOrders || [])].sort(compareOrderNumbersDesc);
  }, [state.butcherOrders]);

  const locations = state.locations || [];
  const products = state.products || [];

  const records = useMemo(() => {
    return (state.butcherRecords || []).map((r: any) => {
      // Find matching product
      const orig = (r.originalCutName || '').trim();
      const norm = (r.normalizedCutName || '').trim();
      
      let matchedProd = null;
      if (norm) {
        matchedProd = products.find(prod => prod.name.trim().toLowerCase() === norm.toLowerCase());
      }

      if (!matchedProd) {
        const getPrefixNumber = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const origNum = getPrefixNumber(orig);
        if (origNum) {
          matchedProd = products.find(prod => 
            prod.productNumbers && prod.productNumbers.some(num => 
              num.toLowerCase() === origNum.toLowerCase()
            )
          );
        }
      }

      if (!matchedProd) {
        const getNamePart = (str: string) => {
          return str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
        };
        const origNamePart = getNamePart(orig);
        const normNamePart = getNamePart(norm);
        matchedProd = products.find(prod => {
          const pName = prod.name.trim().toLowerCase();
          return pName === origNamePart || 
                 pName === normNamePart ||
                 pName === orig.toLowerCase() || 
                 pName === norm.toLowerCase();
        });
      }

      return {
        ...r,
        // Lookup normalizedCutName dynamically in the product catalog!
        normalizedCutName: matchedProd ? matchedProd.name : (r.normalizedCutName || r.originalCutName),
        primaryCategory: matchedProd?.primaryCategory || 'Uncategorized',
        subCategory: matchedProd?.subCategory || 'Uncategorized',
        matchedProduct: matchedProd
      };
    });
  }, [state.butcherRecords, products]);

  const existingOrderNumbers = useMemo(() => (Array.from(new Set(orders.map(o => o.orderNumber))).filter(Boolean) as string[]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })), [orders]);
  const existingSpecies = useMemo(() => Array.from(new Set(orders.map(o => o.species))).filter(Boolean).sort(), [orders]);
  
  // Active destination location for intake
  const activeTargetLocationId = importForm.targetLocationId || importForm.locationId || '';
  const activeTargetLocation = locations.find(l => l.id === activeTargetLocationId);
  const activeTargetLocationName = activeTargetLocation?.name || '';

  // Active pallets scoped strictly to the selected destination, along with a cross-location mapping for conflict prevention
  const { existingActivePalletsForDestination, palletLocationMap } = useMemo(() => {
    const archivedPalletNames = new Set<string>();
    (state.pallets || []).forEach(p => {
      if (p.isArchived) {
        if (p.id) archivedPalletNames.add(p.id.toLowerCase().trim());
        if (p.name) archivedPalletNames.add(p.name.toLowerCase().trim());
      }
    });
    (state.freezers || []).forEach(f => {
      if (f.isArchived) {
        if (f.id) archivedPalletNames.add(f.id.replace(/^pallet-/, '').toLowerCase().trim());
        if (f.name) archivedPalletNames.add(f.name.toLowerCase().trim());
      }
    });

    const palLocMap = new Map<string, string>(); // lowerPalletName -> locationName

    // 1. From state.pallets
    (state.pallets || []).forEach(p => {
      if (!p.isArchived) {
        const name = (p.name || p.id || '').trim();
        if (name && !archivedPalletNames.has(name.toLowerCase())) {
          const loc = locations.find(l => l.id === p.storageLocationId);
          if (loc) {
            palLocMap.set(name.toLowerCase(), loc.name);
          }
        }
      }
    });

    // 2. From active (non-archived) off-site entries
    (state.offSiteEntries || []).forEach(e => {
      const isArchived = e.archived === true || e.archived === 1 || String(e.archived) === 'true';
      if (!isArchived) {
        const pName = (e.pallet || e.currentLocation || '').trim();
        if (pName && !archivedPalletNames.has(pName.toLowerCase())) {
          if (!palLocMap.has(pName.toLowerCase())) {
            const loc = locations.find(l => l.id === e.storageLocationId || (e.location && l.name.toLowerCase() === e.location.toLowerCase()));
            if (loc) {
              palLocMap.set(pName.toLowerCase(), loc.name);
            } else if (e.location) {
              palLocMap.set(pName.toLowerCase(), e.location);
            }
          }
        }
      }
    });

    // 3. From active freezers configured as pallets
    (state.freezers || []).forEach(f => {
      if ((f.isPallet || f.id.startsWith('pallet-')) && !f.isArchived) {
        const name = (f.name || f.id.replace(/^pallet-/, '') || '').trim();
        if (name && !archivedPalletNames.has(name.toLowerCase())) {
          if (!palLocMap.has(name.toLowerCase())) {
            const loc = locations.find(l => l.id === f.storageLocationId || l.isHome);
            if (loc) {
              palLocMap.set(name.toLowerCase(), loc.name);
            }
          }
        }
      }
    });

    const destinationPalletSet = new Set<string>();

    // 1. From state.pallets
    (state.pallets || []).forEach(p => {
      if (!p.isArchived) {
        const name = (p.name || p.id || '').trim();
        if (name && !archivedPalletNames.has(name.toLowerCase())) {
          const matchesLoc = activeTargetLocationId 
            ? (p.storageLocationId === activeTargetLocationId || (!p.storageLocationId && activeTargetLocation?.isHome))
            : true;
          if (matchesLoc) {
            destinationPalletSet.add(name);
          }
        }
      }
    });

    // 2. From active off-site entries
    (state.offSiteEntries || []).forEach(e => {
      const isArchived = e.archived === true || e.archived === 1 || String(e.archived) === 'true';
      if (!isArchived) {
        const pName = (e.pallet || e.currentLocation || '').trim();
        if (pName && !archivedPalletNames.has(pName.toLowerCase())) {
          const matchesLoc = activeTargetLocationId
            ? (
                (e.storageLocationId && e.storageLocationId === activeTargetLocationId) ||
                (e.location && activeTargetLocationName && e.location.trim().toLowerCase() === activeTargetLocationName.trim().toLowerCase()) ||
                (!e.storageLocationId && !e.location && activeTargetLocation?.isHome)
              )
            : true;
          if (matchesLoc) {
            destinationPalletSet.add(pName);
          }
        }
      }
    });

    // 3. From active freezers configured as pallets
    (state.freezers || []).forEach(f => {
      if ((f.isPallet || f.id.startsWith('pallet-')) && !f.isArchived) {
        const name = (f.name || f.id.replace(/^pallet-/, '') || '').trim();
        if (name && !archivedPalletNames.has(name.toLowerCase())) {
          const matchesLoc = activeTargetLocationId
            ? (
                (f.storageLocationId && f.storageLocationId === activeTargetLocationId) ||
                (!f.storageLocationId && activeTargetLocation?.isHome)
              )
            : true;
          if (matchesLoc) {
            destinationPalletSet.add(name);
          }
        }
      }
    });

    const sortedPallets = Array.from(destinationPalletSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return {
      existingActivePalletsForDestination: sortedPallets,
      palletLocationMap: palLocMap
    };
  }, [state.pallets, state.offSiteEntries, state.freezers, locations, activeTargetLocationId, activeTargetLocationName, activeTargetLocation]);
  const existingCutNames = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => {
      if (viewOriginalNames) {
        if (r.originalCutName) s.add(r.originalCutName);
      } else {
        if (r.normalizedCutName) s.add(r.normalizedCutName);
        else if (r.originalCutName) s.add(r.originalCutName);
      }
    });
    return Array.from(s).sort();
  }, [records, viewOriginalNames]);

  const existingPrimaryCategories = useMemo(() => {
    return Array.from(new Set(records.map(r => r.primaryCategory || 'Uncategorized'))).sort();
  }, [records]);

  const categoryMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    records.forEach(r => {
      const p = r.primaryCategory || 'Uncategorized';
      const s = r.subCategory || 'Uncategorized';
      if (!map[p]) map[p] = new Set();
      map[p].add(s);
    });
    const result: Record<string, string[]> = {};
    for (const p in map) {
      result[p] = Array.from(map[p]).sort();
    }
    return result;
  }, [records]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      
      Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          // Find the header row
          let headerIdx = -1;
          for (let i=0; i<results.data.length; i++) {
            const row = results.data[i] as string[];
            if (row.length > 3 && row.some(cell => cell.toLowerCase().includes('serial'))) {
              headerIdx = i;
              break;
            }
          }
          
          if (headerIdx === -1) {
            alert("Could not find header row in CSV.");
            return;
          }

          const rawData = results.data.slice(headerIdx + 1);
          const headerRow = results.data[headerIdx] as string[];
          const palletColIdx = headerRow ? headerRow.findIndex(c => String(c).toLowerCase().includes('pallet')) : -1;
          const locColIdx = headerRow ? headerRow.findIndex(c => String(c).toLowerCase().includes('location') || String(c).toLowerCase().includes('site')) : -1;
          const newRecords: any[] = [];
          
          for (const row of rawData) {
            const rowData = row as string[];
            if (rowData.length < 7) continue;
            
            // Skip summary lines or empty lines that have no cut name
            if (!rowData[1] || rowData[1].trim() === '') {
              continue;
            }

            const rowPallet = palletColIdx !== -1 ? (rowData[palletColIdx] || '') : (rowData[7] || '');
            const rowLoc = locColIdx !== -1 ? (rowData[locColIdx] || '') : '';

            // Serial,Cut,Pack Date,Lot,# Pieces,Net Weight,Box,[Pallet],[Location]
            newRecords.push({
              serial: rowData[0] || '',
              originalCutName: rowData[1] || '',
              packDate: rowData[2] || '',
              lot: rowData[3] || '',
              pieces: parseInt(rowData[4] || '0', 10) || 0,
              netWeight: parseFloat(rowData[5] || '0') || 0,
              box: rowData[6] || '',
              pallet: rowPallet ? String(rowPallet).trim() : '',
              location: rowLoc ? String(rowLoc).trim() : ''
            });
          }
          setParsedRecords(newRecords);
          
          // Try to guess order number from the top rows
          let guessedOrderNumber = '';
          for (let i=0; i<headerIdx; i++) {
            const r = results.data[i] as string[];
            for (const cell of r) {
              if (cell && !isNaN(Number(cell.trim()))) {
                guessedOrderNumber = cell.trim();
              }
            }
          }
          if (guessedOrderNumber && !importForm.orderNumber) {
            setImportForm(prev => ({...prev, orderNumber: guessedOrderNumber}));
          }
        }
      });
    };
    reader.readAsText(file);
  };

  const handleStartReceiveMoreCuts = (order: ButcherOrder) => {
    setTargetOrderId(order.id);
    setImportForm({
      orderNumber: order.orderNumber || '',
      species: order.species || '',
      animalCount: order.animalCount ? String(order.animalCount) : '',
      killDate: order.killDate || '',
      pickupDate: order.pickupDate || '',
      birthDate: order.birthDate || '',
      notes: order.notes || '',
      liveWeight: order.liveWeight ? String(order.liveWeight) : '',
      hotWeight: order.hotWeight ? String(order.hotWeight) : '',
      coldWeight: order.coldWeight ? String(order.coldWeight) : '',
      locationId: order.locationId || '',
      importToOffSite: true,
      targetLocationId: order.locationId || '',
      targetPallet: '',
      documents: order.documents || [],
      butcherFee: order.butcherFee ? String(order.butcherFee) : ''
    });
    setActiveTab('import');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateTempOrderNumber = () => {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    return `TEMP-${today}-${rand}`;
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.species || !importForm.species.trim()) {
      alert("Species is required to start a butcher order.");
      return;
    }

    if (targetOrderId && !parsedRecords.length) {
      alert("Please upload a CSV cutsheet file to receive additional cuts into an existing order.");
      return;
    }
    
    const existingTargetOrder = targetOrderId ? orders.find(o => o.id === targetOrderId) : null;
    const orderId = targetOrderId || crypto.randomUUID();
    const finalOrderNumber = (importForm.orderNumber || '').trim() || (existingTargetOrder ? existingTargetOrder.orderNumber : generateTempOrderNumber());

    const newOrder: ButcherOrder = {
      id: orderId,
      orderNumber: finalOrderNumber,
      species: importForm.species.trim(),
      animalCount: importForm.animalCount ? parseInt(importForm.animalCount) : undefined,
      killDate: importForm.killDate || '',
      pickupDate: importForm.pickupDate || '',
      birthDate: importForm.birthDate || '',
      notes: importForm.notes || '',
      liveWeight: parseFloat(importForm.liveWeight) || 0,
      hotWeight: parseFloat(importForm.hotWeight) || 0,
      coldWeight: parseFloat(importForm.coldWeight) || 0,
      locationId: importForm.locationId || undefined,
      createdAt: existingTargetOrder ? existingTargetOrder.createdAt : Date.now(),
      documents: importForm.documents || [],
      butcherFee: parseFloat(importForm.butcherFee) || 0
    };

    // If starting order without CSV (e.g. at animal drop-off)
    if (!parsedRecords.length) {
      executeImportFinal(newOrder, []);
      return;
    }
    
    const unmappedList: { rawCut: string, itemNumber: string, namePart: string }[] = [];
    const seenUnmapped = new Set<string>();

    const newRecords: ButcherRecord[] = parsedRecords.map(r => {
      // Find matching product
      let normalizedCutName = '';
      const originalCutsStr = r.originalCutName.trim();
      let itemNumber = '';
      let namePart = originalCutsStr;
      
      const numMatch = originalCutsStr.match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
      if (numMatch) {
        itemNumber = numMatch[1];
        namePart = numMatch[2];
      }
      
      const matchedProduct = products.find(p => 
        (itemNumber && p.productNumbers?.includes(itemNumber)) ||
        p.name.toLowerCase() === namePart.toLowerCase() ||
        p.name.toLowerCase() === originalCutsStr.toLowerCase()
      );
      
      if (matchedProduct) {
        normalizedCutName = matchedProduct.name;
      } else {
        normalizedCutName = namePart;
        if (!seenUnmapped.has(originalCutsStr)) {
          seenUnmapped.add(originalCutsStr);
          unmappedList.push({ rawCut: originalCutsStr, itemNumber, namePart });
        }
      }
      
      const targetLocName = importForm.targetLocationId ? (locations.find(l => l.id === importForm.targetLocationId)?.name || '') : '';

      return {
        id: crypto.randomUUID(),
        orderId,
        serial: r.serial,
        productId: matchedProduct ? matchedProduct.id : undefined,
        originalCutName: r.originalCutName,
        normalizedCutName,
        packDate: r.packDate,
        lot: r.lot,
        pieces: r.pieces,
        netWeight: r.netWeight,
        box: finalOrderNumber ? `${finalOrderNumber}-${r.box}` : r.box,
        importedToOffSite: importForm.importToOffSite,
        pallet: r.pallet || importForm.targetPallet || '',
        location: r.location || targetLocName || ''
      };
    });

    if (unmappedList.length > 0) {
      setPendingImport({ order: newOrder, records: newRecords });
      setUnmappedCuts(unmappedList);
      setCutMappings({});
    } else {
      executeImportFinal(newOrder, newRecords);
    }
  };

  const executeImportFinal = (order: ButcherOrder, records: ButcherRecord[]) => {
    const selectedTargetLoc = importForm.targetLocationId ? locations.find(l => l.id === importForm.targetLocationId) : null;
    const targetLocName = selectedTargetLoc ? selectedTargetLoc.name : undefined;

    dispatch({
      type: 'ADD_BUTCHER_ORDER',
      payload: { 
        order, 
        records,
        targetLocation: targetLocName || order.locationId,
        targetPallet: importForm.targetPallet
      }
    });

    // Reset
    setCsvContent(null);
    setParsedRecords([]);
    setTargetOrderId(null);
    setImportForm({
      orderNumber: '',
      species: '',
      animalCount: '',
      killDate: '',
      pickupDate: '',
      birthDate: '',
      notes: '',
      liveWeight: '',
      hotWeight: '',
      coldWeight: '',
      locationId: '',
      importToOffSite: false,
      targetLocationId: '',
      targetPallet: '',
      documents: [],
      butcherFee: ''
    });
    setActiveTab('orders');
  };

  const finalizeImportMapping = async () => {
    if (!pendingImport) return;
    
    let finalRecords = [...pendingImport.records];
    
    for (const uncut of unmappedCuts) {
      const selection = cutMappings[uncut.rawCut];
      if (selection) {
        const existingProduct = products.find(p => p.id === selection);
        if (existingProduct) {
          if (uncut.itemNumber && !existingProduct.productNumbers?.includes(uncut.itemNumber)) {
            const newNumbers = [...(existingProduct.productNumbers || []), uncut.itemNumber];
            await dispatch({ type: 'EDIT_PRODUCT', payload: { productId: existingProduct.id, updates: { productNumbers: newNumbers } } });
          }
          finalRecords = finalRecords.map(r => r.originalCutName.trim() === uncut.rawCut ? { ...r, normalizedCutName: existingProduct.name, productId: existingProduct.id } : r);
        }
      }
    }
    
    executeImportFinal(pendingImport.order, finalRecords);
    setPendingImport(null);
    setUnmappedCuts([]);
    setCutMappings({});
  };

  const filteredOrders = useMemo(() => {
    let res = [...orders];
    if (search) {
      const lower = search.toLowerCase();
      res = res.filter(o => o.orderNumber.toLowerCase().includes(lower) || o.species.toLowerCase().includes(lower));
    }
    return res.sort(compareOrderNumbersDesc);
  }, [orders, search]);

  const getOrderStats = (orderId: string) => {
    const matchingRecords = records.filter(r => r.orderId === orderId);
    let totalPieces = 0;
    let totalWeight = 0;
    matchingRecords.forEach(r => {
      totalPieces += r.pieces;
      totalWeight += r.netWeight;
    });
    return { count: matchingRecords.length, totalPieces, totalWeight };
  };

  const getCutBreakdown = (orderId: string) => {
    const matchingRecords = records.filter(r => r.orderId === orderId);
    const breakdown: Record<string, { count: number, totalPieces: number, totalWeight: number }> = {};
    
    matchingRecords.forEach(r => {
      const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
      if (!breakdown[name]) {
        breakdown[name] = { count: 0, totalPieces: 0, totalWeight: 0 };
      }
      breakdown[name].count += 1;
      breakdown[name].totalPieces += r.pieces;
      breakdown[name].totalWeight += r.netWeight;
    });
    
    return Object.entries(breakdown)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.totalWeight - a.totalWeight);
  };

  const aggregateStats = useMemo(() => {
    let totalOrders = filteredOrders.length;
    let totalPieces = 0;
    let totalWeight = 0;
    
    filteredOrders.forEach(o => {
      const stats = getOrderStats(o.id);
      totalPieces += stats.totalPieces;
      totalWeight += stats.totalWeight;
    });
    
    return { totalOrders, totalPieces, totalWeight };
  }, [filteredOrders, records]);

  const reportData = useMemo(() => {
    // Filter orders
    let matchedOrders = [...orders];
    
    if (reportFilter.startDate) {
      matchedOrders = matchedOrders.filter(o => o.killDate >= reportFilter.startDate || o.pickupDate >= reportFilter.startDate);
    }
    if (reportFilter.endDate) {
      matchedOrders = matchedOrders.filter(o => (o.killDate && o.killDate <= reportFilter.endDate) || (o.pickupDate && o.pickupDate <= reportFilter.endDate));
    }
    if (reportFilter.orderNumber.length > 0) {
      matchedOrders = matchedOrders.filter(o => reportFilter.orderNumber.some(val => o.orderNumber.toLowerCase().includes(val.toLowerCase())));
    }
    if (reportFilter.species.length > 0) {
      matchedOrders = matchedOrders.filter(o => reportFilter.species.some(val => o.species.toLowerCase().includes(val.toLowerCase())));
    }
    
    const matchedOrderIds = new Set(matchedOrders.map(o => o.id));
    
    // Filter records
    let matchedRecords = records.filter(r => matchedOrderIds.has(r.orderId));
    
    if (reportFilter.cutName.length > 0) {
      matchedRecords = matchedRecords.filter(r => {
        const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
        return reportFilter.cutName.some(val => name.toLowerCase() === val.toLowerCase());
      });
    }

    if (reportFilter.primaryCategory.length > 0) {
      matchedRecords = matchedRecords.filter(r => {
        return reportFilter.primaryCategory.some(val => (r.primaryCategory || 'Uncategorized').toLowerCase() === val.toLowerCase());
      });
    }

    if (reportFilter.subCategory.length > 0) {
      matchedRecords = matchedRecords.filter(r => {
        return reportFilter.subCategory.some(val => (r.subCategory || 'Uncategorized').toLowerCase() === val.toLowerCase());
      });
    }

    // Aggregate
    const breakdown: Record<string, { count: number, totalPieces: number, totalWeight: number }> = {};
    let grandTotalPieces = 0;
    let grandTotalWeight = 0;
    
    matchedRecords.forEach(r => {
      const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
      if (!breakdown[name]) {
        breakdown[name] = { count: 0, totalPieces: 0, totalWeight: 0 };
      }
      breakdown[name].count += 1;
      breakdown[name].totalPieces += r.pieces;
      breakdown[name].totalWeight += r.netWeight;
      
      grandTotalPieces += r.pieces;
      grandTotalWeight += r.netWeight;
    });
    
    const sortedBreakdown = Object.entries(breakdown)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.totalWeight - a.totalWeight);
      
    const totalAnimals = matchedOrders.reduce((sum, o) => sum + Math.max(1, o.animalCount || 1), 0);
      
    return {
      orderCount: matchedOrders.length,
      animalCount: totalAnimals,
      recordCount: matchedRecords.length,
      totalPieces: grandTotalPieces,
      totalWeight: grandTotalWeight,
      breakdown: sortedBreakdown
    };
  }, [orders, records, reportFilter]);

  return (
    <div id="butcher-records-view" className="flex-1 overflow-auto bg-cool-gray-900 text-cool-gray-200">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Butcher Records</h1>
            <p className="text-cool-gray-400 text-sm">Manage incoming processing logs and order statistics.</p>
          </div>
          
          <div className="flex bg-cool-gray-800 p-1 rounded-xl shrink-0 self-start flex-wrap gap-1">
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'orders' ? 'bg-cyan-600 text-white shadow-sm' : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-700'
              }`}
            >
              <List size={16} />
              Logs
            </button>
            <button
              onClick={() => setActiveTab('spreadsheet')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'spreadsheet' ? 'bg-cyan-600 text-white shadow-sm' : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-700'
              }`}
            >
              <FileSpreadsheet size={16} />
              Spreadsheet
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'reports' ? 'bg-cyan-600 text-white shadow-sm' : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              Reports
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${
                activeTab === 'import' ? 'bg-cyan-600 text-white shadow-sm' : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-700'
              }`}
            >
              <PlusCircle size={16} />
              New Order
            </button>
          </div>
        </div>

        {activeTab === 'spreadsheet' && (
          <ButcherSpreadsheetView state={state} dispatch={dispatch} />
        )}

        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cool-gray-500" size={18} />
                <input
                  type="text"
                  placeholder="Search orders..."
                  className="w-full bg-cool-gray-800 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-cool-gray-700 transition"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-cool-gray-400 hover:text-cool-gray-300 transition-colors shrink-0">
                <input 
                  type="checkbox"
                  className="rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-4 h-4 shrink-0"
                  checked={viewOriginalNames}
                  onChange={(e) => { setViewOriginalNames(e.target.checked); setReportFilter(prev => ({...prev, cutName: []})); }}
                />
                VIEW RAW CSV ITEM NAMES
              </label>
            </div>

            {/* Aggregate Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Orders</span>
                <span className="text-3xl font-extrabold text-white">{aggregateStats.totalOrders}</span>
              </div>
              <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Pieces</span>
                <span className="text-3xl font-extrabold text-white">{aggregateStats.totalPieces}</span>
              </div>
              <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Net Weight</span>
                <span className="text-3xl font-extrabold text-cyan-400">{aggregateStats.totalWeight.toFixed(2)} lbs</span>
              </div>
            </div>
            
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 bg-cool-gray-800/50 rounded-2xl border border-cool-gray-700">
                  <p className="text-cool-gray-400">No butcher orders found.</p>
                </div>
              ) : (
                filteredOrders.map(order => {
                  const loc = locations.find(l => l.id === order.locationId);
                  const stats = getOrderStats(order.id);
                  
                  return (
                    <div key={order.id} className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl overflow-hidden">
                      <div className="p-4 sm:p-6 flex flex-col lg:flex-row justify-between gap-6">
                        <div className="space-y-4 flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="text-xl font-extrabold text-white">Order #{order.orderNumber}</h2>
                                <span className="px-2 py-1 bg-[#9ca7b5] text-cool-gray-300 rounded text-xs font-bold uppercase tracking-wider">
                                  {order.species}
                                </span>
                                {stats.count === 0 && (
                                  <span className="px-2.5 py-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                                    Pending Cuts (Drop-Off)
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-cool-gray-400 mt-1">
                                {loc ? <span className="text-cyan-400 font-medium">{loc.name}</span> : <span>Unknown Butcher</span>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartReceiveMoreCuts(order);
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 ${
                                  stats.count === 0
                                    ? 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                                } rounded-xl text-xs font-bold transition cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]`}
                                title={stats.count === 0 ? "Upload cutsheet CSV for this drop-off order" : "Receive additional cuts into this existing butcher log"}
                              >
                                {stats.count === 0 ? <Upload size={15} /> : <PlusCircle size={15} />}
                                <span>{stats.count === 0 ? 'Upload Cutsheet CSV' : 'Receive Additional Cuts'}</span>
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingOrder(order);
                                }}
                                className="p-2 text-cool-gray-500 hover:text-cyan-400 hover:bg-cool-gray-700 rounded-lg transition"
                                title="Edit order details"
                              >
                                <Edit3 size={18} />
                              </button>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(order.id);
                              }}
                              className="p-2 text-cool-gray-500 hover:text-red-400 hover:bg-cool-gray-700 rounded-lg transition"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 bg-cool-gray-900/50 p-4 rounded-xl">
                            <div>
                              <p className="text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider">Birth Date</p>
                              <p className="text-sm text-cool-gray-200 font-medium">{order.birthDate || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider">Kill Date</p>
                              <p className="text-sm text-cool-gray-200 font-medium">{order.killDate || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider">Days Alive</p>
                              <p className="text-sm text-cyan-400 font-bold">
                                {order.birthDate && order.killDate ? (() => {
                                  const days = calculateDaysAlive(order.birthDate, order.killDate);
                                  return days !== null ? `${days} days` : '-';
                                })() : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider">Pickup Date</p>
                              <p className="text-sm text-cool-gray-200 font-medium">{order.pickupDate || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider">Animals</p>
                              <p className="text-sm text-cool-gray-200 font-medium">{order.animalCount || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider">Live Wt.</p>
                              <p className="text-sm text-cool-gray-200 font-medium">{order.liveWeight ? `${order.liveWeight} lbs` : '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider">Yield (Cold/Live)</p>
                              <p className="text-sm text-emerald-400 font-bold">
                                {order.liveWeight && order.coldWeight ? ((order.coldWeight / order.liveWeight) * 100).toFixed(1) + '%' : '-'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider">Butcher Fee</p>
                              <p className="text-sm text-cyan-400 font-bold">
                                {order.butcherFee !== undefined && order.butcherFee > 0 ? `$${Number(order.butcherFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                              </p>
                            </div>
                          </div>

                          {order.notes && (
                            <div className="text-xs bg-cool-gray-900/40 border border-cool-gray-750 p-3 rounded-lg text-cool-gray-300">
                              <span className="font-bold text-cool-gray-400 block mb-1">Notes:</span>
                              <p className="whitespace-pre-line">{order.notes}</p>
                            </div>
                          )}

                           {order.documents && order.documents.length > 0 && (
                            <div className="bg-cool-gray-900/40 border border-cool-gray-750 p-3 rounded-lg">
                              <span className="font-bold text-cool-gray-400 block mb-2 text-[10px] uppercase tracking-wider">Attached Documents</span>
                              <div className="flex flex-wrap gap-2">
                                {order.documents.map((doc: any) => (
                                  <a
                                    key={doc.id}
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-cool-gray-950 hover:bg-cool-gray-900 text-cool-gray-100 hover:text-cyan-400 border border-cool-gray-850 hover:border-cyan-500/30 rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-sm group"
                                  >
                                    <Link size={13} className="text-cyan-500 group-hover:text-cyan-400 shrink-0" />
                                    <span className="truncate max-w-[180px]">{doc.name}</span>
                                    <ExternalLink size={12} className="text-cool-gray-600 group-hover:text-cyan-400 transition shrink-0" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        
                        <div className="w-full lg:w-64 shrink-0 bg-cool-gray-900 rounded-xl p-4 flex flex-col justify-center">
                          <h3 className="text-xs font-bold text-cool-gray-500 uppercase tracking-wider mb-3">Order Statistics</h3>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-cool-gray-400">Total Records</span>
                              <span className="text-white font-bold">{stats.count}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-cool-gray-400">Total Pieces</span>
                              <span className="text-white font-bold">{stats.totalPieces}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-cool-gray-400">Net Weight</span>
                              <span className="text-white font-bold">{stats.totalWeight.toFixed(2)} lbs</span>
                            </div>
                            <div className="flex justify-between items-center text-sm border-t border-cool-gray-800/60 pt-1.5 mt-1.5">
                              <span className="text-cool-gray-400 font-medium">Butcher Fee</span>
                              <span className="text-cyan-400 font-extrabold">
                                {order.butcherFee !== undefined && order.butcherFee > 0 ? `$${Number(order.butcherFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                              </span>
                            </div>
                            {order.butcherFee !== undefined && order.butcherFee > 0 && stats.totalWeight > 0 && (
                              <div className="flex justify-between items-center text-[11px] bg-cool-gray-950/40 p-1.5 rounded border border-cool-gray-800 mt-1">
                                <span className="text-cool-gray-500 font-bold uppercase tracking-wider text-[9px]">Cost / packaged lb</span>
                                <span className="text-emerald-400 font-bold">
                                  ${(order.butcherFee / stats.totalWeight).toFixed(2)}/lb
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Breakdown Toggle */}
                      <div className="border-t border-cool-gray-700 p-2 sm:px-6 flex justify-center bg-cool-gray-800/80">
                        <button
                          onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                          className="text-xs font-bold text-cool-gray-400 hover:text-white transition flex items-center gap-1 uppercase tracking-widest"
                        >
                          {expandedOrder === order.id ? 'Hide Yields & Cut Breakdown' : 'View Yields & Cut Breakdown'}
                        </button>
                      </div>

                      {expandedOrder === order.id && (() => {
                        const orderRecords = records.filter(r => r.orderId === order.id);
                        const oStats = computeOrderStats(order, orderRecords);
                        const breakdown = getCutBreakdown(order.id);
                        
                        return (
                          <div className="border-t border-cool-gray-700 bg-cool-gray-950 p-4 sm:p-6 space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Left Pane: Yield & Performance Dashboard */}
                              <div className="space-y-4">
                                <h4 className="text-xs font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan-400"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                                  Yield & Carcass Performance
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="bg-cool-gray-900 border border-cool-gray-800 p-3 rounded-xl">
                                    <div className="text-cool-gray-400 text-[10px] font-bold uppercase tracking-wider">Hot Weight Yield</div>
                                    <div className="text-base font-extrabold text-white mt-1">
                                      {oStats.hotWeightYield > 0 ? `${oStats.hotWeightYield.toFixed(1)}%` : '-'}
                                    </div>
                                    <div className="text-[9px] text-cool-gray-500 mt-0.5">Hot Carcass / Live weight</div>
                                  </div>

                                  <div className="bg-cool-gray-900 border border-cool-gray-800 p-3 rounded-xl">
                                    <div className="text-cool-gray-400 text-[10px] font-bold uppercase tracking-wider">Cooler Shrinkage</div>
                                    <div className="text-base font-extrabold text-rose-400 mt-1">
                                      {oStats.coolerShrinkage > 0 ? `${oStats.coolerShrinkage.toFixed(1)}%` : '-'}
                                    </div>
                                    <div className="text-[9px] text-cool-gray-500 mt-0.5">Hot vs. Cold hanging loss</div>
                                  </div>

                                  <div className="bg-cool-gray-900 border border-cool-gray-800 p-3 rounded-xl">
                                    <div className="text-cool-gray-400 text-[10px] font-bold uppercase tracking-wider">Cutting Yield</div>
                                    <div className="text-base font-extrabold text-emerald-400 mt-1">
                                      {oStats.cuttingYield > 0 ? `${oStats.cuttingYield.toFixed(1)}%` : '-'}
                                    </div>
                                    <div className="text-[9px] text-cool-gray-500 mt-0.5">Packaged meat / Cold weight</div>
                                  </div>

                                  <div className="bg-cool-gray-900 border border-cool-gray-800 p-3 rounded-xl">
                                    <div className="text-cool-gray-400 text-[10px] font-bold uppercase tracking-wider">Total Finished Yield</div>
                                    <div className="text-base font-extrabold text-cyan-400 mt-1">
                                      {oStats.finishToLiveYield > 0 ? `${oStats.finishToLiveYield.toFixed(1)}%` : '-'}
                                    </div>
                                    <div className="text-[9px] text-cool-gray-500 mt-0.5">Packaged meat / Live weight</div>
                                  </div>
                                </div>

                                <div className="bg-cool-gray-900 border border-cool-gray-800 p-4 rounded-xl space-y-3">
                                  <h5 className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-widest">Weight Loss & Yield Journey</h5>
                                  <div className="space-y-3">
                                    {/* Live Weight */}
                                    <div>
                                      <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                        <span>Live Weight</span>
                                        <span className="font-bold text-white">{oStats.liveWeight ? `${oStats.liveWeight.toFixed(1)} lbs` : 'Not specified'}</span>
                                      </div>
                                      <div className="w-full h-2 bg-cool-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-500 rounded-full" style={{ width: oStats.liveWeight ? '100%' : '0%' }}></div>
                                      </div>
                                    </div>

                                    {/* Hot Weight */}
                                    {oStats.hotWeight > 0 && (
                                      <div>
                                        <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                          <span className="flex items-center gap-1.5">
                                            Hot Carcass Weight
                                            <span className="text-[9px] text-orange-400 bg-orange-950/40 px-1 py-0.5 rounded border border-orange-800/30 font-bold">
                                              -{oStats.dressingLoss.toFixed(1)} lbs Dressing Loss
                                            </span>
                                          </span>
                                          <span className="font-bold text-white">{oStats.hotWeight.toFixed(1)} lbs ({oStats.hotWeightYield.toFixed(1)}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-cool-gray-800 rounded-full overflow-hidden">
                                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${oStats.hotWeightYield}%` }}></div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Cold Weight */}
                                    {oStats.coldWeight > 0 && (
                                      <div>
                                        <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                          <span className="flex items-center gap-1.5">
                                            Cold Carcass Weight
                                            <span className="text-[9px] text-red-400 bg-red-950/40 px-1 py-0.5 rounded border border-red-800/30 font-bold">
                                              -{oStats.coolerLoss.toFixed(1)} lbs Hanging Loss ({oStats.coolerShrinkage.toFixed(1)}%)
                                            </span>
                                          </span>
                                          <span className="font-bold text-white">
                                            {oStats.coldWeight.toFixed(1)} lbs ({oStats.liveWeight > 0 ? ((oStats.coldWeight / oStats.liveWeight) * 100).toFixed(1) : '100'}%)
                                          </span>
                                        </div>
                                        <div className="w-full h-2 bg-cool-gray-800 rounded-full overflow-hidden">
                                          <div className="h-full bg-indigo-500 rounded-full" style={{ width: oStats.liveWeight > 0 ? `${(oStats.coldWeight / oStats.liveWeight) * 100}%` : '100%' }}></div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Packaged Weight */}
                                    <div>
                                      <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                        <span className="flex items-center gap-1.5">
                                          Take-Home Packaged
                                          {oStats.coldWeight > 0 && (
                                            <span className="text-[9px] text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded border border-emerald-800/30 font-bold">
                                              -{oStats.cuttingLoss.toFixed(1)} lbs Cutting Loss
                                            </span>
                                          )}
                                        </span>
                                        <span className="font-bold text-cyan-400">
                                          {oStats.packagedWeight.toFixed(1)} lbs ({oStats.finishToLiveYield.toFixed(1)}%)
                                        </span>
                                      </div>
                                      <div className="w-full h-2 bg-cool-gray-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${oStats.finishToLiveYield}%` }}></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {!oStats.liveWeight && !oStats.hotWeight && !oStats.coldWeight && (
                                  <div className="text-[11px] text-cool-gray-400 bg-cool-gray-950 p-3 rounded-lg border border-cool-gray-800/50">
                                    💡 <span className="text-cool-gray-300 font-bold">Pro-tip:</span> Edit this order and specify the <span className="text-white">Live Wt, Hot Wt, and Cold Wt</span> to display advanced dressing percentages, cooler shrinkages, and carcass loss progression charts.
                                  </div>
                                )}
                              </div>

                              {/* Right Pane: Detailed Cut Breakdown with Individual Cut Percentages */}
                              <div className="space-y-4">
                                <h4 className="text-xs font-extrabold text-white flex items-center justify-between uppercase tracking-wider">
                                  <span className="flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan-400"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                                    Cuts Breakdown & Take-Home Share
                                  </span>
                                  <span className="text-xs text-cool-gray-500 font-normal">
                                    ({breakdown.length} cuts)
                                  </span>
                                </h4>
                                
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                  {breakdown.length === 0 ? (
                                    <div className="text-center py-6 px-4 bg-cool-gray-900 border border-cool-gray-800 rounded-xl space-y-2">
                                      <p className="text-xs font-bold text-amber-400">No cut records uploaded yet</p>
                                      <p className="text-[11px] text-cool-gray-400">
                                        This drop-off order was started without a CSV. You can upload cuts anytime by clicking the <strong>Upload Cutsheet CSV</strong> button above.
                                      </p>
                                    </div>
                                  ) : (
                                    breakdown.map(cut => {
                                      const cutPct = oStats.packagedWeight > 0 ? (cut.totalWeight / oStats.packagedWeight) * 100 : 0;
                                      return (
                                        <div key={cut.name} className="bg-cool-gray-900 border border-cool-gray-800 p-2.5 rounded-xl flex flex-col justify-between gap-1.5 hover:border-cool-gray-700 transition">
                                          <div className="flex justify-between items-start text-xs">
                                            <div className="truncate pr-2">
                                              <p className="font-bold text-cool-gray-200 truncate">{cut.name}</p>
                                              <p className="text-[10px] text-cool-gray-500 mt-0.5">
                                                {cut.totalPieces} pieces ({cut.count} packages)
                                              </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                              <p className="font-extrabold text-cyan-400">{cut.totalWeight.toFixed(2)} lbs</p>
                                              <p className="text-[10px] text-cool-gray-400 font-bold mt-0.5">{cutPct.toFixed(1)}% of pack</p>
                                            </div>
                                          </div>
                                          <div className="w-full h-1 bg-cool-gray-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-cyan-500/60 rounded-full" style={{ width: `${cutPct}%` }}></div>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl p-4 sm:p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">New Butcher Order</h2>
              <p className="text-xs text-cool-gray-400 mt-1">
                Start a new order when dropping off animals (even with minimal info like species & temp order #) or import completed cuts from a CSV.
              </p>
            </div>
            
            {unmappedCuts.length > 0 && (
              <div className="bg-yellow-950/30 p-6 rounded-2xl border border-yellow-800/50 shadow-sm space-y-6 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-yellow-900 mb-2">Import Attribute Mapping Wizard</h3>
                  <p className="text-sm text-yellow-800 font-medium">
                    Please map the unmatched items from the CSV to your product catalog.
                  </p>
                </div>
                
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                  {unmappedCuts.map((uncut) => (
                    <div key={uncut.rawCut} className="bg-cool-gray-850 p-4 rounded-xl border border-yellow-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
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

                <div className="mt-8 flex justify-end items-center gap-3 pt-4 border-t border-yellow-800/50">
                  <button 
                    type="button"
                    onClick={() => { 
                      setUnmappedCuts([]); 
                      setPendingImport(null); 
                      setCutMappings({}); 
                    }} 
                    className="px-5 py-2.5 text-yellow-800 hover:bg-yellow-900/50 font-bold rounded-xl transition-colors"
                  >
                    Cancel Import
                  </button>
                  <button 
                    type="button"
                    onClick={() => finalizeImportMapping()} 
                    disabled={unmappedCuts.some(c => !cutMappings[c.rawCut])} 
                    className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
                  >
                    Save Mappings & Complete Import
                  </button>
                </div>
              </div>
            )}

            {createNewProductFor && (
              <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-cool-gray-850 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-cool-gray-750 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-4 text-white">Create New Product</h3>
                  <p className="text-sm text-cool-gray-400 mb-6">
                    Create a new product to map to <strong>{createNewProductFor.rawCut}</strong>.
                  </p>
                  <ManagementForms.ProductForm 
                    dispatch={dispatch} 
                    onClose={() => {
                      setCreateNewProductFor(null);
                      setCutMappings({...cutMappings, [createNewProductFor.rawCut]: ''});
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

            {unmappedCuts.length === 0 && (
            <form onSubmit={handleImportSubmit} className="space-y-6">
              
              {/* Target Order Mode Selector */}
              <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-extrabold text-cool-gray-300 uppercase tracking-wider">
                    Order Destination & Mode
                  </span>
                  {targetOrderId && (
                    <span className="text-xs bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Appending to Order #{importForm.orderNumber}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setTargetOrderId(null);
                      setImportForm({
                        orderNumber: '',
                        species: '',
                        animalCount: '',
                        killDate: '',
                        pickupDate: '',
                        birthDate: '',
                        notes: '',
                        liveWeight: '',
                        hotWeight: '',
                        coldWeight: '',
                        locationId: '',
                        importToOffSite: false,
                        targetLocationId: '',
                        targetPallet: '',
                        documents: [],
                        butcherFee: ''
                      });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      !targetOrderId 
                        ? 'bg-cyan-600 text-white shadow-md' 
                        : 'bg-cool-gray-800 text-cool-gray-400 hover:text-white border border-cool-gray-700'
                    }`}
                  >
                    <Plus size={15} />
                    Start New Butcher Order
                  </button>

                  {orders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const first = orders[0];
                        handleStartReceiveMoreCuts(first);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        targetOrderId 
                          ? 'bg-emerald-600 text-white shadow-md' 
                          : 'bg-cool-gray-800 text-cool-gray-400 hover:text-white border border-cool-gray-700'
                      }`}
                    >
                      <Upload size={15} />
                      Receive Additional Cuts into Existing Log
                    </button>
                  )}
                </div>

                {targetOrderId ? (
                  <div className="space-y-2 pt-2 border-t border-cool-gray-800">
                    <label className="block text-xs font-bold text-cool-gray-400">Select Existing Target Butcher Log</label>
                    <select
                      value={targetOrderId}
                      onChange={(e) => {
                        const selected = orders.find(o => o.id === e.target.value);
                        if (selected) {
                          handleStartReceiveMoreCuts(selected);
                        }
                      }}
                      className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-lg px-3 py-2 text-white font-medium focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                    >
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          Order #{o.orderNumber} - {o.species} ({o.animalCount ? `${o.animalCount} animals` : 'No count'}, Kill: {o.killDate || 'N/A'})
                        </option>
                      ))}
                    </select>
                    <div className="text-xs bg-emerald-950/40 border border-emerald-800/40 p-3 rounded-lg text-emerald-300 leading-relaxed">
                      <strong>⚡ Single-Log Preservation Active:</strong> Additional cuts from your amended CSV will be added directly into <strong>Order #{importForm.orderNumber}</strong>. Serialized cuts will be merged into this single log without duplicating animal counts, live weights, hot weights, or kill dates.
                    </div>
                  </div>
                ) : (
                  <div className="text-xs bg-cyan-950/30 border border-cyan-800/40 p-3 rounded-lg text-cyan-300 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold shrink-0">💡 Animal Drop-Off:</span>
                    <span>
                      You don't need a CSV cutsheet right now. Enter your species, animal count, drop-off/kill date, and order number (or generate a temporary one). You can attach the cutsheet CSV later when cuts are ready!
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-cool-gray-300">
                      Cutsheet CSV <span className="text-xs font-normal text-cool-gray-400">(Optional for drop-off)</span>
                    </label>
                    {parsedRecords.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCsvContent(null);
                          setParsedRecords([]);
                          setFileInputKey(k => k + 1);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
                      >
                        Remove CSV
                      </button>
                    )}
                  </div>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-cool-gray-700 border-dashed rounded-xl cursor-pointer bg-cool-gray-900/50 hover:bg-cool-gray-750 hover:border-cyan-500/50 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <Upload className="w-8 h-8 mb-2 text-cool-gray-400" />
                      <p className="text-sm text-cool-gray-300 font-medium">
                        <span className="font-bold text-cyan-400">Click to upload CSV</span> or drag and drop
                      </p>
                      <p className="text-[11px] text-cool-gray-500 mt-1">Leave empty to start a drop-off order without cuts</p>
                    </div>
                    <input key={fileInputKey} type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                  </label>
                  {parsedRecords.length > 0 && (
                    <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                        Parsed {parsedRecords.length} cut records from CSV
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-cool-gray-400">Order #</label>
                        <button
                          type="button"
                          onClick={() => setImportForm(prev => ({ ...prev, orderNumber: generateTempOrderNumber() }))}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 px-1.5 py-0.5 rounded cursor-pointer transition"
                          title="Generate a temporary order ID"
                        >
                          Auto Temp #
                        </button>
                      </div>
                      <input 
                        type="text" 
                        placeholder="e.g. 1042 or TEMP-..."
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none text-sm placeholder:text-cool-gray-600"
                        value={importForm.orderNumber || ''}
                        onChange={e => setImportForm({...importForm, orderNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Species *</label>
                      <CreatableDropdown
                        options={existingSpecies}
                        value={importForm.species || ''}
                        onChange={(val) => setImportForm({...importForm, species: val})}
                        placeholder="e.g. Pork"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Birth Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={importForm.birthDate || ''}
                        onChange={e => setImportForm({...importForm, birthDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Kill Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={importForm.killDate || ''}
                        onChange={e => setImportForm({...importForm, killDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Pickup Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={importForm.pickupDate || ''}
                        onChange={e => setImportForm({...importForm, pickupDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Animal Count</label>
                      <input 
                        type="number"
                        min="1" 
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={importForm.animalCount ?? ''}
                        onChange={e => setImportForm({...importForm, animalCount: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-cool-gray-900/50 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-4 border border-cool-gray-700">
                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Live Weight (lbs)</label>
                  <input 
                    type="number" step="any"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={importForm.liveWeight ?? ''}
                    onChange={e => setImportForm({...importForm, liveWeight: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Hot Weight (lbs)</label>
                  <input 
                    type="number" step="any"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={importForm.hotWeight ?? ''}
                    onChange={e => setImportForm({...importForm, hotWeight: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Cold Weight (lbs)</label>
                  <input 
                    type="number" step="any"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={importForm.coldWeight ?? ''}
                    onChange={e => setImportForm({...importForm, coldWeight: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Butcher Fee ($)</label>
                  <input 
                    type="number" step="any" min="0"
                    placeholder="0.00"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={importForm.butcherFee ?? ''}
                    onChange={e => setImportForm({...importForm, butcherFee: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-cool-gray-300 mb-2">
                      Butcher / Location Source <span className="text-red-400">*</span>
                    </label>
                    <select
                      required
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={importForm.locationId || ''}
                      onChange={e => {
                        const newLocId = e.target.value;
                        setImportForm(prev => {
                          let nextPallet = prev.targetPallet;
                          // If no explicit targetLocationId, then Butcher Source is the effective destination
                          if (!prev.targetLocationId && nextPallet) {
                            const newLoc = locations.find(l => l.id === newLocId);
                            const currentPalletLocName = palletLocationMap.get(nextPallet.toLowerCase().trim());
                            if (currentPalletLocName && newLoc && currentPalletLocName.toLowerCase() !== newLoc.name.toLowerCase()) {
                              nextPallet = '';
                            }
                          }
                          return {
                            ...prev,
                            locationId: newLocId,
                            targetPallet: nextPallet
                          };
                        });
                      }}
                    >
                      <option value="">-- Select Source --</option>
                      {locations.filter(l => l.type === 'delivery_pickup' || !l.isHome).map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="bg-cool-gray-900/50 p-4 rounded-xl border border-cool-gray-700">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="mt-0.5">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-cool-gray-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-cool-gray-900 bg-cool-gray-800"
                          checked={importForm.importToOffSite}
                          onChange={e => setImportForm({...importForm, importToOffSite: e.target.checked})}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Import directly into Off-Site Inventory</p>
                        <p className="text-xs text-cool-gray-400 mt-1">If checked, this will add all {parsedRecords.length} records directly into your active Off-Site inventory. Leave unchecked to only store historical records.</p>
                      </div>
                    </label>

                    {importForm.importToOffSite && (
                      <div className="mt-4 pt-3 border-t border-cool-gray-800 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                            Destination Storage Location
                          </label>
                          <select
                            className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                            value={importForm.targetLocationId || ''}
                            onChange={e => {
                              const newTargetLocId = e.target.value;
                              const effLocId = newTargetLocId || importForm.locationId || '';
                              const effLoc = locations.find(l => l.id === effLocId);
                              setImportForm(prev => {
                                let nextPallet = prev.targetPallet;
                                if (nextPallet) {
                                  const currentPalletLocName = palletLocationMap.get(nextPallet.toLowerCase().trim());
                                  if (currentPalletLocName && effLoc && currentPalletLocName.toLowerCase() !== effLoc.name.toLowerCase()) {
                                    nextPallet = '';
                                  }
                                }
                                return {
                                  ...prev,
                                  targetLocationId: newTargetLocId,
                                  targetPallet: nextPallet
                                };
                              });
                            }}
                          >
                            <option value="">Same as Butcher Source ({locations.find(l => l.id === importForm.locationId)?.name || 'Default Source'})</option>
                            {locations.map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.name} {loc.isHome ? '(Farm / Home)' : loc.type === 'storage' ? '(Storage Facility)' : ''}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                            Destination Pallet / Placement {activeTargetLocation ? <span className="text-cyan-400 font-normal">at {activeTargetLocation.name}</span> : ''}
                          </label>
                          <PalletCreatableSelect
                            options={existingActivePalletsForDestination}
                            value={importForm.targetPallet || ''}
                            onChange={(val) => setImportForm({...importForm, targetPallet: val})}
                            placeholder={activeTargetLocation?.name ? `Select active pallet at ${activeTargetLocation.name} or type to create new...` : `Select existing active pallet or type to create new...`}
                            destinationName={activeTargetLocation?.name || ''}
                            palletLocationMap={palletLocationMap}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-cool-gray-300 mb-2">Generic Notes</label>
                  <textarea
                    rows={4}
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none resize-none mb-4"
                    placeholder="Add generic notes about this butcher order (animals, transport, yield comments)..."
                    value={importForm.notes || ''}
                    onChange={e => setImportForm({...importForm, notes: e.target.value})}
                  />

                  {/* Associated Documents in Import Form */}
                  <div className="border-t border-cool-gray-700/50 pt-4">
                    <label className="block text-xs font-bold text-cool-gray-400 mb-2 uppercase tracking-wider">Associated Document Links</label>
                    
                    {(!importForm.documents || importForm.documents.length === 0) ? (
                      <p className="text-xs text-cool-gray-500 italic mb-3 bg-cool-gray-900/30 p-2.5 rounded-lg text-center text-cool-gray-400">No documents added yet.</p>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {importForm.documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between bg-cool-gray-900/50 p-2 rounded-lg border border-cool-gray-800 text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                              <Link size={14} className="text-cool-gray-400 shrink-0" />
                              <span className="font-bold text-white truncate">{doc.name}</span>
                              <span className="text-cool-gray-500 truncate text-[11px] font-mono">({doc.url})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedDocs = (importForm.documents || []).filter((d: any) => d.id !== doc.id);
                                setImportForm({ ...importForm, documents: updatedDocs });
                              }}
                              className="text-cool-gray-500 hover:text-red-400 p-1 rounded hover:bg-cool-gray-800 transition shrink-0"
                              title="Remove document link"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-cool-gray-900/30 p-3 rounded-xl border border-cool-gray-800 space-y-3">
                      <p className="text-xs font-bold text-cool-gray-300">Add a Document Link</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Document Name (e.g. Cutsheet, Invoice, Yield)"
                          className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                          value={importNewDocName}
                          onChange={e => setImportNewDocName(e.target.value)}
                        />
                        <input
                          type="url"
                          placeholder="URL (https://...)"
                          className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                          value={importNewDocUrl}
                          onChange={e => setImportNewDocUrl(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const name = importNewDocName.trim();
                            let url = importNewDocUrl.trim();
                            if (!name || !url) return;
                            
                            if (!/^https?:\/\//i.test(url)) {
                              url = 'https://' + url;
                            }

                            const newDoc = {
                              id: crypto.randomUUID(),
                              name,
                              url
                            };
                            
                            setImportForm({
                              ...importForm,
                              documents: [...(importForm.documents || []), newDoc]
                            });
                            
                            setImportNewDocName('');
                            setImportNewDocUrl('');
                          }}
                          className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} />
                          Attach Document Link
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-cool-gray-700 gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleClearImportForm}
                  className="px-5 py-3 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white border border-cool-gray-700 font-extrabold rounded-xl transition-colors flex items-center gap-2 cursor-pointer text-sm"
                >
                  <X size={18} />
                  Cancel / Clear Form
                </button>
                <button
                  type="submit"
                  disabled={targetOrderId ? !parsedRecords.length : (!importForm.species || !importForm.species.trim())}
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-md transition-colors flex items-center gap-2 text-sm cursor-pointer"
                >
                  <ArrowRight size={18} />
                  {targetOrderId 
                    ? `Upload & Append ${parsedRecords.length} Cuts to Order #${importForm.orderNumber}`
                    : parsedRecords.length > 0
                      ? `Import Order & ${parsedRecords.length} Cuts`
                      : `Start Butcher Order (${(importForm.orderNumber || '').trim() || 'Auto Temp #'})`
                  }
                </button>
              </div>
            </form>
            )}
          </div>
        )}

        {activeTab === 'reports' && (() => {
          // Filter and sort chronologically
          const matchedOrders = orders.filter(o => {
            if (reportFilter.startDate && (o.killDate < reportFilter.startDate && o.pickupDate < reportFilter.startDate)) return false;
            if (reportFilter.endDate && ((o.killDate && o.killDate > reportFilter.endDate) && (o.pickupDate && o.pickupDate > reportFilter.endDate))) return false;
            if (reportFilter.orderNumber.length > 0 && !reportFilter.orderNumber.some(val => o.orderNumber.toLowerCase().includes(val.toLowerCase()))) return false;
            if (reportFilter.species.length > 0 && !reportFilter.species.some(val => o.species.toLowerCase().includes(val.toLowerCase()))) return false;
            return true;
          }).sort((a, b) => {
            const dateA = a.killDate || a.pickupDate || '';
            const dateB = b.killDate || b.pickupDate || '';
            return dateA.localeCompare(dateB) || a.createdAt - b.createdAt;
          });

          const rOrdersWithStats = matchedOrders.map(o => {
            const matchingRecords = records.filter(r => r.orderId === o.id);
            return {
              order: o,
              stats: computeOrderStats(o, matchingRecords)
            };
          });

          // Calculate Averages (Per-Animal basis)
          const averages = (() => {
            let liveSum = 0, liveAnimals = 0;
            let hotSum = 0, hotAnimals = 0;
            let coldSum = 0, coldAnimals = 0;
            let packSum = 0, packAnimals = 0;
            
            let hotYieldSum = 0, hotYieldCount = 0;
            let shrinkSum = 0, shrinkCount = 0;
            let cutYieldSum = 0, cutYieldCount = 0;
            let finishLiveSum = 0, finishLiveCount = 0;

            rOrdersWithStats.forEach(({ order, stats }) => {
              const animalCount = Math.max(1, order.animalCount || 1);
              
              if (stats.liveWeight > 0) {
                liveSum += stats.liveWeight;
                liveAnimals += animalCount;
              }
              if (stats.hotWeight > 0) {
                hotSum += stats.hotWeight;
                hotAnimals += animalCount;
              }
              if (stats.coldWeight > 0) {
                coldSum += stats.coldWeight;
                coldAnimals += animalCount;
              }
              if (stats.packagedWeight > 0) {
                packSum += stats.packagedWeight;
                packAnimals += animalCount;
              }

              if (stats.hotWeightYield > 0) {
                hotYieldSum += stats.hotWeightYield;
                hotYieldCount++;
              }
              if (stats.coolerShrinkage > 0) {
                shrinkSum += stats.coolerShrinkage;
                shrinkCount++;
              }
              if (stats.cuttingYield > 0) {
                cutYieldSum += stats.cuttingYield;
                cutYieldCount++;
              }
              if (stats.finishToLiveYield > 0) {
                finishLiveSum += stats.finishToLiveYield;
                finishLiveCount++;
              }
            });

            return {
              avgLive: liveAnimals > 0 ? liveSum / liveAnimals : 0,
              avgHot: hotAnimals > 0 ? hotSum / hotAnimals : 0,
              avgCold: coldAnimals > 0 ? coldSum / coldAnimals : 0,
              avgPackaged: packAnimals > 0 ? packSum / packAnimals : 0,
              avgHotYield: hotYieldCount > 0 ? hotYieldSum / hotYieldCount : 0,
              avgShrink: shrinkCount > 0 ? shrinkSum / shrinkCount : 0,
              avgCutYield: cutYieldCount > 0 ? cutYieldSum / cutYieldCount : 0,
              avgFinishLive: finishLiveCount > 0 ? finishLiveSum / finishLiveCount : 0,
            };
          })();

          // Group by Species for comparisons (Per-Animal basis)
          const speciesComparisonData = (() => {
            const grouped: Record<string, {
              species: string;
              orderCount: number;
              animalCount: number;
              liveSum: number; liveAnimals: number;
              hotYieldSum: number; hotYieldCount: number;
              shrinkSum: number; shrinkCount: number;
              cutYieldSum: number; cutYieldCount: number;
              packagedSum: number; packagedAnimals: number;
            }> = {};

            rOrdersWithStats.forEach(({ order, stats }) => {
              const sp = order.species || 'Unknown';
              const aCount = Math.max(1, order.animalCount || 1);
              if (!grouped[sp]) {
                grouped[sp] = {
                  species: sp,
                  orderCount: 0,
                  animalCount: 0,
                  liveSum: 0, liveAnimals: 0,
                  hotYieldSum: 0, hotYieldCount: 0,
                  shrinkSum: 0, shrinkCount: 0,
                  cutYieldSum: 0, cutYieldCount: 0,
                  packagedSum: 0, packagedAnimals: 0
                };
              }

              const g = grouped[sp];
              g.orderCount++;
              g.animalCount += aCount;
              if (stats.liveWeight > 0) {
                g.liveSum += stats.liveWeight;
                g.liveAnimals += aCount;
              }
              if (stats.hotWeightYield > 0) {
                g.hotYieldSum += stats.hotWeightYield;
                g.hotYieldCount++;
              }
              if (stats.coolerShrinkage > 0) {
                g.shrinkSum += stats.coolerShrinkage;
                g.shrinkCount++;
              }
              if (stats.cuttingYield > 0) {
                g.cutYieldSum += stats.cuttingYield;
                g.cutYieldCount++;
              }
              if (stats.packagedWeight > 0) {
                g.packagedSum += stats.packagedWeight;
                g.packagedAnimals += aCount;
              }
            });

            return Object.values(grouped).map(g => ({
              species: g.species,
              orderCount: g.orderCount,
              animalCount: g.animalCount,
              avgLive: g.liveAnimals > 0 ? g.liveSum / g.liveAnimals : 0,
              avgHotYield: g.hotYieldCount > 0 ? g.hotYieldSum / g.hotYieldCount : 0,
              avgShrink: g.shrinkCount > 0 ? g.shrinkSum / g.shrinkCount : 0,
              avgCutYield: g.cutYieldCount > 0 ? g.cutYieldSum / g.cutYieldCount : 0,
              avgPackaged: g.packagedAnimals > 0 ? g.packagedSum / g.packagedAnimals : 0
            })).sort((a, b) => b.orderCount - a.orderCount);
          })();

          // Chart Dimensions (for viewBox 600x250)
          const chartPaddingLeft = 50;
          const chartPaddingRight = 20;
          const chartPaddingTop = 20;
          const chartPaddingBottom = 35;
          const totalPoints = rOrdersWithStats.length;

          // Coordinate mapping for yields chart
          const yieldCoords = rOrdersWithStats.map(({ order, stats }, idx) => {
            const x = chartPaddingLeft + (totalPoints > 1 ? (idx / (totalPoints - 1)) * (600 - chartPaddingLeft - chartPaddingRight) : (600 - chartPaddingLeft - chartPaddingRight) / 2);
            const yDressing = chartPaddingTop + (1 - (stats.hotWeightYield / 100)) * (250 - chartPaddingTop - chartPaddingBottom);
            const yShrink = chartPaddingTop + (1 - (stats.coolerShrinkage / 100)) * (250 - chartPaddingTop - chartPaddingBottom);
            const yCutting = chartPaddingTop + (1 - (stats.cuttingYield / 100)) * (250 - chartPaddingTop - chartPaddingBottom);
            const yTakeHome = chartPaddingTop + (1 - (stats.finishToLiveYield / 100)) * (250 - chartPaddingTop - chartPaddingBottom);

            return {
              order,
              stats,
              x,
              yDressing: isNaN(yDressing) ? 250 - chartPaddingBottom : yDressing,
              yShrink: isNaN(yShrink) ? 250 - chartPaddingBottom : yShrink,
              yCutting: isNaN(yCutting) ? 250 - chartPaddingBottom : yCutting,
              yTakeHome: isNaN(yTakeHome) ? 250 - chartPaddingBottom : yTakeHome,
            };
          });

          // Coordinates mapping for weights chart (Per-Animal basis)
          const maxMatchedWeight = Math.max(
            ...rOrdersWithStats.map(({ stats }) => Math.max(stats.liveWeightPerAnimal, stats.hotWeightPerAnimal, stats.coldWeightPerAnimal, stats.packagedWeightPerAnimal)),
            100
          );
          const roundedMaxWeight = Math.ceil((maxMatchedWeight * 1.1) / 100) * 100;

          const weightCoords = rOrdersWithStats.map(({ order, stats }, idx) => {
            const x = chartPaddingLeft + (totalPoints > 1 ? (idx / (totalPoints - 1)) * (600 - chartPaddingLeft - chartPaddingRight) : (600 - chartPaddingLeft - chartPaddingRight) / 2);
            const yLive = chartPaddingTop + (1 - (stats.liveWeightPerAnimal / roundedMaxWeight)) * (250 - chartPaddingTop - chartPaddingBottom);
            const yHot = chartPaddingTop + (1 - (stats.hotWeightPerAnimal / roundedMaxWeight)) * (250 - chartPaddingTop - chartPaddingBottom);
            const yCold = chartPaddingTop + (1 - (stats.coldWeightPerAnimal / roundedMaxWeight)) * (250 - chartPaddingTop - chartPaddingBottom);
            const yPackaged = chartPaddingTop + (1 - (stats.packagedWeightPerAnimal / roundedMaxWeight)) * (250 - chartPaddingTop - chartPaddingBottom);

            return {
              order,
              stats,
              x,
              yLive: isNaN(yLive) ? 250 - chartPaddingBottom : yLive,
              yHot: isNaN(yHot) ? 250 - chartPaddingBottom : yHot,
              yCold: isNaN(yCold) ? 250 - chartPaddingBottom : yCold,
              yPackaged: isNaN(yPackaged) ? 250 - chartPaddingBottom : yPackaged,
            };
          });

          // Coordinates mapping for selected cut proportion trend (multi-select, compare, additive)
          const activeCutsForTrend = selectedCutsForTrend.length > 0 
            ? selectedCutsForTrend 
            : (reportData.breakdown[0]?.name ? [reportData.breakdown[0].name] : []);

          const CUT_COLORS = [
            '#22d3ee', // cyan
            '#f43f5e', // rose
            '#10b981', // emerald
            '#fbbf24', // amber
            '#8b5cf6', // violet
            '#ec4899', // pink
            '#3b82f6', // blue
            '#f97316', // orange
          ];

          // 1. Additive calculations
          const cutTrendCoordsAdditive = rOrdersWithStats.map(({ order, stats }) => {
            const orderRecords = records.filter(r => r.orderId === order.id);
            let combinedWeight = 0;
            orderRecords.forEach(r => {
              const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
              if (activeCutsForTrend.some(cName => cName.toLowerCase() === name.toLowerCase())) {
                combinedWeight += r.netWeight;
              }
            });
            const pct = stats.packagedWeight > 0 ? (combinedWeight / stats.packagedWeight) * 100 : 0;
            return {
              order,
              weight: combinedWeight,
              percentage: pct
            };
          });

          // 2. Comparison calculations
          const cutTrendsByCut = activeCutsForTrend.map(cutName => {
            const coords = rOrdersWithStats.map(({ order, stats }) => {
              const orderRecords = records.filter(r => r.orderId === order.id);
              let cutWeight = 0;
              orderRecords.forEach(r => {
                const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
                if (name.toLowerCase() === cutName.toLowerCase()) {
                  cutWeight += r.netWeight;
                }
              });
              const pct = stats.packagedWeight > 0 ? (cutWeight / stats.packagedWeight) * 100 : 0;
              return {
                order,
                weight: cutWeight,
                percentage: pct
              };
            });
            return {
              cutName,
              coords
            };
          });

          // Overall max percentage for Y-scaling
          let maxCutPercentageMatched = 5;
          if (cutTrendMode === 'additive') {
            maxCutPercentageMatched = Math.max(...cutTrendCoordsAdditive.map(c => c.percentage), 5);
          } else {
            cutTrendsByCut.forEach(trend => {
              const trendMax = Math.max(...trend.coords.map(c => c.percentage), 5);
              if (trendMax > maxCutPercentageMatched) {
                maxCutPercentageMatched = trendMax;
              }
            });
          }
          const roundedMaxCutPct = Math.ceil(maxCutPercentageMatched * 1.2);

          // Build point coordinates for additive
          const cutTrendPointCoordsAdditive = cutTrendCoordsAdditive.map((c, idx) => {
            const x = chartPaddingLeft + (totalPoints > 1 ? (idx / (totalPoints - 1)) * (600 - chartPaddingLeft - chartPaddingRight) : (600 - chartPaddingLeft - chartPaddingRight) / 2);
            const y = chartPaddingTop + (1 - (c.percentage / roundedMaxCutPct)) * (250 - chartPaddingTop - chartPaddingBottom);
            return {
              ...c,
              x,
              y: isNaN(y) ? 250 - chartPaddingBottom : y
            };
          });

          // Build point coordinates for comparison
          const cutTrendsPointCoordsByCut = cutTrendsByCut.map((trend, trendIdx) => {
            const points = trend.coords.map((c, idx) => {
              const x = chartPaddingLeft + (totalPoints > 1 ? (idx / (totalPoints - 1)) * (600 - chartPaddingLeft - chartPaddingRight) : (600 - chartPaddingLeft - chartPaddingRight) / 2);
              const y = chartPaddingTop + (1 - (c.percentage / roundedMaxCutPct)) * (250 - chartPaddingTop - chartPaddingBottom);
              return {
                ...c,
                x,
                y: isNaN(y) ? 250 - chartPaddingBottom : y
              };
            });
            return {
              cutName: trend.cutName,
              color: CUT_COLORS[trendIdx % CUT_COLORS.length],
              points
            };
          });

          // Base point coordinates used for axis grid, labels, columns, etc.
          const cutTrendPointCoords = cutTrendMode === 'additive' 
            ? cutTrendPointCoordsAdditive 
            : (cutTrendsPointCoordsByCut[0]?.points || []);

          // Helper to generate path coordinates
          const getPathString = (coords: { x: number, y: number }[]) => {
            if (coords.length === 0) return '';
            return coords.map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
          };

          const getClosedPathString = (coords: { x: number, y: number }[]) => {
            if (coords.length === 0) return '';
            const linePart = getPathString(coords);
            return `${linePart} L ${coords[coords.length - 1].x} ${250 - chartPaddingBottom} L ${coords[0].x} ${250 - chartPaddingBottom} Z`;
          };

          return (
            <div className="space-y-6">
              {/* Filter Panel */}
              <div className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan-400"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                    Report & Analytics Filters
                  </h2>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-cool-gray-400 hover:text-cool-gray-300 transition-colors">
                    <input 
                      type="checkbox"
                      className="rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-4 h-4 shrink-0"
                      checked={viewOriginalNames}
                      onChange={(e) => { setViewOriginalNames(e.target.checked); setReportFilter(prev => ({...prev, cutName: []})); }}
                    />
                    VIEW RAW CSV ITEM NAMES
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Start Date</label>
                    <input 
                      type="date"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={reportFilter.startDate}
                      onChange={e => setReportFilter({...reportFilter, startDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">End Date</label>
                    <input 
                      type="date"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={reportFilter.endDate}
                      onChange={e => setReportFilter({...reportFilter, endDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Order Number</label>
                    <MultiSelectDropdown
                      options={existingOrderNumbers}
                      selected={reportFilter.orderNumber}
                      onChange={(selected) => setReportFilter({...reportFilter, orderNumber: selected})}
                      placeholder="All Orders"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Species</label>
                    <MultiSelectDropdown
                      options={existingSpecies}
                      selected={reportFilter.species}
                      onChange={(selected) => setReportFilter({...reportFilter, species: selected})}
                      placeholder="All Species"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Cut Name</label>
                    <MultiSelectDropdown
                      options={existingCutNames}
                      selected={reportFilter.cutName}
                      onChange={(selected) => setReportFilter({...reportFilter, cutName: selected})}
                      placeholder="All Cuts"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Categories</label>
                    <NestedCategoryMultiSelect
                      primaryOptions={existingPrimaryCategories}
                      subOptions={categoryMap}
                      selectedPrimary={reportFilter.primaryCategory}
                      selectedSub={reportFilter.subCategory}
                      onChange={(primary, sub) => setReportFilter({...reportFilter, primaryCategory: primary, subCategory: sub})}
                      placeholder="All Categories"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => setReportFilter({ startDate: '', endDate: '', orderNumber: [], species: [], cutName: [], primaryCategory: [], subCategory: [] })}
                      className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-white font-bold rounded-lg transition-colors text-sm w-full"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Robust Yield Bento Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl">
                  <div className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1 text-center">Orders & Animals</div>
                  <div className="flex justify-around items-baseline mt-2">
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-white">{reportData.orderCount}</div>
                      <div className="text-[10px] text-cool-gray-500 font-bold uppercase">Orders</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-cyan-400">{reportData.animalCount}</div>
                      <div className="text-[10px] text-cool-gray-500 font-bold uppercase">Animals</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-extrabold text-cool-gray-300">{reportData.recordCount}</div>
                      <div className="text-[10px] text-cool-gray-500 font-bold uppercase">Packages</div>
                    </div>
                  </div>
                </div>

                <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Avg Dressing Yield</span>
                  <span className="text-2xl font-extrabold text-amber-400">
                    {averages.avgHotYield > 0 ? `${averages.avgHotYield.toFixed(1)}%` : '-'}
                  </span>
                  <span className="text-[10px] text-cool-gray-500 mt-1 font-semibold">Hot Carcass vs Live Weight</span>
                </div>

                <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Avg Cooler Shrink</span>
                  <span className="text-2xl font-extrabold text-rose-400">
                    {averages.avgShrink > 0 ? `${averages.avgShrink.toFixed(1)}%` : '-'}
                  </span>
                  <span className="text-[10px] text-cool-gray-500 mt-1 font-semibold">Cooler Hanging Weight Loss</span>
                </div>

                <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Avg Cutting Yield</span>
                  <span className="text-2xl font-extrabold text-emerald-400">
                    {averages.avgCutYield > 0 ? `${averages.avgCutYield.toFixed(1)}%` : '-'}
                  </span>
                  <span className="text-[10px] text-cool-gray-500 mt-1 font-semibold">Packaged cuts vs hanging carcass</span>
                </div>
              </div>

              {/* Secondary Bento Row (Volume Indicators) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Total Packaged Meat</span>
                  <span className="text-2xl font-extrabold text-cyan-400">{reportData.totalWeight.toFixed(1)} lbs</span>
                  <span className="text-[10px] text-cool-gray-500 mt-1 font-semibold">Across all filtered logs</span>
                </div>

                <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Avg Live Weight</span>
                  <span className="text-2xl font-extrabold text-white">
                    {averages.avgLive > 0 ? `${averages.avgLive.toFixed(1)} lbs` : '-'}
                  </span>
                  <span className="text-[10px] text-cool-gray-500 mt-1 font-semibold">Per individual animal average</span>
                </div>

                <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Avg Packaged Weight</span>
                  <span className="text-2xl font-extrabold text-cool-gray-200">
                    {averages.avgPackaged > 0 ? `${averages.avgPackaged.toFixed(1)} lbs` : '-'}
                  </span>
                  <span className="text-[10px] text-cool-gray-500 mt-1 font-semibold">Per individual animal average</span>
                </div>

                <div className="bg-cool-gray-800 border border-cool-gray-700 p-4 rounded-2xl flex flex-col items-center justify-center text-center">
                  <span className="text-cool-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Avg Standing Yield</span>
                  <span className="text-2xl font-extrabold text-cyan-500">
                    {averages.avgFinishLive > 0 ? `${averages.avgFinishLive.toFixed(1)}%` : '-'}
                  </span>
                  <span className="text-[10px] text-cool-gray-500 mt-1 font-semibold">Finished meat / Standing live wt</span>
                </div>
              </div>

              {/* Dynamic Interactive Graphs Tab Section */}
              <div className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 sm:p-5 border-b border-cool-gray-700 bg-cool-gray-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan-400"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                      Butcher Analytics & Trends Interactive Dashboard
                    </h3>
                    <p className="text-xs text-cool-gray-400 mt-1">Select a tab below to chart yields, weights, cut metrics, or species averages.</p>
                  </div>

                  {/* Tabs */}
                  <div className="flex bg-cool-gray-950 p-1 rounded-xl border border-cool-gray-700 self-start">
                    <button 
                      onClick={() => setReportGraphTab('yields')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportGraphTab === 'yields' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-white'}`}
                    >
                      Yield Trends
                    </button>
                    <button 
                      onClick={() => setReportGraphTab('weights')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportGraphTab === 'weights' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-white'}`}
                    >
                      Weights Timeline
                    </button>
                    <button 
                      onClick={() => setReportGraphTab('cuts')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportGraphTab === 'cuts' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-white'}`}
                    >
                      Cuts Over Time
                    </button>
                    <button 
                      onClick={() => setReportGraphTab('species')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${reportGraphTab === 'species' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-white'}`}
                    >
                      Species Bento
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6 bg-cool-gray-800">
                  {totalPoints === 0 ? (
                    <div className="text-center py-16 text-cool-gray-400 border border-dashed border-cool-gray-700 rounded-xl">
                      <p className="font-semibold">No orders matching the active filters to render trends.</p>
                      <p className="text-xs text-cool-gray-500 mt-1">Adjust your dates, species, or filters in the Report Filters above.</p>
                    </div>
                  ) : (
                    <>
                      {/* 1. YIELD TRENDS LINE GRAPH */}
                      {reportGraphTab === 'yields' && (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <h4 className="text-xs font-extrabold text-cool-gray-300 uppercase tracking-widest">Processing & Carcass Yield Curves</h4>
                            {/* Legend */}
                            <div className="flex flex-wrap gap-4 text-xs">
                              <span className="flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> Dressing (Hot/Live)
                              </span>
                              <span className="flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                <span className="w-3 h-0.5 bg-rose-500 inline-block"></span> Cooler Shrink %
                              </span>
                              <span className="flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span> Cutting (Packaged/Cold)
                              </span>
                              <span className="flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span> Standing Yield (Packaged/Live)
                              </span>
                            </div>
                          </div>

                          <div className="relative pt-2">
                            <svg viewBox="0 0 600 250" className="w-full h-auto overflow-visible">
                              {/* Grid Lines */}
                              {[0, 25, 50, 75, 100].map((val) => {
                                const y = chartPaddingTop + (1 - val / 100) * (250 - chartPaddingTop - chartPaddingBottom);
                                return (
                                  <g key={val} className="opacity-30">
                                    <line 
                                      x1={chartPaddingLeft} 
                                      y1={y} 
                                      x2={600 - chartPaddingRight} 
                                      y2={y} 
                                      stroke="#4b5563" 
                                      strokeWidth="1" 
                                      strokeDasharray="3 3"
                                    />
                                    <text 
                                      x={chartPaddingLeft - 8} 
                                      y={y + 4} 
                                      textAnchor="end" 
                                      className="fill-cool-gray-400 font-mono text-[10px] font-bold"
                                    >
                                      {val}%
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Lines */}
                              {totalPoints > 1 && (
                                <>
                                  <path d={getPathString(yieldCoords.map(c => ({ x: c.x, y: c.yDressing })))} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d={getPathString(yieldCoords.map(c => ({ x: c.x, y: c.yShrink })))} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="2" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d={getPathString(yieldCoords.map(c => ({ x: c.x, y: c.yCutting })))} fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  <path d={getPathString(yieldCoords.map(c => ({ x: c.x, y: c.yTakeHome })))} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                </>
                              )}

                              {/* Points */}
                              {yieldCoords.map((pt, idx) => (
                                <g key={idx}>
                                  {pt.stats.hotWeightYield > 0 && (
                                    <circle cx={pt.x} cy={pt.yDressing} r={hoveredPointIdx === idx ? 6 : 3.5} className="fill-amber-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                  )}
                                  {pt.stats.coolerShrinkage > 0 && (
                                    <circle cx={pt.x} cy={pt.yShrink} r={hoveredPointIdx === idx ? 6 : 3} className="fill-red-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                  )}
                                  {pt.stats.cuttingYield > 0 && (
                                    <circle cx={pt.x} cy={pt.yCutting} r={hoveredPointIdx === idx ? 6 : 3.5} className="fill-emerald-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                  )}
                                  <circle cx={pt.x} cy={pt.yTakeHome} r={hoveredPointIdx === idx ? 7 : 4} className="fill-cyan-400 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                </g>
                              ))}

                              {/* X Axis labels */}
                              {yieldCoords.map((pt, idx) => {
                                const labelInterval = Math.max(1, Math.ceil(totalPoints / 6));
                                if (idx % labelInterval !== 0 && idx !== totalPoints - 1) return null;
                                return (
                                  <text 
                                    key={idx} 
                                    x={pt.x} 
                                    y={250 - chartPaddingBottom + 16} 
                                    textAnchor="middle" 
                                    className="fill-cool-gray-400 font-mono text-[9px] font-bold"
                                  >
                                    {pt.order.killDate ? pt.order.killDate.slice(5) : `O#${pt.order.orderNumber}`}
                                  </text>
                                );
                              })}

                              {/* Interaction Columns */}
                              {yieldCoords.map((pt, idx) => {
                                const colWidth = (600 - chartPaddingLeft - chartPaddingRight) / Math.max(1, totalPoints);
                                return (
                                  <rect
                                    key={idx}
                                    x={pt.x - colWidth / 2}
                                    y={chartPaddingTop}
                                    width={colWidth}
                                    height={250 - chartPaddingTop - chartPaddingBottom}
                                    fill="transparent"
                                    className="cursor-pointer hover:fill-cyan-400/5 transition-colors"
                                    onMouseEnter={() => setHoveredPointIdx(idx)}
                                    onMouseLeave={() => setHoveredPointIdx(null)}
                                  />
                                );
                              })}
                            </svg>

                            {/* Floating Interactive Tooltip */}
                            {hoveredPointIdx !== null && yieldCoords[hoveredPointIdx] && (() => {
                              const pt = yieldCoords[hoveredPointIdx];
                              return (
                                <div 
                                  className="absolute bg-cool-gray-900/95 backdrop-blur border border-cool-gray-700/80 p-3.5 rounded-xl shadow-2xl text-xs text-cool-gray-200 pointer-events-none z-10 space-y-1.5 w-64 animate-fade-in"
                                  style={{
                                    left: `${Math.min(85, Math.max(15, (pt.x / 600) * 100))}%`,
                                    top: '12px',
                                    transform: 'translateX(-50%)',
                                  }}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-white text-sm">Order #{pt.order.orderNumber}</span>
                                    <span className="px-1.5 py-0.5 bg-cool-gray-800 text-cool-gray-400 rounded text-[9px] font-bold uppercase">{pt.order.species}</span>
                                  </div>
                                  <div className="text-[10px] text-cool-gray-400">Kill Date: {pt.order.killDate || 'N/A'}</div>
                                  <div className="h-px bg-cool-gray-800 my-1"></div>
                                  
                                  <div className="flex justify-between">
                                    <span className="text-amber-400 flex items-center gap-1">Dressing Yield:</span>
                                    <span className="font-bold text-white">{pt.stats.hotWeightYield > 0 ? `${pt.stats.hotWeightYield.toFixed(1)}%` : 'Not specified'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-rose-400 flex items-center gap-1">Cooler Shrink:</span>
                                    <span className="font-bold text-white">{pt.stats.coolerShrinkage > 0 ? `${pt.stats.coolerShrinkage.toFixed(1)}%` : 'Not specified'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-emerald-400 flex items-center gap-1">Cutting Yield:</span>
                                    <span className="font-bold text-white">{pt.stats.cuttingYield > 0 ? `${pt.stats.cuttingYield.toFixed(1)}%` : 'Not specified'}</span>
                                  </div>
                                  <div className="flex justify-between border-t border-cool-gray-800 pt-1 mt-1 font-semibold">
                                    <span className="text-cyan-400">Total Take-Home:</span>
                                    <span className="font-bold text-cyan-400">{pt.stats.finishToLiveYield > 0 ? `${pt.stats.finishToLiveYield.toFixed(1)}%` : 'Not specified'}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* 2. WEIGHTS TIMELINE AREA/LINE GRAPH */}
                      {reportGraphTab === 'weights' && (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <h4 className="text-xs font-extrabold text-cool-gray-300 uppercase tracking-widest">Carcass Weight Progression Timeline</h4>
                            {/* Legend */}
                            <div className="flex flex-wrap gap-4 text-xs">
                              <span className="flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Standing Live Weight
                              </span>
                              <span className="flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                <span className="w-3 h-0.5 bg-amber-500 inline-block"></span> Hot Hanging Carcass
                              </span>
                              <span className="flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                <span className="w-3 h-0.5 bg-indigo-500 inline-block"></span> Cold Hanging Carcass
                              </span>
                              <span className="flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span> Finished Packaged Meat
                              </span>
                            </div>
                          </div>

                          <div className="relative pt-2">
                            <svg viewBox="0 0 600 250" className="w-full h-auto overflow-visible">
                              <defs>
                                <linearGradient id="liveWeightGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="packWeightGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.2" />
                                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>

                              {/* Grid Lines */}
                              {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                                const val = p * roundedMaxWeight;
                                const y = chartPaddingTop + (1 - p) * (250 - chartPaddingTop - chartPaddingBottom);
                                return (
                                  <g key={idx} className="opacity-30">
                                    <line 
                                      x1={chartPaddingLeft} 
                                      y1={y} 
                                      x2={600 - chartPaddingRight} 
                                      y2={y} 
                                      stroke="#4b5563" 
                                      strokeWidth="1" 
                                      strokeDasharray="3 3"
                                    />
                                    <text 
                                      x={chartPaddingLeft - 8} 
                                      y={y + 4} 
                                      textAnchor="end" 
                                      className="fill-cool-gray-400 font-mono text-[9px] font-bold"
                                    >
                                      {val.toFixed(0)}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Fill Areas */}
                              {totalPoints > 1 && (
                                <>
                                  <path d={getClosedPathString(weightCoords.map(c => ({ x: c.x, y: c.yLive })))} fill="url(#liveWeightGrad)" />
                                  <path d={getClosedPathString(weightCoords.map(c => ({ x: c.x, y: c.yPackaged })))} fill="url(#packWeightGrad)" />
                                </>
                              )}

                              {/* Line Curves */}
                              {totalPoints > 1 && (
                                <>
                                  <path d={getPathString(weightCoords.map(c => ({ x: c.x, y: c.yLive })))} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" />
                                  <path d={getPathString(weightCoords.map(c => ({ x: c.x, y: c.yHot })))} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="3 2" strokeLinecap="round" />
                                  <path d={getPathString(weightCoords.map(c => ({ x: c.x, y: c.yCold })))} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
                                  <path d={getPathString(weightCoords.map(c => ({ x: c.x, y: c.yPackaged })))} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                                </>
                              )}

                              {/* Point Dots */}
                              {weightCoords.map((pt, idx) => (
                                <g key={idx}>
                                  {pt.stats.liveWeight > 0 && (
                                    <circle cx={pt.x} cy={pt.yLive} r={hoveredWeightPointIdx === idx ? 6 : 3.5} className="fill-blue-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                  )}
                                  {pt.stats.hotWeight > 0 && (
                                    <circle cx={pt.x} cy={pt.yHot} r={hoveredWeightPointIdx === idx ? 5 : 3} className="fill-amber-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                  )}
                                  {pt.stats.coldWeight > 0 && (
                                    <circle cx={pt.x} cy={pt.yCold} r={hoveredWeightPointIdx === idx ? 5 : 3} className="fill-indigo-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                  )}
                                  <circle cx={pt.x} cy={pt.yPackaged} r={hoveredWeightPointIdx === idx ? 7 : 4} className="fill-cyan-400 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                </g>
                              ))}

                              {/* Axis Labels */}
                              {weightCoords.map((pt, idx) => {
                                const labelInterval = Math.max(1, Math.ceil(totalPoints / 6));
                                if (idx % labelInterval !== 0 && idx !== totalPoints - 1) return null;
                                return (
                                  <text 
                                    key={idx} 
                                    x={pt.x} 
                                    y={250 - chartPaddingBottom + 16} 
                                    textAnchor="middle" 
                                    className="fill-cool-gray-400 font-mono text-[9px] font-bold"
                                  >
                                    {pt.order.killDate ? pt.order.killDate.slice(5) : `O#${pt.order.orderNumber}`}
                                  </text>
                                );
                              })}

                              {/* Interactive Overlays */}
                              {weightCoords.map((pt, idx) => {
                                const colWidth = (600 - chartPaddingLeft - chartPaddingRight) / Math.max(1, totalPoints);
                                return (
                                  <rect
                                    key={idx}
                                    x={pt.x - colWidth / 2}
                                    y={chartPaddingTop}
                                    width={colWidth}
                                    height={250 - chartPaddingTop - chartPaddingBottom}
                                    fill="transparent"
                                    className="cursor-pointer hover:fill-blue-500/5 transition-colors"
                                    onMouseEnter={() => setHoveredWeightPointIdx(idx)}
                                    onMouseLeave={() => setHoveredWeightPointIdx(null)}
                                  />
                                );
                              })}
                            </svg>

                            {/* Tooltip */}
                            {hoveredWeightPointIdx !== null && weightCoords[hoveredWeightPointIdx] && (() => {
                              const pt = weightCoords[hoveredWeightPointIdx];
                              return (
                                <div 
                                  className="absolute bg-cool-gray-900/95 backdrop-blur border border-cool-gray-700/80 p-3.5 rounded-xl shadow-2xl text-xs text-cool-gray-200 pointer-events-none z-10 space-y-1.5 w-64 animate-fade-in"
                                  style={{
                                    left: `${Math.min(85, Math.max(15, (pt.x / 600) * 100))}%`,
                                    top: '12px',
                                    transform: 'translateX(-50%)',
                                  }}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-white text-sm">Order #{pt.order.orderNumber}</span>
                                    <span className="px-1.5 py-0.5 bg-cool-gray-800 text-cool-gray-400 rounded text-[9px] font-bold uppercase">{pt.order.species}</span>
                                  </div>
                                  <div className="text-[10px] text-cool-gray-400">Kill Date: {pt.order.killDate || 'N/A'}</div>
                                  <div className="h-px bg-cool-gray-800 my-1"></div>
                                  
                                  <div className="flex justify-between text-blue-400">
                                    <span>Live weight (per animal):</span>
                                    <span className="font-bold">
                                      {pt.stats.liveWeightPerAnimal > 0 ? `${pt.stats.liveWeightPerAnimal.toFixed(1)} lbs` : 'N/A'}
                                      <span className="text-[10px] text-cool-gray-500 font-normal ml-1">
                                        (Total: {pt.stats.liveWeight > 0 ? `${pt.stats.liveWeight.toFixed(0)} lbs` : 'N/A'})
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-amber-400">
                                    <span>Hot weight (per animal):</span>
                                    <span className="font-bold">
                                      {pt.stats.hotWeightPerAnimal > 0 ? `${pt.stats.hotWeightPerAnimal.toFixed(1)} lbs` : 'N/A'}
                                      <span className="text-[10px] text-cool-gray-500 font-normal ml-1">
                                        (Total: {pt.stats.hotWeight > 0 ? `${pt.stats.hotWeight.toFixed(0)} lbs` : 'N/A'})
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-indigo-400">
                                    <span>Cold weight (per animal):</span>
                                    <span className="font-bold">
                                      {pt.stats.coldWeightPerAnimal > 0 ? `${pt.stats.coldWeightPerAnimal.toFixed(1)} lbs` : 'N/A'}
                                      <span className="text-[10px] text-cool-gray-500 font-normal ml-1">
                                        (Total: {pt.stats.coldWeight > 0 ? `${pt.stats.coldWeight.toFixed(0)} lbs` : 'N/A'})
                                      </span>
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-cyan-400 border-t border-cool-gray-800 pt-1 mt-1 font-semibold">
                                    <span>Packaged wt (per animal):</span>
                                    <span className="font-bold">
                                      {pt.stats.packagedWeightPerAnimal > 0 ? `${pt.stats.packagedWeightPerAnimal.toFixed(1)} lbs` : '0.0 lbs'}
                                      <span className="text-[10px] text-cool-gray-500 font-normal ml-1">
                                        (Total: {pt.stats.packagedWeight > 0 ? `${pt.stats.packagedWeight.toFixed(0)}` : '0.0'} lbs)
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* 3. CUTS OVER TIME TREND LINE GRAPH */}
                      {reportGraphTab === 'cuts' && (
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-cool-gray-800/80 pb-4">
                            <div>
                              <h4 className="text-xs font-extrabold text-cool-gray-300 uppercase tracking-widest">Cuts Trend & Comparison Over Time</h4>
                              <p className="text-[11px] text-cool-gray-500 mt-0.5">Track and compare pack proportions of multiple cuts across historical orders.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                              <div className="w-full sm:w-64">
                                <label className="block text-[10px] text-cool-gray-400 font-bold uppercase tracking-wider mb-1">Target Cuts to Analyze</label>
                                <MultiSelectDropdown
                                  options={reportData.breakdown.map(c => c.name)}
                                  selected={selectedCutsForTrend}
                                  onChange={(selected) => setSelectedCutsForTrend(selected)}
                                  placeholder={activeCutsForTrend[0] || "Select cuts..."}
                                />
                              </div>
                              {activeCutsForTrend.length > 1 && (
                                <div className="shrink-0">
                                  <label className="block text-[10px] text-cool-gray-400 font-bold uppercase tracking-wider mb-1">Trend Mode</label>
                                  <div className="flex bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-0.5 h-[38px] items-center">
                                    <button
                                      onClick={() => setCutTrendMode('comparison')}
                                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all h-full flex items-center ${cutTrendMode === 'comparison' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-white'}`}
                                    >
                                      Compare
                                    </button>
                                    <button
                                      onClick={() => setCutTrendMode('additive')}
                                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all h-full flex items-center ${cutTrendMode === 'additive' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-white'}`}
                                    >
                                      Additive Sum
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {activeCutsForTrend.length === 0 ? (
                            <div className="text-center py-12 text-cool-gray-500">No cuts found to analyze. Please import some orders.</div>
                          ) : (
                            <div className="relative pt-2">
                              <svg viewBox="0 0 600 250" className="w-full h-auto overflow-visible">
                                <defs>
                                  <linearGradient id="cutProportionGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>

                                {/* Grid Lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
                                  const val = p * roundedMaxCutPct;
                                  const y = chartPaddingTop + (1 - p) * (250 - chartPaddingTop - chartPaddingBottom);
                                  return (
                                    <g key={idx} className="opacity-30">
                                      <line 
                                        x1={chartPaddingLeft} 
                                        y1={y} 
                                        x2={600 - chartPaddingRight} 
                                        y2={y} 
                                        stroke="#4b5563" 
                                        strokeWidth="1" 
                                        strokeDasharray="3 3"
                                      />
                                      <text 
                                        x={chartPaddingLeft - 8} 
                                        y={y + 4} 
                                        textAnchor="end" 
                                        className="fill-cool-gray-400 font-mono text-[9px] font-bold"
                                      >
                                        {val.toFixed(1)}%
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Additive Mode Area Fill */}
                                {cutTrendMode === 'additive' && totalPoints > 1 && (
                                  <path d={getClosedPathString(cutTrendPointCoordsAdditive)} fill="url(#cutProportionGrad)" />
                                )}

                                {/* Additive Mode Line Curve */}
                                {cutTrendMode === 'additive' && totalPoints > 1 && (
                                  <path d={getPathString(cutTrendPointCoordsAdditive)} fill="none" stroke="#22d3ee" strokeWidth="3" strokeLinecap="round" />
                                )}

                                {/* Comparison Mode Line Curves */}
                                {cutTrendMode === 'comparison' && totalPoints > 1 && cutTrendsPointCoordsByCut.map((trendData) => (
                                  <path 
                                    key={trendData.cutName}
                                    d={getPathString(trendData.points)} 
                                    fill="none" 
                                    stroke={trendData.color} 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round" 
                                  />
                                ))}

                                {/* Additive Mode Points */}
                                {cutTrendMode === 'additive' && cutTrendPointCoordsAdditive.map((pt, idx) => (
                                  <circle 
                                    key={idx} 
                                    cx={pt.x} 
                                    cy={pt.y} 
                                    r={hoveredCutTrendIdx === idx ? 7 : 4} 
                                    className="fill-cyan-400 stroke-cool-gray-900 stroke-2 transition-all duration-150" 
                                  />
                                ))}

                                {/* Comparison Mode Points */}
                                {cutTrendMode === 'comparison' && cutTrendsPointCoordsByCut.map((trendData) => 
                                  trendData.points.map((pt, idx) => {
                                    const isHovered = hoveredCutTrendIdx === idx;
                                    return (
                                      <circle 
                                        key={`${trendData.cutName}-${idx}`} 
                                        cx={pt.x} 
                                        cy={pt.y} 
                                        r={isHovered ? 6 : 3.5} 
                                        fill={trendData.color}
                                        className="stroke-cool-gray-900 stroke-1.5 transition-all duration-150" 
                                      />
                                    );
                                  })
                                )}

                                {/* Axis Labels */}
                                {cutTrendPointCoords.map((pt, idx) => {
                                  const labelInterval = Math.max(1, Math.ceil(totalPoints / 6));
                                  if (idx % labelInterval !== 0 && idx !== totalPoints - 1) return null;
                                  return (
                                    <text 
                                      key={idx} 
                                      x={pt.x} 
                                      y={250 - chartPaddingBottom + 16} 
                                      textAnchor="middle" 
                                      className="fill-cool-gray-400 font-mono text-[9px] font-bold"
                                    >
                                      {pt.order.killDate ? pt.order.killDate.slice(5) : `O#${pt.order.orderNumber}`}
                                    </text>
                                  );
                                })}

                                {/* Interactor Columns */}
                                {cutTrendPointCoords.map((pt, idx) => {
                                  const colWidth = (600 - chartPaddingLeft - chartPaddingRight) / Math.max(1, totalPoints);
                                  return (
                                    <rect
                                      key={idx}
                                      x={pt.x - colWidth / 2}
                                      y={chartPaddingTop}
                                      width={colWidth}
                                      height={250 - chartPaddingTop - chartPaddingBottom}
                                      fill="transparent"
                                      className="cursor-pointer hover:fill-cyan-400/5 transition-colors"
                                      onMouseEnter={() => setHoveredCutTrendIdx(idx)}
                                      onMouseLeave={() => setHoveredCutTrendIdx(null)}
                                    />
                                  );
                                })}
                              </svg>

                              {/* Rich Dynamic Tooltip */}
                              {hoveredCutTrendIdx !== null && (() => {
                                const orderData = rOrdersWithStats[hoveredCutTrendIdx];
                                if (!orderData) return null;
                                const { order, stats } = orderData;
                                const ptX = chartPaddingLeft + (totalPoints > 1 ? (hoveredCutTrendIdx / (totalPoints - 1)) * (600 - chartPaddingLeft - chartPaddingRight) : (600 - chartPaddingLeft - chartPaddingRight) / 2);
                                
                                return (
                                  <div 
                                    className="absolute bg-cool-gray-900/95 backdrop-blur border border-cool-gray-700/80 p-3.5 rounded-xl shadow-2xl text-xs text-cool-gray-200 pointer-events-none z-10 space-y-1.5 w-72 animate-fade-in"
                                    style={{
                                      left: `${Math.min(80, Math.max(20, (ptX / 600) * 100))}%`,
                                      top: '12px',
                                      transform: 'translateX(-50%)',
                                    }}
                                  >
                                    <div className="flex justify-between items-center border-b border-cool-gray-800 pb-1.5">
                                      <span className="font-extrabold text-white text-sm">Order #{order.orderNumber}</span>
                                      <span className="px-1.5 py-0.5 bg-cyan-950/40 text-cyan-400 rounded text-[9px] font-bold uppercase">{order.species}</span>
                                    </div>
                                    <div className="text-[10px] text-cool-gray-400 flex justify-between">
                                      <span>Kill Date: {order.killDate || 'N/A'}</span>
                                      <span>Packaged: {stats.packagedWeight.toFixed(0)} lbs</span>
                                    </div>
                                    
                                    <div className="h-px bg-cool-gray-800 my-1"></div>
                                    
                                    {cutTrendMode === 'additive' ? (
                                      <>
                                        <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1">Additive Cuts:</div>
                                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                                          {activeCutsForTrend.map(cName => {
                                            const orderRecords = records.filter(r => r.orderId === order.id);
                                            let cWeight = 0;
                                            orderRecords.forEach(r => {
                                              const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
                                              if (name.toLowerCase() === cName.toLowerCase()) {
                                                cWeight += r.netWeight;
                                              }
                                            });
                                            const pct = stats.packagedWeight > 0 ? (cWeight / stats.packagedWeight) * 100 : 0;
                                            return (
                                              <div key={cName} className="flex justify-between text-[11px] text-cool-gray-300">
                                                <span className="truncate max-w-[150px]">{cName}</span>
                                                <span className="font-medium text-white">{cWeight.toFixed(1)} lbs ({pct.toFixed(1)}%)</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="border-t border-cool-gray-800/80 pt-1.5 mt-1.5 flex justify-between font-extrabold text-cyan-400">
                                          <span>Total Additive:</span>
                                          <span>
                                            {cutTrendPointCoordsAdditive[hoveredCutTrendIdx]?.weight.toFixed(1)} lbs ({cutTrendPointCoordsAdditive[hoveredCutTrendIdx]?.percentage.toFixed(1)}%)
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="text-[10px] text-cool-gray-400 font-bold uppercase tracking-wider mb-1">Compared Cuts:</div>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                                          {cutTrendsPointCoordsByCut.map((trend) => {
                                            const pt = trend.points[hoveredCutTrendIdx];
                                            if (!pt) return null;
                                            return (
                                              <div key={trend.cutName} className="flex justify-between items-center text-[11px]">
                                                <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: trend.color }}></span>
                                                  <span className="text-cool-gray-300 truncate">{trend.cutName}</span>
                                                </div>
                                                <span className="font-bold text-white shrink-0">
                                                  {pt.weight > 0 ? `${pt.weight.toFixed(1)} lbs` : '0 lbs'}
                                                  <span className="text-cool-gray-400 text-[10px] font-normal ml-1">({pt.percentage.toFixed(1)}%)</span>
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. SPECIES COMPARISONS BENTO */}
                      {reportGraphTab === 'species' && (
                        <div className="space-y-4">
                          <h4 className="text-xs font-extrabold text-cool-gray-300 uppercase tracking-widest">Species Comparison Analytics</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {speciesComparisonData.map(sc => (
                              <div key={sc.species} className="bg-cool-gray-900 border border-cool-gray-800 p-5 rounded-2xl space-y-4 hover:border-cool-gray-750 transition-all">
                                <div className="flex justify-between items-center border-b border-cool-gray-800 pb-3">
                                  <h5 className="text-lg font-extrabold text-white">{sc.species}</h5>
                                  <div className="flex gap-2">
                                    <span className="px-2 py-0.5 bg-cool-gray-800 border border-cool-gray-700 rounded-lg text-[10px] font-bold text-cool-gray-400 uppercase">
                                      {sc.orderCount} {sc.orderCount === 1 ? 'Order' : 'Orders'}
                                    </span>
                                    <span className="px-2 py-0.5 bg-cyan-950/40 border border-cyan-800/40 rounded-lg text-[10px] font-bold text-cyan-400 uppercase">
                                      {sc.animalCount} {sc.animalCount === 1 ? 'Animal' : 'Animals'}
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs">
                                  <div>
                                    <span className="text-cool-gray-500 font-bold uppercase block text-[9px] tracking-wider">Avg Live Weight (per animal)</span>
                                    <span className="text-sm font-bold text-white">{sc.avgLive > 0 ? `${sc.avgLive.toFixed(1)} lbs` : 'N/A'}</span>
                                  </div>
                                  <div>
                                    <span className="text-cool-gray-500 font-bold uppercase block text-[9px] tracking-wider">Avg Packaged Meat (per animal)</span>
                                    <span className="text-sm font-bold text-cyan-400">{sc.avgPackaged > 0 ? `${sc.avgPackaged.toFixed(1)} lbs` : '0.0 lbs'}</span>
                                  </div>
                                </div>

                                <div className="space-y-2.5 border-t border-cool-gray-800/60 pt-3">
                                  {/* Dressing */}
                                  <div>
                                    <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                      <span>Avg Dressing Yield (Hot/Live)</span>
                                      <span className="font-bold text-white">{sc.avgHotYield > 0 ? `${sc.avgHotYield.toFixed(1)}%` : 'N/A'}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-cool-gray-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${sc.avgHotYield}%` }}></div>
                                    </div>
                                  </div>

                                  {/* Cooler Shrinkage */}
                                  <div>
                                    <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                      <span>Avg Cooler Hanging Shrink</span>
                                      <span className="font-bold text-rose-400">{sc.avgShrink > 0 ? `${sc.avgShrink.toFixed(1)}%` : 'N/A'}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-cool-gray-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${sc.avgShrink}%` }}></div>
                                    </div>
                                  </div>

                                  {/* Cutting Yield */}
                                  <div>
                                    <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                      <span>Avg Cutting Yield (Packaged/Cold)</span>
                                      <span className="font-bold text-emerald-400">{sc.avgCutYield > 0 ? `${sc.avgCutYield.toFixed(1)}%` : 'N/A'}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-cool-gray-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${sc.avgCutYield}%` }}></div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {speciesComparisonData.length === 0 && (
                              <div className="col-span-2 text-center py-10 text-cool-gray-500">No species data parsed.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Aggregated Cut Breakdown Spreadsheet Table */}
              <div className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 sm:p-5 border-b border-cool-gray-700 bg-cool-gray-900/50 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan-400"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      Aggregated Cut Breakdown Spreadsheet
                    </h3>
                    <p className="text-xs text-cool-gray-400 mt-1">Aggregated breakdown of individual packages and weights sorted by total mass.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold text-cool-gray-400 bg-cool-gray-900 border border-cool-gray-700 px-3 py-1.5 rounded-lg">
                      {reportData.breakdown.length} unique cuts found
                    </span>
                    {(() => {
                      const totalEstValue = reportData.breakdown.reduce((sum, cut) => {
                        const matchedProd = products.find(p => (cut.productId && p.id === cut.productId) || p.name.trim().toLowerCase() === cut.name.trim().toLowerCase());
                        const price = matchedProd?.salePrice || 0;
                        const unit = matchedProd?.salePriceUnit || 'lb';
                        const cutVal = price > 0 ? (unit === 'package' ? cut.count * price : cut.totalWeight * price) : 0;
                        return sum + cutVal;
                      }, 0);
                      return totalEstValue > 0 ? (
                        <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-3 py-1.5 rounded-lg font-mono">
                          Est. Total Value: ${totalEstValue.toFixed(2)}
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-cool-gray-900/40 text-cool-gray-400 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-3.5 font-bold">Cut Name</th>
                        <th className="px-6 py-3.5 font-bold text-right">Unit Sales Price</th>
                        <th className="px-6 py-3.5 font-bold text-right">Packages Count</th>
                        <th className="px-6 py-3.5 font-bold text-right">Total Pieces</th>
                        <th className="px-6 py-3.5 font-bold text-right">Pack Share %</th>
                        <th className="px-6 py-3.5 font-bold text-right">Total Net Weight</th>
                        <th className="px-6 py-3.5 font-bold text-right">Est. Sales Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cool-gray-700/60">
                      {reportData.breakdown.map((cut) => {
                        const cutPct = reportData.totalWeight > 0 ? (cut.totalWeight / reportData.totalWeight) * 100 : 0;
                        const matchedProd = products.find(p => (cut.productId && p.id === cut.productId) || p.name.trim().toLowerCase() === cut.name.trim().toLowerCase());
                        const unitPrice = matchedProd?.salePrice || 0;
                        const unit = matchedProd?.salePriceUnit || 'lb';
                        const estValue = unitPrice > 0 ? (unit === 'package' ? cut.count * unitPrice : cut.totalWeight * unitPrice) : 0;
                        return (
                          <tr key={cut.name} className="hover:bg-cool-gray-750/30 transition group">
                            <td className="px-6 py-4 font-bold text-cool-gray-200 group-hover:text-cyan-400 transition-colors">{cut.name}</td>
                            <td className="px-6 py-4 text-right font-mono text-xs font-semibold text-cool-gray-400">
                              {unitPrice > 0 ? `$${unitPrice.toFixed(2)} / ${unit === 'package' ? 'pkg' : 'lb'}` : '—'}
                            </td>
                            <td className="px-6 py-4 text-right font-medium text-cool-gray-300">{cut.count}</td>
                            <td className="px-6 py-4 text-right font-medium text-cool-gray-300">{cut.totalPieces}</td>
                            <td className="px-6 py-4 text-right font-bold text-cool-gray-400">{cutPct.toFixed(1)}%</td>
                            <td className="px-6 py-4 text-right font-extrabold text-cyan-400">{cut.totalWeight.toFixed(2)} lbs</td>
                            <td className="px-6 py-4 text-right font-mono font-extrabold text-emerald-400">
                              {estValue > 0 ? `$${estValue.toFixed(2)}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                      {reportData.breakdown.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-cool-gray-500 font-semibold">
                            No records match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Edit Order Modal */}
        {editingOrder && (
          <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-cool-gray-850 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-cool-gray-750 animate-scale-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-cool-gray-750 mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit3 className="text-cyan-400" size={18} />
                  Edit Butcher Order
                </h3>
                <button onClick={() => setEditingOrder(null)} className="text-cool-gray-400 hover:text-white transition">
                  <X size={20} />
                </button>
              </div>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  dispatch({ 
                    type: 'EDIT_BUTCHER_ORDER', 
                    payload: { orderId: editingOrder.id, updates: editingOrder } 
                  });
                  setEditingOrder(null);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Order #</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.orderNumber || ''}
                      onChange={e => setEditingOrder({...editingOrder, orderNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Species</label>
                    <CreatableDropdown
                      options={existingSpecies}
                      value={editingOrder.species || ''}
                      onChange={(val) => setEditingOrder({...editingOrder, species: val})}
                      placeholder="e.g. Pork"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Butcher / Location Source</label>
                    <select
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                      value={editingOrder.locationId || ''}
                      onChange={e => setEditingOrder({...editingOrder, locationId: e.target.value || undefined})}
                    >
                      <option value="">-- Select Butcher / Location --</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Animal Count</label>
                    <input 
                      type="number" 
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.animalCount ?? ''}
                      onChange={e => setEditingOrder({...editingOrder, animalCount: parseFloat(e.target.value) || undefined})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Birth Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.birthDate || ''}
                      onChange={e => setEditingOrder({...editingOrder, birthDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Kill Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.killDate || ''}
                      onChange={e => setEditingOrder({...editingOrder, killDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Pickup Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.pickupDate || ''}
                      onChange={e => setEditingOrder({...editingOrder, pickupDate: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Generic Notes</label>
                  <textarea
                    rows={3}
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
                    placeholder="Add notes about this butcher order..."
                    value={editingOrder.notes || ''}
                    onChange={e => setEditingOrder({...editingOrder, notes: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-4 gap-4 border-t border-cool-gray-750 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Live Wt (lbs)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.liveWeight ?? ''}
                      onChange={e => setEditingOrder({...editingOrder, liveWeight: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Hot Wt (lbs)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.hotWeight ?? ''}
                      onChange={e => setEditingOrder({...editingOrder, hotWeight: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Cold Wt (lbs)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.coldWeight ?? ''}
                      onChange={e => setEditingOrder({...editingOrder, coldWeight: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Fee ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.butcherFee !== undefined ? editingOrder.butcherFee : ''}
                      onChange={e => setEditingOrder({...editingOrder, butcherFee: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* Associated Document Links */}
                <div className="border-t border-cool-gray-750 pt-4">
                  <label className="block text-xs font-bold text-cool-gray-400 mb-2 uppercase tracking-wider">Associated Document Links</label>
                  
                  {/* Current Documents list */}
                  {(!editingOrder.documents || editingOrder.documents.length === 0) ? (
                    <p className="text-xs text-cool-gray-500 italic mb-3 bg-cool-gray-900/30 p-2.5 rounded-lg text-center text-cool-gray-400">No documents attached yet.</p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {editingOrder.documents.map((doc: any) => {
                        const isDocEditing = editingDocId === doc.id;
                        return (
                          <div key={doc.id}>
                            {isDocEditing ? (
                              <div className="bg-cool-gray-950 p-3 rounded-lg border border-cyan-500/30 text-xs space-y-2.5">
                                <p className="text-xs font-bold text-cyan-400">Edit Document Link</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div>
                                    <label className="block text-[10px] font-bold text-cool-gray-400 uppercase mb-1">Document Name</label>
                                    <input
                                      type="text"
                                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                                      value={editingDocName}
                                      onChange={e => setEditingDocName(e.target.value)}
                                      placeholder="e.g. Cutsheet, Invoice"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-bold text-cool-gray-400 uppercase mb-1">URL (https://...)</label>
                                    <input
                                      type="url"
                                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                                      value={editingDocUrl}
                                      onChange={e => setEditingDocUrl(e.target.value)}
                                      placeholder="e.g. https://google.com/..."
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDocId(null);
                                      setEditingDocName('');
                                      setEditingDocUrl('');
                                    }}
                                    className="px-2.5 py-1 text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 rounded transition text-[10px] font-bold"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const name = editingDocName.trim();
                                      let url = editingDocUrl.trim();
                                      if (!name || !url) return;
                                      if (!/^https?:\/\//i.test(url)) {
                                        url = 'https://' + url;
                                      }
                                      const updatedDocs = (editingOrder.documents || []).map((d: any) =>
                                        d.id === doc.id ? { ...d, name, url } : d
                                      );
                                      setEditingOrder({ ...editingOrder, documents: updatedDocs });
                                      setEditingDocId(null);
                                      setEditingDocName('');
                                      setEditingDocUrl('');
                                    }}
                                    className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded transition text-[10px] font-bold"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-cool-gray-900/50 p-2.5 rounded-lg border border-cool-gray-800 text-xs">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                  <Link size={15} className="text-cyan-500 shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-cool-gray-100 text-sm truncate">{doc.name}</span>
                                    <span className="text-[10px] text-cool-gray-500 truncate font-mono">{doc.url}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDocId(doc.id);
                                      setEditingDocName(doc.name);
                                      setEditingDocUrl(doc.url);
                                    }}
                                    className="text-cool-gray-400 hover:text-cyan-400 p-1.5 rounded hover:bg-cool-gray-800 transition"
                                    title="Edit document"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedDocs = (editingOrder.documents || []).filter((d: any) => d.id !== doc.id);
                                      setEditingOrder({ ...editingOrder, documents: updatedDocs });
                                    }}
                                    className="text-cool-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-cool-gray-800 transition"
                                    title="Remove document link"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Document sub-form */}
                  <div className="bg-cool-gray-900/30 p-3 rounded-xl border border-cool-gray-800 space-y-3">
                    <p className="text-xs font-bold text-cool-gray-300">Add a Document Link</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Document Name (e.g. Cutsheet, Invoice, Yield)"
                        className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                        value={newDocName}
                        onChange={e => setNewDocName(e.target.value)}
                      />
                      <input
                        type="url"
                        placeholder="URL (https://...)"
                        className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                        value={newDocUrl}
                        onChange={e => setNewDocUrl(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const name = newDocName.trim();
                          let url = newDocUrl.trim();
                          if (!name || !url) return;
                          
                          if (!/^https?:\/\//i.test(url)) {
                            url = 'https://' + url;
                          }

                          const newDoc = {
                            id: crypto.randomUUID(),
                            name,
                            url
                          };
                          
                          setEditingOrder({
                            ...editingOrder,
                            documents: [...(editingOrder.documents || []), newDoc]
                          });
                          
                          setNewDocName('');
                          setNewDocUrl('');
                        }}
                        className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} />
                        Attach Document Link
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-cool-gray-750">
                  <button 
                    type="button"
                    onClick={() => setEditingOrder(null)}
                    className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-white rounded-lg text-sm font-bold transition"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold transition"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-cool-gray-850 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-cool-gray-750 animate-scale-up">
              <div className="flex justify-between items-center pb-4 border-b border-cool-gray-750">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trash2 className="text-red-400" size={18} />
                  Delete Order
                </h3>
              </div>
              <p className="mt-4 text-cool-gray-300 text-sm">
                Are you sure you want to delete this order? This will NOT remove any items imported to the Off-Site spreadsheet, but will permanently delete this butcher log record.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-white rounded-lg text-sm font-bold transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    dispatch({ type: 'DELETE_BUTCHER_ORDER', payload: { orderId: deleteConfirmId } });
                    setDeleteConfirmId(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
