import React, { useMemo, useState, useEffect } from 'react';
import { getApiUrl } from '../hooks/apiUrl';
import { authFetch } from '../utils/clientDevice';
import { VOICE_PRIMARY_DISPLAY_CONFIG_KEY } from '../utils/voiceCommandParser';
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
  Mic,
  Layers,
  Minus,
} from 'lucide-react';

interface VoiceDictionaryManagerProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  onSaveAppConfigKey?: (key: string, value: string) => void;
}

const COMMAND_PRESETS: Array<{ label: string; value: string; hint: string }> = [
  { label: 'Remove / Sell', value: 'remove', hint: 'Deducts items from on-site stock' },
  { label: 'Add / Inbound', value: 'add', hint: 'Adds items to an existing container/freezer' },
  { label: 'Move / Transfer', value: 'move', hint: 'Transfers stock between on-site locations' },
  { label: 'Restock Display from Backstock', value: 'restock display with', hint: 'Auto-pulls items from backstock containers into Display' },
  { label: 'Adjust / Set Inventory', value: 'adjust inventory', hint: 'Sets item counts to an exact target quantity' },
  { label: 'Reduce Inventory', value: 'reduce inventory', hint: 'Reduces item stock to a target or by a delta' },
  { label: 'Increase Inventory', value: 'increase inventory', hint: 'Increases item stock to a target or by a delta' },
  { label: 'Change Inventory', value: 'change inventory', hint: 'Updates counts for one or multiple items' },
  { label: 'Add to Custom List', value: 'add to restock list', hint: 'Adds products (with optional threshold) to a custom list' },
  { label: 'Remove from Custom List', value: 'remove from restock list', hint: 'Removes products from a custom list' },
  { label: 'Set List Threshold', value: 'set threshold for', hint: 'Updates low-stock threshold for a custom list item' },
  { label: 'Empty Container', value: 'empty container', hint: 'Empties all items from a container to Staging' },
  { label: 'Move All Contents', value: 'move all of', hint: 'Moves all contents of one container into another' },
  { label: 'Combine Containers', value: 'combine containers', hint: 'Merges two or more containers into one' },
  { label: 'Move Whole Container', value: 'move container', hint: 'Relocates an entire container to another freezer' },
  { label: 'Swap Containers', value: 'swap', hint: 'Swaps two containers between their freezers' },
  { label: 'Rename Container', value: 'rename container', hint: 'Renames an existing container' },
  { label: 'Archive Container', value: 'archive container', hint: 'Archives a container (moving any items to Staging)' },
  { label: 'Delete Container', value: 'delete container', hint: 'Deletes a container (moving any items to Staging)' },
  { label: 'Tag Inventory Stack', value: 'tag', hint: 'Applies a tag to an active inventory stack' },
  { label: 'Correct Wrong Label', value: 'correct label on', hint: 'Fixes a mislabeled stack to the right product' },
  { label: 'New Container + Items', value: 'add container', hint: 'Creates a new container and adds items' },
  { label: 'Container from Template', value: 'add container from template', hint: 'Creates from a container template' },
  { label: 'Stock Check / Query', value: 'how many', hint: 'Checks current on-site product or category stock' },
  { label: 'Check Low / Out of Stock', value: "what's out of stock in display", hint: 'Checks missing or low-stock items and backstock' },
  { label: 'Inspect Container', value: "what's in", hint: 'Lists all items inside a container or freezer' },
  { label: 'Where Is Container', value: 'where is container', hint: 'Finds which freezer a named container is located in' },
  { label: 'List Freezer Containers', value: 'what containers are in', hint: 'Lists all containers currently stored in a freezer' },
  { label: 'Check Custom List', value: "what's on my restock list", hint: 'Reads items and thresholds on a custom list' },
  { label: 'Undo Last Command', value: 'undo last command', hint: 'Reverts the most recent inventory action' },
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
  bundle: {
    label: 'Product Pack (1-to-Many)',
    shortLabel: 'Pack',
    badgeClass: 'bg-fuchsia-950/60 text-fuchsia-300 border-fuchsia-500/40',
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
  onSaveAppConfigKey,
}) => {
  const [spokenPhrase, setSpokenPhrase] = useState('');
  const [targetType, setTargetType] = useState<VoiceDictionaryTargetType>('product');
  const [targetId, setTargetId] = useState('');
  const [bundleItems, setBundleItems] = useState<Array<{ productId: string; quantity: number }>>([]);
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

  const voiceDisplayGroups = useMemo(
    () => ({
      special: activeFreezers.filter(f => f.isSpecial),
      standard: activeFreezers.filter(f => !f.isSpecial),
    }),
    [activeFreezers]
  );

  const [primaryVoiceDisplayId, setPrimaryVoiceDisplayId] = useState<string>(() => {
    const rawId =
      (state.appConfig || [])
        .find(i => i.key === VOICE_PRIMARY_DISPLAY_CONFIG_KEY)
        ?.value?.trim() || '';
    if (!rawId) return '';
    return activeFreezers.some(f => f.id === rawId) ? rawId : '';
  });
  const [voiceDisplaySavedNotice, setVoiceDisplaySavedNotice] = useState(false);

  useEffect(() => {
    const rawId =
      (state.appConfig || [])
        .find(i => i.key === VOICE_PRIMARY_DISPLAY_CONFIG_KEY)
        ?.value?.trim() || '';
    if (!rawId) {
      setPrimaryVoiceDisplayId('');
      return;
    }
    setPrimaryVoiceDisplayId(activeFreezers.some(f => f.id === rawId) ? rawId : '');
  }, [state.appConfig, activeFreezers]);

  const handleChangePrimaryVoiceDisplay = (nextId: string) => {
    setPrimaryVoiceDisplayId(nextId);
    if (onSaveAppConfigKey) {
      onSaveAppConfigKey(VOICE_PRIMARY_DISPLAY_CONFIG_KEY, nextId);
    } else {
      authFetch(getApiUrl('api/app-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: VOICE_PRIMARY_DISPLAY_CONFIG_KEY, value: nextId }),
      })
        .then(res => (res.ok ? res.json() : null))
        .then(data => {
          if (data && data.configs) {
            const newAppConfig = Object.entries(data.configs).map(([k, v]) => ({
              key: k,
              value: v as string,
              updatedAt: new Date().toISOString(),
            }));
            dispatch({
              type: 'REPLACE_STATE',
              payload: {
                ...state,
                appConfig: newAppConfig,
              },
            });
          }
        })
        .catch(err => console.warn('Could not save primary voice display freezer:', err));
    }
    setVoiceDisplaySavedNotice(true);
    setTimeout(() => setVoiceDisplaySavedNotice(false), 3000);
  };

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
    if (targetType === 'bundle') {
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
    return [];
  }, [targetType, targetSearch, activeProducts, activeContainers, activeFreezers]);

  const entries = useMemo(() => {
    const raw = state.voiceDictionary || [];
    return [...raw].sort((a, b) => a.spokenPhrase.localeCompare(b.spokenPhrase));
  }, [state.voiceDictionary]);

  const resolveEntryTarget = (
    entry: VoiceDictionaryEntry
  ): {
    label: string;
    missing: boolean;
    bundleParts?: Array<{ productId: string; name: string; quantity: number; missing: boolean }>;
  } => {
    if (entry.targetType === 'phrase' || entry.targetType === 'command') {
      return { label: entry.replacementText || '(empty rewrite)', missing: !entry.replacementText };
    }
    if (entry.targetType === 'bundle') {
      const items = Array.isArray(entry.bundleItems) ? entry.bundleItems : [];
      if (items.length === 0) {
        return { label: 'No products in pack', missing: true, bundleParts: [] };
      }
      const bundleParts = items.map(item => {
        const p = productMap.get(item.productId);
        const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
        if (!p) {
          return { productId: item.productId, name: 'Deleted Product', quantity: qty, missing: true };
        }
        return {
          productId: item.productId,
          name: p.isArchived ? `${p.name} (Archived)` : p.name,
          quantity: qty,
          missing: Boolean(p.isArchived),
        };
      });
      return {
        label: bundleParts.map(bp => `${bp.quantity}x ${bp.name}`).join(', '),
        missing: bundleParts.some(bp => bp.missing),
        bundleParts,
      };
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
    setBundleItems([]);
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
    setBundleItems(
      Array.isArray(entry.bundleItems)
        ? entry.bundleItems.map(item => ({
            productId: item.productId,
            quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
          }))
        : []
    );
    setReplacementText(entry.replacementText || '');
    setNotes(entry.notes || '');
    setTargetSearch('');
    setFormError(null);
    setFormNotice(null);
  };

  const handleAddBundleProduct = (productId: string) => {
    setBundleItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i =>
          i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
    setFormError(null);
  };

  const handleSetBundleProductQty = (productId: string, nextQty: number) => {
    const clamped = Math.max(1, Math.round(nextQty));
    setBundleItems(prev =>
      prev.map(i => (i.productId === productId ? { ...i, quantity: clamped } : i))
    );
  };

  const handleRemoveBundleProduct = (productId: string) => {
    setBundleItems(prev => prev.filter(i => i.productId !== productId));
  };

  const duplicateConflict = useMemo(() => {
    const norm = spokenPhrase.trim().toLowerCase();
    if (!norm) return null;
    const isRewriteType = targetType === 'phrase' || targetType === 'command';
    const normalizeBundleSig = (items?: Array<{ productId: string; quantity: number }>) =>
      (items || [])
        .map(i => `${i.productId}:${Math.max(1, Math.round(Number(i.quantity) || 1))}`)
        .sort()
        .join('|');
    const currentBundleSig = normalizeBundleSig(bundleItems);
    const sameSpoken = entries.filter(
      e => e.id !== editingId && e.spokenPhrase.trim().toLowerCase() === norm
    );
    if (sameSpoken.length === 0) return null;
    const exactDup = sameSpoken.find(e => {
      if (e.targetType !== targetType) return false;
      if (isRewriteType) {
        return (
          (e.replacementText || '').trim().toLowerCase() ===
          replacementText.trim().toLowerCase()
        );
      }
      if (targetType === 'bundle') {
        return normalizeBundleSig(e.bundleItems) === currentBundleSig;
      }
      return e.targetId === targetId;
    });
    return { sameSpoken, exactDup };
  }, [spokenPhrase, targetType, targetId, bundleItems, replacementText, entries, editingId]);

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
    const cleanBundleItems =
      targetType === 'bundle'
        ? bundleItems.map(i => ({
            productId: i.productId,
            quantity: Math.max(1, Math.round(Number(i.quantity) || 1)),
          }))
        : [];

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
    } else if (targetType === 'bundle') {
      if (cleanBundleItems.length === 0) {
        setFormError('Add at least one product to this pack.');
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
            targetId: isRewriteType || targetType === 'bundle' ? undefined : targetId,
            bundleItems: targetType === 'bundle' ? cleanBundleItems : undefined,
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
            targetId: isRewriteType || targetType === 'bundle' ? undefined : targetId,
            bundleItems: targetType === 'bundle' ? cleanBundleItems : undefined,
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
      {/* Primary Display Freezer Preference */}
      <div className="bg-cool-gray-850 rounded-xl border border-cool-gray-750 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-cool-gray-800">
          <div>
            <h4 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Mic className="w-4 h-4 text-cyan-400" />
              Primary Voice Display Freezer
            </h4>
            <p className="text-xs text-cool-gray-400 mt-0.5">
              Choose which freezer resolves when you say &ldquo;display&rdquo; or &ldquo;display case&rdquo;. Leave on Automatic to match literal &ldquo;Display&rdquo; names first and prompt only if tied, or say &ldquo;all displays&rdquo; / &ldquo;special freezers&rdquo; to target every Special Freezer together.
            </p>
          </div>
          {voiceDisplaySavedNotice && (
            <span className="text-xs font-semibold text-emerald-400 shrink-0">
              Saved
            </span>
          )}
        </div>
        <div>
          <label
            htmlFor="voice-primary-display-select"
            className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300 mb-1.5"
          >
            Default Freezer For &ldquo;Display&rdquo; Commands
          </label>
          <select
            id="voice-primary-display-select"
            value={primaryVoiceDisplayId}
            onChange={e => handleChangePrimaryVoiceDisplay(e.target.value)}
            className="w-full max-w-lg min-h-[44px] rounded-lg bg-cool-gray-900 border border-cool-gray-700 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 px-3 py-2 text-sm text-white font-semibold cursor-pointer"
          >
            <option value="">
              Automatic (Literal &ldquo;Display&rdquo; first, ask if tied)
            </option>
            {voiceDisplayGroups.special.length > 0 && (
              <optgroup label="Special / Display Freezers">
                {voiceDisplayGroups.special.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} (Special Freezer)
                  </option>
                ))}
              </optgroup>
            )}
            {voiceDisplayGroups.standard.length > 0 && (
              <optgroup label="Other On-Site Freezers">
                {voiceDisplayGroups.standard.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(
              [
                { type: 'product' as VoiceDictionaryTargetType, label: 'Product', icon: Package },
                { type: 'bundle' as VoiceDictionaryTargetType, label: 'Product Pack', icon: Layers },
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
                      setBundleItems([]);
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
        ) : targetType === 'bundle' ? (
          <div className="space-y-3">
            <p className="text-[11px] text-cool-gray-400">
              Map one spoken pack phrase (e.g. &ldquo;broth mix pack&rdquo;) to multiple products and quantities. Saying &ldquo;remove 1 broth mix pack from display loose&rdquo; will expand to each item automatically.
            </p>

            {/* Selected Pack Items */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300">
                  Pack Contents ({bundleItems.length} product{bundleItems.length === 1 ? '' : 's'})
                </span>
                {bundleItems.length > 0 && (
                  <span className="text-[11px] text-fuchsia-300 font-semibold tabular-nums">
                    {bundleItems.reduce((sum, i) => sum + i.quantity, 0)} total unit(s) per pack
                  </span>
                )}
              </div>

              {bundleItems.length === 0 ? (
                <div className="rounded-lg bg-cool-gray-900/70 border border-dashed border-cool-gray-750 px-3 py-3 text-xs text-cool-gray-400">
                  No products added yet. Pick products below to include in this pack.
                </div>
              ) : (
                <div className="divide-y divide-cool-gray-800 rounded-lg border border-fuchsia-500/35 bg-cool-gray-900 overflow-hidden">
                  {bundleItems.map(item => {
                    const p = productMap.get(item.productId);
                    const isMissing = !p || Boolean(p.isArchived);
                    return (
                      <div
                        key={item.productId}
                        className="px-3 py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs sm:text-sm font-semibold truncate ${
                                isMissing ? 'text-amber-300' : 'text-white'
                              }`}
                            >
                              {p ? p.name : 'Deleted Product'}
                            </span>
                            {isMissing && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 shrink-0">
                                {p?.isArchived ? 'Archived' : 'Missing'}
                              </span>
                            )}
                          </div>
                          {p && (
                            <div className="text-[11px] text-cool-gray-400 truncate">
                              {p.primaryCategory} / {p.subCategory}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSetBundleProductQty(item.productId, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            aria-label="Decrease pack item quantity"
                            className="w-7 h-7 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 disabled:opacity-40 disabled:cursor-not-allowed border border-cool-gray-700 text-cool-gray-200 flex items-center justify-center cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="min-w-[26px] text-center text-xs font-bold text-white tabular-nums">
                            {item.quantity}x
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSetBundleProductQty(item.productId, item.quantity + 1)}
                            aria-label="Increase pack item quantity"
                            className="w-7 h-7 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 flex items-center justify-center cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBundleProduct(item.productId)}
                            aria-label="Remove product from pack"
                            className="w-7 h-7 ml-1 rounded-md bg-cool-gray-850 hover:bg-red-950/50 border border-cool-gray-750 hover:border-red-500/40 text-cool-gray-400 hover:text-red-300 flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Product Search & 1-Click Add */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="vd-bundle-product-search"
                  className="block text-[11px] font-bold uppercase tracking-wider text-cool-gray-300"
                >
                  Add Products to Pack
                </label>
                <span className="text-[11px] text-cool-gray-400">
                  {filteredTargetOptions.length} active product{filteredTargetOptions.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-cool-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="vd-bundle-product-search"
                  type="text"
                  value={targetSearch}
                  onChange={e => setTargetSearch(e.target.value)}
                  placeholder="Filter products to add to pack..."
                  className="w-full rounded-lg bg-cool-gray-900 border border-cool-gray-750 focus:border-cyan-500 pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-cool-gray-500"
                />
              </div>

              <div className="max-h-56 overflow-y-auto divide-y divide-cool-gray-800 rounded-lg border border-cool-gray-750 bg-cool-gray-900">
                {filteredTargetOptions.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-cool-gray-400">
                    No active products match &ldquo;{targetSearch}&rdquo;.
                  </div>
                ) : (
                  filteredTargetOptions.map(opt => {
                    const existing = bundleItems.find(i => i.productId === opt.id);
                    return (
                      <div
                        key={opt.id}
                        className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-cool-gray-850 transition"
                      >
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-medium text-white truncate">
                            {opt.label}
                          </div>
                          {opt.subLabel && (
                            <div className="text-[11px] text-cool-gray-400 truncate">
                              {opt.subLabel}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddBundleProduct(opt.id)}
                          className={`px-2.5 py-1 rounded-md border text-xs font-bold flex items-center gap-1 shrink-0 transition cursor-pointer ${
                            existing
                              ? 'bg-fuchsia-950/60 hover:bg-fuchsia-900/60 text-fuchsia-200 border-fuchsia-500/40'
                              : 'bg-cool-gray-800 hover:bg-cyan-600 text-cool-gray-200 hover:text-white border-cool-gray-700'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>{existing ? `Added (${existing.quantity}x) +1` : 'Add'}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
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
              { id: 'bundle', label: 'Packs' },
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
                      {entry.targetType === 'bundle' && target.bundleParts ? (
                        target.bundleParts.length === 0 ? (
                          <span className="text-xs text-amber-300 font-semibold">
                            No products configured
                          </span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {target.bundleParts.map(bp => (
                              <span
                                key={bp.productId}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold ${
                                  bp.missing
                                    ? 'bg-amber-950/50 border-amber-500/40 text-amber-300'
                                    : 'bg-cool-gray-950 border-cool-gray-750 text-cool-gray-100'
                                }`}
                              >
                                <span className="text-fuchsia-300 font-bold tabular-nums">
                                  {bp.quantity}x
                                </span>
                                <span>{bp.name}</span>
                              </span>
                            ))}
                          </div>
                        )
                      ) : (
                        <span
                          className={`text-xs sm:text-sm font-semibold truncate ${
                            target.missing ? 'text-amber-300' : 'text-cool-gray-100'
                          }`}
                        >
                          {target.label}
                        </span>
                      )}
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
