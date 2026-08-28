import React, { useState, useMemo } from 'react';
import { InventoryState, Action } from '../types';
import { SearchIcon } from '../components/icons';

interface HistoryViewProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
}

type DateRangeOption = 'all' | 'today' | '7days' | '30days' | '90days' | 'custom';
type PurgeMode = '30days' | '60days' | '90days' | 'keep100' | 'keep250' | 'clearAll';

interface OptionItem {
  id: string;
  name: string;
  subtext?: string;
}

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
    if (!search.trim()) return options;
    const term = search.toLowerCase();
    return options.filter(o => 
      o.name.toLowerCase().includes(term) || 
      (o.subtext && o.subtext.toLowerCase().includes(term))
    );
  }, [options, search]);

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

const HistoryView: React.FC<HistoryViewProps> = ({ state, dispatch }) => {
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    
    // Checkbox Sets for Multi-Select Filters
    const [selectedFreezerIds, setSelectedFreezerIds] = useState<Set<string>>(new Set());
    const [selectedContainerIds, setSelectedContainerIds] = useState<Set<string>>(new Set());
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // Modals
    const [showUndoConfirm, setShowUndoConfirm] = useState(false);
    const [showPurgeModal, setShowPurgeModal] = useState(false);
    const [purgeMode, setPurgeMode] = useState<PurgeMode>('30days');
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

    // Options for Searchable Checkbox Dropdowns
    const freezerOptions = useMemo<OptionItem[]>(() => {
        return (state.freezers || []).map(f => ({
            id: f.id,
            name: f.name,
            subtext: f.type ? `Type: ${f.type}` : 'Freezer'
        }));
    }, [state.freezers]);

    const containerOptions = useMemo<OptionItem[]>(() => {
        return (state.containers || []).map(c => {
            const freezer = state.freezers?.find(f => f.id === c.freezerId);
            return {
                id: c.id,
                name: c.name,
                subtext: freezer ? `Freezer: ${freezer.name}` : 'Unassigned / Loose Area'
            };
        });
    }, [state.containers, state.freezers]);

    const productOptions = useMemo<OptionItem[]>(() => {
        return (state.products || []).map(p => ({
            id: p.id,
            name: p.name,
            subtext: p.cutCategory ? `Category: ${p.cutCategory}` : 'Product'
        }));
    }, [state.products]);

    const formatUserDisplay = (usr?: string) => {
        if (!usr || !usr.trim()) return 'System';
        const clean = usr.trim();
        if (clean === 'Home Assistant' || clean === 'System') return clean;
        return clean.startsWith('@') ? clean : `@${clean}`;
    };

    const uniqueUsers = useMemo<OptionItem[]>(() => {
        const users = new Set<string>();
        (state.history || []).forEach(h => {
            if (h.user && h.user.trim()) {
                users.add(h.user.trim());
            }
        });
        return Array.from(users).sort().map(usr => ({
            id: usr,
            name: formatUserDisplay(usr),
            subtext: 'User'
        }));
    }, [state.history]);

    const getLocationInfo = (targetId: string) => {
        if (!targetId) return null;
        
        // 1. Meat cut check
        const meatCut = state.meatCuts?.find(m => m.id === targetId);
        if (meatCut) {
            const product = state.products?.find(p => p.id === meatCut.productId);
            const container = state.containers?.find(c => c.id === meatCut.containerId);
            const freezer = container ? state.freezers?.find(f => f.id === container.freezerId) : undefined;
            const containerName = container?.name || 'Staging Area';
            const freezerName = freezer?.name || (container ? 'Unassigned Freezer' : 'Staging');
            return {
                type: 'meatCut',
                containerId: container?.id,
                freezerId: freezer?.id,
                productId: product?.id,
                label: `${containerName} → ${freezerName}`,
                detail: product?.name ? `${product.name} in ${containerName} (${freezerName})` : `${containerName} (${freezerName})`
            };
        }

        // 2. Container check
        const container = state.containers?.find(c => c.id === targetId);
        if (container) {
            const freezer = state.freezers?.find(f => f.id === container.freezerId);
            const freezerName = freezer?.name || 'Unassigned / Staging';
            return {
                type: 'container',
                containerId: container.id,
                freezerId: freezer?.id,
                label: `Container: ${container.name} (${freezerName})`,
                detail: `Container "${container.name}" in ${freezerName}`
            };
        }

        // 3. Freezer check
        const freezer = state.freezers?.find(f => f.id === targetId);
        if (freezer) {
            return {
                type: 'freezer',
                freezerId: freezer.id,
                label: `Freezer: ${freezer.name}`,
                detail: `Freezer "${freezer.name}"`
            };
        }

        // 4. Product check
        const product = state.products?.find(p => p.id === targetId);
        if (product) {
            return {
                type: 'product',
                productId: product.id,
                label: `Product: ${product.name}`,
                detail: `Product "${product.name}"`
            };
        }

        // 5. Offsite location check
        const location = state.locations?.find(l => l.id === targetId);
        if (location) {
            return {
                type: 'location',
                locationId: location.id,
                label: `Location: ${location.name}`,
                detail: `Location "${location.name}"`
            };
        }

        return null;
    };

    const historyWithLocations = useMemo(() => {
        const sorted = [...(state.history || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return sorted.map(entry => {
            const locInfo = getLocationInfo(entry.targetId);
            return {
                ...entry,
                locInfo
            };
        });
    }, [state.history, state.meatCuts, state.containers, state.freezers, state.products, state.locations]);

    // Advanced Multi-Dimensional Filter Engine
    const filteredHistory = useMemo(() => {
        const now = Date.now();
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        // Precompute lowercase names for selected entities
        const selectedFreezerNames = Array.from(selectedFreezerIds).map(id => 
            (state.freezers?.find(f => f.id === id)?.name || '').toLowerCase()
        ).filter(Boolean);

        const selectedContainerNames = Array.from(selectedContainerIds).map(id => 
            (state.containers?.find(c => c.id === id)?.name || '').toLowerCase()
        ).filter(Boolean);

        const selectedProductNames = Array.from(selectedProductIds).map(id => 
            (state.products?.find(p => p.id === id)?.name || '').toLowerCase()
        ).filter(Boolean);

        return historyWithLocations.filter(entry => {
            const entryTime = new Date(entry.timestamp).getTime();
            if (isNaN(entryTime)) return true;

            // 1. Date Range Filter
            if (dateRangeOption === 'today' && entryTime < startOfDay.getTime()) {
                return false;
            } else if (dateRangeOption === '7days' && entryTime < now - 7 * 86400 * 1000) {
                return false;
            } else if (dateRangeOption === '30days' && entryTime < now - 30 * 86400 * 1000) {
                return false;
            } else if (dateRangeOption === '90days' && entryTime < now - 90 * 86400 * 1000) {
                return false;
            } else if (dateRangeOption === 'custom') {
                if (customStartDate) {
                    const startMs = new Date(customStartDate).getTime();
                    if (!isNaN(startMs) && entryTime < startMs) return false;
                }
                if (customEndDate) {
                    const endMs = new Date(customEndDate).setHours(23, 59, 59, 999);
                    if (!isNaN(endMs) && entryTime > endMs) return false;
                }
            }

            // 2. User Checkbox Filter
            if (selectedUsers.size > 0 && !selectedUsers.has(entry.user || '')) {
                return false;
            }

            // 3. Freezer Checkbox Filter
            if (selectedFreezerIds.size > 0) {
                const descLower = (entry.description || '').toLowerCase();
                const matchesFreezerId = entry.locInfo?.freezerId && selectedFreezerIds.has(entry.locInfo.freezerId);
                const matchesFreezerName = selectedFreezerNames.some(name => descLower.includes(name));
                if (!matchesFreezerId && !matchesFreezerName) return false;
            }

            // 4. Container Checkbox Filter
            if (selectedContainerIds.size > 0) {
                const descLower = (entry.description || '').toLowerCase();
                const matchesContainerId = entry.locInfo?.containerId && selectedContainerIds.has(entry.locInfo.containerId);
                const matchesContainerName = selectedContainerNames.some(name => descLower.includes(name));
                if (!matchesContainerId && !matchesContainerName) return false;
            }

            // 5. Product Checkbox Filter
            if (selectedProductIds.size > 0) {
                const descLower = (entry.description || '').toLowerCase();
                const matchesProductId = entry.locInfo?.productId && selectedProductIds.has(entry.locInfo.productId);
                const matchesProductName = selectedProductNames.some(name => descLower.includes(name));
                if (!matchesProductId && !matchesProductName) return false;
            }

            // 6. Text Search Filter
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const desc = (entry.description || '').toLowerCase();
                const usr = (entry.user || '').toLowerCase();
                const locLabel = (entry.locInfo?.label || '').toLowerCase();
                const locDetail = (entry.locInfo?.detail || '').toLowerCase();
                if (!desc.includes(term) && !usr.includes(term) && !locLabel.includes(term) && !locDetail.includes(term)) {
                    return false;
                }
            }

            return true;
        });
    }, [
        historyWithLocations,
        dateRangeOption,
        customStartDate,
        customEndDate,
        selectedUsers,
        selectedFreezerIds,
        selectedContainerIds,
        selectedProductIds,
        searchTerm,
        state.freezers,
        state.containers,
        state.products
    ]);

    const hasActiveFilters = 
        searchTerm.trim() !== '' ||
        dateRangeOption !== 'all' ||
        selectedFreezerIds.size > 0 ||
        selectedContainerIds.size > 0 ||
        selectedProductIds.size > 0 ||
        selectedUsers.size > 0;

    const handleClearFilters = () => {
        setSearchTerm('');
        setDateRangeOption('all');
        setCustomStartDate('');
        setCustomEndDate('');
        setSelectedFreezerIds(new Set());
        setSelectedContainerIds(new Set());
        setSelectedProductIds(new Set());
        setSelectedUsers(new Set());
    };

    // Calculate purge estimations
    const purgeEstimation = useMemo(() => {
        const total = (state.history || []).length;
        if (total === 0) return { purgeCount: 0, remainCount: 0 };

        if (purgeMode === 'clearAll') {
            return { purgeCount: total, remainCount: 1 };
        } else if (purgeMode === 'keep100') {
            const purgeCount = Math.max(0, total - 100);
            return { purgeCount, remainCount: Math.min(total, 100) + 1 };
        } else if (purgeMode === 'keep250') {
            const purgeCount = Math.max(0, total - 250);
            return { purgeCount, remainCount: Math.min(total, 250) + 1 };
        } else {
            const daysMap: Record<string, number> = { '30days': 30, '60days': 60, '90days': 90 };
            const days = daysMap[purgeMode] || 30;
            const cutoff = Date.now() - (days * 86400 * 1000);
            let purgeCount = 0;
            (state.history || []).forEach(h => {
                const t = new Date(h.timestamp).getTime();
                if (!isNaN(t) && t < cutoff) {
                    purgeCount++;
                }
            });
            return { purgeCount, remainCount: (total - purgeCount) + 1 };
        }
    }, [state.history, purgeMode]);

    const handleExecutePurge = () => {
        if (purgeMode === 'clearAll') {
            dispatch({ type: 'PURGE_HISTORY', payload: { clearAll: true } });
        } else if (purgeMode === 'keep100') {
            dispatch({ type: 'PURGE_HISTORY', payload: { keepMax: 100 } });
        } else if (purgeMode === 'keep250') {
            dispatch({ type: 'PURGE_HISTORY', payload: { keepMax: 250 } });
        } else {
            const daysMap: Record<string, number> = { '30days': 30, '60days': 60, '90days': 90 };
            dispatch({ type: 'PURGE_HISTORY', payload: { olderThanDays: daysMap[purgeMode] || 30 } });
        }
        setShowPurgeConfirm(false);
        setShowPurgeModal(false);
    };

    const handleUndo = () => {
        setShowUndoConfirm(true);
    };

    const canUndo = state.previousState !== undefined;

    return (
        <div className="bg-cool-gray-800/50 p-4 sm:p-6 rounded-lg border border-cool-gray-700 shadow-lg">
             {/* Header */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
                <div>
                    <h2 className="text-2xl font-bold text-cyan-400">Global Inventory History & Audit Log</h2>
                    <p className="text-xs text-cool-gray-400 mt-0.5">
                        Total Recorded Actions: <span className="text-cool-gray-200 font-semibold">{state.history?.length || 0}</span> entries
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button 
                        onClick={() => setShowPurgeModal(true)} 
                        className="px-3.5 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-200 font-medium text-xs sm:text-sm rounded-lg border border-cool-gray-600 shadow-xs transition flex items-center gap-1.5"
                        title="Purge older logs to maintain clean performance"
                    >
                        <span>🧹</span>
                        <span>Purge / Maintenance</span>
                    </button>
                    <button 
                        onClick={handleUndo} 
                        disabled={!canUndo}
                        className="px-4 py-2 bg-yellow-600 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-md hover:bg-yellow-700 transition disabled:bg-cool-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
                        title={canUndo ? "Undo the last recorded action" : "No action to undo"}
                    >
                        Undo Last Action
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

            {/* Purge / Maintenance Modal */}
            {showPurgeModal && (
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
                                <p className="text-xs text-cool-gray-300 leading-relaxed mb-4">
                                    Keeping historical audit logs clean helps optimize application load times and backup archive sizes. Choose a retention policy below:
                                </p>

                                <div className="space-y-2.5 mb-6">
                                    {[
                                        { id: '30days', label: 'Purge entries older than 30 days', desc: 'Keep recent month of audit history' },
                                        { id: '60days', label: 'Purge entries older than 60 days', desc: 'Keep recent 2 months of audit history' },
                                        { id: '90days', label: 'Purge entries older than 90 days', desc: 'Keep recent quarter of audit history' },
                                        { id: 'keep100', label: 'Retain only top 100 most recent entries', desc: 'Fastest size optimization' },
                                        { id: 'keep250', label: 'Retain only top 250 most recent entries', desc: 'Balanced long-term retention' },
                                        { id: 'clearAll', label: 'Clear ALL audit history logs', desc: 'Wipe all historical entries entirely' }
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
                                <div className="p-3 bg-cool-gray-900/80 rounded-lg border border-cool-gray-750 text-xs flex justify-between items-center mb-6">
                                    <div>
                                        <span className="text-cool-gray-400">Entries to be purged:</span>
                                        <span className="ml-1.5 font-bold text-red-400">{purgeEstimation.purgeCount}</span>
                                    </div>
                                    <div>
                                        <span className="text-cool-gray-400">Remaining entries:</span>
                                        <span className="ml-1.5 font-bold text-emerald-400">{purgeEstimation.remainCount}</span>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2.5">
                                    <button 
                                        onClick={() => setShowPurgeModal(false)}
                                        className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-cool-gray-200 text-xs font-semibold rounded-lg transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => setShowPurgeConfirm(true)}
                                        disabled={purgeEstimation.purgeCount === 0 && purgeMode !== 'clearAll'}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-cool-gray-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                                    >
                                        Review & Purge
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-200">
                                    <p className="font-bold text-red-300 mb-1">⚠️ Confirm History Purge</p>
                                    <p>
                                        You are about to permanently purge <strong className="text-white">{purgeEstimation.purgeCount}</strong> audit entries. This operation cannot be undone.
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
                {/* Search + Quick Time Period */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Text Search */}
                    <div className="relative md:col-span-2">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                            <SearchIcon className="h-4 w-4 text-cool-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search description, item, location, user..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full rounded-lg border-0 bg-cool-gray-800 py-2 pl-9 pr-3 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-700 placeholder:text-cool-gray-400 focus:ring-2 focus:ring-cyan-500 text-xs sm:text-sm"
                        />
                    </div>

                    {/* Timeframe Dropdown */}
                    <div>
                        <select
                            value={dateRangeOption}
                            onChange={(e) => setDateRangeOption(e.target.value as DateRangeOption)}
                            className="block w-full rounded-lg border-0 bg-cool-gray-800 py-2 px-3 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-700 focus:ring-2 focus:ring-cyan-500 text-xs sm:text-sm"
                        >
                            <option value="all">📅 Time Period: All Time</option>
                            <option value="today">📅 Today</option>
                            <option value="7days">📅 Last 7 Days</option>
                            <option value="30days">📅 Last 30 Days</option>
                            <option value="90days">📅 Last 90 Days</option>
                            <option value="custom">📅 Custom Date Range...</option>
                        </select>
                    </div>
                </div>

                {/* Custom Date Pickers (if Custom Selected) */}
                {dateRangeOption === 'custom' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-fade-in">
                        <div>
                            <label className="block text-[11px] font-semibold text-cool-gray-400 mb-1">Start Date</label>
                            <input 
                                type="date" 
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-lg px-3 py-1.5 text-xs text-cool-gray-100 focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-cool-gray-400 mb-1">End Date</label>
                            <input 
                                type="date" 
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-lg px-3 py-1.5 text-xs text-cool-gray-100 focus:ring-2 focus:ring-cyan-500"
                            />
                        </div>
                    </div>
                )}

                {/* Entity Searchable Checkbox Dropdowns: Freezer, Container, Product, User */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                    {/* Freezer Searchable Checkbox Filter */}
                    <SearchableCheckboxDropdown
                        label="Freezers"
                        singularLabel="Freezer"
                        icon="❄️"
                        options={freezerOptions}
                        selectedIds={selectedFreezerIds}
                        onChange={setSelectedFreezerIds}
                        placeholder="Search freezers..."
                    />

                    {/* Container Searchable Checkbox Filter */}
                    <SearchableCheckboxDropdown
                        label="Containers"
                        singularLabel="Container"
                        icon="📦"
                        options={containerOptions}
                        selectedIds={selectedContainerIds}
                        onChange={setSelectedContainerIds}
                        placeholder="Search containers..."
                    />

                    {/* Product Searchable Checkbox Filter */}
                    <SearchableCheckboxDropdown
                        label="Products"
                        singularLabel="Product"
                        icon="🥩"
                        options={productOptions}
                        selectedIds={selectedProductIds}
                        onChange={setSelectedProductIds}
                        placeholder="Search products..."
                    />

                    {/* User Searchable Checkbox Filter */}
                    <SearchableCheckboxDropdown
                        label="Users"
                        singularLabel="User"
                        icon="👤"
                        options={uniqueUsers}
                        selectedIds={selectedUsers}
                        onChange={setSelectedUsers}
                        placeholder="Search users..."
                    />
                </div>

                {/* Filter Summary & Clear Action */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cool-gray-800 text-xs">
                    <div className="text-cool-gray-400 flex items-center gap-1.5 flex-wrap">
                        <span>Showing <strong className="text-cyan-300">{filteredHistory.length}</strong> of <strong className="text-cool-gray-200">{state.history?.length || 0}</strong> log entries</span>
                        {hasActiveFilters && (
                            <span className="text-[11px] text-cyan-400/80 font-medium">
                                (Active filters: {[
                                    searchTerm && 'Search',
                                    dateRangeOption !== 'all' && 'Date Range',
                                    selectedFreezerIds.size > 0 && `${selectedFreezerIds.size} Freezer(s)`,
                                    selectedContainerIds.size > 0 && `${selectedContainerIds.size} Container(s)`,
                                    selectedProductIds.size > 0 && `${selectedProductIds.size} Product(s)`,
                                    selectedUsers.size > 0 && `${selectedUsers.size} User(s)`
                                ].filter(Boolean).join(', ')})
                            </span>
                        )}
                    </div>

                    {hasActiveFilters && (
                        <button 
                            onClick={handleClearFilters}
                            className="text-cyan-400 hover:text-cyan-300 font-semibold text-xs transition flex items-center gap-1"
                        >
                            <span>✕</span>
                            <span>Clear All Filters</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Log Entry List */}
            <div className="max-h-[60vh] overflow-y-auto pr-2">
                {filteredHistory.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-cool-gray-800/40 rounded-xl border border-dashed border-cool-gray-700">
                        <p className="text-cool-gray-400 text-sm font-medium">No historical log entries match your filter criteria.</p>
                        {hasActiveFilters && (
                            <button 
                                onClick={handleClearFilters}
                                className="mt-3 px-3 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-600 text-cyan-300 text-xs font-semibold rounded-lg transition"
                            >
                                Reset Search Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {filteredHistory.map(entry => (
                            <li key={entry.id} className="text-sm p-3.5 bg-cool-gray-800 rounded-lg border border-cool-gray-700 hover:border-cool-gray-600 transition shadow-2xs">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                    <p className="text-cool-gray-100 font-medium leading-relaxed">{entry.description}</p>
                                    {entry.locInfo && (
                                        <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold bg-cyan-950/80 border border-cyan-800/70 text-cyan-300 px-2.5 py-0.5 rounded-full self-start sm:self-auto" title={entry.locInfo.detail}>
                                            <span className="text-[10px]">📍</span>
                                            <span>{entry.locInfo.label}</span>
                                        </span>
                                    )}
                                </div>
                                <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-cool-gray-750 text-xs">
                                    <p className="text-cool-gray-400 font-mono text-[11px] flex items-center gap-1">
                                        <span>👤</span>
                                        <span>{formatUserDisplay(entry.user)}</span>
                                    </p>
                                    <p className="text-cool-gray-400 font-mono text-[11px]">
                                        {new Date(entry.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default HistoryView;
