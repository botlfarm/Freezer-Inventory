import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { InventoryState, Action } from '../types';

interface ProductQuickInfoModalProps {
  quickInfoItem: { cuts?: string; productId?: string } | null;
  onClose: () => void;
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  onFilterPallets?: (pallet: string) => void;
  onFilterLocations?: (location: string) => void;
}

export const ProductQuickInfoModal: React.FC<ProductQuickInfoModalProps> = ({
  quickInfoItem,
  onClose,
  state,
  dispatch,
  onFilterPallets,
  onFilterLocations,
}) => {
  if (!quickInfoItem) return null;

  let cutsStr = quickInfoItem.cuts || '';
  const productId = quickInfoItem.productId || '';

  let matchedProduct = null;
  if (productId) {
    matchedProduct = (state.products || []).find((p: any) => p.id === productId);
  }

  if (!matchedProduct && cutsStr) {
    let itemNumber = '';
    let namePart = cutsStr;
    const match = cutsStr.match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
    if (match) {
      itemNumber = match[1];
      namePart = match[2];
    }

    matchedProduct = (state.products || []).find((p: any) => 
      (itemNumber && p.productNumbers?.includes(itemNumber)) || 
      p.name.toLowerCase() === namePart.toLowerCase() ||
      p.name.toLowerCase() === cutsStr.toLowerCase()
    );
  }

  // Normalize details
  let itemNumber = '';
  let namePart = '';

  if (matchedProduct) {
    // If the original cut string has an item number and it's in the product's numbers, preserve it!
    const originalMatch = (quickInfoItem.cuts || '').match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
    const originalItemNum = originalMatch ? originalMatch[1] : '';
    if (originalItemNum && matchedProduct.productNumbers?.includes(originalItemNum)) {
      itemNumber = originalItemNum;
    } else {
      itemNumber = matchedProduct.productNumbers?.[0] || '';
    }
    namePart = matchedProduct.name;
    cutsStr = itemNumber ? `${itemNumber} ${namePart}` : namePart;
  } else if (cutsStr) {
    const match = cutsStr.match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
    if (match) {
      itemNumber = match[1];
      namePart = match[2];
    } else {
      namePart = cutsStr;
    }
  } else {
    namePart = 'Unspecified Item';
  }

  // Calculate On-site quantities
  const onSiteCuts = matchedProduct 
    ? (state.meatCuts || []).filter((mc: any) => mc.productId === matchedProduct.id) 
    : [];
  const totalOnSiteQty = onSiteCuts.reduce((sum: number, mc: any) => sum + (mc.quantity || 0), 0);

  // Group on-site locations
  const onSiteStorageBreakdown = onSiteCuts.map((mc: any) => {
    const container = state.containers?.find((c: any) => c.id === mc.containerId);
    const freezer = container ? state.freezers?.find((f: any) => f.id === container.freezerId) : null;
    return {
      freezerName: freezer ? freezer.name : 'Unplaced',
      containerName: container ? container.name : 'Unknown Container',
      containerId: container?.id || '',
      quantity: mc.quantity || 0,
      notes: mc.notes || ''
    };
  }).filter((x: any) => x.quantity > 0);

  // Calculate Off-site quantities (match by matchedProduct OR cuts string fallback)
  const matchingOffsiteEntries = (state.offSiteEntries || []).filter((e: any) => {
    if (e.archived) return false;
    if (e.box && state.containers?.some((c: any) => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
      return false;
    }

    if (matchedProduct) {
      // 1. Direct product ID link
      if (e.productId && e.productId === matchedProduct.id) {
        return true;
      }

      const cutsStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || e.cuts || '').trim();
      const origStr = (e.originalCutName || '').trim();
      const normStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || '').trim();
      const pNameLower = matchedProduct.name.trim().toLowerCase();

      // 2. Direct name match
      if (
        (normStr && normStr.toLowerCase() === pNameLower) ||
        (cutsStr && cutsStr.toLowerCase() === pNameLower) ||
        (origStr && origStr.toLowerCase() === pNameLower) ||
        (e.cuts && e.cuts.toLowerCase() === pNameLower)
      ) {
        return true;
      }

      // 3. Product numbers match
      const matchNum = (str: string) => {
        const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
        return m ? m[1] : null;
      };
      const cutsNum = matchNum(cutsStr);
      const origNum = matchNum(origStr);
      const eCutsNum = e.cuts ? matchNum(e.cuts) : null;
      if (matchedProduct.productNumbers && matchedProduct.productNumbers.length > 0) {
        if (
          (cutsNum && matchedProduct.productNumbers.some((num: string) => num.toLowerCase() === cutsNum.toLowerCase())) ||
          (origNum && matchedProduct.productNumbers.some((num: string) => num.toLowerCase() === origNum.toLowerCase())) ||
          (eCutsNum && matchedProduct.productNumbers.some((num: string) => num.toLowerCase() === eCutsNum.toLowerCase()))
        ) {
          return true;
        }
      }

      // 4. Cleaned name match (stripping leading item numbers)
      const cleanName = (str: string) => str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
      const cleanCuts = cleanName(cutsStr);
      const cleanOrig = cleanName(origStr);
      const cleanNorm = cleanName(normStr);
      const cleanECuts = e.cuts ? cleanName(e.cuts) : '';

      if (
        (cleanCuts && cleanCuts === pNameLower) ||
        (cleanOrig && cleanOrig === pNameLower) ||
        (cleanNorm && cleanNorm === pNameLower) ||
        (cleanECuts && cleanECuts === pNameLower)
      ) {
        return true;
      }

      return false;
    } else {
      const searchTarget = (quickInfoItem.cuts || '').trim().toLowerCase();
      if (!searchTarget) return false;
      const cleanName = (str: string) => str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
      const cleanTarget = cleanName(searchTarget);
      
      const eCuts = (e.cuts || '').trim().toLowerCase();
      const eOrig = (e.originalCutName || '').trim().toLowerCase();
      return (
        eCuts === searchTarget ||
        eOrig === searchTarget ||
        cleanName(eCuts) === cleanTarget ||
        cleanName(eOrig) === cleanTarget
      );
    }
  });

  const totalOffSitePieces = matchingOffsiteEntries.reduce((sum: number, e: any) => sum + (e.pieces || 0), 0);
  const totalOffSiteWeight = matchingOffsiteEntries.reduce((sum: number, e: any) => sum + (e.netWeight || 0), 0);

  // Group off-site locations
  const offSiteStorageMap: Record<string, { pallet: string; location: string; pieces: number; weight: number; boxLabels: Set<string> }> = {};
  matchingOffsiteEntries.forEach((e: any) => {
    const pallet = e.currentLocation || 'Unknown Pallet';
    const location = e.location || 'Unknown Location';
    const key = `${pallet}::${location}`;
    if (!offSiteStorageMap[key]) {
      offSiteStorageMap[key] = { pallet, location, pieces: 0, weight: 0, boxLabels: new Set() };
    }
    offSiteStorageMap[key].pieces += e.pieces || 0;
    offSiteStorageMap[key].weight += e.netWeight || 0;
    if (e.box) offSiteStorageMap[key].boxLabels.add(e.box);
  });
  const offSiteStorageBreakdown = Object.values(offSiteStorageMap);

  const [isRegisteredLocal, setIsRegisteredLocal] = useState<boolean>(() => !!matchedProduct);
  const [localListState, setLocalListState] = useState<Record<string, { isOnList: boolean; notes: string }>>(() => {
    const initial: Record<string, { isOnList: boolean; notes: string }> = {};
    (state.customLists || []).forEach((list: any) => {
      const item = matchedProduct ? list.items.find((it: any) => it.productId === matchedProduct.id) : null;
      initial[list.id] = {
        isOnList: !!item,
        notes: item?.notes || ''
      };
    });
    return initial;
  });

  const handleToggleList = (listId: string) => {
    if (!isRegisteredLocal) {
      setIsRegisteredLocal(true);
    }
    setLocalListState(prev => {
      const current = prev[listId] || { isOnList: false, notes: '' };
      return {
        ...prev,
        [listId]: {
          ...current,
          isOnList: !current.isOnList
        }
      };
    });
  };

  const handleNoteChange = (listId: string, notes: string) => {
    setLocalListState(prev => {
      const current = prev[listId] || { isOnList: false, notes: '' };
      return {
        ...prev,
        [listId]: {
          ...current,
          notes
        }
      };
    });
  };

  const handleRegisterProductOnly = () => {
    setIsRegisteredLocal(true);
  };

  const handleSave = () => {
    let targetProductId = matchedProduct?.id;

    if (!matchedProduct && isRegisteredLocal) {
      targetProductId = 'prod-' + crypto.randomUUID();
      const newProduct = {
        id: targetProductId,
        name: namePart || cutsStr || 'Unmapped Cut',
        primaryCategory: 'Off-Site',
        subCategory: 'Unmapped',
        productNumbers: itemNumber ? [itemNumber] : []
      };
      dispatch({ type: 'ADD_PRODUCT', payload: { product: newProduct } });
    }

    if (targetProductId) {
      (state.customLists || []).forEach((list: any) => {
        const initialItem = matchedProduct ? list.items.find((it: any) => it.productId === matchedProduct.id) : null;
        const initialIsOnList = !!initialItem;
        const initialNotes = initialItem?.notes || '';

        const current = localListState[list.id] || { isOnList: false, notes: '' };

        if (current.isOnList !== initialIsOnList) {
          dispatch({
            type: 'TOGGLE_PRODUCT_ON_LIST',
            payload: {
              listId: list.id,
              productId: targetProductId,
              notes: current.isOnList ? current.notes : undefined,
              forceState: current.isOnList
            }
          });
        } else if (current.isOnList && current.notes !== initialNotes) {
          dispatch({
            type: 'UPDATE_LIST_ITEM_NOTE',
            payload: {
              listId: list.id,
              productId: targetProductId,
              notes: current.notes
            }
          });
        }
      });
    }

    onClose();
  };

  return (
    <div id="product-quick-info-modal" className="fixed inset-0 bg-black/80 backdrop-blur-xs z-[100] flex justify-center items-center p-4" onClick={(e) => {
      if (e.target === e.currentTarget) onClose();
    }}>
      <div id="product-quick-info-card" className="bg-cool-gray-900 rounded-xl shadow-2xl flex flex-col border border-cool-gray-750 w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in text-cool-gray-100">
        {/* Header */}
        <div className="flex justify-between items-start px-6 py-4 border-b border-cool-gray-800 bg-cool-gray-950/20 shrink-0">
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold tracking-widest text-cyan-400 uppercase">Product Quick Info & Lists</span>
            <h2 id="product-quick-info-title" className="text-lg font-black text-black dark:text-white leading-tight flex items-center gap-2 flex-wrap">
              {matchedProduct?.productNumbers && matchedProduct.productNumbers.length > 0 ? (
                <div className="flex flex-wrap gap-1 items-center">
                  {matchedProduct.productNumbers.map(num => (
                    <span key={num} className={`font-mono text-[10px] px-2 py-0.5 rounded border ${num === itemNumber ? 'bg-cyan-950/40 text-cyan-300 border-cyan-800/30 font-extrabold shadow-xs' : 'bg-cool-gray-800 text-cool-gray-400 border-cool-gray-700'}`} title={num === itemNumber ? "Current matched item number" : "Associated catalog item number"}>
                      #{num}
                    </span>
                  ))}
                </div>
              ) : (
                itemNumber && <span className="bg-cool-gray-800 text-cool-gray-400 font-mono text-xs px-2 py-0.5 rounded border border-cool-gray-700">#{itemNumber}</span>
              )}
              <span>{namePart}</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-cool-gray-400">
              {matchedProduct ? (
                <>
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold text-[10px] uppercase">
                    ● Catalog Registered
                  </span>
                  <span>({matchedProduct.primaryCategory} › {matchedProduct.subCategory})</span>
                  {matchedProduct.barcode && (
                    <span className="bg-cool-gray-800 text-cool-gray-300 font-mono text-[10px] px-2 py-0.5 rounded border border-cool-gray-700" title="UPC-A Weight-Embedded Barcode">
                      UPC: {matchedProduct.barcode}
                    </span>
                  )}
                  {matchedProduct.salePrice !== undefined && matchedProduct.salePrice > 0 && (
                    <span className="bg-emerald-950/80 text-emerald-300 font-mono text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-800/40" title="Catalog Sales Price">
                      Price: ${Number(matchedProduct.salePrice).toFixed(2)} / {matchedProduct.salePriceUnit === 'package' ? 'pkg' : 'lb'}
                    </span>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold text-[10px] uppercase">
                  ▲ Unregistered Product
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-cool-gray-400 hover:text-white transition cursor-pointer p-1.5 rounded-lg hover:bg-cool-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Inventory Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* On-Site Stock Card */}
            <div className="bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-800/80 flex flex-col space-y-3">
              <div className="flex items-center justify-between border-b border-cool-gray-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cool-gray-400">On-Site Inventory</span>
                <span className="text-xs font-black text-cyan-400 bg-cyan-950/40 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  {totalOnSiteQty} cuts total
                </span>
              </div>
              <div className="flex-1 space-y-2 max-h-32 overflow-y-auto pr-1">
                {onSiteStorageBreakdown.length > 0 ? (
                  onSiteStorageBreakdown.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs bg-cool-gray-900/40 p-2 rounded border border-cool-gray-800/40 hover:bg-cool-gray-800/60 transition-colors">
                      {item.containerId ? (
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            if ((window as any).__navigateToLocation) {
                              (window as any).__navigateToLocation('on-site', item.containerId);
                            }
                          }}
                          className="font-semibold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer text-left truncate mr-2 flex items-center gap-1 group"
                          title={`Click to jump to ${item.containerName} on-site`}
                        >
                          ❄️ {item.freezerName} › <span className="font-bold text-cool-gray-200 group-hover:text-cyan-300">{item.containerName}</span>
                        </button>
                      ) : (
                        <span className="font-semibold text-cool-gray-300 truncate mr-2" title={`${item.freezerName} › ${item.containerName}`}>
                          ❄️ {item.freezerName} › <span className="text-cool-gray-200">{item.containerName}</span>
                        </span>
                      )}
                      <span className="font-mono font-bold text-cool-gray-100 shrink-0 bg-cool-gray-800 px-1.5 py-0.5 rounded">
                        {item.quantity} pcs
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-4 text-center">
                    <span className="text-xl opacity-60">📭</span>
                    <span className="text-xs text-cool-gray-500 italic mt-1">No stock currently on-site</span>
                  </div>
                )}
              </div>
            </div>

            {/* Off-Site Stock Card */}
            <div className="bg-cool-gray-850 p-4 rounded-xl border border-cool-gray-800/80 flex flex-col space-y-3">
              <div className="flex items-center justify-between border-b border-cool-gray-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-cool-gray-400">Off-Site Inventory</span>
                <span className="text-xs font-black text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {totalOffSiteWeight.toFixed(1)} lbs • {totalOffSitePieces} pcs
                </span>
              </div>
              <div className="flex-1 space-y-2 max-h-32 overflow-y-auto pr-1">
                {offSiteStorageBreakdown.length > 0 ? (
                  offSiteStorageBreakdown.map((item, i) => (
                    <div key={i} className="flex flex-col space-y-1 bg-cool-gray-900/40 p-2 rounded border border-cool-gray-800/40 text-xs hover:bg-cool-gray-800/40 transition-colors">
                      <div className="flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onFilterPallets?.(item.pallet);
                          }}
                          className="font-bold text-cyan-400 hover:text-cyan-300 hover:underline cursor-pointer truncate text-left mr-2 flex items-center gap-1 group"
                          title={`Click to filter spreadsheet by pallet ${item.pallet}`}
                        >
                          📦 <span className="text-cool-gray-200 group-hover:text-cyan-300">{item.pallet}</span>
                        </button>
                        <span className="font-mono font-bold text-emerald-400">
                          {item.weight.toFixed(1)} lbs
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-cool-gray-400">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onFilterLocations?.(item.location);
                          }}
                          className="text-cyan-500 hover:text-cyan-400 hover:underline cursor-pointer flex items-center gap-1 group"
                          title={`Click to filter spreadsheet by location ${item.location}`}
                        >
                          📍 <span className="text-cool-gray-400 group-hover:text-cyan-400">{item.location}</span>
                        </button>
                        <span>{item.pieces} pcs • {item.boxLabels.size} box{item.boxLabels.size > 1 ? 'es' : ''}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-4 text-center">
                    <span className="text-xl opacity-60">📭</span>
                    <span className="text-xs text-cool-gray-500 italic mt-1">No off-site records found</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Custom Lists Manager Section */}
          <div className="bg-cool-gray-850/60 p-5 rounded-xl border border-cool-gray-800/60 space-y-4">
            <div className="flex items-center justify-between border-b border-cool-gray-750 pb-2.5">
              <h3 className="text-xs font-extrabold tracking-wider text-cool-gray-300 uppercase flex items-center gap-2">
                <FileText size={14} className="text-amber-500" />
                Add to Custom Shopping / Stock Lists
              </h3>
            </div>

            {!matchedProduct && !isRegisteredLocal ? (
              <div className="bg-amber-950/20 border border-amber-600/20 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <h4 className="text-xs font-bold text-amber-300">Product Registration Recommended</h4>
                  <p className="text-[11px] text-cool-gray-400 leading-relaxed max-w-md">
                    This product is currently only in off-site spreadsheet data. Registering it in the Catalog lets you track list memberships and configure automatic restock levels.
                  </p>
                </div>
                <button
                  onClick={handleRegisterProductOnly}
                  className="bg-amber-600 hover:bg-amber-500 hover:scale-[1.02] text-white text-xs font-bold px-3.5 py-2 rounded-lg border border-amber-500/20 transition cursor-pointer select-none whitespace-nowrap"
                >
                  Register Product Now
                </button>
              </div>
            ) : null}

            {/* List memberships loop */}
            <div className="space-y-2">
              {(state.customLists || []).length > 0 ? (
                (state.customLists || []).map((list: any) => {
                  const listData = localListState[list.id] || { isOnList: false, notes: '' };
                  const isMember = listData.isOnList;
                  const currentNote = listData.notes;

                  return (
                    <div key={list.id} className="bg-cool-gray-900/50 hover:bg-cool-gray-900/80 p-3 rounded-lg border border-cool-gray-800/80 transition-all flex flex-col space-y-2">
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isMember}
                          onChange={() => handleToggleList(list.id)}
                          className="mt-0.5 h-4 w-4 rounded border-cool-gray-600 bg-cool-gray-800 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-cool-gray-200 block">{list.name}</span>
                          {list.description && <span className="text-[10px] text-cool-gray-400 leading-tight block mt-0.5">{list.description}</span>}
                        </div>
                      </label>

                      {isMember && list.allowNotes && (
                        <div className="pl-7 pt-1 animate-fade-in flex items-center gap-2">
                          <span className="text-[10px] text-cool-gray-400 font-semibold uppercase tracking-wider shrink-0">List Notes:</span>
                          <input
                            type="text"
                            value={currentNote}
                            onChange={(e) => handleNoteChange(list.id, e.target.value)}
                            className="flex-1 bg-cool-gray-950 border border-cool-gray-750 rounded px-2.5 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                            placeholder="Add notes for this item on list..."
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-4 text-xs text-cool-gray-500 italic">
                  No custom lists available. Go to the Catalog/Lists tab to configure list views.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 p-4 border-t border-cool-gray-850 shrink-0 bg-cool-gray-950/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-cool-gray-750 hover:bg-cool-gray-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-extrabold rounded-lg transition text-xs shadow-md cursor-pointer"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
