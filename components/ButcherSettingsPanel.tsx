import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Edit3,
  KeyRound,
  Link2,
  Plus,
  RotateCcw,
  Scale,
  SlidersHorizontal,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react';
import {
  Action,
  ButcherBaselineGroupingMode,
  ButcherDocumentLinkType,
  ButcherOrderTag,
  ButcherTagWeightCheckMode,
  InventoryState,
} from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { authFetch } from '../utils/clientDevice';
import { useUserAuth } from '../hooks/useUserAuth';
import {
  BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY,
  BUTCHER_BASELINE_GROUPING_CONFIG_KEY,
  BUTCHER_BASELINE_GROUPING_META,
  BUTCHER_DOC_LINK_TYPES_CONFIG_KEY,
  BUTCHER_ORDER_TAGS_CONFIG_KEY,
  BUTCHER_TAG_COLOR_PRESETS,
  BUTCHER_TAG_WEIGHT_MODE_META,
  getButcherDocLinkTypeUsageCounts,
  getButcherTagUsageCounts,
  parseButcherAnomalySensitivity,
  parseButcherBaselineGroupingMode,
  parseButcherDocumentLinkTypes,
  parseButcherOrderTags,
} from '../utils/butcherSettings';
import {
  clampSensitivity,
  DEFAULT_ANOMALY_SENSITIVITY,
  MAX_ANOMALY_SENSITIVITY,
  MIN_ANOMALY_SENSITIVITY,
} from '../utils/butcherStats';
import { buildSpeciesPrimalIndex, getAllManagedSpeciesNames } from '../utils/speciesPrimals';

interface ButcherSettingsPanelProps {
  state: InventoryState;
  dispatch: React.Dispatch<Action>;
  onNavigateToSpeciesPrimals?: () => void;
}

const BASELINE_GROUPING_MODES: ButcherBaselineGroupingMode[] = [
  'species',
  'species_and_butcher',
];

const WEIGHT_CHECK_MODES: ButcherTagWeightCheckMode[] = [
  'normal',
  'separate_baseline',
  'exclude_from_baseline',
];

function generateLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const ButcherSettingsPanel: React.FC<ButcherSettingsPanelProps> = ({
  state,
  dispatch,
  onNavigateToSpeciesPrimals,
}) => {
  const { usersConfigured, isAuthenticated, requireLoginForEdits, openAccountModal } = useUserAuth();
  const isLoginRequiredForWrite = usersConfigured && requireLoginForEdits && !isAuthenticated;

  const orders = state.butcherOrders || [];

  const speciesPrimalIndex = useMemo(
    () => buildSpeciesPrimalIndex(state.speciesPrimals),
    [state.speciesPrimals],
  );
  const allSpecies = useMemo(
    () => getAllManagedSpeciesNames(state.speciesPrimals, state.appConfig, orders),
    [state.speciesPrimals, state.appConfig, orders],
  );
  const totalPrimalsCount = speciesPrimalIndex.primalList.length;
  const assignedProductsCount = useMemo(
    () => (state.products || []).filter((p) => p.primalId && speciesPrimalIndex.primalById.has(p.primalId)).length,
    [state.products, speciesPrimalIndex],
  );

  const butcherTags = useMemo(
    () => parseButcherOrderTags(state.appConfig),
    [state.appConfig],
  );
  const tagUsageCounts = useMemo(
    () => getButcherTagUsageCounts(orders),
    [orders],
  );

  const documentLinkTypes = useMemo(
    () => parseButcherDocumentLinkTypes(state.appConfig),
    [state.appConfig],
  );
  const docTypeUsageCounts = useMemo(
    () => getButcherDocLinkTypeUsageCounts(orders, documentLinkTypes),
    [orders, documentLinkTypes],
  );

  const baselineGroupingMode = useMemo(
    () => parseButcherBaselineGroupingMode(state.appConfig),
    [state.appConfig],
  );

  const savedAnomalySensitivity = useMemo(
    () => parseButcherAnomalySensitivity(state.appConfig),
    [state.appConfig],
  );
  const [sensitivityDraft, setSensitivityDraft] = useState<number>(savedAnomalySensitivity);

  useEffect(() => {
    setSensitivityDraft(savedAnomalySensitivity);
  }, [savedAnomalySensitivity]);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
    authRequired?: boolean;
  } | null>(null);

  // Butcher Order Tag form states
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagNameInput, setTagNameInput] = useState('');
  const [tagDescInput, setTagDescInput] = useState('');
  const [tagColorInput, setTagColorInput] = useState<string>(BUTCHER_TAG_COLOR_PRESETS[0].value);
  const [tagWeightModeInput, setTagWeightModeInput] = useState<ButcherTagWeightCheckMode>('normal');
  const [confirmDeleteTagId, setConfirmDeleteTagId] = useState<string | null>(null);

  // Document Link Type form states
  const [newDocTypeName, setNewDocTypeName] = useState('');
  const [renamingDocTypeId, setRenamingDocTypeId] = useState<string | null>(null);
  const [renameDocTypeTarget, setRenameDocTypeTarget] = useState('');
  const [renameDocTypeAlsoMatchLegacy, setRenameDocTypeAlsoMatchLegacy] = useState(true);
  const [confirmDeleteDocTypeId, setConfirmDeleteDocTypeId] = useState<string | null>(null);

  const showFeedback = (
    type: 'success' | 'error',
    text: string,
    authRequired?: boolean,
  ) => {
    setFeedback({ type, text, authRequired });
    if (type === 'success') {
      setTimeout(() => {
        setFeedback((prev) => (prev?.text === text ? null : prev));
      }, 4500);
    }
  };

  const persistAppConfigKey = async (
    key: string,
    value: unknown,
    successMessage: string,
  ): Promise<boolean> => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await authFetch(getApiUrl('api/app-config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          configs: {
            [key]: JSON.stringify(value),
          },
        }),
      });

      if (res.status === 401) {
        showFeedback(
          'error',
          'Sign in with your user PIN to save Butcher Settings to the shared database.',
          true,
        );
        return false;
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        showFeedback(
          'error',
          errBody?.message || 'Failed to save Butcher Settings to server.',
        );
        return false;
      }

      const data = await res.json().catch(() => ({}));
      const nextAppConfig = Array.isArray(data?.appConfig)
        ? data.appConfig
        : data && data.configs
          ? Object.entries(data.configs).map(([k, v]) => ({
              key: k,
              value: String(v ?? ''),
              updatedAt: new Date().toISOString(),
            }))
          : null;
      if (nextAppConfig) {
        dispatch({
          type: 'SYNC_APP_CONFIG',
          payload: nextAppConfig,
        });
      }

      showFeedback('success', successMessage);
      return true;
    } catch {
      showFeedback(
        'error',
        'Network unavailable — Butcher Settings could not be saved right now.',
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================================
  // ANOMALY BASELINE GROUPING & SENSITIVITY HANDLERS
  // ============================================================================
  const handleSelectBaselineGroupingMode = async (mode: ButcherBaselineGroupingMode) => {
    if (mode === baselineGroupingMode || isSaving) return;
    await persistAppConfigKey(
      BUTCHER_BASELINE_GROUPING_CONFIG_KEY,
      mode,
      `Anomaly detection baseline grouping updated to "${BUTCHER_BASELINE_GROUPING_META[mode].label}".`,
    );
  };

  const handleSaveAnomalySensitivity = async (nextVal: number) => {
    const clamped = clampSensitivity(nextVal);
    setSensitivityDraft(clamped);
    if (clamped === savedAnomalySensitivity || isSaving) return;
    const ok = await persistAppConfigKey(
      BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY,
      clamped,
      `Yield anomaly detection sensitivity updated to ${clamped.toFixed(1)}σ.`,
    );
    if (ok) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY, String(clamped));
        }
      } catch {
        // Ignore storage access errors
      }
    }
  };

  // ============================================================================
  // BUTCHER ORDER TAG HANDLERS
  // ============================================================================
  const resetTagForm = () => {
    setEditingTagId(null);
    setTagNameInput('');
    setTagDescInput('');
    setTagColorInput(BUTCHER_TAG_COLOR_PRESETS[0].value);
    setTagWeightModeInput('normal');
  };

  const handleStartEditTag = (tag: ButcherOrderTag) => {
    setEditingTagId(tag.id);
    setTagNameInput(tag.name);
    setTagDescInput(tag.description || '');
    setTagColorInput(tag.color || BUTCHER_TAG_COLOR_PRESETS[0].value);
    setTagWeightModeInput(tag.weightCheckMode || 'normal');
    setConfirmDeleteTagId(null);
  };

  const handleSaveTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tagNameInput.trim();
    if (!trimmed) {
      showFeedback('error', 'Enter a name for the butcher order tag.');
      return;
    }
    const duplicate = butcherTags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase() && t.id !== editingTagId,
    );
    if (duplicate) {
      showFeedback('error', `A butcher order tag named "${duplicate.name}" already exists.`);
      return;
    }

    let nextTags: ButcherOrderTag[];
    let message: string;
    if (editingTagId) {
      nextTags = butcherTags.map((t) =>
        t.id === editingTagId
          ? {
              ...t,
              name: trimmed,
              description: tagDescInput.trim() || undefined,
              color: tagColorInput,
              weightCheckMode: tagWeightModeInput,
            }
          : t,
      );
      message = `Updated butcher order tag "${trimmed}".`;
    } else {
      const created: ButcherOrderTag = {
        id: generateLocalId('btag'),
        name: trimmed,
        description: tagDescInput.trim() || undefined,
        color: tagColorInput,
        weightCheckMode: tagWeightModeInput,
      };
      nextTags = [...butcherTags, created];
      message = `Created butcher order tag "${trimmed}".`;
    }

    const ok = await persistAppConfigKey(
      BUTCHER_ORDER_TAGS_CONFIG_KEY,
      nextTags,
      message,
    );
    if (ok) {
      resetTagForm();
    }
  };

  const handleConfirmDeleteTag = (tag: ButcherOrderTag) => {
    const count = tagUsageCounts.get(tag.id) || 0;
    dispatch({
      type: 'DELETE_BUTCHER_ORDER_TAG',
      payload: { tagId: tag.id },
    });
    setConfirmDeleteTagId(null);
    if (editingTagId === tag.id) {
      resetTagForm();
    }
    showFeedback(
      'success',
      `Deleted butcher order tag "${tag.name}"${count > 0 ? ` and removed it from ${count} order${count === 1 ? '' : 's'}` : ''}.`,
    );
  };

  // ============================================================================
  // DOCUMENT LINK TYPE HANDLERS
  // ============================================================================
  const handleAddDocLinkType = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDocTypeName.trim();
    if (!trimmed) {
      showFeedback('error', 'Enter a document link type name before adding.');
      return;
    }
    const duplicate = documentLinkTypes.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      showFeedback('error', `Document link type "${duplicate.name}" already exists.`);
      return;
    }
    const created: ButcherDocumentLinkType = {
      id: generateLocalId('bdoc'),
      name: trimmed,
    };
    const nextTypes = [...documentLinkTypes, created];
    const ok = await persistAppConfigKey(
      BUTCHER_DOC_LINK_TYPES_CONFIG_KEY,
      nextTypes,
      `Added document link type "${trimmed}".`,
    );
    if (ok) {
      setNewDocTypeName('');
    }
  };

  const handleConfirmDocTypeRename = (docType: ButcherDocumentLinkType) => {
    const nextName = renameDocTypeTarget.trim();
    if (!nextName) {
      showFeedback('error', 'Document link type name cannot be empty.');
      return;
    }
    const duplicate = documentLinkTypes.find(
      (t) => t.id !== docType.id && t.name.toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      showFeedback('error', `Document link type "${duplicate.name}" already exists.`);
      return;
    }
    if (nextName === docType.name) {
      setRenamingDocTypeId(null);
      setRenameDocTypeTarget('');
      return;
    }

    dispatch({
      type: 'RENAME_BUTCHER_DOCUMENT_TYPE',
      payload: {
        typeId: docType.id,
        newName: nextName,
        alsoMatchByName: renameDocTypeAlsoMatchLegacy,
      },
    });
    setRenamingDocTypeId(null);
    setRenameDocTypeTarget('');
    showFeedback('success', `Renamed document link type "${docType.name}" to "${nextName}".`);
  };

  const handleConfirmDeleteDocType = (docType: ButcherDocumentLinkType) => {
    const usage = docTypeUsageCounts.get(docType.id)?.byTypeId || 0;
    dispatch({
      type: 'DELETE_BUTCHER_DOCUMENT_TYPE',
      payload: { typeId: docType.id },
    });
    setConfirmDeleteDocTypeId(null);
    showFeedback(
      'success',
      `Removed document link type "${docType.name}"${usage > 0 ? ` (${usage} existing link${usage === 1 ? '' : 's'} preserved as custom links)` : ''}.`,
    );
  };

  return (
    <div id="butcher-settings-panel" className="space-y-6 max-w-4xl font-sans">
      {isLoginRequiredForWrite && (
        <div className="p-3.5 rounded-lg border border-amber-500/35 bg-amber-950/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-amber-200 font-medium">
            Sign in with your user PIN to save Butcher Settings changes to the shared server database.
          </span>
          <button
            type="button"
            onClick={() => openAccountModal('signin')}
            className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs flex items-center gap-1.5 self-start sm:self-auto whitespace-nowrap cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Sign In
          </button>
        </div>
      )}

      {feedback && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/35 border-emerald-700/50 text-emerald-200'
              : 'bg-rose-950/35 border-rose-700/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          {feedback.authRequired && (
            <button
              type="button"
              onClick={() => openAccountModal('signin')}
              className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs whitespace-nowrap cursor-pointer"
            >
              Sign In with PIN
            </button>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 0: YIELD ANOMALY BASELINE GROUPING                            */}
      {/* ===================================================================== */}
      <section
        id="butcher-settings-baseline-grouping"
        className="bg-cool-gray-850 rounded-lg border border-cool-gray-750 p-5 space-y-4"
      >
        <div className="border-b border-cool-gray-800 pb-3">
          <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-cyan-400 shrink-0" />
            Yield Anomaly Baseline Grouping
          </h4>
          <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
            Choose whether automatic yield anomaly detection compares each harvest against all clean orders of the same species or isolates baselines per butcher/processor.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Yield anomaly baseline grouping"
          className="grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          {BASELINE_GROUPING_MODES.map((mode) => {
            const meta = BUTCHER_BASELINE_GROUPING_META[mode];
            const isSelected = baselineGroupingMode === mode;
            return (
              <button
                key={mode}
                id={`butcher-baseline-grouping-${mode}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isSaving}
                onClick={() => handleSelectBaselineGroupingMode(mode)}
                className={`text-left p-3.5 rounded-lg border transition cursor-pointer disabled:opacity-60 ${
                  isSelected
                    ? 'bg-cyan-950/35 border-cyan-500/70 text-white shadow-xs'
                    : 'bg-cool-gray-900 border-cool-gray-750 text-cool-gray-300 hover:border-cool-gray-600 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{meta.label}</span>
                  <span
                    className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-300'
                        : 'border-cool-gray-600 bg-cool-gray-950'
                    }`}
                  >
                    {isSelected && <Check className="w-2.5 h-2.5" />}
                  </span>
                </div>
                <p className="text-xs text-cool-gray-400 mt-1.5 leading-relaxed">
                  {meta.description}
                </p>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-cool-gray-500 leading-relaxed">
          Works alongside <span className="text-cool-gray-300 font-semibold">Separate Baseline Cohort</span> order tags and recency weighting. You can still switch between Same Butcher and All Butchers on demand inside any order&apos;s Weight Audit modal.
        </p>

        <div
          id="butcher-settings-anomaly-sensitivity"
          className="pt-4 border-t border-cool-gray-800 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h5 className="text-xs font-bold text-cool-gray-100">
                Anomaly Detection Sensitivity
              </h5>
              <p className="text-[11px] text-cool-gray-400 mt-0.5 leading-relaxed">
                Controls how many standard deviations (σ) from your recency-weighted baseline a harvest yield can drift before it is flagged in the Review Queue and Reports. Lower values are stricter; higher values are more lenient.
              </p>
            </div>
            <span
              id="butcher-settings-sensitivity-value"
              className="font-mono tabular-nums text-sm font-extrabold text-cyan-400 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1 self-start sm:self-auto shrink-0"
            >
              {sensitivityDraft.toFixed(1)}σ
            </span>
          </div>

          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-cool-gray-400 whitespace-nowrap">
                Strict ({MIN_ANOMALY_SENSITIVITY.toFixed(1)}σ)
              </span>
              <input
                id="butcher-settings-sensitivity-slider"
                type="range"
                min={MIN_ANOMALY_SENSITIVITY}
                max={MAX_ANOMALY_SENSITIVITY}
                step={0.1}
                value={sensitivityDraft}
                disabled={isSaving}
                onChange={(e) => setSensitivityDraft(clampSensitivity(parseFloat(e.target.value)))}
                className="flex-1 accent-cyan-500 cursor-pointer disabled:opacity-60"
                aria-label="Anomaly detection sensitivity"
              />
              <span className="text-[11px] font-semibold text-cool-gray-400 whitespace-nowrap">
                Lenient ({MAX_ANOMALY_SENSITIVITY.toFixed(1)}σ)
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                id="butcher-settings-sensitivity-save"
                type="button"
                disabled={isSaving || sensitivityDraft === savedAnomalySensitivity}
                onClick={() => void handleSaveAnomalySensitivity(sensitivityDraft)}
                className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Save Sensitivity
              </button>
              {savedAnomalySensitivity !== DEFAULT_ANOMALY_SENSITIVITY && (
                <button
                  id="butcher-settings-sensitivity-reset"
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSaveAnomalySensitivity(DEFAULT_ANOMALY_SENSITIVITY)}
                  className="px-2.5 py-1.5 rounded-md bg-cool-gray-800 hover:bg-cool-gray-700 text-cool-gray-300 hover:text-white border border-cool-gray-700 text-xs font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 whitespace-nowrap"
                  title={`Reset to default (${DEFAULT_ANOMALY_SENSITIVITY.toFixed(1)}σ)`}
                >
                  <RotateCcw className="w-3 h-3" />
                  Default ({DEFAULT_ANOMALY_SENSITIVITY.toFixed(1)}σ)
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 1: SPECIES & PRIMAL CUTS (MOVED TO CATALOG)                   */}
      {/* ===================================================================== */}
      <section className="bg-cool-gray-850 rounded-lg border border-cool-gray-750 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-cyan-400 shrink-0" />
              Species &amp; Primal Cuts
            </h4>
            <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed max-w-2xl">
              Species and their primal cuts are managed in <span className="text-cool-gray-200 font-semibold">Catalog → Species &amp; Primals</span>. Assign a primal cut to each product to enable primal filtering across inventory views and primal-level yield reports in Butcher Records.
            </p>
            <div className="mt-2.5 flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-cool-gray-400 font-mono tabular-nums">
              <span>{allSpecies.length} species</span>
              <span className="text-cool-gray-700">·</span>
              <span>{totalPrimalsCount} primal{totalPrimalsCount === 1 ? '' : 's'}</span>
              <span className="text-cool-gray-700">·</span>
              <span>{assignedProductsCount} linked product{assignedProductsCount === 1 ? '' : 's'}</span>
            </div>
          </div>
          {onNavigateToSpeciesPrimals && (
            <button
              type="button"
              onClick={onNavigateToSpeciesPrimals}
              className="px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition"
            >
              Manage Species &amp; Primals
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 2: BUTCHER ORDER TAGS                                         */}
      {/* ===================================================================== */}
      <section className="bg-cool-gray-850 rounded-lg border border-cool-gray-750 p-5 space-y-4">
        <div className="border-b border-cool-gray-800 pb-3">
          <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
            <TagIcon className="w-4 h-4 text-cyan-400 shrink-0" />
            Butcher Order Tags
          </h4>
          <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
            Create tags dedicated to butcher events (separate from Inventory item tags)—for example, marking a retired sow or skinned carcass. Filter and compare tagged orders in Orders & Reports, and optionally isolate or exclude them from yield anomaly baselines.
          </p>
        </div>

        {/* Add / Edit Butcher Order Tag Form */}
        <form
          onSubmit={handleSaveTag}
          className="rounded-lg border border-cool-gray-800 bg-cool-gray-900/45 p-4 space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-cool-gray-200">
              {editingTagId ? 'Edit Butcher Order Tag' : 'Create Butcher Order Tag'}
            </span>
            {editingTagId && (
              <button
                type="button"
                onClick={resetTagForm}
                className="text-xs text-cool-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancel edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="butcher-tag-name-input"
                className="block text-[11px] font-semibold text-cool-gray-300 mb-1"
              >
                Tag Name
              </label>
              <input
                id="butcher-tag-name-input"
                type="text"
                value={tagNameInput}
                onChange={(e) => setTagNameInput(e.target.value)}
                placeholder="e.g. Retired Sow, Skinned, Heavy Steer"
                className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label
                htmlFor="butcher-tag-desc-input"
                className="block text-[11px] font-semibold text-cool-gray-300 mb-1"
              >
                Description (Optional)
              </label>
              <input
                id="butcher-tag-desc-input"
                type="text"
                value={tagDescInput}
                onChange={(e) => setTagDescInput(e.target.value)}
                placeholder="When should operators apply this tag?"
                className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-cool-gray-300">
                Color Marker
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {BUTCHER_TAG_COLOR_PRESETS.map((preset) => {
                  const selected = tagColorInput === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setTagColorInput(preset.value)}
                      aria-label={`Color ${preset.label}`}
                      title={preset.label}
                      className={`w-7 h-7 rounded-md border flex items-center justify-center transition cursor-pointer ${
                        selected
                          ? 'border-white ring-2 ring-cyan-400/60 scale-105'
                          : 'border-cool-gray-700 opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: preset.value }}
                    >
                      {selected && <Check className="w-3.5 h-3.5 text-cool-gray-950" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="butcher-tag-weight-mode"
                className="block text-[11px] font-semibold text-cool-gray-300"
              >
                Weight Anomaly & Baseline Behavior
              </label>
              <select
                id="butcher-tag-weight-mode"
                value={tagWeightModeInput}
                onChange={(e) =>
                  setTagWeightModeInput(e.target.value as ButcherTagWeightCheckMode)
                }
                className="w-full bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {WEIGHT_CHECK_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {BUTCHER_TAG_WEIGHT_MODE_META[mode].label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-cool-gray-400 leading-relaxed">
                {BUTCHER_TAG_WEIGHT_MODE_META[tagWeightModeInput].description}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSaving || !tagNameInput.trim()}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 transition"
            >
              {editingTagId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {editingTagId ? 'Save Tag Changes' : 'Add Butcher Tag'}
            </button>
          </div>
        </form>

        {butcherTags.length === 0 ? (
          <div className="rounded-lg border border-dashed border-cool-gray-750 p-5 text-center text-xs text-cool-gray-400">
            No butcher order tags defined yet. Add tags above to categorize harvests like Retired Sow or isolate special yield cohorts.
          </div>
        ) : (
          <div className="divide-y divide-cool-gray-800 border border-cool-gray-800 rounded-lg overflow-hidden">
            {butcherTags.map((tag) => {
              const count = tagUsageCounts.get(tag.id) || 0;
              const modeMeta = BUTCHER_TAG_WEIGHT_MODE_META[tag.weightCheckMode || 'normal'];
              const isConfirmingDelete = confirmDeleteTagId === tag.id;

              return (
                <div key={tag.id} className="px-3.5 py-3 bg-cool-gray-900/40 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: tag.color || '#06b6d4' }}
                          aria-hidden="true"
                        />
                        <span className="text-sm font-semibold text-cool-gray-100">
                          {tag.name}
                        </span>
                        <span className="text-xs text-cool-gray-400">·</span>
                        <span
                          className={`text-xs font-medium ${
                            tag.weightCheckMode === 'separate_baseline'
                              ? 'text-cyan-300'
                              : tag.weightCheckMode === 'exclude_from_baseline'
                                ? 'text-amber-300'
                                : 'text-cool-gray-400'
                          }`}
                        >
                          {modeMeta.shortLabel}
                        </span>
                        <span className="text-xs text-cool-gray-400">·</span>
                        <span className="text-xs text-cool-gray-400 font-mono tabular-nums">
                          {count} order{count === 1 ? '' : 's'}
                        </span>
                      </div>
                      {tag.description && (
                        <p className="text-xs text-cool-gray-400">{tag.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEditTag(tag)}
                        className="px-2.5 py-1 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer transition"
                      >
                        <Edit3 className="w-3 h-3 text-cyan-400" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDeleteTagId(isConfirmingDelete ? null : tag.id)
                        }
                        className="p-1.5 rounded-md text-cool-gray-400 hover:text-rose-400 hover:bg-cool-gray-800 transition cursor-pointer"
                        title={`Delete tag "${tag.name}"`}
                        aria-label={`Delete ${tag.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isConfirmingDelete && (
                    <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="text-rose-200">
                        Delete "{tag.name}"?{' '}
                        {count > 0
                          ? `This will remove the tag from ${count} butcher order${count === 1 ? '' : 's'}.`
                          : 'No orders currently use this tag.'}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConfirmDeleteTag(tag)}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer whitespace-nowrap"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTagId(null)}
                          className="px-2.5 py-1 rounded bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECTION 3: DOCUMENT LINK TYPES                                        */}
      {/* ===================================================================== */}
      <section className="bg-cool-gray-850 rounded-lg border border-cool-gray-750 p-5 space-y-4">
        <div className="border-b border-cool-gray-800 pb-3">
          <h4 className="text-sm font-bold text-cool-gray-100 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-cyan-400 shrink-0" />
            Document Link Types
          </h4>
          <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
            Define your own standard document link types (no built-in defaults)—such as Invoice, FarmOS Log, Odoo Report, or Cutsheet. They appear as selectable options alongside a Custom entry when attaching links to butcher orders.
          </p>
        </div>

        <form onSubmit={handleAddDocLinkType} className="flex flex-col sm:flex-row gap-2 max-w-lg">
          <input
            id="butcher-new-doctype-input"
            type="text"
            value={newDocTypeName}
            onChange={(e) => setNewDocTypeName(e.target.value)}
            placeholder="Add a link type (e.g. Invoice, FarmOS Log, Odoo Report)"
            className="flex-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={isSaving || !newDocTypeName.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Link Type
          </button>
        </form>

        {documentLinkTypes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-cool-gray-750 p-5 text-center text-xs text-cool-gray-400">
            No document link types configured yet (no defaults are pre-populated). Add your standard link types above, or continue using free-form custom names on individual orders.
          </div>
        ) : (
          <div className="divide-y divide-cool-gray-800 border border-cool-gray-800 rounded-lg overflow-hidden">
            {documentLinkTypes.map((docType) => {
              const usage = docTypeUsageCounts.get(docType.id) || {
                byTypeId: 0,
                byLegacyName: 0,
                total: 0,
              };
              const isRenaming = renamingDocTypeId === docType.id;
              const isConfirmingDelete = confirmDeleteDocTypeId === docType.id;

              return (
                <div key={docType.id} className="px-3.5 py-2.5 bg-cool-gray-900/40 space-y-2">
                  {isRenaming ? (
                    <div className="space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="text"
                          value={renameDocTypeTarget}
                          onChange={(e) => setRenameDocTypeTarget(e.target.value)}
                          placeholder="New link type name..."
                          className="flex-1 bg-cool-gray-900 border border-cyan-500/60 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                          autoFocus
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleConfirmDocTypeRename(docType)}
                            disabled={!renameDocTypeTarget.trim()}
                            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Save Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingDocTypeId(null);
                              setRenameDocTypeTarget('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                      {usage.byLegacyName > 0 && (
                        <label className="flex items-center gap-2 text-[11px] text-cool-gray-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={renameDocTypeAlsoMatchLegacy}
                            onChange={(e) => setRenameDocTypeAlsoMatchLegacy(e.target.checked)}
                            className="rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500"
                          />
                          <span>
                            Also update &amp; link {usage.byLegacyName} older attachment{usage.byLegacyName === 1 ? '' : 's'} currently named "{docType.name}"
                          </span>
                        </label>
                      )}
                      <p className="text-[11px] text-cool-gray-400">
                        Will update{' '}
                        <span className="font-mono tabular-nums text-cool-gray-200">
                          {usage.byTypeId + (renameDocTypeAlsoMatchLegacy ? usage.byLegacyName : 0)}
                        </span>{' '}
                        attached link{(usage.byTypeId + (renameDocTypeAlsoMatchLegacy ? usage.byLegacyName : 0)) === 1 ? '' : 's'} across existing butcher orders.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm font-semibold text-cool-gray-100 truncate">
                          {docType.name}
                        </span>
                        <span className="text-xs text-cool-gray-400 font-mono tabular-nums">
                          {usage.total} link{usage.total === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingDocTypeId(docType.id);
                            setRenameDocTypeTarget(docType.name);
                            setRenameDocTypeAlsoMatchLegacy(true);
                            setConfirmDeleteDocTypeId(null);
                          }}
                          className="px-2.5 py-1 rounded-md bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer transition"
                        >
                          <Edit3 className="w-3 h-3 text-cyan-400" />
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmDeleteDocTypeId(isConfirmingDelete ? null : docType.id)
                          }
                          className="p-1.5 rounded-md text-cool-gray-400 hover:text-rose-400 hover:bg-cool-gray-800 transition cursor-pointer"
                          title={`Delete document link type "${docType.name}"`}
                          aria-label={`Delete ${docType.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {isConfirmingDelete && (
                    <div className="rounded-md border border-rose-500/40 bg-rose-950/30 px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <span className="text-rose-200">
                        Remove "{docType.name}" from preset types? Existing links on historical orders will be kept safely as custom links.
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleConfirmDeleteDocType(docType)}
                          className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer whitespace-nowrap"
                        >
                          Confirm Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteDocTypeId(null)}
                          className="px-2.5 py-1 rounded bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 font-semibold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-cool-gray-400">
        Changes are stored in the shared database (<code className="font-mono text-cyan-400">app_config</code>) and automatically included in all SQLite, ZIP, and JSON backups.
      </p>
    </div>
  );
};
