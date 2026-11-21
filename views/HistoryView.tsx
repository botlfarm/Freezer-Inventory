// History view
import React, { useState, useMemo } from 'react';
import {
  InventoryState,
  Action,
  UndoSnapshotItem,
  Freezer,
  Container,
  Product,
  MeatCut,
  AppLocation,
  HistoryEntry,
  HistoryScope,
  OffSiteEntry,
  ButcherOrder,
  MovementOrder,
  AppPallet
} from '../types';
import { SearchIcon } from '../components/icons';
import { SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { calculateHistoryRetention } from '../utils/historyRetention';
import {
  resolveHistoryScope,
  getHistoryUndoMode,
  ScopeLookupContext
} from '../utils/auditHistory';

interface HistoryViewProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  onOpenUndo?: (historyId?: string) => void;
  undoSnapshots?: UndoSnapshotItem[];
  canPurgeHistory?: boolean;
}

export type DateRangeOption = '24hours' | 'today' | '7days' | '30days' | '90days' | 'all' | 'custom';
export type ScopeFilterOption = 'all' | HistoryScope;
type PurgeMode = '1year' | '2years' | '3years' | '5years';

interface OptionItem {
  id: string;
  name: string;
  subtext?: string;
}

export interface HistoryLocationInfo {
  type: 'meatCut' | 'container' | 'freezer' | 'product' | 'location' | 'offsiteEntry' | 'butcherOrder' | 'movementOrder' | 'pallet' | 'details';
  containerId?: string;
  freezerId?: string;
  productId?: string;
  locationId?: string;
  palletName?: string;
  orderId?: string;
  label: string;
  detail: string;
}

export interface EnrichedHistoryEntry extends HistoryEntry {
  timestampMs: number;
  resolvedScope: HistoryScope;
  locInfo: HistoryLocationInfo | null;
}

const SCOPE_META: Record<HistoryScope, { label: string; textClass: string }> = {
  onsite: { label: 'On-Site', textClass: 'text-cyan-400' },
  offsite: { label: 'Off-Site', textClass: 'text-emerald-400' },
  butcher: { label: 'Butcher', textClass: 'text-amber-400' },
  system: { label: 'System', textClass: 'text-cool-gray-300' }
};

const HISTORY_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit'
});

const timestampMsCache = new Map<string, number>();
const formattedTimestampCache = new Map<string, string>();

export const parseHistoryTimestampMs = (timestamp?: string): number => {
  if (!timestamp) return NaN;
  const cached = timestampMsCache.get(timestamp);
  if (cached !== undefined) return cached;
  const ms = Date.parse(timestamp);
  if (timestampMsCache.size > 15000) {
    timestampMsCache.clear();
  }
  timestampMsCache.set(timestamp, ms);
  return ms;
};

export const formatHistoryTimestamp = (timestamp?: string): string => {
  if (!timestamp) return '';
  const cached = formattedTimestampCache.get(timestamp);
  if (cached !== undefined) return cached;
  const ms = parseHistoryTimestampMs(timestamp);
  const formatted = isNaN(ms) ? timestamp : HISTORY_DATE_FORMATTER.format(new Date(ms));
  if (formattedTimestampCache.size > 15000) {
    formattedTimestampCache.clear();
  }
  formattedTimestampCache.set(timestamp, formatted);
  return formatted;
};

interface SearchableCheckboxDropdownProps {
  label: string;
  singularLabel: string;
  icon: string;
  options: OptionItem[];
  selectedIds: Set<string>;
  onChange: (newSelected: Set<string>) => void;
  placeholder?: string;
}

const SearchableCheckboxDropdown: React.FC<SearchableCheckboxDropdownProps> = ({
  label,
  singularLabel,
  icon,
  options,
  selectedIds,
  onChange,
  placeholder = "Search..."
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    if (!isOpen) return options;
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter(o => 
      o.name.toLowerCase().includes(term) || 
      (o.subtext && o.subtext.toLowerCase().includes(term))
    );
  }, [options, search, isOpen]);

  const toggleOption = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(next);
  };

  const handleSelectAll = () => {
    const next = new Set(selectedIds);
    filteredOptions.forEach(o => next.add(o.id));
    onChange(next);
  };

  const handleClearAll = () => {
    const next = new Set(selectedIds);
    filteredOptions.forEach(o => next.delete(o.id));
    onChange(next);
  };

  const count = selectedIds.size;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left rounded-lg border py-2 px-3 text-xs flex justify-between items-center transition select-none ${
          count > 0 
            ? 'bg-cyan-950/80 border-cyan-500/80 text-cyan-200 font-semibold shadow-xs' 
            : 'bg-cool-gray-800 border-cool-gray-700 hover:border-cool-gray-600 text-cool-gray-200'
        }`}
      >
        <span className="truncate flex items-center gap-1.5">
          <span>{icon}</span>
          <span>
            {count === 0 ? `All ${label}` : `${count} ${count === 1 ? singularLabel : label} Selected`}
          </span>
        </span>
        <span className="text-cool-gray-400 text-[10px] ml-1">▼</span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 right-0 sm:left-auto sm:w-72 mt-1 z-40 bg-cool-gray-850 border border-cool-gray-650 rounded-xl shadow-2xl p-2.5 flex flex-col max-h-72 animate-scale-up">
            {/* Header & Close */}
            <div className="flex justify-between items-center mb-2 px-1">
              <span className="text-xs font-bold text-cyan-400 flex items-center gap-1">
                <span>{icon}</span>
                <span>Filter by {label}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-cool-gray-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>

            {/* Search Input */}
            <div className="mb-2 relative">
              <input
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="w-full bg-cool-gray-900 text-cool-gray-100 text-xs px-2.5 py-1.5 rounded-lg border border-cool-gray-700 focus:outline-none focus:border-cyan-500 placeholder:text-cool-gray-500"
              />
            </div>

            {/* Select All / Clear All Quick Actions */}
            <div className="flex justify-between items-center pb-2 mb-1.5 border-b border-cool-gray-750 text-[11px] px-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Select All ({filteredOptions.length})
              </button>
              {count > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-cool-gray-400 hover:text-red-400 font-medium"
                >
                  Clear ({count})
                </button>
              )}
            </div>

            {/* Checkbox Options List */}
            <div className="overflow-y-auto space-y-0.5 flex-1 pr-1">
              {filteredOptions.length === 0 ? (
                <div className="text-center py-4 text-xs text-cool-gray-500">
                  No {label.toLowerCase()} found
                </div>
              ) : (
                filteredOptions.map(opt => {
                  const isChecked = selectedIds.has(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition select-none ${
                        isChecked
                          ? 'bg-cyan-950/60 text-cyan-100 font-medium'
                          : 'hover:bg-cool-gray-750 text-cool-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOption(opt.id)}
                        className="rounded bg-cool-gray-900 border-cool-gray-600 text-cyan-500 focus:ring-cyan-500/50 w-3.5 h-3.5 cursor-pointer"
                      />
                      <div className="truncate flex-1">
                        <div className="truncate">{opt.name}</div>
                        {opt.subtext && (
                          <div className="text-[10px] text-cool-gray-400 truncate">{opt.subtext}</div>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const INITIAL_RENDER_LIMIT = 50;
const FALLBACK_RECENT_COUNT = 25;

const HistoryView: React.FC<HistoryViewProps> = ({ state, dispatch, onOpenUndo, undoSnapshots, canPurgeHistory = false }) => {
    // Filter States - Default to '24hours' so opening the Audit Log is instantaneous
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedScope, setSelectedScope] = useState<ScopeFilterOption>('all');
    const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('24hours');
    const [hasExplicitDateSelection, setHasExplicitDateSelection] = useState(false);
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [visibleLimit, setVisibleLimit] = useState<number>(INITIAL_RENDER_LIMIT);
    const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set());
    
    // Filter Panel Visibility
    const [showFilters, setShowFilters] = useState(false);

    // Checkbox Sets for Multi-Select Filters
    const [selectedFreezerIds, setSelectedFreezerIds] = useState<Set<string>>(new Set());
    const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set());
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
    const [selectedPalletNames, setSelectedPalletNames] = useState<Set<string>>(new Set());
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
    const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(new Set());

    // Modals
    const [showUndoConfirm, setShowUndoConfirm] = useState(false);
    const [showPurgeModal, setShowPurgeModal] = useState(false);
    const [purgeMode, setPurgeMode] = useState<PurgeMode>('1year');
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
    const [confirmRevertOrderModal, setConfirmRevertOrderModal] = useState<{
        orderId: string;
        orderName: string;
        historyDescription: string;
    } | null>(null);

    // Pre-indexed O(1) Entity Lookup Maps
    const {
        freezersMap,
        containersMap,
        productsMap,
        meatCutsMap,
        locationsMap,
        locationByNameMap,
        offSiteEntriesMap,
        butcherOrdersMap,
        movementOrdersMap,
        palletsMap,
        scopeLookupContext
    } = useMemo(() => {
        const fMap = new Map<string, Freezer>();
        const cMap = new Map<string, Container>();
        const pMap = new Map<string, Product>();
        const mMap = new Map<string, MeatCut>();
        const lMap = new Map<string, AppLocation>();
        const lNameMap = new Map<string, AppLocation>();
        const oMap = new Map<string, OffSiteEntry>();
        const bMap = new Map<string, ButcherOrder>();
        const moMap = new Map<string, MovementOrder>();
        const palMap = new Map<string, AppPallet>();

        const offSiteEntryIds = new Set<string>();
        const butcherOrderIds = new Set<string>();
        const movementOrderIds = new Set<string>();
        const palletIds = new Set<string>();
        const locationIds = new Set<string>();
        const productIds = new Set<string>();

        const freezers = state.freezers || [];
        for (let i = 0; i < freezers.length; i++) fMap.set(freezers[i].id, freezers[i]);

        const containers = state.containers || [];
        for (let i = 0; i < containers.length; i++) cMap.set(containers[i].id, containers[i]);

        const products = state.products || [];
        for (let i = 0; i < products.length; i++) {
            pMap.set(products[i].id, products[i]);
            productIds.add(products[i].id);
        }

        const meatCuts = state.meatCuts || [];
        for (let i = 0; i < meatCuts.length; i++) mMap.set(meatCuts[i].id, meatCuts[i]);

        const locations = state.locations || [];
        for (let i = 0; i < locations.length; i++) {
            lMap.set(locations[i].id, locations[i]);
            lNameMap.set(locations[i].name.trim().toLowerCase(), locations[i]);
            locationIds.add(locations[i].id);
        }

        const offSiteEntries = state.offSiteEntries || [];
        for (let i = 0; i < offSiteEntries.length; i++) {
            oMap.set(offSiteEntries[i].id, offSiteEntries[i]);
            offSiteEntryIds.add(offSiteEntries[i].id);
        }

        const butcherOrders = state.butcherOrders || [];
        for (let i = 0; i < butcherOrders.length; i++) {
            bMap.set(butcherOrders[i].id, butcherOrders[i]);
            butcherOrderIds.add(butcherOrders[i].id);
        }

        const movementOrders = state.movementOrders || [];
        for (let i = 0; i < movementOrders.length; i++) {
            moMap.set(movementOrders[i].id, movementOrders[i]);
            movementOrderIds.add(movementOrders[i].id);
        }

        const pallets = state.pallets || [];
        for (let i = 0; i < pallets.length; i++) {
            palMap.set(pallets[i].id, pallets[i]);
            palletIds.add(pallets[i].id);
        }

        return {
            freezersMap: fMap,
            containersMap: cMap,
            productsMap: pMap,
            meatCutsMap: mMap,
            locationsMap: lMap,
            locationByNameMap: lNameMap,
            offSiteEntriesMap: oMap,
            butcherOrdersMap: bMap,
            movementOrdersMap: moMap,
            palletsMap: palMap,
            scopeLookupContext: {
                offSiteEntryIds,
                butcherOrderIds,
                movementOrderIds,
                palletIds,
                locationIds,
                productIds
            } satisfies ScopeLookupContext
        };
    }, [
        state.freezers,
        state.containers,
        state.products,
        state.meatCuts,
        state.locations,
        state.offSiteEntries,
        state.butcherOrders,
        state.movementOrders,
        state.pallets
    ]);

    // Memoized O(1) location & entity context resolver per history entry
    const resolveLocationInfo = useMemo(() => {
        const cache = new Map<string, HistoryLocationInfo | null>();
        return (entryOrTarget?: HistoryEntry | string): HistoryLocationInfo | null => {
            const entry = typeof entryOrTarget === 'string' ? undefined : entryOrTarget;
            const targetId = typeof entryOrTarget === 'string' ? entryOrTarget : entryOrTarget?.targetId;
            const details = entry?.details;
            const cacheKey = entry
                ? `${entry.id}:${targetId || ''}:${details?.locationName || ''}:${details?.palletName || ''}:${details?.orderNumber || ''}:${details?.relatedOrderId || ''}`
                : targetId || '';
            if (!cacheKey) return null;
            if (cache.has(cacheKey)) return cache.get(cacheKey)!;

            let result: HistoryLocationInfo | null = null;

            if (targetId) {
                // 1. Meat cut check
                const meatCut = meatCutsMap.get(targetId);
                if (meatCut) {
                    const product = productsMap.get(meatCut.productId);
                    const container = containersMap.get(meatCut.containerId);
                    const freezer = container?.freezerId ? freezersMap.get(container.freezerId) : undefined;
                    const containerName = container?.name || 'Staging Area';
                    const freezerName = freezer?.name || (container ? 'Unassigned Freezer' : 'Staging');
                    result = {
                        type: 'meatCut',
                        containerId: container?.id,
                        freezerId: freezer?.id,
                        productId: product?.id,
                        label: `${containerName} -> ${freezerName}`,
                        detail: product?.name ? `${product.name} in ${containerName} (${freezerName})` : `${containerName} (${freezerName})`
                    };
                } else {
                    // 2. Container check
                    const container = containersMap.get(targetId);
                    if (container) {
                        const freezer = container.freezerId ? freezersMap.get(container.freezerId) : undefined;
                        const freezerName = freezer?.name || 'Unassigned / Staging';
                        result = {
                            type: 'container',
                            containerId: container.id,
                            freezerId: freezer?.id,
                            label: `${container.name} (${freezerName})`,
                            detail: `Container "${container.name}" in ${freezerName}`
                        };
                    } else {
                        // 3. Freezer check
                        const freezer = freezersMap.get(targetId);
                        if (freezer) {
                            result = {
                                type: 'freezer',
                                freezerId: freezer.id,
                                label: freezer.name,
                                detail: `Freezer "${freezer.name}"`
                            };
                        } else {
                            // 4. Off-site entry check
                            const offSite = offSiteEntriesMap.get(targetId);
                            if (offSite) {
                                const locObj =
                                    (offSite.storageLocationId ? locationsMap.get(offSite.storageLocationId) : undefined) ||
                                    (offSite.location ? locationByNameMap.get(offSite.location.trim().toLowerCase()) : undefined);
                                const palletName = (offSite.currentLocation || offSite.pallet || '').trim() || undefined;
                                const locName = locObj?.name || offSite.location || 'Off-Site';
                                const product = offSite.productId ? productsMap.get(offSite.productId) : undefined;
                                result = {
                                    type: 'offsiteEntry',
                                    locationId: locObj?.id || offSite.storageLocationId,
                                    palletName,
                                    productId: product?.id,
                                    orderId: offSite.orderId,
                                    label: palletName ? `${locName} · ${palletName}` : locName,
                                    detail: `${product?.name || offSite.cuts || 'Package'} at ${locName}${palletName ? ` (${palletName})` : ''}`
                                };
                            } else {
                                // 5. Butcher order check
                                const butcherOrder = butcherOrdersMap.get(targetId);
                                if (butcherOrder) {
                                    const locObj =
                                        (butcherOrder.locationId ? locationsMap.get(butcherOrder.locationId) : undefined) ||
                                        (butcherOrder.targetLocation ? locationByNameMap.get(butcherOrder.targetLocation.trim().toLowerCase()) : undefined);
                                    const locName = locObj?.name || butcherOrder.targetLocation;
                                    const palletName = (butcherOrder.targetPallet || butcherOrder.pallet || '').trim() || undefined;
                                    result = {
                                        type: 'butcherOrder',
                                        orderId: butcherOrder.id,
                                        locationId: locObj?.id || butcherOrder.locationId,
                                        palletName,
                                        label: `Order #${butcherOrder.orderNumber}${locName ? ` · ${locName}` : ''}`,
                                        detail: `Butcher Order #${butcherOrder.orderNumber} (${butcherOrder.species || 'Butcher'})`
                                    };
                                } else {
                                    // 6. Movement order check
                                    const movOrder = movementOrdersMap.get(targetId);
                                    if (movOrder) {
                                        result = {
                                            type: 'movementOrder',
                                            orderId: movOrder.id,
                                            label: `${movOrder.name} (${movOrder.status})`,
                                            detail: `Movement Order "${movOrder.name}"`
                                        };
                                    } else {
                                        // 7. Pallet check
                                        const pallet = palletsMap.get(targetId);
                                        if (pallet) {
                                            const locObj = pallet.storageLocationId ? locationsMap.get(pallet.storageLocationId) : undefined;
                                            result = {
                                                type: 'pallet',
                                                palletName: pallet.id,
                                                locationId: locObj?.id || pallet.storageLocationId,
                                                label: locObj ? `${locObj.name} · ${pallet.id}` : `Pallet ${pallet.id}`,
                                                detail: `Pallet "${pallet.id}"${locObj ? ` at ${locObj.name}` : ''}`
                                            };
                                        } else {
                                            // 8. Product check
                                            const product = productsMap.get(targetId);
                                            if (product) {
                                                result = {
                                                    type: 'product',
                                                    productId: product.id,
                                                    label: product.name,
                                                    detail: `Product "${product.name}"`
                                                };
                                            } else {
                                                // 9. AppLocation check
                                                const location = locationsMap.get(targetId);
                                                if (location) {
                                                    result = {
                                                        type: 'location',
                                                        locationId: location.id,
                                                        label: location.name,
                                                        detail: `Location "${location.name}"`
                                                    };
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Fallback/supplement from structured details metadata (supports bulk/archived/deleted records)
            if (!result && details) {
                const matchedLoc = details.locationName
                    ? locationByNameMap.get(details.locationName.trim().toLowerCase())
                    : undefined;
                const relatedButcher = details.relatedOrderId ? butcherOrdersMap.get(details.relatedOrderId) : undefined;
                const relatedMove = details.relatedOrderId ? movementOrdersMap.get(details.relatedOrderId) : undefined;
                const labelParts: string[] = [];
                if (details.orderNumber) labelParts.push(`Order #${details.orderNumber}`);
                else if (details.orderName) labelParts.push(details.orderName);
                if (details.locationName) labelParts.push(details.locationName);
                if (details.palletName) labelParts.push(details.palletName);

                if (labelParts.length > 0 || relatedButcher || relatedMove) {
                    result = {
                        type: 'details',
                        locationId: matchedLoc?.id || relatedButcher?.locationId,
                        palletName: details.palletName,
                        orderId: details.relatedOrderId,
                        label: labelParts.join(' · ') || relatedMove?.name || `Order #${relatedButcher?.orderNumber}`,
                        detail: labelParts.join(' · ')
                    };
                }
            }

            cache.set(cacheKey, result);
            return result;
        };
    }, [
        meatCutsMap,
        containersMap,
        freezersMap,
        productsMap,
        locationsMap,
        locationByNameMap,
        offSiteEntriesMap,
        butcherOrdersMap,
        movementOrdersMap,
        palletsMap
    ]);

    // Options for Searchable Checkbox Dropdowns
    const freezerOptions = useMemo<OptionItem[]>(() => {
        return (state.freezers || []).map(f => ({
            id: f.id,
            name: f.name,
            subtext: (f as any).type ? `Type: ${(f as any).type}` : 'Freezer'
        }));
    }, [state.freezers]);

    const containerOptions = useMemo<OptionItem[]>(() => {
        return (state.containers || []).map(c => {
            const freezer = c.freezerId ? freezersMap.get(c.freezerId) : undefined;
            return {
                id: c.id,
                name: c.name,
                subtext: freezer ? `Freezer: ${freezer.name}` : 'Unassigned / Loose Area'
            };
        });
    }, [state.containers, freezersMap]);

    const productOptions = useMemo<OptionItem[]>(() => {
        return (state.products || []).map(p => ({
            id: p.id,
            name: p.name,
            subtext: (p as any).cutCategory ? `Category: ${(p as any).cutCategory}` : 'Product'
        }));
    }, [state.products]);

    const locationOptions = useMemo<OptionItem[]>(() => {
        return (state.locations || []).map(l => ({
            id: l.id,
            name: l.name,
            subtext: l.isHome ? 'Home Base' : (l.hasPallets ? 'Cold Storage (Pallets)' : 'Storage / Delivery')
        }));
    }, [state.locations]);

    const palletOptions = useMemo<OptionItem[]>(() => {
        const palletMap = new Map<string, string>();
        for (const p of state.pallets || []) {
            if (!p?.id) continue;
            const locName = p.storageLocationId ? locationsMap.get(p.storageLocationId)?.name : undefined;
            palletMap.set(p.id, locName ? `Location: ${locName}` : 'Pallet');
        }
        for (const e of state.offSiteEntries || []) {
            const name = (e.currentLocation || e.pallet || '').trim();
            if (!name || palletMap.has(name)) continue;
            palletMap.set(name, e.location ? `Location: ${e.location}` : 'Off-Site Pallet');
        }
        for (const h of state.history || []) {
            const name = h.details?.palletName?.trim();
            if (!name || palletMap.has(name)) continue;
            palletMap.set(name, h.details?.locationName ? `Location: ${h.details.locationName}` : 'Historical Pallet');
        }
        return Array.from(palletMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([name, subtext]) => ({
                id: name,
                name,
                subtext
            }));
    }, [state.pallets, state.offSiteEntries, state.history, locationsMap]);

    const formatUserDisplay = (usr?: string) => {
        if (!usr || !usr.trim()) return 'System';
        const clean = usr.trim();
        if (clean === 'Home Assistant' || clean === 'System') return clean;
        return clean.startsWith('@') ? clean : `@${clean}`;
    };

    // Single pass over history to extract unique users, devices, and ensure descending order
    const { uniqueUsers, deviceOptions, sortedHistory } = useMemo(() => {
        const rawHistory = state.history || [];
        const users = new Set<string>();
        const devices = new Set<string>([
            'Desktop Browser',
            'Mobile Browser',
            'Standalone PWA',
            'HA Companion App'
        ]);

        let isDescending = true;
        let prevMs = Infinity;

        for (let i = 0; i < rawHistory.length; i++) {
            const h = rawHistory[i];
            if (h.user && h.user.trim()) {
                users.add(h.user.trim());
            }
            if (h.clientDevice && h.clientDevice.trim()) {
                devices.add(h.clientDevice.trim());
            }
            const ms = parseHistoryTimestampMs(h.timestamp);
            if (!isNaN(ms)) {
                if (ms > prevMs) {
                    isDescending = false;
                }
                prevMs = ms;
            }
        }

        const ordered = isDescending
            ? rawHistory
            : [...rawHistory].sort((a, b) => {
                  const bMs = parseHistoryTimestampMs(b.timestamp) || 0;
                  const aMs = parseHistoryTimestampMs(a.timestamp) || 0;
                  return bMs - aMs;
              });

        const userOpts: OptionItem[] = Array.from(users)
            .sort()
            .map(usr => ({
                id: usr,
                name: formatUserDisplay(usr),
                subtext: 'User'
            }));

        const devOpts: OptionItem[] = Array.from(devices)
            .sort()
            .map(dev => {
                let icon = '💻';
                if (dev.includes('Companion')) icon = '📱';
                else if (dev.includes('Standalone') || dev.includes('PWA')) icon = '⚡';
                else if (dev.includes('Mobile')) icon = '📱';
                return {
                    id: dev,
                    name: `${icon} ${dev}`,
                    subtext: 'Client Platform'
                };
            });

        return {
            uniqueUsers: userOpts,
            deviceOptions: devOpts,
            sortedHistory: ordered
        };
    }, [state.history]);

    // Pre-index undo snapshot IDs for O(1) button checks
    const undoSnapshotIds = useMemo(() => {
        const set = new Set<string>();
        const list = undoSnapshots || [];
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            if (s.historyId) set.add(s.historyId);
            if (s.targetId) set.add(s.targetId);
        }
        return set;
    }, [undoSnapshots]);

    const hasEntityOrSearchFilters =
        selectedScope !== 'all' ||
        searchTerm.trim() !== '' ||
        selectedFreezerIds.size > 0 ||
        selectedContainerIds.size > 0 ||
        selectedProductIds.size > 0 ||
        selectedLocationIds.size > 0 ||
        selectedPalletNames.size > 0 ||
        selectedUsers.size > 0 ||
        selectedDeviceIds.size > 0;

    // If user is actively searching or filtering by entity/scope and hasn't manually locked a timeframe, search across all history
    const effectiveDateRange: DateRangeOption =
        !hasExplicitDateSelection && dateRangeOption === '24hours' && hasEntityOrSearchFilters
            ? 'all'
            : dateRangeOption;

    // Fast Multi-Dimensional Filter Engine
    const {
        filteredHistory,
        usingRecentFallback,
        countLast24h,
        countLast7d,
        scopeCounts
    } = useMemo(() => {
        const now = Date.now();
        const cutoff24h = now - 24 * 3600 * 1000;
        const cutoff7d = now - 7 * 86400 * 1000;
        const cutoff30d = now - 30 * 86400 * 1000;
        const cutoff90d = now - 90 * 86400 * 1000;

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const startOfDayMs = startOfDay.getTime();

        const customStartMs =
            effectiveDateRange === 'custom' && customStartDate
                ? new Date(customStartDate).getTime()
                : NaN;
        const customEndMs =
            effectiveDateRange === 'custom' && customEndDate
                ? new Date(customEndDate).setHours(23, 59, 59, 999)
                : NaN;

        const selectedFreezerNames = Array.from(selectedFreezerIds)
            .map(id => (freezersMap.get(id)?.name || '').toLowerCase())
            .filter(Boolean);

        const selectedContainerNames = Array.from(selectedContainerIds)
            .map(id => (containersMap.get(id)?.name || '').toLowerCase())
            .filter(Boolean);

        const selectedProductNames = Array.from(selectedProductIds)
            .map(id => (productsMap.get(id)?.name || '').toLowerCase())
            .filter(Boolean);

        const selectedLocationNames = Array.from(selectedLocationIds)
            .map(id => (locationsMap.get(id)?.name || '').toLowerCase())
            .filter(Boolean);

        const selectedPalletLowerSet = new Set(
            (Array.from(selectedPalletNames) as string[]).map(p => p.trim().toLowerCase())
        );

        const searchLower = searchTerm.trim().toLowerCase();
        const needLocForFilter =
            selectedFreezerIds.size > 0 ||
            selectedContainerIds.size > 0 ||
            selectedProductIds.size > 0 ||
            selectedLocationIds.size > 0 ||
            selectedPalletNames.size > 0 ||
            searchLower !== '';

        const matched: Array<{ entry: HistoryEntry; resolvedScope: HistoryScope }> = [];
        let c24 = 0;
        let c7d = 0;
        const counts = {
            all: 0,
            onsite: 0,
            offsite: 0,
            butcher: 0,
            system: 0
        };

        for (let i = 0; i < sortedHistory.length; i++) {
            const entry = sortedHistory[i];
            const entryTime = parseHistoryTimestampMs(entry.timestamp);
            const validTime = !isNaN(entryTime);

            if (validTime) {
                if (entryTime >= cutoff24h) c24++;
                if (entryTime >= cutoff7d) c7d++;
            }

            // 1. Date Range Filter
            if (validTime) {
                if (effectiveDateRange === '24hours' && entryTime < cutoff24h) {
                    continue;
                } else if (effectiveDateRange === 'today' && entryTime < startOfDayMs) {
                    continue;
                } else if (effectiveDateRange === '7days' && entryTime < cutoff7d) {
                    continue;
                } else if (effectiveDateRange === '30days' && entryTime < cutoff30d) {
                    continue;
                } else if (effectiveDateRange === '90days' && entryTime < cutoff90d) {
                    continue;
                } else if (effectiveDateRange === 'custom') {
                    if (!isNaN(customStartMs) && entryTime < customStartMs) continue;
                    if (!isNaN(customEndMs) && entryTime > customEndMs) continue;
                }
            }

            // 2. User Checkbox Filter
            if (selectedUsers.size > 0 && !selectedUsers.has(entry.user || '')) {
                continue;
            }

            // 3. Device Checkbox Filter
            if (selectedDeviceIds.size > 0 && !selectedDeviceIds.has(entry.clientDevice || '')) {
                continue;
            }

            // Resolve location info in O(1) only if needed by remaining filters
            const locInfo = needLocForFilter ? resolveLocationInfo(entry) : null;
            const descLower =
                needLocForFilter ? (entry.description || '').toLowerCase() : '';
            const details = entry.details;

            // 4. Freezer Checkbox Filter
            if (selectedFreezerIds.size > 0) {
                const matchesFreezerId = Boolean(locInfo?.freezerId && selectedFreezerIds.has(locInfo.freezerId));
                const matchesFreezerName =
                    !matchesFreezerId && selectedFreezerNames.some(name => descLower.includes(name));
                if (!matchesFreezerId && !matchesFreezerName) continue;
            }

            // 5. Container Checkbox Filter
            if (selectedContainerIds.size > 0) {
                const matchesContainerId = Boolean(locInfo?.containerId && selectedContainerIds.has(locInfo.containerId));
                const matchesContainerName =
                    !matchesContainerId && selectedContainerNames.some(name => descLower.includes(name));
                if (!matchesContainerId && !matchesContainerName) continue;
            }

            // 6. Product Checkbox Filter
            if (selectedProductIds.size > 0) {
                const matchesProductId = Boolean(locInfo?.productId && selectedProductIds.has(locInfo.productId));
                const matchesProductName =
                    !matchesProductId &&
                    (selectedProductNames.some(name => descLower.includes(name)) ||
                        Boolean(
                            details?.items?.some(it =>
                                selectedProductNames.some(name => it.cut.toLowerCase().includes(name))
                            )
                        ));
                if (!matchesProductId && !matchesProductName) continue;
            }

            // 7. Off-Site Location Checkbox Filter
            if (selectedLocationIds.size > 0) {
                const detailsLocLower = (details?.locationName || '').trim().toLowerCase();
                const matchesLocId = Boolean(locInfo?.locationId && selectedLocationIds.has(locInfo.locationId));
                const matchesDetailsLoc =
                    !matchesLocId &&
                    detailsLocLower !== '' &&
                    selectedLocationNames.some(name => detailsLocLower === name || detailsLocLower.includes(name));
                const matchesItemsLoc =
                    !matchesLocId &&
                    !matchesDetailsLoc &&
                    Boolean(
                        details?.items?.some(it => {
                            const itemLoc = (it.location || '').trim().toLowerCase();
                            return itemLoc !== '' && selectedLocationNames.some(name => itemLoc === name || itemLoc.includes(name));
                        })
                    );
                const matchesDescLoc =
                    !matchesLocId &&
                    !matchesDetailsLoc &&
                    !matchesItemsLoc &&
                    selectedLocationNames.some(name => descLower.includes(name));
                if (!matchesLocId && !matchesDetailsLoc && !matchesItemsLoc && !matchesDescLoc) continue;
            }

            // 8. Pallet Checkbox Filter
            if (selectedPalletNames.size > 0) {
                const locPallet = (locInfo?.palletName || '').trim().toLowerCase();
                const detailsPallet = (details?.palletName || '').trim().toLowerCase();
                const matchesPalletDirect =
                    (locPallet !== '' && selectedPalletLowerSet.has(locPallet)) ||
                    (detailsPallet !== '' && selectedPalletLowerSet.has(detailsPallet));
                const matchesPalletItems =
                    !matchesPalletDirect &&
                    Boolean(
                        details?.items?.some(it => {
                            const p = (it.pallet || '').trim().toLowerCase();
                            return p !== '' && selectedPalletLowerSet.has(p);
                        })
                    );
                const matchesPalletDesc =
                    !matchesPalletDirect &&
                    !matchesPalletItems &&
                    Array.from(selectedPalletLowerSet).some(p => p.length > 1 && descLower.includes(p));
                if (!matchesPalletDirect && !matchesPalletItems && !matchesPalletDesc) continue;
            }

            // 9. Text Search Filter (description, user, location, device, details, preview items)
            if (searchLower) {
                const matchesDesc = descLower.includes(searchLower);
                const matchesUsr = !matchesDesc && (entry.user || '').toLowerCase().includes(searchLower);
                const matchesLocLabel =
                    !matchesDesc && !matchesUsr && (locInfo?.label || '').toLowerCase().includes(searchLower);
                const matchesLocDetail =
                    !matchesDesc &&
                    !matchesUsr &&
                    !matchesLocLabel &&
                    (locInfo?.detail || '').toLowerCase().includes(searchLower);
                const matchesDev =
                    !matchesDesc &&
                    !matchesUsr &&
                    !matchesLocLabel &&
                    !matchesLocDetail &&
                    (entry.clientDevice || '').toLowerCase().includes(searchLower);
                const matchesInfo =
                    !matchesDesc &&
                    !matchesUsr &&
                    !matchesLocLabel &&
                    !matchesLocDetail &&
                    !matchesDev &&
                    (entry.clientInfo || '').toLowerCase().includes(searchLower);
                const matchesDetails =
                    !matchesDesc &&
                    !matchesUsr &&
                    !matchesLocLabel &&
                    !matchesLocDetail &&
                    !matchesDev &&
                    !matchesInfo &&
                    Boolean(
                        details &&
                            ((details.orderNumber || '').toLowerCase().includes(searchLower) ||
                                (details.orderName || '').toLowerCase().includes(searchLower) ||
                                (details.locationName || '').toLowerCase().includes(searchLower) ||
                                (details.palletName || '').toLowerCase().includes(searchLower) ||
                                details.items?.some(
                                    it =>
                                        (it.cut || '').toLowerCase().includes(searchLower) ||
                                        (it.serial || '').toLowerCase().includes(searchLower) ||
                                        (it.box || '').toLowerCase().includes(searchLower) ||
                                        (it.pallet || '').toLowerCase().includes(searchLower) ||
                                        (it.location || '').toLowerCase().includes(searchLower)
                                ))
                    );

                if (
                    !matchesDesc &&
                    !matchesUsr &&
                    !matchesLocLabel &&
                    !matchesLocDetail &&
                    !matchesDev &&
                    !matchesInfo &&
                    !matchesDetails
                ) {
                    continue;
                }
            }

            const resolvedScope = resolveHistoryScope(entry, scopeLookupContext);
            counts.all++;
            counts[resolvedScope]++;

            // 10. Operational Scope Filter
            if (selectedScope !== 'all' && resolvedScope !== selectedScope) {
                continue;
            }

            matched.push({ entry, resolvedScope });
        }

        // If on default '24hours' view with no other filters and 0 entries occurred in the last 24h,
        // automatically fall back to the most recent 25 entries so the user immediately sees the latest changes.
        if (
            matched.length === 0 &&
            effectiveDateRange === '24hours' &&
            !hasExplicitDateSelection &&
            !hasEntityOrSearchFilters &&
            sortedHistory.length > 0
        ) {
            const fallbackEntries = sortedHistory.slice(0, FALLBACK_RECENT_COUNT);
            const fallbackCounts = { all: fallbackEntries.length, onsite: 0, offsite: 0, butcher: 0, system: 0 };
            const wrapped = fallbackEntries.map(entry => {
                const resolvedScope = resolveHistoryScope(entry, scopeLookupContext);
                fallbackCounts[resolvedScope]++;
                return { entry, resolvedScope };
            });
            return {
                filteredHistory: wrapped,
                usingRecentFallback: true,
                countLast24h: c24,
                countLast7d: c7d,
                scopeCounts: fallbackCounts
            };
        }

        return {
            filteredHistory: matched,
            usingRecentFallback: false,
            countLast24h: c24,
            countLast7d: c7d,
            scopeCounts: counts
        };
    }, [
        sortedHistory,
        effectiveDateRange,
        hasExplicitDateSelection,
        hasEntityOrSearchFilters,
        customStartDate,
        customEndDate,
        selectedScope,
        selectedUsers,
        selectedFreezerIds,
        selectedContainerIds,
        selectedProductIds,
        selectedLocationIds,
        selectedPalletNames,
        selectedDeviceIds,
        searchTerm,
        freezersMap,
        containersMap,
        productsMap,
        locationsMap,
        scopeLookupContext,
        resolveLocationInfo
    ]);

    // Slice to visible DOM limit and attach O(1) location info ONLY for visible rows
    const visibleHistory = useMemo<EnrichedHistoryEntry[]>(() => {
        const slice = filteredHistory.slice(0, visibleLimit);
        return slice.map(({ entry, resolvedScope }) => ({
            ...entry,
            timestampMs: parseHistoryTimestampMs(entry.timestamp) || 0,
            resolvedScope,
            locInfo: resolveLocationInfo(entry)
        }));
    }, [filteredHistory, visibleLimit, resolveLocationInfo]);

    const activeFilterCount =
        (hasExplicitDateSelection && dateRangeOption !== 'all' ? 1 : 0) +
        selectedFreezerIds.size +
        selectedContainerIds.size +
        selectedProductIds.size +
        selectedLocationIds.size +
        selectedPalletNames.size +
        selectedUsers.size +
        selectedDeviceIds.size;

    const hasActiveFilters =
        hasEntityOrSearchFilters ||
        (hasExplicitDateSelection && dateRangeOption !== 'all');

    const handleClearFilters = () => {
        setSearchTerm('');
        setSelectedScope('all');
        setDateRangeOption('24hours');
        setHasExplicitDateSelection(false);
        setCustomStartDate('');
        setCustomEndDate('');
        setSelectedFreezerIds(new Set());
        setSelectedContainerIds(new Set());
        setSelectedProductIds(new Set());
        setSelectedLocationIds(new Set());
        setSelectedPalletNames(new Set());
        setSelectedUsers(new Set());
        setSelectedDeviceIds(new Set());
        setVisibleLimit(INITIAL_RENDER_LIMIT);
    };

    const handleSelectDateRange = (nextRange: DateRangeOption, explicit: boolean = true) => {
        setDateRangeOption(nextRange);
        setHasExplicitDateSelection(explicit);
        setVisibleLimit(INITIAL_RENDER_LIMIT);
    };

    const toggleExpandEntry = (entryId: string) => {
        setExpandedEntryIds(prev => {
            const next = new Set(prev);
            if (next.has(entryId)) next.delete(entryId);
            else next.add(entryId);
            return next;
        });
    };

    // LAZY Purge Estimation: ONLY run calculateHistoryRetention when the Purge Modal is actually open for an admin!
    const purgeEstimation = useMemo(() => {
        if (!canPurgeHistory || !showPurgeModal) {
            return { purgeCount: 0, remainCount: 0, protectedActiveCount: 0, activePackagesCount: 0 };
        }
        const total = (state.history || []).length;
        if (total === 0) return { purgeCount: 0, remainCount: 0, protectedActiveCount: 0, activePackagesCount: 0 };

        const daysMap: Record<PurgeMode, number> = {
            '1year': 365,
            '2years': 730,
            '3years': 1095,
            '5years': 1825
        };
        const days = daysMap[purgeMode] || 365;
        const res = calculateHistoryRetention(state.history || [], state, days);
        return {
            purgeCount: res.purgedCount,
            remainCount: res.keptCount + 1, // +1 for the audit maintenance entry that will be logged
            protectedActiveCount: res.protectedActiveCount,
            activePackagesCount: res.activePackagesCount
        };
    }, [
        canPurgeHistory,
        showPurgeModal,
        state.history,
        state.meatCuts,
        state.offSiteEntries,
        state.containers,
        state.movementOrders,
        state.butcherOrders,
        state.pallets,
        purgeMode
    ]);

    const handleExecutePurge = () => {
        if (!canPurgeHistory) return;
        const daysMap: Record<PurgeMode, number> = {
            '1year': 365,
            '2years': 730,
            '3years': 1095,
            '5years': 1825
        };
        dispatch({ type: 'PURGE_HISTORY', payload: { olderThanDays: daysMap[purgeMode] || 365 } });
        setShowPurgeConfirm(false);
        setShowPurgeModal(false);
    };

    const handleUndo = () => {
        if (onOpenUndo) {
            onOpenUndo();
        } else {
            setShowUndoConfirm(true);
        }
    };

    const canUndo = (undoSnapshots && undoSnapshots.length > 0) || Boolean(state.history && state.history.length > 0 && onOpenUndo);
    const totalHistoryCount = state.history?.length || 0;

    return (
        <div className="bg-cool-gray-800/50 p-4 sm:p-6 rounded-lg border border-cool-gray-700 shadow-lg">
             {/* Header */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                <div>
                    <h2 className="text-2xl font-bold text-cyan-400">Global Inventory History & Audit Log</h2>
                    <p className="text-xs text-cool-gray-400 mt-0.5">
                        Total Recorded Actions: <span className="text-cool-gray-200 font-semibold">{totalHistoryCount}</span> entries
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {canPurgeHistory && (
                        <button 
                            id="history-purge-maintenance-btn"
                            onClick={() => setShowPurgeModal(true)} 
                            className="px-3.5 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-200 font-medium text-xs sm:text-sm rounded-lg border border-cool-gray-600 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            title="Purge older logs to maintain clean performance (Admin only)"
                        >
                            <span>🧹</span>
                            <span>Purge / Maintenance</span>
                        </button>
                    )}
                    <button 
                        id="history-view-undo-button"
                        onClick={handleUndo} 
                        disabled={!canUndo}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-cool-gray-950 text-xs sm:text-sm font-bold rounded-lg shadow-md transition flex items-center gap-1.5 disabled:bg-cool-gray-600 disabled:text-cool-gray-400 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                        title="Undo an inventory action or select a change to revert"
                    >
                        <span>↩️</span>
                        <span>Undo / Rollback...</span>
                        {undoSnapshots && undoSnapshots.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 font-mono text-xs font-extrabold">
                                {undoSnapshots.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Undo Confirmation Modal */}
            {showUndoConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="w-full max-w-sm p-5 bg-cool-gray-800 border border-cool-gray-700 rounded-lg shadow-xl animate-scale-up text-left">
                        <h4 className="text-md font-bold text-yellow-500 mb-2">Undo Action Confirmation</h4>
                        <p className="text-sm text-cool-gray-300 leading-relaxed">
                            Are you sure you want to undo the last action? This will roll back your inventory state to the previous checkpoint.
                        </p>
                        <div className="flex justify-end gap-2.5 mt-5">
                            <button 
                                onClick={() => setShowUndoConfirm(false)} 
                                className="px-3 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-600 text-white text-xs font-semibold rounded transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={() => {
                                    dispatch({type: 'UNDO'});
                                    setShowUndoConfirm(false);
                                }} 
                                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-semibold rounded transition"
                            >
                                Yes, Undo Action
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Purge / Maintenance Modal (Admin Only) */}
            {canPurgeHistory && showPurgeModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="w-full max-w-lg p-6 bg-cool-gray-800 border border-cool-gray-700 rounded-xl shadow-2xl animate-scale-up text-left">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-cool-gray-700">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">🧹</span>
                                <h3 className="text-lg font-bold text-cyan-400">History Log Maintenance & Purge</h3>
                            </div>
                            <button 
                                onClick={() => { setShowPurgeModal(false); setShowPurgeConfirm(false); }}
                                className="text-cool-gray-400 hover:text-white text-lg font-bold px-2"
                            >
                                ✕
                            </button>
                        </div>

                        {!showPurgeConfirm ? (
                            <>
                                <div className="p-3.5 bg-cyan-950/40 border border-cyan-800/60 rounded-lg text-xs text-cyan-200 mb-4 space-y-1.5">
                                    <div className="flex items-center gap-2 font-semibold text-cyan-300">
                                        <span>🛡️</span>
                                        <span>Lifecycle & Out-of-Custody Retention Safeguard</span>
                                    </div>
                                    <p className="text-[11px] text-cyan-100/90 leading-relaxed">
                                        Audit log entries are <strong>never deleted merely by calendar age</strong> while a package remains in the system. Even if a package has been in inventory for 6+ years across dozens of moves, its entire chain of custody is 100% protected.
                                    </p>
                                    <p className="text-[11px] text-cyan-200/80 leading-relaxed">
                                        Entries are only eligible for purge once a package has been <strong>completely out of your hands</strong> (consumed, zeroed out, or archived) for longer than the selected retention threshold.
                                    </p>
                                </div>

                                <div className="space-y-2.5 mb-5">
                                    {[
                                        { id: '1year', label: 'Purge packages out of system for > 1 year (365 days)', desc: 'Protects active packages + retains 1 full year of records after physical exit' },
                                        { id: '2years', label: 'Purge packages out of system for > 2 years (730 days)', desc: 'Protects active packages + retains 2 full years of records after physical exit' },
                                        { id: '3years', label: 'Purge packages out of system for > 3 years (1,095 days)', desc: 'Standard compliance: protects active packages + retains 3 years post-exit records' },
                                        { id: '5years', label: 'Purge packages out of system for > 5 years (1,825 days)', desc: 'Long-term enterprise custody: protects active packages + retains 5 years post-exit records' }
                                    ].map((opt) => (
                                        <label 
                                            key={opt.id} 
                                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                                                purgeMode === opt.id 
                                                    ? 'bg-cyan-950/40 border-cyan-500/70 text-cyan-200' 
                                                    : 'bg-cool-gray-900/50 border-cool-gray-700 hover:border-cool-gray-600 text-cool-gray-300'
                                            }`}
                                        >
                                            <input 
                                                type="radio" 
                                                name="purgeMode" 
                                                checked={purgeMode === opt.id}
                                                onChange={() => setPurgeMode(opt.id as PurgeMode)}
                                                className="mt-1 text-cyan-500 focus:ring-cyan-500"
                                            />
                                            <div>
                                                <div className="text-xs font-semibold">{opt.label}</div>
                                                <div className="text-[11px] text-cool-gray-400">{opt.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                {/* Preview Stats Box */}
                                <div className="p-3.5 bg-cool-gray-900/90 rounded-lg border border-cool-gray-750 text-xs space-y-2 mb-6">
                                    <div className="flex justify-between items-center">
                                        <span className="text-cool-gray-400">Eligible to purge (out of custody &gt; threshold):</span>
                                        <span className="ml-1.5 font-bold text-red-400">{purgeEstimation.purgeCount} entries</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-cool-gray-400">Protected & retained entries:</span>
                                        <span className="ml-1.5 font-bold text-emerald-400">{purgeEstimation.remainCount} entries</span>
                                    </div>
                                    <div className="pt-2 border-t border-cool-gray-800 flex justify-between items-center text-[11px]">
                                        <span className="text-cyan-400 font-medium">Active packages in system:</span>
                                        <span className="text-cyan-300 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                                            {purgeEstimation.activePackagesCount} packages (100% history protected)
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2.5">
                                    <button 
                                        onClick={() => setShowPurgeModal(false)}
                                        className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => setShowPurgeConfirm(true)}
                                        disabled={purgeEstimation.purgeCount === 0}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-cool-gray-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
                                    >
                                        Review & Purge
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-200">
                                    <p className="font-bold text-red-300 mb-1">⚠️ Confirm History Purge</p>
                                    <p className="leading-relaxed">
                                        You are about to permanently purge <strong className="text-white">{purgeEstimation.purgeCount}</strong> audit entries associated with packages/records that have been departed/out of the system for more than {purgeMode === '1year' ? '1 year' : purgeMode === '2years' ? '2 years' : purgeMode === '3years' ? '3 years' : '5 years'}.
                                    </p>
                                    <p className="text-[11px] text-red-300/80 mt-2">
                                        All active packages in inventory remain 100% protected with their full historical move logs preserved.
                                    </p>
                                </div>

                                <div className="flex justify-end gap-2.5 pt-2">
                                    <button 
                                        onClick={() => setShowPurgeConfirm(false)}
                                        className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-200 text-xs font-semibold rounded-lg transition"
                                    >
                                        Back
                                    </button>
                                    <button 
                                        onClick={handleExecutePurge}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow-md transition"
                                    >
                                        Confirm & Purge Now
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Filter Bar Controls */}
            <div className="bg-cool-gray-900/60 p-3.5 sm:p-4 rounded-xl border border-cool-gray-750 space-y-3 mb-5">
                {/* Search + Filters Button */}
                <div className="flex items-center gap-2.5">
                    {/* Text Search */}
                    <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <SearchIcon className="h-4 w-4 text-cool-gray-400" />
                        </div>
                        <input
                            id="history-search-input"
                            type="text"
                            placeholder="Search description, item, location, user..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setVisibleLimit(INITIAL_RENDER_LIMIT);
                            }}
                            className="block w-full rounded-lg border-0 bg-cool-gray-800 py-2 pl-9 pr-8 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-700 placeholder:text-cool-gray-400 focus:ring-2 focus:ring-cyan-500 text-xs sm:text-sm"
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setVisibleLimit(INITIAL_RENDER_LIMIT);
                                }}
                                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-cool-gray-400 hover:text-white cursor-pointer text-xs font-bold"
                                title="Clear search"
                                aria-label="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filters Toggle Button */}
                    <button
                        id="history-filters-toggle-btn"
                        type="button"
                        onClick={() => setShowFilters(prev => !prev)}
                        aria-expanded={showFilters}
                        aria-controls="history-filters-panel"
                        className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs sm:text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
                            showFilters || activeFilterCount > 0
                                ? 'bg-cyan-950/60 border-cyan-500/70 text-cyan-300 shadow-xs'
                                : 'bg-cool-gray-800 border-cool-gray-700 hover:border-cool-gray-600 text-cool-gray-200 hover:text-white'
                        }`}
                        title={showFilters ? 'Hide filters' : 'Show all filters'}
                    >
                        <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                        <span>Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-cyan-500 text-cool-gray-950 text-[10px] font-black font-mono tabular-nums">
                                {activeFilterCount}
                            </span>
                        )}
                        {showFilters ? (
                            <ChevronUp className="w-3.5 h-3.5 text-cool-gray-400" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-cool-gray-400" />
                        )}
                    </button>
                </div>

                {/* Operational Scope Segmented Filter Bar */}
                <div
                    id="history-scope-filter-bar"
                    className="flex flex-wrap items-center justify-between gap-2 pt-0.5"
                    role="tablist"
                    aria-label="Audit history scope filter"
                >
                    <div className="inline-flex flex-wrap sm:flex-nowrap items-center gap-1 p-1 bg-cool-gray-950/70 border border-cool-gray-800 rounded-lg">
                        {(
                            [
                                { id: 'all' as ScopeFilterOption, label: 'All', count: scopeCounts.all },
                                { id: 'onsite' as ScopeFilterOption, label: 'On-Site', count: scopeCounts.onsite },
                                { id: 'offsite' as ScopeFilterOption, label: 'Off-Site', count: scopeCounts.offsite },
                                { id: 'butcher' as ScopeFilterOption, label: 'Butcher', count: scopeCounts.butcher },
                                { id: 'system' as ScopeFilterOption, label: 'System', count: scopeCounts.system }
                            ] as const
                        ).map(tab => {
                            const isActive = selectedScope === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    id={`history-scope-tab-${tab.id}`}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => {
                                        setSelectedScope(tab.id);
                                        setVisibleLimit(INITIAL_RENDER_LIMIT);
                                    }}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                                        isActive
                                            ? 'bg-cool-gray-800 text-cyan-300 border border-cyan-500/40'
                                            : 'text-cool-gray-400 hover:text-cool-gray-200 border border-transparent'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className={`font-mono tabular-nums text-[11px] ${isActive ? 'text-cyan-400' : 'text-cool-gray-500'}`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {usingRecentFallback && (
                        <span className="text-[11px] text-amber-300/90 font-medium">
                            Quiet in last 24h · Showing latest {visibleHistory.length} changes
                        </span>
                    )}
                </div>

                {/* Collapsible All Filters Panel */}
                {showFilters && (
                    <div id="history-filters-panel" className="space-y-3 pt-3 border-t border-cool-gray-800 animate-fade-in">
                        {/* Timeframe Dropdown */}
                        <div>
                            <select
                                value={effectiveDateRange}
                                onChange={(e) => handleSelectDateRange(e.target.value as DateRangeOption, true)}
                                className="block w-full rounded-lg border-0 bg-cool-gray-800 py-2 px-3 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-700 focus:ring-2 focus:ring-cyan-500 text-xs sm:text-sm"
                            >
                                <option value="24hours">⚡ Time Period: Last 24 Hours (Fast)</option>
                                <option value="today">📅 Today</option>
                                <option value="7days">📅 Last 7 Days</option>
                                <option value="30days">📅 Last 30 Days</option>
                                <option value="90days">📅 Last 90 Days</option>
                                <option value="all">📅 All Time ({totalHistoryCount} entries)</option>
                                <option value="custom">📅 Custom Date Range...</option>
                            </select>
                        </div>

                        {/* Quick Timeframe Pills */}
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mr-1">Quick Window:</span>
                            {[
                                { id: '24hours' as DateRangeOption, label: `⚡ Last 24h (${countLast24h})` },
                                { id: '7days' as DateRangeOption, label: `7 Days (${countLast7d})` },
                                { id: '30days' as DateRangeOption, label: '30 Days' },
                                { id: 'all' as DateRangeOption, label: `All Time (${totalHistoryCount})` }
                            ].map(pill => {
                                const isActive = effectiveDateRange === pill.id;
                                return (
                                    <button
                                        key={pill.id}
                                        type="button"
                                        onClick={() => handleSelectDateRange(pill.id, true)}
                                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                                            isActive
                                                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                                                : 'bg-cool-gray-800/80 border-cool-gray-700 text-cool-gray-300 hover:border-cyan-500/50 hover:text-white'
                                        }`}
                                    >
                                        {pill.label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom Date Pickers (if Custom Selected) */}
                        {effectiveDateRange === 'custom' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-fade-in">
                                <div>
                                    <label className="block text-[11px] font-semibold text-cool-gray-400 mb-1">Start Date</label>
                                    <input 
                                        type="date" 
                                        value={customStartDate}
                                        onChange={(e) => {
                                            setCustomStartDate(e.target.value);
                                            setVisibleLimit(INITIAL_RENDER_LIMIT);
                                        }}
                                        className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-lg px-3 py-1.5 text-xs text-cool-gray-100 focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-cool-gray-400 mb-1">End Date</label>
                                    <input 
                                        type="date" 
                                        value={customEndDate}
                                        onChange={(e) => {
                                            setCustomEndDate(e.target.value);
                                            setVisibleLimit(INITIAL_RENDER_LIMIT);
                                        }}
                                        className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-lg px-3 py-1.5 text-xs text-cool-gray-100 focus:ring-2 focus:ring-cyan-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Entity Searchable Checkbox Dropdowns: Freezer, Container, Location, Pallet, Product, User, Device */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                            {/* Freezer Searchable Checkbox Filter */}
                            <SearchableCheckboxDropdown
                                label="Freezers"
                                singularLabel="Freezer"
                                icon="❄️"
                                options={freezerOptions}
                                selectedIds={selectedFreezerIds}
                                onChange={(next) => {
                                    setSelectedFreezerIds(next);
                                    setVisibleLimit(INITIAL_RENDER_LIMIT);
                                }}
                                placeholder="Search freezers..."
                            />

                            {/* Container Searchable Checkbox Filter */}
                            <SearchableCheckboxDropdown
                                label="Containers"
                                singularLabel="Container"
                                icon="📦"
                                options={containerOptions}
                                selectedIds={selectedContainerIds}
                                onChange={(next) => {
                                    setSelectedContainerIds(next);
                                    setVisibleLimit(INITIAL_RENDER_LIMIT);
                                }}
                                placeholder="Search containers..."
                            />

                            {/* Off-Site Locations Searchable Checkbox Filter */}
                            <SearchableCheckboxDropdown
                                label="Locations"
                                singularLabel="Location"
                                icon="📍"
                                options={locationOptions}
                                selectedIds={selectedLocationIds}
                                onChange={(next) => {
                                    setSelectedLocationIds(next);
                                    setVisibleLimit(INITIAL_RENDER_LIMIT);
                                }}
                                placeholder="Search off-site locations..."
                            />

                            {/* Off-Site Pallets Searchable Checkbox Filter */}
                            <SearchableCheckboxDropdown
                                label="Pallets"
                                singularLabel="Pallet"
                                icon="🪵"
                                options={palletOptions}
                                selectedIds={selectedPalletNames}
                                onChange={(next) => {
                                    setSelectedPalletNames(next);
                                    setVisibleLimit(INITIAL_RENDER_LIMIT);
                                }}
                                placeholder="Search pallets..."
                            />

                            {/* Product Searchable Checkbox Filter */}
                            <SearchableCheckboxDropdown
                                label="Products"
                                singularLabel="Product"
                                icon="🥩"
                                options={productOptions}
                                selectedIds={selectedProductIds}
                                onChange={(next) => {
                                    setSelectedProductIds(next);
                                    setVisibleLimit(INITIAL_RENDER_LIMIT);
                                }}
                                placeholder="Search products..."
                            />

                            {/* User Searchable Checkbox Filter */}
                            <SearchableCheckboxDropdown
                                label="Users"
                                singularLabel="User"
                                icon="👤"
                                options={uniqueUsers}
                                selectedIds={selectedUsers}
                                onChange={(next) => {
                                    setSelectedUsers(next);
                                    setVisibleLimit(INITIAL_RENDER_LIMIT);
                                }}
                                placeholder="Search users..."
                            />

                            {/* Device / Client Searchable Checkbox Filter */}
                            <SearchableCheckboxDropdown
                                label="Devices / Apps"
                                singularLabel="Device"
                                icon="💻"
                                options={deviceOptions}
                                selectedIds={selectedDeviceIds}
                                onChange={(next) => {
                                    setSelectedDeviceIds(next);
                                    setVisibleLimit(INITIAL_RENDER_LIMIT);
                                }}
                                placeholder="Search devices..."
                            />
                        </div>

                        {/* Filter Summary & Clear Action */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cool-gray-800 text-xs">
                            <div className="text-cool-gray-400 flex items-center gap-1.5 flex-wrap">
                                <span>
                                    Showing{' '}
                                    <strong className="text-cyan-300 font-mono tabular-nums">{visibleHistory.length}</strong>
                                    {filteredHistory.length > visibleHistory.length && (
                                        <> (of <strong className="text-cyan-200 font-mono tabular-nums">{filteredHistory.length}</strong> matched)</>
                                    )}{' '}
                                    out of <strong className="text-cool-gray-200 font-mono tabular-nums">{totalHistoryCount}</strong> total log entries
                                </span>
                                {hasActiveFilters && (
                                    <span className="text-[11px] text-cyan-400/80 font-medium">
                                        (Active filters: {[
                                            selectedScope !== 'all' && `Scope: ${SCOPE_META[selectedScope].label}`,
                                            searchTerm && 'Search',
                                            hasExplicitDateSelection && dateRangeOption !== 'all' && 'Date Range',
                                            selectedFreezerIds.size > 0 && `${selectedFreezerIds.size} Freezer(s)`,
                                            selectedContainerIds.size > 0 && `${selectedContainerIds.size} Container(s)`,
                                            selectedLocationIds.size > 0 && `${selectedLocationIds.size} Location(s)`,
                                            selectedPalletNames.size > 0 && `${selectedPalletNames.size} Pallet(s)`,
                                            selectedProductIds.size > 0 && `${selectedProductIds.size} Product(s)`,
                                            selectedUsers.size > 0 && `${selectedUsers.size} User(s)`,
                                            selectedDeviceIds.size > 0 && `${selectedDeviceIds.size} Device(s)`
                                        ].filter(Boolean).join(', ')})
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                {effectiveDateRange !== 'all' && totalHistoryCount > filteredHistory.length && (
                                    <button
                                        type="button"
                                        onClick={() => handleSelectDateRange('all', true)}
                                        className="text-amber-400 hover:text-amber-300 font-semibold text-xs transition cursor-pointer"
                                    >
                                        Load All History ({totalHistoryCount}) →
                                    </button>
                                )}
                                {hasActiveFilters && (
                                    <button 
                                        onClick={handleClearFilters}
                                        className="text-cyan-400 hover:text-cyan-300 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
                                    >
                                        <span>✕</span>
                                        <span>Reset to Recent</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Confirm Movement Order Revert Modal */}
            {confirmRevertOrderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="w-full max-w-md p-5 bg-cool-gray-800 border border-cool-gray-700 rounded-xl shadow-2xl animate-scale-up text-left">
                        <div className="flex items-center gap-2.5 mb-2">
                            <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
                            <h4 className="text-base font-bold text-cool-gray-100">Revert Movement Order</h4>
                        </div>
                        <p className="text-xs text-cool-gray-300 leading-relaxed mb-2">
                            Revert execution for movement order <strong className="text-white">{confirmRevertOrderModal.orderName}</strong>?
                        </p>
                        <p className="text-[11px] text-cool-gray-400 bg-cool-gray-900 border border-cool-gray-750 rounded-lg p-2.5 mb-4">
                            {confirmRevertOrderModal.historyDescription}
                        </p>
                        <div className="flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setConfirmRevertOrderModal(null)}
                                className="px-3.5 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-200 text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                id="confirm-revert-movement-order-btn"
                                type="button"
                                onClick={() => {
                                    dispatch({
                                        type: 'REVERT_MOVEMENT_ORDER',
                                        payload: { id: confirmRevertOrderModal.orderId }
                                    });
                                    setConfirmRevertOrderModal(null);
                                }}
                                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-cool-gray-950 text-xs font-bold rounded-lg transition cursor-pointer"
                            >
                                Confirm Order Revert
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Log Entry List */}
            <div className="max-h-[60vh] overflow-y-auto pr-2">
                {visibleHistory.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-cool-gray-800/40 rounded-xl border border-dashed border-cool-gray-700">
                        <p className="text-cool-gray-300 text-sm font-medium">
                            {selectedScope !== 'all'
                                ? `No ${SCOPE_META[selectedScope].label} audit entries match your filter criteria.`
                                : 'No historical log entries match your filter criteria.'}
                        </p>
                        <div className="flex flex-wrap justify-center gap-2 mt-3">
                            {selectedScope !== 'all' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedScope('all');
                                        setVisibleLimit(INITIAL_RENDER_LIMIT);
                                    }}
                                    className="px-3.5 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-100 text-xs font-semibold rounded-lg transition cursor-pointer"
                                >
                                    Show All Scopes ({scopeCounts.all})
                                </button>
                            )}
                            {effectiveDateRange !== 'all' && totalHistoryCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleSelectDateRange('all', true)}
                                    className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                                >
                                    Search All Time ({totalHistoryCount} entries)
                                </button>
                            )}
                            {hasActiveFilters && (
                                <button 
                                    onClick={handleClearFilters}
                                    className="px-3 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-600 text-cyan-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                                >
                                    Reset Search Filters
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <ul className="space-y-2.5">
                            {visibleHistory.map(entry => {
                                const hasSnapshot = undoSnapshotIds.has(entry.id);
                                const hasUndoData = Boolean(entry.undoData);
                                const undoMode = getHistoryUndoMode(entry);
                                const scopeMeta = SCOPE_META[entry.resolvedScope];
                                const details = entry.details;
                                const previewItems = details?.items;
                                const hasItemsDrawer = Boolean(previewItems && previewItems.length > 0);
                                const isExpanded = expandedEntryIds.has(entry.id);
                                const relatedOrderId = details?.relatedOrderId;
                                const relatedMovementOrder = relatedOrderId ? movementOrdersMap.get(relatedOrderId) : undefined;
                                const canRevertOrder =
                                    undoMode === 'order_revert' &&
                                    Boolean(
                                        relatedOrderId &&
                                            relatedMovementOrder &&
                                            (relatedMovementOrder.status === 'completed' ||
                                                relatedMovementOrder.status === 'finalized')
                                    );

                                const itemCountBadge =
                                    details?.itemCount !== undefined && details.itemCount > 1
                                        ? `${details.itemCount} items`
                                        : undefined;
                                const weightReadout =
                                    details?.totalWeight !== undefined && details.totalWeight > 0
                                        ? `${details.totalWeight.toFixed(1)} lbs`
                                        : undefined;

                                return (
                                    <li key={entry.id} className="text-sm p-3.5 bg-cool-gray-800 rounded-lg border border-cool-gray-700 hover:border-cool-gray-600 transition">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                            <div className="space-y-1 min-w-0">
                                                <p className="text-cool-gray-100 font-medium leading-relaxed">{entry.description}</p>
                                                {(itemCountBadge || weightReadout || (details?.changedFields && details.changedFields.length > 0)) && (
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-cool-gray-400 font-mono tabular-nums">
                                                        {itemCountBadge && <span>{itemCountBadge}</span>}
                                                        {itemCountBadge && weightReadout && <span aria-hidden="true">·</span>}
                                                        {weightReadout && <span>{weightReadout}</span>}
                                                        {(itemCountBadge || weightReadout) && details?.changedFields && details.changedFields.length > 0 && (
                                                            <span aria-hidden="true">·</span>
                                                        )}
                                                        {details?.changedFields && details.changedFields.length > 0 && (
                                                            <span className="font-sans">
                                                                Updated: {details.changedFields.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {entry.locInfo && (
                                                <span
                                                    className="shrink-0 text-xs font-medium text-cyan-300/90 sm:text-right"
                                                    title={entry.locInfo.detail}
                                                >
                                                    {entry.locInfo.label}
                                                </span>
                                            )}
                                        </div>

                                        {hasItemsDrawer && (
                                            <div className="mt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpandEntry(entry.id)}
                                                    aria-expanded={isExpanded}
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <ChevronDown className="w-3.5 h-3.5" />
                                                    )}
                                                    <span className="tabular-nums">
                                                        {isExpanded
                                                            ? 'Hide items'
                                                            : `Show items (${details?.itemCount || previewItems!.length})`}
                                                    </span>
                                                </button>

                                                {isExpanded && (
                                                    <div className="mt-2 pt-2 border-t border-cool-gray-750 overflow-x-auto">
                                                        <table className="w-full text-left text-xs border-collapse">
                                                            <thead>
                                                                <tr className="text-[11px] font-semibold text-cool-gray-400 border-b border-cool-gray-750">
                                                                    <th className="py-1.5 pr-3">Cut</th>
                                                                    <th className="py-1.5 pr-3">Serial</th>
                                                                    <th className="py-1.5 pr-3">Box</th>
                                                                    <th className="py-1.5 pr-3">Pallet</th>
                                                                    <th className="py-1.5 pr-3">Location</th>
                                                                    <th className="py-1.5 pr-3 text-right">Pcs</th>
                                                                    <th className="py-1.5 pr-3 text-right">Weight</th>
                                                                    <th className="py-1.5 text-right">Note</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-cool-gray-750/70">
                                                                {previewItems!.map((item, idx) => (
                                                                    <tr key={item.id || item.serial || idx} className="text-cool-gray-200 hover:bg-cool-gray-750/30">
                                                                        <td className="py-1.5 pr-3 font-medium text-cool-gray-100">{item.cut}</td>
                                                                        <td className="py-1.5 pr-3 font-mono tabular-nums text-cool-gray-400">{item.serial || '—'}</td>
                                                                        <td className="py-1.5 pr-3 font-mono text-cool-gray-300">{item.box || '—'}</td>
                                                                        <td className="py-1.5 pr-3 text-cool-gray-300">{item.pallet || '—'}</td>
                                                                        <td className="py-1.5 pr-3 text-cool-gray-400">{item.location || '—'}</td>
                                                                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-cool-gray-200">
                                                                            {item.pieces !== undefined ? item.pieces : '—'}
                                                                        </td>
                                                                        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-cool-gray-200">
                                                                            {item.weight !== undefined ? `${item.weight.toFixed(1)} lbs` : '—'}
                                                                        </td>
                                                                        <td className="py-1.5 text-right text-cool-gray-400">
                                                                            {item.action || item.note || '—'}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                        {details?.truncatedCount && details.truncatedCount > 0 && (
                                                            <p className="mt-2 text-[11px] text-cool-gray-400 font-mono tabular-nums">
                                                                + {details.truncatedCount} more item(s) omitted from preview
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex flex-wrap justify-between items-center gap-2 mt-2.5 pt-2 border-t border-cool-gray-750 text-xs">
                                            <div className="flex items-center gap-2 flex-wrap text-cool-gray-400">
                                                <span className={`font-semibold ${scopeMeta.textClass}`}>
                                                    {scopeMeta.label}
                                                </span>
                                                <span aria-hidden="true">·</span>
                                                <span className="font-mono text-[11px] text-cool-gray-300">
                                                    {formatUserDisplay(entry.user)}
                                                </span>
                                                {entry.clientDevice && (
                                                    <>
                                                        <span aria-hidden="true">·</span>
                                                        <span
                                                            className="text-[11px] text-cool-gray-400"
                                                            title={entry.clientInfo || entry.clientDevice}
                                                        >
                                                            {entry.clientDevice}
                                                            {entry.clientInfo && entry.clientInfo.includes('•')
                                                                ? ` (${entry.clientInfo.split('•').slice(1).join('•').trim()})`
                                                                : ''}
                                                        </span>
                                                    </>
                                                )}
                                                <span aria-hidden="true">·</span>
                                                <time className="font-mono tabular-nums text-[11px] text-cool-gray-400">
                                                    {formatHistoryTimestamp(entry.timestamp)}
                                                </time>
                                            </div>

                                            {undoMode === 'audit_only' ? (
                                                <span
                                                    className="text-[11px] font-medium text-cool-gray-500 select-none"
                                                    title="Bulk imports, bulk mutations, and system maintenance events are recorded as permanent audit logs"
                                                >
                                                    Audit Only
                                                </span>
                                            ) : undoMode === 'order_revert' ? (
                                                canRevertOrder && relatedOrderId ? (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setConfirmRevertOrderModal({
                                                                orderId: relatedOrderId,
                                                                orderName: relatedMovementOrder?.name || details?.orderName || relatedOrderId,
                                                                historyDescription: entry.description
                                                            })
                                                        }
                                                        className="px-2.5 py-1 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300"
                                                        title="Revert this executed movement order back to planning"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                        <span>Revert Order</span>
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="text-[11px] font-medium text-cool-gray-500 select-none"
                                                        title={
                                                            relatedMovementOrder
                                                                ? `Movement order is currently in "${relatedMovementOrder.status}" status`
                                                                : 'Movement order has already been reverted or deleted'
                                                        }
                                                    >
                                                        {relatedMovementOrder ? 'Order Reverted' : 'Audit Only'}
                                                    </span>
                                                )
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (onOpenUndo) {
                                                            onOpenUndo(entry.id);
                                                        } else if (hasSnapshot || hasUndoData) {
                                                            dispatch({ type: 'UNDO', payload: { historyId: entry.id } });
                                                        }
                                                    }}
                                                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0 ${
                                                        hasSnapshot || hasUndoData || onOpenUndo
                                                            ? 'bg-amber-500 hover:bg-amber-400 text-cool-gray-950 shadow-xs'
                                                            : 'bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-300'
                                                    }`}
                                                    title={`Review and revert this action: "${entry.description}"`}
                                                >
                                                    <RotateCcw className="w-3 h-3" />
                                                    <span>Undo This</span>
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Progressive Load More / Expand Timeframe Footer */}
                        {(filteredHistory.length > visibleHistory.length ||
                            (effectiveDateRange !== 'all' && totalHistoryCount > filteredHistory.length)) && (
                            <div className="mt-4 p-3.5 bg-cool-gray-900/80 border border-cool-gray-750 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                <span className="text-cool-gray-400">
                                    Showing <strong className="text-cyan-300">{visibleHistory.length}</strong> of{' '}
                                    <strong className="text-cool-gray-200">{filteredHistory.length}</strong> entries in current timeframe
                                    {effectiveDateRange !== 'all' && totalHistoryCount > filteredHistory.length
                                        ? ` (${totalHistoryCount - filteredHistory.length} older entries available)`
                                        : ''}
                                </span>
                                <div className="flex flex-wrap items-center gap-2">
                                    {filteredHistory.length > visibleHistory.length && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setVisibleLimit(prev => prev + 100)}
                                                className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-700 text-cyan-300 border border-cool-gray-600 rounded-lg font-semibold transition cursor-pointer"
                                            >
                                                Show Next {Math.min(100, filteredHistory.length - visibleHistory.length)}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setVisibleLimit(filteredHistory.length)}
                                                className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-semibold transition cursor-pointer"
                                            >
                                                Show All Matched ({filteredHistory.length})
                                            </button>
                                        </>
                                    )}
                                    {effectiveDateRange === '24hours' && totalHistoryCount > filteredHistory.length && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectDateRange('7days', true)}
                                            className="px-3 py-1.5 bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-200 border border-cool-gray-600 rounded-lg font-semibold transition cursor-pointer"
                                        >
                                            Load Last 7 Days ({countLast7d})
                                        </button>
                                    )}
                                    {effectiveDateRange !== 'all' && totalHistoryCount > filteredHistory.length && (
                                        <button
                                            type="button"
                                            onClick={() => handleSelectDateRange('all', true)}
                                            className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-semibold transition cursor-pointer"
                                        >
                                            Load Full History ({totalHistoryCount})
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default HistoryView;
