import React, { useState, useMemo, useEffect } from 'react';
import { InventoryState, Action, OffSiteEntry } from '../types';
import { 
  Package, 
  Trash2, 
  Check, 
  MapPin, 
  Sparkles, 
  FileCheck, 
  Plus, 
  Columns, 
  Layers, 
  CornerDownRight, 
  Info,
  ChevronRight,
  ArrowRight,
  Sliders,
  Folder,
  Square,
  CheckSquare,
  X,
  PlusCircle,
  HelpCircle,
  CheckSquare2,
  Tag as TagIcon,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface OffSiteStagingWorksheetProps {
  state: InventoryState;
  dispatch: (action: Action) => Promise<boolean>;
  onFinalized: () => void;
}

interface WorksheetItem {
  id: string;
  productId?: string;
  cuts: string;
  originalCutName: string;
  packDate: string;
  lot: string;
  pieces: number;
  netWeight: number;
  box: string;
  notes: string;
  tagIds?: string[];
  locationId: string;
  locationName: string;
  palletName: string;
  customPalletName?: string;
  isCustomPallet: boolean;
}

const WorksheetTagPopover: React.FC<{
  item: WorksheetItem;
  currentTagIds: string[];
  tags: any[];
  onSaveTags: (newTagIds: string[]) => void;
  onClose: () => void;
}> = ({ item, currentTagIds, tags, onSaveTags, onClose }) => {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => [...currentTagIds]);

  const handleToggle = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleApply = () => {
    onSaveTags(selectedTagIds);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-cool-gray-850 border border-cool-gray-750 p-3.5 rounded-xl shadow-2xl flex flex-col gap-2.5 min-w-[240px] max-w-sm animate-scale-up text-left max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-cool-gray-750 pb-1.5">
          <span className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <TagIcon size={12} className="text-cyan-400" />
            Tags: <span className="text-white truncate max-w-[140px]">{item.cuts}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-cool-gray-400 hover:text-white p-0.5 rounded transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-1 my-1 max-h-60 overflow-y-auto pr-1">
          {tags.length === 0 ? (
            <div className="text-xs text-cool-gray-400 italic py-2 text-center">No tags configured in settings.</div>
          ) : (
            tags.map((tag: any) => {
              const isSelected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggle(tag.id)}
                  style={{
                    backgroundColor: isSelected ? `${tag.color || '#38bdf8'}20` : 'transparent',
                    borderColor: isSelected ? `${tag.color || '#38bdf8'}50` : 'transparent'
                  }}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-2 hover:bg-cool-gray-800 cursor-pointer"
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 border"
                    style={{ 
                      backgroundColor: tag.color || '#38bdf8',
                      borderColor: isSelected ? '#ffffff' : 'transparent'
                    }}
                  />
                  <span className="text-cool-gray-200 font-semibold flex-1 truncate">
                    {tag.name}
                  </span>
                  {isSelected && (
                    <span className="text-cyan-400 text-xs font-black">✓</span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-750">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs text-cool-gray-300 hover:text-white rounded-lg bg-cool-gray-800 hover:bg-cool-gray-700 cursor-pointer font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3.5 py-1 text-xs text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg cursor-pointer font-extrabold shadow"
          >
            OK
          </button>
        </div>
      </div>
    </>
  );
};

const BulkTagPopover: React.FC<{
  selectedTagIds: string[];
  tags: any[];
  onSaveTags: (newTagIds: string[]) => void;
  onClose: () => void;
}> = ({ selectedTagIds, tags, onSaveTags, onClose }) => {
  const [localTagIds, setLocalTagIds] = useState<string[]>(() => [...selectedTagIds]);

  const handleToggle = (tagId: string) => {
    setLocalTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleApply = () => {
    onSaveTags(localTagIds);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); onClose(); }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] bg-cool-gray-850 border border-cool-gray-750 p-3.5 rounded-xl shadow-2xl flex flex-col gap-2.5 min-w-[240px] max-w-sm animate-scale-up text-left max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-cool-gray-750 pb-1.5">
          <span className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <TagIcon size={12} className="text-cyan-400" />
            Bulk Assign Tags
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-cool-gray-400 hover:text-white p-0.5 rounded transition cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex flex-col gap-1 my-1 max-h-60 overflow-y-auto pr-1">
          {tags.length === 0 ? (
            <div className="text-xs text-cool-gray-400 italic py-2 text-center">No tags configured in settings.</div>
          ) : (
            tags.map((tag: any) => {
              const isSelected = localTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggle(tag.id)}
                  style={{
                    backgroundColor: isSelected ? `${tag.color || '#38bdf8'}20` : 'transparent',
                    borderColor: isSelected ? `${tag.color || '#38bdf8'}50` : 'transparent'
                  }}
                  className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-2 hover:bg-cool-gray-800 cursor-pointer"
                >
                  <span 
                    className="w-2.5 h-2.5 rounded-full shrink-0 border"
                    style={{ 
                      backgroundColor: tag.color || '#38bdf8',
                      borderColor: isSelected ? '#ffffff' : 'transparent'
                    }}
                  />
                  <span className="text-cool-gray-200 font-semibold flex-1 truncate">
                    {tag.name}
                  </span>
                  {isSelected && (
                    <span className="text-cyan-400 text-xs font-black">✓</span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-cool-gray-750">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-xs text-cool-gray-300 hover:text-white rounded-lg bg-cool-gray-800 hover:bg-cool-gray-700 cursor-pointer font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3.5 py-1 text-xs text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg cursor-pointer font-extrabold shadow"
          >
            OK
          </button>
        </div>
      </div>
    </>
  );
};

const PalletValidationModal: React.FC<{
  missingItems: WorksheetItem[];
  onSelectAllMissing: () => void;
  onClose: () => void;
}> = ({ missingItems, onSelectAllMissing, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-cool-gray-900 border border-amber-500/50 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950/80 to-cool-gray-900 p-5 border-b border-amber-800/40 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
              <AlertTriangle size={22} className="animate-pulse" />
            </span>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider">Pallet Selection Required</h3>
              <p className="text-xs text-amber-300/90 font-medium mt-0.5">
                Every item must be assigned to a pallet before moving off-site
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-cool-gray-400 hover:text-white p-1 rounded-lg hover:bg-cool-gray-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-3.5 text-xs text-amber-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-amber-300">
              <AlertCircle size={14} />
              <span>{missingItems.length} item(s) are missing pallet assignments</span>
            </p>
            <p className="text-cool-gray-300 text-[11px]">
              Off-site storage entries require a target pallet identifier (or custom pallet) for accurate warehouse tracking. Please assign a pallet to each item or use the bulk editing tool.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider">
              Unassigned Items ({missingItems.length})
            </div>
            <div className="divide-y divide-cool-gray-800/60 max-h-60 overflow-y-auto border border-cool-gray-800 rounded-xl bg-cool-gray-950/60 p-1">
              {missingItems.map(it => (
                <div key={it.id} className="py-2 px-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-bold text-white truncate">{it.cuts}</div>
                    <div className="text-[10px] text-cool-gray-400 flex items-center gap-2">
                      <span>Box: {it.box || 'Uncontainered'}</span>
                      <span>•</span>
                      <span>{it.pieces} pcs ({it.netWeight > 0 ? `${it.netWeight} lbs` : '0 lbs'})</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/80 border border-amber-500/40 px-2 py-0.5 rounded-full shrink-0">
                    No Pallet
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-cool-gray-950/80 px-5 py-4 border-t border-cool-gray-800 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            type="button"
            onClick={onSelectAllMissing}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black uppercase text-xs tracking-wider px-4 py-2.5 rounded-xl shadow-lg transition cursor-pointer"
          >
            <CheckSquare size={14} className="stroke-[3]" />
            <span>Select All Missing (Bulk Edit)</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-cool-gray-300 hover:text-white bg-cool-gray-800 hover:bg-cool-gray-700 transition cursor-pointer text-center"
          >
            Close & Review
          </button>
        </div>
      </div>
    </div>
  );
};

export const OffSiteStagingWorksheet: React.FC<OffSiteStagingWorksheetProps> = ({
  state,
  dispatch,
  onFinalized
}) => {
  // 1. Filter out offsite entries that are staged
  const stagedEntries = useMemo(() => {
    return (state.offSiteEntries || []).filter(e => e.staged);
  }, [state.offSiteEntries]);

  // 2. Fetch available storage locations (including Home/On-Site location)
  const storageLocations = useMemo(() => {
    return state.locations || [];
  }, [state.locations]);

  const defaultLocation = useMemo(() => {
    return storageLocations.find(l => l.isHome) || storageLocations[0] || { id: 'unassigned', name: 'Unassigned Location' };
  }, [storageLocations]);

  // 3. Local state for worksheet items
  const [items, setItems] = useState<WorksheetItem[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'box'>('box');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPalletValidationModal, setShowPalletValidationModal] = useState<boolean>(false);
  
  const [movementOrderName, setMovementOrderName] = useState(() => {
    const today = new Date().toLocaleDateString();
    return `Staging Move ${today}`;
  });

  // Check if an item has a valid pallet assigned
  const isItemPalletValid = (it: WorksheetItem): boolean => {
    if (it.isCustomPallet) {
      return !!(it.customPalletName && it.customPalletName.trim().length > 0);
    }
    return !!(it.palletName && it.palletName.trim().length > 0);
  };

  // List of items currently missing a pallet
  const missingPalletItems = useMemo(() => {
    return items.filter(it => !isItemPalletValid(it));
  }, [items]);

  // Bulk select all items that are missing a pallet
  const handleSelectAllMissingPallet = () => {
    const missingIds = items.filter(it => !isItemPalletValid(it)).map(it => it.id);
    setSelectedIds(new Set(missingIds));
  };

  // Bulk Edit Fields
  const [bulkLocationId, setBulkLocationId] = useState<string>('');
  const [bulkPalletName, setBulkPalletName] = useState<string>('');
  const [bulkCustomPalletName, setBulkCustomPalletName] = useState<string>('');
  const [bulkIsCustomPallet, setBulkIsCustomPallet] = useState<boolean>(false);
  const [bulkBox, setBulkBox] = useState<string>('');
  const [bulkPackDate, setBulkPackDate] = useState<string>('');
  const [bulkLot, setBulkLot] = useState<string>('');
  const [bulkNotes, setBulkNotes] = useState<string>('');
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [isBulkTagPopoverOpen, setIsBulkTagPopoverOpen] = useState<boolean>(false);
  const [openTagSelectorId, setOpenTagSelectorId] = useState<string | null>(null);

  // Initialize local items from staged entries
  useEffect(() => {
    if (stagedEntries.length > 0 && items.length === 0) {
      const mapped = stagedEntries.map(e => {
        const loc = defaultLocation;
        const defaultPallet = '';
        return {
          id: e.id,
          productId: e.productId,
          cuts: e.cuts || e.originalCutName || 'Unknown Cut',
          originalCutName: e.originalCutName || e.cuts || 'Unknown Cut',
          packDate: e.packDate || '',
          lot: e.lot || '',
          pieces: e.pieces || 1,
          netWeight: e.netWeight || 0,
          box: e.box || '',
          notes: e.notes || '',
          tagIds: e.tagIds ? [...e.tagIds] : [],
          locationId: loc.id,
          locationName: loc.name,
          palletName: defaultPallet,
          isCustomPallet: false
        };
      });
      setItems(mapped);
    }
  }, [stagedEntries, defaultLocation, items.length]);

  // 4. Generate projected serial numbers
  const projectedSerials = useMemo(() => {
    const todayPrefix = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    
    let maxSuffix = 0;
    const existingEntries = (state.offSiteEntries || []).filter(e => !e.staged);
    for (const entry of existingEntries) {
      if (entry.serial && entry.serial.startsWith(todayPrefix)) {
        const suffixPart = entry.serial.slice(todayPrefix.length);
        const suffixNum = parseInt(suffixPart, 10);
        if (!isNaN(suffixNum) && suffixNum > maxSuffix) {
          maxSuffix = suffixNum;
        }
      }
    }

    const serialsMap = new Map<string, string>();
    let currentSuffix = maxSuffix;
    
    for (let i = 0; i < items.length; i++) {
      currentSuffix++;
      const suffixStr = String(currentSuffix).padStart(4, '0');
      serialsMap.set(items[i].id, `${todayPrefix}${suffixStr}`);
    }
    return serialsMap;
  }, [items, state.offSiteEntries]);

  // Group items by box key
  const itemsByBox = useMemo(() => {
    const groups: { [boxName: string]: WorksheetItem[] } = {};
    for (const item of items) {
      const boxKey = (item.box || '').trim() || '__unbox__';
      if (!groups[boxKey]) {
        groups[boxKey] = [];
      }
      groups[boxKey].push(item);
    }
    return groups;
  }, [items]);

  // Split a grouped worksheet item into single-piece rows
  const handleSplitItem = (itemId: string) => {
    const itemToSplit = items.find(it => it.id === itemId);
    if (!itemToSplit || itemToSplit.pieces <= 1) return;

    const splitCount = itemToSplit.pieces;
    const individualWeight = itemToSplit.netWeight > 0 
      ? Number((itemToSplit.netWeight / splitCount).toFixed(2)) 
      : 0;

    const newSplitItems: WorksheetItem[] = [];
    for (let i = 0; i < splitCount; i++) {
      newSplitItems.push({
        ...itemToSplit,
        id: crypto.randomUUID(),
        pieces: 1,
        netWeight: individualWeight,
        notes: itemToSplit.notes ? `${itemToSplit.notes} (Split ${i + 1}/${splitCount})` : ''
      });
    }

    setItems(prev => {
      const idx = prev.findIndex(it => it.id === itemId);
      const copy = [...prev];
      copy.splice(idx, 1, ...newSplitItems);
      return copy;
    });

    // Deselect split item
    if (selectedIds.has(itemId)) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  // Modify individual field for a worksheet item
  const handleUpdateItem = (itemId: string, updates: Partial<WorksheetItem>) => {
    setItems(prev => prev.map(it => {
      if (it.id === itemId) {
        const updated = { ...it, ...updates };
        if (updates.locationId) {
          const loc = storageLocations.find(l => l.id === updates.locationId);
          if (loc) {
            updated.locationName = loc.name;
            updated.palletName = '';
            updated.isCustomPallet = false;
          }
        }
        return updated;
      }
      return it;
    }));
  };

  // Rename a box for all items belonging to it
  const handleRenameBox = (oldBoxName: string, newBoxName: string) => {
    setItems(prev => prev.map(it => {
      const currentBox = (it.box || '').trim();
      const match = oldBoxName === '__unbox__' ? !currentBox : currentBox === oldBoxName;
      if (match) {
        return { ...it, box: newBoxName };
      }
      return it;
    }));
  };

  // Update Location for a whole Box
  const handleUpdateBoxLocation = (boxName: string, locationId: string) => {
    const loc = storageLocations.find(l => l.id === locationId);
    if (!loc) return;
    setItems(prev => prev.map(it => {
      const currentBox = (it.box || '').trim();
      const match = boxName === '__unbox__' ? !currentBox : currentBox === boxName;
      if (match) {
        return {
          ...it,
          locationId,
          locationName: loc.name,
          palletName: '',
          isCustomPallet: false
        };
      }
      return it;
    }));
  };

  // Update Pallet for a whole Box
  const handleUpdateBoxPallet = (boxName: string, palletName: string, isCustom: boolean, customPalletName?: string) => {
    setItems(prev => prev.map(it => {
      const currentBox = (it.box || '').trim();
      const match = boxName === '__unbox__' ? !currentBox : currentBox === boxName;
      if (match) {
        return {
          ...it,
          palletName,
          isCustomPallet: isCustom,
          customPalletName
        };
      }
      return it;
    }));
  };

  // Select / Deselect individual item
  const handleToggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select / Deselect whole Box group
  const handleToggleSelectBox = (boxName: string, checked: boolean) => {
    const boxItems = itemsByBox[boxName] || [];
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const item of boxItems) {
        if (checked) {
          next.add(item.id);
        } else {
          next.delete(item.id);
        }
      }
      return next;
    });
  };

  // Select / Deselect All Worksheet items
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(items.map(it => it.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Check if all items in a box are selected
  const isBoxFullySelected = (boxName: string) => {
    const boxItems = itemsByBox[boxName] || [];
    if (boxItems.length === 0) return false;
    return boxItems.every(item => selectedIds.has(item.id));
  };

  // Check if some but not all items in a box are selected
  const isBoxPartiallySelected = (boxName: string) => {
    const boxItems = itemsByBox[boxName] || [];
    const selectedCount = boxItems.filter(item => selectedIds.has(item.id)).length;
    return selectedCount > 0 && selectedCount < boxItems.length;
  };

  // Bulk apply values to selected items
  const handleApplyBulkUpdates = () => {
    if (selectedIds.size === 0) return;

    setItems(prev => prev.map(it => {
      if (!selectedIds.has(it.id)) return it;

      const updated = { ...it };
      if (bulkLocationId) {
        const loc = storageLocations.find(l => l.id === bulkLocationId);
        if (loc) {
          updated.locationId = bulkLocationId;
          updated.locationName = loc.name;
          updated.palletName = '';
          updated.isCustomPallet = false;
        }
      }
      if (bulkPalletName) {
        if (bulkPalletName === '__custom__') {
          updated.isCustomPallet = true;
          updated.customPalletName = bulkCustomPalletName || 'New Pallet';
          updated.palletName = '';
        } else {
          updated.isCustomPallet = false;
          updated.palletName = bulkPalletName;
          updated.customPalletName = undefined;
        }
      } else if (bulkIsCustomPallet && bulkCustomPalletName.trim()) {
        updated.isCustomPallet = true;
        updated.customPalletName = bulkCustomPalletName.trim();
        updated.palletName = '';
      }
      if (bulkBox !== undefined && bulkBox !== '') {
        updated.box = bulkBox;
      }
      if (bulkPackDate) {
        updated.packDate = bulkPackDate;
      }
      if (bulkLot) {
        updated.lot = bulkLot;
      }
      if (bulkNotes.trim() !== '') {
        updated.notes = bulkNotes.trim();
      }
      if (bulkTagIds.length > 0) {
        updated.tagIds = Array.from(new Set([...(updated.tagIds || []), ...bulkTagIds]));
      }
      return updated;
    }));

    // Reset Bulk inputs & clear selections
    setSelectedIds(new Set());
    setBulkLocationId('');
    setBulkPalletName('');
    setBulkCustomPalletName('');
    setBulkIsCustomPallet(false);
    setBulkBox('');
    setBulkPackDate('');
    setBulkLot('');
    setBulkNotes('');
    setBulkTagIds([]);
  };

  // Save and Finalize Worksheet
  const handleFinalize = async () => {
    // Validate that every single item has a pallet selected
    const unassigned = items.filter(it => !isItemPalletValid(it));
    if (unassigned.length > 0) {
      setShowPalletValidationModal(true);
      return;
    }

    // Construct final OffSiteEntry objects
    const finalizedEntries: OffSiteEntry[] = items.map(it => {
      const finalPallet = it.isCustomPallet 
        ? (it.customPalletName || 'New Pallet').trim() 
        : it.palletName.trim();

      return {
        id: it.id,
        serial: projectedSerials.get(it.id) || '',
        productId: it.productId,
        cuts: it.cuts,
        originalCutName: it.originalCutName,
        packDate: it.packDate,
        lot: it.lot,
        pieces: it.pieces,
        netWeight: it.netWeight,
        box: it.box.trim() || undefined,
        currentLocation: finalPallet,
        pallet: finalPallet,
        location: it.locationName,
        storageLocationId: it.locationId,
        notes: it.notes || undefined,
        tagIds: it.tagIds ? [...it.tagIds] : [],
        staged: false
      };
    });

    const success = await dispatch({
      type: 'FINALIZE_OFFSITE_STAGING',
      payload: {
        entries: finalizedEntries,
        movementOrderName: movementOrderName.trim()
      }
    });

    if (success) {
      onFinalized();
    }
  };

  if (stagedEntries.length === 0) {
    return (
      <div className="p-8 text-center text-cool-gray-400">
        <Info className="mx-auto w-12 h-12 text-cool-gray-500 mb-3" />
        <p className="font-semibold text-lg text-cool-gray-300">Staging Worksheet is Empty</p>
        <p className="text-sm mt-1">Move items from On-Site Staging to Off-Site first to populate this worksheet.</p>
      </div>
    );
  }

  // Derived variables for pallets inside bulk editing selector
  const bulkLocObj = storageLocations.find(l => l.id === bulkLocationId);
  const bulkHasPallets = bulkLocObj?.hasPallets ?? false;
  const bulkLocationPallets = (state.pallets || []).filter(p => !p.isArchived && p.storageLocationId === bulkLocationId);

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in text-cool-gray-100">
      
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-cyan-950/40 via-cool-gray-900/60 to-indigo-950/40 border border-cyan-800/40 p-5 sm:p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-cyan-900/30 text-cyan-400 rounded-lg border border-cyan-700/30">
              <Sparkles size={16} />
            </span>
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Off-Site Staging Worksheet</h3>
          </div>
          <p className="text-xs sm:text-sm text-cool-gray-300 font-medium">
            You have <span className="text-cyan-400 font-bold">{items.length} items</span> in the staging worksheet. Pallet assignment is mandatory for all cuts before off-site transfer.
          </p>

          {/* Pallet status chip */}
          <div className="pt-1 flex items-center gap-2 flex-wrap">
            {missingPalletItems.length > 0 ? (
              <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                <AlertTriangle size={14} className="text-amber-400 shrink-0 animate-pulse" />
                <span>{missingPalletItems.length} of {items.length} items require pallet assignment</span>
                <button
                  type="button"
                  onClick={handleSelectAllMissingPallet}
                  className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded text-[10px] uppercase font-black hover:bg-amber-300 transition cursor-pointer ml-1"
                >
                  Select Missing
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold">
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
                <span>All {items.length} items assigned to pallets — Ready to finalize</span>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Switcher and Movement Order Input */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center shrink-0 w-full md:w-auto">
          {/* Group View Toggle */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-cool-gray-400 uppercase tracking-widest">Layout View</span>
            <div className="flex bg-cool-gray-950 p-1 rounded-xl border border-cool-gray-850 self-start">
              <button
                type="button"
                onClick={() => setViewMode('box')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'box' 
                    ? 'bg-cyan-600/25 text-cyan-400 border border-cyan-500/20' 
                    : 'text-cool-gray-400 hover:text-white border border-transparent'
                }`}
              >
                <Folder size={12} />
                <span>Group by Box</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-cyan-600/25 text-cyan-400 border border-cyan-500/20' 
                    : 'text-cool-gray-400 hover:text-white border border-transparent'
                }`}
              >
                <Layers size={12} />
                <span>Flat List</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[180px] sm:max-w-xs">
            <label className="text-[9px] font-bold text-cool-gray-400 uppercase tracking-widest">Campaign / Movement Name</label>
            <input 
              type="text"
              placeholder="e.g. Move Staging 2026-08"
              value={movementOrderName}
              onChange={(e) => setMovementOrderName(e.target.value)}
              className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-xl px-3 py-2 text-xs text-white placeholder:text-cool-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* --- BULK EDITING ACTION BAR --- */}
      {selectedIds.size > 0 && (
        <div className="bg-gradient-to-r from-indigo-950/80 to-blue-950/80 border border-indigo-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-slide-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-indigo-800/30">
            <div className="flex items-center gap-2">
              <span className="p-1 bg-indigo-500 text-slate-950 rounded font-bold text-xs px-2 select-none">
                {selectedIds.size}
              </span>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sliders size={14} className="text-indigo-400" />
                  Bulk Editing Toolbar
                </h4>
                <p className="text-[10px] text-indigo-300">Apply parameters to all checked cuts simultaneously</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-bold text-indigo-300 hover:text-white border border-indigo-800 hover:bg-indigo-900/30 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-end">
            {/* Bulk Destination Location */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-indigo-300 uppercase">Set Destination</label>
              <select
                value={bulkLocationId}
                onChange={(e) => {
                  setBulkLocationId(e.target.value);
                  setBulkPalletName('');
                }}
                className="w-full bg-cool-gray-950 border border-indigo-800/60 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer"
              >
                <option value="">-- No Change --</option>
                {storageLocations.map(l => (
                  <option key={l.id} value={l.id}>{l.name} {l.isHome ? '(On-Site / Home)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Bulk Pallet */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-indigo-300 uppercase">Set Pallet</label>
              {!bulkLocationId ? (
                <div className="text-[10px] text-indigo-400 bg-cool-gray-950 border border-indigo-950 p-2.5 rounded-xl font-medium select-none truncate">
                  Select Location First
                </div>
              ) : bulkIsCustomPallet ? (
                <div className="flex items-center gap-1">
                  <input 
                    type="text"
                    placeholder="Custom Pallet ID"
                    value={bulkCustomPalletName}
                    onChange={(e) => setBulkCustomPalletName(e.target.value)}
                    className="w-full bg-cool-gray-950 border border-cyan-800/40 rounded-xl py-1.5 px-3 text-xs text-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBulkIsCustomPallet(false);
                      setBulkPalletName('');
                    }}
                    className="p-1.5 hover:bg-cool-gray-800 text-cool-gray-400 hover:text-white rounded transition"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  value={bulkPalletName}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setBulkIsCustomPallet(true);
                      setBulkCustomPalletName('');
                    } else {
                      setBulkPalletName(val);
                    }
                  }}
                  className="w-full bg-cool-gray-950 border border-indigo-800/60 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer"
                >
                  <option value="">-- No Change --</option>
                  <option value="">(None - Empty)</option>
                  {bulkLocationPallets.map(p => (
                    <option key={p.id} value={p.id}>{p.id}</option>
                  ))}
                  <option value="__custom__" className="text-cyan-400 font-bold">+ Custom Pallet...</option>
                </select>
              )}
            </div>

            {/* Bulk Box */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-indigo-300 uppercase">Set Box</label>
              <input 
                type="text"
                placeholder="e.g. Box A"
                value={bulkBox}
                onChange={(e) => setBulkBox(e.target.value)}
                className="w-full bg-cool-gray-950 border border-indigo-800/60 rounded-xl py-2 px-3 text-xs text-white placeholder:text-cool-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
              />
            </div>

            {/* Bulk Pack Date */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-indigo-300 uppercase">Set Pack Date</label>
              <input 
                type="date"
                value={bulkPackDate}
                onChange={(e) => setBulkPackDate(e.target.value)}
                className="w-full bg-cool-gray-950 border border-indigo-800/60 rounded-xl py-1.5 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold cursor-pointer"
              />
            </div>

            {/* Bulk Lot */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-indigo-300 uppercase">Set Lot#</label>
              <input 
                type="text"
                placeholder="e.g. LOT-55A"
                value={bulkLot}
                onChange={(e) => setBulkLot(e.target.value)}
                className="w-full bg-cool-gray-950 border border-indigo-800/60 rounded-xl py-2 px-3 text-xs text-white placeholder:text-cool-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
              />
            </div>

            {/* Bulk Notes */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-indigo-300 uppercase">Set Notes</label>
              <input 
                type="text"
                placeholder="Notes for selected..."
                value={bulkNotes}
                onChange={(e) => setBulkNotes(e.target.value)}
                className="w-full bg-cool-gray-950 border border-indigo-800/60 rounded-xl py-2 px-3 text-xs text-white placeholder:text-cool-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
              />
            </div>

            {/* Bulk Tags */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-indigo-300 uppercase">Assign Tags</label>
              <button
                type="button"
                onClick={() => setIsBulkTagPopoverOpen(true)}
                className="w-full bg-cool-gray-950 border border-indigo-800/60 hover:border-cyan-500/60 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold flex items-center justify-between cursor-pointer transition"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <TagIcon size={12} className="text-cyan-400 shrink-0" />
                  <span className="text-cool-gray-300 truncate">
                    {bulkTagIds.length > 0 ? `${bulkTagIds.length} tag(s)` : 'Select...'}
                  </span>
                </div>
                {bulkTagIds.length > 0 && (
                  <span className="text-[10px] bg-cyan-900/80 text-cyan-300 px-1.5 py-0.2 rounded font-bold border border-cyan-700/50">
                    {bulkTagIds.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleApplyBulkUpdates}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-slate-950 font-black uppercase text-xs tracking-wider px-6 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <CheckSquare2 size={14} className="stroke-[3]" />
              <span>Apply to Selected Items</span>
            </button>
          </div>
        </div>
      )}

      {/* --- RENDER GROUPED BOX LAYOUT --- */}
      {viewMode === 'box' && (
        <div className="space-y-6">
          {Object.keys(itemsByBox).sort((a,b) => {
            if (a === '__unbox__') return 1;
            if (b === '__unbox__') return -1;
            return a.localeCompare(b);
          }).map(boxKey => {
            const boxItems = itemsByBox[boxKey];
            const isBoxEmptyGroup = boxKey === '__unbox__';
            
            // Extract the box location & pallet (from first item)
            const firstItem = boxItems[0];
            const boxLocationId = firstItem?.locationId || '';
            const boxLocObj = storageLocations.find(l => l.id === boxLocationId);
            const boxHasPallets = boxLocObj?.hasPallets ?? false;
            const boxPalletName = firstItem?.palletName || '';
            const boxIsCustomPallet = firstItem?.isCustomPallet ?? false;
            const boxCustomPalletName = firstItem?.customPalletName || '';

            return (
              <div key={boxKey} className="bg-cool-gray-900/80 rounded-2xl border border-cool-gray-800 shadow-xl overflow-hidden">
                {/* Box Header Card */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-cool-gray-850/60 p-4 border-b border-cool-gray-800">
                  {/* Left: Box Checkbox + Box Title/Rename */}
                  <div className="flex items-center gap-3 flex-1 min-w-[240px]">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectBox(boxKey, !isBoxFullySelected(boxKey))}
                      className="text-cool-gray-400 hover:text-white transition cursor-pointer shrink-0"
                      title="Select all items in this box"
                    >
                      {isBoxFullySelected(boxKey) ? (
                        <CheckSquare className="w-5 h-5 text-cyan-400" />
                      ) : isBoxPartiallySelected(boxKey) ? (
                        <div className="w-5 h-5 bg-cyan-950 text-cyan-400 rounded flex items-center justify-center font-bold border border-cyan-800/40 text-[10px] select-none">-</div>
                      ) : (
                        <Square className="w-5 h-5 text-cool-gray-600" />
                      )}
                    </button>

                    {isBoxEmptyGroup ? (
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-cool-gray-500 shrink-0" />
                        <span className="font-bold text-cool-gray-300">Uncontainered Items (No Box)</span>
                        <span className="text-[10px] text-cool-gray-500 font-bold ml-1 uppercase">{boxItems.length} items</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Folder className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-widest">Box Name:</span>
                        <input
                          type="text"
                          value={boxKey}
                          onChange={(e) => handleRenameBox(boxKey, e.target.value)}
                          className="bg-cool-gray-950 border border-cool-gray-700 hover:border-cyan-500 focus:border-cyan-500 rounded-lg px-2.5 py-1 text-xs text-white font-bold w-48 transition-colors focus:ring-1 focus:ring-cyan-500"
                          placeholder="Rename Box Group..."
                        />
                        <span className="text-[10px] text-cool-gray-500 font-bold ml-1 uppercase">{boxItems.length} items</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Destination Controls for the whole Box */}
                  <div className="flex items-center gap-4 flex-wrap text-xs">
                    {/* Location selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-cool-gray-400 uppercase">Move Box to:</span>
                      <select
                        value={boxLocationId}
                        onChange={(e) => handleUpdateBoxLocation(boxKey, e.target.value)}
                        className="bg-cool-gray-950 border border-cool-gray-700 hover:border-cyan-500 focus:border-cyan-500 rounded-lg py-1 px-2.5 text-xs text-white font-semibold cursor-pointer transition-colors"
                      >
                        {storageLocations.map(l => (
                          <option key={l.id} value={l.id}>{l.name} {l.isHome ? '(On-Site / Home)' : ''}</option>
                        ))}
                      </select>
                    </div>

                    {/* Pallet selector */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold text-cool-gray-400 uppercase">Pallet:</span>
                      {boxIsCustomPallet ? (
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="text"
                            placeholder="Custom Pallet ID"
                            value={boxCustomPalletName}
                            onChange={(e) => handleUpdateBoxPallet(boxKey, boxPalletName, true, e.target.value)}
                            className={`bg-cool-gray-950 rounded-lg py-1 px-2.5 text-xs font-bold w-32 focus:outline-none ${
                              !boxCustomPalletName.trim()
                                ? 'border border-amber-500 text-amber-300 placeholder:text-amber-700/60 focus:ring-1 focus:ring-amber-500'
                                : 'border border-cyan-800/40 text-cyan-400 placeholder:text-cool-gray-700'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateBoxPallet(boxKey, '', false)}
                            className="p-1 hover:bg-cool-gray-800 text-cool-gray-400 hover:text-white rounded transition cursor-pointer"
                            title="Choose existing pallet"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <select
                          value={boxPalletName}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '__custom__') {
                              handleUpdateBoxPallet(boxKey, '', true, '');
                            } else {
                              handleUpdateBoxPallet(boxKey, val, false);
                            }
                          }}
                          className={`bg-cool-gray-950 rounded-lg py-1 px-2.5 text-xs font-semibold cursor-pointer transition-colors ${
                            !boxPalletName
                              ? 'border border-amber-500 text-amber-300 focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
                              : 'border border-cool-gray-700 text-white hover:border-cyan-500 focus:border-cyan-500'
                          }`}
                        >
                          <option value="">⚠️ Select Pallet (Required)</option>
                          {(state.pallets || [])
                            .filter(p => !p.isArchived && p.storageLocationId === boxLocationId)
                            .map(p => (
                              <option key={p.id} value={p.id}>{p.id}</option>
                            ))
                          }
                          <option value="__custom__" className="text-cyan-400 font-bold">+ Create Custom Pallet...</option>
                        </select>
                      )}
                      {boxItems.some(it => !isItemPalletValid(it)) && (
                        <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0" title="Pallet selection is required">
                          <AlertTriangle size={10} /> Pallet Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Box Contents Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-cool-gray-850/20 border-b border-cool-gray-800 text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider">
                        <th className="py-3 px-4 w-10"></th>
                        <th className="py-3 px-4">Cut / Product</th>
                        <th className="py-3 px-3 w-40">Tags</th>
                        <th className="py-3 px-3 w-28">Pieces (Qty)</th>
                        <th className="py-3 px-3 w-28">Weight (lbs)</th>
                        <th className="py-3 px-3 w-36">Pack Date / Lot</th>
                        <th className="py-3 px-3 min-w-[140px]">Notes</th>
                        <th className="py-3 px-3 w-36">Rename Box</th>
                        <th className="py-3 px-4 text-right w-36">Projected Serial</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cool-gray-800/40 text-xs">
                      {boxItems.map(it => {
                        const isSelected = selectedIds.has(it.id);
                        return (
                          <tr key={it.id} className={`hover:bg-cool-gray-850/20 transition-colors ${isSelected ? 'bg-indigo-600/5' : ''}`}>
                            {/* Checkbox */}
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => handleToggleSelectItem(it.id)}
                                className="text-cool-gray-400 hover:text-white transition cursor-pointer"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                                ) : (
                                  <Square className="w-4 h-4 text-cool-gray-700" />
                                )}
                              </button>
                            </td>

                            {/* Cut / Product */}
                            <td className="py-3 px-4">
                              <div className="flex items-start gap-2 max-w-xs">
                                <span className="p-1.5 bg-cool-gray-800 text-cool-gray-300 rounded-lg mt-0.5 border border-cool-gray-700 shrink-0">
                                  <Package size={12} />
                                </span>
                                <div>
                                  <div className="font-bold text-white leading-tight">{it.cuts}</div>
                                  {it.productId && (
                                    <div className="text-[10px] text-cool-gray-400 font-mono mt-0.5">
                                      ID: {it.productId}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Tags */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-1">
                                {(it.tagIds && it.tagIds.length > 0) && (
                                  <div className="flex flex-wrap gap-1">
                                    {it.tagIds.map((tagId: string) => {
                                      const tag = (state.tags || []).find((t: any) => t.id === tagId);
                                      if (!tag) return null;
                                      return (
                                        <span
                                          key={tag.id}
                                          style={{ 
                                            backgroundColor: `${tag.color || '#38bdf8'}20`, 
                                            borderColor: `${tag.color || '#38bdf8'}40`, 
                                            color: tag.color || '#38bdf8' 
                                          }}
                                          className="inline-flex items-center gap-1 text-[9px] border px-1.5 py-0.2 rounded font-semibold uppercase select-none"
                                          title={tag.description || tag.name}
                                        >
                                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color || '#38bdf8' }} />
                                          <span className="truncate max-w-[80px]">{tag.name}</span>
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setOpenTagSelectorId(it.id)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-cool-gray-400 hover:text-cyan-300 bg-cool-gray-950 border border-cool-gray-750 hover:border-cyan-500/50 px-2 py-0.5 rounded transition cursor-pointer self-start"
                                >
                                  <TagIcon size={10} className="text-cyan-400" />
                                  <span>{(it.tagIds || []).length > 0 ? 'Edit Tags' : '+ Add Tag'}</span>
                                </button>
                              </div>
                            </td>

                            {/* Pieces & Split Rows */}
                            <td className="py-3 px-3">
                              <div className="flex flex-col gap-1">
                                <div className="font-black text-white text-sm ml-1">{it.pieces} <span className="text-[9px] font-bold text-cool-gray-400 uppercase">pcs</span></div>
                                {it.pieces > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleSplitItem(it.id)}
                                    className="flex items-center gap-1 self-start px-2 py-0.5 bg-cyan-950/60 border border-cyan-800/40 hover:bg-cyan-900/50 text-cyan-400 rounded text-[9px] font-bold transition-all shrink-0 cursor-pointer"
                                    title="Split grouped cuts into individual single rows"
                                  >
                                    <Layers size={8} />
                                    <span>Split Rows</span>
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Weight */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1">
                                <input 
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={it.netWeight || ''}
                                  onChange={(e) => handleUpdateItem(it.id, { netWeight: parseFloat(e.target.value) || 0 })}
                                  className="w-20 bg-cool-gray-950 border border-cool-gray-700 rounded-lg py-1 px-2 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold"
                                  placeholder="0.00"
                                />
                                <span className="text-[10px] font-bold text-cool-gray-400">lbs</span>
                              </div>
                            </td>

                            {/* Pack Date / Lot */}
                            <td className="py-3 px-3 space-y-1">
                              <input 
                                type="date"
                                value={it.packDate || ''}
                                onChange={(e) => handleUpdateItem(it.id, { packDate: e.target.value })}
                                className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded py-0.5 px-1.5 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                              />
                              <input 
                                type="text"
                                placeholder="Lot#"
                                value={it.lot || ''}
                                onChange={(e) => handleUpdateItem(it.id, { lot: e.target.value })}
                                className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded py-0.5 px-1.5 text-[10px] text-white placeholder:text-cool-gray-700 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                              />
                            </td>

                            {/* Notes */}
                            <td className="py-3 px-3">
                              <input 
                                type="text"
                                placeholder="Add notes..."
                                value={it.notes || ''}
                                onChange={(e) => handleUpdateItem(it.id, { notes: e.target.value })}
                                className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded py-1 px-2 text-xs text-white placeholder:text-cool-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-normal"
                              />
                            </td>

                            {/* Move / Rename Box */}
                            <td className="py-3 px-3">
                              <input 
                                type="text"
                                value={it.box || ''}
                                onChange={(e) => handleUpdateItem(it.id, { box: e.target.value })}
                                className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded py-1 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                                placeholder="e.g. Box 1"
                              />
                            </td>

                            {/* Projected Serial */}
                            <td className="py-3 px-4 text-right">
                              <span className="inline-flex items-center bg-cyan-950/50 text-cyan-400 font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg border border-cyan-800/40 select-none">
                                {projectedSerials.get(it.id)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- RENDER STANDARD FLAT LIST LAYOUT --- */}
      {viewMode === 'list' && (
        <div className="bg-cool-gray-900/80 rounded-2xl border border-cool-gray-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-cool-gray-850/50 border-b border-cool-gray-800 text-[10px] sm:text-xs font-bold text-cool-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-4 w-10">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(selectedIds.size < items.length)}
                      className="text-cool-gray-400 hover:text-white transition cursor-pointer"
                    >
                      {selectedIds.size === items.length ? (
                        <CheckSquare className="w-5 h-5 text-cyan-400" />
                      ) : selectedIds.size > 0 ? (
                        <div className="w-5 h-5 bg-cyan-950 text-cyan-400 rounded flex items-center justify-center font-bold border border-cyan-800/40 text-[10px] select-none">-</div>
                      ) : (
                        <Square className="w-5 h-5 text-cool-gray-600" />
                      )}
                    </button>
                  </th>
                  <th className="py-4 px-3">Cut / Product</th>
                  <th className="py-4 px-3 w-40">Tags</th>
                  <th className="py-4 px-3 w-28">Pieces (Qty)</th>
                  <th className="py-4 px-3 w-28">Weight (lbs)</th>
                  <th className="py-4 px-3 w-44">Destination Location</th>
                  <th className="py-4 px-3 w-44">Pallet</th>
                  <th className="py-4 px-3 w-36">Box Name</th>
                  <th className="py-4 px-3 min-w-[140px]">Notes</th>
                  <th className="py-4 px-4 sm:px-6 text-right w-36">Projected Serial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cool-gray-800/60 text-xs sm:text-sm">
                {items.map(it => {
                  const locObj = storageLocations.find(l => l.id === it.locationId);
                  const hasPallets = locObj?.hasPallets ?? false;
                  const locationPallets = (state.pallets || []).filter(p => !p.isArchived && p.storageLocationId === it.locationId);
                  const isSelected = selectedIds.has(it.id);

                  return (
                    <tr key={it.id} className={`hover:bg-cool-gray-850/30 transition-colors ${isSelected ? 'bg-indigo-600/5' : ''}`}>
                      {/* Checkbox */}
                      <td className="py-4 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectItem(it.id)}
                          className="text-cool-gray-400 hover:text-white transition cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-400" />
                          ) : (
                            <Square className="w-4 h-4 text-cool-gray-700" />
                          )}
                        </button>
                      </td>

                      {/* Cut / Product */}
                      <td className="py-4 px-3">
                        <div className="flex items-start gap-2 max-w-xs">
                          <span className="p-1.5 bg-cool-gray-800 text-cool-gray-300 rounded-lg mt-0.5 border border-cool-gray-700 shrink-0">
                            <Package size={14} />
                          </span>
                          <div>
                            <div className="font-bold text-white leading-tight">{it.cuts}</div>
                            {it.packDate && (
                              <span className="inline-block mt-1 text-[10px] text-cool-gray-400 bg-cool-gray-950 px-1.5 py-0.5 rounded border border-cool-gray-800">
                                Packed: {it.packDate}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tags */}
                      <td className="py-4 px-3">
                        <div className="flex flex-col gap-1">
                          {(it.tagIds && it.tagIds.length > 0) && (
                            <div className="flex flex-wrap gap-1">
                              {it.tagIds.map((tagId: string) => {
                                const tag = (state.tags || []).find((t: any) => t.id === tagId);
                                if (!tag) return null;
                                return (
                                  <span
                                    key={tag.id}
                                    style={{ 
                                      backgroundColor: `${tag.color || '#38bdf8'}20`, 
                                      borderColor: `${tag.color || '#38bdf8'}40`, 
                                      color: tag.color || '#38bdf8' 
                                    }}
                                    className="inline-flex items-center gap-1 text-[9px] border px-1.5 py-0.2 rounded font-semibold uppercase select-none"
                                    title={tag.description || tag.name}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tag.color || '#38bdf8' }} />
                                    <span className="truncate max-w-[80px]">{tag.name}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => setOpenTagSelectorId(it.id)}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-cool-gray-400 hover:text-cyan-300 bg-cool-gray-950 border border-cool-gray-750 hover:border-cyan-500/50 px-2 py-0.5 rounded transition cursor-pointer self-start"
                          >
                            <TagIcon size={10} className="text-cyan-400" />
                            <span>{(it.tagIds || []).length > 0 ? 'Edit Tags' : '+ Add Tag'}</span>
                          </button>
                        </div>
                      </td>

                      {/* Pieces / Qty & Split Button */}
                      <td className="py-4 px-3">
                        <div className="flex flex-col gap-1.5 justify-center">
                          <div className="font-black text-white text-base ml-2">{it.pieces} <span className="text-[10px] font-bold text-cool-gray-400 uppercase">pcs</span></div>
                          {it.pieces > 1 && (
                            <button
                              type="button"
                              onClick={() => handleSplitItem(it.id)}
                              className="flex items-center gap-1 self-start px-2 py-1 bg-cyan-950/60 border border-cyan-800/50 hover:bg-cyan-900/50 text-cyan-400 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                              title="Split grouped cuts into individual single rows"
                            >
                              <Layers size={10} />
                              <span>Split Rows</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Weight (lbs) */}
                      <td className="py-4 px-3">
                        <div className="flex items-center gap-1">
                          <input 
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.netWeight || ''}
                            onChange={(e) => handleUpdateItem(it.id, { netWeight: parseFloat(e.target.value) || 0 })}
                            className="w-20 bg-cool-gray-950 border border-cool-gray-700 rounded-lg py-1 px-2 text-center text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-bold"
                            placeholder="0.00"
                          />
                          <span className="text-[10px] font-bold text-cool-gray-400">lbs</span>
                        </div>
                      </td>

                      {/* Destination Location Dropdown */}
                      <td className="py-4 px-3">
                        <select
                          value={it.locationId || ''}
                          onChange={(e) => handleUpdateItem(it.id, { locationId: e.target.value })}
                          className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold cursor-pointer"
                        >
                          {storageLocations.map(l => (
                            <option key={l.id} value={l.id}>{l.name} {l.isHome ? '(On-Site / Home)' : ''}</option>
                          ))}
                        </select>
                      </td>

                      {/* Destination Pallet Select or Text input */}
                      <td className="py-4 px-3">
                        <div className="space-y-1.5">
                          {it.isCustomPallet ? (
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="text"
                                placeholder="Custom Pallet ID"
                                value={it.customPalletName || ''}
                                onChange={(e) => handleUpdateItem(it.id, { customPalletName: e.target.value })}
                                className={`w-full bg-cool-gray-950 rounded-lg py-1 px-2 text-xs font-bold focus:outline-none ${
                                  !(it.customPalletName || '').trim()
                                    ? 'border border-amber-500 text-amber-300 placeholder:text-amber-700/60 focus:ring-1 focus:ring-amber-500'
                                    : 'border border-cyan-800/40 text-cyan-400 placeholder:text-cool-gray-700 focus:ring-1 focus:ring-cyan-500'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateItem(it.id, { isCustomPallet: false, palletName: '' })}
                                className="p-1 hover:bg-cool-gray-800 text-cool-gray-400 hover:text-white rounded transition cursor-pointer"
                                title="Choose existing pallet"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <select
                              value={it.palletName || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__custom__') {
                                  handleUpdateItem(it.id, { isCustomPallet: true, customPalletName: '' });
                                } else {
                                  handleUpdateItem(it.id, { palletName: val });
                                }
                              }}
                              className={`w-full bg-cool-gray-950 rounded-lg py-1 px-2 text-xs font-semibold cursor-pointer focus:outline-none ${
                                !it.palletName
                                  ? 'border border-amber-500 text-amber-300 focus:ring-1 focus:ring-amber-500'
                                  : 'border border-cool-gray-700 text-white focus:ring-1 focus:ring-cyan-500'
                              }`}
                            >
                              <option value="">⚠️ Select Pallet (Required)</option>
                              {locationPallets.map(p => (
                                <option key={p.id} value={p.id}>{p.id}</option>
                              ))}
                              <option value="__custom__" className="text-cyan-400 font-bold">+ Create Custom Pallet...</option>
                            </select>
                          )}
                          {!isItemPalletValid(it) && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-400 font-bold">
                              <AlertTriangle size={10} />
                              <span>Pallet required</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Box Name */}
                      <td className="py-4 px-3">
                        <input 
                          type="text"
                          value={it.box || ''}
                          onChange={(e) => handleUpdateItem(it.id, { box: e.target.value })}
                          className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-lg py-1 px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 font-semibold"
                          placeholder="e.g. Box 12"
                        />
                      </td>

                      {/* Notes */}
                      <td className="py-4 px-3">
                        <input 
                          type="text"
                          placeholder="Add notes..."
                          value={it.notes || ''}
                          onChange={(e) => handleUpdateItem(it.id, { notes: e.target.value })}
                          className="w-full bg-cool-gray-950 border border-cool-gray-700 rounded-lg py-1 px-2 text-xs text-white placeholder:text-cool-gray-600 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-normal"
                        />
                      </td>

                      {/* Projected Serial Badge */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <span className="inline-flex items-center bg-cyan-950/50 text-cyan-400 font-mono text-xs font-bold px-2.5 py-1 rounded-lg border border-cyan-800/40 select-none shadow-sm">
                          {projectedSerials.get(it.id)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Worksheet Footer Actions */}
      <div className="bg-cool-gray-900 border border-cool-gray-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-cool-gray-850/40 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-cool-gray-400 flex items-center gap-2">
            {missingPalletItems.length > 0 ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{missingPalletItems.length} item(s) need a pallet assigned before finalization can proceed.</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle size={14} className="shrink-0" />
                <span>All pallet selections verified. Ready to finalize.</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            {/* Finalize Button */}
            <button
              type="button"
              onClick={handleFinalize}
              className={`flex items-center gap-2 font-black uppercase text-xs tracking-wider px-5 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 ${
                missingPalletItems.length > 0
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-950/30'
                  : 'bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 shadow-indigo-950/20'
              }`}
            >
              <FileCheck size={14} className="stroke-[3]" />
              <span>Finalize & Move Off-Site</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pallet Validation Modal */}
      {showPalletValidationModal && (
        <PalletValidationModal
          missingItems={missingPalletItems}
          onSelectAllMissing={() => {
            handleSelectAllMissingPallet();
            setShowPalletValidationModal(false);
          }}
          onClose={() => setShowPalletValidationModal(false)}
        />
      )}

      {/* Item Tag Popover */}
      {openTagSelectorId && (() => {
        const targetItem = items.find(it => it.id === openTagSelectorId);
        if (!targetItem) return null;
        return (
          <WorksheetTagPopover
            item={targetItem}
            currentTagIds={targetItem.tagIds || []}
            tags={state.tags || []}
            onSaveTags={(newTagIds) => handleUpdateItem(targetItem.id, { tagIds: newTagIds })}
            onClose={() => setOpenTagSelectorId(null)}
          />
        );
      })()}

      {/* Bulk Tag Popover */}
      {isBulkTagPopoverOpen && (
        <BulkTagPopover
          selectedTagIds={bulkTagIds}
          tags={state.tags || []}
          onSaveTags={(newTagIds) => setBulkTagIds(newTagIds)}
          onClose={() => setIsBulkTagPopoverOpen(false)}
        />
      )}
    </div>
  );
};
