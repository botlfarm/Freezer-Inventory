import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, ChevronRight, PackageOpen, ArrowRightCircle, Trash2, Edit3, X, Filter, Plus, PlusCircle, FileText, Flag, Tag, Download, Eye, EyeOff, AlertTriangle, RotateCcw } from 'lucide-react';
import { Tag as AppTag, CustomList, Action } from '../types';
import { compareBoxLabels } from '../utils/boxSort';
import { SearchableProductSelect } from '../components/SearchableProductSelect';

export const OffsiteCategoryFilterModal = ({
  primaryOptions,
  subOptions,
  selectedPrimary,
  selectedSub,
  onChange,
  onClose
}: {
  primaryOptions: string[];
  subOptions: Record<string, string[]>;
  selectedPrimary: Set<string>;
  selectedSub: Set<string>;
  onChange: (primary: Set<string>, sub: Set<string>) => void;
  onClose: () => void;
}) => {
  const [search, setSearch] = useState('');
  // Expanded by default across all categories
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Filter primary options and sub options based on search query
  const filteredPrimary = useMemo(() => {
    if (!search.trim()) return primaryOptions;
    const q = search.toLowerCase();
    return primaryOptions.filter(p => {
      if (p.toLowerCase().includes(q)) return true;
      const subs = subOptions[p] || [];
      return subs.some(s => s.toLowerCase().includes(q));
    });
  }, [primaryOptions, subOptions, search]);

  const totalSubsCount = useMemo(() => {
    return Object.values(subOptions).reduce((acc, list) => acc + list.length, 0);
  }, [subOptions]);

  const activeCount = selectedPrimary.size + selectedSub.size;

  const toggleCollapse = (p: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(primaryOptions));

  const handleSelectAll = () => {
    const allP = new Set(primaryOptions);
    const allS = new Set<string>();
    Object.values(subOptions).forEach(list => list.forEach(s => allS.add(s)));
    onChange(allP, allS);
  };

  const handleClear = () => {
    onChange(new Set(), new Set());
  };

  const handleTogglePrimary = (p: string) => {
    const nextP = new Set(selectedPrimary);
    const nextS = new Set(selectedSub);
    const subs = subOptions[p] || [];

    const checkedSubs = subs.filter(s => nextS.has(s));
    const isCurrentlyChecked = nextP.has(p) || (subs.length > 0 && checkedSubs.length === subs.length);
    const isPartiallyChecked = !isCurrentlyChecked && checkedSubs.length > 0;

    if (isCurrentlyChecked || isPartiallyChecked) {
      // Uncheck parent and all its children
      nextP.delete(p);
      subs.forEach(s => nextS.delete(s));
    } else {
      // Check parent and all its children
      nextP.add(p);
      subs.forEach(s => nextS.add(s));
    }

    onChange(nextP, nextS);
  };

  const handleToggleSub = (p: string, s: string) => {
    const nextP = new Set(selectedPrimary);
    const nextS = new Set(selectedSub);
    const subs = subOptions[p] || [];

    if (nextS.has(s)) {
      nextS.delete(s);
      const remainingSubsInParent = subs.some(sub => sub !== s && nextS.has(sub));
      if (!remainingSubsInParent) {
        nextP.delete(p);
      }
    } else {
      nextS.add(s);
      nextP.add(p);
    }

    onChange(nextP, nextS);
  };

  return (
    <>
      <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs" onClick={(e) => { e.stopPropagation(); onClose(); }}></div>
      <div 
        id="offsite-column-filter-primaryCategory"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cool-gray-800 border border-cool-gray-700 rounded-2xl p-4 z-[130] shadow-2xl w-80 sm:w-96 md:w-[480px] max-w-[95vw] max-h-[85vh] space-y-3 flex flex-col text-left font-normal animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-cool-gray-750 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <Filter size={14} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white leading-tight">Filter by Category</h3>
              <span className="text-[10px] text-cool-gray-400 font-mono">
                {primaryOptions.length} categories • {totalSubsCount} subcategories
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 rounded-lg text-cool-gray-400 hover:text-white hover:bg-cool-gray-700 transition cursor-pointer"
            title="Close filter"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-2.5 text-cool-gray-400" size={14} />
          <input
            type="text"
            placeholder="Search categories or subcategories..."
            className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-cool-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {search && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSearch(''); }}
              className="absolute right-2.5 top-2.5 text-cool-gray-400 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="flex justify-between items-center text-xs text-cool-gray-400 font-bold px-1 border-b border-cool-gray-750 pb-2 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <button
              type="button"
              className="hover:text-emerald-400 transition-colors cursor-pointer text-[11px]"
              onClick={handleSelectAll}
            >
              Select All
            </button>
            <span className="text-cool-gray-600">•</span>
            <button
              type="button"
              className="hover:text-rose-400 transition-colors cursor-pointer text-[11px]"
              onClick={handleClear}
            >
              Clear Filter
            </button>
            <span className="text-cool-gray-600">•</span>
            {collapsed.size > 0 ? (
              <button
                type="button"
                className="hover:text-cyan-400 transition-colors cursor-pointer text-[11px]"
                onClick={expandAll}
              >
                Expand All
              </button>
            ) : (
              <button
                type="button"
                className="hover:text-cyan-400 transition-colors cursor-pointer text-[11px]"
                onClick={collapseAll}
              >
                Collapse All
              </button>
            )}
          </div>
          {activeCount > 0 && (
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono shrink-0">
              {activeCount} active
            </span>
          )}
        </div>

        {/* Categories Tree - Single Scroll Container, Expanded by Default */}
        <div className="overflow-y-auto max-h-72 sm:max-h-96 space-y-1.5 pr-1.5 overscroll-contain">
          {filteredPrimary.map(p => {
            const subs = subOptions[p] || [];
            const isCollapsed = collapsed.has(p);
            const hasSubs = subs.length > 0;
            const checkedSubs = subs.filter(s => selectedSub.has(s));
            const isPrimaryChecked = selectedPrimary.has(p) || (hasSubs && checkedSubs.length === subs.length);
            const isPartiallyChecked = !isPrimaryChecked && checkedSubs.length > 0;

            const filteredSubs = search.trim() 
              ? subs.filter(s => s.toLowerCase().includes(search.toLowerCase()) || p.toLowerCase().includes(search.toLowerCase()))
              : subs;

            return (
              <div key={p} className="bg-cool-gray-850/80 border border-cool-gray-750/70 rounded-xl p-2 transition-colors hover:border-cool-gray-650">
                {/* Primary Category Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {hasSubs ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(p); }}
                        className="p-1 rounded hover:bg-cool-gray-700/60 text-cool-gray-400 hover:text-white transition cursor-pointer shrink-0"
                        title={isCollapsed ? "Expand subcategories" : "Collapse subcategories"}
                      >
                        {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      </button>
                    ) : (
                      <div className="w-5 shrink-0" />
                    )}
                    <label 
                      className="flex items-center gap-2 cursor-pointer select-none min-w-0 flex-1 py-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input 
                        type="checkbox" 
                        className="rounded bg-cool-gray-950 border-cool-gray-700 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer w-4 h-4 shrink-0" 
                        checked={isPrimaryChecked}
                        ref={el => {
                          if (el) el.indeterminate = isPartiallyChecked;
                        }}
                        onChange={() => handleTogglePrimary(p)} 
                      />
                      <span className={`text-xs truncate ${isPrimaryChecked || isPartiallyChecked ? 'text-emerald-300 font-bold' : 'text-white font-semibold'}`}>
                        {p}
                      </span>
                    </label>
                  </div>
                  {hasSubs && (
                    <span className="text-[10px] text-cool-gray-400 font-mono bg-cool-gray-900/60 px-2 py-0.5 rounded-full border border-cool-gray-750 shrink-0">
                      {checkedSubs.length > 0 ? `${checkedSubs.length}/${subs.length}` : `${subs.length}`}
                    </span>
                  )}
                </div>

                {/* Subcategories (Expanded by Default) */}
                {hasSubs && !isCollapsed && (
                  <div className="mt-1.5 pt-1.5 border-t border-cool-gray-750/50 pl-7 pr-1 space-y-1">
                    {filteredSubs.map(s => {
                      const isSubChecked = selectedSub.has(s);
                      return (
                        <label 
                          key={s} 
                          className={`flex items-center gap-2.5 px-2 py-1.5 hover:bg-cool-gray-750/60 rounded-lg cursor-pointer text-xs select-none transition-colors ${
                            isSubChecked ? 'bg-cool-gray-750/40 text-emerald-300 font-medium' : 'text-cool-gray-200'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input 
                            type="checkbox" 
                            className="rounded bg-cool-gray-950 border-cool-gray-700 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer w-3.5 h-3.5 shrink-0" 
                            checked={isSubChecked} 
                            onChange={() => handleToggleSub(p, s)} 
                          />
                          <span className="truncate" title={s}>{s}</span>
                        </label>
                      );
                    })}
                    {filteredSubs.length === 0 && (
                      <div className="text-[11px] text-cool-gray-500 italic py-1 pl-1">
                        No subcategories match "{search}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {filteredPrimary.length === 0 && (
            <div className="text-center text-xs text-cool-gray-400 italic py-8">
              No categories found matching "{search}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2.5 border-t border-cool-gray-750 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-cool-gray-400">
            {activeCount === 0 ? (
              <span className="text-cool-gray-500">All categories included</span>
            ) : (
              <span className="text-emerald-400 font-medium">
                {selectedPrimary.size} primary, {selectedSub.size} sub selected
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors cursor-pointer shadow-md active:scale-95"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </>
  );
};

export const AdvancedFilterMenu = ({ 
  tags, 
  lists, 
  selectedTags, 
  selectedLists, 
  onChange,
  onClose
}: {
  tags: AppTag[],
  lists: CustomList[],
  selectedTags: Set<string>,
  selectedLists: Set<string>,
  onChange: (tags: Set<string>, lists: Set<string>) => void,
  onClose: () => void
}) => {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose}></div>
      <div className="absolute top-full left-0 mt-2 bg-cool-gray-800 border border-cool-gray-600 rounded-lg shadow-2xl p-4 z-40 w-80 max-h-96 overflow-y-auto">
        <div className="mb-4">
          <h4 className="text-white font-bold text-xs mb-2 uppercase">Filter by Tags</h4>
          <div className="space-y-1">
            {tags.map(t => (
              <label key={t.id} className="flex items-center gap-2 cursor-pointer text-xs text-cool-gray-200">
                <input type="checkbox" className="rounded bg-cool-gray-950 border-cool-gray-700 text-emerald-500 focus:ring-emerald-500/50" checked={selectedTags.has(t.id)} onChange={() => {
                  const nextTags = new Set(selectedTags);
                  if (nextTags.has(t.id)) nextTags.delete(t.id);
                  else nextTags.add(t.id);
                  onChange(nextTags, selectedLists);
                }} />
                {t.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <h4 className="text-white font-bold text-xs mb-2 uppercase">Filter by Lists</h4>
          <div className="space-y-1">
            {lists.map(l => (
              <label key={l.id} className="flex items-center gap-2 cursor-pointer text-xs text-cool-gray-200">
                <input type="checkbox" className="rounded bg-cool-gray-950 border-cool-gray-700 text-emerald-500 focus:ring-emerald-500/50" checked={selectedLists.has(l.id)} onChange={() => {
                  const nextLists = new Set(selectedLists);
                  if (nextLists.has(l.id)) nextLists.delete(l.id);
                  else nextLists.add(l.id);
                  onChange(selectedTags, nextLists);
                }} />
                {l.name}
              </label>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export const OffSiteSpreadsheet = ({
  state,
  dispatch,
  products,
  onFilteredEntriesChange,
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
  activeOrderId,
  onSelectActiveOrder
}: any) => {
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);

  const [filterOnlySplitBoxes, setFilterOnlySplitBoxes] = useState<boolean>(() => {
    try {
      return localStorage.getItem('offsite_filter_only_split_boxes') === 'true';
    } catch (_) {
      return false;
    }
  });

  const [filterOnlyConflicts, setFilterOnlyConflicts] = useState<boolean>(() => {
    try {
      return localStorage.getItem('offsite_filter_only_conflicts') === 'true';
    } catch (_) {
      return false;
    }
  });

  const [showUnfilteredBoxIds, setShowUnfilteredBoxIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_only_split_boxes', String(filterOnlySplitBoxes));
    } catch (_) {}
  }, [filterOnlySplitBoxes]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_only_conflicts', String(filterOnlyConflicts));
    } catch (_) {}
  }, [filterOnlyConflicts]);

  const toggleExpandBox = (boxId: string) => {
    setExpandedBoxes(prev => {
      const isCurrentlyExpanded = !!prev[boxId];
      if (isCurrentlyExpanded) {
        setShowUnfilteredBoxIds(curr => {
          if (curr.has(boxId)) {
            const next = new Set(curr);
            next.delete(boxId);
            return next;
          }
          return curr;
        });
      }
      return { ...prev, [boxId]: !isCurrentlyExpanded };
    });
  };

  const rawEntries = useMemo(() => {
    return (state.offSiteEntries || []).filter((e: any) => {
      if (e.archived === true || e.archived === 1 || String(e.archived) === 'true') return false;
      if (e.box && state.containers?.some((c: any) => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
  }, [state.offSiteEntries, state.containers]);

  const mappedRawEntries = useMemo(() => {
    return rawEntries.map((e: any) => {
      const cutsStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').trim();
      const origStr = (e.originalCutName || '').trim();
      const normStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || '').trim();

      let matchedProduct = null;
      if (normStr) {
        matchedProduct = (products || []).find((prod: any) => prod.name.trim().toLowerCase() === normStr.toLowerCase());
      }
      if (!matchedProduct) {
        const matchNum = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const cutsNum = matchNum(cutsStr);
        const origNum = matchNum(origStr);
        if (cutsNum || origNum) {
          matchedProduct = (products || []).find((prod: any) => 
            prod.productNumbers && prod.productNumbers.some((num: string) => 
              (cutsNum && num.toLowerCase() === cutsNum.toLowerCase()) || 
              (origNum && num.toLowerCase() === origNum.toLowerCase())
            )
          );
        }
      }
      if (!matchedProduct) {
        const cleanName = (str: string) => str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
        const cleanCuts = cleanName(cutsStr);
        const cleanOrig = cleanName(origStr);
        const cleanNorm = cleanName(normStr);
        matchedProduct = (products || []).find((p: any) => {
          const pName = p.name.trim().toLowerCase();
          return pName === cleanCuts || pName === cleanOrig || pName === cleanNorm || pName === cutsStr.toLowerCase() || pName === origStr.toLowerCase() || pName === normStr.toLowerCase();
        });
      }

      return {
        ...e,
        cuts: matchedProduct ? matchedProduct.name : ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName))
      };
    });
  }, [rawEntries, products]);

  const orders = state.movementOrders || [];
  const activeOrders = useMemo(() => {
    return orders.filter((o: any) => o.status === 'planning' || o.status === 'finalized');
  }, [orders]);

  const activeOrder = useMemo(() => {
    if (activeOrders.length === 0) return null;
    const targetId = activeOrderId || localStorage.getItem('selected-movement-order-id');
    if (targetId) {
      const match = activeOrders.find((o: any) => o.id === targetId);
      if (match) return match;
    }
    return activeOrders[0];
  }, [activeOrders, activeOrderId]);

  const entries = useMemo(() => {
    let baseList = rawEntries;

    return baseList.map((e: any) => {
      // Find matching product
      let matchedProduct = null;
      if (e.productId) {
        matchedProduct = (products || []).find((prod: any) => prod.id === e.productId);
      }
      const cutsStr = (matchedProduct?.name || e.cuts || e.originalCutName || '').trim();
      const origStr = (e.originalCutName || '').trim();
      const normStr = (matchedProduct?.name || '').trim();

      if (!matchedProduct && normStr) {
        matchedProduct = (products || []).find((prod: any) => prod.name.trim().toLowerCase() === normStr.toLowerCase());
      }
      if (!matchedProduct) {
        const matchNum = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const cutsNum = matchNum(cutsStr);
        const origNum = matchNum(origStr);
        if (cutsNum || origNum) {
          matchedProduct = (products || []).find((prod: any) => 
            prod.productNumbers && prod.productNumbers.some((num: string) => 
              (cutsNum && num.toLowerCase() === cutsNum.toLowerCase()) || 
              (origNum && num.toLowerCase() === origNum.toLowerCase())
            )
          );
        }
      }
      if (!matchedProduct) {
        const cleanName = (str: string) => str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
        const cleanCuts = cleanName(cutsStr);
        const cleanOrig = cleanName(origStr);
        const cleanNorm = cleanName(normStr);
        matchedProduct = (products || []).find((p: any) => {
          const pName = p.name.trim().toLowerCase();
          return pName === cleanCuts || pName === cleanOrig || pName === cleanNorm || pName === cutsStr.toLowerCase() || pName === origStr.toLowerCase() || pName === normStr.toLowerCase();
        });
      }

      // Check if item has a wrong label correction:
      // If wrongLabel column is not empty (contains original productId), that triggers the flag for wrong labeled!
      const isWrongLabel = Boolean(e.wrongLabel && (typeof e.wrongLabel === 'string' ? e.wrongLabel.trim().length > 0 : e.wrongLabel));

      let wrongLabelOriginal = '';
      if (isWrongLabel) {
        if (typeof e.wrongLabel === 'string' && e.wrongLabel.trim()) {
          const origProd = (products || []).find((p: any) => p.id === e.wrongLabel.trim());
          if (origProd) {
            wrongLabelOriginal = origProd.name;
          }
        }
        if (!wrongLabelOriginal && e.originalCutName) {
          wrongLabelOriginal = e.originalCutName;
        }
      }

      // Relational lookup: Entry -> Box -> Pallet -> Location
      const boxName = (e.box || '').trim();
      const boxRecord = boxName ? (state.boxes?.find((b: any) => b.id === boxName || b.name?.trim().toLowerCase() === boxName.toLowerCase()) || state.containers?.find((c: any) => c.id === boxName || c.name?.trim().toLowerCase() === boxName.toLowerCase())) : null;
      const palletRecord = boxRecord?.palletId ? (state.pallets?.find((p: any) => p.id === boxRecord.palletId) || state.freezers?.find((f: any) => f.id === boxRecord.palletId)) : null;
      const locationRecord = palletRecord?.storageLocationId ? state.locations?.find((l: any) => l.id === palletRecord.storageLocationId) : null;

      const derivedPallet = palletRecord?.name || e.pallet || e.currentLocation || '';
      const derivedLocation = locationRecord?.name || palletRecord?.location || e.location || 'Unassigned';

      return {
        ...e,
        cuts: matchedProduct ? matchedProduct.name : (e.cuts || e.originalCutName || 'Unspecified Cut'),
        pallet: derivedPallet,
        currentLocation: derivedPallet,
        location: derivedLocation,
        storageLocationId: palletRecord?.storageLocationId || e.storageLocationId || '',
        palletId: boxRecord?.palletId || e.palletId || '',
        primaryCategory: matchedProduct?.primaryCategory || 'Off-Site / Uncategorized',
        subCategory: matchedProduct?.subCategory || 'Off-Site / Uncategorized',
        matchedProduct: matchedProduct,
        isManuallyCorrected: isWrongLabel,
        isWrongLabel: isWrongLabel,
        wrongLabel: e.wrongLabel || undefined,
        wrongLabelOriginal: wrongLabelOriginal
      };
    });
  }, [rawEntries, activeOrder, products, state.butcherRecords, state.products, state.boxes, state.containers, state.pallets, state.freezers, state.locations]);

  const downloadCSVForEntries = (entriesToExport: any[], filenamePrefix: string) => {
    if (entriesToExport.length === 0) return;
    
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

    const rows = entriesToExport.map(e => {
      let mt = '';
      if (activeOrder) {
        const m = activeOrder.moves.find((mv: any) => mv.entryId === e.id);
        if (m && m.targetLocation) mt = m.targetLocation;
      }

      let cutName = (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName);
      if (!cutName) {
        const cutsStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').trim();
        const normStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || '').trim();
        let matchedProduct = null;
        if (normStr) {
          matchedProduct = (products || []).find((prod: any) => prod.name.trim().toLowerCase() === normStr.toLowerCase());
        }
        cutName = matchedProduct ? matchedProduct.name : ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || (state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName));
      }

      return [
        escapeCSVField(e.serial),
        escapeCSVField(cutName),
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
    link.setAttribute("download", `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const updateMoveTargetGroup = async (items: any[], target: string) => {
    if (!activeOrder || activeOrder.status !== 'planning') return;
    if (target === '__mixed__') return;
    let moves = [...activeOrder.moves];
    items.forEach(item => {
      const existingIdx = moves.findIndex((m: any) => m.entryId === item.id);
      if (existingIdx >= 0) {
        if (target) moves[existingIdx] = { ...moves[existingIdx], targetLocation: target };
        else moves.splice(existingIdx, 1);
      } else if (target) {
        moves.push({ entryId: item.id, targetLocation: target });
      }
    });
    
    // Also add their pallets to 'palletsInPlay' if not already
    let updatedPallets = [...activeOrder.palletsInPlay];
    let changedPallets = false;
    items.forEach(item => {
      if (item.currentLocation && !updatedPallets.includes(item.currentLocation)) {
        updatedPallets.push(item.currentLocation);
        changedPallets = true;
      }
    });
    
    const updates: any = { moves };
    if (changedPallets) updates.palletsInPlay = updatedPallets;
    
    await dispatch({ type: 'UPDATE_MOVEMENT_ORDER', payload: { id: activeOrder.id, updates } });
  };

  const updateMoveTargetItem = async (itemId: string, target: string) => {
    if (!activeOrder || activeOrder.status !== 'planning') return;
    let moves = [...activeOrder.moves];
    const existingIdx = moves.findIndex((m: any) => m.entryId === itemId);
    if (existingIdx >= 0) {
      if (target) moves[existingIdx] = { ...moves[existingIdx], targetLocation: target };
      else moves.splice(existingIdx, 1);
    } else if (target) {
      moves.push({ entryId: itemId, targetLocation: target });
    }
    
    // Also handle palletsInPlay
    const item = entries.find((e: any) => e.id === itemId);
    let updatedPallets = [...activeOrder.palletsInPlay];
    let changedPallets = false;
    if (item && item.currentLocation && !updatedPallets.includes(item.currentLocation)) {
      updatedPallets.push(item.currentLocation);
      changedPallets = true;
    }

    const updates: any = { moves };
    if (changedPallets) updates.palletsInPlay = updatedPallets;
    await dispatch({ type: 'UPDATE_MOVEMENT_ORDER', payload: { id: activeOrder.id, updates } });
  };

  // Bulk Actions
  const [selectedBoxIds, setSelectedBoxIds] = useState<Set<string>>(new Set());
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkTargetDest, setBulkTargetDest] = useState('');
  
  // Advanced Filter States
  const [simulateBoxCount, setSimulateBoxCount] = useState(() => localStorage.getItem("offsite-simulate-box-count") === "true");
  const theoreticalBoxWeight = useMemo(() => {
    const val = localStorage.getItem("offsite-theoretical-box-weight");
    const parsed = val ? parseFloat(val) : 40;
    return isNaN(parsed) || parsed <= 0 ? 40 : parsed;
  }, []);

  // Bulk Edit and Delete States
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [bulkEditForm, setBulkEditForm] = useState<any>({
    cuts: '',
    box: '',
    currentLocation: '',
    location: '',
    notes: '',
    packDate: '',
    lot: '',
    netWeight: '',
    pieces: '',
    tagIds: [] as string[],
  });
  const [bulkEditFieldsToUpdate, setBulkEditFieldsToUpdate] = useState<Record<string, boolean>>({
    cuts: false,
    box: false,
    currentLocation: false,
    location: false,
    notes: false,
    packDate: false,
    lot: false,
    netWeight: false,
    pieces: false,
    tags: false,
  });

  // Direct Editing States
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // "Wrong Label" modal states
  const [wrongLabelItemId, setWrongLabelItemId] = useState<string | null>(null);
  const [selectedCorrectProductId, setSelectedCorrectProductId] = useState<string>('');
  const [wrongLabelNotes, setWrongLabelNotes] = useState<string>('');

  const [isBulkWrongLabelModalOpen, setIsBulkWrongLabelModalOpen] = useState(false);
  const [bulkWrongLabelProductId, setBulkWrongLabelProductId] = useState('');
  const [bulkWrongLabelNotes, setBulkWrongLabelNotes] = useState('');

  const wrongLabelItem = useMemo(() => {
    return (entries || []).find(e => e.id === wrongLabelItemId);
  }, [entries, wrongLabelItemId]);

  const handleSaveWrongLabel = async () => {
    if (!wrongLabelItemId || !selectedCorrectProductId) return;
    await dispatch({
      type: 'CORRECT_OFFSITE_LABEL',
      payload: {
        entryId: wrongLabelItemId,
        correctProductId: selectedCorrectProductId,
        notes: wrongLabelNotes.trim() || undefined
      }
    });
    setWrongLabelItemId(null);
    setSelectedCorrectProductId('');
    setWrongLabelNotes('');
  };

  // Column resizing state and logic
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('offsite_column_widths');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            box: parsed.box || 100,
            cuts: parsed.cuts || 220,
            category: parsed.category || 200,
            weight: parsed.weight || 90,
            pieces: parsed.pieces || 80,
            location: parsed.location || 130,
            pallet: parsed.pallet || 110,
            movedTo: parsed.movedTo || 140,
            flag: parsed.flag || 80,
            serial: parsed.serial || 120,
            lotNumber: parsed.lotNumber || 100,
            packDate: parsed.packDate || 100,
          };
        }
      }
    } catch (e) {}
    return {
      box: 100,
      cuts: 220,
      category: 200,
      weight: 90,
      pieces: 80,
      location: 130,
      pallet: 110,
      movedTo: 140,
      flag: 80,
      serial: 120,
      lotNumber: 100,
      packDate: 100,
    };
  });

  const handleResizeStart = (e: React.MouseEvent, colKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.pageX;
    const startWidth = columnWidths[colKey] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.pageX - startX;
      const newWidth = Math.max(50, startWidth + deltaX); // Min 50px
      setColumnWidths(prev => {
        const updated = { ...prev, [colKey]: newWidth };
        try {
          localStorage.setItem('offsite_column_widths', JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const [openFlagSelectorId, setOpenFlagSelectorId] = useState<string | null>(null);

  const flagColors = [
    { name: 'Red', value: 'red', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', fill: 'fill-red-500', hoverBg: 'hover:bg-red-500/20', badge: 'bg-red-500/20 text-red-300 border-red-500/30' },
    { name: 'Orange', value: 'orange', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-500', fill: 'fill-amber-500', hoverBg: 'hover:bg-amber-500/20', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
    { name: 'Yellow', value: 'yellow', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', fill: 'fill-yellow-400', hoverBg: 'hover:bg-yellow-500/20', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
    { name: 'Green', value: 'green', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', fill: 'fill-emerald-500', hoverBg: 'hover:bg-emerald-500/20', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
    { name: 'Blue', value: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', fill: 'fill-blue-500', hoverBg: 'hover:bg-blue-500/20', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { name: 'Purple', value: 'purple', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', fill: 'fill-purple-500', hoverBg: 'hover:bg-purple-500/20', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  ];

  const updateFlag = async (id: string, color: string | null) => {
    if (!activeOrder) return;
    const currentFlags = activeOrder.flags || {};
    const updatedFlags = { ...currentFlags };
    if (color) {
      updatedFlags[id] = color;
    } else {
      delete updatedFlags[id];
    }
    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: { id: activeOrder.id, updates: { flags: updatedFlags } }
    });
  };

  const clearAllFlags = async () => {
    if (!activeOrder) return;
    await dispatch({
      type: 'UPDATE_MOVEMENT_ORDER',
      payload: { id: activeOrder.id, updates: { flags: {} } }
    });
  };

  const [openTagSelectorId, setOpenTagSelectorId] = useState<string | null>(null);
  const setQuickInfoItem = (item: any) => {
    if ((window as any).__showProductQuickInfo) {
      (window as any).__showProductQuickInfo(item);
    }
  };

  const OffSiteTagPopover: React.FC<{
    item: any;
    currentTagIds: string[];
    tags: any[];
    dispatch: React.Dispatch<Action>;
    onClose: () => void;
  }> = ({ item, currentTagIds, tags, dispatch, onClose }) => {
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => [...currentTagIds]);

    const handleToggle = (tagId: string) => {
      setSelectedTagIds(prev =>
        prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
      );
    };

    const handleApply = () => {
      const toAdd = selectedTagIds.filter(id => !currentTagIds.includes(id));
      const toRemove = currentTagIds.filter(id => !selectedTagIds.includes(id));

      toAdd.forEach(tagId => {
        dispatch({ type: 'TOGGLE_OFFSITE_ENTRY_TAG', payload: { entryId: item.id, tagId } });
      });
      toRemove.forEach(tagId => {
        dispatch({ type: 'TOGGLE_OFFSITE_ENTRY_TAG', payload: { entryId: item.id, tagId } });
      });

      onClose();
    };

    const modal = (
      <>
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs" onClick={(e) => { e.stopPropagation(); onClose(); }}></div>
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[130] bg-cool-gray-850 border border-cool-gray-750 p-3 rounded-xl shadow-2xl flex flex-col gap-2 min-w-[220px] animate-scale-up text-left max-h-[80vh] overflow-y-auto">
          <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider border-b border-cool-gray-750 pb-1">
            Select Tags
          </span>
          <div className="flex flex-col gap-1 my-1">
            {tags.map((tag: any) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggle(tag.id)}
                  style={{
                    backgroundColor: isSelected ? `${tag.color}20` : 'transparent',
                    borderColor: isSelected ? `${tag.color}40` : 'transparent'
                  }}
                  className="w-full text-left text-xs px-2 py-1.5 rounded border transition-colors flex items-center gap-2 hover:bg-cool-gray-800 cursor-pointer"
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 border"
                    style={{ 
                      backgroundColor: tag.color || '#60a5fa',
                      borderColor: isSelected ? '#ffffff' : 'transparent'
                    }}
                  />
                  <span className="text-cool-gray-200 font-bold flex-1">
                    {tag.name}
                  </span>
                  {isSelected && (
                    <span className="text-cyan-400 text-[10px] font-black">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-750">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs text-cool-gray-400 hover:text-white rounded bg-cool-gray-800 hover:bg-cool-gray-700 cursor-pointer font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3 py-1 text-xs text-white bg-cyan-600 hover:bg-cyan-500 rounded cursor-pointer font-extrabold shadow"
            >
              OK
            </button>
          </div>
        </div>
      </>
    );

    return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
  };

  const renderItemTagSelector = (item: any) => {
    const isOpen = openTagSelectorId === item.id;
    const currentTagIds = item.tagIds || [];
    
    return (
      <div className="relative inline-flex items-center" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => {
            setOpenTagSelectorId(isOpen ? null : item.id);
            setOpenFlagSelectorId(null); // close flag selector
          }}
          className={`p-1.5 rounded-lg border transition-all duration-150 cursor-pointer select-none flex items-center justify-center ${
            currentTagIds.length > 0
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:scale-105'
              : 'border-cool-gray-700 hover:border-cool-gray-500 hover:bg-cool-gray-800 text-cool-gray-400 hover:text-white'
          }`}
          title="Manage persistent tags (e.g. Use First, Not For Sale)"
        >
          <Tag size={13} />
        </button>

        {isOpen && (
          <OffSiteTagPopover
            item={item}
            currentTagIds={currentTagIds}
            tags={state.tags || []}
            dispatch={dispatch}
            onClose={() => setOpenTagSelectorId(null)}
          />
        )}
      </div>
    );
  };

  const renderFlagSelector = (id: string, isBox: boolean) => {
    if (!activeOrder) return null;
    const currentFlags = activeOrder.flags || {};
    const selectedColorValue = currentFlags[id];
    const activeColorObj = selectedColorValue ? flagColors.find(c => c.value === selectedColorValue) : null;
    const isOpen = openFlagSelectorId === id;

    return (
      <div className="relative inline-flex items-center" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setOpenFlagSelectorId(isOpen ? null : id)}
          className={`p-1.5 rounded-lg border transition-all duration-150 cursor-pointer select-none flex items-center justify-center ${
            activeColorObj 
              ? `${activeColorObj.bg} ${activeColorObj.border} ${activeColorObj.text} hover:scale-105` 
              : 'border-cool-gray-700 hover:border-cool-gray-500 hover:bg-cool-gray-800 text-cool-gray-400 hover:text-white'
          }`}
          title={activeColorObj ? `Flagged: ${activeColorObj.name} (Click to change/clear)` : 'Add temporary flag/marker'}
        >
          <Flag 
            size={14} 
            className={`${activeColorObj ? activeColorObj.fill : ''} transition-all`} 
          />
        </button>

        {isOpen && typeof document !== 'undefined' && createPortal(
          <>
            <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs" onClick={(e) => { e.stopPropagation(); setOpenFlagSelectorId(null); }}></div>
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[130] bg-cool-gray-850 border border-cool-gray-750 p-3 rounded-xl shadow-2xl flex flex-col gap-3 min-w-[200px] animate-scale-up text-left">
              <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider border-b border-cool-gray-750 pb-1.5">
                Select Flag
              </span>
            <div className="grid grid-cols-3 gap-1.5">
              {flagColors.map(color => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => {
                    updateFlag(id, color.value);
                    setOpenFlagSelectorId(null);
                  }}
                  className={`w-7 h-7 rounded-full border transition-all flex items-center justify-center ${color.bg} ${color.border} ${color.hoverBg} cursor-pointer`}
                  title={`${color.name} Flag`}
                >
                  <Flag 
                    size={11} 
                    className={`${color.fill} ${color.text}`} 
                  />
                </button>
              ))}
            </div>
            {selectedColorValue && (
              <button
                type="button"
                onClick={() => {
                  updateFlag(id, null);
                  setOpenFlagSelectorId(null);
                }}
                className="w-full text-center text-[10px] text-red-400 hover:text-red-300 font-bold py-1 rounded bg-red-950/25 border border-red-900/30 hover:bg-red-950/45 transition-colors cursor-pointer"
              >
                Clear Flag
              </button>
            )}
          </div>
          </>,
          document.body
        )}
      </div>
    );
  };
  
  const [editForm, setEditForm] = useState<any>({});
  const [newItemForm, setNewItemForm] = useState<any>({
    cuts: '',
    productId: '',
    originalCutName: '',
    box: '',
    serial: '',
    netWeight: '',
    pieces: '',
    currentLocation: '',
    location: '',
    notes: '',
    packDate: '',
    lot: '',
    tagIds: []
  });

  const allCutSuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    (products || []).forEach((p: any) => {
      if (p.name) suggestions.add(p.name);
    });
    (rawEntries || []).forEach((e: any) => {
      if ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)) suggestions.add((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName));
    });
    return Array.from(suggestions).sort();
  }, [products, rawEntries]);

  const allLocationSuggestions = useMemo(() => {
    const suggestions = new Set<string>();
    (state.locations || []).forEach((l: any) => {
      if (l.name) suggestions.add(l.name);
    });
    (rawEntries || []).forEach((e: any) => {
      if (e.location) suggestions.add(e.location);
    });
    return Array.from(suggestions).sort();
  }, [state.locations, rawEntries]);

  const handleSaveItemEdit = async (itemId: string) => {
    const netWeightNum = parseFloat(editForm.netWeight);
    const piecesInt = parseInt(editForm.pieces, 10);
    
    await dispatch({
      type: 'UPDATE_OFFSITE_ENTRY',
      payload: {
        id: itemId,
        updates: {
          cuts: editForm.cuts,
          productId: editForm.productId || undefined,
          originalCutName: editForm.originalCutName || '',
          box: (editForm.box || '').trim(),
          serial: (editForm.serial || '').trim(),
          netWeight: isNaN(netWeightNum) ? 0 : netWeightNum,
          pieces: isNaN(piecesInt) ? 0 : piecesInt,
          currentLocation: (editForm.currentLocation || '').trim(),
          location: (editForm.location || '').trim(),
          notes: editForm.notes,
          packDate: editForm.packDate,
          lot: editForm.lot,
          tagIds: editForm.tagIds || [],
        }
      }
    });
    setEditingItemId(null);
  };

  const handleDeleteItem = async (itemId: string) => {
    await dispatch({
      type: 'DELETE_OFFSITE_ENTRY',
      payload: { id: itemId }
    });
    setDeletingItemId(null);
  };

  const handleAddNewItem = async () => {
    if (!newItemForm.cuts || !newItemForm.box) return;
    
    const serialVal = (newItemForm.serial || '').trim() || Math.floor(1000000 + Math.random() * 9000000).toString();
    const netWeightNum = parseFloat(newItemForm.netWeight);
    const piecesInt = parseInt(newItemForm.pieces, 10);

    let matchedProduct = newItemForm.productId ? state.products?.find((p: any) => p.id === newItemForm.productId) : undefined;
    if (!matchedProduct && newItemForm.cuts) {
      matchedProduct = state.products?.find((p: any) => p.name.trim().toLowerCase() === newItemForm.cuts.trim().toLowerCase());
    }
    const defaultTagIds = matchedProduct?.defaultTagIds || [];
    const finalTagIds = (newItemForm.tagIds && newItemForm.tagIds.length > 0)
      ? newItemForm.tagIds
      : [...defaultTagIds];
    
    const newEntry = {
      id: 'entry_' + Math.random().toString(36).substr(2, 9),
      serial: serialVal,
      cuts: newItemForm.cuts,
      productId: matchedProduct ? matchedProduct.id : (newItemForm.productId || undefined),
      originalCutName: newItemForm.originalCutName || '',
      box: (newItemForm.box || '').trim(),
      netWeight: isNaN(netWeightNum) ? 0 : netWeightNum,
      pieces: isNaN(piecesInt) ? 0 : piecesInt,
      currentLocation: (newItemForm.currentLocation || '').trim(),
      location: (newItemForm.location || '').trim(),
      notes: newItemForm.notes,
      packDate: newItemForm.packDate,
      lot: newItemForm.lot,
      tagIds: finalTagIds
    };

    await dispatch({
      type: 'ADD_OFFSITE_ENTRY',
      payload: { entry: newEntry }
    });

    setIsAddModalOpen(false);
    setNewItemForm({
      cuts: '',
      productId: '',
      originalCutName: '',
      box: '',
      serial: '',
      netWeight: '',
      pieces: '',
      currentLocation: '',
      location: '',
      notes: '',
      packDate: '',
      lot: '',
      tagIds: []
    });
  };

  const [lastSelectedBoxIndex, setLastSelectedBoxIndex] = useState<number | null>(null);
  const [lastSelectedItemIndex, setLastSelectedItemIndex] = useState<{ boxId: string; index: number } | null>(null);

  const handleSelectBox = (rowId: string, idx: number, e?: React.MouseEvent | React.ChangeEvent) => {
    const isShift = (e as React.MouseEvent)?.shiftKey || (e?.nativeEvent as MouseEvent)?.shiftKey;
    const newSet = new Set(selectedBoxIds);

    if (isShift && lastSelectedBoxIndex !== null && lastSelectedBoxIndex >= 0 && lastSelectedBoxIndex < condensed.length) {
      const start = Math.min(lastSelectedBoxIndex, idx);
      const end = Math.max(lastSelectedBoxIndex, idx);
      const targetSelected = !selectedBoxIds.has(rowId);

      for (let i = start; i <= end; i++) {
        const g = condensed[i];
        if (g) {
          const id = viewUngrouped ? g.items[0].id : g.boxId;
          if (targetSelected) {
            newSet.add(id);
          } else {
            newSet.delete(id);
          }
        }
      }
    } else {
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
    }

    setSelectedBoxIds(newSet);
    setLastSelectedBoxIndex(idx);
  };

  const handleSelectItem = (itemId: string, boxId: string, itemIdx: number, itemsToRender: any[], e?: React.MouseEvent | React.ChangeEvent) => {
    const isShift = (e as React.MouseEvent)?.shiftKey || (e?.nativeEvent as MouseEvent)?.shiftKey;
    const newSet = new Set(selectedItemIds);

    if (isShift && lastSelectedItemIndex && lastSelectedItemIndex.boxId === boxId && lastSelectedItemIndex.index >= 0 && lastSelectedItemIndex.index < itemsToRender.length) {
      const start = Math.min(lastSelectedItemIndex.index, itemIdx);
      const end = Math.max(lastSelectedItemIndex.index, itemIdx);
      const targetSelected = !selectedItemIds.has(itemId);

      for (let i = start; i <= end; i++) {
        const it = itemsToRender[i];
        if (it) {
          if (targetSelected) {
            newSet.add(it.id);
          } else {
            newSet.delete(it.id);
          }
        }
      }
    } else {
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
    }

    setSelectedItemIds(newSet);
    setLastSelectedItemIndex({ boxId, index: itemIdx });
  };

  const handleBulkMove = async (target: string) => {
    if (!activeOrder || activeOrder.status !== 'planning') return;
    if (selectedBoxIds.size === 0 && selectedItemIds.size === 0) return;
    
    // Combine them, ensuring uniqueness by item ID
    const seenIds = new Set<string>();
    const allItemsToMove: any[] = [];
    
    if (viewUngrouped) {
      // In ungrouped mode, selectedBoxIds contains item IDs directly
      rawEntries.filter((e: any) => selectedBoxIds.has(e.id)).forEach(item => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allItemsToMove.push(item);
        }
      });
    } else {
      // Get all items in the selected boxes
      const selectedBoxesList = condensed.filter(g => selectedBoxIds.has(g.boxId));
      const boxItems = selectedBoxesList.flatMap(g => g.items);
      
      // Get all selected individual items
      const individualItems = rawEntries.filter((e: any) => selectedItemIds.has(e.id));
      
      [...boxItems, ...individualItems].forEach(item => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          allItemsToMove.push(item);
        }
      });
    }
    
    if (allItemsToMove.length > 0) {
      await updateMoveTargetGroup(allItemsToMove, target);
    }
    
    setSelectedBoxIds(new Set());
    setSelectedItemIds(new Set());
    setBulkTargetDest('');
  };

  const handleExecuteBulkDelete = async () => {
    if (selectedBoxIds.size === 0 && selectedItemIds.size === 0) return;
    
    let allItemIds: string[];
    if (viewUngrouped) {
      allItemIds = Array.from(selectedBoxIds);
    } else {
      const selectedBoxesList = condensed.filter(g => selectedBoxIds.has(g.boxId));
      const allBoxItemIds = selectedBoxesList.flatMap(g => g.items.map(item => item.id));
      allItemIds = Array.from(new Set([...allBoxItemIds, ...Array.from(selectedItemIds)]));
    }
    
    await dispatch({
      type: 'BULK_DELETE_OFFSITE_ENTRIES',
      payload: { ids: allItemIds }
    });
    
    setSelectedBoxIds(new Set());
    setSelectedItemIds(new Set());
    setIsBulkDeleteConfirmOpen(false);
  };

  const handleExecuteBulkWrongLabel = async () => {
    if (selectedBoxIds.size === 0 && selectedItemIds.size === 0) return;
    if (!bulkWrongLabelProductId) return;
    
    let allItemIds: string[];
    if (viewUngrouped) {
      allItemIds = Array.from(selectedBoxIds);
    } else {
      const selectedBoxesList = condensed.filter(g => selectedBoxIds.has(g.boxId));
      const allBoxItemIds = selectedBoxesList.flatMap(g => g.items.map(item => item.id));
      allItemIds = Array.from(new Set([...allBoxItemIds, ...Array.from(selectedItemIds)]));
    }
    
    await dispatch({
      type: 'BULK_CORRECT_OFFSITE_LABEL',
      payload: { 
        entryIds: allItemIds,
        correctProductId: bulkWrongLabelProductId,
        notes: bulkWrongLabelNotes.trim() || undefined
      }
    });
    
    setSelectedBoxIds(new Set());
    setSelectedItemIds(new Set());
    setIsBulkWrongLabelModalOpen(false);
    setBulkWrongLabelProductId('');
    setBulkWrongLabelNotes('');
  };

  const handleExecuteBulkRevertWrongLabel = async () => {
    if (selectedBoxIds.size === 0 && selectedItemIds.size === 0) return;
    
    let allItemIds: string[];
    if (viewUngrouped) {
      allItemIds = Array.from(selectedBoxIds);
    } else {
      const selectedBoxesList = condensed.filter(g => selectedBoxIds.has(g.boxId));
      const allBoxItemIds = selectedBoxesList.flatMap(g => g.items.map(item => item.id));
      allItemIds = Array.from(new Set([...allBoxItemIds, ...Array.from(selectedItemIds)]));
    }
    
    await dispatch({
      type: 'BULK_REVERT_OFFSITE_LABEL',
      payload: { 
        entryIds: allItemIds
      }
    });
    
    setSelectedBoxIds(new Set());
    setSelectedItemIds(new Set());
  };

  const handleExecuteBulkEdit = async () => {
    if (selectedBoxIds.size === 0 && selectedItemIds.size === 0) return;
    
    let allItemIds: string[];
    if (viewUngrouped) {
      allItemIds = Array.from(selectedBoxIds);
    } else {
      const selectedBoxesList = condensed.filter(g => selectedBoxIds.has(g.boxId));
      const allBoxItemIds = selectedBoxesList.flatMap(g => g.items.map(item => item.id));
      allItemIds = Array.from(new Set([...allBoxItemIds, ...Array.from(selectedItemIds)]));
    }
    
    const updates: any = {};
    if (bulkEditFieldsToUpdate.cuts) updates.cuts = bulkEditForm.cuts;
    if (bulkEditFieldsToUpdate.box) updates.box = (bulkEditForm.box || '').trim();
    if (bulkEditFieldsToUpdate.currentLocation) updates.currentLocation = (bulkEditForm.currentLocation || '').trim();
    if (bulkEditFieldsToUpdate.location) updates.location = (bulkEditForm.location || '').trim();
    if (bulkEditFieldsToUpdate.colors) updates.colors = bulkEditForm.colors;
    if (bulkEditFieldsToUpdate.notes) updates.notes = bulkEditForm.notes;
    if (bulkEditFieldsToUpdate.packDate) updates.packDate = bulkEditForm.packDate;
    if (bulkEditFieldsToUpdate.lot) updates.lot = bulkEditForm.lot;
    if (bulkEditFieldsToUpdate.tags) updates.tagIds = bulkEditForm.tagIds || [];
    if (bulkEditFieldsToUpdate.netWeight) {
      const w = parseFloat(bulkEditForm.netWeight);
      updates.netWeight = isNaN(w) ? 0 : w;
    }
    if (bulkEditFieldsToUpdate.pieces) {
      const p = parseInt(bulkEditForm.pieces, 10);
      updates.pieces = isNaN(p) ? 0 : p;
    }

    await dispatch({
      type: 'BULK_EDIT_OFFSITE_ENTRIES',
      payload: { ids: allItemIds, updates }
    });

    setSelectedBoxIds(new Set());
    setSelectedItemIds(new Set());
    setIsBulkEditModalOpen(false);
  };

  // Filters
  const loadFilterSet = (key: string): Set<string> => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (_) {
      return new Set();
    }
  };

  const [filterCuts, setFilterCuts] = useState<Set<string>>(() => loadFilterSet('offsite_filter_cuts'));
  const [filterPrimaryCategories, setFilterPrimaryCategories] = useState<Set<string>>(() => loadFilterSet('offsite_filter_primary_categories'));
  const [filterSubCategories, setFilterSubCategories] = useState<Set<string>>(() => loadFilterSet('offsite_filter_sub_categories'));
  const [filterPallets, setFilterPallets] = useState<Set<string>>(() => loadFilterSet('offsite_filter_pallets'));
  const [filterLocations, setFilterLocations] = useState<Set<string>>(() => loadFilterSet('offsite_filter_locations'));
  const [filterMoveTo, setFilterMoveTo] = useState<Set<string>>(() => loadFilterSet('offsite_filter_move_to'));
  const [filterBoxes, setFilterBoxes] = useState<Set<string>>(() => loadFilterSet('offsite_filter_boxes'));
  const [filterSerials, setFilterSerials] = useState<Set<string>>(() => loadFilterSet('offsite_filter_serials'));
  const [filterLots, setFilterLots] = useState<Set<string>>(() => loadFilterSet('offsite_filter_lots'));
  const [filterPackDates, setFilterPackDates] = useState<Set<string>>(() => loadFilterSet('offsite_filter_pack_dates'));

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_cuts', JSON.stringify(Array.from(filterCuts)));
    } catch (_) {}
  }, [filterCuts]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_primary_categories', JSON.stringify(Array.from(filterPrimaryCategories)));
    } catch (_) {}
  }, [filterPrimaryCategories]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_sub_categories', JSON.stringify(Array.from(filterSubCategories)));
    } catch (_) {}
  }, [filterSubCategories]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_pallets', JSON.stringify(Array.from(filterPallets)));
    } catch (_) {}
  }, [filterPallets]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_locations', JSON.stringify(Array.from(filterLocations)));
    } catch (_) {}
  }, [filterLocations]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_move_to', JSON.stringify(Array.from(filterMoveTo)));
    } catch (_) {}
  }, [filterMoveTo]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_boxes', JSON.stringify(Array.from(filterBoxes)));
    } catch (_) {}
  }, [filterBoxes]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_serials', JSON.stringify(Array.from(filterSerials)));
    } catch (_) {}
  }, [filterSerials]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_lots', JSON.stringify(Array.from(filterLots)));
    } catch (_) {}
  }, [filterLots]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_filter_pack_dates', JSON.stringify(Array.from(filterPackDates)));
    } catch (_) {}
  }, [filterPackDates]);

  useEffect(() => {
    (window as any).__setOffSiteFilters = (pallet?: string, location?: string) => {
      if (pallet) {
        setFilterPallets(new Set([pallet]));
      }
      if (location) {
        setFilterLocations(new Set([location]));
      }
    };
    return () => {
      delete (window as any).__setOffSiteFilters;
    };
  }, []);

  // Search queries for each filter dropdown list
  const [cutsSearch, setCutsSearch] = useState('');
  const [primaryCategoriesSearch, setPrimaryCategoriesSearch] = useState('');
  const [subCategoriesSearch, setSubCategoriesSearch] = useState('');
  const [palletsSearch, setPalletsSearch] = useState('');
  const [locationsSearch, setLocationsSearch] = useState('');
  const [moveToSearch, setMoveToSearch] = useState('');
  const [boxesSearch, setBoxesSearch] = useState('');
  const [serialsSearch, setSerialsSearch] = useState('');
  const [lotsSearch, setLotsSearch] = useState('');
  const [packDatesSearch, setPackDatesSearch] = useState('');

  // Track which column filter dropdown is open
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  
  // Sorting
  const [sortField, setSortField] = useState<string>(() => {
    return localStorage.getItem('offsite_sort_field') || 'box';
  });
  const [sortAsc, setSortAsc] = useState<boolean>(() => {
    return localStorage.getItem('offsite_sort_asc') !== 'false';
  });

  useEffect(() => {
    try {
      localStorage.setItem('offsite_sort_field', sortField);
    } catch (_) {}
  }, [sortField]);

  useEffect(() => {
    try {
      localStorage.setItem('offsite_sort_asc', String(sortAsc));
    } catch (_) {}
  }, [sortAsc]);
  
  // Dropdown states
  const [expandedBoxes, setExpandedBoxes] = useState<Record<string, boolean>>({});
  const [showItemBreakdown, setShowItemBreakdown] = useState(false);

  // Itemized Inventory Breakdown states
  const [breakdownSearch, setBreakdownSearch] = useState('');
  const [breakdownCategory, setBreakdownCategory] = useState('All');
  const [breakdownSortField, setBreakdownSortField] = useState('weight');
  const [breakdownSortAsc, setBreakdownSortAsc] = useState(false);

  useEffect(() => {
    setFilterCuts(new Set());
  }, [viewOriginalNames]);

  // Helpers
  const getProductCategoryForCut = (cutsStr: string) => {
    if (!cutsStr) return 'Off-Site / Uncategorized';
    let itemNumber = '';
    let namePart = cutsStr;
    const match = cutsStr.match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
    if (match) {
      itemNumber = match[1];
      namePart = match[2];
    }
    const matchedProduct = (products || []).find((p: any) => 
      (itemNumber && p.productNumbers?.includes(itemNumber)) || 
      p.name.toLowerCase() === namePart.toLowerCase() ||
      p.name.toLowerCase() === cutsStr.toLowerCase()
    );
    return matchedProduct?.primaryCategory || 'Off-Site / Uncategorized';
  };

  const allCategories = useMemo(() => {
    const categoriesSet = new Set<string>();
    (products || []).forEach(p => {
      if (p.primaryCategory) {
        categoriesSet.add(p.primaryCategory);
      }
    });
    return Array.from(categoriesSet).sort();
  }, [products]);

  const toggleBreakdownSort = (field: string) => {
    if (breakdownSortField === field) {
      setBreakdownSortAsc(!breakdownSortAsc);
    } else {
      setBreakdownSortField(field);
      setBreakdownSortAsc(['name', 'category', 'pallet'].includes(field));
    }
  };

  const allCuts = Array.from(new Set(entries.map((e: any) => (viewOriginalNames && e.originalCutName) ? e.originalCutName : ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '')).filter(Boolean) as string[])).sort();
  const allPrimaryCategories = useMemo(() => {
    return Array.from(new Set(entries.map((e: any) => e.primaryCategory || 'Off-Site / Uncategorized'))).sort();
  }, [entries]);
  const allSubCategories = useMemo(() => {
    return Array.from(new Set(entries.map((e: any) => e.subCategory || 'Off-Site / Uncategorized'))).sort();
  }, [entries]);

  const categoryMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    entries.forEach(e => {
      const p = e.primaryCategory || 'Off-Site / Uncategorized';
      const s = e.subCategory || 'Off-Site / Uncategorized';
      if (!map[p]) map[p] = new Set();
      map[p].add(s);
    });
    const result: Record<string, string[]> = {};
    for (const p in map) {
      result[p] = Array.from(map[p]).sort();
    }
    return result;
  }, [entries]);
  const allPallets = useMemo(() => {
    const keys = new Set<string>();
    entries.forEach((e: any) => {
      const p = e.currentLocation || 'Unassigned';
      const loc = e.location || 'Unassigned';
      keys.add(`${p}|${loc}`);
    });
    return Array.from(keys).sort((a, b) => {
      const [palA, locA] = a.split('|');
      const [palB, locB] = b.split('|');
      if (palA === palB) {
        return locA.localeCompare(locB);
      }
      return palA.localeCompare(palB);
    });
  }, [entries]);
  const allLocations = Array.from(new Set(entries.map((e: any) => e.location || 'Unassigned').filter(Boolean) as string[])).sort();
  const allBoxes = Array.from(new Set(entries.map((e: any) => ((e.box || '').trim() || 'Unassigned-Box')))).sort(compareBoxLabels) as string[];
  const allSerials = Array.from(new Set(entries.map((e: any) => e.serial || '-'))).sort() as string[];
  const allLots = Array.from(new Set(entries.map((e: any) => e.lot || '-'))).sort() as string[];
  const allPackDates = Array.from(new Set(entries.map((e: any) => e.packDate || '-'))).sort() as string[];
  const getMoveToName = (idOrName: string, specificOrder?: any) => {
    if (!idOrName || idOrName === 'Staying put') return 'Staying put';
    if (idOrName === '__conflicted__') return '⚠️ Conflicted (Multiple Orders)';
    if (specificOrder?.targetDestinations) {
      const dest = specificOrder.targetDestinations.find((d: any) => d.id === idOrName);
      if (dest) {
        return dest.palletName ? `${dest.palletName} - ${dest.locationName}` : dest.locationName;
      }
    }
    if (activeOrder && activeOrder.targetDestinations) {
      const dest = activeOrder.targetDestinations.find((d: any) => d.id === idOrName);
      if (dest) {
        return dest.palletName ? `${dest.palletName} - ${dest.locationName}` : dest.locationName;
      }
    }
    for (const ord of activeOrders) {
      if (ord.targetDestinations) {
        const dest = ord.targetDestinations.find((d: any) => d.id === idOrName);
        if (dest) {
          return dest.palletName ? `${dest.palletName} - ${dest.locationName}` : dest.locationName;
        }
      }
    }
    const loc = state.locations?.find((l: any) => l.id === idOrName);
    if (loc) return loc.name;
    const pal = state.pallets?.find((p: any) => p.id === idOrName);
    if (pal) return pal.name;
    return idOrName;
  };

  // Multi-Order Movement & Cross-Order Conflict Management Engine
  const openOrdersMovementData = useMemo(() => {
    // 1. Map entryId -> list of movements across all open orders
    const entryOrderMoves = new Map<string, {
      orderId: string;
      orderName: string;
      orderStatus: string;
      targetLocation: string;
      destName: string;
      isCurrentOrder: boolean;
    }[]>();

    // 2. Map boxId -> list of order assignments
    const boxOrderAssignments = new Map<string, {
      orderId: string;
      orderName: string;
      orderStatus: string;
      isCurrentOrder: boolean;
      destinations: {
        destId: string;
        destName: string;
        cutsCount: number;
        weight: number;
        pieces: number;
      }[];
      totalCuts: number;
      totalWeight: number;
      totalPieces: number;
    }[]>();

    const conflictedBoxIds = new Set<string>();
    const conflictedEntryIds = new Set<string>();

    // Build entryOrderMoves across all planning and finalized orders
    activeOrders.forEach((ord: any) => {
      const isCurrentOrder = Boolean(activeOrder && activeOrder.id === ord.id);
      (ord.moves || []).forEach((m: any) => {
        if (!m.entryId || !m.targetLocation) return;
        if (!entryOrderMoves.has(m.entryId)) {
          entryOrderMoves.set(m.entryId, []);
        }
        const destName = getMoveToName(m.targetLocation, ord);
        entryOrderMoves.get(m.entryId)!.push({
          orderId: ord.id,
          orderName: ord.name || 'Unnamed Order',
          orderStatus: ord.status,
          targetLocation: m.targetLocation,
          destName,
          isCurrentOrder
        });
      });
    });

    // Detect entries assigned in multiple open orders
    entryOrderMoves.forEach((movesList, entryId) => {
      if (movesList.length > 1) {
        conflictedEntryIds.add(entryId);
      }
    });

    // Group by box to track full box movements & multi-order assignments
    const boxToEntries = new Map<string, any[]>();
    entries.forEach((e: any) => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      if (!boxToEntries.has(bId)) {
        boxToEntries.set(bId, []);
      }
      boxToEntries.get(bId)!.push(e);
    });

    boxToEntries.forEach((bEntries, bId) => {
      const orderGroupsMap = new Map<string, {
        orderId: string;
        orderName: string;
        orderStatus: string;
        isCurrentOrder: boolean;
        destMap: Map<string, { destId: string; destName: string; cutsCount: number; weight: number; pieces: number }>;
        totalCuts: number;
        totalWeight: number;
        totalPieces: number;
      }>();

      bEntries.forEach((item: any) => {
        const itemMoves = entryOrderMoves.get(item.id) || [];
        itemMoves.forEach(mv => {
          if (!orderGroupsMap.has(mv.orderId)) {
            orderGroupsMap.set(mv.orderId, {
              orderId: mv.orderId,
              orderName: mv.orderName,
              orderStatus: mv.orderStatus,
              isCurrentOrder: mv.isCurrentOrder,
              destMap: new Map(),
              totalCuts: 0,
              totalWeight: 0,
              totalPieces: 0
            });
          }
          const ordGrp = orderGroupsMap.get(mv.orderId)!;
          ordGrp.totalCuts += 1;
          ordGrp.totalWeight += (item.netWeight || 0);
          ordGrp.totalPieces += (item.pieces || 0);

          if (!ordGrp.destMap.has(mv.targetLocation)) {
            ordGrp.destMap.set(mv.targetLocation, {
              destId: mv.targetLocation,
              destName: mv.destName,
              cutsCount: 0,
              weight: 0,
              pieces: 0
            });
          }
          const dEntry = ordGrp.destMap.get(mv.targetLocation)!;
          dEntry.cutsCount += 1;
          dEntry.weight += (item.netWeight || 0);
          dEntry.pieces += (item.pieces || 0);
        });
      });

      if (orderGroupsMap.size > 0) {
        const assignments = Array.from(orderGroupsMap.values()).map(og => ({
          orderId: og.orderId,
          orderName: og.orderName,
          orderStatus: og.orderStatus,
          isCurrentOrder: og.isCurrentOrder,
          destinations: Array.from(og.destMap.values()),
          totalCuts: og.totalCuts,
          totalWeight: og.totalWeight,
          totalPieces: og.totalPieces
        }));

        boxOrderAssignments.set(bId, assignments);

        // If more than 1 open order is moving items from this box, OR if any item inside has conflicts
        if (assignments.length > 1 || bEntries.some((it: any) => conflictedEntryIds.has(it.id))) {
          conflictedBoxIds.add(bId);
        }
      }
    });

    return {
      entryOrderMoves,
      boxOrderAssignments,
      conflictedBoxIds,
      conflictedEntryIds
    };
  }, [activeOrders, activeOrder, entries, state.products, state.locations, state.pallets]);

  const allMoveTo = useMemo(() => {
    const set = new Set<string>(['']);
    if (openOrdersMovementData.conflictedBoxIds.size > 0) {
      set.add('__conflicted__');
    }
    // Collect all destinations across all open orders
    activeOrders.forEach((ord: any) => {
      (ord.targetDestinations || []).forEach((d: any) => {
        if (d.id) set.add(d.id);
      });
      (ord.moves || []).forEach((m: any) => {
        if (m.targetLocation) set.add(m.targetLocation);
      });
    });

    return Array.from(set).sort((a, b) => {
      if (a === '') return -1;
      if (b === '') return 1;
      if (a === '__conflicted__') return -1;
      if (b === '__conflicted__') return 1;
      return getMoveToName(a).localeCompare(getMoveToName(b));
    });
  }, [activeOrders, entries, openOrdersMovementData.conflictedBoxIds]);

  const renderFilterDropdown = (
    type: string,
    allOptions: string[],
    selectedSet: Set<string>,
    setSelectedSet: React.Dispatch<React.SetStateAction<Set<string>>>,
    searchVal: string,
    setSearchVal: (v: string) => void
  ) => {
    const getColumnTitle = () => {
      switch (type) {
        case 'box': return 'Box Number';
        case 'cuts': return 'Product / Cut';
        case 'locations': return 'Location';
        case 'pallets': return 'Pallet';
        case 'moveTo': return 'Move Destination';
        case 'serial': return 'Box Serial';
        case 'lot': return 'Lot Number';
        case 'packDate': return 'Pack Date';
        default: return type;
      }
    };

    const getOptionDisplayName = (opt: string) => {
      if (type === 'moveTo') return getMoveToName(opt);
      if (type === 'pallets') {
        if (!opt.includes('|')) return opt;
        const [pallet, location] = opt.split('|');
        return `${pallet} (${location})`;
      }
      return opt;
    };

    const filteredOptions = allOptions.filter(opt => {
      const display = getOptionDisplayName(opt);
      return display.toLowerCase().includes(searchVal.toLowerCase());
    });

    const columnTitle = getColumnTitle();

    const modalContent = (
      <>
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs" onClick={(e) => { e.stopPropagation(); setOpenFilter(null); }}></div>
        <div 
          id={`offsite-column-filter-${type}`}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-cool-gray-800 border border-cool-gray-700 rounded-2xl p-4 z-[130] w-80 sm:w-96 md:w-[440px] shadow-2xl space-y-3 flex flex-col max-h-[85vh] text-left font-normal max-w-[95vw] animate-scale-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between pb-2 border-b border-cool-gray-750 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                <Filter size={14} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white leading-tight">Filter by {columnTitle}</h3>
                <span className="text-[10px] text-cool-gray-400 font-mono">
                  {filteredOptions.length} of {allOptions.length} options available
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenFilter(null); }}
              className="p-1.5 rounded-lg text-cool-gray-400 hover:text-white hover:bg-cool-gray-700 transition cursor-pointer"
              title="Close filter"
            >
              <X size={15} />
            </button>
          </div>

          {/* Search Input */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-2.5 text-cool-gray-400" size={14} />
            <input
              type="text"
              placeholder={`Search ${columnTitle.toLowerCase()}...`}
              className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-cool-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/60"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            {searchVal && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSearchVal(''); }}
                className="absolute right-2.5 top-2.5 text-cool-gray-400 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {type === 'moveTo' && (
            <div className="space-y-1.5 shrink-0">
              <div className="bg-cool-gray-900/50 p-2.5 rounded-xl border border-cool-gray-750 flex items-center justify-between gap-2 select-none">
                <span className="text-xs font-semibold text-cool-gray-300">⚠️ Only Split Boxes</span>
                <input
                  type="checkbox"
                  className="rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4"
                  checked={filterOnlySplitBoxes}
                  onChange={(e) => setFilterOnlySplitBoxes(e.target.checked)}
                />
              </div>
              <div className="bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/60 flex items-center justify-between gap-2 select-none">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <span>Only Conflicted Boxes</span>
                </span>
                <input
                  type="checkbox"
                  className="rounded bg-cool-gray-950 border-amber-700 text-amber-400 focus:ring-amber-500/50 cursor-pointer w-4 h-4"
                  checked={filterOnlyConflicts}
                  onChange={(e) => setFilterOnlyConflicts(e.target.checked)}
                />
              </div>
            </div>
          )}

          {/* Quick Bulk Actions */}
          <div className="flex justify-between items-center text-xs text-cool-gray-400 font-bold px-1 border-b border-cool-gray-750 pb-2 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="hover:text-emerald-400 transition-colors cursor-pointer text-[11px]"
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = new Set(selectedSet);
                  filteredOptions.forEach(o => updated.add(o));
                  setSelectedSet(updated);
                }}
              >
                Select All ({filteredOptions.length})
              </button>
              <span className="text-cool-gray-600">•</span>
              <button
                type="button"
                className="hover:text-rose-400 transition-colors cursor-pointer text-[11px]"
                onClick={(e) => {
                  e.stopPropagation();
                  const updated = new Set<string>();
                  setSelectedSet(updated);
                }}
              >
                Clear Filter
              </button>
            </div>
            {selectedSet.size > 0 && (
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono">
                {selectedSet.size} active
              </span>
            )}
          </div>

          {/* Expanded Scrollable Options Container */}
          <div className="overflow-y-auto max-h-72 sm:max-h-96 space-y-1 pr-1.5 divide-y divide-cool-gray-750/30 overscroll-contain">
            {filteredOptions.map(opt => {
              const isChecked = selectedSet.has(opt);
              const displayName = getOptionDisplayName(opt);

              return (
                <label
                  key={opt}
                  className={`flex items-center gap-2.5 px-2.5 py-2 hover:bg-cool-gray-750/80 rounded-lg cursor-pointer text-xs select-none first:pt-1 text-white transition-colors ${
                    isChecked ? 'bg-cool-gray-750/40 font-semibold text-emerald-300' : ''
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    className="rounded bg-cool-gray-950 border-cool-gray-700 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer w-4 h-4 shrink-0"
                    checked={isChecked}
                    onChange={() => {
                      const next = new Set(selectedSet);
                      if (next.has(opt)) next.delete(opt);
                      else next.add(opt);
                      setSelectedSet(next);
                    }}
                  />
                  <span className="truncate" title={displayName}>{displayName}</span>
                </label>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="text-center text-xs text-cool-gray-400 italic py-8">
                No matching options found
              </div>
            )}
          </div>

          {/* Footer with Summary and Close Button */}
          <div className="pt-2.5 border-t border-cool-gray-750 flex justify-between gap-2 items-center shrink-0">
            <div className="text-[11px] text-cool-gray-400">
              {selectedSet.size === 0 ? (
                <span className="text-cool-gray-500">Showing all</span>
              ) : (
                <span className="text-emerald-400 font-medium">{selectedSet.size} selected</span>
              )}
            </div>
            <button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-md active:scale-95"
              onClick={(e) => {
                e.stopPropagation();
                setOpenFilter(null);
              }}
            >
              Apply & Close
            </button>
          </div>
        </div>
      </>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
  };

  const splitBoxIds = useMemo(() => {
    const boxDestinations: Record<string, Set<string>> = {};
    entries.forEach(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      if (!boxDestinations[bId]) boxDestinations[bId] = new Set();
      
      let mt = '';
      if (activeOrder) {
        const m = activeOrder.moves.find((mv: any) => mv.entryId === e.id);
        if (m && m.targetLocation) mt = m.targetLocation;
      }
      boxDestinations[bId].add(mt);
    });
    
    const splitSet = new Set<string>();
    for (const bId in boxDestinations) {
      if (boxDestinations[bId].size > 1) {
        splitSet.add(bId);
      }
    }
    return splitSet;
  }, [entries, activeOrder]);

  const boxToAllEntriesMap = useMemo(() => {
    const map: Record<string, typeof entries> = {};
    entries.forEach(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      if (!map[bId]) map[bId] = [];
      map[bId].push(e);
    });
    return map;
  }, [entries]);

  // Filtered entries tracking for CSV exports
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      if (filterOnlySplitBoxes && !splitBoxIds.has(bId)) return false;
      if (filterOnlyConflicts && !openOrdersMovementData.conflictedBoxIds.has(bId) && !openOrdersMovementData.conflictedEntryIds.has(e.id)) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesCuts = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').toLowerCase().includes(term);
        const matchesOriginalCut = (e.originalCutName || '').toLowerCase().includes(term);
        const matchesBox = (e.box || '').toLowerCase().includes(term);
        const matchesPallet = (e.currentLocation || '').toLowerCase().includes(term);
        const matchesLocation = (e.location || '').toLowerCase().includes(term);

        let mt = '';
        if (activeOrder) {
          const m = activeOrder.moves.find((mv: any) => mv.entryId === e.id);
          if (m && m.targetLocation) mt = m.targetLocation;
        }
        const moveToName = getMoveToName(mt);
        const matchesMoveTo = (moveToName || '').toLowerCase().includes(term);

        // Check other open orders for search match
        const otherMoves = (openOrdersMovementData.entryOrderMoves.get(e.id) || []);
        const matchesOtherOrders = otherMoves.some(om => 
          om.orderName.toLowerCase().includes(term) || om.destName.toLowerCase().includes(term)
        );

        if (!matchesCuts && !matchesOriginalCut && !matchesBox && !matchesPallet && !matchesLocation && !matchesMoveTo && !matchesOtherOrders) {
          return false;
        }
      }
      const cutToCheck = (viewOriginalNames && e.originalCutName) ? e.originalCutName : ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '');
      if (filterCuts.size > 0 && !filterCuts.has(cutToCheck)) return false;
      if (filterPrimaryCategories.size > 0 && !filterPrimaryCategories.has(e.primaryCategory || 'Off-Site / Uncategorized')) return false;
      if (filterSubCategories.size > 0 && !filterSubCategories.has(e.subCategory || 'Off-Site / Uncategorized')) return false;
      if (filterPallets.size > 0) {
        const palletName = e.currentLocation || 'Unassigned';
        const locationName = e.location || 'Unassigned';
        const palletKey = `${palletName}|${locationName}`;
        if (!filterPallets.has(palletKey) && !filterPallets.has(e.currentLocation || '')) return false;
      }
      if (filterLocations.size > 0 && !filterLocations.has(e.location || 'Unassigned')) return false;
      if (filterBoxes.size > 0 && !filterBoxes.has((e.box || '').trim() || 'Unassigned-Box')) return false;
      if (filterSerials.size > 0 && !filterSerials.has(e.serial || '-')) return false;
      if (filterLots.size > 0 && !filterLots.has(e.lot || '-')) return false;
      if (filterPackDates.size > 0 && !filterPackDates.has(e.packDate || '-')) return false;
      if (filterTags.size > 0 && !(e.tagIds || []).some(t => filterTags.has(t))) return false;
      if (filterLists.size > 0 && !(e.matchedProduct && (state.customLists || []).filter(l => filterLists.has(l.id)).some(l => l.items.some(item => item.productId === e.matchedProduct.id)))) return false;
      if (filterMoveTo.size > 0) {
        let isMatch = false;
        if (filterMoveTo.has('__conflicted__') && (openOrdersMovementData.conflictedBoxIds.has(bId) || openOrdersMovementData.conflictedEntryIds.has(e.id))) {
          isMatch = true;
        }
        if (!isMatch) {
          if (activeOrder) {
            const m = activeOrder.moves.find((mv: any) => mv.entryId === e.id);
            const mt = (m && m.targetLocation) ? m.targetLocation : '';
            if (filterMoveTo.has(mt)) isMatch = true;
          } else {
            const entryMoves = openOrdersMovementData.entryOrderMoves.get(e.id);
            if (entryMoves && entryMoves.length > 0) {
              if (entryMoves.some(mv => filterMoveTo.has(mv.targetLocation))) isMatch = true;
            }
          }
        }
        if (!isMatch) return false;
      }
      if (breakdownSearch && !(state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName)?.toLowerCase().includes(breakdownSearch.toLowerCase()) && !(e.originalCutName?.toLowerCase() || '').includes(breakdownSearch.toLowerCase())) return false;
      if (breakdownCategory && breakdownCategory !== 'All') {
        const cat = getProductCategoryForCut((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '');
        if (cat !== breakdownCategory) return false;
      }
      return true;
    });
  }, [entries, searchTerm, filterCuts, filterPrimaryCategories, filterSubCategories, filterPallets, filterLocations, filterBoxes, filterSerials, filterLots, filterPackDates, filterMoveTo, filterTags, filterLists, activeOrder, breakdownSearch, breakdownCategory, products, viewOriginalNames, state.customLists, filterOnlySplitBoxes, splitBoxIds, filterOnlyConflicts, openOrdersMovementData]);

  // Propagate filtered entries up to the parent component for exports
  useEffect(() => {
    if (onFilteredEntriesChange) {
      onFilteredEntriesChange(filteredEntries);
    }
  }, [filteredEntries, onFilteredEntriesChange]);

  // Condensed View Grouping
  const condensed = useMemo(() => {
    const filtered = filteredEntries;

    const groups: Record<string, {
      boxId: string;
      items: typeof entries;
      cuts: Set<string>;
      pallets: Set<string>;
      locations: Set<string>;
      moveTo: Set<string>;
      totalWeight: number;
      totalPieces: number;
    }> = {};

    filtered.forEach(e => {
      const bId = (e.box || '').trim() || 'Unassigned-Box';
      const groupId = viewUngrouped ? e.id : bId;
      if (!groups[groupId]) {
        groups[groupId] = {
          boxId: bId,
          items: [],
          cuts: new Set(),
          pallets: new Set(),
          locations: new Set(),
          moveTo: new Set(),
          totalWeight: 0,
          totalPieces: 0
        };
      }
      groups[groupId].items.push(e);
      const cutToUse = (viewOriginalNames && e.originalCutName) ? e.originalCutName : ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '');
      if (cutToUse) groups[groupId].cuts.add(cutToUse);
      if (e.currentLocation) groups[groupId].pallets.add(e.currentLocation);
      groups[groupId].locations.add(e.location || 'Unassigned');
      if (activeOrder) {
        const m = activeOrder.moves.find((mv: any) => mv.entryId === e.id);
        groups[groupId].moveTo.add(m?.targetLocation || '');
      } else {
        const entryMoves = openOrdersMovementData.entryOrderMoves.get(e.id);
        if (entryMoves && entryMoves.length > 0) {
          entryMoves.forEach(mv => groups[groupId].moveTo.add(mv.targetLocation));
        }
      }
      groups[groupId].totalWeight += (e.netWeight || 0);
      groups[groupId].totalPieces += (e.pieces || 0);
    });

    let list = Object.values(groups);

    // Sort
    list.sort((a, b) => {
      let valA, valB;
      if (sortField === 'box') {
        const cmp = compareBoxLabels(a.boxId, b.boxId);
        return sortAsc ? cmp : -cmp;
      }
      else if (sortField === 'weight') { valA = a.totalWeight; valB = b.totalWeight; }
      else if (sortField === 'pieces') { valA = a.totalPieces; valB = b.totalPieces; }
      else if (sortField === 'primaryCategory') {
        valA = a.items[0]?.primaryCategory || 'Off-Site / Uncategorized';
        valB = b.items[0]?.primaryCategory || 'Off-Site / Uncategorized';
      }
      else if (sortField === 'subCategory') {
        valA = a.items[0]?.subCategory || 'Off-Site / Uncategorized';
        valB = b.items[0]?.subCategory || 'Off-Site / Uncategorized';
      }
      else if (sortField === 'serial') { valA = a.items[0]?.serial || ''; valB = b.items[0]?.serial || ''; }
      else if (sortField === 'lot') { valA = a.items[0]?.lot || ''; valB = b.items[0]?.lot || ''; }
      else if (sortField === 'packDate') { valA = a.items[0]?.packDate || ''; valB = b.items[0]?.packDate || ''; }
      else {
        const cmp = compareBoxLabels(a.boxId, b.boxId);
        return sortAsc ? cmp : -cmp;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
    });

    return list;
  }, [filteredEntries, activeOrder, sortField, sortAsc, viewOriginalNames, viewUngrouped]);

  // Keyboard shortcut: Ctrl + A / Cmd + A to select all items in the filtered view
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        const target = e.target as HTMLElement | null;
        if (
          target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
          )
        ) {
          return;
        }

        e.preventDefault();
        if (condensed.length > 0) {
          const boxIds = condensed.map(g => viewUngrouped ? g.items[0].id : g.boxId);
          const itemIds = filteredEntries.map(e => e.id);
          setSelectedBoxIds(new Set(boxIds));
          setSelectedItemIds(new Set(itemIds));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [condensed, filteredEntries, viewUngrouped]);

  const spreadsheetSummary = useMemo(() => {
    const itemMap: Record<string, {
      cutName: string;
      boxCount: Set<string>;
      pallets: Set<string>;
      totalWeight: number;
      totalPieces: number;
    }> = {};

    let totalWeight = 0;
    let totalPieces = 0;
    const totalBoxes = new Set<string>();

    condensed.forEach(group => {
      totalBoxes.add(group.boxId);
      group.items.forEach(item => {
        const cut = (viewOriginalNames && item.originalCutName) ? item.originalCutName : (item.cuts || 'Unknown Product');
        if (!itemMap[cut]) {
          itemMap[cut] = {
            cutName: cut,
            boxCount: new Set<string>(),
            pallets: new Set<string>(),
            totalWeight: 0,
            totalPieces: 0
          };
        }
        itemMap[cut].boxCount.add(group.boxId);
        if (item.currentLocation) {
          itemMap[cut].pallets.add(item.currentLocation);
        }
        itemMap[cut].totalWeight += (item.netWeight || 0);
        itemMap[cut].totalPieces += (item.pieces || 0);
        totalWeight += (item.netWeight || 0);
        totalPieces += (item.pieces || 0);
      });
    });

    const itemsList = Object.values(itemMap);

    itemsList.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      if (breakdownSortField === 'name') {
        valA = a.cutName;
        valB = b.cutName;
      } else if (breakdownSortField === 'category') {
        valA = getProductCategoryForCut(a.cutName);
        valB = getProductCategoryForCut(b.cutName);
        if (valA === valB) {
          return a.cutName.localeCompare(b.cutName);
        }
      } else if (breakdownSortField === 'pallet') {
        valA = Array.from(a.pallets).sort().join(', ');
        valB = Array.from(b.pallets).sort().join(', ');
        if (valA === valB) {
          return a.cutName.localeCompare(b.cutName);
        }
      } else if (breakdownSortField === 'boxes') {
        valA = a.boxCount.size;
        valB = b.boxCount.size;
      } else if (breakdownSortField === 'pieces') {
        valA = a.totalPieces;
        valB = b.totalPieces;
      } else { // 'weight'
        valA = a.totalWeight;
        valB = b.totalWeight;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return breakdownSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return breakdownSortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      }
    });

    return {
      totalBoxes: totalBoxes.size,
      totalWeight,
      totalPieces,
      itemsBreakdown: itemsList
    };
  }, [condensed, breakdownSortField, breakdownSortAsc, products, viewOriginalNames]);

  const selectedItemsSummary = useMemo(() => {
    const seenIds = new Set<string>();
    const items: any[] = [];
    
    if (viewUngrouped) {
      // In ungrouped mode, selectedBoxIds contains item IDs directly
      rawEntries.filter((e: any) => selectedBoxIds.has(e.id)).forEach(item => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          items.push(item);
        }
      });
    } else {
      // Get all items in the selected boxes
      const selectedBoxesList = condensed.filter(g => selectedBoxIds.has(g.boxId));
      const boxItems = selectedBoxesList.flatMap(g => g.items);
      
      // Get all selected individual items
      const individualItems = rawEntries.filter((e: any) => selectedItemIds.has(e.id));
      
      [...boxItems, ...individualItems].forEach(item => {
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          items.push(item);
        }
      });
    }

    const totalWeight = items.reduce((sum, item) => sum + (item.netWeight || 0), 0);
    const totalPieces = items.reduce((sum, item) => sum + (item.pieces || 0), 0);
    const boxCount = viewUngrouped ? 0 : selectedBoxIds.size;
    const itemsCount = items.length;

    // Summary of cuts and how many of each
    const cutSummaryMap = new Map<string, { weight: number, count: number, pieces: number }>();
    items.forEach(item => {
      const cutName = (viewOriginalNames && item.originalCutName) 
        ? item.originalCutName 
        : ((state.products?.find((p: any) => p.id === item.productId)?.name || item.originalCutName) || 'Unknown Cut');
      
      let existing = cutSummaryMap.get(cutName);
      if (!existing) {
        existing = { weight: 0, count: 0, pieces: 0 };
        cutSummaryMap.set(cutName, existing);
      }
      existing.weight += item.netWeight || 0;
      existing.pieces += item.pieces || 0;
      existing.count += 1;
    });

    const cuts = Array.from(cutSummaryMap.entries()).map(([name, data]) => ({
      name,
      ...data
    })).sort((a, b) => b.weight - a.weight);

    return {
      items,
      totalWeight,
      totalPieces,
      boxCount,
      itemsCount,
      cuts
    };
  }, [selectedBoxIds, selectedItemIds, viewUngrouped, rawEntries, condensed, viewOriginalNames, state.products]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const toggleFilter = (set: Set<string>, val: string, updateFn: any) => {
    const newSet = new Set(set);
    if (newSet.has(val)) newSet.delete(val);
    else newSet.add(val);
    updateFn(newSet);
  };

  return (
    <div className="space-y-4" id="offsite-spreadsheet-workspace">
      {/* Click-outside backdrop to dismiss column filters, flag selectors, & export dropdown */}
      {(openFilter || openFlagSelectorId || isExportDropdownOpen) && (
        <div 
          className="fixed inset-0 z-45 bg-transparent" 
          onClick={() => {
            setOpenFilter(null);
            setOpenFlagSelectorId(null);
            setIsExportDropdownOpen(false);
          }} 
        />
      )}

      {/* Worksheet Header & Export Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-cool-gray-800 p-4 rounded-xl border border-cool-gray-750 gap-4 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-cyan-400">📋</span>
            Unified Worksheet Spreadsheet
          </h3>
          <p className="text-xs text-cool-gray-400 mt-0.5">
            View, edit, filter, and export the entire off-site storage database.
          </p>
        </div>
        
        {/* Export Dropdown Anchor */}
        <div className="relative w-full sm:w-auto">
          <button
            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
            className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer select-none"
          >
            <Download size={14} />
            <span>Export Spreadsheet</span>
            <ChevronDown size={12} className={`transition-transform ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isExportDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-cool-gray-900 border border-cool-gray-700 rounded-xl shadow-2xl py-2 z-50 animate-scale-up text-xs">
              <div className="px-3 py-1.5 text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider border-b border-cool-gray-800/80 mb-1">
                Select Export Type
              </div>
              
              <button
                onClick={() => {
                  setIsExportDropdownOpen(false);
                  downloadCSVForEntries(filteredEntries, 'offsite_filtered_export');
                }}
                className="flex flex-col w-full px-4 py-2.5 text-left transition hover:bg-cyan-950/40 text-cool-gray-200 hover:text-white cursor-pointer select-none group border-b border-cool-gray-850"
              >
                <span className="font-bold flex items-center gap-1.5 text-cyan-400">
                  <span>🎯</span> Export Active Filtered View
                </span>
                <span className="text-[10px] text-cool-gray-400 mt-1 pl-5">
                  Save {filteredEntries.length} items matching your active search, list, tag, or column filters.
                </span>
              </button>
              
              <button
                onClick={() => {
                  setIsExportDropdownOpen(false);
                  downloadCSVForEntries(mappedRawEntries, 'offsite_full_export');
                }}
                className="flex flex-col w-full px-4 py-2.5 text-left transition hover:bg-cyan-950/40 text-cool-gray-200 hover:text-white cursor-pointer select-none group"
              >
                <span className="font-bold flex items-center gap-1.5 text-emerald-400">
                  <span>🌐</span> Export Entire Database
                </span>
                <span className="text-[10px] text-cool-gray-400 mt-1 pl-5">
                  Save all {mappedRawEntries.length} active off-site entries (excluding archived and historical items).
                </span>
              </button>
            </div>
          )}
        </div>
      </div>




      {/* Spreadsheet Summary & Item Breakdown Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-cool-gray-800/40 p-5 rounded-2xl border border-cool-gray-750">
        <div className="bg-cool-gray-900/60 p-4 rounded-xl border border-cool-gray-800 flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Spreadsheet Total Boxes</span>
            <div className="flex items-center gap-3">
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
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white">
              {simulateBoxCount 
                ? `~${(spreadsheetSummary.totalWeight / theoreticalBoxWeight).toFixed(1)}` 
                : spreadsheetSummary.totalBoxes}
            </span>
            <span className="text-xs text-cool-gray-400">
              {simulateBoxCount ? `est. boxes (${theoreticalBoxWeight} lbs each)` : "boxes matching filters"}
            </span>
          </div>
        </div>
        <div className="bg-cool-gray-900/60 p-4 rounded-xl border border-cool-gray-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Spreadsheet Total Weight</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-400">{spreadsheetSummary.totalWeight.toFixed(2)}</span>
            <span className="text-xs text-cool-gray-400">lbs</span>
          </div>
        </div>
        <div className="bg-cool-gray-900/60 p-4 rounded-xl border border-cool-gray-800 flex flex-col justify-between">
          <span className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider">Spreadsheet Total Pieces</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-blue-400">{spreadsheetSummary.totalPieces}</span>
            <span className="text-xs text-cool-gray-400">pcs</span>
          </div>
        </div>
      </div>

      <div className="bg-cool-gray-800/25 border border-cool-gray-750/70 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex justify-between items-center cursor-pointer select-none" onClick={() => setShowItemBreakdown(!showItemBreakdown)}>
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 text-base">📊</span>
            <div>
              <h4 className="font-bold text-white text-sm">Spreadsheet Itemized Inventory Breakdown</h4>
              <p className="text-xs text-cool-gray-400 font-medium">Click to collapse/expand breakdown of the filtered spreadsheet list by item</p>
            </div>
          </div>
          <button className="text-xs text-emerald-450 hover:text-emerald-350 bg-emerald-950/40 hover:bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-all font-bold flex items-center gap-1 shadow-sm">
            {showItemBreakdown ? 'Hide Item Breakdown' : 'Show Item Breakdown'}
          </button>
        </div>
        
        {showItemBreakdown && (
          <div className="space-y-3 pt-2 animate-fade-in">
            {/* Informative Help Tip */}
            <div className="flex justify-end p-1">
              <div className="text-[11px] text-cool-gray-400 flex items-center gap-1 font-medium select-none">
                <span>💡 Tip: Click column headers below to sort list</span>
              </div>
            </div>

            <div className="overflow-auto max-h-96 rounded-xl border border-cool-gray-750/60">
              <table className="w-full text-left text-xs whitespace-nowrap border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-cool-gray-850">
                  <tr className="text-cool-gray-400 font-bold border-b border-cool-gray-750/60 bg-cool-gray-850 select-none">
                    <th 
                      className="sticky top-0 bg-cool-gray-850 z-10 border-b border-cool-gray-750/60 py-2.5 px-3 cursor-pointer hover:text-white transition-colors group"
                      onClick={() => toggleBreakdownSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Item / Cut Name</span>
                        <span className="text-cool-gray-500 group-hover:text-cool-gray-300 text-[10px]">
                          {breakdownSortField === 'name' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="sticky top-0 bg-cool-gray-850 z-10 border-b border-cool-gray-750/60 py-2.5 px-3 cursor-pointer hover:text-white transition-colors group"
                      onClick={() => toggleBreakdownSort('category')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Category</span>
                        <span className="text-cool-gray-500 group-hover:text-cool-gray-300 text-[10px]">
                          {breakdownSortField === 'category' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="sticky top-0 bg-cool-gray-850 z-10 border-b border-cool-gray-750/60 py-2.5 px-3 cursor-pointer hover:text-white transition-colors group"
                      onClick={() => toggleBreakdownSort('pallet')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Pallet</span>
                        <span className="text-cool-gray-500 group-hover:text-cool-gray-300 text-[10px]">
                          {breakdownSortField === 'pallet' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="sticky top-0 bg-cool-gray-850 z-10 border-b border-cool-gray-750/60 py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors group"
                      onClick={() => toggleBreakdownSort('boxes')}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <span>Boxes Count</span>
                        <span className="text-cool-gray-500 group-hover:text-cool-gray-300 text-[10px]">
                          {breakdownSortField === 'boxes' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="sticky top-0 bg-cool-gray-850 z-10 border-b border-cool-gray-750/60 py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors group"
                      onClick={() => toggleBreakdownSort('weight')}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <span>Total Net Weight</span>
                        <span className="text-cool-gray-500 group-hover:text-cool-gray-300 text-[10px]">
                          {breakdownSortField === 'weight' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                    <th 
                      className="sticky top-0 bg-cool-gray-850 z-10 border-b border-cool-gray-750/60 py-2.5 px-3 text-right cursor-pointer hover:text-white transition-colors group"
                      onClick={() => toggleBreakdownSort('pieces')}
                    >
                      <div className="flex items-center gap-1 justify-end">
                        <span>Total Pieces</span>
                        <span className="text-cool-gray-500 group-hover:text-cool-gray-300 text-[10px]">
                          {breakdownSortField === 'pieces' ? (breakdownSortAsc ? '↑' : '↓') : '↕'}
                        </span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cool-gray-750/40 text-cool-gray-300">
                  {spreadsheetSummary.itemsBreakdown.map((item, idx) => {
                    const category = getProductCategoryForCut(item.cutName);
                    return (
                      <tr key={`${item.cutName}-${idx}`} className="hover:bg-cool-gray-800/30 transition-colors">
                        <td className="py-2.5 px-3 font-medium">
                          <button
                            type="button"
                            onClick={() => setQuickInfoItem({ cuts: item.cutName })}
                            className="text-left font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer select-none transition-colors duration-150"
                            title="Click for Product Quick Info & Lists"
                          >
                            {item.cutName}
                          </button>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                            category === 'Off-Site / Uncategorized'
                              ? 'bg-cool-gray-800/40 text-cool-gray-400 border border-cool-gray-700/30'
                              : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                          }`}>
                            {category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {Array.from(item.pallets).length > 0 ? (
                              Array.from(item.pallets).sort().map((p, i) => (
                                <span key={i} className="bg-cool-gray-800 text-cool-gray-300 px-1.5 py-0.5 rounded text-[10px] border border-cool-gray-750 font-medium">
                                  {p}
                                </span>
                              ))
                            ) : (
                              <span className="text-cool-gray-500 italic text-[11px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-cool-gray-100">{item.boxCount.size}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">{item.totalWeight.toFixed(2)} lbs</td>
                        <td className="py-2.5 px-3 text-right font-mono text-blue-400">{item.totalPieces} pcs</td>
                      </tr>
                    );
                  })}
                  {spreadsheetSummary.itemsBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-cool-gray-500 italic font-medium">
                        No matching items found in breakdown
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Conflict Management Alert Banner */}
      {openOrdersMovementData.conflictedBoxIds.size > 0 && (
        <div className="mb-4 bg-amber-950/50 border-2 border-amber-600/80 rounded-2xl p-3.5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-200 backdrop-blur-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="text-sm font-black text-amber-300 flex items-center gap-2">
                <span>Movement Conflicts Detected!</span>
                <span className="text-[10px] bg-amber-500/30 text-amber-200 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold uppercase">
                  {openOrdersMovementData.conflictedBoxIds.size} {openOrdersMovementData.conflictedBoxIds.size === 1 ? 'Box' : 'Boxes'}
                </span>
              </div>
              <p className="text-xs text-amber-300/80 mt-0.5 leading-relaxed">
                Items or boxes are currently assigned to multiple open movement orders at once. Look for the highlighted <span className="font-bold text-amber-200">⚠️ Conflict</span> tags in the spreadsheet below.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setFilterOnlyConflicts(!filterOnlyConflicts)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center gap-1.5 ${
                filterOnlyConflicts
                  ? 'bg-amber-500 text-cool-gray-950 border-amber-400 shadow-md shadow-amber-950/40'
                  : 'bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 border-amber-700/60'
              }`}
            >
              <AlertTriangle size={13} />
              <span>{filterOnlyConflicts ? 'Showing Conflicted Only' : 'Isolate Conflicted Boxes'}</span>
            </button>
            {filterOnlyConflicts && (
              <button
                onClick={() => setFilterOnlyConflicts(false)}
                className="text-xs text-cool-gray-400 hover:text-white px-2 py-1 font-semibold transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Top Bar */}
      {isDirectEdit && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => {
              setIsAddModalOpen(true);
              setNewItemForm({
                cuts: '',
                box: '',
                serial: '',
                netWeight: '',
                pieces: '',
                currentLocation: '',
                location: '',
                notes: '',
                packDate: '',
                lot: '',
                              });
            }}
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl border border-emerald-500 text-sm font-bold transition-all shadow-sm shrink-0 select-none cursor-pointer"
          >
            <Plus size={15} />
            Add Off-Site Item
          </button>
        </div>
      )}

        {(selectedBoxIds.size > 0 || selectedItemIds.size > 0) && (
          <div 
            className="mb-5 flex flex-col gap-3.5 bg-cyan-950/95 border-2 border-cyan-500 rounded-xl p-4 shadow-2xl animate-fade-in w-full backdrop-blur-md"
          >
            {/* Top Row: Summaries of Checked Items */}
            <div className="flex flex-col gap-2.5 border-b border-cyan-500/20 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 text-xs">
                  <span className="text-sm font-black text-cyan-300 uppercase tracking-wider flex items-center gap-1.5 select-none">
                    <span>⚡</span> Selection Summary:
                  </span>
                  
                  <span className="bg-cyan-900/60 text-cyan-200 border border-cyan-700/50 px-2 py-0.5 rounded-md font-extrabold shadow-sm">
                    {selectedItemsSummary.boxCount > 0 && `📦 ${selectedItemsSummary.boxCount} Box${selectedItemsSummary.boxCount > 1 ? 'es' : ''}`}
                    {selectedItemsSummary.boxCount > 0 && selectedItemsSummary.itemsCount > selectedItemsSummary.boxCount && ' & '}
                    {selectedItemsSummary.itemsCount > 0 && `✂️ ${selectedItemsSummary.itemsCount} Item${selectedItemsSummary.itemsCount > 1 ? 's' : ''}`}
                  </span>
                  
                  <span className="bg-emerald-950/60 text-emerald-450 border border-emerald-800/40 px-2.5 py-0.5 rounded-md font-black shadow-sm flex items-center gap-1 text-[13px]">
                    <span className="text-[11px] opacity-75">⚖️ Total Weight:</span>
                    <span>{selectedItemsSummary.totalWeight.toFixed(2)} lbs</span>
                  </span>
                  
                  <span className="bg-blue-950/60 text-blue-300 border border-blue-900/40 px-2.5 py-0.5 rounded-md font-black shadow-sm flex items-center gap-1 text-[13px]">
                    <span className="text-[11px] opacity-75">🧩 Total Count:</span>
                    <span>{selectedItemsSummary.totalPieces} pcs</span>
                  </span>
                </div>

                <button
                  onClick={() => {
                    setSelectedBoxIds(new Set());
                    setSelectedItemIds(new Set());
                  }}
                  className="text-cool-gray-400 hover:text-white p-1.5 transition-colors md:ml-auto cursor-pointer bg-cool-gray-750/30 hover:bg-cool-gray-700 rounded-lg text-xs font-bold flex items-center gap-1"
                  title="Clear Selection"
                >
                  <X size={14} />
                  <span>Clear Selected</span>
                </button>
              </div>

              {/* Checked Meat Cuts detailed pills */}
              {selectedItemsSummary.cuts.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center bg-cool-gray-950/50 border border-cool-gray-800/40 p-2 rounded-lg max-h-[100px] overflow-y-auto">
                  <span className="text-[9px] uppercase font-black text-cool-gray-400 tracking-wider">Checked cuts breakdown:</span>
                  {selectedItemsSummary.cuts.map((cut, idx) => (
                    <span 
                      key={idx} 
                      className="inline-flex items-center gap-1 bg-cool-gray-900 border border-cool-gray-750 rounded px-2 py-0.5 text-[11px] text-cool-gray-200"
                    >
                      <span className="font-bold text-cyan-400">{cut.name}</span>
                      <span className="text-cool-gray-600 font-bold">•</span>
                      <span className="text-blue-400 font-mono text-[10px]">{cut.pieces} pcs</span>
                      <span className="text-cool-gray-600 font-bold">•</span>
                      <span className="text-emerald-450 font-mono font-bold text-[10px]">{cut.weight.toFixed(1)} lbs</span>
                      {cut.count > 1 && (
                        <>
                          <span className="text-cool-gray-600 font-bold">•</span>
                          <span className="text-cool-gray-400 text-[10px]">({cut.count} pkgs)</span>
                        </>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Row: Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-widest select-none">Bulk Actions Menu:</span>
              
              <div className="flex flex-wrap items-center gap-3">
                {/* Active Plan Movement Controls */}
                {activeOrder && activeOrder.status === 'planning' && (
                  <div className="flex items-center gap-2 bg-blue-950/40 border border-blue-900/40 rounded-lg p-1.5 px-2">
                    <span className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Plan:</span>
                    {activeOrders.length > 1 && (
                      <select
                        className="bg-cool-gray-900 border border-indigo-500/50 text-indigo-200 rounded-md px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[160px] truncate"
                        value={activeOrder.id}
                        onChange={(e) => {
                          localStorage.setItem('selected-movement-order-id', e.target.value);
                          if (onSelectActiveOrder) onSelectActiveOrder(e.target.value);
                        }}
                        title="Switch active movement order"
                      >
                        {activeOrders.map((o: any) => (
                          <option key={o.id} value={o.id}>
                            🚚 {o.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <select
                      className="bg-cool-gray-900 border border-cool-gray-750 text-white rounded-md px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      value={bulkTargetDest}
                      onChange={e => setBulkTargetDest(e.target.value)}
                    >
                      <option value="">Move selected to...</option>
                      {(activeOrder.targetDestinations || []).map((dest: any, idx: number) => (
                        <option key={`bulk-${dest.id}-${idx}`} value={dest.id}>
                          {dest.palletName ? `${dest.palletName} - ${dest.locationName}` : dest.locationName}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleBulkMove(bulkTargetDest)}
                      disabled={!bulkTargetDest}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                    >
                      Apply Move
                    </button>
                  </div>
                )}

                {/* Direct Edit / Delete Controls */}
                {isDirectEdit && (
                  <div className="flex items-center gap-2 bg-amber-950/40 border border-amber-900/40 rounded-lg p-1.5 px-2">
                    <span className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">Direct Edit:</span>
                    <button
                      onClick={() => {
                        setBulkEditForm({
                          cuts: '',
                          box: '',
                          currentLocation: '',
                          location: '',
                          notes: '',
                          packDate: '',
                          lot: '',
                          netWeight: '',
                          pieces: '',
                          tagIds: [],
                        });
                        setBulkEditFieldsToUpdate({
                          cuts: false,
                          box: false,
                          currentLocation: false,
                          location: false,
                          notes: false,
                          packDate: false,
                          lot: false,
                          netWeight: false,
                          pieces: false,
                          tags: false,
                        });
                        setIsBulkEditModalOpen(true);
                      }}
                      className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                    >
                      <Edit3 size={13} />
                      Bulk Edit
                    </button>
                    <button
                      onClick={() => setIsBulkWrongLabelModalOpen(true)}
                      className="flex items-center gap-1 bg-purple-650 hover:bg-purple-600 text-white font-bold text-xs px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                    >
                      <AlertTriangle size={13} />
                      Bulk Wrong Label
                    </button>
                    {(() => {
                      let allItemIds: string[];
                      if (viewUngrouped) {
                        allItemIds = Array.from(selectedBoxIds);
                      } else {
                        const selectedBoxesList = condensed.filter(g => selectedBoxIds.has(g.boxId));
                        const allBoxItemIds = selectedBoxesList.flatMap(g => g.items.map(item => item.id));
                        allItemIds = Array.from(new Set([...allBoxItemIds, ...Array.from(selectedItemIds)]));
                      }
                      const hasWrongLabelSelected = (entries || []).some(e => allItemIds.includes(e.id) && (e.isWrongLabel || e.wrongLabel || e.wrongLabelOriginal));
                      if (!hasWrongLabelSelected) return null;
                      return (
                        <button
                          onClick={handleExecuteBulkRevertWrongLabel}
                          className="flex items-center gap-1 bg-amber-700 hover:bg-amber-650 text-white font-bold text-xs px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                          title="Revert wrong label corrections for selected items back to original physical package labels"
                        >
                          <RotateCcw size={13} />
                          Bulk Revert Labels
                        </button>
                      );
                    })()}
                    <button
                      onClick={() => setIsBulkDeleteConfirmOpen(true)}
                      className="flex items-center gap-1 bg-red-650 hover:bg-red-600 text-white font-bold text-xs px-2.5 py-1 rounded-md transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                    >
                      <Trash2 size={13} />
                      Bulk Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      {/* Active Filter Indicators & Clear Actions */}
      {(filterCuts.size > 0 || filterPallets.size > 0 || filterLocations.size > 0 || filterMoveTo.size > 0 || filterBoxes.size > 0 || filterSerials.size > 0 || filterLots.size > 0 || filterPackDates.size > 0 || breakdownSearch || filterOnlySplitBoxes || filterOnlyConflicts || (breakdownCategory && breakdownCategory !== 'All')) && (
        <div className="flex flex-wrap items-center gap-2 bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3 text-xs">
          <span className="font-bold text-cool-gray-400 uppercase tracking-wider text-[10px]">Active Filters:</span>
          {filterOnlyConflicts && (
            <span className="bg-amber-950/80 border border-amber-500/60 rounded-lg px-2 py-1 text-amber-300 flex items-center gap-1.5 font-bold animate-fade-in shadow-xs">
              <AlertTriangle size={12} className="text-amber-400" /> Conflicted Boxes Only
              <button onClick={() => setFilterOnlyConflicts(false)} className="hover:text-white transition-colors cursor-pointer text-[10px] pl-0.5 font-black">✕</button>
            </span>
          )}
          {filterCuts.size > 0 && (
            <span className="bg-emerald-950/60 border border-emerald-800/50 px-2 py-1 rounded-lg text-emerald-450 flex items-center gap-1.5 font-bold">
              ✂️ Cuts ({filterCuts.size})
              <button onClick={() => setFilterCuts(new Set())} className="hover:text-white transition-colors cursor-pointer text-[10px] pl-0.5 font-black">✕</button>
            </span>
          )}
          {filterOnlySplitBoxes && (
            <span className="bg-amber-950/60 border border-amber-900/40 rounded-lg px-2 py-1 text-amber-400 flex items-center gap-1.5 font-bold animate-fade-in">
              ⚠️ Split Boxes Only
              <button onClick={() => setFilterOnlySplitBoxes(false)} className="hover:text-white transition-colors cursor-pointer text-[10px] pl-0.5 font-black">✕</button>
            </span>
          )}
          {filterPallets.size > 0 && (
            <span className="bg-emerald-950/60 border border-emerald-800/50 px-2 py-1 rounded-lg text-emerald-450 flex items-center gap-1.5 font-bold">
              📦 Pallets ({filterPallets.size})
              <button onClick={() => setFilterPallets(new Set())} className="hover:text-white transition-colors cursor-pointer text-[10px] pl-0.5 font-black">✕</button>
            </span>
          )}
          {filterLocations.size > 0 && (
            <span className="bg-emerald-950/60 border border-emerald-800/50 px-2 py-1 rounded-lg text-emerald-450 flex items-center gap-1.5 font-bold">
              📍 Locations ({filterLocations.size})
              <button onClick={() => setFilterLocations(new Set())} className="hover:text-white transition-colors cursor-pointer text-[10px] pl-0.5 font-black">✕</button>
            </span>
          )}
          {filterMoveTo.size > 0 && (
            <span className="bg-emerald-950/60 border border-emerald-800/50 px-2 py-1 rounded-lg text-emerald-450 flex items-center gap-1.5 font-bold">
              🚚 Move To ({filterMoveTo.size})
              <button onClick={() => setFilterMoveTo(new Set())} className="hover:text-white transition-colors cursor-pointer text-[10px] pl-0.5 font-black">✕</button>
            </span>
          )}
          {filterBoxes.size > 0 && (
            <span className="bg-cool-gray-800 text-cool-gray-300 px-2 py-1 rounded border border-cool-gray-700 font-bold flex items-center gap-2 cursor-pointer hover:bg-cool-gray-750 hover:text-white transition-colors" onClick={() => setFilterBoxes(new Set())}>
              🗳️ Boxes ({filterBoxes.size})
              <X size={12} className="text-cool-gray-500 hover:text-red-400 transition-colors" />
            </span>
          )}
          {filterSerials.size > 0 && (
            <span className="bg-cool-gray-800 text-cool-gray-300 px-2 py-1 rounded border border-cool-gray-700 font-bold flex items-center gap-2 cursor-pointer hover:bg-cool-gray-750 hover:text-white transition-colors" onClick={() => setFilterSerials(new Set())}>
              🔢 Serials ({filterSerials.size})
              <X size={12} className="text-cool-gray-500 hover:text-red-400 transition-colors" />
            </span>
          )}
          {filterLots.size > 0 && (
            <span className="bg-cool-gray-800 text-cool-gray-300 px-2 py-1 rounded border border-cool-gray-700 font-bold flex items-center gap-2 cursor-pointer hover:bg-cool-gray-750 hover:text-white transition-colors" onClick={() => setFilterLots(new Set())}>
              🏷️ Lots ({filterLots.size})
              <X size={12} className="text-cool-gray-500 hover:text-red-400 transition-colors" />
            </span>
          )}
          {filterPackDates.size > 0 && (
            <span className="bg-cool-gray-800 text-cool-gray-300 px-2 py-1 rounded border border-cool-gray-700 font-bold flex items-center gap-2 cursor-pointer hover:bg-cool-gray-750 hover:text-white transition-colors" onClick={() => setFilterPackDates(new Set())}>
              📅 Pack Dates ({filterPackDates.size})
              <X size={12} className="text-cool-gray-500 hover:text-red-400 transition-colors" />
            </span>
          )}
          {breakdownSearch && (
            <span className="bg-emerald-950/60 border border-emerald-800/50 px-2 py-1 rounded-lg text-emerald-450 flex items-center gap-1.5 font-bold">
              🔍 Breakdown Search: "{breakdownSearch}"
              <button onClick={() => setBreakdownSearch('')} className="hover:text-white transition-colors cursor-pointer text-[10px] pl-0.5 font-black">✕</button>
            </span>
          )}
          {breakdownCategory && breakdownCategory !== 'All' && (
            <span className="bg-emerald-950/60 border border-emerald-800/50 px-2 py-1 rounded-lg text-emerald-450 flex items-center gap-1.5 font-bold">
              📁 Category: "{breakdownCategory}"
              <button onClick={() => setBreakdownCategory('All')} className="hover:text-white transition-colors cursor-pointer text-[10px] pl-0.5 font-black">✕</button>
            </span>
          )}
          <button
            onClick={() => {
              setFilterCuts(new Set());
              setFilterPallets(new Set());
              setFilterLocations(new Set());
              setFilterMoveTo(new Set());
              setFilterBoxes(new Set());
              setFilterSerials(new Set());
              setFilterLots(new Set());
              setFilterPackDates(new Set());
              setBreakdownSearch('');
              setBreakdownCategory('All');
              setFilterOnlySplitBoxes(false);
            }}
            className="ml-auto text-emerald-450 hover:text-emerald-350 font-bold underline cursor-pointer text-[11px]"
          >
            Clear All Filters
          </button>
        </div>
      )}

      <div className="bg-cool-gray-850 rounded-2xl border border-cool-gray-750 shadow-xl">
        {(() => {
          const showMovedTo = !!(visibleColumns?.has('movedTo') && activeOrder);
          const showFlag = !!(activeOrder && visibleColumns?.has('flag'));
          let displayColsCount = 0;
          if (visibleColumns) {
            visibleColumns.forEach((col: string) => {
              if (col === 'flag') return;
              if (col === 'movedTo') {
                if (showMovedTo) displayColsCount++;
              } else {
                displayColsCount++;
              }
            });
          } else {
            displayColsCount = 8;
          }
          const totalCols = (isDirectEdit || activeOrder ? 1 : 0) + 1 + displayColsCount + (showFlag ? 1 : 0);
          return (
            <div 
              id="offsite-spreadsheet-table-container"
              className="min-h-[480px]"
            >
              <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
                <thead className="bg-cool-gray-800">
                  <tr className="border-b border-cool-gray-750 bg-cool-gray-800 text-cool-gray-400">
                    {(isDirectEdit || activeOrder) && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2 w-10 text-center border-b border-cool-gray-750 shadow-xs select-none first:rounded-tl-2xl"
                        style={{ top: 'var(--header-height, 68px)' }}
                      >
                        {(isDirectEdit || (activeOrder && activeOrder.status === 'planning')) && (
                          <input 
                            type="checkbox"
                            className="rounded bg-cool-gray-950 border-cool-gray-750 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer w-4 h-4"
                            checked={condensed.length > 0 && condensed.every(g => selectedBoxIds.has(viewUngrouped ? g.items[0].id : g.boxId))}
                            onChange={() => {
                              const allSelected = condensed.length > 0 && condensed.every(g => selectedBoxIds.has(viewUngrouped ? g.items[0].id : g.boxId));
                              if (allSelected) {
                                setSelectedBoxIds(new Set());
                                setSelectedItemIds(new Set());
                              } else {
                                setSelectedBoxIds(new Set(condensed.map(g => viewUngrouped ? g.items[0].id : g.boxId)));
                                setSelectedItemIds(new Set(filteredEntries.map(e => e.id)));
                              }
                            }}
                          />
                        )}
                      </th>
                    )}
                    <th 
                      className="sticky bg-cool-gray-800 z-20 py-1.5 px-2 w-8 border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl"
                      style={{ top: 'var(--header-height, 68px)' }}
                    ></th>
                    {visibleColumns?.has('box') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.box, minWidth: columnWidths.box }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="cursor-pointer hover:text-white truncate" onClick={() => toggleSort('box')}>
                            box {sortField === 'box' && (sortAsc ? '↑' : '↓')}
                          </span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${filterBoxes.size > 0 ? 'text-emerald-400 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'box' ? null : 'box'); }} 
                            />
                            {openFilter === 'box' && renderFilterDropdown('box', allBoxes, filterBoxes, setFilterBoxes, boxesSearch, setBoxesSearch)}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'box')}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('cuts') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.cuts, minWidth: columnWidths.cuts }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="truncate">Cuts</span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${filterCuts.size > 0 ? 'text-emerald-400 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'cuts' ? null : 'cuts'); }} 
                            />
                            {openFilter === 'cuts' && renderFilterDropdown('cuts', allCuts, filterCuts, setFilterCuts, cutsSearch, setCutsSearch)}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'cuts')}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('category') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.category, minWidth: columnWidths.category }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="cursor-pointer hover:text-white truncate" onClick={() => toggleSort('primaryCategory')}>
                            Category {sortField === 'primaryCategory' && (sortAsc ? '↑' : '↓')}
                          </span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${(filterPrimaryCategories.size > 0 || filterSubCategories.size > 0) ? 'text-emerald-400 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'primaryCategory' ? null : 'primaryCategory'); }} 
                            />
                            {openFilter === 'primaryCategory' && (
                              typeof document !== 'undefined' ? createPortal(
                                <OffsiteCategoryFilterModal
                                  primaryOptions={allPrimaryCategories}
                                  subOptions={categoryMap}
                                  selectedPrimary={filterPrimaryCategories}
                                  selectedSub={filterSubCategories}
                                  onChange={(p, s) => {
                                    setFilterPrimaryCategories(p);
                                    setFilterSubCategories(s);
                                  }}
                                  onClose={() => setOpenFilter(null)}
                                />,
                                document.body
                              ) : null
                            )}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'category')}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('weight') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none cursor-pointer hover:text-white border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.weight, minWidth: columnWidths.weight }} 
                        onClick={() => toggleSort('weight')}
                      >
                        <span className="truncate">Weight {sortField === 'weight' && (sortAsc ? '↑' : '↓')}</span>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, 'weight'); }}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('pieces') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none cursor-pointer hover:text-white border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.pieces, minWidth: columnWidths.pieces }} 
                        onClick={() => toggleSort('pieces')}
                      >
                        <span className="truncate">Pieces {sortField === 'pieces' && (sortAsc ? '↑' : '↓')}</span>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, 'pieces'); }}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('location') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.location, minWidth: columnWidths.location }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="truncate">location</span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${filterLocations.size > 0 ? 'text-emerald-450 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'locations' ? null : 'locations'); }} 
                            />
                            {openFilter === 'locations' && renderFilterDropdown('locations', allLocations, filterLocations, setFilterLocations, locationsSearch, setLocationsSearch)}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'location')}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('pallet') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.pallet, minWidth: columnWidths.pallet }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="truncate">Pallet</span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${filterPallets.size > 0 ? 'text-emerald-400 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'pallets' ? null : 'pallets'); }} 
                            />
                            {openFilter === 'pallets' && renderFilterDropdown('pallets', allPallets, filterPallets, setFilterPallets, palletsSearch, setPalletsSearch)}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'pallet')}
                        />
                      </th>
                    )}
                    {showMovedTo && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.movedTo, minWidth: columnWidths.movedTo }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="truncate">Moved To</span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${filterMoveTo.size > 0 ? 'text-emerald-400 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'moveTo' ? null : 'moveTo'); }} 
                            />
                            {openFilter === 'moveTo' && renderFilterDropdown('moveTo', allMoveTo, filterMoveTo, setFilterMoveTo, moveToSearch, setMoveToSearch)}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'movedTo')}
                        />
                      </th>
                    )}
                    {activeOrder && visibleColumns?.has('flag') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 text-center select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.flag, minWidth: columnWidths.flag }}
                      >
                        <span className="truncate">Flag</span>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'flag')}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('serial') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.serial, minWidth: columnWidths.serial }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="cursor-pointer hover:text-white truncate" onClick={() => toggleSort('serial')}>
                            Serial {sortField === 'serial' && (sortAsc ? '↑' : '↓')}
                          </span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${filterSerials.size > 0 ? 'text-emerald-400 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'serial' ? null : 'serial'); }} 
                            />
                            {openFilter === 'serial' && renderFilterDropdown('serial', allSerials, filterSerials, setFilterSerials, serialsSearch, setSerialsSearch)}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'serial')}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('lotNumber') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.lotNumber, minWidth: columnWidths.lotNumber }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="cursor-pointer hover:text-white truncate" onClick={() => toggleSort('lot')}>
                            Lot Number {sortField === 'lot' && (sortAsc ? '↑' : '↓')}
                          </span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${filterLots.size > 0 ? 'text-emerald-400 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'lot' ? null : 'lot'); }} 
                            />
                            {openFilter === 'lot' && renderFilterDropdown('lot', allLots, filterLots, setFilterLots, lotsSearch, setLotsSearch)}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'lotNumber')}
                        />
                      </th>
                    )}
                    {visibleColumns?.has('packDate') && (
                      <th 
                        className="sticky bg-cool-gray-800 z-20 py-1.5 px-2.5 select-none border-b border-cool-gray-750 shadow-xs first:rounded-tl-2xl last:rounded-tr-2xl" 
                        style={{ top: 'var(--header-height, 68px)', width: columnWidths.packDate, minWidth: columnWidths.packDate }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="cursor-pointer hover:text-white truncate" onClick={() => toggleSort('packDate')}>
                            Pack Date {sortField === 'packDate' && (sortAsc ? '↑' : '↓')}
                          </span>
                          <div className="relative shrink-0">
                            <Filter 
                              size={14} 
                              className={`cursor-pointer transition-colors ${filterPackDates.size > 0 ? 'text-emerald-400 hover:text-emerald-350' : 'text-cool-gray-400 hover:text-white'}`} 
                              onClick={(e) => { e.stopPropagation(); setOpenFilter(openFilter === 'packDate' ? null : 'packDate'); }} 
                            />
                            {openFilter === 'packDate' && renderFilterDropdown('packDate', allPackDates, filterPackDates, setFilterPackDates, packDatesSearch, setPackDatesSearch)}
                          </div>
                        </div>
                        <div 
                          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-emerald-500/50 active:bg-emerald-500 transition-colors z-30"
                          onMouseDown={(e) => handleResizeStart(e, 'packDate')}
                        />
                      </th>
                    )}
                  </tr>
                </thead>
            <tbody className="divide-y divide-cool-gray-750">
              {condensed.map((group, idx) => {
                const rowId = viewUngrouped ? group.items[0].id : group.boxId;
                const isExpanded = expandedBoxes[rowId];
                
                // Determine group level selected destination representation
                let groupSelectValue = '';
                if (group.moveTo.size === 1) {
                  groupSelectValue = (Array.from(group.moveTo)[0] as string) || '';
                } else if (group.moveTo.size > 1) {
                  groupSelectValue = '__mixed__';
                }

                // Compute destination breakdown for this box group
                const groupDestMap = new Map<string, {
                  destId: string;
                  destName: string;
                  count: number;
                  weight: number;
                  pieces: number;
                  cuts: string[];
                }>();

                group.items.forEach(item => {
                  const destId = activeOrder
                    ? (activeOrder.moves.find((m: any) => m.entryId === item.id)?.targetLocation || '')
                    : '';
                  const destName = destId ? getMoveToName(destId) : 'Staying put';
                  const cutName = (viewOriginalNames && item.originalCutName)
                    ? item.originalCutName
                    : ((state.products?.find((p: any) => p.id === item.productId)?.name || item.originalCutName) || '');

                  if (!groupDestMap.has(destId)) {
                    groupDestMap.set(destId, {
                      destId,
                      destName,
                      count: 0,
                      weight: 0,
                      pieces: 0,
                      cuts: []
                    });
                  }
                  const entry = groupDestMap.get(destId)!;
                  entry.count += 1;
                  entry.weight += (item.netWeight || 0);
                  entry.pieces += (item.pieces || 0);
                  if (cutName && !entry.cuts.includes(cutName)) {
                    entry.cuts.push(cutName);
                  }
                });

                const groupDestList = Array.from(groupDestMap.values()).sort((a, b) => {
                  if (!a.destId) return 1;
                  if (!b.destId) return -1;
                  return a.destName.localeCompare(b.destName);
                });

                return (
                  <React.Fragment key={rowId}>
                    <tr className="hover:bg-cool-gray-800/50 transition-colors group align-top">
                      {(isDirectEdit || activeOrder) && (
                        <td 
                          className="py-1.5 px-2.5 text-center cursor-pointer select-none" 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleSelectBox(rowId, idx, e); 
                          }}
                        >
                          {(isDirectEdit || (activeOrder && activeOrder.status === 'planning')) && (
                            <input 
                              type="checkbox"
                              className="rounded bg-cool-gray-950 border-cool-gray-750 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer w-4 h-4"
                              checked={selectedBoxIds.has(rowId)}
                              onChange={() => {}}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectBox(rowId, idx, e);
                              }}
                            />
                          )}
                        </td>
                      )}
                      <td className="py-1.5 px-2.5">
                        <button 
                          onClick={() => toggleExpandBox(rowId)}
                          className="p-1 rounded bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-400 hover:text-white transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      {visibleColumns?.has('box') && (
  <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-400" style={{ width: columnWidths.box, minWidth: columnWidths.box, maxWidth: columnWidths.box }}>
                        <div className="flex items-center gap-2 flex-wrap overflow-hidden">
                          {isDirectEdit && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Find common values for the box to prepopulate bulk edit
                                const boxCuts = new Set(group.items.map(it => it.cuts));
                                const boxNetWeight = group.items.reduce((sum, it) => sum + (it.netWeight || 0), 0);
                                const boxPieces = group.items.reduce((sum, it) => sum + (it.pieces || 0), 0);
                                const boxTags = Array.from(new Set(group.items.flatMap(it => it.tagIds || [])));
                                
                                setBulkEditForm({
                                  cuts: boxCuts.size === 1 ? Array.from(boxCuts)[0] : '',
                                  box: group.boxId,
                                  currentLocation: group.items[0]?.currentLocation || '',
                                  location: group.items[0]?.location || '',
                                  notes: group.items[0]?.notes || '',
                                  packDate: group.items[0]?.packDate || '',
                                  lot: group.items[0]?.lot || '',
                                  netWeight: boxNetWeight.toString(),
                                  pieces: boxPieces.toString(),
                                  tagIds: boxTags,
                                });
                                setBulkEditFieldsToUpdate({
                                  cuts: false,
                                  box: false,
                                  currentLocation: false,
                                  location: false,
                                  notes: false,
                                  packDate: false,
                                  lot: false,
                                  netWeight: false,
                                  pieces: false,
                                  tags: false,
                                });
                                // Select all items in this box to be edited
                                setSelectedItemIds(new Set(group.items.map(it => it.id)));
                                setSelectedBoxIds(new Set()); // We select the items inside the box so bulk edit updates them all
                                setIsBulkEditModalOpen(true);
                              }}
                              className="p-1.5 bg-amber-600/20 hover:bg-amber-600/45 text-amber-400 rounded-lg border border-amber-500/20 transition-all font-bold flex items-center gap-1 text-xs cursor-pointer select-none shrink-0"
                              title="Edit Entire Box"
                            >
                              <Edit3 size={13} />
                            </button>
                          )}
                          <span className="truncate">{group.boxId}</span>

                          {(() => {
                            const allItemsObj = boxToAllEntriesMap[group.boxId] || [];
                            const hasHiddenItems = !viewUngrouped && group.items.length < allItemsObj.length;
                            const isShowingAllUnfiltered = showUnfilteredBoxIds.has(group.boxId);
                            if (!hasHiddenItems) return null;
                            return (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowUnfilteredBoxIds(curr => {
                                    const next = new Set(curr);
                                    if (next.has(group.boxId)) {
                                      next.delete(group.boxId);
                                    } else {
                                      setExpandedBoxes(prev => ({ ...prev, [rowId]: true }));
                                      next.add(group.boxId);
                                    }
                                    return next;
                                  });
                                }}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border transition-all cursor-pointer select-none animate-fade-in shrink-0 ${
                                  isShowingAllUnfiltered
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                    : 'bg-cool-gray-800 text-cool-gray-300 border-cool-gray-750 hover:bg-cool-gray-700 hover:text-white'
                                }`}
                                title={
                                  isShowingAllUnfiltered
                                    ? `Showing all ${allItemsObj.length} items in box. Click to hide ${allItemsObj.length - group.items.length} filtered-out items.`
                                    : `Contains ${allItemsObj.length - group.items.length} other item(s) not in current filter. Click to reveal.`
                                }
                              >
                                {isShowingAllUnfiltered ? <EyeOff size={11} className="text-amber-400" /> : <Eye size={11} className="text-cool-gray-400" />}
                                <span>+{allItemsObj.length - group.items.length} hidden</span>
                              </button>
                            );
                          })()}

                          {(() => {
                            const boxTags = Array.from(new Set(group.items.flatMap(it => it.tagIds || [])));
                            if (boxTags.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1 items-center shrink-0">
                                {boxTags.map(tagId => {
                                  const tag = state.tags?.find(t => t.id === tagId);
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
                          })()}
                          {(() => {
                            const hasBoxNotes = group.items.some(it => it.boxNotes && it.boxNotes.trim() !== '');
                            const hasItemNotes = group.items.some(it => it.notes && it.notes.trim() !== '');
                            if (hasBoxNotes || hasItemNotes) {
                              return (
                                <span 
                                  className="inline-flex items-center gap-1 text-[10px] bg-amber-950/40 text-amber-400 font-bold px-1.5 py-0.5 rounded border border-amber-500/20 animate-fade-in cursor-help shrink-0"
                                  title={hasBoxNotes ? (hasItemNotes ? "Box and item notes present" : "Box notes present") : "Item notes present"}
                                >
                                  <FileText size={11} className="text-amber-500" />
                                  Notes
                                </span>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </td>
)}
                      {visibleColumns?.has('cuts') && (
  <td className="py-1.5 px-2.5 text-cool-gray-300" style={{ width: columnWidths.cuts, minWidth: columnWidths.cuts, maxWidth: columnWidths.cuts }}>
                        <div className="overflow-hidden">
                          {(Object.entries(group.items.reduce((acc, item) => {
                            const cut = (viewOriginalNames && item.originalCutName) ? item.originalCutName : (item.cuts || 'Unknown Product');
                            if (!acc[cut]) {
                              acc[cut] = { weight: 0, pieces: 0, items: [] };
                            }
                            acc[cut].weight += item.netWeight || 0;
                            acc[cut].pieces += item.pieces || 0;
                            acc[cut].items.push(item);
                            return acc;
                          }, {} as Record<string, { weight: number, pieces: number, items: any[] }>)) as Array<[string, { weight: number, pieces: number, items: any[] }]>).map(([cutName, stats], idx, arr) => {
                            const cutTags = Array.from(new Set(stats.items.flatMap(it => it.tagIds || [])));
                            const wrongLabelItem = stats.items.find(it => Boolean(it.isWrongLabel || it.wrongLabel || it.wrongLabelOriginal));
                            return (
                              <div key={cutName} className="text-xs py-0.5 flex flex-wrap items-center justify-between gap-1.5 overflow-hidden">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setQuickInfoItem({ cuts: cutName })}
                                    className="text-left font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer select-none transition-colors duration-150 truncate"
                                    title="Click for Product Quick Info & Lists"
                                  >
                                    {cutName}
                                  </button>
                                  {!viewOriginalNames && wrongLabelItem && (
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setWrongLabelItemId(wrongLabelItem.id);
                                        setSelectedCorrectProductId(wrongLabelItem.productId || '');
                                        setWrongLabelNotes(wrongLabelItem.notes || '');
                                      }}
                                      className="text-[9px] text-red-300 font-bold px-1.5 py-0.2 bg-red-950/70 border border-red-700/60 hover:bg-red-900/80 rounded shrink-0 truncate cursor-pointer flex items-center gap-1"
                                      title={`Originally Labeled As: ${wrongLabelItem.wrongLabelOriginal || wrongLabelItem.originalCutName}. Click to edit or revert.`}
                                    >
                                      <AlertTriangle size={10} className="text-red-400 shrink-0" />
                                      <span>Labeled: {wrongLabelItem.wrongLabelOriginal || wrongLabelItem.originalCutName}</span>
                                    </span>
                                  )}
                                  {cutTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 items-center shrink-0">
                                      {cutTags.map(tagId => {
                                        const tag = state.tags?.find((t: any) => t.id === tagId);
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
                                            title={`Tag: ${tag.description || tag.name}`}
                                          >
                                            {tag.id === 'use-first' ? '🍳 ' : tag.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{tag.name}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                {arr.length > 1 && (
                                  <span className="text-[10px] text-emerald-400 font-bold bg-cool-gray-800 px-1.5 py-0.2 rounded border border-cool-gray-700/60 whitespace-nowrap shrink-0">
                                    {stats.weight.toFixed(2)} / {stats.pieces}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
)}
                      {visibleColumns?.has('category') && (
  <td className="py-1.5 px-2.5 text-cool-gray-300" style={{ width: columnWidths.category, minWidth: columnWidths.category, maxWidth: columnWidths.category }}>
                        <div className="overflow-hidden">
                          {Array.from(new Set(group.items.map(item => `${item.primaryCategory || 'Off-Site / Uncategorized'} / ${item.subCategory || 'Off-Site / Uncategorized'}`))).map((cat, i) => (
                            <div key={i} className="text-xs text-cool-gray-400 font-medium truncate" title={cat}>{cat}</div>
                          ))}
                        </div>
                      </td>
)}
                      {visibleColumns?.has('weight') && (
  <td className="py-1.5 px-2.5 font-bold text-cool-gray-100 truncate" style={{ width: columnWidths.weight, minWidth: columnWidths.weight, maxWidth: columnWidths.weight }}>
                        {group.totalWeight.toFixed(2)}
                      </td>
)}
                      {visibleColumns?.has('pieces') && (
  <td className="py-1.5 px-2.5 text-cool-gray-300 truncate" style={{ width: columnWidths.pieces, minWidth: columnWidths.pieces, maxWidth: columnWidths.pieces }}>
                        {group.totalPieces}
                      </td>
)}
                      {visibleColumns?.has('location') && (
  <td className="py-1.5 px-2.5 text-cool-gray-400 truncate" style={{ width: columnWidths.location, minWidth: columnWidths.location, maxWidth: columnWidths.location }} title={Array.from(group.locations).join(', ')}>
                        {Array.from(group.locations).join(', ')}
                      </td>
)}
                      {visibleColumns?.has('pallet') && (
  <td className="py-1.5 px-2.5 text-cool-gray-300" style={{ width: columnWidths.pallet, minWidth: columnWidths.pallet, maxWidth: columnWidths.pallet }}>
                        <div className="flex flex-wrap gap-1 overflow-hidden">
                          {Array.from(group.pallets).map((p, i) => <div key={i} className="text-xs bg-cool-gray-800 inline-block px-2 py-0.5 rounded border border-cool-gray-700 truncate" title={p}>{p}</div>)}
                        </div>
                      </td>
)}
                      {showMovedTo && (
  <td className="py-1.5 px-2.5 text-blue-400 font-bold align-top" style={{ width: columnWidths.movedTo, minWidth: columnWidths.movedTo, maxWidth: columnWidths.movedTo }}>
                        <div className="overflow-hidden space-y-1.5">
                          {(() => {
                            const boxAssignments = openOrdersMovementData.boxOrderAssignments.get(group.boxId) || [];
                            const otherOrderAssignments = boxAssignments.filter(ba => !ba.isCurrentOrder);
                            const isBoxConflicted = openOrdersMovementData.conflictedBoxIds.has(group.boxId);
                            const hasItemConflict = group.items.some(it => openOrdersMovementData.conflictedEntryIds.has(it.id));
                            const hasConflict = isBoxConflicted || hasItemConflict;

                            return (
                              <>
                                {/* Conflict warning tag */}
                                {hasConflict && (
                                  <div 
                                    className="p-1 px-1.5 bg-amber-500/25 border border-amber-500/60 rounded text-[10px] text-amber-300 font-black flex items-center justify-between gap-1 shadow-xs animate-pulse select-none"
                                    title={`Items from this box are assigned across ${boxAssignments.length} open movement orders!`}
                                  >
                                    <div className="flex items-center gap-1 min-w-0">
                                      <AlertTriangle size={11} className="text-amber-400 shrink-0" />
                                      <span className="truncate">Conflict: In {boxAssignments.length} Orders</span>
                                    </div>
                                  </div>
                                )}

                                {activeOrder ? (
                                  <div className="space-y-1">
                                    <select
                                      className="w-full bg-blue-950/30 border border-blue-900 text-blue-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer truncate"
                                      value={groupSelectValue}
                                      onChange={(e) => updateMoveTargetGroup(group.items, e.target.value)}
                                      onClick={e => e.stopPropagation()}
                                      disabled={activeOrder.status !== 'planning'}
                                      title={group.moveTo.size > 1 ? `Split Box across ${groupDestList.length} locations` : undefined}
                                    >
                                      {group.moveTo.size > 1 && (
                                        <option value="__mixed__">⚠️ Split Box ({groupDestList.length} locations)</option>
                                      )}
                                      <option value="">Staying put</option>
                                      {(activeOrder.targetDestinations || []).map((dest: any, idx: number) => (
                                        <option key={`opt-${dest.id}-${idx}`} value={dest.id}>
                                          {dest.palletName ? `${dest.palletName} - ${dest.locationName}` : dest.locationName}
                                        </option>
                                      ))}
                                    </select>

                                    {/* Directly list all destination locations under the dropdown for split boxes within active order */}
                                    {group.moveTo.size > 1 && (
                                      <div 
                                        className="mt-1.5 pt-1.5 border-t border-blue-900/40 flex flex-col gap-1 text-[11px] font-normal"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <div className="flex items-center justify-between text-[9px] font-bold text-cool-gray-400 uppercase tracking-wider px-0.5 select-none">
                                          <span>Locations ({groupDestList.length})</span>
                                          <span>Cuts / Wt</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          {groupDestList.map((d) => {
                                            const isStayingPut = !d.destId || d.destId === 'Staying put';
                                            return (
                                              <div
                                                key={d.destId || '__staying_put__'}
                                                className={`flex items-center justify-between gap-1.5 px-2 py-1 rounded-md border text-[10px] leading-tight select-text transition-all ${
                                                  isStayingPut
                                                    ? 'bg-cool-gray-900/80 border-cool-gray-750 text-cool-gray-300'
                                                    : 'bg-blue-950/70 border-blue-800/70 text-blue-200'
                                                }`}
                                                title={`${d.destName}\n• ${d.count} cut(s) (${d.pieces} pcs)\n• Net Weight: ${d.weight.toFixed(2)} lbs\n• Cuts: ${d.cuts.join(', ')}`}
                                              >
                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                  <span className="shrink-0 text-[10px] leading-none">
                                                    {isStayingPut ? '⏹️' : '📍'}
                                                  </span>
                                                  <span className="truncate font-semibold text-cool-gray-100" title={d.destName}>
                                                    {d.destName}
                                                  </span>
                                                </div>
                                                <div className="shrink-0 font-mono text-[9px] flex items-center gap-1 opacity-90">
                                                  <span className="bg-cool-gray-950/70 px-1 py-0.2 rounded text-cool-gray-300 border border-cool-gray-800/80 font-bold">
                                                    {d.count} {d.count === 1 ? 'cut' : 'cuts'}
                                                  </span>
                                                  <span className="text-cool-gray-300 font-semibold whitespace-nowrap">
                                                    {d.weight.toFixed(1)}#
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* Cross-Order Movements: Show destinations from other open movement orders */}
                                    {otherOrderAssignments.length > 0 && (
                                      <div className="mt-2 pt-1.5 border-t border-amber-900/50 flex flex-col gap-1 text-[10px] font-normal" onClick={e => e.stopPropagation()}>
                                        <div className="text-[9px] font-bold text-amber-400 uppercase tracking-wider px-0.5 flex items-center gap-1 select-none">
                                          <span>⚠️ Other Order Movements:</span>
                                        </div>
                                        {otherOrderAssignments.map(oa => (
                                          <div key={oa.orderId} className="bg-amber-950/40 border border-amber-800/60 rounded p-1.5 space-y-1">
                                            <div className="flex items-center justify-between gap-1 text-[10px] font-bold">
                                              <span className="text-amber-300 truncate" title={oa.orderName}>📋 {oa.orderName}</span>
                                              <span className="text-[8px] bg-amber-900/80 text-amber-200 border border-amber-700/60 px-1 py-0.2 rounded uppercase font-black shrink-0">
                                                {oa.orderStatus}
                                              </span>
                                            </div>
                                            <div className="space-y-0.5">
                                              {oa.destinations.map((d, dIdx) => (
                                                <div key={dIdx} className="flex items-center justify-between gap-1 text-[9px] bg-cool-gray-950/60 rounded px-1.5 py-0.5 text-amber-200">
                                                  <div className="flex items-center gap-1 min-w-0 flex-1">
                                                    <span className="text-amber-400 shrink-0">📍</span>
                                                    <span className="truncate">{d.destName}</span>
                                                  </div>
                                                  <span className="shrink-0 font-mono text-amber-300 font-semibold">
                                                    {d.cutsCount} cuts ({d.weight.toFixed(1)}#)
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  /* No active order selected: display destinations from all open orders */
                                  boxAssignments.length > 0 ? (
                                    <div className="space-y-1 text-left font-normal text-[10px]">
                                      {boxAssignments.map(oa => (
                                        <div key={oa.orderId} className="bg-cool-gray-900/90 border border-cool-gray-750 rounded p-1.5 space-y-1">
                                          <div className="flex items-center justify-between gap-1 font-bold">
                                            <span className="text-blue-300 truncate" title={oa.orderName}>📋 {oa.orderName}</span>
                                            <span className="text-[8px] bg-cool-gray-800 text-cool-gray-300 border border-cool-gray-700 px-1 py-0.2 rounded uppercase font-black shrink-0">
                                              {oa.orderStatus}
                                            </span>
                                          </div>
                                          <div className="space-y-0.5">
                                            {oa.destinations.map((d, dIdx) => (
                                              <div key={dIdx} className="flex items-center justify-between gap-1 text-[9px] bg-cool-gray-950/70 rounded px-1.5 py-0.5 text-cool-gray-200">
                                                <div className="flex items-center gap-1 min-w-0 flex-1">
                                                  <span className="text-emerald-400 shrink-0">📍</span>
                                                  <span className="truncate">{d.destName}</span>
                                                </div>
                                                <span className="shrink-0 font-mono text-cool-gray-300 font-semibold">
                                                  {d.cutsCount} cuts ({d.weight.toFixed(1)}#)
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    group.moveTo.size > 1 ? (
                                      <div className="space-y-1">
                                        <div className="text-amber-400 text-xs font-bold flex items-center gap-1">
                                          <span>⚠️</span> Split Box ({groupDestList.length} locations)
                                        </div>
                                        <div className="flex flex-col gap-1 text-[10px] font-normal">
                                          {groupDestList.map((d) => {
                                            const isStayingPut = !d.destId || d.destId === 'Staying put';
                                            return (
                                              <div
                                                key={d.destId || '__staying_put__'}
                                                className={`flex items-center justify-between gap-1 px-2 py-0.5 rounded border text-[10px] ${
                                                  isStayingPut
                                                    ? 'bg-cool-gray-900/80 border-cool-gray-750 text-cool-gray-400'
                                                    : 'bg-blue-950/70 border-blue-800/70 text-blue-200'
                                                }`}
                                                title={`${d.destName}\n• ${d.count} cut(s) (${d.pieces} pcs)\n• Weight: ${d.weight.toFixed(2)} lbs\n• Cuts: ${d.cuts.join(', ')}`}
                                              >
                                                <div className="flex items-center gap-1 min-w-0 flex-1">
                                                  <span className="shrink-0 text-[10px]">{isStayingPut ? '⏹️' : '📍'}</span>
                                                  <span className="truncate font-medium text-cool-gray-200">{d.destName}</span>
                                                </div>
                                                <span className="shrink-0 font-mono text-[9px] text-cool-gray-400">
                                                  {d.count} cuts ({d.weight.toFixed(1)}#)
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ) : (
                                      Array.from(group.moveTo).filter(Boolean).map(getMoveToName).join(', ') || 'Staying put'
                                    )
                                  )
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
)}
                      {activeOrder && visibleColumns?.has('flag') && (
  <td className="py-1.5 px-2.5 text-center" style={{ width: columnWidths.flag, minWidth: columnWidths.flag, maxWidth: columnWidths.flag }} onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center">
                            {renderFlagSelector(rowId, true)}
                          </div>
                        </td>
                      )}
                      {visibleColumns?.has('serial') && (
                        <td className="py-1.5 px-2.5 text-cool-gray-300 truncate" style={{ width: columnWidths.serial, minWidth: columnWidths.serial, maxWidth: columnWidths.serial }} title={viewUngrouped ? group.items[0]?.serial : ''}>
                          {viewUngrouped ? group.items[0]?.serial || '-' : '-'}
                        </td>
                      )}
                      {visibleColumns?.has('lotNumber') && (
                        <td className="py-1.5 px-2.5 text-cool-gray-300 truncate" style={{ width: columnWidths.lotNumber, minWidth: columnWidths.lotNumber, maxWidth: columnWidths.lotNumber }} title={group.items[0]?.lot || ''}>
                          {group.items[0]?.lot || '-'}
                        </td>
                      )}
                      {visibleColumns?.has('packDate') && (
                        <td className="py-1.5 px-2.5 text-cool-gray-300 truncate" style={{ width: columnWidths.packDate, minWidth: columnWidths.packDate, maxWidth: columnWidths.packDate }} title={group.items[0]?.packDate || ''}>
                          {group.items[0]?.packDate || '-'}
                        </td>
                      )}
                    </tr>
                    
                    {/* Expanded Content: Individual items inside the box */}
                    {isExpanded && (
                      <React.Fragment>
                        <tr className="bg-cool-gray-850 border-b border-cool-gray-800">
                          <td colSpan={totalCols} className="p-0">
                            <div className="pl-[72px] pr-4 py-2 bg-cool-gray-900/50 shadow-inner">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="text-xs font-bold text-cool-gray-400 uppercase tracking-wider">
                                  {viewUngrouped ? `Item Details` : `Items in Box ${group.boxId}`}
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-cool-gray-400 font-bold uppercase text-[10px] tracking-wider flex items-center gap-1">
                                    <FileText size={12} className="text-cool-gray-500" />
                                    Box Note:
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="No box note (click to add)..."
                                    className="bg-cool-gray-950 border border-cool-gray-750/70 rounded px-2.5 py-1 text-cool-gray-200 text-xs w-80 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder-cool-gray-650 transition-all"
                                    defaultValue={group.items.find(it => it.boxNotes)?.boxNotes || ''}
                                    onBlur={async (e) => {
                                      const val = e.target.value.trim();
                                      const itemIds = group.items.map(it => it.id);
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
                            </div>
                          </td>
                        </tr>
                        {(() => {
                          const allItemsObj = boxToAllEntriesMap[group.boxId] || [];
                          const isShowingAllUnfiltered = showUnfilteredBoxIds.has(group.boxId);
                          const itemsToRender = isShowingAllUnfiltered ? allItemsObj : group.items;
                          return itemsToRender.map((item, itemIdx) => {
                            const itemMove = activeOrder ? activeOrder.moves.find((m: any) => m.entryId === item.id) : null;
                            const itemTarget = itemMove?.targetLocation || '';
                            const isEditing = editingItemId === item.id;
                            const isFilteredOut = isShowingAllUnfiltered && !group.items.some(git => git.id === item.id);

                          if (isEditing) {
                            return (
                              <tr key={item.id} className="bg-cool-gray-850">
                                <td colSpan={totalCols} className="p-0 border-b border-cool-gray-750">
                                  <div className="pl-12 pr-4 py-4 bg-cool-gray-900/50 shadow-inner">
                                    <div className="bg-cool-gray-800 border-2 border-amber-500/50 p-4 rounded-xl space-y-3 shadow-lg animate-fade-in">
                                      <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wide">
                                        <span>✏️ Editing Item #{item.serial || 'Unknown'}</span>
                                      </div>
                                        
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Correct Cut (Product Catalog)</label>
                                          <select
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.productId || ''}
                                            onChange={e => {
                                              const prodId = e.target.value;
                                              const prod = state.products.find((p: any) => p.id === prodId);
                                              setEditForm({ 
                                                ...editForm, 
                                                productId: prodId,
                                                cuts: prod ? prod.name : editForm.cuts
                                              });
                                            }}
                                          >
                                            <option value="">-- No Catalog Product Mapped --</option>
                                            {state.products.map((p: any) => (
                                              <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Custom Cut Name (Alternative)</label>
                                          <input
                                            type="text"
                                            list="products-datalist"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.cuts || ''}
                                            onChange={e => setEditForm({ ...editForm, cuts: e.target.value })}
                                            placeholder="Use if not in catalog"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Original Label (Wrong Label)</label>
                                          <input
                                            type="text"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.originalCutName || ''}
                                            onChange={e => setEditForm({ ...editForm, originalCutName: e.target.value })}
                                            placeholder="e.g. Backfat"
                                          />
                                        </div>
                                          
                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Box ID</label>
                                          <input
                                            type="text"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.box || ''}
                                            onChange={e => setEditForm({ ...editForm, box: e.target.value })}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Net Weight (lbs)</label>
                                          <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.netWeight ?? ''}
                                            onChange={e => setEditForm({ ...editForm, netWeight: e.target.value })}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Pieces (pcs)</label>
                                          <input
                                            type="number"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.pieces ?? ''}
                                            onChange={e => setEditForm({ ...editForm, pieces: e.target.value })}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Pallet</label>
                                          <input
                                            type="text"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.currentLocation || ''}
                                            onChange={e => setEditForm({ ...editForm, currentLocation: e.target.value })}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Location</label>
                                          <select
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.location || ''}
                                            onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                                          >
                                            <option value="">-- Choose Location --</option>
                                            {allLocationSuggestions.map(loc => (
                                              <option key={loc} value={loc}>
                                                {loc}
                                              </option>
                                            ))}
                                          </select>
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Serial Number</label>
                                          <input
                                            type="text"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono"
                                            value={editForm.serial || ''}
                                            onChange={e => setEditForm({ ...editForm, serial: e.target.value })}
                                          />
                                        </div>
                                          
                                        <div className="sm:col-span-2">
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Notes</label>
                                          <input
                                            type="text"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.notes || ''}
                                            onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Pack Date</label>
                                          <input
                                            type="text"
                                            placeholder="YYYY-MM-DD"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.packDate || ''}
                                            onChange={e => setEditForm({ ...editForm, packDate: e.target.value })}
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Lot Number</label>
                                          <input
                                            type="text"
                                            className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                                            value={editForm.lot || ''}
                                            onChange={e => setEditForm({ ...editForm, lot: e.target.value })}
                                          />
                                        </div>

                                        <div className="sm:col-span-2">
                                          <label className="block text-[10px] text-cool-gray-400 font-bold mb-1 uppercase">Item Tags</label>
                                          <div className="flex flex-wrap gap-1.5 pt-1">
                                            {(state.tags || []).map((tag: any) => {
                                              const isSelected = (editForm.tagIds || []).includes(tag.id);
                                              return (
                                                <button
                                                  key={tag.id}
                                                  type="button"
                                                  onClick={() => {
                                                    const current = editForm.tagIds || [];
                                                    const next = isSelected ? current.filter((id: string) => id !== tag.id) : [...current, tag.id];
                                                    setEditForm({ ...editForm, tagIds: next });
                                                  }}
                                                  style={{
                                                    backgroundColor: isSelected ? `${tag.color}25` : 'transparent',
                                                    borderColor: isSelected ? tag.color || '#60a5fa' : '#374151',
                                                    color: isSelected ? '#ffffff' : '#9ca3af'
                                                  }}
                                                  className="px-2 py-1 rounded text-xs border font-medium transition flex items-center gap-1.5 cursor-pointer select-none"
                                                >
                                                  <span className="w-2.5 h-2.5 rounded-full shrink-0 border" style={{ backgroundColor: tag.color || '#60a5fa', borderColor: isSelected ? '#ffffff' : 'transparent' }} />
                                                  <span>{tag.name}</span>
                                                  {isSelected && <span className="text-amber-400 font-black text-[10px]">✓</span>}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-750/50">
                                        <button
                                          onClick={() => setEditingItemId(null)}
                                          className="px-3 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-white rounded text-xs font-semibold transition cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleSaveItemEdit(item.id)}
                                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold transition cursor-pointer"
                                        >
                                          Save Changes
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr 
                              key={item.id} 
                              className={`transition-colors border-b border-cool-gray-800 text-sm ${
                                isFilteredOut 
                                  ? 'bg-amber-950/20 hover:bg-amber-900/25 text-cool-gray-400' 
                                  : 'bg-cool-gray-900/40 hover:bg-cool-gray-800/80'
                              } ${itemIdx === itemsToRender.length - 1 ? 'border-b border-cool-gray-750' : ''}`}
                            >
                              {(isDirectEdit || activeOrder) && (
                                <td 
                                  className={`py-1 px-2.5 text-center cursor-pointer select-none border-l-4 ${isFilteredOut ? 'border-l-amber-500/40 bg-amber-950/10' : 'border-l-emerald-500/30'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectItem(item.id, group.boxId, itemIdx, itemsToRender, e);
                                  }}
                                >
                                  <input 
                                    type="checkbox"
                                    className="rounded bg-cool-gray-900 border-cool-gray-750 text-blue-500 focus:ring-blue-500/50 cursor-pointer w-4 h-4"
                                    checked={selectedItemIds.has(item.id)}
                                    onChange={() => {}}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectItem(item.id, group.boxId, itemIdx, itemsToRender, e);
                                    }}
                                  />
                                </td>
                              )}
                              <td className={`py-1 px-2 w-8 ${!(isDirectEdit || activeOrder) ? `border-l-4 ${isFilteredOut ? 'border-l-amber-500/40 bg-amber-950/10' : 'border-l-emerald-500/30'}` : ''}`}></td>
                              {visibleColumns?.has('box') && (
                                <td className="py-1 px-2.5" style={{ width: columnWidths.box, minWidth: columnWidths.box, maxWidth: columnWidths.box }}>
                                  <div className="flex flex-wrap items-center gap-2 overflow-hidden">
                                    {isFilteredOut && (
                                      <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider select-none shrink-0" title="This item is normally hidden by your current filters">
                                        ⚠️ Hidden item
                                      </span>
                                    )}
                                    {isDirectEdit && (
                                      <>
                                        {deletingItemId === item.id ? (
                                          <div className="flex items-center gap-1 bg-red-950/40 p-1 rounded border border-red-500/30">
                                            <button onClick={() => handleDeleteItem(item.id)} className="bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">Yes</button>
                                            <button onClick={() => setDeletingItemId(null)} className="bg-cool-gray-700 hover:bg-cool-gray-600 text-white px-2 py-0.5 rounded text-[10px]">No</button>
                                          </div>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => {
                                                setEditingItemId(item.id);
                                                setEditForm({
                                                  cuts: item.cuts || '',
                                                  productId: item.productId || '',
                                                  originalCutName: item.originalCutName || '',
                                                  box: item.box || '',
                                                  serial: item.serial || '',
                                                  netWeight: item.netWeight || 0,
                                                  pieces: item.pieces || 0,
                                                  currentLocation: item.currentLocation || '',
                                                  location: item.location || '',
                                                  notes: item.notes || '',
                                                  packDate: item.packDate || '',
                                                  lot: item.lot || '',
                                                                                                  });
                                              }}
                                              className="p-1 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors shrink-0"
                                              title="Edit Item"
                                            ><Edit3 size={14} /></button>
                                            <button
                                              onClick={() => setDeletingItemId(item.id)}
                                              className="p-1 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                                              title="Delete Item"
                                            ><Trash2 size={14} /></button>
                                            <button
                                              onClick={() => {
                                                setWrongLabelItemId(item.id);
                                                setSelectedCorrectProductId(item.productId || '');
                                                setWrongLabelNotes(item.notes || '');
                                              }}
                                              className={`p-1 rounded transition-colors shrink-0 ${
                                                item.isWrongLabel || item.wrongLabel 
                                                  ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20 bg-red-950/40' 
                                                  : 'text-orange-500 hover:text-orange-400 hover:bg-orange-500/10'
                                              }`}
                                              title={item.isWrongLabel || item.wrongLabel ? `Wrong Label Corrected (Originally: ${item.wrongLabelOriginal || item.originalCutName}). Click to view or revert.` : "Labeled Wrong"}
                                            ><AlertTriangle size={14} /></button>
                                            {renderItemTagSelector(item)}
                                          </>
                                        )}
                                      </>
                                    )}
                                    {item.notes && (
                                      <span title={item.notes} className="text-cool-gray-400 cursor-help shrink-0"><FileText size={14} /></span>
                                    )}
                                    {item.tagIds && item.tagIds.length > 0 && (
                                      <div className="flex flex-wrap gap-1 shrink-0">
                                        {item.tagIds.map((tagId: string) => {
                                          const tag = state.tags?.find((t: any) => t.id === tagId);
                                          if (!tag) return null;
                                          return (
                                            <span
                                              key={tag.id}
                                              style={{ 
                                                backgroundColor: `${tag.color}15`, 
                                                borderColor: `${tag.color}35`, 
                                                color: tag.color || '#60a5fa' 
                                              }}
                                              className="inline-flex items-center gap-0.5 text-[8px] border px-1 py-0.2 rounded font-semibold uppercase select-none"
                                              title={tag.description || tag.name}
                                            >
                                              {tag.id === 'use-first' ? '🍳 ' : tag.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{tag.name}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )}
                              {visibleColumns?.has('cuts') && (
                                <td className="py-1 px-2.5" style={{ width: columnWidths.cuts, minWidth: columnWidths.cuts, maxWidth: columnWidths.cuts }}>
                                  <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => setQuickInfoItem(item)}
                                      className="text-left font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer select-none transition-colors duration-150 flex items-center gap-1 group truncate"
                                      title="Click for Product Quick Info & Lists"
                                    >
                                      <span>{(viewOriginalNames && item.originalCutName) ? item.originalCutName : item.cuts}</span>
                                    </button>
                                    {!viewOriginalNames && (item.isWrongLabel || item.wrongLabel || item.wrongLabelOriginal) && (
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setWrongLabelItemId(item.id);
                                          setSelectedCorrectProductId(item.productId || '');
                                          setWrongLabelNotes(item.notes || '');
                                        }}
                                        className="text-[10px] text-red-300 font-bold px-1.5 py-0.5 bg-red-950/70 border border-red-700/60 hover:bg-red-900/80 rounded shrink-0 max-w-[190px] truncate cursor-pointer transition shadow-xs flex items-center gap-1" 
                                        title={`Originally Labeled As: ${item.wrongLabelOriginal || item.originalCutName}. Click to edit or revert.`}
                                      >
                                        <AlertTriangle size={11} className="text-red-400 shrink-0" />
                                        <span className="truncate">Labeled: {item.wrongLabelOriginal || item.originalCutName}</span>
                                      </span>
                                    )}
                                    {/* Item Tag Badges in Cuts Column */}
                                    {item.tagIds && item.tagIds.length > 0 && (
                                      <div className="flex flex-wrap gap-1 items-center shrink-0">
                                        {item.tagIds.map((tagId: string) => {
                                          const tag = state.tags?.find((t: any) => t.id === tagId);
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
                                              title={`Tag: ${tag.description || tag.name}`}
                                            >
                                              {tag.id === 'use-first' ? '🍳 ' : tag.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{tag.name}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                    {/* Quick Tag Trigger if not in Direct Edit mode */}
                                    {!isDirectEdit && (
                                      <div className="shrink-0">
                                        {renderItemTagSelector(item)}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )}
                              {visibleColumns?.has('category') && (
                                <td className="py-1 px-2.5 text-[10px] text-cool-gray-500 font-bold uppercase tracking-wider" style={{ width: columnWidths.category, minWidth: columnWidths.category, maxWidth: columnWidths.category }}>
                                  <div className="truncate" title={`${item.primaryCategory} / ${item.subCategory}`}>
                                    <span>{item.primaryCategory}</span>
                                    <span className="text-cool-gray-600 mx-1 font-normal">/</span>
                                    <span className="italic normal-case text-cool-gray-600">{item.subCategory}</span>
                                  </div>
                                </td>
                              )}
                              {visibleColumns?.has('weight') && (
                                <td className="py-1 px-2.5 text-cool-gray-300 font-mono text-xs truncate" style={{ width: columnWidths.weight, minWidth: columnWidths.weight, maxWidth: columnWidths.weight }}>
                                  {item.netWeight.toFixed(2)}
                                </td>
                              )}
                              {visibleColumns?.has('pieces') && (
                                <td className="py-1 px-2.5 text-cool-gray-400 font-mono text-xs truncate" style={{ width: columnWidths.pieces, minWidth: columnWidths.pieces, maxWidth: columnWidths.pieces }}>
                                  {item.pieces}
                                </td>
                              )}
                              {visibleColumns?.has('location') && (
                                <td className="py-1 px-2.5 text-cool-gray-400 text-xs truncate" style={{ width: columnWidths.location, minWidth: columnWidths.location, maxWidth: columnWidths.location }}>
                                  {item.location || '-'}
                                </td>
                              )}
                              {visibleColumns?.has('pallet') && (
                                <td className="py-1 px-2.5 text-cool-gray-300 text-xs truncate" style={{ width: columnWidths.pallet, minWidth: columnWidths.pallet, maxWidth: columnWidths.pallet }}>
                                  {item.currentLocation || '-'}
                                </td>
                              )}
                              {showMovedTo && (
                                <td className="py-1 px-2.5 text-xs align-top" style={{ width: columnWidths.movedTo, minWidth: columnWidths.movedTo, maxWidth: columnWidths.movedTo }}>
                                  <div className="space-y-1 overflow-hidden">
                                    {(() => {
                                      const itemAllMoves = openOrdersMovementData.entryOrderMoves.get(item.id) || [];
                                      const isItemConflicted = openOrdersMovementData.conflictedEntryIds.has(item.id);
                                      const otherMoves = itemAllMoves.filter(m => !m.isCurrentOrder);

                                      return (
                                        <>
                                          {isItemConflicted && (
                                            <div className="flex items-center gap-1 text-[9px] font-black text-amber-300 bg-amber-500/25 px-1.5 py-0.5 rounded border border-amber-500/40 animate-pulse select-none">
                                              <AlertTriangle size={10} className="text-amber-400 shrink-0" />
                                              <span>In {itemAllMoves.length} open orders!</span>
                                            </div>
                                          )}

                                          {activeOrder ? (
                                            <select
                                              className="bg-blue-950/45 border border-blue-900/60 text-blue-300 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-blue-500 disabled:opacity-50 cursor-pointer w-full"
                                              value={itemTarget}
                                              onChange={(e) => updateMoveTargetItem(item.id, e.target.value)}
                                              disabled={activeOrder.status !== 'planning'}
                                            >
                                              <option value="">Staying put</option>
                                              {(activeOrder.targetDestinations || []).map((dest: any, idx: number) => (
                                                <option key={`item-opt-${item.id}-${dest.id}-${idx}`} value={dest.id}>
                                                  {dest.palletName ? `${dest.palletName} - ${dest.locationName}` : dest.locationName}
                                                </option>
                                              ))}
                                            </select>
                                          ) : null}

                                          {otherMoves.length > 0 && (
                                            <div className="space-y-0.5 pt-0.5">
                                              {otherMoves.map((om, omIdx) => (
                                                <div 
                                                  key={omIdx}
                                                  className="flex items-center justify-between gap-1 text-[9px] bg-amber-950/50 border border-amber-800/60 rounded px-1.5 py-0.5 text-amber-200"
                                                  title={`Assigned in ${om.orderName} (${om.orderStatus}) to ${om.destName}`}
                                                >
                                                  <span className="truncate font-semibold text-amber-300" title={om.orderName}>
                                                    📋 {om.orderName}
                                                  </span>
                                                  <span className="shrink-0 font-medium text-amber-200 truncate max-w-[85px]" title={om.destName}>
                                                    📍 {om.destName}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}

                                          {!activeOrder && otherMoves.length === 0 && (
                                            <span className="text-cool-gray-400 text-[11px]">-</span>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </td>
                              )}
                              {activeOrder && visibleColumns?.has('flag') && (
                                <td className="py-1 px-2.5 text-center" style={{ width: columnWidths.flag, minWidth: columnWidths.flag, maxWidth: columnWidths.flag }}>
                                  {renderFlagSelector(item.id, false)}
                                </td>
                              )}
                              {visibleColumns?.has('serial') && (
                                <td className="py-1 px-2.5 font-mono text-cool-gray-400 text-xs truncate" style={{ width: columnWidths.serial, minWidth: columnWidths.serial, maxWidth: columnWidths.serial }}>
                                  #{item.serial}
                                </td>
                              )}
                              {visibleColumns?.has('lotNumber') && (
                                <td className="py-1 px-2.5 text-cool-gray-400 text-xs truncate" style={{ width: columnWidths.lotNumber, minWidth: columnWidths.lotNumber, maxWidth: columnWidths.lotNumber }}>
                                  {item.lot || '-'}
                                </td>
                              )}
                              {visibleColumns?.has('packDate') && (
                                <td className="py-1 px-2.5 text-cool-gray-400 text-xs truncate" style={{ width: columnWidths.packDate, minWidth: columnWidths.packDate, maxWidth: columnWidths.packDate }}>
                                  {item.packDate || '-'}
                                </td>
                              )}
                            </tr>
                          );
                        });
                      })()}
                    </React.Fragment>
                    )}

                  </React.Fragment>
                );
              })}
              {condensed.length === 0 && (
                <tr>
                  <td colSpan={totalCols} className="p-12 text-center text-cool-gray-500">
                    No items found matching the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
          );
        })()}
      </div>

      {/* Add New Offsite Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-center items-center p-4">
          <div className="bg-cool-gray-900 rounded-xl shadow-2xl flex flex-col border border-cool-gray-750/70 w-full max-w-lg max-h-[85vh] animate-fade-in">
            <div className="flex justify-between items-center px-6 py-4 border-b border-cool-gray-800 shrink-0">
              <h2 className="text-lg font-bold text-cool-gray-100 flex items-center gap-2">
                <span className="text-emerald-500">➕</span> Add New Off-Site Item
              </h2>
              <button 
                onClick={() => setIsAddModalOpen(false)} 
                className="text-cool-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-cool-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="col-span-2">
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Correct Cut (Product Catalog)</label>
                  <select
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.productId || ''}
                    onChange={e => {
                      const prodId = e.target.value;
                      const prod = state.products.find((p: any) => p.id === prodId);
                      setNewItemForm({ 
                        ...newItemForm, 
                        productId: prodId,
                        cuts: prod ? prod.name : newItemForm.cuts,
                        tagIds: prod?.defaultTagIds ? [...prod.defaultTagIds] : (newItemForm.tagIds || [])
                      });
                    }}
                  >
                    <option value="">-- No Catalog Product Mapped --</option>
                    {state.products.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Custom Cut Name (Alternative) *</label>
                  <input
                    type="text"
                    list="products-datalist"
                    required
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.cuts || ''}
                    onChange={e => {
                      const val = e.target.value;
                      const matched = state.products?.find((p: any) => p.name.trim().toLowerCase() === val.trim().toLowerCase());
                      setNewItemForm((prev: any) => ({
                        ...prev,
                        cuts: val,
                        ...(matched && !prev.productId ? {
                          productId: matched.id,
                          tagIds: (prev.tagIds && prev.tagIds.length > 0) ? prev.tagIds : [...(matched.defaultTagIds || [])]
                        } : {})
                      }));
                    }}
                    placeholder="e.g. 14082 PORK TRIM"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Original Label (Wrong Label)</label>
                  <input
                    type="text"
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.originalCutName || ''}
                    onChange={e => setNewItemForm({ ...newItemForm, originalCutName: e.target.value })}
                    placeholder="Butcher Labeled As"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Box ID *</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.box || ''}
                    onChange={e => setNewItemForm({ ...newItemForm, box: e.target.value })}
                    placeholder="e.g. B-012"
                  />
                </div>

                <div>
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider font-mono">Serial (Auto if empty)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs font-mono"
                      value={newItemForm.serial || ''}
                      onChange={e => setNewItemForm({ ...newItemForm, serial: e.target.value })}
                      placeholder="e.g. 1234567"
                    />
                    <button
                      type="button"
                      onClick={() => setNewItemForm({ ...newItemForm, serial: Math.floor(1000000 + Math.random() * 9000000).toString() })}
                      className="px-2 py-1 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 border border-cool-gray-750 rounded text-[11px] font-semibold transition cursor-pointer"
                    >
                      Gen
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Net Weight (lbs) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.netWeight ?? ''}
                    onChange={e => setNewItemForm({ ...newItemForm, netWeight: e.target.value })}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Pieces (pcs) *</label>
                  <input
                    type="number"
                    required
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.pieces ?? ''}
                    onChange={e => setNewItemForm({ ...newItemForm, pieces: e.target.value })}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Pallet Name</label>
                  <input
                    type="text"
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.currentLocation || ''}
                    onChange={e => setNewItemForm({ ...newItemForm, currentLocation: e.target.value })}
                    placeholder="e.g. P3-03262026"
                  />
                </div>

                <div>
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">System Location</label>
                  <select
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.location || ''}
                    onChange={e => setNewItemForm({ ...newItemForm, location: e.target.value })}
                  >
                    <option value="">-- Choose Location --</option>
                    {allLocationSuggestions.map(loc => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Notes</label>
                  <input
                    type="text"
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.notes || ''}
                    onChange={e => setNewItemForm({ ...newItemForm, notes: e.target.value })}
                    placeholder="Any descriptive notes"
                  />
                </div>

                <div>
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Pack Date</label>
                  <input
                    type="text"
                    placeholder="YYYY-MM-DD"
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.packDate || ''}
                    onChange={e => setNewItemForm({ ...newItemForm, packDate: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs text-cool-gray-400 font-bold mb-1 uppercase tracking-wider">Lot Number</label>
                  <input
                    type="text"
                    className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-xs"
                    value={newItemForm.lot || ''}
                    onChange={e => setNewItemForm({ ...newItemForm, lot: e.target.value })}
                    placeholder="e.g. L-5432"
                  />
                </div>

                {state.tags && state.tags.length > 0 && (
                  <div className="col-span-2">
                    <label className="block text-xs text-cool-gray-400 font-bold mb-1.5 uppercase tracking-wider">Item Tags</label>
                    <div className="flex flex-wrap gap-1.5">
                      {state.tags.map((tag: any) => {
                        const isSelected = (newItemForm.tagIds || []).includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              const current = newItemForm.tagIds || [];
                              const next = isSelected ? current.filter((id: string) => id !== tag.id) : [...current, tag.id];
                              setNewItemForm({ ...newItemForm, tagIds: next });
                            }}
                            style={{
                              backgroundColor: isSelected ? `${tag.color}25` : 'transparent',
                              borderColor: isSelected ? tag.color || '#60a5fa' : '#374151',
                              color: isSelected ? '#ffffff' : '#9ca3af'
                            }}
                            className="text-[11px] px-2.5 py-1 rounded-full border transition font-medium flex items-center gap-1.5 cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color || '#60a5fa' }} />
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-cool-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewItem}
                disabled={!newItemForm.cuts || !newItemForm.box}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Off-Site Labeled Wrong Modal */}
      {wrongLabelItemId && wrongLabelItem && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-center items-center p-4">
          <div className="bg-cool-gray-900 rounded-xl shadow-2xl flex flex-col border border-cool-gray-750/70 w-full max-w-md animate-fade-in">
            <div className="flex justify-between items-center px-6 py-4 border-b border-cool-gray-800 shrink-0">
              <h2 className="text-lg font-bold text-cool-gray-100 flex items-center gap-2">
                <span className="text-orange-500">⚠️</span> Correct Wrong Label
              </h2>
              <button 
                onClick={() => {
                  setWrongLabelItemId(null);
                  setSelectedCorrectProductId('');
                  setWrongLabelNotes('');
                }} 
                className="text-cool-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-cool-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-cool-gray-400 font-medium">Current Label:</span>
                  <span className="text-cool-gray-100 font-bold">{wrongLabelItem.cuts || 'Unknown'}</span>
                </div>
                {wrongLabelItem.serial && (
                  <div className="flex justify-between">
                    <span className="text-cool-gray-400 font-medium">Serial / Barcode:</span>
                    <span className="text-cool-gray-100 font-mono font-semibold">{wrongLabelItem.serial}</span>
                  </div>
                )}
              </div>

              {(wrongLabelItem.isWrongLabel || wrongLabelItem.wrongLabel || wrongLabelItem.wrongLabelOriginal) && (
                <div className="p-3.5 bg-amber-950/40 border border-amber-600/50 rounded-xl flex items-center justify-between gap-3 text-xs shadow-inner">
                  <div className="text-cool-gray-200">
                    <span className="font-bold text-amber-400 flex items-center gap-1 mb-0.5">
                      <AlertTriangle size={13} className="text-amber-400" />
                      Wrong Label Correction Active
                    </span>
                    <div>Physical Box Label: <strong className="text-red-300">"{wrongLabelItem.wrongLabelOriginal || wrongLabelItem.originalCutName || 'Original Cut'}"</strong></div>
                    <div className="text-[11px] text-cool-gray-400 mt-0.5">Currently tracking as: <strong className="text-emerald-400">"{wrongLabelItem.cuts}"</strong></div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await dispatch({
                        type: 'REVERT_OFFSITE_LABEL',
                        payload: { entryId: wrongLabelItemId }
                      });
                      setWrongLabelItemId(null);
                      setSelectedCorrectProductId('');
                      setWrongLabelNotes('');
                    }}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-lg transition cursor-pointer shrink-0 shadow-md flex items-center gap-1.5"
                    title="Restore item back to original physical package label"
                  >
                    <RotateCcw size={13} />
                    Undo & Revert
                  </button>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs text-cool-gray-300 font-bold uppercase tracking-wider">
                  Correct Product (From Catalog)
                </label>
                <SearchableProductSelect
                  products={state.products}
                  value={selectedCorrectProductId}
                  onChange={setSelectedCorrectProductId}
                  placeholder="Search and select correct product..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs text-cool-gray-300 font-bold uppercase tracking-wider">
                  Correction Notes (Optional)
                </label>
                <textarea
                  className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-lg p-2.5 text-white focus:outline-none focus:ring-1 focus:ring-orange-500 text-xs placeholder:text-cool-gray-550 resize-none h-20"
                  value={wrongLabelNotes}
                  onChange={e => setWrongLabelNotes(e.target.value)}
                  placeholder="Add any details about why this label was incorrect..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-cool-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setWrongLabelItemId(null);
                  setSelectedCorrectProductId('');
                  setWrongLabelNotes('');
                }}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveWrongLabel}
                disabled={!selectedCorrectProductId}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
              >
                Apply Label Correction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Wrong Label Modal */}
      {isBulkWrongLabelModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-center items-center p-4">
          <div className="bg-cool-gray-900 rounded-xl shadow-2xl flex flex-col border border-cool-gray-750/70 w-full max-w-md animate-fade-in">
            <div className="flex justify-between items-center px-6 py-4 border-b border-cool-gray-800 shrink-0">
              <h2 className="text-lg font-bold text-cool-gray-100 flex items-center gap-2">
                <AlertTriangle size={18} className="text-purple-400" /> Bulk Labeled Wrong
              </h2>
              <button 
                onClick={() => setIsBulkWrongLabelModalOpen(false)} 
                className="text-cool-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-cool-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3.5 text-xs text-cool-gray-300">
                You are about to reassign 
                <span className="font-bold text-white px-1">
                  {selectedBoxIds.size > 0 && `${selectedBoxIds.size} Box${selectedBoxIds.size > 1 ? 'es' : ''}`}
                  {selectedBoxIds.size > 0 && selectedItemIds.size > 0 && ' & '}
                  {selectedItemIds.size > 0 && `${selectedItemIds.size} Item${selectedItemIds.size > 1 ? 's' : ''}`}
                </span>
                to a new product in the catalog. The old name will be preserved as "Originally Labeled As".
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-cool-gray-300 flex items-center justify-between">
                  <span>Correct Product <span className="text-red-400">*</span></span>
                </label>
                <SearchableProductSelect
                  products={products}
                  value={bulkWrongLabelProductId}
                  onChange={setBulkWrongLabelProductId}
                  placeholder="Select the correct product..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-bold text-cool-gray-300 flex items-center justify-between">
                  <span>Notes (Optional)</span>
                </label>
                <textarea
                  className="w-full bg-cool-gray-950 border border-cool-gray-750 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder-cool-gray-650 h-24 resize-none"
                  placeholder="E.g., Missing label, completely wrong product..."
                  value={bulkWrongLabelNotes}
                  onChange={e => setBulkWrongLabelNotes(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-2 p-6 border-t border-cool-gray-800 shrink-0 bg-cool-gray-950/25">
              <button 
                onClick={() => setIsBulkWrongLabelModalOpen(false)} 
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleExecuteBulkWrongLabel}
                disabled={!bulkWrongLabelProductId}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle size={14} /> Correct Labels
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-center items-center p-4">
          <div className="bg-cool-gray-900 rounded-xl shadow-2xl flex flex-col border border-cool-gray-750/70 w-full max-w-xl max-h-[85vh] animate-fade-in">
            <div className="flex justify-between items-center px-6 py-4 border-b border-cool-gray-800 shrink-0">
              <h2 className="text-lg font-bold text-cool-gray-100 flex items-center gap-2">
                <span className="text-amber-500">✏️</span> Bulk Edit (
                {selectedBoxIds.size > 0 && `${selectedBoxIds.size} Box${selectedBoxIds.size > 1 ? 'es' : ''}`}
                {selectedBoxIds.size > 0 && selectedItemIds.size > 0 && ' & '}
                {selectedItemIds.size > 0 && `${selectedItemIds.size} Item${selectedItemIds.size > 1 ? 's' : ''}`}
                )
              </h2>
              <button 
                onClick={() => setIsBulkEditModalOpen(false)} 
                className="text-cool-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-cool-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6 space-y-5">
              <p className="text-xs text-cool-gray-400 bg-cool-gray-950/60 p-3 rounded-lg border border-cool-gray-800/80 leading-relaxed">
                Check the checkbox next to any field you want to update in bulk across all selected boxes. Unchecked fields will remain untouched.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {/* Cuts */}
                <div className="flex items-start gap-3 md:col-span-2 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-cuts"
                    checked={bulkEditFieldsToUpdate.cuts}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, cuts: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-cuts" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Item / Cut Name
                    </label>
                    <input
                      type="text"
                      list="products-datalist"
                      disabled={!bulkEditFieldsToUpdate.cuts}
                      value={bulkEditForm.cuts || ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, cuts: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                      placeholder="e.g. 14082 PORK TRIM"
                    />
                  </div>
                </div>

                {/* Box ID */}
                <div className="flex items-start gap-3 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-box"
                    checked={bulkEditFieldsToUpdate.box}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, box: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-box" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Box ID
                    </label>
                    <input
                      type="text"
                      disabled={!bulkEditFieldsToUpdate.box}
                      value={bulkEditForm.box || ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, box: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-mono"
                      placeholder="e.g. B-012"
                    />
                  </div>
                </div>

                {/* Pallet Name */}
                <div className="flex items-start gap-3 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-pallet"
                    checked={bulkEditFieldsToUpdate.currentLocation}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, currentLocation: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-pallet" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Pallet Name
                    </label>
                    <input
                      type="text"
                      disabled={!bulkEditFieldsToUpdate.currentLocation}
                      value={bulkEditForm.currentLocation || ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, currentLocation: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                      placeholder="e.g. P3-0326"
                    />
                  </div>
                </div>

                {/* System Location */}
                <div className="flex items-start gap-3 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-location"
                    checked={bulkEditFieldsToUpdate.location}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, location: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-location" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      System Location
                    </label>
                    <select
                      disabled={!bulkEditFieldsToUpdate.location}
                      value={bulkEditForm.location || ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, location: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs cursor-pointer"
                    >
                      <option value="">-- Choose Location --</option>
                      {allLocationSuggestions.map(loc => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Notes */}
                <div className="flex items-start gap-3 md:col-span-2 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-notes"
                    checked={bulkEditFieldsToUpdate.notes}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, notes: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-notes" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Notes
                    </label>
                    <input
                      type="text"
                      disabled={!bulkEditFieldsToUpdate.notes}
                      value={bulkEditForm.notes || ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                      placeholder="e.g. Extra freezer wrapping"
                    />
                  </div>
                </div>

                {/* Pack Date */}
                <div className="flex items-start gap-3 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-packdate"
                    checked={bulkEditFieldsToUpdate.packDate}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, packDate: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-packdate" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Pack Date
                    </label>
                    <input
                      type="text"
                      placeholder="YYYY-MM-DD"
                      disabled={!bulkEditFieldsToUpdate.packDate}
                      value={bulkEditForm.packDate || ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, packDate: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                    />
                  </div>
                </div>

                {/* Lot Number */}
                <div className="flex items-start gap-3 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-lot"
                    checked={bulkEditFieldsToUpdate.lot}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, lot: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-lot" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Lot Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. L-5432"
                      disabled={!bulkEditFieldsToUpdate.lot}
                      value={bulkEditForm.lot || ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, lot: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                    />
                  </div>
                </div>

                {/* Net Weight */}
                <div className="flex items-start gap-3 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-weight"
                    checked={bulkEditFieldsToUpdate.netWeight}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, netWeight: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-weight" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Net Weight (lbs)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      disabled={!bulkEditFieldsToUpdate.netWeight}
                      value={bulkEditForm.netWeight ?? ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, netWeight: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                    />
                  </div>
                </div>

                {/* Pieces */}
                <div className="flex items-start gap-3 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-pieces"
                    checked={bulkEditFieldsToUpdate.pieces}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, pieces: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-pieces" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Pieces (pcs)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      disabled={!bulkEditFieldsToUpdate.pieces}
                      value={bulkEditForm.pieces ?? ''}
                      onChange={(e) => setBulkEditForm(prev => ({ ...prev, pieces: e.target.value }))}
                      className="w-full bg-cool-gray-950 border border-cool-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="flex items-start gap-3 md:col-span-2 bg-cool-gray-850/40 p-3 rounded-lg border border-cool-gray-800/50">
                  <input
                    type="checkbox"
                    id="bulk-update-tags"
                    checked={bulkEditFieldsToUpdate.tags}
                    onChange={(e) => setBulkEditFieldsToUpdate(prev => ({ ...prev, tags: e.target.checked }))}
                    className="mt-1 rounded bg-cool-gray-950 border-cool-gray-700 text-amber-500 focus:ring-amber-500/50 cursor-pointer w-4 h-4 shrink-0"
                  />
                  <div className="flex-1">
                    <label htmlFor="bulk-update-tags" className="block text-xs font-bold text-cool-gray-300 uppercase tracking-wider mb-1 cursor-pointer select-none">
                      Item Tags
                    </label>
                    <div className={`flex flex-wrap gap-1.5 pt-1 ${!bulkEditFieldsToUpdate.tags ? 'opacity-40 pointer-events-none' : ''}`}>
                      {(state.tags || []).map((tag: any) => {
                        const isSelected = (bulkEditForm.tagIds || []).includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            disabled={!bulkEditFieldsToUpdate.tags}
                            onClick={() => {
                              const current = bulkEditForm.tagIds || [];
                              const next = isSelected ? current.filter((id: string) => id !== tag.id) : [...current, tag.id];
                              setBulkEditForm((prev: any) => ({ ...prev, tagIds: next }));
                            }}
                            style={{
                              backgroundColor: isSelected ? `${tag.color}25` : 'transparent',
                              borderColor: isSelected ? tag.color || '#60a5fa' : '#374151',
                              color: isSelected ? '#ffffff' : '#9ca3af'
                            }}
                            className="px-2 py-1 rounded text-xs border font-medium transition flex items-center gap-1.5 cursor-pointer select-none"
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0 border" style={{ backgroundColor: tag.color || '#60a5fa', borderColor: isSelected ? '#ffffff' : 'transparent' }} />
                            <span>{tag.name}</span>
                            {isSelected && <span className="text-amber-400 font-black text-[10px]">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-cool-gray-800 shrink-0 bg-cool-gray-950/25">
              <button
                type="button"
                onClick={() => setIsBulkEditModalOpen(false)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkEdit}
                disabled={!Object.values(bulkEditFieldsToUpdate).some(Boolean)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Apply Bulk Edits
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirm Modal */}
      {isBulkDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex justify-center items-center p-4">
          <div className="bg-cool-gray-900 rounded-xl shadow-2xl flex flex-col border border-cool-gray-750/70 w-full max-w-md animate-fade-in">
            <div className="flex justify-between items-center px-6 py-4 border-b border-cool-gray-800 shrink-0">
              <h2 className="text-md font-bold text-red-400 flex items-center gap-2">
                <span className="text-red-500">⚠️</span> Bulk Delete Selected Items
              </h2>
              <button 
                onClick={() => setIsBulkDeleteConfirmOpen(false)} 
                className="text-cool-gray-400 hover:text-white transition cursor-pointer p-1 rounded-lg hover:bg-cool-gray-800"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-3">
              <p className="text-sm text-cool-gray-100 font-medium">
                Are you absolutely sure you want to permanently delete the <span className="text-red-400 font-bold">
                  {selectedBoxIds.size > 0 && `${selectedBoxIds.size} selected box${selectedBoxIds.size > 1 ? 'es' : ''} (with all items)`}
                  {selectedBoxIds.size > 0 && selectedItemIds.size > 0 && ' and '}
                  {selectedItemIds.size > 0 && `${selectedItemIds.size} selected item${selectedItemIds.size > 1 ? 's' : ''}`}
                </span>?
              </p>
              <p className="text-xs text-cool-gray-400 leading-relaxed">
                This action will delete all corresponding entries from the database. It is irreversible.
              </p>
            </div>

            <div className="flex justify-end gap-2 p-6 border-t border-cool-gray-800 bg-cool-gray-950/25">
              <button
                type="button"
                onClick={() => setIsBulkDeleteConfirmOpen(false)}
                className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteBulkDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <datalist id="products-datalist">
        {allCutSuggestions.map(s => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
};
