import React, { useState, useMemo, useEffect } from 'react';
import { InventoryState, Action } from '../types';
import { 
  SortOrderConfig, 
  loadSortOrderConfig, 
  saveSortOrderConfig, 
  naturalCompare,
  SortMode 
} from '../utils/sortOrder';
import { 
  ArrowUpDown, 
  ChevronUp, 
  ChevronDown, 
  ChevronsUp, 
  ChevronsDown, 
  RotateCcw, 
  Save, 
  Check, 
  X, 
  Layers, 
  FolderTree, 
  Sparkles,
  Info,
  GripVertical
} from 'lucide-react';

interface SortOrderModalProps {
  isOpen?: boolean;
  onClose: () => void;
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  initialView?: 'product' | 'display_case';
}

type TabLevel = 'primary' | 'sub' | 'products';

export const SortOrderModal: React.FC<SortOrderModalProps> = ({
  isOpen = true,
  onClose,
  state,
  dispatch,
  initialView = 'product'
}) => {
  const currentConfig = useMemo(() => loadSortOrderConfig(state.appConfig), [state.appConfig]);

  const [productSortMode, setProductSortMode] = useState<SortMode>(currentConfig.productSortMode);
  const [displaySortMode, setDisplaySortMode] = useState<SortMode>(currentConfig.displaySortMode);
  
  const [activeTab, setActiveTab] = useState<TabLevel>('primary');
  
  // Custom ordering state
  const [primaryOrder, setPrimaryOrder] = useState<string[]>([]);
  const [selectedPrimary, setSelectedPrimary] = useState<string>('');
  
  const [subOrderMap, setSubOrderMap] = useState<Record<string, string[]>>({});
  const [selectedSub, setSelectedSub] = useState<string>('');

  const [productOrderMap, setProductOrderMap] = useState<Record<string, string[]>>({});

  // Drag and drop state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Extract all categories, subcategories, and products from current state
  const inventoryHierarchy = useMemo(() => {
    const primarySet = new Set<string>();
    const subMap: Record<string, Set<string>> = {};
    const prodMap: Record<string, Set<string>> = {}; // key: primary:::sub

    // From products catalog
    (state.products || []).forEach(p => {
      const prim = (p.primaryCategory || 'Uncategorized').trim();
      const sub = (p.subCategory || 'General').trim();
      if (prim) {
        primarySet.add(prim);
        if (!subMap[prim]) subMap[prim] = new Set();
        if (sub) {
          subMap[prim].add(sub);
          const key = `${prim}:::${sub}`;
          if (!prodMap[key]) prodMap[key] = new Set();
          if (p.name) prodMap[key].add(p.name.trim());
        }
      }
    });

    // From registered categories catalog
    (state.categories || []).forEach(c => {
      if (c.type === 'primary' && c.name?.trim()) {
        primarySet.add(c.name.trim());
      } else if (c.type === 'sub' && c.name?.trim() && c.parentPrimary?.trim()) {
        const prim = c.parentPrimary.trim();
        primarySet.add(prim);
        if (!subMap[prim]) subMap[prim] = new Set();
        subMap[prim].add(c.name.trim());
      }
    });

    return {
      allPrimaries: Array.from(primarySet).sort(naturalCompare),
      allSubs: Object.fromEntries(
        Object.entries(subMap).map(([k, set]) => [k, Array.from(set).sort(naturalCompare)])
      ),
      allProducts: Object.fromEntries(
        Object.entries(prodMap).map(([k, set]) => [k, Array.from(set).sort(naturalCompare)])
      )
    };
  }, [state.products, state.categories]);

  // Initialize or re-sync local state when modal opens or config changes
  useEffect(() => {
    if (!isOpen) return;

    setProductSortMode(currentConfig.productSortMode);
    setDisplaySortMode(currentConfig.displaySortMode);

    // Build merged primary order (saved custom items first, then any unlisted inventory primaries)
    const savedPrimaries = currentConfig.customOrder.primaryCategories || [];
    const mergedPrimaries = [
      ...savedPrimaries.filter(p => inventoryHierarchy.allPrimaries.includes(p)),
      ...inventoryHierarchy.allPrimaries.filter(p => !savedPrimaries.includes(p))
    ];
    setPrimaryOrder(mergedPrimaries.length > 0 ? mergedPrimaries : inventoryHierarchy.allPrimaries);

    // Initial selected primary
    const initialPrimary = (mergedPrimaries.length > 0 ? mergedPrimaries[0] : inventoryHierarchy.allPrimaries[0]) || '';
    setSelectedPrimary(prev => prev && mergedPrimaries.includes(prev) ? prev : initialPrimary);

    // Build merged subcategories map
    const mergedSubMap: Record<string, string[]> = {};
    inventoryHierarchy.allPrimaries.forEach(prim => {
      const knownSubs = inventoryHierarchy.allSubs[prim] || [];
      const savedSubs = currentConfig.customOrder.subCategories?.[prim] || [];
      mergedSubMap[prim] = [
        ...savedSubs.filter(s => knownSubs.includes(s)),
        ...knownSubs.filter(s => !savedSubs.includes(s))
      ];
    });
    setSubOrderMap(mergedSubMap);

    // Build merged products map
    const mergedProdMap: Record<string, string[]> = {};
    Object.keys(inventoryHierarchy.allProducts).forEach(key => {
      const knownProds = inventoryHierarchy.allProducts[key] || [];
      const savedProds = currentConfig.customOrder.productOrder?.[key] || [];
      mergedProdMap[key] = [
        ...savedProds.filter(p => knownProds.includes(p)),
        ...knownProds.filter(p => !savedProds.includes(p))
      ];
    });
    setProductOrderMap(mergedProdMap);

    // Initial selected subcategory
    const subsForPrimary = mergedSubMap[initialPrimary] || [];
    setSelectedSub(subsForPrimary[0] || '');
  }, [isOpen, currentConfig, inventoryHierarchy]);

  // Keep selectedSub updated when selectedPrimary changes
  useEffect(() => {
    if (selectedPrimary) {
      const subs = subOrderMap[selectedPrimary] || inventoryHierarchy.allSubs[selectedPrimary] || [];
      if (subs.length > 0 && (!selectedSub || !subs.includes(selectedSub))) {
        setSelectedSub(subs[0]);
      }
    }
  }, [selectedPrimary, subOrderMap, inventoryHierarchy.allSubs, selectedSub]);

  // Clear drag state when switching tabs or categories
  useEffect(() => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  }, [activeTab, selectedPrimary, selectedSub]);

  if (!isOpen) return null;

  // Drag and drop reordering function
  const handleReorder = (fromIndex: number, toIndex: number, listType: TabLevel) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (listType === 'primary') {
      setPrimaryOrder(prev => {
        if (fromIndex >= prev.length || toIndex >= prev.length) return prev;
        const next = [...prev];
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return next;
      });
    } else if (listType === 'sub') {
      if (!selectedPrimary) return;
      setSubOrderMap(prev => {
        const currentList = prev[selectedPrimary] || [];
        if (fromIndex >= currentList.length || toIndex >= currentList.length) return prev;
        const next = [...currentList];
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return { ...prev, [selectedPrimary]: next };
      });
    } else if (listType === 'products') {
      if (!currentHierarchyKey) return;
      setProductOrderMap(prev => {
        const currentList = prev[currentHierarchyKey] || [];
        if (fromIndex >= currentList.length || toIndex >= currentList.length) return prev;
        const next = [...currentList];
        const [item] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, item);
        return { ...prev, [currentHierarchyKey]: next };
      });
    }
  };

  // Reorder utility
  const moveItem = <T,>(list: T[], index: number, direction: 'up' | 'down' | 'top' | 'bottom'): T[] => {
    if (index < 0 || index >= list.length) return list;
    const next = [...list];
    const item = next.splice(index, 1)[0];
    if (direction === 'top') {
      next.unshift(item);
    } else if (direction === 'bottom') {
      next.push(item);
    } else if (direction === 'up') {
      const targetIndex = Math.max(0, index - 1);
      next.splice(targetIndex, 0, item);
    } else if (direction === 'down') {
      const targetIndex = Math.min(next.length, index + 1);
      next.splice(targetIndex, 0, item);
    }
    return next;
  };

  // Handlers for Primary Categories
  const handleMovePrimary = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    setPrimaryOrder(prev => moveItem(prev, index, direction));
  };

  const handleResetPrimariesAZ = () => {
    setPrimaryOrder(prev => [...prev].sort(naturalCompare));
  };

  // Handlers for Subcategories
  const currentSubs = selectedPrimary ? (subOrderMap[selectedPrimary] || []) : [];
  const handleMoveSub = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (!selectedPrimary) return;
    const updated = moveItem(currentSubs, index, direction);
    setSubOrderMap(prev => ({
      ...prev,
      [selectedPrimary]: updated
    }));
  };

  const handleResetSubsAZ = () => {
    if (!selectedPrimary) return;
    setSubOrderMap(prev => ({
      ...prev,
      [selectedPrimary]: [...currentSubs].sort(naturalCompare)
    }));
  };

  // Handlers for Products / Cuts
  const currentHierarchyKey = `${selectedPrimary}:::${selectedSub}`;
  const currentProducts = currentHierarchyKey ? (productOrderMap[currentHierarchyKey] || []) : [];
  const handleMoveProduct = (index: number, direction: 'up' | 'down' | 'top' | 'bottom') => {
    if (!currentHierarchyKey) return;
    const updated = moveItem(currentProducts, index, direction);
    setProductOrderMap(prev => ({
      ...prev,
      [currentHierarchyKey]: updated
    }));
  };

  const handleResetProductsAZ = () => {
    if (!currentHierarchyKey) return;
    setProductOrderMap(prev => ({
      ...prev,
      [currentHierarchyKey]: [...currentProducts].sort(naturalCompare)
    }));
  };

  // Save all custom orders to server and DB
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const newConfig: SortOrderConfig = {
      productSortMode,
      displaySortMode,
      customOrder: {
        primaryCategories: primaryOrder,
        subCategories: subOrderMap,
        productOrder: productOrderMap
      }
    };

    const success = await saveSortOrderConfig(newConfig);
    setIsSaving(false);

    if (success) {
      setSaveSuccess(true);
      // Update appConfig in local state
      const currentConfigs = state.appConfig || [];
      const updatedConfigs = [
        ...currentConfigs.filter(c => c.key !== 'sort-hierarchy-config'),
        { key: 'sort-hierarchy-config', value: JSON.stringify(newConfig), updatedAt: new Date().toISOString() }
      ];
      dispatch({
        type: 'REPLACE_STATE',
        payload: {
          ...state,
          appConfig: updatedConfigs
        }
      });
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2500);
    }
  };

  return (
    <div className="flex flex-col space-y-4 text-cool-gray-200">
      {/* View Sort Mode Toggles Bar */}
      <div className="bg-cool-gray-850/80 border border-cool-gray-750 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-4 flex-wrap text-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-cool-gray-300">Products View:</span>
              <div className="inline-flex rounded-lg bg-cool-gray-950 p-0.5 border border-cool-gray-750">
                <button
                  type="button"
                  onClick={() => setProductSortMode('alphabetical')}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    productSortMode === 'alphabetical'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-cool-gray-400 hover:text-cool-gray-200'
                  }`}
                >
                  Alphabetical (A-Z)
                </button>
                <button
                  type="button"
                  onClick={() => setProductSortMode('custom')}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
                    productSortMode === 'custom'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-cool-gray-400 hover:text-cool-gray-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-cyan-300" />
                  Custom Order
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-extrabold text-cool-gray-300">Display Case:</span>
              <div className="inline-flex rounded-lg bg-cool-gray-950 p-0.5 border border-cool-gray-750">
                <button
                  type="button"
                  onClick={() => setDisplaySortMode('alphabetical')}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                    displaySortMode === 'alphabetical'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-cool-gray-400 hover:text-cool-gray-200'
                  }`}
                >
                  Alphabetical (A-Z)
                </button>
                <button
                  type="button"
                  onClick={() => setDisplaySortMode('custom')}
                  className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer flex items-center gap-1 ${
                    displaySortMode === 'custom'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-cool-gray-400 hover:text-cool-gray-200'
                  }`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Custom Order
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-cyan-400/90 font-medium flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            <span>Saved to SQLite &amp; Backups</span>
          </div>
        </div>

        {/* Hierarchy Level Tabs */}
        <div className="flex border-b border-cool-gray-800 bg-cool-gray-900/60 px-4 pt-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('primary')}
            className={`pb-2.5 px-3.5 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'primary'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-cool-gray-400 hover:text-cool-gray-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>1. Primary Categories ({primaryOrder.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sub')}
            className={`pb-2.5 px-3.5 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'sub'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-cool-gray-400 hover:text-cool-gray-200'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            <span>2. Subcategories</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`pb-2.5 px-3.5 text-xs font-black border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'products'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-cool-gray-400 hover:text-cool-gray-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>3. Cuts &amp; Products</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* TAB 1: PRIMARY CATEGORIES */}
          {activeTab === 'primary' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 pb-1">
                <div>
                  <h4 className="text-sm font-black text-white">Primary Categories Order</h4>
                  <p className="text-xs text-cool-gray-400">
                    Drag and drop rows or use arrows to place major categories in your desired display sequence (e.g. Beef &gt; Pork &gt; Poultry).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetPrimariesAZ}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 border border-cool-gray-700 transition flex items-center gap-1.5 cursor-pointer"
                  title="Alphabetize Primary Categories"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sort A-Z</span>
                </button>
              </div>

              {primaryOrder.length === 0 ? (
                <div className="text-center py-10 bg-cool-gray-950/40 rounded-xl border border-cool-gray-800 text-cool-gray-500 text-xs">
                  No primary categories found in inventory.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {primaryOrder.map((catName, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === primaryOrder.length - 1;
                    const dec = state.categories?.find(c => c.type === 'primary' && c.name.toLowerCase().trim() === catName.toLowerCase().trim());
                    const isDraggingThis = draggedIdx === idx;
                    const isDragOverThis = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;

                    return (
                      <div
                        key={catName}
                        draggable={true}
                        onDragStart={(e) => {
                          setDraggedIdx(idx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(idx));
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverIdx !== idx) {
                            setDragOverIdx(idx);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          if (dragOverIdx === idx) {
                            setDragOverIdx(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = draggedIdx !== null ? draggedIdx : parseInt(e.dataTransfer.getData('text/plain'), 10);
                          if (!isNaN(from) && from !== idx) {
                            handleReorder(from, idx, 'primary');
                          }
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                        }}
                        onDragEnd={() => {
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                        }}
                        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all shadow-xs select-none ${
                          isDraggingThis
                            ? 'opacity-40 bg-cool-gray-900 border-dashed border-cyan-500 scale-[0.99]'
                            : isDragOverThis
                            ? 'bg-cyan-950/40 border-cyan-400 ring-2 ring-cyan-500/40 -translate-y-0.5'
                            : 'bg-cool-gray-850 border-cool-gray-750 hover:border-cool-gray-650 hover:bg-cool-gray-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div 
                            className="p-1 text-cool-gray-500 hover:text-cyan-400 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                            title="Drag and drop to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <span className="w-6 h-6 rounded-full bg-cool-gray-900 border border-cool-gray-750 text-[11px] font-black text-cyan-400 flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex items-center gap-2 min-w-0">
                            {dec?.icon && <span className="text-base select-none">{dec.icon}</span>}
                            <span className="font-bold text-sm text-cool-gray-100 truncate">{catName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMovePrimary(idx, 'top')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move to Top"
                          >
                            <ChevronsUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePrimary(idx, 'up')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePrimary(idx, 'down')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMovePrimary(idx, 'bottom')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move to Bottom"
                          >
                            <ChevronsDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SUBCATEGORIES */}
          {activeTab === 'sub' && (
            <div className="space-y-4">
              {/* Primary Category Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-cool-gray-950/60 rounded-xl border border-cool-gray-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-cool-gray-400">Primary Category:</span>
                  <select
                    value={selectedPrimary}
                    onChange={(e) => setSelectedPrimary(e.target.value)}
                    className="bg-cool-gray-900 text-cyan-300 text-xs font-bold rounded-lg border border-cool-gray-700 py-1.5 px-3 outline-none cursor-pointer focus:border-cyan-500"
                  >
                    {primaryOrder.map(prim => (
                      <option key={prim} value={prim}>{prim}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleResetSubsAZ}
                  disabled={currentSubs.length <= 1}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 border border-cool-gray-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  title="Alphabetize Subcategories for selected primary category"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sort A-Z</span>
                </button>
              </div>

              {currentSubs.length === 0 ? (
                <div className="text-center py-10 bg-cool-gray-950/40 rounded-xl border border-cool-gray-800 text-cool-gray-500 text-xs">
                  No subcategories found for "{selectedPrimary}".
                </div>
              ) : (
                <div className="space-y-1.5">
                  {currentSubs.map((subName, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === currentSubs.length - 1;
                    const dec = state.categories?.find(c => c.type === 'sub' && c.name.toLowerCase().trim() === subName.toLowerCase().trim() && c.parentPrimary?.toLowerCase().trim() === selectedPrimary.toLowerCase().trim());
                    const isDraggingThis = draggedIdx === idx;
                    const isDragOverThis = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;

                    return (
                      <div
                        key={subName}
                        draggable={true}
                        onDragStart={(e) => {
                          setDraggedIdx(idx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(idx));
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverIdx !== idx) {
                            setDragOverIdx(idx);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          if (dragOverIdx === idx) {
                            setDragOverIdx(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = draggedIdx !== null ? draggedIdx : parseInt(e.dataTransfer.getData('text/plain'), 10);
                          if (!isNaN(from) && from !== idx) {
                            handleReorder(from, idx, 'sub');
                          }
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                        }}
                        onDragEnd={() => {
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                        }}
                        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all shadow-xs select-none ${
                          isDraggingThis
                            ? 'opacity-40 bg-cool-gray-900 border-dashed border-amber-500 scale-[0.99]'
                            : isDragOverThis
                            ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-500/40 -translate-y-0.5'
                            : 'bg-cool-gray-850 border-cool-gray-750 hover:border-cool-gray-650 hover:bg-cool-gray-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div 
                            className="p-1 text-cool-gray-500 hover:text-amber-400 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                            title="Drag and drop to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <span className="w-6 h-6 rounded-full bg-cool-gray-900 border border-cool-gray-750 text-[11px] font-black text-amber-400 flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex items-center gap-2 min-w-0">
                            {dec?.icon && <span className="text-base select-none">{dec.icon}</span>}
                            <span className="font-bold text-sm text-cool-gray-100 truncate">{subName}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveSub(idx, 'top')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move to Top"
                          >
                            <ChevronsUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSub(idx, 'up')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSub(idx, 'down')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSub(idx, 'bottom')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move to Bottom"
                          >
                            <ChevronsDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CUTS & PRODUCTS */}
          {activeTab === 'products' && (
            <div className="space-y-4">
              {/* Primary + Sub Selector */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-cool-gray-950/60 rounded-xl border border-cool-gray-800">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-cool-gray-400">Category:</span>
                    <select
                      value={selectedPrimary}
                      onChange={(e) => setSelectedPrimary(e.target.value)}
                      className="bg-cool-gray-900 text-cyan-300 text-xs font-bold rounded-lg border border-cool-gray-700 py-1.5 px-3 outline-none cursor-pointer focus:border-cyan-500"
                    >
                      {primaryOrder.map(prim => (
                        <option key={prim} value={prim}>{prim}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-cool-gray-400">Subcategory:</span>
                    <select
                      value={selectedSub}
                      onChange={(e) => setSelectedSub(e.target.value)}
                      className="bg-cool-gray-900 text-amber-300 text-xs font-bold rounded-lg border border-cool-gray-700 py-1.5 px-3 outline-none cursor-pointer focus:border-amber-500"
                    >
                      {currentSubs.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleResetProductsAZ}
                  disabled={currentProducts.length <= 1}
                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 border border-cool-gray-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  title="Alphabetize products for this subcategory"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sort A-Z</span>
                </button>
              </div>

              {currentProducts.length === 0 ? (
                <div className="text-center py-10 bg-cool-gray-950/40 rounded-xl border border-cool-gray-800 text-cool-gray-500 text-xs">
                  No cuts or products found in "{selectedPrimary} &gt; {selectedSub}".
                </div>
              ) : (
                <div className="space-y-1.5">
                  {currentProducts.map((prodName, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === currentProducts.length - 1;
                    const isDraggingThis = draggedIdx === idx;
                    const isDragOverThis = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;

                    return (
                      <div
                        key={prodName}
                        draggable={true}
                        onDragStart={(e) => {
                          setDraggedIdx(idx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(idx));
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverIdx !== idx) {
                            setDragOverIdx(idx);
                          }
                        }}
                        onDragLeave={(e) => {
                          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                          if (dragOverIdx === idx) {
                            setDragOverIdx(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const from = draggedIdx !== null ? draggedIdx : parseInt(e.dataTransfer.getData('text/plain'), 10);
                          if (!isNaN(from) && from !== idx) {
                            handleReorder(from, idx, 'products');
                          }
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                        }}
                        onDragEnd={() => {
                          setDraggedIdx(null);
                          setDragOverIdx(null);
                        }}
                        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all shadow-xs select-none ${
                          isDraggingThis
                            ? 'opacity-40 bg-cool-gray-900 border-dashed border-emerald-500 scale-[0.99]'
                            : isDragOverThis
                            ? 'bg-emerald-950/40 border-emerald-400 ring-2 ring-emerald-500/40 -translate-y-0.5'
                            : 'bg-cool-gray-850 border-cool-gray-750 hover:border-cool-gray-650 hover:bg-cool-gray-800/80'
                        }`}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <div 
                            className="p-1 text-cool-gray-500 hover:text-emerald-400 cursor-grab active:cursor-grabbing shrink-0 transition-colors"
                            title="Drag and drop to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </div>
                          <span className="w-6 h-6 rounded-full bg-cool-gray-900 border border-cool-gray-750 text-[11px] font-black text-emerald-400 flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-sm text-cool-gray-100 truncate">{prodName}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveProduct(idx, 'top')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move to Top"
                          >
                            <ChevronsUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveProduct(idx, 'up')}
                            disabled={isFirst}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move Up"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveProduct(idx, 'down')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move Down"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveProduct(idx, 'bottom')}
                            disabled={isLast}
                            className="p-1.5 rounded-lg bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Move to Bottom"
                          >
                            <ChevronsDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-cool-gray-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-fade-in">
                <Check className="w-4 h-4" /> Saved Successfully!
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Done
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-950/30 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Order'}</span>
            </button>
          </div>
        </div>
    </div>
  );
};
