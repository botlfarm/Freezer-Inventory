import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, ChevronDown, ChevronRight, FileSpreadsheet, Download, 
  Tag as TagIcon, Edit3, Trash2, X, Filter, Check, ArrowUpDown, 
  Layers, Eye, EyeOff, Plus, Info, Box, Package, List
} from 'lucide-react';
import { InventoryState, Action, OffSiteEntry, Product, Tag as AppTag } from '../types';
import { compareBoxLabels } from '../utils/boxSort';

interface ButcherSpreadsheetViewProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
}

const STORAGE_KEYS = {
  SELECTED_ORDER_IDS: 'butcher_spreadsheet_selected_order_ids',
  SEARCH_TERM: 'butcher_spreadsheet_search_term',
  VIEW_ORIGINAL_NAMES: 'butcher_spreadsheet_view_original_names',
  VIEW_GROUPED_BY_BOX: 'butcher_spreadsheet_view_grouped_by_box',
  SELECTED_PRIMARY: 'butcher_spreadsheet_selected_primary',
  SELECTED_SUB: 'butcher_spreadsheet_selected_sub',
  VISIBLE_COLUMNS: 'butcher_spreadsheet_visible_columns',
  SORT_FIELD: 'butcher_spreadsheet_sort_field',
  SORT_DIRECTION: 'butcher_spreadsheet_sort_direction',
  FILTER_BOXES: 'butcher_spreadsheet_filter_boxes',
  FILTER_CUTS: 'butcher_spreadsheet_filter_cuts',
  FILTER_PRIMARY_CATEGORIES: 'butcher_spreadsheet_filter_primary_categories',
  FILTER_ORDER_NUMBERS: 'butcher_spreadsheet_filter_order_numbers',
  FILTER_LOCATIONS: 'butcher_spreadsheet_filter_locations',
  FILTER_PALLETS: 'butcher_spreadsheet_filter_pallets',
  FILTER_SERIALS: 'butcher_spreadsheet_filter_serials',
  FILTER_LOTS: 'butcher_spreadsheet_filter_lots',
  FILTER_PACK_DATES: 'butcher_spreadsheet_filter_pack_dates',
  FILTER_STATUSES: 'butcher_spreadsheet_filter_statuses',
  FILTER_ARCHIVED: 'butcher_spreadsheet_filter_archived',
};

function getSavedSet(key: string): Set<string> | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function saveSet(key: string, setVal: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(setVal)));
  } catch (e) {
    // ignore
  }
}

function getSavedJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch (e) {
    // ignore
  }
  return fallback;
}

function saveJSON<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    // ignore
  }
}

export function getCategoryDisplay(item: { primaryCategory?: string; subCategory?: string }): string {
  const p = item.primaryCategory?.trim();
  const s = item.subCategory?.trim();
  const hasP = p && p !== 'Uncategorized';
  const hasS = s && s !== 'Uncategorized';

  if (hasP && hasS && p !== s) {
    return `${p} / ${s}`;
  }
  if (hasP) return p;
  if (hasS) return s;
  return 'Uncategorized';
}

const ButcherTagPopover: React.FC<{
  item: any;
  tagIds: string[];
  tags: AppTag[];
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}> = ({ item, tagIds, tags, dispatch, onClose }) => {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => [...tagIds]);

  const handleToggle = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleApply = () => {
    const toAdd = selectedTagIds.filter(id => !tagIds.includes(id));
    const toRemove = tagIds.filter(id => !selectedTagIds.includes(id));

    toAdd.forEach(tagId => {
      dispatch({ type: 'TOGGLE_OFFSITE_ENTRY_TAG', payload: { entryId: item.id, tagId } });
    });
    toRemove.forEach(tagId => {
      dispatch({ type: 'TOGGLE_OFFSITE_ENTRY_TAG', payload: { entryId: item.id, tagId } });
    });

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={() => onClose()} />
      <div className="absolute right-0 top-full mt-1 bg-cool-gray-800 border border-cool-gray-650 rounded-xl p-2.5 shadow-xl z-40 w-52 text-left space-y-1">
        <div className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider pb-1 border-b border-cool-gray-700">
          Item Tags
        </div>
        <div className="space-y-1 my-1 max-h-48 overflow-y-auto">
          {tags.map((t: AppTag) => {
            const isSet = selectedTagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleToggle(t.id)}
                className={`w-full text-left text-xs px-2 py-1 rounded flex items-center gap-2 hover:bg-cool-gray-700 cursor-pointer ${
                  isSet ? 'font-bold text-cyan-300 bg-cyan-950/20' : 'text-cool-gray-300'
                }`}
              >
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0 border"
                  style={{ backgroundColor: t.color || '#38bdf8' }}
                />
                <span className="flex-1 truncate">{t.name}</span>
                {isSet && <span className="text-cyan-400 text-[10px]">✓</span>}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-1.5 pt-1.5 border-t border-cool-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-0.5 text-[11px] text-cool-gray-400 hover:text-white rounded bg-cool-gray-700 cursor-pointer font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-2.5 py-0.5 text-[11px] text-white bg-cyan-600 hover:bg-cyan-500 rounded cursor-pointer font-extrabold shadow"
          >
            OK
          </button>
        </div>
      </div>
    </>
  );
};

export const ButcherSpreadsheetView: React.FC<ButcherSpreadsheetViewProps> = ({ state, dispatch }) => {
  // Sort butcher orders descending by order number (largest/newest at the top), fallback to date
  const sortedOrders = useMemo(() => {
    const orders = [...(state.butcherOrders || [])];
    return orders.sort((a, b) => {
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
      const dateA = a.killDate ? new Date(a.killDate).getTime() : a.createdAt || 0;
      const dateB = b.killDate ? new Date(b.killDate).getTime() : b.createdAt || 0;
      return dateB - dateA;
    });
  }, [state.butcherOrders]);

  // Selected Order Filter - Remembers last selected orders from localStorage, fallback to most recent butcher order!
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(() => {
    const savedSet = getSavedSet(STORAGE_KEYS.SELECTED_ORDER_IDS);
    if (savedSet && savedSet.size > 0) {
      return savedSet;
    }
    return sortedOrders.length > 0 ? new Set([sortedOrders[0].id]) : new Set(['ALL']);
  });
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');

  // Save selectedOrderIds when changed
  useEffect(() => {
    if (selectedOrderIds.size > 0) {
      saveSet(STORAGE_KEYS.SELECTED_ORDER_IDS, selectedOrderIds);
    }
  }, [selectedOrderIds]);

  // Keep selectedOrderIds synced if order was removed
  useEffect(() => {
    if (sortedOrders.length > 0 && !selectedOrderIds.has('ALL') && selectedOrderIds.size > 0) {
      const valid = Array.from(selectedOrderIds).filter(id => sortedOrders.some(o => o.id === id));
      if (valid.length !== selectedOrderIds.size) {
        setSelectedOrderIds(valid.length > 0 ? new Set(valid) : new Set([sortedOrders[0].id]));
      }
    }
  }, [sortedOrders, selectedOrderIds]);

  // Column Filters State (persisted via localStorage)
  const [filterBoxes, setFilterBoxes] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_BOXES) || new Set());
  const [filterCuts, setFilterCuts] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_CUTS) || new Set());
  const [filterPrimaryCategories, setFilterPrimaryCategories] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_PRIMARY_CATEGORIES) || new Set());
  const [filterOrderNumbers, setFilterOrderNumbers] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_ORDER_NUMBERS) || new Set());
  const [filterLocations, setFilterLocations] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_LOCATIONS) || new Set());
  const [filterPallets, setFilterPallets] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_PALLETS) || new Set());
  const [filterSerials, setFilterSerials] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_SERIALS) || new Set());
  const [filterLots, setFilterLots] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_LOTS) || new Set());
  const [filterPackDates, setFilterPackDates] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_PACK_DATES) || new Set());
  const [filterStatuses, setFilterStatuses] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_STATUSES) || new Set());
  const [filterArchived, setFilterArchived] = useState<Set<string>>(() => getSavedSet(STORAGE_KEYS.FILTER_ARCHIVED) || new Set());

  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_BOXES, filterBoxes); }, [filterBoxes]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_CUTS, filterCuts); }, [filterCuts]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_PRIMARY_CATEGORIES, filterPrimaryCategories); }, [filterPrimaryCategories]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_ORDER_NUMBERS, filterOrderNumbers); }, [filterOrderNumbers]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_LOCATIONS, filterLocations); }, [filterLocations]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_PALLETS, filterPallets); }, [filterPallets]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_SERIALS, filterSerials); }, [filterSerials]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_LOTS, filterLots); }, [filterLots]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_PACK_DATES, filterPackDates); }, [filterPackDates]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_STATUSES, filterStatuses); }, [filterStatuses]);
  useEffect(() => { saveSet(STORAGE_KEYS.FILTER_ARCHIVED, filterArchived); }, [filterArchived]);

  // Search inputs inside column filter dropdowns
  const [boxesSearch, setBoxesSearch] = useState('');
  const [cutsSearch, setCutsSearch] = useState('');
  const [categoriesSearch, setCategoriesSearch] = useState('');
  const [orderNumbersSearch, setOrderNumbersSearch] = useState('');
  const [locationsSearch, setLocationsSearch] = useState('');
  const [palletsSearch, setPalletsSearch] = useState('');
  const [serialsSearch, setSerialsSearch] = useState('');
  const [lotsSearch, setLotsSearch] = useState('');
  const [packDatesSearch, setPackDatesSearch] = useState('');
  const [statusesSearch, setStatusesSearch] = useState('');
  const [archivedSearch, setArchivedSearch] = useState('');

  // Open column filter dropdown ID
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // View preferences (persisted)
  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem(STORAGE_KEYS.SEARCH_TERM) || '');
  const [viewOriginalNames, setViewOriginalNames] = useState(() => localStorage.getItem(STORAGE_KEYS.VIEW_ORIGINAL_NAMES) === 'true');
  const [viewGroupedByBox, setViewGroupedByBox] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VIEW_GROUPED_BY_BOX);
    return saved !== null ? saved === 'true' : true;
  });
  const [simulateBoxCount, setSimulateBoxCount] = useState(() => localStorage.getItem("offsite-simulate-box-count") === "true");
  const theoreticalBoxWeight = 40;

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SEARCH_TERM, searchTerm); }, [searchTerm]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.VIEW_ORIGINAL_NAMES, String(viewOriginalNames)); }, [viewOriginalNames]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.VIEW_GROUPED_BY_BOX, String(viewGroupedByBox)); }, [viewGroupedByBox]);

  const [selectedPrimary, setSelectedPrimary] = useState<string[]>(() => getSavedJSON(STORAGE_KEYS.SELECTED_PRIMARY, []));
  const [selectedSub, setSelectedSub] = useState<string[]>(() => getSavedJSON(STORAGE_KEYS.SELECTED_SUB, []));
  const [isCategoryFilterOpen, setIsCategoryFilterOpen] = useState(false);
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  useEffect(() => { saveJSON(STORAGE_KEYS.SELECTED_PRIMARY, selectedPrimary); }, [selectedPrimary]);
  useEffect(() => { saveJSON(STORAGE_KEYS.SELECTED_SUB, selectedSub); }, [selectedSub]);

  // Column visibility state (persisted)
  const defaultVisibleColumns = {
    box: true,
    cutName: true,
    category: true,
    weight: true,
    pieces: true,
    location: true,
    pallet: true,
    serial: true,
    lotNumber: true,
    packDate: true,
    notes: true,
    tags: true,
    status: true,
    archived: true,
  };
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const saved = getSavedJSON<Record<string, boolean> | null>(STORAGE_KEYS.VISIBLE_COLUMNS, null);
    return saved ? { ...defaultVisibleColumns, ...saved } : defaultVisibleColumns;
  });

  useEffect(() => { saveJSON(STORAGE_KEYS.VISIBLE_COLUMNS, visibleColumns); }, [visibleColumns]);

  // Sorting state (persisted)
  const [sortField, setSortField] = useState<string>(() => localStorage.getItem(STORAGE_KEYS.SORT_FIELD) || 'cutName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => (localStorage.getItem(STORAGE_KEYS.SORT_DIRECTION) as 'asc' | 'desc') || 'asc');

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SORT_FIELD, sortField); }, [sortField]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.SORT_DIRECTION, sortDirection); }, [sortDirection]);

  // Box expansion state
  const [expandedBoxes, setExpandedBoxes] = useState<Record<string, boolean>>({});

  // Itemized Inventory Breakdown states
  const [showItemBreakdown, setShowItemBreakdown] = useState(false);
  const [breakdownSearch, setBreakdownSearch] = useState('');
  const [breakdownCategory, setBreakdownCategory] = useState('All');
  const [breakdownSortField, setBreakdownSortField] = useState('weight');
  const [breakdownSortAsc, setBreakdownSortAsc] = useState(false);

  // Inline edit state
  const [editingItem, setEditingItem] = useState<OffSiteEntry | null>(null);
  const [editForm, setEditForm] = useState<Partial<OffSiteEntry>>({});
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [openTagSelectorId, setOpenTagSelectorId] = useState<string | null>(null);

  const selectedOrdersSummary = useMemo(() => {
    const isAll = selectedOrderIds.size === 0 || selectedOrderIds.has('ALL');
    if (isAll) {
      return {
        label: 'All Butcher Orders',
        count: sortedOrders.length,
        isAll: true,
        orders: sortedOrders
      };
    }
    const matched = sortedOrders.filter(o => selectedOrderIds.has(o.id));
    if (matched.length === 0) {
      return {
        label: 'No Orders Selected',
        count: 0,
        isAll: false,
        orders: []
      };
    }
    if (matched.length === 1) {
      return {
        label: `Order #${matched[0].orderNumber} (${matched[0].species || 'Butcher'})`,
        count: 1,
        isAll: false,
        orders: matched
      };
    }
    return {
      label: `${matched.length} Orders Selected`,
      count: matched.length,
      isAll: false,
      orders: matched
    };
  }, [selectedOrderIds, sortedOrders]);

  const products = state.products || [];

  // Derive records for the selected order scope (including both active and archived cuts)
  const rawOrderEntries = useMemo(() => {
    const allEntries = state.offSiteEntries || [];
    const isAll = selectedOrderIds.size === 0 || selectedOrderIds.has('ALL');
    if (isAll) {
      return allEntries.filter(e => e.orderId || e.orderNumber);
    }
    
    const selectedOrderNums = new Set<string>();
    sortedOrders.forEach(o => {
      if (selectedOrderIds.has(o.id) && o.orderNumber) {
        selectedOrderNums.add(o.orderNumber);
      }
    });

    return allEntries.filter(e => {
      if (e.orderId && selectedOrderIds.has(e.orderId)) return true;
      if (e.orderNumber && selectedOrderNums.has(e.orderNumber)) return true;
      return false;
    });
  }, [state.offSiteEntries, selectedOrderIds, sortedOrders]);

  // Process and map cuts to Product Catalog metadata
  const mappedEntries = useMemo(() => {
    return rawOrderEntries.map((e) => {
      const origStr = (e.originalCutName || e.cuts || '').trim();
      const normStr = ((state.products?.find(p => p.id === e.productId)?.name || '') || '').trim();

      let matchedProduct: Product | undefined = undefined;
      if (normStr) {
        matchedProduct = products.find(p => p.name.trim().toLowerCase() === normStr.toLowerCase());
      }
      if (!matchedProduct) {
        const matchNum = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const origNum = matchNum(origStr);
        if (origNum) {
          matchedProduct = products.find(p => 
            p.productNumbers && p.productNumbers.some(num => num.toLowerCase() === origNum.toLowerCase())
          );
        }
      }
      if (!matchedProduct) {
        const cleanName = (str: string) => str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
        const cleanOrig = cleanName(origStr);
        matchedProduct = products.find(p => {
          const pName = p.name.trim().toLowerCase();
          return pName === cleanOrig || pName === origStr.toLowerCase();
        });
      }

      const displayCutName = viewOriginalNames 
        ? (e.originalCutName || e.cuts || 'Unspecified Cut')
        : (matchedProduct ? matchedProduct.name : (e.cuts || e.originalCutName || 'Unspecified Cut'));

      const isArchived = !!(e.archived === true || e.archived === 1 || String(e.archived) === 'true');

      const isManuallyCorrected = e.originalCutName && (
        !e.serial || 
        !state.butcherRecords?.find(br => br.serial === e.serial && br.originalCutName === e.originalCutName)
      );

      return {
        ...e,
        displayCutName,
        matchedProduct,
        isManuallyCorrected,
        primaryCategory: matchedProduct?.primaryCategory || 'Uncategorized',
        subCategory: matchedProduct?.subCategory || 'Uncategorized',
        statusLabel: isArchived ? 'Moved / Depleted' : 'Active Off-Site',
        archivedLabel: isArchived ? 'Yes' : 'No',
        isArchived
      };
    });
  }, [rawOrderEntries, products, state.products, viewOriginalNames]);

  // Extract primary and sub category options for filtering
  const categoryOptions = useMemo(() => {
    const primarySet = new Set<string>();
    const subMap: Record<string, Set<string>> = {};

    mappedEntries.forEach(item => {
      if (item.primaryCategory) {
        primarySet.add(item.primaryCategory);
        if (!subMap[item.primaryCategory]) subMap[item.primaryCategory] = new Set();
        if (item.subCategory) subMap[item.primaryCategory].add(item.subCategory);
      }
    });

    const primaryOptions = Array.from(primarySet).sort();
    const subOptions: Record<string, string[]> = {};
    Object.keys(subMap).forEach(k => {
      subOptions[k] = Array.from(subMap[k]).sort();
    });

    return { primaryOptions, subOptions };
  }, [mappedEntries]);

  // Unique Options for Per-Column Filtering
  const allBoxes = useMemo(() => Array.from(new Set(mappedEntries.map(e => e.box ? e.box.trim() : 'Unboxed Cuts'))).sort((a: string, b: string) => compareBoxLabels(a, b)), [mappedEntries]);
  const allCuts = useMemo(() => Array.from(new Set(mappedEntries.map(e => e.displayCutName || 'Unspecified Cut'))).sort(), [mappedEntries]);
  const allPrimaryCategories = useMemo(() => Array.from(new Set(mappedEntries.map(e => getCategoryDisplay(e)))).sort(), [mappedEntries]);
  const allOrderNumbers = useMemo(() => (Array.from(new Set(mappedEntries.map(e => e.orderNumber || 'Unassigned'))) as string[]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })), [mappedEntries]);
  const allLocations = useMemo(() => Array.from(new Set(mappedEntries.map(e => e.location || 'Unassigned'))).sort(), [mappedEntries]);
  const allPallets = useMemo(() => Array.from(new Set(mappedEntries.map(e => e.currentLocation || e.pallet || 'Unassigned'))).sort(), [mappedEntries]);
  const allSerials = useMemo(() => Array.from(new Set(mappedEntries.map(e => e.serial || 'N/A'))).sort(), [mappedEntries]);
  const allLots = useMemo(() => Array.from(new Set(mappedEntries.map(e => e.lot || '-'))).sort(), [mappedEntries]);
  const allPackDates = useMemo(() => Array.from(new Set(mappedEntries.map(e => e.packDate || '-'))).sort(), [mappedEntries]);
  const allStatuses = ['Active Off-Site', 'Moved / Depleted'];
  const allArchived = ['Yes', 'No'];

  // Apply Search, Category Filters, and Column Filters
  const filteredEntries = useMemo(() => {
    let list = mappedEntries;

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(e => {
        return (
          (e.serial || '').toLowerCase().includes(q) ||
          (e.displayCutName || '').toLowerCase().includes(q) ||
          (e.originalCutName || '').toLowerCase().includes(q) ||
          (e.orderNumber || '').toLowerCase().includes(q) ||
          (e.box || '').toLowerCase().includes(q) ||
          (e.lot || '').toLowerCase().includes(q) ||
          (e.currentLocation || e.pallet || '').toLowerCase().includes(q) ||
          (e.location || '').toLowerCase().includes(q) ||
          (e.notes || '').toLowerCase().includes(q) ||
          getCategoryDisplay(e).toLowerCase().includes(q)
        );
      });
    }

    // Category filter
    if (selectedPrimary.length > 0 || selectedSub.length > 0) {
      list = list.filter(e => {
        const matchesPrimary = selectedPrimary.length === 0 || selectedPrimary.includes(e.primaryCategory);
        const matchesSub = selectedSub.length === 0 || selectedSub.includes(e.subCategory);
        return matchesPrimary && matchesSub;
      });
    }

    // Column Filters
    if (filterBoxes.size > 0) {
      list = list.filter(e => filterBoxes.has(e.box ? e.box.trim() : 'Unboxed Cuts'));
    }
    if (filterCuts.size > 0) {
      list = list.filter(e => filterCuts.has(e.displayCutName || 'Unspecified Cut'));
    }
    if (filterPrimaryCategories.size > 0) {
      list = list.filter(e => filterPrimaryCategories.has(getCategoryDisplay(e)));
    }
    if (filterOrderNumbers.size > 0) {
      list = list.filter(e => filterOrderNumbers.has(e.orderNumber || 'Unassigned'));
    }
    if (filterLocations.size > 0) {
      list = list.filter(e => filterLocations.has(e.location || 'Unassigned'));
    }
    if (filterPallets.size > 0) {
      list = list.filter(e => filterPallets.has(e.currentLocation || e.pallet || 'Unassigned'));
    }
    if (filterSerials.size > 0) {
      list = list.filter(e => filterSerials.has(e.serial || 'N/A'));
    }
    if (filterLots.size > 0) {
      list = list.filter(e => filterLots.has(e.lot || '-'));
    }
    if (filterPackDates.size > 0) {
      list = list.filter(e => filterPackDates.has(e.packDate || '-'));
    }
    if (filterStatuses.size > 0) {
      list = list.filter(e => filterStatuses.has(e.statusLabel || ''));
    }
    if (filterArchived.size > 0) {
      list = list.filter(e => filterArchived.has(e.archivedLabel || 'No'));
    }

    return list;
  }, [
    mappedEntries, searchTerm, selectedPrimary, selectedSub,
    filterBoxes, filterCuts, filterPrimaryCategories, filterOrderNumbers,
    filterLocations, filterPallets, filterSerials, filterLots, filterPackDates, filterStatuses, filterArchived
  ]);

  const hasActiveColumnFilters = useMemo(() => {
    return (
      filterBoxes.size > 0 ||
      filterCuts.size > 0 ||
      filterPrimaryCategories.size > 0 ||
      filterOrderNumbers.size > 0 ||
      filterLocations.size > 0 ||
      filterPallets.size > 0 ||
      filterSerials.size > 0 ||
      filterLots.size > 0 ||
      filterPackDates.size > 0 ||
      filterStatuses.size > 0 ||
      filterArchived.size > 0
    );
  }, [
    filterBoxes, filterCuts, filterPrimaryCategories, filterOrderNumbers,
    filterLocations, filterPallets, filterSerials, filterLots, filterPackDates, filterStatuses, filterArchived
  ]);

  const clearAllColumnFilters = () => {
    setFilterBoxes(new Set());
    setFilterCuts(new Set());
    setFilterPrimaryCategories(new Set());
    setFilterOrderNumbers(new Set());
    setFilterLocations(new Set());
    setFilterPallets(new Set());
    setFilterSerials(new Set());
    setFilterLots(new Set());
    setFilterPackDates(new Set());
    setFilterStatuses(new Set());
    setFilterArchived(new Set());
  };

  // Reusable Column Filter Dropdown Modal Component
  const renderFilterDropdown = (
    type: string,
    allOptions: string[],
    selectedSet: Set<string>,
    setSelectedSet: React.Dispatch<React.SetStateAction<Set<string>>>,
    searchVal: string,
    setSearchVal: (v: string) => void
  ) => {
    const filteredOptions = allOptions.filter(opt => opt.toLowerCase().includes(searchVal.toLowerCase()));

    return (
      <>
        <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setOpenFilter(null); }}></div>
        <div 
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cool-gray-800 border border-cool-gray-700 rounded-xl p-3 z-[100] w-64 shadow-2xl space-y-2 flex flex-col max-h-[350px] text-left font-normal max-w-[90vw]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 text-cool-gray-500" size={13} />
            <input
              type="text"
              placeholder="Search options..."
              className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg pl-8 pr-7 py-1.5 text-xs text-white placeholder-cool-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            {searchVal && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSearchVal(''); }}
                className="absolute right-2 top-2.5 text-cool-gray-500 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex justify-between items-center text-[10px] text-cool-gray-400 font-bold px-1 border-b border-cool-gray-750 pb-1.5">
            <button
              type="button"
              className="hover:text-cyan-400 transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const updated = new Set(selectedSet);
                filteredOptions.forEach(o => updated.add(o));
                setSelectedSet(updated);
              }}
            >
              Select All
            </button>
            <button
              type="button"
              className="hover:text-rose-400 transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSet(new Set());
              }}
            >
              Clear Filter
            </button>
          </div>

          <div className="overflow-y-auto max-h-40 space-y-1 pr-1 divide-y divide-cool-gray-750/30">
            {filteredOptions.map(opt => {
              const isChecked = selectedSet.has(opt);

              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-1.5 py-1.5 hover:bg-cool-gray-750 rounded-lg cursor-pointer text-xs select-none text-white transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-3.5 h-3.5"
                    checked={isChecked}
                    onChange={() => {
                      const next = new Set(selectedSet);
                      if (next.has(opt)) next.delete(opt);
                      else next.add(opt);
                      setSelectedSet(next);
                    }}
                  />
                  <span className="truncate" title={opt}>{opt}</span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="text-center text-[11px] text-cool-gray-500 italic py-4">
                No results found
              </div>
            )}
          </div>

          <div className="pt-1.5 border-t border-cool-gray-750 flex justify-between gap-2 items-center">
            {selectedSet.size > 0 ? (
              <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/40 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                {selectedSet.size} active
              </span>
            ) : <span />}
            <button
              type="button"
              className="bg-cool-gray-700 hover:bg-cool-gray-650 text-white font-bold text-[10px] px-2.5 py-1 rounded transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setOpenFilter(null);
              }}
            >
              Done
            </button>
          </div>
        </div>
      </>
    );
  };

  // Sort flat list helper
  const sortedFlatEntries = useMemo(() => {
    const list = [...filteredEntries];
    return list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'serial': valA = a.serial || ''; valB = b.serial || ''; break;
        case 'cutName': valA = a.displayCutName || ''; valB = b.displayCutName || ''; break;
        case 'category': valA = getCategoryDisplay(a); valB = getCategoryDisplay(b); break;
        case 'packDate': valA = a.packDate || ''; valB = b.packDate || ''; break;
        case 'lotNumber': valA = a.lot || ''; valB = b.lot || ''; break;
        case 'pieces': valA = a.pieces || 0; valB = b.pieces || 0; break;
        case 'weight': valA = a.netWeight || 0; valB = b.netWeight || 0; break;
        case 'orderNumber': valA = a.orderNumber || ''; valB = b.orderNumber || ''; break;
        case 'box': valA = a.box || ''; valB = b.box || ''; break;
        case 'location': valA = a.location || ''; valB = b.location || ''; break;
        case 'pallet': valA = a.currentLocation || a.pallet || ''; valB = b.currentLocation || b.pallet || ''; break;
        case 'status': valA = a.archived ? 1 : 0; valB = b.archived ? 1 : 0; break;
        case 'archived': valA = a.archived ? 1 : 0; valB = b.archived ? 1 : 0; break;
        default: valA = a.displayCutName || ''; valB = b.displayCutName || '';
      }

      if (sortField === 'box') {
        const cmp = compareBoxLabels(valA, valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, sortField, sortDirection]);

  // Grouped Box Data (Condensed)
  const condensedBoxes = useMemo(() => {
    const boxMap: Record<string, {
      boxId: string;
      items: typeof mappedEntries;
      totalWeight: number;
      totalPieces: number;
      location: string;
      pallet: string;
      activeCount: number;
      archivedCount: number;
      cutsSummary: Record<string, { count: number; weight: number }>;
      categories: Set<string>;
      orderNumbers: Set<string>;
      lots: Set<string>;
      packDates: Set<string>;
    }> = {};

    filteredEntries.forEach(item => {
      const bId = item.box ? item.box.trim() : 'Unboxed Cuts';
      if (!boxMap[bId]) {
        boxMap[bId] = {
          boxId: bId,
          items: [],
          totalWeight: 0,
          totalPieces: 0,
          location: item.location || 'N/A',
          pallet: item.currentLocation || item.pallet || 'N/A',
          activeCount: 0,
          archivedCount: 0,
          cutsSummary: {},
          categories: new Set(),
          orderNumbers: new Set(),
          lots: new Set(),
          packDates: new Set()
        };
      }

      boxMap[bId].items.push(item);
      boxMap[bId].totalWeight += item.netWeight || 0;
      boxMap[bId].totalPieces += item.pieces || 1;
      if (item.archived) boxMap[bId].archivedCount++;
      else boxMap[bId].activeCount++;

      const cutName = item.displayCutName || 'Unknown Cut';
      if (!boxMap[bId].cutsSummary[cutName]) {
        boxMap[bId].cutsSummary[cutName] = { count: 0, weight: 0 };
      }
      boxMap[bId].cutsSummary[cutName].count += item.pieces || 1;
      boxMap[bId].cutsSummary[cutName].weight += item.netWeight || 0;

      const catDisplay = getCategoryDisplay(item);
      if (catDisplay) boxMap[bId].categories.add(catDisplay);
      if (item.orderNumber) boxMap[bId].orderNumbers.add(item.orderNumber);
      if (item.lot) boxMap[bId].lots.add(item.lot);
      if (item.packDate) boxMap[bId].packDates.add(item.packDate);
    });

    const boxList = Object.values(boxMap);

    // Sort boxes based on sortField and sortDirection
    return boxList.sort((a, b) => {
      if (a.boxId === 'Unboxed Cuts') return 1;
      if (b.boxId === 'Unboxed Cuts') return -1;

      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'box':
          valA = a.boxId;
          valB = b.boxId;
          break;
        case 'cutName':
          valA = Object.keys(a.cutsSummary).sort().join(', ');
          valB = Object.keys(b.cutsSummary).sort().join(', ');
          break;
        case 'category':
          valA = Array.from(a.categories).sort().join(', ');
          valB = Array.from(b.categories).sort().join(', ');
          break;
        case 'weight':
          valA = a.totalWeight;
          valB = b.totalWeight;
          break;
        case 'pieces':
          valA = a.totalPieces;
          valB = b.totalPieces;
          break;
        case 'location':
          valA = a.location;
          valB = b.location;
          break;
        case 'pallet':
          valA = a.pallet;
          valB = b.pallet;
          break;
        case 'status':
        case 'archived':
          valA = a.archivedCount / (a.items.length || 1);
          valB = b.archivedCount / (b.items.length || 1);
          break;
        default:
          valA = a.boxId;
          valB = b.boxId;
      }

      if (sortField === 'box' || !sortField) {
        const cmp = compareBoxLabels(valA, valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, sortField, sortDirection]);

  // Spreadsheet Summary Totals (Updates live with filters!)
  const spreadsheetSummary = useMemo(() => {
    let totalWeight = 0;
    let totalPieces = 0;
    const boxSet = new Set<string>();
    let activeCount = 0;
    let archivedCount = 0;

    const itemBreakdownMap: Record<string, {
      cutName: string;
      category: string;
      boxCount: Set<string>;
      pallets: Set<string>;
      totalWeight: number;
      totalPieces: number;
    }> = {};

    filteredEntries.forEach(item => {
      const weight = item.netWeight || 0;
      const pieces = item.pieces || 1;
      totalWeight += weight;
      totalPieces += pieces;

      if (item.box) boxSet.add(item.box.trim());
      if (item.archived) archivedCount++;
      else activeCount++;

      // Breakdown aggregation
      const cutKey = item.displayCutName;
      if (!itemBreakdownMap[cutKey]) {
        itemBreakdownMap[cutKey] = {
          cutName: cutKey,
          category: getCategoryDisplay(item),
          boxCount: new Set<string>(),
          pallets: new Set<string>(),
          totalWeight: 0,
          totalPieces: 0,
        };
      }

      if (item.box) itemBreakdownMap[cutKey].boxCount.add(item.box.trim());
      if (item.currentLocation || item.pallet) itemBreakdownMap[cutKey].pallets.add(item.currentLocation || item.pallet || '');
      itemBreakdownMap[cutKey].totalWeight += weight;
      itemBreakdownMap[cutKey].totalPieces += pieces;
    });

    // Breakdown list with search & sorting
    let breakdownList = Object.values(itemBreakdownMap);

    if (breakdownSearch.trim()) {
      const q = breakdownSearch.toLowerCase().trim();
      breakdownList = breakdownList.filter(b => b.cutName.toLowerCase().includes(q) || b.category.toLowerCase().includes(q));
    }

    if (breakdownCategory && breakdownCategory !== 'All') {
      breakdownList = breakdownList.filter(b => b.category === breakdownCategory);
    }

    breakdownList.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (breakdownSortField === 'name') { valA = a.cutName; valB = b.cutName; }
      else if (breakdownSortField === 'category') { valA = a.category; valB = b.category; }
      else if (breakdownSortField === 'pallet') { valA = Array.from(a.pallets).join(', '); valB = Array.from(b.pallets).join(', '); }
      else if (breakdownSortField === 'boxes') { valA = a.boxCount.size; valB = b.boxCount.size; }
      else if (breakdownSortField === 'pieces') { valA = a.totalPieces; valB = b.totalPieces; }
      else { valA = a.totalWeight; valB = b.totalWeight; }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return breakdownSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return breakdownSortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
    });

    return {
      totalBoxes: boxSet.size,
      totalWeight,
      totalPieces,
      activeCount,
      archivedCount,
      totalEntries: filteredEntries.length,
      itemBreakdown: breakdownList
    };
  }, [filteredEntries, breakdownSearch, breakdownCategory, breakdownSortField, breakdownSortAsc]);

  // Toggle Box Expansion
  const toggleBoxExpanded = (boxId: string) => {
    setExpandedBoxes(prev => ({
      ...prev,
      [boxId]: !prev[boxId]
    }));
  };

  // Expand / Collapse All Boxes
  const toggleAllBoxes = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    condensedBoxes.forEach(b => {
      next[b.boxId] = expand;
    });
    setExpandedBoxes(next);
  };

  // Toggle Sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Toggle Column Visibility
  const toggleColumn = (colKey: string) => {
    setVisibleColumns(prev => ({
      ...prev,
      [colKey]: !prev[colKey]
    }));
  };

  // CSV Export functionality
  const exportToCSV = () => {
    if (filteredEntries.length === 0) return;

    const headers = [
      'Serial', 'Cut Name', 'Original CSV Cut Name', 'Category / Sub Category', 'Pack Date', 'Lot Number', 
      'Pieces', 'Net Weight (lbs)', 'Order Number', 'Box', 'Location', 
      'Pallet/Placement', 'Notes', 'Status', 'Archived'
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = sortedFlatEntries.map(e => [
      escapeCSV(e.serial),
      escapeCSV(e.displayCutName),
      escapeCSV(e.originalCutName || e.cuts),
      escapeCSV(getCategoryDisplay(e)),
      escapeCSV(e.packDate),
      escapeCSV(e.lot),
      escapeCSV(e.pieces),
      escapeCSV(e.netWeight),
      escapeCSV(e.orderNumber),
      escapeCSV(e.box),
      escapeCSV(e.location),
      escapeCSV(e.currentLocation || e.pallet),
      escapeCSV(e.notes),
      escapeCSV(e.statusLabel),
      escapeCSV(e.archived ? 'Yes' : 'No')
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const orderTag = selectedOrderIds.size === 1 ? Array.from(selectedOrderIds)[0] : (selectedOrderIds.size > 1 ? `${selectedOrderIds.size}_orders` : 'all_orders');
    link.setAttribute('href', url);
    link.setAttribute('download', `butcher_cuts_${orderTag}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Handle Save Item Edit
  const handleSaveEdit = () => {
    if (!editingItem) return;

    dispatch({
      type: 'UPDATE_OFFSITE_ENTRY',
      payload: {
        id: editingItem.id,
        updates: editForm
      }
    });

    setEditingItem(null);
    setEditForm({});
  };

  // Handle Delete Item
  const handleDeleteItem = (id: string) => {
    dispatch({
      type: 'DELETE_OFFSITE_ENTRY',
      payload: { id }
    });
    setDeletingItemId(null);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="butcher-spreadsheet-workspace">
      
      {/* Top Header & Order Selector Toolbar */}
      <div className="bg-cool-gray-850 p-5 rounded-2xl border border-cool-gray-750 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cool-gray-750 pb-4">
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="text-cyan-400 shrink-0" size={22} />
              <h2 className="text-xl font-bold text-white tracking-tight">Butcher Cuts Repository Spreadsheet</h2>
            </div>
            <p className="text-xs text-cool-gray-400">
              Complete, un-archived and archived cut history across processing logs.
            </p>
          </div>

          {/* Butcher Order Multi-Selector Dropdown */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <label className="text-xs font-bold text-cool-gray-300 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <Filter size={14} className="text-cyan-400" />
              Focus Orders:
            </label>

            <div className="relative flex-1 sm:w-80">
              <button
                type="button"
                onClick={() => setIsOrderDropdownOpen(!isOrderDropdownOpen)}
                className="w-full bg-cool-gray-900 border border-cool-gray-700 hover:border-cyan-500/50 rounded-xl px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer shadow-inner flex items-center justify-between gap-2 text-left transition"
              >
                <span className="truncate">
                  {selectedOrdersSummary.label}
                </span>
                <div className="flex items-center gap-1.5 shrink-0 text-cool-gray-400">
                  <span className="bg-cool-gray-800 text-cyan-300 text-[11px] font-bold px-2 py-0.5 rounded-md border border-cool-gray-700">
                    {filteredEntries.length} cuts
                  </span>
                  <ChevronDown size={14} />
                </div>
              </button>

              {isOrderDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsOrderDropdownOpen(false)}></div>
                  <div className="absolute right-0 sm:left-0 top-full mt-2 bg-cool-gray-800 border border-cool-gray-650 rounded-2xl shadow-2xl p-3 z-40 w-80 max-h-96 flex flex-col space-y-2.5">
                    {/* Order Search */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 text-cool-gray-500" size={14} />
                      <input
                        type="text"
                        placeholder="Filter orders by # or species..."
                        value={orderSearchTerm}
                        onChange={(e) => setOrderSearchTerm(e.target.value)}
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-cool-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      {orderSearchTerm && (
                        <button
                          type="button"
                          onClick={() => setOrderSearchTerm('')}
                          className="absolute right-2.5 top-2 text-cool-gray-400 hover:text-white"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* Quick Order Selection Action Buttons */}
                    <div className="flex items-center justify-between gap-1 text-[11px] font-bold border-b border-cool-gray-750 pb-2 px-1">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderIds(new Set(['ALL']))}
                        className={`px-2 py-1 rounded transition cursor-pointer ${selectedOrderIds.has('ALL') ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-cool-gray-300 hover:text-white hover:bg-cool-gray-750'}`}
                      >
                        All Orders
                      </button>
                      {sortedOrders.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedOrderIds(new Set([sortedOrders[0].id]))}
                          className="px-2 py-1 text-amber-400 hover:bg-amber-950/40 rounded transition cursor-pointer"
                        >
                          ⭐ Most Recent
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedOrderIds(new Set())}
                        className="px-2 py-1 text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>

                    {/* List of Orders with Checkboxes */}
                    <div className="overflow-y-auto max-h-56 space-y-1 pr-1 divide-y divide-cool-gray-750/40">
                      <label className="flex items-center gap-2.5 p-2 hover:bg-cool-gray-750 rounded-xl cursor-pointer text-xs font-bold text-white transition">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has('ALL')}
                          onChange={() => setSelectedOrderIds(new Set(['ALL']))}
                          className="rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-4 h-4"
                        />
                        <span className="flex-1">ALL Butcher Orders ({(state.offSiteEntries || []).filter(e => e.orderId || e.orderNumber).length} total cuts)</span>
                      </label>

                      {sortedOrders
                        .filter(o => {
                          if (!orderSearchTerm) return true;
                          const q = orderSearchTerm.toLowerCase();
                          return (
                            (o.orderNumber || '').toLowerCase().includes(q) ||
                            (o.species || '').toLowerCase().includes(q) ||
                            (o.killDate || '').toLowerCase().includes(q)
                          );
                        })
                        .map((order, idx) => {
                          const cutCount = (state.offSiteEntries || []).filter(e => e.orderId === order.id || (e.orderNumber && e.orderNumber === order.orderNumber)).length;
                          const isSelected = selectedOrderIds.has(order.id) && !selectedOrderIds.has('ALL');
                          const isMostRecent = idx === 0;

                          return (
                            <label
                              key={order.id}
                              className={`flex items-center justify-between gap-2 p-2 hover:bg-cool-gray-750 rounded-xl cursor-pointer text-xs transition select-none ${isSelected ? 'bg-cyan-950/40 text-cyan-200 font-bold' : 'text-cool-gray-300'}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    const next = new Set(selectedOrderIds);
                                    next.delete('ALL');
                                    if (next.has(order.id)) {
                                      next.delete(order.id);
                                    } else {
                                      next.add(order.id);
                                    }
                                    if (next.size === 0) {
                                      next.add('ALL');
                                    }
                                    setSelectedOrderIds(next);
                                  }}
                                  className="rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-4 h-4 shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="truncate flex items-center gap-1 font-mono font-bold text-white">
                                    {isMostRecent && <span title="Most Recent Order">⭐</span>}
                                    Order #{order.orderNumber}
                                    <span className="text-cool-gray-400 font-sans font-normal">({order.species || 'Butcher'})</span>
                                  </div>
                                  {order.killDate && <div className="text-[10px] text-cool-gray-400">Kill Date: {order.killDate}</div>}
                                </div>
                              </div>
                              <span className="text-[10px] bg-cool-gray-900 border border-cool-gray-700 px-1.5 py-0.5 rounded text-cyan-300 font-mono font-bold shrink-0">
                                {cutCount} cuts
                              </span>
                            </label>
                          );
                        })}
                    </div>

                    <div className="pt-2 border-t border-cool-gray-750 flex justify-between items-center text-xs">
                      <span className="text-cool-gray-400 text-[11px]">
                        {selectedOrderIds.has('ALL') ? 'All orders' : `${selectedOrderIds.size} selected`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsOrderDropdownOpen(false)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs px-3 py-1 rounded-lg transition cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search, Name View Toggle, and View Mode Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          
          {/* Global Search Input */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cool-gray-400" />
            <input
              type="text"
              placeholder="Search cuts, serials, lots, boxes, pallets, locations, or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-cool-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cool-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode Toggle (Grouped by Box vs Flat View) */}
            <div className="flex bg-cool-gray-900 p-1 rounded-xl border border-cool-gray-750 shrink-0">
              <button
                type="button"
                onClick={() => setViewGroupedByBox(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewGroupedByBox ? 'bg-cyan-600 text-white shadow-sm' : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                <Box size={14} />
                Grouped by Box
              </button>
              <button
                type="button"
                onClick={() => setViewGroupedByBox(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  !viewGroupedByBox ? 'bg-cyan-600 text-white shadow-sm' : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                <List size={14} />
                Flat List
              </button>
            </div>

            {/* Raw CSV Cut Names Toggle */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-cool-gray-300 hover:text-white transition shrink-0 bg-cool-gray-900 px-3 py-2 rounded-xl border border-cool-gray-750">
              <input
                type="checkbox"
                checked={viewOriginalNames}
                onChange={(e) => setViewOriginalNames(e.target.checked)}
                className="rounded bg-cool-gray-950 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-4 h-4"
              />
              RAW CSV CUT NAMES
            </label>

            {/* Category Filter Dropdown */}
            {categoryOptions.primaryOptions.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsCategoryFilterOpen(!isCategoryFilterOpen)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition ${
                    selectedPrimary.length > 0 || selectedSub.length > 0
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                      : 'bg-cool-gray-900 text-cool-gray-300 border-cool-gray-750 hover:text-white'
                  }`}
                >
                  <Layers size={14} />
                  Categories {selectedPrimary.length > 0 ? `(${selectedPrimary.length})` : ''}
                  <ChevronDown size={14} />
                </button>

                {isCategoryFilterOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsCategoryFilterOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 bg-cool-gray-800 border border-cool-gray-650 rounded-xl shadow-2xl p-4 z-40 w-72 max-h-80 overflow-y-auto space-y-3">
                      <div className="flex justify-between items-center border-b border-cool-gray-700 pb-2">
                        <span className="text-xs font-bold text-white uppercase">Filter Categories</span>
                        {(selectedPrimary.length > 0 || selectedSub.length > 0) && (
                          <button
                            type="button"
                            onClick={() => { setSelectedPrimary([]); setSelectedSub([]); }}
                            className="text-[10px] text-cyan-400 hover:underline font-bold"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {categoryOptions.primaryOptions.map(p => (
                          <div key={p}>
                            <label className="flex items-center gap-2 cursor-pointer text-xs text-white font-bold p-1 hover:bg-cool-gray-750 rounded">
                              <input
                                type="checkbox"
                                checked={selectedPrimary.includes(p)}
                                onChange={() => {
                                  if (selectedPrimary.includes(p)) {
                                    setSelectedPrimary(selectedPrimary.filter(x => x !== p));
                                  } else {
                                    setSelectedPrimary([...selectedPrimary, p]);
                                  }
                                }}
                                className="rounded bg-cool-gray-950 border-cool-gray-650 text-cyan-500 focus:ring-cyan-500"
                              />
                              {p}
                            </label>
                            {(categoryOptions.subOptions[p] || []).map(s => (
                              <label key={s} className="flex items-center gap-2 cursor-pointer text-xs text-cool-gray-300 pl-6 py-0.5 hover:bg-cool-gray-750 rounded">
                                <input
                                  type="checkbox"
                                  checked={selectedSub.includes(s)}
                                  onChange={() => {
                                    if (selectedSub.includes(s)) {
                                      setSelectedSub(selectedSub.filter(x => x !== s));
                                    } else {
                                      setSelectedSub([...selectedSub, s]);
                                    }
                                  }}
                                  className="rounded bg-cool-gray-950 border-cool-gray-650 text-cyan-500 focus:ring-cyan-500"
                                />
                                {s}
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Columns Customizer Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
                className="px-3 py-2 rounded-xl bg-cool-gray-900 border border-cool-gray-750 text-xs font-bold text-cool-gray-300 hover:text-white flex items-center gap-2 cursor-pointer transition"
              >
                <Eye size={14} />
                Columns
                <ChevronDown size={14} />
              </button>

              {isColumnPickerOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsColumnPickerOpen(false)}></div>
                  <div className="absolute right-0 top-full mt-2 bg-cool-gray-800 border border-cool-gray-650 rounded-xl shadow-2xl p-3 z-40 w-56 space-y-2">
                    <div className="text-xs font-bold text-white uppercase border-b border-cool-gray-700 pb-1.5">
                      Visible Columns
                    </div>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {[
                        { key: 'box', label: 'Box ID' },
                        { key: 'cutName', label: 'Cut / Product Name' },
                        { key: 'category', label: 'Category / Sub Category' },
                        { key: 'weight', label: 'Net Weight (lbs)' },
                        { key: 'pieces', label: '# Pieces' },
                        { key: 'location', label: 'Location' },
                        { key: 'pallet', label: 'Pallet / Placement' },
                        { key: 'serial', label: 'Serial Number' },
                        { key: 'lotNumber', label: 'Lot Number' },
                        { key: 'packDate', label: 'Pack Date' },
                        { key: 'notes', label: 'Notes' },
                        { key: 'tags', label: 'Persistent Tags' },
                        { key: 'status', label: 'Availability Status' },
                        { key: 'archived', label: 'Archived' },
                      ].map(col => (
                        <label key={col.key} className="flex items-center justify-between text-xs text-cool-gray-200 hover:bg-cool-gray-700 p-1 rounded cursor-pointer">
                          <span>{col.label}</span>
                          <input
                            type="checkbox"
                            checked={!!visibleColumns[col.key]}
                            onChange={() => toggleColumn(col.key)}
                            className="rounded bg-cool-gray-950 border-cool-gray-650 text-cyan-500 focus:ring-cyan-500"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Reset Active Column Filters Button */}
            {hasActiveColumnFilters && (
              <button
                type="button"
                onClick={clearAllColumnFilters}
                className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-xs font-bold text-rose-300 flex items-center gap-1.5 cursor-pointer transition shrink-0"
                title="Clear all column header filters"
              >
                <X size={14} />
                Clear Column Filters
              </button>
            )}

            {/* Export CSV Button */}
            <button
              type="button"
              onClick={exportToCSV}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 transition shadow-sm cursor-pointer shrink-0"
            >
              <Download size={14} />
              Export CSV ({spreadsheetSummary.totalEntries})
            </button>

          </div>
        </div>
      </div>

      {/* Spreadsheet Summary Dashboard Cards (Div #2 - Live Updating based on filters!) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-cool-gray-800/40 p-5 rounded-2xl border border-cool-gray-750">
        
        {/* Card 1: Spreadsheet Total Boxes */}
        <div className="bg-cool-gray-900/60 p-4 rounded-xl border border-cool-gray-800 flex flex-col justify-between shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Spreadsheet Total Boxes</span>
            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-extrabold text-cool-gray-400 hover:text-cyan-400 transition-colors uppercase tracking-wider select-none">
              <input
                type="checkbox"
                className="rounded bg-cool-gray-950 border-cool-gray-750 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-3.5 h-3.5 shrink-0"
                checked={simulateBoxCount}
                onChange={(e) => {
                  setSimulateBoxCount(e.target.checked);
                  localStorage.setItem("offsite-simulate-box-count", e.target.checked ? "true" : "false");
                }}
              />
              Simulate ({theoreticalBoxWeight} lbs)
            </label>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white">
              {simulateBoxCount 
                ? `~${(spreadsheetSummary.totalWeight / theoreticalBoxWeight).toFixed(1)}` 
                : spreadsheetSummary.totalBoxes}
            </span>
            <span className="text-xs text-cool-gray-400 font-medium">
              {simulateBoxCount ? `est. boxes (${theoreticalBoxWeight} lbs each)` : "boxes matching filters"}
            </span>
          </div>
        </div>

        {/* Card 2: Spreadsheet Total Weight */}
        <div className="bg-cool-gray-900/60 p-4 rounded-xl border border-cool-gray-800 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Spreadsheet Total Weight</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-400">{spreadsheetSummary.totalWeight.toFixed(1)}</span>
            <span className="text-xs text-cool-gray-400 font-medium">lbs ({spreadsheetSummary.activeCount} active, {spreadsheetSummary.archivedCount} moved)</span>
          </div>
        </div>

        {/* Card 3: Spreadsheet Total Pieces */}
        <div className="bg-cool-gray-900/60 p-4 rounded-xl border border-cool-gray-800 flex flex-col justify-between shadow-xs">
          <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Spreadsheet Total Pieces</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-blue-400">{spreadsheetSummary.totalPieces.toLocaleString()}</span>
            <span className="text-xs text-cool-gray-400 font-medium">pcs across {spreadsheetSummary.totalEntries} cut records</span>
          </div>
        </div>
      </div>

      {/* Spreadsheet Itemized Inventory Breakdown Dashboard (Div #3 - Collapsible!) */}
      <div className="bg-cool-gray-800/25 border border-cool-gray-750/70 rounded-2xl p-4 space-y-3 shadow-md">
        <div 
          className="flex justify-between items-center cursor-pointer select-none" 
          onClick={() => setShowItemBreakdown(!showItemBreakdown)}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 text-base">📊</span>
            <div>
              <h4 className="font-bold text-white text-sm">Spreadsheet Itemized Inventory Breakdown</h4>
              <p className="text-xs text-cool-gray-400 font-medium">Click to collapse/expand breakdown of the filtered spreadsheet list by cut</p>
            </div>
          </div>
          <button 
            type="button"
            className="text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition font-bold flex items-center gap-1 shadow-sm cursor-pointer"
          >
            {showItemBreakdown ? 'Hide Item Breakdown' : 'Show Item Breakdown'}
          </button>
        </div>

        {showItemBreakdown && (
          <div className="space-y-3 pt-2 animate-fade-in">
            {/* Search & Category Filter Bar inside Breakdown */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-cool-gray-900/80 p-3 rounded-xl border border-cool-gray-750">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-cool-gray-400" />
                <input
                  type="text"
                  placeholder="Filter breakdown cuts or categories..."
                  value={breakdownSearch}
                  onChange={(e) => setBreakdownSearch(e.target.value)}
                  className="w-full bg-cool-gray-850 border border-cool-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-cool-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-cool-gray-400">Category:</label>
                <select
                  value={breakdownCategory}
                  onChange={(e) => setBreakdownCategory(e.target.value)}
                  className="bg-cool-gray-850 border border-cool-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categoryOptions.primaryOptions.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap border-t border-cool-gray-750/60">
                <thead>
                  <tr className="text-cool-gray-400 font-bold border-b border-cool-gray-750/60 bg-cool-gray-850/35 select-none">
                    <th 
                      className="py-2.5 px-3 cursor-pointer hover:text-white transition group"
                      onClick={() => { setBreakdownSortField('name'); setBreakdownSortAsc(!breakdownSortAsc); }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Item / Cut Name</span>
                        <span className="text-cool-gray-500 text-[10px]">
                          {breakdownSortField === 'name' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="py-2.5 px-3 cursor-pointer hover:text-white transition group"
                      onClick={() => { setBreakdownSortField('category'); setBreakdownSortAsc(!breakdownSortAsc); }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Category / Sub Category</span>
                        <span className="text-cool-gray-500 text-[10px]">
                          {breakdownSortField === 'category' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="py-2.5 px-3 cursor-pointer hover:text-white transition group"
                      onClick={() => { setBreakdownSortField('pallet'); setBreakdownSortAsc(!breakdownSortAsc); }}
                    >
                      <div className="flex items-center gap-1">
                        <span>Pallets / Placements</span>
                        <span className="text-cool-gray-500 text-[10px]">
                          {breakdownSortField === 'pallet' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-white transition group"
                      onClick={() => { setBreakdownSortField('boxes'); setBreakdownSortAsc(!breakdownSortAsc); }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <span>Boxes Count</span>
                        <span className="text-cool-gray-500 text-[10px]">
                          {breakdownSortField === 'boxes' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-white transition group"
                      onClick={() => { setBreakdownSortField('weight'); setBreakdownSortAsc(!breakdownSortAsc); }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <span>Total Net Weight</span>
                        <span className="text-cool-gray-500 text-[10px]">
                          {breakdownSortField === 'weight' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="py-2.5 px-3 text-right cursor-pointer hover:text-white transition group"
                      onClick={() => { setBreakdownSortField('pieces'); setBreakdownSortAsc(!breakdownSortAsc); }}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <span>Total Pieces</span>
                        <span className="text-cool-gray-500 text-[10px]">
                          {breakdownSortField === 'pieces' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cool-gray-750/40 text-cool-gray-300">
                  {spreadsheetSummary.itemBreakdown.map((item, idx) => (
                    <tr key={`${item.cutName}-${idx}`} className="hover:bg-cool-gray-800/40 transition">
                      <td className="py-2.5 px-3 font-semibold text-cyan-300">
                        {item.cutName}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-900/30">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {Array.from(item.pallets).length > 0 ? (
                            Array.from(item.pallets).filter(Boolean).sort().map((p, i) => (
                              <span key={i} className="bg-cool-gray-800 text-cool-gray-300 px-1.5 py-0.5 rounded text-[10px] border border-cool-gray-750 font-medium">
                                📍 {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-cool-gray-500 italic text-[11px]">-</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-cool-gray-100">{item.boxCount.size}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">{item.totalWeight.toFixed(1)} lbs</td>
                      <td className="py-2.5 px-3 text-right font-mono text-blue-400">{item.totalPieces} pcs</td>
                    </tr>
                  ))}
                  {spreadsheetSummary.itemBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-cool-gray-500 italic font-medium">
                        No matching cuts found in breakdown
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Main Cuts View (Box Cards vs Flat List) */}
      <div className="space-y-4">
        
        {/* Bulk Box Expand Controls if Grouped */}
        {viewGroupedByBox && condensedBoxes.length > 0 && (
          <div className="flex items-center justify-between bg-cool-gray-850 px-4 py-2.5 rounded-xl border border-cool-gray-750">
            <div className="flex items-center gap-2 text-xs text-cool-gray-300 font-bold">
              <span>Boxes View ({condensedBoxes.length} groups)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleAllBoxes(true)}
                className="px-2.5 py-1 bg-cool-gray-800 hover:bg-cool-gray-750 text-cyan-300 text-xs font-bold rounded-lg border border-cool-gray-700 transition cursor-pointer"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={() => toggleAllBoxes(false)}
                className="px-2.5 py-1 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-bold rounded-lg border border-cool-gray-700 transition cursor-pointer"
              >
                Collapse All
              </button>
            </div>
          </div>
        )}

        {/* Main Spreadsheet Table - Supports Grouped by Box Mode and Flat List Mode with Full Column Parity */}
        <div className="bg-cool-gray-850 rounded-2xl border border-cool-gray-750 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-cool-gray-900/90 text-cool-gray-300 border-b border-cool-gray-750 font-bold uppercase tracking-wider text-[11px] select-none">
                  <th className="py-3 px-3 w-10 text-center"></th>
                  {visibleColumns.box && (
                    <th className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span onClick={() => handleSort('box')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Box ID
                          {sortField === 'box' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'box' ? null : 'box'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterBoxes.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Box ID"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'box' && renderFilterDropdown('box', allBoxes, filterBoxes, setFilterBoxes, boxesSearch, setBoxesSearch)}
                    </th>
                  )}
                  {visibleColumns.cutName && (
                    <th className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span onClick={() => handleSort('cutName')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Cut / Product Name
                          {sortField === 'cutName' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'cutName' ? null : 'cutName'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterCuts.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Cut Name"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'cutName' && renderFilterDropdown('cutName', allCuts, filterCuts, setFilterCuts, cutsSearch, setCutsSearch)}
                    </th>
                  )}
                  {visibleColumns.category && (
                    <th className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span onClick={() => handleSort('category')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Category / Sub Category
                          {sortField === 'category' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'category' ? null : 'category'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterPrimaryCategories.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Category / Sub Category"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'category' && renderFilterDropdown('category', allPrimaryCategories, filterPrimaryCategories, setFilterPrimaryCategories, categoriesSearch, setCategoriesSearch)}
                    </th>
                  )}
                  {visibleColumns.weight && (
                    <th onClick={() => handleSort('weight')} className="py-3 px-3 text-right cursor-pointer hover:text-white transition whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        Net Wt (lbs)
                        {sortField === 'weight' && <ArrowUpDown size={12} className="text-cyan-400" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.pieces && (
                    <th onClick={() => handleSort('pieces')} className="py-3 px-3 text-right cursor-pointer hover:text-white transition whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        Pieces
                        {sortField === 'pieces' && <ArrowUpDown size={12} className="text-cyan-400" />}
                      </div>
                    </th>
                  )}
                  {visibleColumns.location && (
                    <th className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span onClick={() => handleSort('location')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Location
                          {sortField === 'location' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'location' ? null : 'location'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterLocations.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Location"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'location' && renderFilterDropdown('location', allLocations, filterLocations, setFilterLocations, locationsSearch, setLocationsSearch)}
                    </th>
                  )}
                  {visibleColumns.pallet && (
                    <th className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span onClick={() => handleSort('pallet')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Pallet / Placement
                          {sortField === 'pallet' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'pallet' ? null : 'pallet'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterPallets.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Pallet"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'pallet' && renderFilterDropdown('pallet', allPallets, filterPallets, setFilterPallets, palletsSearch, setPalletsSearch)}
                    </th>
                  )}
                  {visibleColumns.serial && (
                    <th className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span onClick={() => handleSort('serial')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Serial
                          {sortField === 'serial' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'serial' ? null : 'serial'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterSerials.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Serial"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'serial' && renderFilterDropdown('serial', allSerials, filterSerials, setFilterSerials, serialsSearch, setSerialsSearch)}
                    </th>
                  )}
                  {visibleColumns.lotNumber && (
                    <th className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span onClick={() => handleSort('lotNumber')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Lot #
                          {sortField === 'lotNumber' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'lotNumber' ? null : 'lotNumber'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterLots.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Lot Number"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'lotNumber' && renderFilterDropdown('lotNumber', allLots, filterLots, setFilterLots, lotsSearch, setLotsSearch)}
                    </th>
                  )}
                  {visibleColumns.packDate && (
                    <th className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-1">
                        <span onClick={() => handleSort('packDate')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Pack Date
                          {sortField === 'packDate' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'packDate' ? null : 'packDate'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterPackDates.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Pack Date"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'packDate' && renderFilterDropdown('packDate', allPackDates, filterPackDates, setFilterPackDates, packDatesSearch, setPackDatesSearch)}
                    </th>
                  )}
                  {visibleColumns.notes && <th className="py-3 px-3 whitespace-nowrap">Notes</th>}
                  {visibleColumns.tags && <th className="py-3 px-3 text-center whitespace-nowrap">Tags</th>}
                  {visibleColumns.status && (
                    <th className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span onClick={() => handleSort('status')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Status
                          {sortField === 'status' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'status' ? null : 'status'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterStatuses.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Status"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'status' && renderFilterDropdown('status', allStatuses, filterStatuses, setFilterStatuses, statusesSearch, setStatusesSearch)}
                    </th>
                  )}
                  {visibleColumns.archived && (
                    <th className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <span onClick={() => handleSort('archived')} className="cursor-pointer hover:text-white flex items-center gap-1">
                          Archived
                          {sortField === 'archived' && <ArrowUpDown size={12} className="text-cyan-400" />}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'archived' ? null : 'archived'); }}
                          className={`p-1 rounded hover:bg-cool-gray-750 transition cursor-pointer ${filterArchived.size > 0 ? 'text-cyan-400 bg-cyan-950/60 border border-cyan-500/30' : 'text-cool-gray-500 hover:text-cool-gray-300'}`}
                          title="Filter by Archived Status"
                        >
                          <Filter size={12} />
                        </button>
                      </div>
                      {openFilter === 'archived' && renderFilterDropdown('archived', allArchived, filterArchived, setFilterArchived, archivedSearch, setArchivedSearch)}
                    </th>
                  )}
                  <th className="py-3 px-3 text-center whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cool-gray-750/60 font-medium">
                {viewGroupedByBox ? (
                  condensedBoxes.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-12 text-center text-cool-gray-400">
                        <FileSpreadsheet size={36} className="mx-auto text-cool-gray-600 mb-2" />
                        <p className="text-sm font-bold text-cool-gray-300">No box records found matching criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    condensedBoxes.map((group) => {
                      const isExpanded = expandedBoxes[group.boxId] ?? false;

                      return (
                        <React.Fragment key={group.boxId}>
                          {/* Box Group Header Row */}
                          <tr className="bg-cool-gray-900/90 hover:bg-cool-gray-800 transition font-bold border-b border-cool-gray-750 select-none">
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => toggleBoxExpanded(group.boxId)}
                                className="p-1 rounded text-cool-gray-400 hover:text-white transition cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </button>
                            </td>

                            {visibleColumns.box && (
                              <td className="py-3 px-3 font-mono text-cyan-300 font-extrabold text-sm whitespace-nowrap">
                                {group.boxId}
                              </td>
                            )}

                            {visibleColumns.cutName && (
                              <td className="py-3 px-3">
                                <div className="space-y-0.5 max-w-sm">
                                  {Object.entries(group.cutsSummary || {}).map(([cutName, stats]: [string, any]) => (
                                    <div key={cutName} className="text-xs font-bold text-white truncate flex items-center justify-between gap-2">
                                      <span className="truncate">{cutName}</span>
                                      {Object.keys(group.cutsSummary || {}).length > 1 && (
                                        <span className="text-[10px] text-cyan-300 font-mono font-normal shrink-0">
                                          ({(stats?.weight || 0).toFixed(1)} lbs)
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            )}

                            {visibleColumns.category && (
                              <td className="py-3 px-3 text-cool-gray-300 text-xs font-medium max-w-xs truncate">
                                {Array.from(group.categories || []).join(', ') || '-'}
                              </td>
                            )}

                            {visibleColumns.weight && (
                              <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400 text-sm whitespace-nowrap">
                                {(group.totalWeight || 0).toFixed(1)} <span className="text-[10px] text-cool-gray-400 font-sans font-normal">lbs</span>
                              </td>
                            )}

                            {visibleColumns.pieces && (
                              <td className="py-3 px-3 text-right font-mono font-bold text-blue-300 whitespace-nowrap">
                                {group.totalPieces || 0} <span className="text-[10px] text-cool-gray-400 font-sans font-normal">pcs</span>
                              </td>
                            )}

                            {visibleColumns.location && (
                              <td className="py-3 px-3 text-cool-gray-300 text-xs whitespace-nowrap">
                                {group.location !== 'N/A' ? group.location : '-'}
                              </td>
                            )}

                            {visibleColumns.pallet && (
                              <td className="py-3 px-3 text-cyan-300 font-bold text-xs whitespace-nowrap">
                                {group.pallet !== 'N/A' ? `📍 ${group.pallet}` : '-'}
                              </td>
                            )}

                            {visibleColumns.serial && (
                              <td className="py-3 px-3 font-mono text-cool-gray-300 text-xs whitespace-nowrap">
                                {(group.items || []).length} {(group.items || []).length === 1 ? 'cut' : 'cuts'}
                              </td>
                            )}

                            {visibleColumns.lotNumber && (
                              <td className="py-3 px-3 font-mono text-cool-gray-300 text-xs whitespace-nowrap truncate max-w-[120px]">
                                {Array.from(group.lots || []).join(', ') || '-'}
                              </td>
                            )}

                            {visibleColumns.packDate && (
                              <td className="py-3 px-3 font-mono text-cool-gray-300 text-xs whitespace-nowrap truncate max-w-[120px]">
                                {Array.from(group.packDates || []).join(', ') || '-'}
                              </td>
                            )}

                            {visibleColumns.notes && (
                              <td className="py-3 px-3 text-cool-gray-400 max-w-xs truncate text-xs">
                                {group.items.find((it) => it.notes)?.notes || '-'}
                              </td>
                            )}

                            {visibleColumns.tags && (
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <span className="text-cool-gray-400 text-xs font-semibold">
                                  {Array.from(new Set(group.items.flatMap((it) => it.tagIds || []))).length} tags
                                </span>
                              </td>
                            )}

                            {visibleColumns.status && (
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1">
                                  {group.activeCount > 0 && (
                                    <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                      {group.activeCount} Active
                                    </span>
                                  )}
                                  {group.archivedCount > 0 && (
                                    <span className="bg-cool-gray-800 text-cool-gray-400 border border-cool-gray-700 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                      {group.archivedCount} Moved
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}

                            {visibleColumns.archived && (
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                {group.archivedCount === group.items.length ? (
                                  <span className="bg-amber-950/80 text-amber-400 border border-amber-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                    Yes (All)
                                  </span>
                                ) : group.archivedCount > 0 ? (
                                  <span className="bg-amber-950/40 text-amber-300 border border-amber-800/40 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                    {group.archivedCount}/{group.items.length} Archived
                                  </span>
                                ) : (
                                  <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                    No
                                  </span>
                                )}
                              </td>
                            )}

                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => toggleBoxExpanded(group.boxId)}
                                className="px-2.5 py-1 bg-cool-gray-800 hover:bg-cool-gray-700 text-cyan-300 hover:text-white text-xs font-bold rounded-lg border border-cool-gray-700 transition cursor-pointer"
                              >
                                {isExpanded ? 'Hide Items' : `View (${group.items.length})`}
                              </button>
                            </td>
                          </tr>

                          {/* Child Items in Expanded Box */}
                          {isExpanded &&
                            [...group.items].sort((itemA, itemB) => {
                              let valA: any = '';
                              let valB: any = '';

                              switch (sortField) {
                                case 'serial': valA = itemA.serial || ''; valB = itemB.serial || ''; break;
                                case 'cutName': valA = itemA.displayCutName || ''; valB = itemB.displayCutName || ''; break;
                                case 'packDate': valA = itemA.packDate || ''; valB = itemB.packDate || ''; break;
                                case 'lotNumber': valA = itemA.lot || ''; valB = itemB.lot || ''; break;
                                case 'pieces': valA = itemA.pieces || 0; valB = itemB.pieces || 0; break;
                                case 'weight': valA = itemA.netWeight || 0; valB = itemB.netWeight || 0; break;
                                case 'orderNumber': valA = itemA.orderNumber || ''; valB = itemB.orderNumber || ''; break;
                                case 'box': valA = itemA.box || ''; valB = itemB.box || ''; break;
                                case 'location': valA = itemA.location || ''; valB = itemB.location || ''; break;
                                case 'pallet': valA = itemA.currentLocation || itemA.pallet || ''; valB = itemB.currentLocation || itemB.pallet || ''; break;
                                case 'status': valA = itemA.archived ? 1 : 0; valB = itemB.archived ? 1 : 0; break;
                                case 'archived': valA = itemA.archived ? 1 : 0; valB = itemB.archived ? 1 : 0; break;
                                default: valA = itemA.displayCutName || ''; valB = itemB.displayCutName || '';
                              }

                              if (typeof valA === 'number' && typeof valB === 'number') {
                                return sortDirection === 'asc' ? valA - valB : valB - valA;
                              }

                              const strA = String(valA).toLowerCase();
                              const strB = String(valB).toLowerCase();
                              if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
                              if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
                              return 0;
                            }).map((item) => {
                              const tagIds = item.tagIds || [];

                              return (
                                <tr
                                  key={item.id}
                                  className={`hover:bg-cool-gray-800/80 transition-colors ${
                                    item.archived ? 'opacity-70 bg-cool-gray-950/40' : 'bg-cool-gray-950/20'
                                  }`}
                                >
                                  <td className="py-2 px-3 text-center text-cool-gray-600 font-mono text-xs">
                                    ↳
                                  </td>

                                  {visibleColumns.box && (
                                    <td className="py-2 px-3 font-mono text-cool-gray-400 text-xs whitespace-nowrap">
                                      {item.box || group.boxId}
                                    </td>
                                  )}

                                  {visibleColumns.cutName && (
                                    <td className="py-2 px-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-bold text-white text-xs">
                                          {item.displayCutName}
                                        </span>
                                        {item.matchedProduct ? (
                                          <span className="text-[9px] text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-1 py-0.5 rounded font-bold shrink-0">
                                            Catalog
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-yellow-400 bg-yellow-950/60 border border-yellow-800/60 px-1 py-0.5 rounded font-bold shrink-0">
                                            Raw
                                          </span>
                                        )}
                                        {!viewOriginalNames && item.isManuallyCorrected && (!item.matchedProduct || item.originalCutName !== item.matchedProduct.name) && (
                                          <span className="text-[10px] text-red-400 font-semibold px-1.5 py-0.5 bg-red-950/30 border border-red-900/30 rounded shrink-0 max-w-[150px] truncate" title={`Originally Labeled As: ${item.originalCutName}`}>
                                            ⚠️ Labeled: {item.originalCutName}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  )}

                                  {visibleColumns.category && (
                                    <td className="py-2 px-3 text-cool-gray-400 text-xs truncate max-w-[150px]">
                                      {getCategoryDisplay(item)}
                                    </td>
                                  )}

                                  {visibleColumns.weight && (
                                    <td className="py-2 px-3 text-right font-mono font-extrabold text-cyan-200 text-xs whitespace-nowrap">
                                      {(item.netWeight || 0).toFixed(1)} <span className="text-[10px] text-cool-gray-400 font-sans font-normal">lbs</span>
                                    </td>
                                  )}

                                  {visibleColumns.pieces && (
                                    <td className="py-2 px-3 text-right font-mono font-bold text-cool-gray-200 text-xs whitespace-nowrap">
                                      {item.pieces || 1}
                                    </td>
                                  )}

                                  {visibleColumns.location && (
                                    <td className="py-2 px-3 text-cool-gray-300 text-xs whitespace-nowrap">
                                      {item.location || '-'}
                                    </td>
                                  )}

                                  {visibleColumns.pallet && (
                                    <td className="py-2 px-3 text-cyan-300 font-bold text-xs whitespace-nowrap">
                                      {item.currentLocation || item.pallet ? `📍 ${item.currentLocation || item.pallet}` : '-'}
                                    </td>
                                  )}

                                  {visibleColumns.serial && (
                                    <td className="py-2 px-3 font-mono text-cyan-300 font-bold text-xs whitespace-nowrap">
                                      {item.serial || 'N/A'}
                                    </td>
                                  )}

                                  {visibleColumns.lotNumber && (
                                    <td className="py-2 px-3 font-mono text-cool-gray-300 text-xs whitespace-nowrap">
                                      {item.lot || '-'}
                                    </td>
                                  )}

                                  {visibleColumns.packDate && (
                                    <td className="py-2 px-3 font-mono text-cool-gray-300 text-xs whitespace-nowrap">
                                      {item.packDate || '-'}
                                    </td>
                                  )}

                                  {visibleColumns.notes && (
                                    <td className="py-2 px-3 text-cool-gray-400 max-w-xs truncate text-xs" title={item.notes || ''}>
                                      {item.notes || '-'}
                                    </td>
                                  )}

                                  {visibleColumns.tags && (
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      <div className="relative inline-block">
                                        <button
                                          type="button"
                                          onClick={() => setOpenTagSelectorId(openTagSelectorId === item.id ? null : item.id)}
                                          className={`p-1 rounded-lg border transition flex items-center justify-center cursor-pointer ${
                                            tagIds.length > 0
                                              ? 'bg-cyan-950 text-cyan-400 border-cyan-800'
                                              : 'border-cool-gray-700 hover:border-cool-gray-500 text-cool-gray-400 hover:text-white'
                                          }`}
                                          title="Manage Tags"
                                        >
                                          <TagIcon size={12} />
                                          {tagIds.length > 0 && <span className="ml-1 text-[10px] font-bold">{tagIds.length}</span>}
                                        </button>

                                        {openTagSelectorId === item.id && (
                                          <ButcherTagPopover
                                            item={item}
                                            tagIds={tagIds}
                                            tags={state.tags || []}
                                            dispatch={dispatch}
                                            onClose={() => setOpenTagSelectorId(null)}
                                          />
                                        )}
                                      </div>
                                    </td>
                                  )}

                                  {visibleColumns.status && (
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      {item.archived ? (
                                        <span className="bg-cool-gray-800 text-cool-gray-400 border border-cool-gray-700 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                          Moved / Depleted
                                        </span>
                                      ) : (
                                        <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                          Active Off-Site
                                        </span>
                                      )}
                                    </td>
                                  )}

                                  {visibleColumns.archived && (
                                    <td className="py-2 px-3 text-center whitespace-nowrap">
                                      {item.archived ? (
                                        <span className="bg-amber-950/80 text-amber-400 border border-amber-800/60 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                          Yes
                                        </span>
                                      ) : (
                                        <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-md font-bold text-[10px] uppercase">
                                          No
                                        </span>
                                      )}
                                    </td>
                                  )}

                                  <td className="py-2 px-3 text-center whitespace-nowrap">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingItem(item);
                                          setEditForm({
                                            serial: item.serial,
                                            originalCutName: item.originalCutName || item.cuts,
                                            cuts: item.cuts,
                                            packDate: item.packDate,
                                            lot: item.lot,
                                            pieces: item.pieces,
                                            netWeight: item.netWeight,
                                            box: item.box,
                                            location: item.location,
                                            currentLocation: item.currentLocation,
                                            notes: item.notes
                                          });
                                        }}
                                        className="p-1 text-cool-gray-400 hover:text-cyan-400 hover:bg-cool-gray-750 rounded transition cursor-pointer"
                                        title="Edit Record"
                                      >
                                        <Edit3 size={13} />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => setDeletingItemId(item.id)}
                                        className="p-1 text-cool-gray-400 hover:text-red-400 hover:bg-cool-gray-750 rounded transition cursor-pointer"
                                        title="Delete Cut Record"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })
                  )
                ) : (
                  sortedFlatEntries.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="py-12 text-center text-cool-gray-400">
                        <p className="text-sm font-bold text-cool-gray-300">No butcher cuts found matching criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    sortedFlatEntries.map((item) => {
                      const tagIds = item.tagIds || [];

                      return (
                        <tr 
                          key={item.id}
                          className={`hover:bg-cool-gray-800/80 transition-colors ${
                            item.archived ? 'opacity-75 bg-cool-gray-900/40' : 'bg-cool-gray-850'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center text-cool-gray-600 font-mono text-xs">•</td>
                          {visibleColumns.box && <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-cyan-300">{item.box || '-'}</td>}
                          {visibleColumns.cutName && (
                            <td className="py-2.5 px-3 font-bold text-white text-sm">
                              <div className="flex flex-wrap items-center gap-2">
                                <span>{item.displayCutName}</span>
                                {!viewOriginalNames && item.isManuallyCorrected && (!item.matchedProduct || item.originalCutName !== item.matchedProduct.name) && (
                                  <span className="text-[10px] text-red-400 font-semibold px-1.5 py-0.5 bg-red-950/30 border border-red-900/30 rounded shrink-0 max-w-[150px] truncate" title={`Originally Labeled As: ${item.originalCutName}`}>
                                    ⚠️ Labeled: {item.originalCutName}
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                          {visibleColumns.category && <td className="py-2.5 px-3 text-cool-gray-300 text-xs">{getCategoryDisplay(item)}</td>}
                          {visibleColumns.weight && <td className="py-2.5 px-3 text-right font-mono font-extrabold text-cyan-200 text-sm whitespace-nowrap">{(item.netWeight || 0).toFixed(1)} lbs</td>}
                          {visibleColumns.pieces && <td className="py-2.5 px-3 text-right font-mono font-bold text-cool-gray-200">{item.pieces || 1}</td>}
                          {visibleColumns.location && <td className="py-2.5 px-3 text-cool-gray-300">{item.location || '-'}</td>}
                          {visibleColumns.pallet && <td className="py-2.5 px-3 text-cyan-300 font-bold">📍 {item.currentLocation || item.pallet || '-'}</td>}
                          {visibleColumns.serial && <td className="py-2.5 px-3 font-mono text-cyan-300 font-bold whitespace-nowrap">{item.serial || 'N/A'}</td>}
                          {visibleColumns.lotNumber && <td className="py-2.5 px-3 whitespace-nowrap text-cool-gray-300 font-mono">{item.lot || '-'}</td>}
                          {visibleColumns.packDate && <td className="py-2.5 px-3 whitespace-nowrap text-cool-gray-300 font-mono">{item.packDate || '-'}</td>}
                          {visibleColumns.notes && <td className="py-2.5 px-3 text-cool-gray-400 max-w-xs truncate">{item.notes || '-'}</td>}
                          {visibleColumns.tags && (
                            <td className="py-2.5 px-3 text-center">
                              <span className="text-cool-gray-400">{tagIds.length} tags</span>
                            </td>
                          )}
                          {visibleColumns.status && (
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.archived ? 'bg-cool-gray-800 text-cool-gray-400' : 'bg-emerald-950 text-emerald-400'}`}>
                                {item.archived ? 'Moved' : 'Active'}
                              </span>
                            </td>
                          )}
                          {visibleColumns.archived && (
                            <td className="py-2.5 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.archived ? 'bg-amber-950 text-amber-400 border border-amber-800/60' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'}`}>
                                {item.archived ? 'Yes' : 'No'}
                              </span>
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setEditForm({
                                    serial: item.serial,
                                    originalCutName: item.originalCutName || item.cuts,
                                    cuts: item.cuts,
                                    packDate: item.packDate,
                                    lot: item.lot,
                                    pieces: item.pieces,
                                    netWeight: item.netWeight,
                                    box: item.box,
                                    location: item.location,
                                    currentLocation: item.currentLocation,
                                    notes: item.notes
                                  });
                                }}
                                className="p-1.5 text-cool-gray-400 hover:text-cyan-400 rounded transition cursor-pointer"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingItemId(item.id)}
                                className="p-1.5 text-cool-gray-400 hover:text-red-400 rounded transition cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Edit Record Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-850 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-cool-gray-750 space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-cool-gray-750 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit3 size={18} className="text-cyan-400" />
                Edit Butcher Cut Record
              </h3>
              <button 
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-cool-gray-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-cool-gray-400 font-bold mb-1">Serial Number</label>
                <input
                  type="text"
                  value={editForm.serial || ''}
                  onChange={(e) => setEditForm({ ...editForm, serial: e.target.value })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-cool-gray-400 font-bold mb-1">Box ID</label>
                <input
                  type="text"
                  value={editForm.box || ''}
                  onChange={(e) => setEditForm({ ...editForm, box: e.target.value })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-cool-gray-400 font-bold mb-1">Cut / Product Name</label>
                <input
                  type="text"
                  value={editForm.cuts || editForm.originalCutName || ''}
                  onChange={(e) => setEditForm({ ...editForm, cuts: e.target.value, originalCutName: e.target.value })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-cool-gray-400 font-bold mb-1">Net Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={editForm.netWeight ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, netWeight: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-cool-gray-400 font-bold mb-1">Pieces</label>
                <input
                  type="number"
                  value={editForm.pieces ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, pieces: parseInt(e.target.value, 10) || 1 })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-cool-gray-400 font-bold mb-1">Pack Date</label>
                <input
                  type="text"
                  value={editForm.packDate || ''}
                  onChange={(e) => setEditForm({ ...editForm, packDate: e.target.value })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-cool-gray-400 font-bold mb-1">Lot Number</label>
                <input
                  type="text"
                  value={editForm.lot || ''}
                  onChange={(e) => setEditForm({ ...editForm, lot: e.target.value })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-cool-gray-400 font-bold mb-1">Location</label>
                <input
                  type="text"
                  value={editForm.location || ''}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-cool-gray-400 font-bold mb-1">Pallet / Placement</label>
                <input
                  type="text"
                  value={editForm.currentLocation || ''}
                  onChange={(e) => setEditForm({ ...editForm, currentLocation: e.target.value })}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-cool-gray-400 font-bold mb-1">Notes</label>
                <textarea
                  value={editForm.notes || ''}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-2 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Check size={14} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Modal */}
      {deletingItemId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-cool-gray-850 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-cool-gray-750 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 text-red-400 font-bold text-base">
              <Trash2 size={20} />
              Delete Cut Record
            </div>
            <p className="text-xs text-cool-gray-300">
              Are you sure you want to permanently remove this butcher cut record? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItemId(null)}
                className="px-3 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 font-bold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteItem(deletingItemId)}
                className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
