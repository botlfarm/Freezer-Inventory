import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Layers,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Action, InventoryState, SpeciesPrimal } from '../types';
import {
  buildSpeciesPrimalIndex,
  generateSpeciesPrimalId,
} from '../utils/speciesPrimals';

interface SpeciesPrimalsManagerProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
}

type FilterMode = 'all' | 'with_primals' | 'empty';

export const SpeciesPrimalsManager: React.FC<SpeciesPrimalsManagerProps> = ({
  state,
  dispatch,
}) => {
  const speciesPrimals = state.speciesPrimals || [];
  const products = state.products || [];
  const butcherOrders = state.butcherOrders || [];

  const index = useMemo(() => buildSpeciesPrimalIndex(speciesPrimals), [speciesPrimals]);

  // Usage counts
  const { productCountByPrimalId, productCountBySpeciesId, orderCountBySpeciesId } = useMemo(() => {
    const pByPrimal = new Map<string, number>();
    const pBySpecies = new Map<string, number>();
    const oBySpecies = new Map<string, number>();

    for (const p of products) {
      if (!p.primalId) continue;
      const primal = index.primalById.get(p.primalId);
      if (!primal) continue;
      pByPrimal.set(primal.id, (pByPrimal.get(primal.id) || 0) + 1);
      if (primal.parentSpeciesId) {
        pBySpecies.set(primal.parentSpeciesId, (pBySpecies.get(primal.parentSpeciesId) || 0) + 1);
      }
    }

    for (const order of butcherOrders) {
      const matched =
        (order.speciesId ? index.speciesById.get(order.speciesId) : undefined) ||
        (order.species ? index.speciesByNameLower.get(order.species.trim().toLowerCase()) : undefined);
      if (matched) {
        oBySpecies.set(matched.id, (oBySpecies.get(matched.id) || 0) + 1);
      }
    }

    return {
      productCountByPrimalId: pByPrimal,
      productCountBySpeciesId: pBySpecies,
      orderCountBySpeciesId: oBySpecies,
    };
  }, [products, butcherOrders, index]);

  const totalLinkedProducts = useMemo(() => {
    let total = 0;
    productCountByPrimalId.forEach((n) => {
      total += n;
    });
    return total;
  }, [productCountByPrimalId]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [expandedSpeciesIds, setExpandedSpeciesIds] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Species state
  const [newSpeciesName, setNewSpeciesName] = useState('');
  const [newSpeciesIcon, setNewSpeciesIcon] = useState('');

  // Inline Rename/Merge Species state
  const [renamingSpeciesId, setRenamingSpeciesId] = useState<string | null>(null);
  const [renameSpeciesTarget, setRenameSpeciesTarget] = useState('');
  const [editingSpeciesMetaId, setEditingSpeciesMetaId] = useState<string | null>(null);
  const [editSpeciesIcon, setEditSpeciesIcon] = useState('');
  const [editSpeciesDesc, setEditSpeciesDesc] = useState('');

  // Confirm delete species
  const [confirmDeleteSpeciesId, setConfirmDeleteSpeciesId] = useState<string | null>(null);

  // Add Primal per species
  const [newPrimalNameBySpecies, setNewPrimalNameBySpecies] = useState<Record<string, string>>({});
  const [newPrimalDescBySpecies, setNewPrimalDescBySpecies] = useState<Record<string, string>>({});

  // Edit Primal state
  const [editingPrimalId, setEditingPrimalId] = useState<string | null>(null);
  const [editPrimalName, setEditPrimalName] = useState('');
  const [editPrimalDesc, setEditPrimalDesc] = useState('');

  // Delete Primal state (with optional reassignment)
  const [confirmDeletePrimalId, setConfirmDeletePrimalId] = useState<string | null>(null);
  const [reassignTargetPrimalId, setReassignTargetPrimalId] = useState<string>('');

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
    if (type === 'success') {
      setTimeout(() => {
        setFeedback((prev) => (prev?.text === text ? null : prev));
      }, 4000);
    }
  };

  const isExpanded = (speciesId: string): boolean => {
    if (searchQuery.trim()) return true;
    if (expandedSpeciesIds[speciesId] !== undefined) return expandedSpeciesIds[speciesId];
    return true; // Default expanded for immediate scanability
  };

  const toggleExpanded = (speciesId: string) => {
    setExpandedSpeciesIds((prev) => ({
      ...prev,
      [speciesId]: !(prev[speciesId] ?? true),
    }));
  };

  const filteredSpecies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return index.speciesList.filter((sp) => {
      const primals = index.primalsBySpeciesId.get(sp.id) || [];
      if (filterMode === 'with_primals' && primals.length === 0) return false;
      if (filterMode === 'empty' && primals.length > 0) return false;
      if (!q) return true;
      if (sp.name.toLowerCase().includes(q)) return true;
      if ((sp.description || '').toLowerCase().includes(q)) return true;
      return primals.some(
        (pr) =>
          pr.name.toLowerCase().includes(q) ||
          (pr.description || '').toLowerCase().includes(q)
      );
    });
  }, [index, searchQuery, filterMode]);

  // =========================================================================
  // SPECIES HANDLERS
  // =========================================================================
  const handleAddSpecies = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSpeciesName.trim();
    if (!trimmed) {
      showFeedback('error', 'Enter a species name before adding.');
      return;
    }
    if (index.speciesByNameLower.has(trimmed.toLowerCase())) {
      showFeedback('error', `Species "${trimmed}" already exists.`);
      return;
    }
    const id = generateSpeciesPrimalId('species');
    dispatch({
      type: 'ADD_SPECIES_PRIMAL',
      payload: {
        entry: {
          id,
          name: trimmed,
          type: 'species',
          icon: newSpeciesIcon.trim() || undefined,
        },
      },
    });
    setNewSpeciesName('');
    setNewSpeciesIcon('');
    setExpandedSpeciesIds((prev) => ({ ...prev, [id]: true }));
    showFeedback('success', `Added species "${trimmed}". Add primal cuts below whenever you are ready.`);
  };

  const handleConfirmSpeciesRename = (species: SpeciesPrimal) => {
    const target = renameSpeciesTarget.trim();
    if (!target) {
      showFeedback('error', 'Species name cannot be empty.');
      return;
    }
    if (target === species.name) {
      setRenamingSpeciesId(null);
      setRenameSpeciesTarget('');
      return;
    }
    const existingTarget = index.speciesByNameLower.get(target.toLowerCase());
    const isMerge = !!existingTarget && existingTarget.id !== species.id;

    dispatch({
      type: 'RENAME_BUTCHER_SPECIES',
      payload: { oldName: species.name, newName: target },
    });

    setRenamingSpeciesId(null);
    setRenameSpeciesTarget('');
    showFeedback(
      'success',
      isMerge
        ? `Merged "${species.name}" into "${existingTarget.name}". Primals, product links, and butcher orders updated.`
        : `Renamed "${species.name}" to "${target}".`
    );
  };

  const handleSaveSpeciesMeta = (speciesId: string) => {
    dispatch({
      type: 'EDIT_SPECIES_PRIMAL',
      payload: {
        id: speciesId,
        updates: {
          icon: editSpeciesIcon.trim(),
          description: editSpeciesDesc.trim(),
        },
      },
    });
    setEditingSpeciesMetaId(null);
    showFeedback('success', 'Updated species details.');
  };

  const handleDeleteSpecies = (species: SpeciesPrimal) => {
    const orderCount = orderCountBySpeciesId.get(species.id) || 0;
    if (orderCount > 0) {
      showFeedback(
        'error',
        `"${species.name}" is used by ${orderCount} butcher order${orderCount === 1 ? '' : 's'}. Rename or merge it into another species instead.`
      );
      setConfirmDeleteSpeciesId(null);
      return;
    }
    dispatch({
      type: 'DELETE_SPECIES_PRIMAL',
      payload: { id: species.id },
    });
    setConfirmDeleteSpeciesId(null);
    showFeedback('success', `Deleted species "${species.name}".`);
  };

  const handleMoveSpecies = (speciesId: string, direction: -1 | 1) => {
    const list = index.speciesList;
    const idx = list.findIndex((s) => s.id === speciesId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const ordered = list.map((s) => s.id);
    [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
    dispatch({
      type: 'REORDER_SPECIES_PRIMALS',
      payload: { orderedIds: ordered },
    });
  };

  // =========================================================================
  // PRIMAL HANDLERS
  // =========================================================================
  const handleAddPrimal = (e: React.FormEvent, species: SpeciesPrimal) => {
    e.preventDefault();
    const name = (newPrimalNameBySpecies[species.id] || '').trim();
    const desc = (newPrimalDescBySpecies[species.id] || '').trim();
    if (!name) {
      showFeedback('error', 'Enter a primal cut name before adding.');
      return;
    }
    const existing = (index.primalsBySpeciesId.get(species.id) || []).some(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) {
      showFeedback('error', `"${name}" already exists under ${species.name}.`);
      return;
    }
    dispatch({
      type: 'ADD_SPECIES_PRIMAL',
      payload: {
        entry: {
          id: generateSpeciesPrimalId('primal'),
          name,
          type: 'primal',
          parentSpeciesId: species.id,
          description: desc || undefined,
        },
      },
    });
    setNewPrimalNameBySpecies((prev) => ({ ...prev, [species.id]: '' }));
    setNewPrimalDescBySpecies((prev) => ({ ...prev, [species.id]: '' }));
    showFeedback('success', `Added primal "${name}" under ${species.name}.`);
  };

  const handleSavePrimalEdit = (primal: SpeciesPrimal) => {
    const trimmed = editPrimalName.trim();
    if (!trimmed) {
      showFeedback('error', 'Primal name cannot be empty.');
      return;
    }
    const siblings = index.primalsBySpeciesId.get(primal.parentSpeciesId || '') || [];
    const dup = siblings.some(
      (p) => p.id !== primal.id && p.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (dup) {
      showFeedback('error', `Another primal named "${trimmed}" already exists under this species.`);
      return;
    }
    dispatch({
      type: 'EDIT_SPECIES_PRIMAL',
      payload: {
        id: primal.id,
        updates: {
          name: trimmed,
          description: editPrimalDesc.trim(),
        },
      },
    });
    setEditingPrimalId(null);
    showFeedback('success', `Updated primal "${trimmed}".`);
  };

  const handleDeletePrimal = (primal: SpeciesPrimal) => {
    dispatch({
      type: 'DELETE_SPECIES_PRIMAL',
      payload: {
        id: primal.id,
        reassignToPrimalId: reassignTargetPrimalId || null,
      },
    });
    setConfirmDeletePrimalId(null);
    setReassignTargetPrimalId('');
    showFeedback('success', `Deleted primal "${primal.name}".`);
  };

  const handleMovePrimal = (speciesId: string, primalId: string, direction: -1 | 1) => {
    const list = index.primalsBySpeciesId.get(speciesId) || [];
    const idx = list.findIndex((p) => p.id === primalId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const ordered = list.map((p) => p.id);
    [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
    dispatch({
      type: 'REORDER_SPECIES_PRIMALS',
      payload: { orderedIds: ordered, parentSpeciesId: speciesId },
    });
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="bg-cool-gray-850 rounded-lg border border-cool-gray-750 p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-cool-gray-800 pb-4">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
              Species &amp; Primal Cuts
            </h3>
            <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed max-w-2xl">
              Define animal species and break each one down into primal cuts (for example: Beef → Chuck, Rib, Loin, Round). Assign a primal cut to each product to enable primal filtering across inventory views and primal-level yield analytics in Butcher Records.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0 text-xs font-mono tabular-nums text-cool-gray-300 bg-cool-gray-900/70 border border-cool-gray-800 rounded-lg px-3.5 py-2">
            <div>
              <span className="text-white font-bold">{index.speciesList.length}</span>{' '}
              <span className="text-cool-gray-400">species</span>
            </div>
            <span className="text-cool-gray-700">·</span>
            <div>
              <span className="text-white font-bold">{index.primalList.length}</span>{' '}
              <span className="text-cool-gray-400">primals</span>
            </div>
            <span className="text-cool-gray-700">·</span>
            <div>
              <span className="text-cyan-400 font-bold">{totalLinkedProducts}</span>
              <span className="text-cool-gray-400">/{products.length} products</span>
            </div>
          </div>
        </div>

        {/* Feedback banner */}
        {feedback && (
          <div
            className={`mt-4 px-3.5 py-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/50 border-emerald-700/60 text-emerald-200'
                : 'bg-rose-950/50 border-rose-700/60 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-cool-gray-400 hover:text-white cursor-pointer"
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Add Species form */}
        <form onSubmit={handleAddSpecies} className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={newSpeciesIcon}
            onChange={(e) => setNewSpeciesIcon(e.target.value)}
            placeholder="Icon"
            maxLength={4}
            title="Optional emoji icon (e.g. 🐄, 🐖, 🐑)"
            className="w-full sm:w-20 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-2 text-center text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <input
            id="catalog-new-species-input"
            type="text"
            value={newSpeciesName}
            onChange={(e) => setNewSpeciesName(e.target.value)}
            placeholder="Add a species (e.g. Beef, Pork, Lamb, Poultry)"
            className="flex-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={!newSpeciesName.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Species
          </button>
        </form>

        {/* Search & Filter Row */}
        <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-cool-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search species or primal cuts..."
              className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg pl-9 pr-8 py-1.5 text-sm text-white placeholder-cool-gray-500 focus:outline-none focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-cool-gray-400 hover:text-white cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="inline-flex rounded-lg bg-cool-gray-900 border border-cool-gray-800 p-0.5 self-start">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'with_primals', label: 'With Primals' },
                { id: 'empty', label: 'No Primals Yet' },
              ] as { id: FilterMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilterMode(opt.id)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  filterMode === opt.id
                    ? 'bg-cool-gray-800 text-cyan-300'
                    : 'text-cool-gray-400 hover:text-cool-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Species & Nested Primals List */}
      {filteredSpecies.length === 0 ? (
        <div className="bg-cool-gray-850 rounded-lg border border-dashed border-cool-gray-750 p-8 text-center">
          <p className="text-sm font-semibold text-cool-gray-200">
            {index.speciesList.length === 0
              ? 'No species configured yet'
              : 'No species or primals match your filter'}
          </p>
          <p className="text-xs text-cool-gray-400 mt-1">
            {index.speciesList.length === 0
              ? 'Add your first species above (for example: Beef or Pork) to start organizing primal cuts.'
              : 'Try clearing the search query or switching the filter mode.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSpecies.map((species, sIdx) => {
            const primals = index.primalsBySpeciesId.get(species.id) || [];
            const q = searchQuery.trim().toLowerCase();
            const visiblePrimals = q && !species.name.toLowerCase().includes(q)
              ? primals.filter(
                  (p) =>
                    p.name.toLowerCase().includes(q) ||
                    (p.description || '').toLowerCase().includes(q)
                )
              : primals;

            const productCount = productCountBySpeciesId.get(species.id) || 0;
            const orderCount = orderCountBySpeciesId.get(species.id) || 0;
            const expanded = isExpanded(species.id);
            const isRenaming = renamingSpeciesId === species.id;
            const isEditingMeta = editingSpeciesMetaId === species.id;
            const isConfirmingDelete = confirmDeleteSpeciesId === species.id;

            const renameTrimmed = renameSpeciesTarget.trim();
            const mergeTarget =
              isRenaming &&
              renameTrimmed &&
              renameTrimmed.toLowerCase() !== species.name.toLowerCase()
                ? index.speciesByNameLower.get(renameTrimmed.toLowerCase())
                : undefined;

            return (
              <div
                key={species.id}
                className="bg-cool-gray-850 rounded-lg border border-cool-gray-750 overflow-hidden"
              >
                {/* Species Header Row */}
                <div className="px-4 py-3 bg-cool-gray-900/50 border-b border-cool-gray-800">
                  {isRenaming ? (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="text"
                          value={renameSpeciesTarget}
                          onChange={(e) => setRenameSpeciesTarget(e.target.value)}
                          placeholder="New species name..."
                          className="flex-1 bg-cool-gray-900 border border-cyan-500/60 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleConfirmSpeciesRename(species)}
                            disabled={!renameTrimmed}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {mergeTarget ? 'Merge Species' : 'Save Rename'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingSpeciesId(null);
                              setRenameSpeciesTarget('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      <p className={`text-[11px] ${mergeTarget ? 'text-amber-300' : 'text-cool-gray-400'}`}>
                        {mergeTarget
                          ? `Will merge "${species.name}" into existing "${mergeTarget.name}", re-parent ${primals.length} primal${primals.length === 1 ? '' : 's'}, remap ${productCount} product${productCount === 1 ? '' : 's'}, and update ${orderCount} butcher order${orderCount === 1 ? '' : 's'}.`
                          : `Will rename "${species.name}" across ${orderCount} butcher order${orderCount === 1 ? '' : 's'} while preserving all ${primals.length} primal link${primals.length === 1 ? '' : 's'}.`}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleExpanded(species.id)}
                          className="p-1 rounded text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 cursor-pointer transition"
                          aria-label={expanded ? `Collapse ${species.name}` : `Expand ${species.name}`}
                        >
                          {expanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {species.icon && <span className="text-base leading-none">{species.icon}</span>}
                            <span className="text-sm font-bold text-white truncate">{species.name}</span>
                            <span className="text-xs text-cool-gray-400 font-mono tabular-nums">
                              {primals.length} primal{primals.length === 1 ? '' : 's'} · {productCount} product{productCount === 1 ? '' : 's'} · {orderCount} order{orderCount === 1 ? '' : 's'}
                            </span>
                          </div>
                          {species.description && !isEditingMeta && (
                            <p className="text-xs text-cool-gray-400 mt-0.5 truncate">{species.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-auto">
                        {!searchQuery && filterMode === 'all' && (
                          <>
                            <button
                              type="button"
                              disabled={sIdx === 0}
                              onClick={() => handleMoveSpecies(species.id, -1)}
                              className="p-1.5 rounded text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 disabled:opacity-30 cursor-pointer transition"
                              title="Move species up"
                              aria-label={`Move ${species.name} up`}
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={sIdx === filteredSpecies.length - 1}
                              onClick={() => handleMoveSpecies(species.id, 1)}
                              className="p-1.5 rounded text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 disabled:opacity-30 cursor-pointer transition"
                              title="Move species down"
                              aria-label={`Move ${species.name} down`}
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSpeciesMetaId(isEditingMeta ? null : species.id);
                            setEditSpeciesIcon(species.icon || '');
                            setEditSpeciesDesc(species.description || '');
                            setRenamingSpeciesId(null);
                            setConfirmDeleteSpeciesId(null);
                          }}
                          className="px-2 py-1 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-300 text-xs font-semibold cursor-pointer transition"
                          title="Edit icon or description"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingSpeciesId(species.id);
                            setRenameSpeciesTarget(species.name);
                            setEditingSpeciesMetaId(null);
                            setConfirmDeleteSpeciesId(null);
                          }}
                          className="px-2.5 py-1 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer transition"
                        >
                          <Edit3 className="w-3 h-3 text-cyan-400" />
                          Rename / Merge
                        </button>
                        <button
                          type="button"
                          disabled={orderCount > 0}
                          onClick={() => {
                            setConfirmDeleteSpeciesId(isConfirmingDelete ? null : species.id);
                            setEditingSpeciesMetaId(null);
                            setRenamingSpeciesId(null);
                          }}
                          className="p-1.5 rounded-md text-cool-gray-400 hover:text-rose-400 hover:bg-cool-gray-800 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                          title={
                            orderCount > 0
                              ? `Used by ${orderCount} butcher order${orderCount === 1 ? '' : 's'} — rename or merge instead`
                              : `Delete ${species.name}`
                          }
                          aria-label={`Delete ${species.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Edit Species Icon / Description */}
                  {isEditingMeta && (
                    <div className="mt-3 pt-3 border-t border-cool-gray-800 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={editSpeciesIcon}
                        onChange={(e) => setEditSpeciesIcon(e.target.value)}
                        placeholder="Icon"
                        maxLength={4}
                        className="w-full sm:w-20 bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-center text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={editSpeciesDesc}
                        onChange={(e) => setEditSpeciesDesc(e.target.value)}
                        placeholder="Optional description or notes..."
                        className="flex-1 bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleSaveSpeciesMeta(species.id)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSpeciesMetaId(null)}
                          className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Delete Species Confirmation */}
                  {isConfirmingDelete && (
                    <div className="mt-3 pt-3 border-t border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="text-rose-200">
                        Delete <strong className="text-white">{species.name}</strong>
                        {primals.length > 0 && ` and its ${primals.length} primal cut${primals.length === 1 ? '' : 's'}`}
                        {productCount > 0 && ` (${productCount} product${productCount === 1 ? '' : 's'} will become unassigned)`}?
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteSpecies(species)}
                          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteSpeciesId(null)}
                          className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded Primals Body */}
                {expanded && (
                  <div className="p-4 space-y-3 bg-cool-gray-900/20">
                    {/* Nested Primals List */}
                    {visiblePrimals.length === 0 ? (
                      <div className="text-xs text-cool-gray-500 py-2 px-3 rounded-md border border-dashed border-cool-gray-800">
                        No primal cuts defined for {species.name} yet. Add one below.
                      </div>
                    ) : (
                      <div className="divide-y divide-cool-gray-800/80 border border-cool-gray-800 rounded-lg overflow-hidden">
                        {visiblePrimals.map((primal, pIdx) => {
                          const primalProdCount = productCountByPrimalId.get(primal.id) || 0;
                          const isEditingPrimal = editingPrimalId === primal.id;
                          const isConfirmingPrimalDelete = confirmDeletePrimalId === primal.id;
                          const otherPrimals = index.primalList.filter((p) => p.id !== primal.id);

                          return (
                            <div key={primal.id} className="px-3.5 py-2.5 bg-cool-gray-900/40">
                              {isEditingPrimal ? (
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <input
                                    type="text"
                                    value={editPrimalName}
                                    onChange={(e) => setEditPrimalName(e.target.value)}
                                    placeholder="Primal cut name"
                                    className="flex-1 bg-cool-gray-950 border border-cyan-500/60 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={editPrimalDesc}
                                    onChange={(e) => setEditPrimalDesc(e.target.value)}
                                    placeholder="Optional notes..."
                                    className="flex-1 bg-cool-gray-950 border border-cool-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                                  />
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleSavePrimalEdit(primal)}
                                      className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPrimalId(null)}
                                      className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-semibold cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <span className="text-sm font-medium text-cool-gray-100">
                                        {primal.name}
                                      </span>
                                      <span className="text-xs text-cool-gray-400 font-mono tabular-nums">
                                        {primalProdCount} product{primalProdCount === 1 ? '' : 's'}
                                      </span>
                                    </div>
                                    {primal.description && (
                                      <p className="text-xs text-cool-gray-500 mt-0.5 truncate">
                                        {primal.description}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {!searchQuery && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={pIdx === 0}
                                          onClick={() => handleMovePrimal(species.id, primal.id, -1)}
                                          className="p-1 rounded text-cool-gray-500 hover:text-white hover:bg-cool-gray-800 disabled:opacity-30 cursor-pointer transition"
                                          title="Move primal up"
                                          aria-label={`Move ${primal.name} up`}
                                        >
                                          <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={pIdx === visiblePrimals.length - 1}
                                          onClick={() => handleMovePrimal(species.id, primal.id, 1)}
                                          className="p-1 rounded text-cool-gray-500 hover:text-white hover:bg-cool-gray-800 disabled:opacity-30 cursor-pointer transition"
                                          title="Move primal down"
                                          aria-label={`Move ${primal.name} down`}
                                        >
                                          <ArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingPrimalId(primal.id);
                                        setEditPrimalName(primal.name);
                                        setEditPrimalDesc(primal.description || '');
                                        setConfirmDeletePrimalId(null);
                                      }}
                                      className="p-1.5 rounded text-cool-gray-400 hover:text-cyan-300 hover:bg-cool-gray-800 cursor-pointer transition"
                                      title={`Edit ${primal.name}`}
                                      aria-label={`Edit ${primal.name}`}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmDeletePrimalId(isConfirmingPrimalDelete ? null : primal.id);
                                        setReassignTargetPrimalId('');
                                        setEditingPrimalId(null);
                                      }}
                                      className="p-1.5 rounded text-cool-gray-400 hover:text-rose-400 hover:bg-cool-gray-800 cursor-pointer transition"
                                      title={`Delete ${primal.name}`}
                                      aria-label={`Delete ${primal.name}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Inline Delete Primal Confirmation & Optional Reassignment */}
                              {isConfirmingPrimalDelete && (
                                <div className="mt-2.5 pt-2.5 border-t border-rose-900/50 space-y-2 text-xs">
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <span className="text-rose-200">
                                      Delete primal <strong className="text-white">{primal.name}</strong>?
                                      {primalProdCount > 0 &&
                                        ` Currently linked to ${primalProdCount} product${primalProdCount === 1 ? '' : 's'}.`}
                                    </span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePrimal(primal)}
                                        className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                                      >
                                        Confirm Delete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setConfirmDeletePrimalId(null);
                                          setReassignTargetPrimalId('');
                                        }}
                                        className="px-2.5 py-1 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-semibold cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                  {primalProdCount > 0 && otherPrimals.length > 0 && (
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                      <label className="text-cool-gray-400 shrink-0">
                                        Linked products:
                                      </label>
                                      <select
                                        value={reassignTargetPrimalId}
                                        onChange={(e) => setReassignTargetPrimalId(e.target.value)}
                                        className="bg-cool-gray-950 border border-cool-gray-700 rounded-md px-2.5 py-1 text-xs text-cool-gray-100 focus:outline-none focus:border-cyan-500"
                                      >
                                        <option value="">Leave unassigned (clear primal)</option>
                                        {otherPrimals.map((other) => {
                                          const parentSp = other.parentSpeciesId
                                            ? index.speciesById.get(other.parentSpeciesId)
                                            : undefined;
                                          return (
                                            <option key={other.id} value={other.id}>
                                              Reassign to {parentSp ? `${parentSp.name} · ` : ''}{other.name}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Inline Add Primal Form */}
                    <form
                      onSubmit={(e) => handleAddPrimal(e, species)}
                      className="flex flex-col sm:flex-row gap-2 pt-1"
                    >
                      <input
                        type="text"
                        value={newPrimalNameBySpecies[species.id] || ''}
                        onChange={(e) =>
                          setNewPrimalNameBySpecies((prev) => ({
                            ...prev,
                            [species.id]: e.target.value,
                          }))
                        }
                        placeholder={`Add primal cut to ${species.name} (e.g. Rib, Loin, Shoulder)`}
                        className="flex-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-1.5 text-sm text-white placeholder-cool-gray-500 focus:outline-none focus:border-cyan-500"
                      />
                      <input
                        type="text"
                        value={newPrimalDescBySpecies[species.id] || ''}
                        onChange={(e) =>
                          setNewPrimalDescBySpecies((prev) => ({
                            ...prev,
                            [species.id]: e.target.value,
                          }))
                        }
                        placeholder="Optional notes..."
                        className="sm:w-52 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-1.5 text-sm text-white placeholder-cool-gray-500 focus:outline-none focus:border-cyan-500"
                      />
                      <button
                        type="submit"
                        disabled={!(newPrimalNameBySpecies[species.id] || '').trim()}
                        className="px-3.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cyan-600 border border-cool-gray-700 hover:border-cyan-500 text-cool-gray-100 hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Primal
                      </button>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
