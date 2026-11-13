import React, { useMemo, useState } from 'react';
import {
  Action,
  InventoryState,
  VoiceDictionaryEntry,
  VoiceDictionaryTargetType,
} from '../types';
import {
  BookOpen,
  Box,
  Edit2,
  Package,
  Plus,
  Search,
  Snowflake,
  Sparkles,
  Trash2,
  X,
  AlertTriangle,
  Check,
  Terminal,
} from 'lucide-react';

interface VoiceDictionaryManagerProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
}

const COMMAND_PRESETS: Array<{ label: string; value: string; hint: string }> = [
  { label: 'Remove / Sell', value: 'remove', hint: 'Deducts items from on-site stock' },
  { label: 'Add / Inbound', value: 'add', hint: 'Adds items to an existing container/freezer' },
  { label: 'Move / Transfer', value: 'move', hint: 'Transfers stock between on-site locations' },
  { label: 'Empty Container', value: 'empty container', hint: 'Empties all items from a container to Staging' },
  { label: 'Move All Contents', value: 'move all of', hint: 'Moves all contents of one container into another' },
  { label: 'Combine Containers', value: 'combine containers', hint: 'Merges two or more containers into one' },
  { label: 'Move Whole Container', value: 'move container', hint: 'Relocates an entire container to another freezer' },
  { label: 'New Container + Items', value: 'add container', hint: 'Creates a new container and adds items' },
  { label: 'Container from Template', value: 'add container from template', hint: 'Creates from a container template' },
  { label: 'Stock Check / Query', value: 'how many', hint: 'Checks current on-site stock count' },
  { label: 'Inspect Container', value: "what's in", hint: 'Lists all items inside a container or freezer' },
  { label: 'Where Is Container', value: 'where is container', hint: 'Finds which freezer a named container is located in' },
  { label: 'List Freezer Containers', value: 'what containers are in', hint: 'Lists all containers currently stored in a freezer' },
];

const TARGET_TYPE_META: Record<
  VoiceDictionaryTargetType,
  { label: string; badgeClass: string; shortLabel: string }
> = {
  product: {
    label: 'Product',
    shortLabel: 'Product',
    badgeClass: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40',
  },
  container: {
    label: 'Container / Bin',
    shortLabel: 'Container',
    badgeClass: 'bg-amber-950/60 text-amber-300 border-amber-500/40',
  },
  freezer: {
    label: 'Freezer',
    shortLabel: 'Freezer',
    badgeClass: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40',
  },
  command: {
    label: 'Command Action',
    shortLabel: 'Command',
    badgeClass: 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40',
  },
  phrase: {
    label: 'Phrase / Word',
    shortLabel: 'Phrase',
    badgeClass: 'bg-purple-950/60 text-purple-300 border-purple-500/40',
  },
};

export const VoiceDictionaryManager: React.FC<VoiceDictionaryManagerProps> = ({
  state,
  dispatch,
}) => {
  const [spokenPhrase, setSpokenPhrase] = useState('');
  const [targetType, setTargetType] = useState<VoiceDictionaryTargetType>('product');
  const [targetId, setTargetId] = useState('');
  const [replacementText, setReplacementText] = useState('');
  const [notes, setNotes] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const [listSearch, setListSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | VoiceDictionaryTargetType>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  const activeProducts = useMemo(
    () =>
      (state.products || [])
        .filter(p => !p.isArchived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.products]
  );

  const freezerMap = useMemo(
    () => new Map((state.freezers || []).map(f => [f.id, f])),
    [state.freezers]
  );

  const activeContainers = useMemo(
    () =>
      (state.containers || [])
        .filter(c => !c.isArchived)
        .map(c => {
          const freezer = c.freezerId ? freezerMap.get(c.freezerId) : undefined;
          const freezerName = freezer ? freezer.name : 'Staging Area';
          const isLoose = c.id === 'staging_loose' || c.id.endsWith('_loose');
          const displayLabel = isLoose ? `${freezerName} (Loose)` : `${c.name} (${freezerName})`;
          return { container: c, freezerName, isLoose, displayLabel };
        })
        .sort((a, b) => a.displayLabel.localeCompare(b.displayLabel)),
    [state.containers, freezerMap]
  );

  const activeFreezers = useMemo(
    () =>
      (state.freezers || [])
        .filter(f => !f.isPallet && !f.id.startsWith('pallet-'))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.freezers]
  );

  const productMap = useMemo(
    () => new Map((state.products || []).map(p => [p.id, p])),
    [state.products]
  );
  const containerMap = useMemo(
    () => new Map((state.containers || []).map(c => [c.id, c])),
    [state.containers]
  );

  const filteredTargetOptions = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (targetType === 'product') {
      return activeProducts
        .filter(
          p =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            p.primaryCategory.toLowerCase().includes(q) ||
            p.subCategory.toLowerCase().includes(q)
        )
        .map(p => ({
          id: p.id,
          label: p.name,
          subLabel: `${p.primaryCategory} / ${p.subCategory}`,
        }));
    }
    if (targetType === 'container') {
      return activeContainers
        .filter(
          item =>
            !q ||
            item.displayLabel.toLowerCase().includes(q) ||
            item.container.name.toLowerCase().includes(q) ||
            item.freezerName.toLowerCase().includes(q)
        )
        .map(item => ({
          id: item.container.id,
          label: item.displayLabel,
          subLabel: item.isLoose ? 'Loose freezer bin' : `In ${item.freezerName}`,
        }));
    }
    if (targetType === 'freezer') {
      return activeFreezers
        .filter(f => !q || f.name.toLowerCase().includes(q))
        .map(f => ({
          id: f.id,
          label: f.name,
          subLabel: f.isSpecial ? 'Display / Special Freezer' : 'Storage Freezer',
        }));
    }
    return [];
  }, [targetType, targetSearch, activeProducts, activeContainers, activeFreezers]);

  const entries = useMemo(() => {
    const raw = state.voiceDictionary || [];
    return [...raw].sort((a, b) => a.spokenPhrase.localeCompare(b.spokenPhrase));
  }, [state.voiceDictionary]);

  const resolveEntryTarget = (entry: VoiceDictionaryEntry): { label: string; missing: boolean } => {
    if (entry.targetType === 'phrase' || entry.targetType === 'command') {
      return { label: entry.replacementText || '(empty rewrite)', missing: !entry.replacementText };
    }
    if (entry.targetType === 'product') {
      const p = entry.targetId ? productMap.get(entry.targetId) : undefined;
      if (!p) return { label: 'Deleted Product', missing: true };
      return {
        label: p.isArchived ? `${p.name} (Archived)` : p.name,
        missing: Boolean(p.isArchived),
      };
    }
    if (entry.targetType === 'container') {
      const c = entry.targetId ? containerMap.get(entry.targetId) : undefined;
      if (!c) return { label: 'Deleted Container', missing: true };
      const f = c.freezerId ? freezerMap.get(c.freezerId) : undefined;
      const loc = c.id.endsWith('_loose') ? `${f?.name || 'Staging Area'} (Loose)` : `${c.name} (${f?.name || 'Staging Area'})`;
      return {
        label: c.isArchived ? `${loc} (Archived)` : loc,
        missing: Boolean(c.isArchived),
      };
    }
    if (entry.targetType === 'freezer') {
      const f = entry.targetId ? freezerMap.get(entry.targetId) : undefined;
      if (!f) return { label: 'Deleted Freezer', missing: true };
      return { label: f.name, missing: false };
    }
    return { label: 'Unknown', missing: true };
  };

  const filteredEntries = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    return entries.filter(entry => {
      if (typeFilter !== 'all' && entry.targetType !== typeFilter) return false;
      if (!q) return true;
      const targetInfo = resolveEntryTarget(entry);
      return (
        entry.spokenPhrase.toLowerCase().includes(q) ||
        targetInfo.label.toLowerCase().includes(q) ||
        (entry.notes || '').toLowerCase().includes(q)
      );
    });
  }, [entries, typeFilter, listSearch, productMap, containerMap, freezerMap]);

  const handleResetForm = () => {
    setEditingId(null);
    setSpokenPhrase('');
    setTargetId('');
    setReplacementText('');
    setNotes('');
    setTargetSearch('');
    setFormError(null);
  };

  const handleStartEdit = (entry: VoiceDictionaryEntry) => {
    setEditingId(entry.id);
    setSpokenPhrase(entry.spokenPhrase);
    setTargetType(entry.targetType);
    setTargetId(entry.targetId || '');
    setReplacementText(entry.replacementText || '');
    setNotes(entry.notes || '');
    setTargetSearch('');
    setFormError(null);
    setFormNotice(null);
  };

  const duplicateConflict = useMemo(() => {
    const norm = spokenPhrase.trim().toLowerCase();
    if (!norm) return null;
    const isRewriteType = targetType === 'phrase' || targetType === 'command';
    const sameSpoken = entries.filter(
      e => e.id !== editingId && e.spokenPhrase.trim().toLowerCase() === norm
    );
    if (sameSpoken.length === 0) return null;
    const exactDup = sameSpoken.find(
      e =>
        e.targetType === targetType &&
        (isRewriteType
          ? (e.replacementText || '').trim().toLowerCase() === replacementText.trim().toLowerCase()
          : e.targetId === targetId)
    );
    return { sameSpoken, exactDup };
  }, [spokenPhrase, targetType, targetId, replacementText, entries, editingId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormNotice(null);

    const cleanPhrase = spokenPhrase.trim();
    if (!cleanPhrase) {
      setFormError('Enter the spoken word or phrase you want Voice Control to recognize.');
      return;
    }

    const isRewriteType = targetType === 'phrase' || targetType === 'command';
    if (isRewriteType) {
      if (!replacementText.trim()) {
        setFormError(
          targetType === 'command'
            ? 'Choose a built-in command preset or enter the command rewrite text.'
            : 'Enter the replacement phrase or word that it should rewrite to.'
        );
        return;
      }
      if (replacementText.trim().toLowerCase() === cleanPhrase.toLowerCase()) {
        setFormError('Replacement text cannot be identical to the spoken word or phrase.');
        return;
      }
    } else if (!targetId) {
      setFormError(`Select a ${TARGET_TYPE_META[targetType].shortLabel.toLowerCase()} to map to.`);
      return;
    }

    if (duplicateConflict?.exactDup) {
      setFormError(`A rule mapping "${cleanPhrase}" to that target already exists.`);
      return;
    }

    if (editingId) {
      dispatch({
        type: 'EDIT_VOICE_DICTIONARY_ENTRY',
        payload: {
          id: editingId,
          updates: {
            spokenPhrase: cleanPhrase,
            targetType,
            targetId: isRewriteType ? undefined : targetId,
            replacementText: isRewriteType ? replacementText.trim() : undefined,
            notes: notes.trim(),
          },
        },
      });
      setFormNotice(`Updated rule for "${cleanPhrase}".`);
      handleResetForm();
    } else {
      const id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `vd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      dispatch({
        type: 'ADD_VOICE_DICTIONARY_ENTRY',
        payload: {
          entry: {
            id,
            spokenPhrase: cleanPhrase,
            targetType,
            targetId: isRewriteType ? undefined : targetId,
            replacementText: isRewriteType ? replacementText.trim() : undefined,
            notes: notes.trim(),
            createdAt: new Date().toISOString(),
          },
        },
      });
      setFormNotice(`Added rule for "${cleanPhrase}".`);
      handleResetForm();
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Add / Edit Rule Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-cool-gray-850 rounded-xl border border-cool-gray-750 p-4 sm:p-5 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-cool-gray-800">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              {editingId ? 'Edit Voice Dictionary Rule' : 'Add Custom Voice Word / Alias'}
            </h4>
            <p className="text-xs text-cool-gray-400 mt-0.5">
              Teach local Voice Control custom spoken words, nicknames, or shorthands for your on-site products, containers, freezers, or phrases.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="self-start px-2.5 py-1 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-xs font-semibold text-cool-gray-300 border border-cool-gray-700 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        {/* Spoken Word / Phrase Input */}
        <div className="space-y-1.5">
          <label
            htmlFor="vd-spoken-phrase"
            className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300"
          >
            Spoken Word or Phrase
          </label>
          <input
            id="vd-spoken-phrase"
            type="text"
            value={spokenPhrase}
            onChange={e => {
              setSpokenPhrase(e.target.value);
              setFormError(null);
            }}
            placeholder='e.g. "rampler", "big orange", "chkn", "pull"'
            className="w-full rounded-lg bg-cool-gray-900 border border-cool-gray-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 px-3 py-2 text-sm text-white placeholder:text-cool-gray-500"
          />
        </div>

        {/* Match Type Selector */}
        <div className="space-y-1.5">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300">
            Matches To
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {(
              [
                { type: 'product' as VoiceDictionaryTargetType, label: 'Product', icon: Package },
                { type: 'container' as VoiceDictionaryTargetType, label: 'Container', icon: Box },
                { type: 'freezer' as VoiceDictionaryTargetType, label: 'Freezer', icon: Snowflake },
                { type: 'command' as VoiceDictionaryTargetType, label: 'Command', icon: Terminal },
                { type: 'phrase' as VoiceDictionaryTargetType, label: 'Phrase / Word', icon: Sparkles },
              ] as const
            ).map(item => {
              const Icon = item.icon;
              const active = targetType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => {
                    if (targetType !== item.type) {
                      setTargetType(item.type);
                      setTargetId('');
                      setReplacementText('');
                      setTargetSearch('');
                      setFormError(null);
                    }
                  }}
                  className={`px-3 py-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    active
                      ? 'bg-cyan-600 text-white border-cyan-500 shadow-xs'
                      : 'bg-cool-gray-900 text-cool-gray-300 border-cool-gray-750 hover:bg-cool-gray-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Target Picker */}
        {targetType === 'command' ? (
          <div className="space-y-2.5">
            <div className="space-y-1.5">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300">
                Built-In Command Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMAND_PRESETS.map(preset => {
                  const isActive =
                    replacementText.trim().toLowerCase() === preset.value.toLowerCase();
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => {
                        setReplacementText(preset.value);
                        setFormError(null);
                      }}
                      title={preset.hint}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-400'
                          : 'bg-cool-gray-900 text-cool-gray-200 border-cool-gray-750 hover:bg-cool-gray-800 hover:border-indigo-500/50'
                      }`}
                    >
                      {preset.label}{' '}
                      <span className="text-[10px] opacity-75">({preset.value})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="vd-replacement-text"
                className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300"
              >
                Rewrites Spoken Command To
              </label>
              <input
                id="vd-replacement-text"
                type="text"
                value={replacementText}
                onChange={e => {
                  setReplacementText(e.target.value);
                  setFormError(null);
                }}
                placeholder='e.g. "remove", "add container", "remove from display", or "how many"'
                className="w-full rounded-lg bg-cool-gray-900 border border-cool-gray-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 px-3 py-2 text-sm text-white placeholder:text-cool-gray-500"
              />
              <p className="text-[11px] text-cool-gray-400">
                Pick a preset above or write a full command shortcut (e.g. "market pull" → "remove from display", "pack new bag" → "add container"). Works with both single-line commands and bulleted lists.
              </p>
            </div>
          </div>
        ) : targetType === 'phrase' ? (
          <div className="space-y-1.5">
            <label
              htmlFor="vd-replacement-text"
              className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300"
            >
              Rewrites Spoken Text To
            </label>
            <input
              id="vd-replacement-text"
              type="text"
              value={replacementText}
              onChange={e => {
                setReplacementText(e.target.value);
                setFormError(null);
              }}
              placeholder='e.g. "Display Case", "Pork Liver", or "remove"'
              className="w-full rounded-lg bg-cool-gray-900 border border-cool-gray-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 px-3 py-2 text-sm text-white placeholder:text-cool-gray-500"
            />
            <p className="text-[11px] text-cool-gray-400">
              Applies before command parsing, so speech-to-text quirks or shorthand words normalize cleanly.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="vd-target-select"
                className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300"
              >
                Target {TARGET_TYPE_META[targetType].label}
              </label>
              <span className="text-[11px] text-cool-gray-400">
                {filteredTargetOptions.length} option{filteredTargetOptions.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-cool-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={targetSearch}
                onChange={e => setTargetSearch(e.target.value)}
                placeholder={`Filter ${TARGET_TYPE_META[targetType].shortLabel.toLowerCase()}s...`}
                className="w-full rounded-lg bg-cool-gray-900 border border-cool-gray-750 focus:border-cyan-500 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-cool-gray-500"
              />
            </div>

            <select
              id="vd-target-select"
              value={targetId}
              onChange={e => {
                setTargetId(e.target.value);
                setFormError(null);
              }}
              className="w-full rounded-lg bg-cool-gray-900 border border-cool-gray-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 px-3 py-2 text-sm text-white"
            >
              <option value="">
                -- Select {TARGET_TYPE_META[targetType].label} --
              </option>
              {filteredTargetOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} {opt.subLabel ? `(${opt.subLabel})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Optional Notes */}
        <div className="space-y-1">
          <label
            htmlFor="vd-notes"
            className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-400"
          >
            Notes (Optional)
          </label>
          <input
            id="vd-notes"
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Optional context (e.g. Gboard voice typo, store shorthand)"
            className="w-full rounded-lg bg-cool-gray-900 border border-cool-gray-750 focus:border-cyan-500 px-3 py-1.5 text-xs text-cool-gray-200 placeholder:text-cool-gray-500"
          />
        </div>

        {/* Conflict / Error / Notice Banners */}
        {duplicateConflict && !duplicateConflict.exactDup && (
          <div className="px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              "{spokenPhrase.trim()}" is already mapped to another target. Voice Control will show all matching options and ask you to pick one when used.
            </span>
          </div>
        )}

        {formError && (
          <div className="px-3 py-2 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {formNotice && (
          <div className="px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{formNotice}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold shadow-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{editingId ? 'Save Changes' : 'Add Dictionary Rule'}</span>
          </button>
        </div>
      </form>

      {/* Saved Rules List */}
      <div className="bg-cool-gray-850 rounded-xl border border-cool-gray-750 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">
              Saved Dictionary Rules
            </h4>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-cool-gray-900 border border-cool-gray-700 text-cyan-300">
              {entries.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:flex-initial min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-cool-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="Search rules..."
                className="w-full rounded-lg bg-cool-gray-900 border border-cool-gray-750 focus:border-cyan-500 pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-cool-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Type Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'product', label: 'Products' },
              { id: 'container', label: 'Containers' },
              { id: 'freezer', label: 'Freezers' },
              { id: 'command', label: 'Commands' },
              { id: 'phrase', label: 'Phrases' },
            ] as const
          ).map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setTypeFilter(f.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                typeFilter === f.id
                  ? 'bg-cyan-600 text-white'
                  : 'bg-cool-gray-900 text-cool-gray-400 hover:text-cool-gray-200 border border-cool-gray-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="rounded-lg bg-cool-gray-900/70 border border-cool-gray-800 p-6 text-center space-y-1">
            <p className="text-xs sm:text-sm font-semibold text-cool-gray-300">
              {entries.length === 0
                ? 'No custom voice dictionary rules yet.'
                : 'No rules match your current search or filter.'}
            </p>
            <p className="text-xs text-cool-gray-500">
              {entries.length === 0
                ? 'Add spoken aliases above (e.g. "chkn" -> Chicken Breast, or "front" -> Display Case).'
                : 'Clear your search filter to view all saved rules.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-cool-gray-800 border border-cool-gray-800 rounded-xl overflow-hidden bg-cool-gray-900/60">
            {filteredEntries.map(entry => {
              const meta = TARGET_TYPE_META[entry.targetType] || TARGET_TYPE_META.phrase;
              const target = resolveEntryTarget(entry);
              const isConfirmingDelete = confirmDeleteId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-cool-gray-900 transition"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-white bg-cool-gray-950 px-2 py-0.5 rounded border border-cool-gray-800">
                        "{entry.spokenPhrase}"
                      </span>
                      <span className="text-xs text-cool-gray-500 font-bold">→</span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${meta.badgeClass}`}
                      >
                        {meta.shortLabel}
                      </span>
                      <span
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          target.missing ? 'text-amber-300' : 'text-cool-gray-100'
                        }`}
                      >
                        {target.label}
                      </span>
                      {target.missing && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300">
                          Inactive / Missing
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="text-[11px] text-cool-gray-400 pl-0.5">{entry.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                    {isConfirmingDelete ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            dispatch({
                              type: 'DELETE_VOICE_DICTIONARY_ENTRY',
                              payload: { id: entry.id },
                            });
                            setConfirmDeleteId(null);
                            if (editingId === entry.id) handleResetForm();
                          }}
                          className="px-2.5 py-1 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-bold cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2.5 py-1 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(entry)}
                          className="p-1.5 rounded-md text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 transition cursor-pointer"
                          title="Edit rule"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(entry.id)}
                          className="p-1.5 rounded-md text-cool-gray-400 hover:text-red-400 hover:bg-cool-gray-800 transition cursor-pointer"
                          title="Delete rule"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
