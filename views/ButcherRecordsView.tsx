// Butcher records view
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Search, Trash2, ArrowRight, Edit3, X, ChevronDown, Check, CheckCircle2, PlusCircle, Plus, Link, ExternalLink, AlertTriangle, AlertCircle, Flag, ClipboardCheck, Calculator, Tag as TagIcon, Lock, RotateCcw, BarChart3, FileSpreadsheet } from 'lucide-react';
import Papa from 'papaparse';
import { ButcherOrder, ButcherRecord, AppLocation, Product, ButcherOrderDocument, ButcherReportMode, ButcherWeightField } from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { SearchableProductSelect } from './OffSiteStorageView';
import { ManagementForms } from '../components/ManagementForms';
import { ButcherSpreadsheetView, ButcherSpreadsheetOrderSelectionRequest } from './ButcherSpreadsheetView';
import { ManualButcherEntryModal, ManualCutItem } from '../components/ManualButcherEntryModal';
import {
  computeOrderStats,
  DEFAULT_ANOMALY_SENSITIVITY,
  clampSensitivity,
  groupRecordsByOrderId,
  analyzeOrderReviewQueue,
  computeOrderStatsWithMode,
  filterCutBreakdown,
  computeChartYAxisScale,
  formatCompactAxisNumber,
  buildSegmentedSvgPath,
  buildSegmentedAreaPath,
  OrderReviewIssueCategory,
  BUTCHER_WEIGHT_FIELD_LABELS,
} from '../utils/butcherStats';
import {
  BUTCHER_REPORT_DEFINITIONS,
  ButcherReportTypeId,
  ButcherReportKpiTone,
  ButcherReportKpiContext,
  buildButcherReportKpis,
  getKpiGridColumnsClass,
} from '../utils/butcherReports';
import {
  parseButcherBaselineGroupingMode,
  parseButcherSpeciesList,
  parseButcherOrderTags,
  parseButcherDocumentLinkTypes,
  hasButcherAnomalySensitivityConfig,
  parseButcherAnomalySensitivity,
  getAllButcherSpeciesOptions,
  resolveDocumentDisplayName,
  resolveOrderTags,
  matchesButcherOrderSearch,
  ButcherDateFilterField,
  BUTCHER_DATE_FILTER_FIELD_LABELS,
  ButcherOrderFilterState,
  ButcherDateRangePreset,
  createEmptyButcherOrderFilter,
  countActiveButcherFilters,
  computeDateRangePreset,
  matchesButcherOrderFilters,
  matchesButcherRecordFilter,
  mergeOrderNumbersForReportFilter,
  mergeOrderIdsForSpreadsheetFilter,
} from '../utils/butcherSettings';
import { ButcherAnomalyReviewModal } from '../components/ButcherAnomalyReviewModal';
import { ButcherTimelinesReport } from '../components/ButcherTimelinesReport';
import {
  computeOrderTimelineMetrics,
  computeButcherTimelineReport,
  formatDaysAsMonths,
} from '../utils/butcherTimelines';

const MultiSelectDropdown = ({ 
  options, 
  selected, 
  onChange, 
  placeholder,
  compact = false,
}: { 
  options: string[], 
  selected: string[], 
  onChange: (selected: string[]) => void, 
  placeholder: string,
  compact?: boolean,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter(x => x !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative">
      <div 
        className={`w-full cursor-pointer flex justify-between items-center transition hover:border-cyan-500/50 ${
          compact
            ? 'bg-cool-gray-850 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-cool-gray-100 text-xs'
            : 'bg-[var(--ha-bg-input)] border border-[var(--ha-border)] rounded-xl px-3 py-2.5 text-[var(--ha-text-primary)]'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`truncate ${compact ? 'text-xs font-semibold' : 'text-sm'}`}>
          {selected.length > 0 ? `${selected.length} selected` : placeholder}
        </span>
        <ChevronDown size={compact ? 14 : 16} className="text-cool-gray-400 shrink-0 ml-1" />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-50 w-full min-w-[180px] mt-1 bg-[var(--ha-bg-card)] border border-[var(--ha-border)] rounded-lg shadow-xl max-h-60 flex flex-col">
            <div className="p-2 border-b border-cool-gray-700">
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full bg-cool-gray-900 text-white px-2 py-1 rounded text-xs outline-none border border-cool-gray-700 focus:border-cyan-500"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClick={e => e.stopPropagation()}
              />
            </div>
            <div className="overflow-y-auto p-1 flex-1">
              {filtered.map(opt => (
                <label key={opt} className="flex items-center gap-2 p-1.5 hover:bg-cool-gray-700 rounded cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="rounded bg-cool-gray-900 border-cool-gray-600 text-cyan-500 focus:ring-cyan-500"
                    checked={selected.includes(opt)}
                    onChange={() => toggleSelect(opt)}
                  />
                  <span className="text-xs text-cool-gray-200">{opt}</span>
                </label>
              ))}
              {filtered.length === 0 && <div className="p-2 text-cool-gray-500 text-xs text-center">No options found</div>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const NestedCategoryMultiSelect = ({ 
  primaryOptions,
  subOptions, 
  selectedPrimary,
  selectedSub,
  onChange,
  placeholder,
  compact = false,
}: {
  primaryOptions: string[],
  subOptions: Record<string, string[]>,
  selectedPrimary: string[],
  selectedSub: string[],
  onChange: (primary: string[], sub: string[]) => void,
  placeholder: string,
  compact?: boolean,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <div 
        className={`w-full border rounded-lg text-white cursor-pointer flex justify-between items-center transition hover:border-cyan-500/50 ${
          compact
            ? 'bg-cool-gray-850 border-cool-gray-700 px-2.5 py-1.5 text-xs'
            : 'bg-cool-gray-900 border-cool-gray-700 px-3 py-2'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`truncate ${compact ? 'text-xs font-semibold' : 'text-sm'}`}>
          {selectedPrimary.length > 0 || selectedSub.length > 0 ? `${selectedPrimary.length}P / ${selectedSub.length}S selected` : placeholder}
        </span>
        <ChevronDown size={compact ? 14 : 16} className="text-cool-gray-400 shrink-0 ml-1" />
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <div className="absolute z-50 w-full min-w-[200px] mt-1 bg-cool-gray-800 border border-cool-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto p-1">
            {primaryOptions.map(p => (
              <div key={p}>
                <label className="flex items-center gap-2 p-1.5 hover:bg-cool-gray-700 rounded cursor-pointer font-bold text-xs">
                  <input type="checkbox" checked={selectedPrimary.includes(p)} onChange={() => {
                    const nextPrimary = selectedPrimary.includes(p) ? selectedPrimary.filter(x => x !== p) : [...selectedPrimary, p];
                    onChange(nextPrimary, selectedSub);
                  }} />
                  {p}
                </label>
                <div className="pl-4">
                  {(subOptions[p] || []).map(s => (
                    <label key={s} className="flex items-center gap-2 p-1 hover:bg-cool-gray-700 rounded cursor-pointer text-xs">
                      <input type="checkbox" checked={selectedSub.includes(s)} onChange={() => {
                        const nextSub = selectedSub.includes(s) ? selectedSub.filter(x => x !== s) : [...selectedSub, s];
                        onChange(selectedPrimary, nextSub);
                      }} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const CreatableDropdown = ({ 
  options, 
  value = '', 
  onChange, 
  placeholder 
}: { 
  options: string[], 
  value?: string, 
  onChange: (val: string) => void, 
  placeholder: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  const filtered = options.filter(o => o.toLowerCase().includes((search || '').toLowerCase()) && o !== search);

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input 
          type="text" 
          value={search || ''}
          onChange={e => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none pr-8"
        />
        <ChevronDown size={16} className="text-cool-gray-400 absolute right-3 pointer-events-none" />
      </div>
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-cool-gray-800 border border-cool-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
          {filtered.map(opt => (
            <div 
              key={opt} 
              className="p-2 hover:bg-cool-gray-700 cursor-pointer text-sm text-cool-gray-200"
              onMouseDown={(e) => {
                e.preventDefault();
                setSearch(opt);
                onChange(opt);
                setIsOpen(false);
              }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const PalletCreatableSelect = ({ 
  options, 
  value = '', 
  onChange, 
  placeholder = 'Select existing active pallet or type to create new...',
  destinationName = '',
  palletLocationMap = new Map<string, string>(),
  required = false,
  hasError = false
}: { 
  options: string[], 
  value?: string, 
  onChange: (val: string) => void, 
  placeholder?: string,
  destinationName?: string,
  palletLocationMap?: Map<string, string>,
  required?: boolean,
  hasError?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  const trimmedSearch = (search || '').trim();
  const isExisting = options.some(o => o.toLowerCase() === (value || '').toLowerCase().trim());
  const otherLocationName = value && !isExisting ? palletLocationMap.get(value.toLowerCase().trim()) : null;
  const searchMatchesExactExisting = options.some(o => o.toLowerCase() === trimmedSearch.toLowerCase());

  const filtered = options.filter(o => 
    !trimmedSearch || o.toLowerCase().includes(trimmedSearch.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="relative flex items-center">
        <input 
          type="text" 
          required={required}
          value={search || ''}
          onChange={e => {
            setSearch(e.target.value);
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 250)}
          placeholder={placeholder}
          className={`w-full bg-cool-gray-900 border rounded-lg px-3 py-2 text-xs text-white font-mono placeholder:text-cool-gray-600 focus:ring-2 outline-none pr-14 transition-colors ${
            hasError 
              ? 'border-amber-500/80 focus:ring-amber-500/50 bg-amber-950/10' 
              : 'border-cool-gray-700 focus:ring-cyan-500'
          }`}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {search ? (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                onChange('');
              }}
              className="p-1 text-cool-gray-500 hover:text-white rounded transition cursor-pointer"
              title="Clear selection"
            >
              <X size={13} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 text-cool-gray-400 hover:text-white rounded transition cursor-pointer"
            title="Toggle options"
          >
            <ChevronDown size={14} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-cool-gray-900 border border-cool-gray-700 rounded-lg shadow-2xl py-1 text-xs">
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase text-cool-gray-400 bg-cool-gray-950/80 border-b border-cool-gray-800 flex justify-between items-center">
            <span>{destinationName ? `Active Pallets at ${destinationName} (${options.length})` : `Active Pallets (${options.length})`}</span>
            <span className="text-[9px] text-emerald-400 font-normal">Active at Destination</span>
          </div>

          {filtered.length > 0 ? (
            filtered.map(opt => {
              const isSelected = opt.toLowerCase() === (value || '').toLowerCase().trim();
              return (
                <div
                  key={opt}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSearch(opt);
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between cursor-pointer transition ${
                    isSelected 
                      ? 'bg-cyan-950/60 text-cyan-300 font-bold' 
                      : 'text-cool-gray-200 hover:bg-cool-gray-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-cool-gray-400">📦</span>
                    <span className="font-mono">{opt}</span>
                  </div>
                  {isSelected && <Check size={14} className="text-cyan-400" />}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2.5 text-xs text-cool-gray-400 italic">
              {options.length === 0 ? (destinationName ? `No active pallets currently at ${destinationName}. Type above to create one.` : 'No active pallets at this location.') : 'No matching active pallets found.'}
            </div>
          )}

          {trimmedSearch && !searchMatchesExactExisting && (
            <div
              onMouseDown={(e) => {
                e.preventDefault();
                setSearch(trimmedSearch);
                onChange(trimmedSearch);
                setIsOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 cursor-pointer transition flex items-center justify-between font-bold border-t border-cool-gray-800"
            >
              <div className="flex items-center gap-2">
                <PlusCircle size={14} className="text-cyan-400 shrink-0" />
                <span>+ Create New Pallet <span className="font-mono underline">"{trimmedSearch}"</span> {destinationName ? <span className="text-cool-gray-400 font-normal">at {destinationName}</span> : ''}</span>
              </div>
              <span className="text-[10px] bg-cyan-800/60 text-cyan-200 px-1.5 py-0.5 rounded font-normal">New</span>
            </div>
          )}
        </div>
      )}

      {/* Helper Status Info */}
      <div className="mt-1.5 flex flex-col gap-1 text-[11px]">
        {value ? (
          isExisting ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40 w-fit">
              <Check size={11} /> Existing Pallet at {destinationName || 'Destination'}: <span className="font-mono font-bold text-white">{value}</span>
            </span>
          ) : otherLocationName ? (
            <span className="inline-flex items-center gap-1 text-amber-300 font-medium bg-amber-950/50 px-2 py-1 rounded border border-amber-800/50 leading-tight">
              <AlertTriangle size={12} className="shrink-0 text-amber-400" />
              <span>Note: Pallet <strong className="font-mono text-white">"{value}"</strong> is already at <strong>{otherLocationName}</strong>. Importing will assign this new intake batch to <strong>{destinationName || 'this destination'}</strong>.</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-cyan-400 font-medium bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 w-fit">
              <Plus size={11} /> New Pallet will be created at {destinationName || 'Destination'}: <span className="font-mono font-bold text-white">{value}</span>
            </span>
          )
        ) : (
          <span className="text-cool-gray-500">
            {destinationName ? `Select a pallet at ${destinationName} or type to create a new one.` : 'Assigns this pallet destination to all imported cuts.'}
          </span>
        )}
      </div>
    </div>
  );
};


export type ButcherSubTab = 'orders' | 'spreadsheet' | 'import' | 'reports' | 'review';

export const ButcherRecordsView = ({
  state,
  dispatch,
  activeTab: controlledActiveTab,
  setActiveTab: controlledSetActiveTab,
  onReviewQueueCountChange,
  isFilterPanelOpen = false,
  filterPanelContainer = null,
  onActiveFilterCountChange,
  initialReportType = 'yields',
}: {
  state: any;
  dispatch: any;
  activeTab?: ButcherSubTab;
  setActiveTab?: (tab: ButcherSubTab) => void;
  onReviewQueueCountChange?: (count: number) => void;
  isFilterPanelOpen?: boolean;
  filterPanelContainer?: HTMLElement | null;
  onActiveFilterCountChange?: (count: number) => void;
  initialReportType?: ButcherReportTypeId;
}) => {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState<ButcherSubTab>('orders');
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab;
  const setActiveTab = React.useCallback(
    (tab: ButcherSubTab) => {
      if (controlledSetActiveTab) {
        controlledSetActiveTab(tab);
      } else {
        setUncontrolledActiveTab(tab);
      }
    },
    [controlledSetActiveTab]
  );
  const [ordersFilter, setOrdersFilter] = useState<ButcherOrderFilterState>(() => createEmptyButcherOrderFilter());
  const [selectedOrderIdsForReport, setSelectedOrderIdsForReport] = useState<string[]>([]);
  const [spreadsheetSelectionRequest, setSpreadsheetSelectionRequest] = useState<ButcherSpreadsheetOrderSelectionRequest | null>(null);
  const [spreadsheetActiveOrderIds, setSpreadsheetActiveOrderIds] = useState<string[]>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('butcher_spreadsheet_selected_order_ids');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.filter((id): id is string => typeof id === 'string' && id !== 'ALL' && id.trim().length > 0);
          }
        }
      }
    } catch {
      // Ignore storage access issues in SSR or restricted environments
    }
    return [];
  });
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewSpeciesFilter, setReviewSpeciesFilter] = useState<string[]>([]);
  const [reviewTagFilter, setReviewTagFilter] = useState<string[]>([]);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [cutBreakdownSearch, setCutBreakdownSearch] = useState('');
  useEffect(() => {
    setCutBreakdownSearch('');
  }, [expandedOrder]);
  const [editingOrder, setEditingOrder] = useState<ButcherOrder | null>(null);
  const [reviewingOrder, setReviewingOrder] = useState<ButcherOrder | null>(null);
  const [isManualEntryOpen, setIsManualEntryOpen] = useState(false);
  const [manualEntryTargetOrder, setManualEntryTargetOrder] = useState<ButcherOrder | null>(null);
  const [reviewFilterCategory, setReviewFilterCategory] = useState<'all' | OrderReviewIssueCategory | 'closed'>('all');
  const [reportMode, setReportMode] = useState<ButcherReportMode>('actuals');
  const anomalySensitivity = useMemo(() => {
    if (hasButcherAnomalySensitivityConfig(state.appConfig)) {
      return parseButcherAnomalySensitivity(state.appConfig);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = parseFloat(localStorage.getItem('butcher_anomaly_sensitivity') || '');
        if (Number.isFinite(saved)) return clampSensitivity(saved);
      }
    } catch {
      // Ignore storage access errors in SSR or restricted environments
    }
    return DEFAULT_ANOMALY_SENSITIVITY;
  }, [state.appConfig]);
  
  // Report filters (unified schema shared with Logs)
  const [reportFilter, setReportFilter] = useState<ButcherOrderFilterState>(() => createEmptyButcherOrderFilter());
  const [viewOriginalNames, setViewOriginalNames] = useState(false);

  // New Reporting & Graphing states
  const [reportGraphTab, setReportGraphTab] = useState<ButcherReportTypeId>(initialReportType);
  const [reportBreakdownSearch, setReportBreakdownSearch] = useState('');
  const [visibleYieldSeries, setVisibleYieldSeries] = useState({
    dressing: true,
    shrink: true,
    cutting: true,
    takeHome: true,
  });
  const [visibleWeightSeries, setVisibleWeightSeries] = useState({
    live: true,
    hot: true,
    cold: true,
    packaged: true,
  });
  const [selectedCutForTrend, setSelectedCutForTrend] = useState<string | null>(null);
  const [selectedCutsForTrend, setSelectedCutsForTrend] = useState<string[]>([]);
  const [cutTrendMode, setCutTrendMode] = useState<'comparison' | 'additive'>('comparison');
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null);
  const [hoveredWeightPointIdx, setHoveredWeightPointIdx] = useState<number | null>(null);
  const [hoveredCutTrendIdx, setHoveredCutTrendIdx] = useState<number | null>(null);

  useEffect(() => {
    setHoveredPointIdx(null);
    setHoveredWeightPointIdx(null);
    setHoveredCutTrendIdx(null);
  }, [reportMode, reportGraphTab]);

  
  // Form for import
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);
  const [importForm, setImportForm] = useState<{
    orderNumber: string;
    species: string;
    animalCount: string;
    killDate: string;
    pickupDate: string;
    birthDate: string;
    notes: string;
    liveWeight: string;
    hotWeight: string;
    coldWeight: string;
    locationId: string;
    importToOffSite: boolean;
    targetLocationId: string;
    targetPallet: string;
    documents: ButcherOrderDocument[];
    butcherFee: string;
    tagIds: string[];
  }>({
    orderNumber: '',
    species: '',
    animalCount: '',
    killDate: '',
    pickupDate: '',
    birthDate: '',
    notes: '',
    liveWeight: '',
    hotWeight: '',
    coldWeight: '',
    locationId: '',
    importToOffSite: false,
    targetLocationId: '',
    targetPallet: '',
    documents: [],
    butcherFee: '',
    tagIds: []
  });

  // Target order for receiving additional cuts into existing log
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Import mapping wizard states
  const [pendingImport, setPendingImport] = useState<{order: ButcherOrder, records: ButcherRecord[]} | null>(null);
  const [unmappedCuts, setUnmappedCuts] = useState<{ rawCut: string, itemNumber: string, namePart: string }[]>([]);
  const [cutMappings, setCutMappings] = useState<Record<string, string>>({});
  const [createNewProductFor, setCreateNewProductFor] = useState<{ rawCut: string, itemNumber: string, namePart: string } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Cleanly resets uploaded/parsed CSV state and pending mappings to guarantee fresh counts
  const resetImportCutsState = () => {
    setCsvContent(null);
    setParsedRecords([]);
    setPendingImport(null);
    setUnmappedCuts([]);
    setCutMappings({});
    setCreateNewProductFor(null);
    setFileInputKey(prev => prev + 1);
  };

  const handleClearImportForm = () => {
    resetImportCutsState();
    setTargetOrderId(null);
    setImportForm({
      orderNumber: '',
      species: '',
      animalCount: '',
      killDate: '',
      pickupDate: '',
      birthDate: '',
      notes: '',
      liveWeight: '',
      hotWeight: '',
      coldWeight: '',
      locationId: '',
      importToOffSite: false,
      targetLocationId: '',
      targetPallet: '',
      documents: [],
      butcherFee: '',
      tagIds: []
    });
  };

  // Document link input states
  const [newDocTypeId, setNewDocTypeId] = useState<string>('__CUSTOM__');
  const [newDocName, setNewDocName] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [importNewDocTypeId, setImportNewDocTypeId] = useState<string>('__CUSTOM__');
  const [importNewDocName, setImportNewDocName] = useState('');
  const [importNewDocUrl, setImportNewDocUrl] = useState('');
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocTypeId, setEditingDocTypeId] = useState<string>('__CUSTOM__');
  const [editingDocName, setEditingDocName] = useState('');
  const [editingDocUrl, setEditingDocUrl] = useState('');

  const compareOrderNumbersDesc = (a: ButcherOrder, b: ButcherOrder) => {
    const numA = (a.orderNumber || '').trim();
    const numB = (b.orderNumber || '').trim();
    if (numA && numB) {
      const cmp = numB.localeCompare(numA, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    } else if (numB) {
      return 1;
    } else if (numA) {
      return -1;
    }
    const dateA = a.killDate || a.pickupDate || '';
    const dateB = b.killDate || b.pickupDate || '';
    if (dateA || dateB) {
      const dateCmp = dateB.localeCompare(dateA);
      if (dateCmp !== 0) return dateCmp;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  };

  const orders = useMemo(() => {
    return [...(state.butcherOrders || [])].sort(compareOrderNumbersDesc);
  }, [state.butcherOrders]);

  const locations = state.locations || [];
  const products = state.products || [];

  const records = useMemo(() => {
    return (state.butcherRecords || []).map((r: any) => {
      // Find matching product
      const orig = (r.originalCutName || '').trim();
      const norm = (r.normalizedCutName || '').trim();
      
      let matchedProd = null;
      if (norm) {
        matchedProd = products.find(prod => prod.name.trim().toLowerCase() === norm.toLowerCase());
      }

      if (!matchedProd) {
        const getPrefixNumber = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const origNum = getPrefixNumber(orig);
        if (origNum) {
          matchedProd = products.find(prod => 
            prod.productNumbers && prod.productNumbers.some(num => 
              num.toLowerCase() === origNum.toLowerCase()
            )
          );
        }
      }

      if (!matchedProd) {
        const getNamePart = (str: string) => {
          return str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
        };
        const origNamePart = getNamePart(orig);
        const normNamePart = getNamePart(norm);
        matchedProd = products.find(prod => {
          const pName = prod.name.trim().toLowerCase();
          return pName === origNamePart || 
                 pName === normNamePart ||
                 pName === orig.toLowerCase() || 
                 pName === norm.toLowerCase();
        });
      }

      return {
        ...r,
        // Lookup normalizedCutName dynamically in the product catalog!
        normalizedCutName: matchedProd ? matchedProd.name : (r.normalizedCutName || r.originalCutName),
        primaryCategory: matchedProd?.primaryCategory || 'Uncategorized',
        subCategory: matchedProd?.subCategory || 'Uncategorized',
        matchedProduct: matchedProd
      };
    });
  }, [state.butcherRecords, products]);

  const managedSpecies = useMemo(() => parseButcherSpeciesList(state.appConfig), [state.appConfig]);
  const butcherTags = useMemo(() => parseButcherOrderTags(state.appConfig), [state.appConfig]);
  const documentLinkTypes = useMemo(() => parseButcherDocumentLinkTypes(state.appConfig), [state.appConfig]);
  const baselineGroupingMode = useMemo(() => parseButcherBaselineGroupingMode(state.appConfig), [state.appConfig]);
  const locationNameById = useMemo(
    () => new Map(locations.map(l => [l.id, l.name])),
    [locations]
  );

  const recordsByOrderId = useMemo(() => groupRecordsByOrderId(records), [records]);

  const reviewQueueSummary = useMemo(
    () =>
      analyzeOrderReviewQueue(
        orders,
        recordsByOrderId,
        anomalySensitivity,
        butcherTags,
        baselineGroupingMode,
        locationNameById
      ),
    [orders, recordsByOrderId, anomalySensitivity, butcherTags, baselineGroupingMode, locationNameById]
  );

  useEffect(() => {
    onReviewQueueCountChange?.(reviewQueueSummary.counts.totalOrdersNeedingReview);
  }, [reviewQueueSummary.counts.totalOrdersNeedingReview, onReviewQueueCountChange]);

  const existingOrderNumbers = useMemo(() => (Array.from(new Set(orders.map(o => o.orderNumber))).filter(Boolean) as string[]).sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })), [orders]);
  const existingSpecies = useMemo(() => getAllButcherSpeciesOptions(managedSpecies, orders), [managedSpecies, orders]);
  const ordersById = useMemo(() => new Map(orders.map(o => [o.id, o])), [orders]);

  const butcherLocationEntries = useMemo(() => {
    const entries: Array<{ id: string; name: string }> = [];
    const seen = new Set<string>();
    let hasUnassigned = false;
    orders.forEach(o => {
      const locId = (o.locationId || '').trim();
      if (!locId) {
        hasUnassigned = true;
        return;
      }
      if (!seen.has(locId)) {
        seen.add(locId);
        entries.push({ id: locId, name: locationNameById.get(locId) || locId });
      }
    });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    if (hasUnassigned) {
      entries.push({ id: '__unassigned__', name: 'Unassigned Butcher' });
    }
    return entries;
  }, [orders, locationNameById]);

  const butcherLocationOptions = useMemo(
    () => butcherLocationEntries.map(e => e.name),
    [butcherLocationEntries]
  );
  const resolveLocationIdsFromNames = (names: string[]): string[] => {
    const lowerSet = new Set(names.map(n => n.toLowerCase()));
    return butcherLocationEntries
      .filter(e => lowerSet.has(e.name.toLowerCase()))
      .map(e => e.id);
  };
  const resolveLocationNamesFromIds = (ids: string[]): string[] => {
    const idSet = new Set(ids);
    return butcherLocationEntries
      .filter(e => idSet.has(e.id))
      .map(e => e.name);
  };

  const butcherTagOptions = useMemo(() => butcherTags.map(t => t.name), [butcherTags]);
  const resolveTagIdsFromNames = (names: string[]): string[] => {
    const lowerSet = new Set(names.map(n => n.toLowerCase()));
    return butcherTags.filter(t => lowerSet.has(t.name.toLowerCase())).map(t => t.id);
  };
  const resolveTagNamesFromIds = (ids: string[]): string[] => {
    const idSet = new Set(ids);
    return butcherTags.filter(t => idSet.has(t.id)).map(t => t.name);
  };

  // Real-time calculation of order cuts and newly appended cuts when adding more cuts to an existing butcher file
  const targetOrderStats = useMemo(() => {
    if (!targetOrderId) return null;
    const existing = records.filter(r => r.orderId === targetOrderId);
    const existingSerials = new Set(
      existing
        .map(r => (r.serial || '').trim().toLowerCase())
        .filter(Boolean)
    );

    let newCount = 0;
    let updateCount = 0;

    parsedRecords.forEach(r => {
      const serialLower = (r.serial || '').trim().toLowerCase();
      if (serialLower && existingSerials.has(serialLower)) {
        updateCount++;
      } else {
        newCount++;
      }
    });

    const projectedTotal = existing.length + newCount;

    return {
      existingCount: existing.length,
      newCount,
      updateCount,
      projectedTotal,
      csvTotal: parsedRecords.length
    };
  }, [targetOrderId, records, parsedRecords]);
  
  // Active destination location for intake
  const activeTargetLocationId = importForm.targetLocationId || importForm.locationId || '';
  const activeTargetLocation = locations.find(l => l.id === activeTargetLocationId);
  const activeTargetLocationName = activeTargetLocation?.name || '';

  const handleAddManualCutsToImportForm = (cuts: ManualCutItem[]) => {
    const converted = cuts.map(c => ({
      serial: c.serial,
      originalCutName: c.originalCutName,
      packDate: c.packDate,
      lot: c.lot,
      pieces: c.pieces,
      netWeight: c.netWeight,
      box: c.box,
      pallet: importForm.targetPallet || '',
      location: activeTargetLocationName || ''
    }));
    setParsedRecords(prev => [...prev, ...converted]);
    setActiveTab('import');
  };

  // Active pallets scoped strictly to the selected destination, along with a cross-location mapping for conflict prevention
  const { existingActivePalletsForDestination, palletLocationMap } = useMemo(() => {
    const archivedPalletNames = new Set<string>();
    (state.pallets || []).forEach(p => {
      if (p.isArchived) {
        if (p.id) archivedPalletNames.add(p.id.toLowerCase().trim());
        if (p.name) archivedPalletNames.add(p.name.toLowerCase().trim());
      }
    });
    (state.freezers || []).forEach(f => {
      if (f.isArchived) {
        if (f.id) archivedPalletNames.add(f.id.replace(/^pallet-/, '').toLowerCase().trim());
        if (f.name) archivedPalletNames.add(f.name.toLowerCase().trim());
      }
    });

    const palLocMap = new Map<string, string>(); // lowerPalletName -> locationName

    // 1. From state.pallets
    (state.pallets || []).forEach(p => {
      if (!p.isArchived) {
        const name = (p.name || p.id || '').trim();
        if (name && !archivedPalletNames.has(name.toLowerCase())) {
          const loc = locations.find(l => l.id === p.storageLocationId);
          if (loc) {
            palLocMap.set(name.toLowerCase(), loc.name);
          }
        }
      }
    });

    // 2. From active (non-archived) off-site entries
    (state.offSiteEntries || []).forEach(e => {
      const isArchived = e.archived === true || e.archived === 1 || String(e.archived) === 'true';
      if (!isArchived) {
        const pName = (e.pallet || e.currentLocation || '').trim();
        if (pName && !archivedPalletNames.has(pName.toLowerCase())) {
          if (!palLocMap.has(pName.toLowerCase())) {
            const loc = locations.find(l => l.id === e.storageLocationId || (e.location && l.name.toLowerCase() === e.location.toLowerCase()));
            if (loc) {
              palLocMap.set(pName.toLowerCase(), loc.name);
            } else if (e.location) {
              palLocMap.set(pName.toLowerCase(), e.location);
            }
          }
        }
      }
    });

    // 3. From active freezers configured as pallets
    (state.freezers || []).forEach(f => {
      if ((f.isPallet || f.id.startsWith('pallet-')) && !f.isArchived) {
        const name = (f.name || f.id.replace(/^pallet-/, '') || '').trim();
        if (name && !archivedPalletNames.has(name.toLowerCase())) {
          if (!palLocMap.has(name.toLowerCase())) {
            const loc = locations.find(l => l.id === f.storageLocationId || l.isHome);
            if (loc) {
              palLocMap.set(name.toLowerCase(), loc.name);
            }
          }
        }
      }
    });

    const destinationPalletSet = new Set<string>();

    // 1. From state.pallets
    (state.pallets || []).forEach(p => {
      if (!p.isArchived) {
        const name = (p.name || p.id || '').trim();
        if (name && !archivedPalletNames.has(name.toLowerCase())) {
          const matchesLoc = activeTargetLocationId 
            ? (p.storageLocationId === activeTargetLocationId || (!p.storageLocationId && activeTargetLocation?.isHome))
            : true;
          if (matchesLoc) {
            destinationPalletSet.add(name);
          }
        }
      }
    });

    // 2. From active off-site entries
    (state.offSiteEntries || []).forEach(e => {
      const isArchived = e.archived === true || e.archived === 1 || String(e.archived) === 'true';
      if (!isArchived) {
        const pName = (e.pallet || e.currentLocation || '').trim();
        if (pName && !archivedPalletNames.has(pName.toLowerCase())) {
          const matchesLoc = activeTargetLocationId
            ? (
                (e.storageLocationId && e.storageLocationId === activeTargetLocationId) ||
                (e.location && activeTargetLocationName && e.location.trim().toLowerCase() === activeTargetLocationName.trim().toLowerCase()) ||
                (!e.storageLocationId && !e.location && activeTargetLocation?.isHome)
              )
            : true;
          if (matchesLoc) {
            destinationPalletSet.add(pName);
          }
        }
      }
    });

    // 3. From active freezers configured as pallets
    (state.freezers || []).forEach(f => {
      if ((f.isPallet || f.id.startsWith('pallet-')) && !f.isArchived) {
        const name = (f.name || f.id.replace(/^pallet-/, '') || '').trim();
        if (name && !archivedPalletNames.has(name.toLowerCase())) {
          const matchesLoc = activeTargetLocationId
            ? (
                (f.storageLocationId && f.storageLocationId === activeTargetLocationId) ||
                (!f.storageLocationId && activeTargetLocation?.isHome)
              )
            : true;
          if (matchesLoc) {
            destinationPalletSet.add(name);
          }
        }
      }
    });

    const sortedPallets = Array.from(destinationPalletSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return {
      existingActivePalletsForDestination: sortedPallets,
      palletLocationMap: palLocMap
    };
  }, [state.pallets, state.offSiteEntries, state.freezers, locations, activeTargetLocationId, activeTargetLocationName, activeTargetLocation]);
  const existingCutNames = useMemo(() => {
    const s = new Set<string>();
    records.forEach(r => {
      if (viewOriginalNames) {
        if (r.originalCutName) s.add(r.originalCutName);
      } else {
        if (r.normalizedCutName) s.add(r.normalizedCutName);
        else if (r.originalCutName) s.add(r.originalCutName);
      }
    });
    return Array.from(s).sort();
  }, [records, viewOriginalNames]);

  const existingPrimaryCategories = useMemo(() => {
    return Array.from(new Set(records.map(r => r.primaryCategory || 'Uncategorized'))).sort();
  }, [records]);

  const categoryMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    records.forEach(r => {
      const p = r.primaryCategory || 'Uncategorized';
      const s = r.subCategory || 'Uncategorized';
      if (!map[p]) map[p] = new Set();
      map[p].add(s);
    });
    const result: Record<string, string[]> = {};
    for (const p in map) {
      result[p] = Array.from(map[p]).sort();
    }
    return result;
  }, [records]);

  const processCutsheetCsvText = (text: string) => {
    setCsvContent(text);
    
    Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        // Find the header row
        let headerIdx = -1;
        for (let i = 0; i < results.data.length; i++) {
          const row = results.data[i] as string[];
          if (row.length > 3 && row.some(cell => cell.toLowerCase().includes('serial'))) {
            headerIdx = i;
            break;
          }
        }
        
        if (headerIdx === -1) {
          alert("Could not find header row containing 'Serial' in CSV.");
          return;
        }

        const rawData = results.data.slice(headerIdx + 1);
        const headerRow = results.data[headerIdx] as string[];
        const palletColIdx = headerRow ? headerRow.findIndex(c => String(c).toLowerCase().includes('pallet')) : -1;
        const locColIdx = headerRow ? headerRow.findIndex(c => String(c).toLowerCase().includes('location') || String(c).toLowerCase().includes('site')) : -1;
        const newRecords: any[] = [];
        
        for (const row of rawData) {
          const rowData = row as string[];
          if (rowData.length < 7) continue;
          
          // Skip summary lines or empty lines that have no cut name
          if (!rowData[1] || rowData[1].trim() === '') {
            continue;
          }

          const rowPallet = palletColIdx !== -1 ? (rowData[palletColIdx] || '') : (rowData[7] || '');
          const rowLoc = locColIdx !== -1 ? (rowData[locColIdx] || '') : '';

          // Serial,Cut,Pack Date,Lot,# Pieces,Net Weight,Box,[Pallet],[Location]
          newRecords.push({
            serial: rowData[0] || '',
            originalCutName: rowData[1] || '',
            packDate: rowData[2] || '',
            lot: rowData[3] || '',
            pieces: parseInt(rowData[4] || '0', 10) || 0,
            netWeight: parseFloat(rowData[5] || '0') || 0,
            box: rowData[6] || '',
            pallet: rowPallet ? String(rowPallet).trim() : '',
            location: rowLoc ? String(rowLoc).trim() : ''
          });
        }
        setParsedRecords(newRecords);
        
        // Try to guess order number from the top rows only if not appending to an existing log
        let guessedOrderNumber = '';
        for (let i = 0; i < headerIdx; i++) {
          const r = results.data[i] as string[];
          for (const cell of r) {
            if (cell && !isNaN(Number(cell.trim()))) {
              guessedOrderNumber = cell.trim();
            }
          }
        }
        if (guessedOrderNumber && !importForm.orderNumber && !targetOrderId) {
          setImportForm(prev => ({ ...prev, orderNumber: guessedOrderNumber }));
        }
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input value so selecting the exact same file immediately works again
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      processCutsheetCsvText(text);
    };
    reader.readAsText(file);
  };

  const handleStartReceiveMoreCuts = (order: ButcherOrder) => {
    resetImportCutsState();
    setTargetOrderId(order.id);
    setImportForm({
      orderNumber: order.orderNumber || '',
      species: order.species || '',
      animalCount: order.animalCount ? String(order.animalCount) : '',
      killDate: order.killDate || '',
      pickupDate: order.pickupDate || '',
      birthDate: order.birthDate || '',
      notes: order.notes || '',
      liveWeight: order.liveWeight ? String(order.liveWeight) : '',
      hotWeight: order.hotWeight ? String(order.hotWeight) : '',
      coldWeight: order.coldWeight ? String(order.coldWeight) : '',
      locationId: order.locationId || '',
      importToOffSite: true,
      targetLocationId: order.locationId || '',
      targetPallet: '',
      documents: order.documents || [],
      butcherFee: order.butcherFee ? String(order.butcherFee) : '',
      tagIds: Array.isArray(order.tagIds) ? [...order.tagIds] : []
    });
    setActiveTab('import');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateTempOrderNumber = () => {
    const today = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    return `TEMP-${today}-${rand}`;
  };

  const handleImportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importForm.species || !importForm.species.trim()) {
      alert("Species is required to start a butcher order.");
      return;
    }

    if (targetOrderId && !parsedRecords.length) {
      alert("Please upload a CSV cutsheet file to receive additional cuts into an existing order.");
      return;
    }

    // Require pallet selection when butcher import is being added to off-site inventory
    if (importForm.importToOffSite && (parsedRecords.length > 0 || targetOrderId) && !importForm.targetPallet?.trim()) {
      alert("A destination pallet selection is required when importing cuts into off-site inventory. Please select an existing active pallet or enter a new pallet name.");
      return;
    }
    
    const existingTargetOrder = targetOrderId ? orders.find(o => o.id === targetOrderId) : null;
    const orderId = targetOrderId || crypto.randomUUID();
    const finalOrderNumber = (importForm.orderNumber || '').trim() || (existingTargetOrder ? existingTargetOrder.orderNumber : generateTempOrderNumber());

    const newOrder: ButcherOrder = {
      id: orderId,
      orderNumber: finalOrderNumber,
      species: importForm.species.trim(),
      animalCount: importForm.animalCount ? parseInt(importForm.animalCount) : undefined,
      killDate: importForm.killDate || '',
      pickupDate: importForm.pickupDate || '',
      birthDate: importForm.birthDate || '',
      notes: importForm.notes || '',
      liveWeight: parseFloat(importForm.liveWeight) || 0,
      hotWeight: parseFloat(importForm.hotWeight) || 0,
      coldWeight: parseFloat(importForm.coldWeight) || 0,
      locationId: importForm.locationId || undefined,
      createdAt: existingTargetOrder ? existingTargetOrder.createdAt : Date.now(),
      documents: importForm.documents || [],
      butcherFee: parseFloat(importForm.butcherFee) || 0,
      tagIds: importForm.tagIds || []
    };

    // If starting order without CSV (e.g. at animal drop-off)
    if (!parsedRecords.length) {
      executeImportFinal(newOrder, []);
      return;
    }
    
    const unmappedList: { rawCut: string, itemNumber: string, namePart: string }[] = [];
    const seenUnmapped = new Set<string>();

    const newRecords: ButcherRecord[] = parsedRecords.map(r => {
      // Find matching product
      let normalizedCutName = '';
      const originalCutsStr = r.originalCutName.trim();
      let itemNumber = '';
      let namePart = originalCutsStr;
      
      const numMatch = originalCutsStr.match(/^(\d+[a-zA-Z0-9-]*)\s+(.+)$/);
      if (numMatch) {
        itemNumber = numMatch[1];
        namePart = numMatch[2];
      }
      
      const matchedProduct = products.find(p => 
        (itemNumber && p.productNumbers?.includes(itemNumber)) ||
        p.name.toLowerCase() === namePart.toLowerCase() ||
        p.name.toLowerCase() === originalCutsStr.toLowerCase()
      );
      
      if (matchedProduct) {
        normalizedCutName = matchedProduct.name;
      } else {
        normalizedCutName = namePart;
        if (!seenUnmapped.has(originalCutsStr)) {
          seenUnmapped.add(originalCutsStr);
          unmappedList.push({ rawCut: originalCutsStr, itemNumber, namePart });
        }
      }
      
      const targetLocName = importForm.targetLocationId ? (locations.find(l => l.id === importForm.targetLocationId)?.name || '') : '';
      const defaultTags = matchedProduct?.defaultTagIds || [];

      return {
        id: crypto.randomUUID(),
        orderId,
        serial: r.serial,
        productId: matchedProduct ? matchedProduct.id : undefined,
        originalCutName: r.originalCutName,
        normalizedCutName,
        packDate: r.packDate,
        lot: r.lot,
        pieces: r.pieces,
        netWeight: r.netWeight,
        box: finalOrderNumber 
          ? (String(r.box || '').startsWith(`${finalOrderNumber}-`) ? String(r.box || '') : `${finalOrderNumber}-${r.box || ''}`)
          : (r.box || ''),
        importedToOffSite: importForm.importToOffSite,
        pallet: r.pallet || importForm.targetPallet || '',
        location: r.location || targetLocName || '',
        tagIds: (r.tagIds && r.tagIds.length > 0) ? r.tagIds : [...defaultTags]
      };
    });

    if (unmappedList.length > 0) {
      setPendingImport({ order: newOrder, records: newRecords });
      setUnmappedCuts(unmappedList);
      setCutMappings({});
    } else {
      executeImportFinal(newOrder, newRecords);
    }
  };

  const executeImportFinal = (order: ButcherOrder, records: ButcherRecord[]) => {
    const selectedTargetLoc = importForm.targetLocationId ? locations.find(l => l.id === importForm.targetLocationId) : null;
    const targetLocName = selectedTargetLoc ? selectedTargetLoc.name : undefined;

    dispatch({
      type: 'ADD_BUTCHER_ORDER',
      payload: { 
        order, 
        records,
        targetLocation: targetLocName || order.locationId,
        targetPallet: importForm.targetPallet?.trim() || undefined
      }
    });

    // Reset all import and parsed state
    resetImportCutsState();
    setTargetOrderId(null);
    setImportForm({
      orderNumber: '',
      species: '',
      animalCount: '',
      killDate: '',
      pickupDate: '',
      birthDate: '',
      notes: '',
      liveWeight: '',
      hotWeight: '',
      coldWeight: '',
      locationId: '',
      importToOffSite: false,
      targetLocationId: '',
      targetPallet: '',
      documents: [],
      butcherFee: '',
      tagIds: []
    });
    setActiveTab('orders');
  };

  const finalizeImportMapping = async () => {
    if (!pendingImport) return;
    
    let finalRecords = [...pendingImport.records];
    
    for (const uncut of unmappedCuts) {
      const selection = cutMappings[uncut.rawCut];
      if (selection) {
        const existingProduct = products.find(p => p.id === selection);
        if (existingProduct) {
          if (uncut.itemNumber && !existingProduct.productNumbers?.includes(uncut.itemNumber)) {
            const newNumbers = [...(existingProduct.productNumbers || []), uncut.itemNumber];
            await dispatch({ type: 'EDIT_PRODUCT', payload: { productId: existingProduct.id, updates: { productNumbers: newNumbers } } });
          }
          finalRecords = finalRecords.map(r => r.originalCutName.trim() === uncut.rawCut ? { 
            ...r, 
            normalizedCutName: existingProduct.name, 
            productId: existingProduct.id,
            tagIds: (r.tagIds && r.tagIds.length > 0) ? r.tagIds : [...(existingProduct.defaultTagIds || [])]
          } : r);
        }
      }
    }
    
    executeImportFinal(pendingImport.order, finalRecords);
    setPendingImport(null);
    setUnmappedCuts([]);
    setCutMappings({});
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter(o =>
        matchesButcherOrderFilters(o, recordsByOrderId.get(o.id) || [], ordersFilter, {
          tags: butcherTags,
          locationName: locationNameById.get((o.locationId || '').trim()) || '',
          viewOriginalNames,
        })
      )
      .sort(compareOrderNumbersDesc);
  }, [orders, recordsByOrderId, ordersFilter, butcherTags, locationNameById, viewOriginalNames]);

  const validSelectedOrderIdSet = useMemo(() => {
    const orderIdSet = new Set(orders.map(o => o.id));
    return new Set(selectedOrderIdsForReport.filter(id => orderIdSet.has(id)));
  }, [orders, selectedOrderIdsForReport]);

  const toggleOrderSelectionForReport = (orderId: string) => {
    setSelectedOrderIdsForReport(prev =>
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAllFilteredOrders = () => {
    const filteredIds = filteredOrders.map(o => o.id);
    if (filteredIds.length === 0) return;
    const allSelected = filteredIds.every(id => validSelectedOrderIdSet.has(id));
    if (allSelected) {
      const filteredSet = new Set(filteredIds);
      setSelectedOrderIdsForReport(prev => prev.filter(id => !filteredSet.has(id)));
    } else {
      setSelectedOrderIdsForReport(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const handleSendOrdersToReports = (orderIds: string[], mode: 'replace' | 'append' = 'replace') => {
    const idSet = new Set(orderIds);
    const chosenOrderNumbers = orders
      .filter(o => idSet.has(o.id))
      .map(o => o.orderNumber)
      .filter(Boolean);
    if (chosenOrderNumbers.length === 0) return;
    if (mode === 'append') {
      setReportFilter(prev => ({
        ...prev,
        orderNumber: mergeOrderNumbersForReportFilter(prev.orderNumber, chosenOrderNumbers, 'append'),
      }));
    } else {
      setReportFilter(
        createEmptyButcherOrderFilter({
          orderNumber: mergeOrderNumbersForReportFilter([], chosenOrderNumbers, 'replace'),
        })
      );
    }
    setSelectedOrderIdsForReport([]);
    setActiveTab('reports');
  };

  const validSpreadsheetActiveOrderIds = useMemo(() => {
    const orderIdSet = new Set(orders.map(o => o.id));
    return spreadsheetActiveOrderIds.filter(id => orderIdSet.has(id));
  }, [orders, spreadsheetActiveOrderIds]);

  const handleSendOrdersToSpreadsheet = (orderIds: string[], mode: 'replace' | 'append' = 'replace') => {
    const orderIdSet = new Set(orders.map(o => o.id));
    const chosenIds = orderIds.filter(id => orderIdSet.has(id));
    if (chosenIds.length === 0) return;

    const mergedIds = mergeOrderIdsForSpreadsheetFilter(
      validSpreadsheetActiveOrderIds,
      chosenIds,
      mode,
    );
    if (mergedIds.length === 0) return;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('butcher_spreadsheet_selected_order_ids', JSON.stringify(mergedIds));
        localStorage.setItem('butcher_spreadsheet_filter_order_numbers', JSON.stringify([]));
      }
    } catch {
      // Ignore storage write issues in restricted environments
    }

    setSpreadsheetActiveOrderIds(mergedIds);
    setSpreadsheetSelectionRequest(prev => ({
      orderIds: mergedIds,
      mode: 'replace',
      requestId: (prev?.requestId || 0) + 1,
    }));
    setSelectedOrderIdsForReport([]);
    setActiveTab('spreadsheet');
  };

  const getOrderStats = (orderId: string) => {
    const matchingRecords = records.filter(r => r.orderId === orderId);
    let totalPieces = 0;
    let totalWeight = 0;
    matchingRecords.forEach(r => {
      totalPieces += r.pieces;
      totalWeight += r.netWeight;
    });
    return { count: matchingRecords.length, totalPieces, totalWeight };
  };

  const getCutBreakdown = (orderId: string) => {
    const matchingRecords = records.filter(r => r.orderId === orderId);
    const breakdown: Record<string, { count: number, totalPieces: number, totalWeight: number }> = {};
    
    matchingRecords.forEach(r => {
      const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
      if (!breakdown[name]) {
        breakdown[name] = { count: 0, totalPieces: 0, totalWeight: 0 };
      }
      breakdown[name].count += 1;
      breakdown[name].totalPieces += r.pieces;
      breakdown[name].totalWeight += r.netWeight;
    });
    
    return Object.entries(breakdown)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.totalWeight - a.totalWeight);
  };

  const aggregateStats = useMemo(() => {
    let totalOrders = filteredOrders.length;
    let totalPieces = 0;
    let totalWeight = 0;
    
    filteredOrders.forEach(o => {
      const stats = getOrderStats(o.id);
      totalPieces += stats.totalPieces;
      totalWeight += stats.totalWeight;
    });
    
    return { totalOrders, totalPieces, totalWeight };
  }, [filteredOrders, records]);

  const reportData: {
    orderCount: number;
    animalCount: number;
    recordCount: number;
    totalPieces: number;
    totalWeight: number;
    breakdown: Array<{
      name: string;
      count: number;
      totalPieces: number;
      totalWeight: number;
      productId?: string;
    }>;
  } = useMemo(() => {
    // Filter orders using unified filter engine
    let matchedOrders = orders.filter(o =>
      matchesButcherOrderFilters(o, recordsByOrderId.get(o.id) || [], reportFilter, {
        tags: butcherTags,
        locationName: locationNameById.get((o.locationId || '').trim()) || '',
        viewOriginalNames,
      })
    );
    
    if (reportMode === 'exclude_flagged') {
      matchedOrders = matchedOrders.filter(o => {
        const flags = o.weightAnomalies || {};
        return !(Object.keys(flags) as ButcherWeightField[]).some(f => flags[f]?.status === 'flagged');
      });
    }
    
    const matchedOrderIds = new Set(matchedOrders.map(o => o.id));
    
    // Filter records
    const matchedRecords = records.filter(
      r => matchedOrderIds.has(r.orderId) && matchesButcherRecordFilter(r, reportFilter, viewOriginalNames)
    );

    // Aggregate
    const breakdown: Record<string, { count: number; totalPieces: number; totalWeight: number; productId?: string }> = {};
    let grandTotalPieces = 0;
    let grandTotalWeight = 0;
    
    matchedRecords.forEach(r => {
      const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
      if (!breakdown[name]) {
        breakdown[name] = { count: 0, totalPieces: 0, totalWeight: 0, productId: r.productId };
      } else if (!breakdown[name].productId && r.productId) {
        breakdown[name].productId = r.productId;
      }
      breakdown[name].count += 1;
      breakdown[name].totalPieces += r.pieces;
      breakdown[name].totalWeight += r.netWeight;
      
      grandTotalPieces += r.pieces;
      grandTotalWeight += r.netWeight;
    });
    
    const sortedBreakdown: Array<{
      name: string;
      count: number;
      totalPieces: number;
      totalWeight: number;
      productId?: string;
    }> = Object.keys(breakdown)
      .map(name => ({ name, ...breakdown[name] }))
      .sort((a, b) => b.totalWeight - a.totalWeight);
      
    const totalAnimals = matchedOrders.reduce((sum, o) => sum + Math.max(1, o.animalCount || 1), 0);
      
    return {
      orderCount: matchedOrders.length,
      animalCount: totalAnimals,
      recordCount: matchedRecords.length,
      totalPieces: grandTotalPieces,
      totalWeight: grandTotalWeight,
      breakdown: sortedBreakdown
    };
  }, [orders, records, recordsByOrderId, reportFilter, reportMode, viewOriginalNames, butcherTags, locationNameById]);

  const ordersActiveFilterCount = useMemo(
    () => countActiveButcherFilters(ordersFilter),
    [ordersFilter]
  );

  const reportsActiveFilterCount = useMemo(
    () => countActiveButcherFilters(reportFilter) + (reportMode !== 'actuals' ? 1 : 0),
    [reportFilter, reportMode]
  );

  const reviewActiveFilterCount = useMemo(
    () =>
      (reviewSearch.trim() ? 1 : 0) +
      reviewSpeciesFilter.length +
      reviewTagFilter.length +
      (reviewFilterCategory !== 'all' ? 1 : 0),
    [reviewSearch, reviewSpeciesFilter.length, reviewTagFilter.length, reviewFilterCategory]
  );

  useEffect(() => {
    if (!onActiveFilterCountChange || activeTab === 'spreadsheet') return;
    if (activeTab === 'orders') {
      onActiveFilterCountChange(ordersActiveFilterCount);
    } else if (activeTab === 'reports') {
      onActiveFilterCountChange(reportsActiveFilterCount);
    } else if (activeTab === 'review') {
      onActiveFilterCountChange(reviewActiveFilterCount);
    } else {
      onActiveFilterCountChange(0);
    }
  }, [
    activeTab,
    ordersActiveFilterCount,
    reportsActiveFilterCount,
    reviewActiveFilterCount,
    onActiveFilterCountChange,
  ]);

  const matchesReviewFilters = (order: ButcherOrder): boolean => {
    if (reviewSearch.trim()) {
      const locName = locationNameById.get((order.locationId || '').trim()) || '';
      if (!matchesButcherOrderSearch(order, reviewSearch, butcherTags, locName)) return false;
    }
    if (reviewSpeciesFilter.length > 0) {
      const lowerSpecies = new Set(reviewSpeciesFilter.map(s => s.toLowerCase()));
      if (!lowerSpecies.has((order.species || '').toLowerCase())) return false;
    }
    if (reviewTagFilter.length > 0) {
      if (!(order.tagIds || []).some(tid => reviewTagFilter.includes(tid))) return false;
    }
    return true;
  };

  const resetReviewFilters = () => {
    setReviewSearch('');
    setReviewSpeciesFilter([]);
    setReviewTagFilter([]);
    setReviewFilterCategory('all');
  };

  const reviewCategoryLabels: Record<'all' | OrderReviewIssueCategory | 'closed', string> = {
    all: 'All Items',
    anomaly: 'Yield Anomalies',
    missing_weights: 'Missing Weights',
    missing_fee: 'Missing Butcher Fee',
    missing_cuts: 'Pending Cuts',
    missing_metadata: 'Incomplete Metadata',
    closed: 'Closed Audits',
  };

  const renderUnifiedFilterPanel = (
    panelId: 'butcher-orders-filter-panel' | 'butcher-reports-filter-panel',
    filter: ButcherOrderFilterState,
    setFilter: React.Dispatch<React.SetStateAction<ButcherOrderFilterState>>,
    activeCount: number,
    showCopyToReportsAction: boolean,
    includeReportingBasis: boolean = false,
  ) => {
    const applyPreset = (preset: ButcherDateRangePreset) => {
      const { startDate, endDate } = computeDateRangePreset(preset);
      setFilter(prev => ({ ...prev, startDate, endDate }));
    };

    const handleResetAll = () => {
      setFilter(createEmptyButcherOrderFilter());
      if (includeReportingBasis) {
        setReportMode('actuals');
      }
    };

    return (
      <div
        id={panelId}
        className="mt-3 p-3 sm:p-4 bg-cool-gray-900/95 border border-cool-gray-750/90 rounded-xl shadow-xl shadow-black/30 backdrop-blur-md animate-fade-in text-xs space-y-3"
      >
        {/* Row 1: Search & Reset */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={14} className="text-cool-gray-400" />
            </div>
            <input
              type="text"
              data-testid={`${panelId}-search`}
              placeholder="Search orders, species, butcher, tags, notes, or flag notes..."
              className="block w-full rounded-lg border-0 bg-cool-gray-850 pl-9 pr-8 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-750 placeholder:text-cool-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 py-1.5 text-xs transition"
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
            />
            {filter.search && (
              <button
                type="button"
                onClick={() => setFilter(prev => ({ ...prev, search: '' }))}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-cool-gray-400 hover:text-white cursor-pointer"
                title="Clear search input"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleResetAll}
              className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-red-400 border border-cool-gray-700 transition flex items-center gap-1 font-bold text-xs cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Reports-only: Reporting Data Basis control inside Filters */}
        {includeReportingBasis && (
          <div
            data-testid="butcher-reports-basis-control"
            className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 p-2.5 rounded-xl bg-cool-gray-850/90 border border-cool-gray-750"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 shrink-0">
                Reporting Basis
              </span>
              <div
                id="butcher-report-mode-switcher"
                className="inline-flex bg-cool-gray-950 p-0.5 rounded-lg border border-cool-gray-700 flex-wrap gap-0.5 self-start"
              >
                {[
                  { id: 'actuals' as const, label: 'Actuals' },
                  { id: 'estimates' as const, label: 'Corrected Estimates' },
                  { id: 'exclude_flagged' as const, label: 'Exclude Flagged' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setReportMode(opt.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                      reportMode === opt.id
                        ? 'bg-cyan-600 text-white shadow'
                        : 'text-cool-gray-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-cool-gray-400">
                {reportMode === 'actuals' && 'Raw butcher-reported weights.'}
                {reportMode === 'estimates' && 'Applies corrected estimates on flagged orders.'}
                {reportMode === 'exclude_flagged' && 'Excludes orders flagged with weight anomalies.'}
              </span>
            </div>
            {reviewQueueSummary.counts.anomaly > 0 && (
              <button
                type="button"
                onClick={() => {
                  setReviewFilterCategory('anomaly');
                  setActiveTab('review');
                }}
                className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0 self-start lg:self-center"
              >
                <AlertTriangle size={12} />
                <span>Review {reviewQueueSummary.counts.anomaly} Flagged</span>
              </button>
            )}
          </div>
        )}

        {/* Row 2: Date Range (Before / After Dates + Date Field + Quick Presets) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
              Date Type
            </label>
            <select
              data-testid={`${panelId}-date-field`}
              value={filter.dateField}
              onChange={(e) =>
                setFilter(prev => ({ ...prev, dateField: e.target.value as ButcherDateFilterField }))
              }
              className="w-full bg-cool-gray-850 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-2 focus:ring-cyan-500 outline-none cursor-pointer"
            >
              {(Object.keys(BUTCHER_DATE_FILTER_FIELD_LABELS) as ButcherDateFilterField[]).map(fieldKey => (
                <option key={fieldKey} value={fieldKey}>
                  {BUTCHER_DATE_FILTER_FIELD_LABELS[fieldKey]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
              On / After Date
            </label>
            <input
              type="date"
              data-testid={`${panelId}-start-date`}
              className="w-full bg-cool-gray-850 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-2 focus:ring-cyan-500 outline-none"
              value={filter.startDate}
              onChange={(e) => setFilter(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">
              On / Before Date
            </label>
            <input
              type="date"
              data-testid={`${panelId}-end-date`}
              className="w-full bg-cool-gray-850 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:ring-2 focus:ring-cyan-500 outline-none"
              value={filter.endDate}
              onChange={(e) => setFilter(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { key: '30d' as const, label: '30d' },
              { key: '90d' as const, label: '90d' },
              { key: '12m' as const, label: '12m' },
              { key: 'ytd' as const, label: 'YTD' },
            ]).map(preset => (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset.key)}
                className="px-2 py-1.5 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-cyan-300 border border-cool-gray-700 font-bold text-[11px] transition cursor-pointer"
                title={`Set range to ${preset.label}`}
              >
                {preset.label}
              </button>
            ))}
            {(filter.startDate || filter.endDate) && (
              <button
                type="button"
                onClick={() => setFilter(prev => ({ ...prev, startDate: '', endDate: '' }))}
                className="px-2 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-red-400 border border-cool-gray-700 font-bold text-[11px] transition cursor-pointer"
                title="Clear date range"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Row 3: Shared Order, Species, Butcher, Tags, Cuts, and Category Multi-Selects */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">Order Number</label>
            <MultiSelectDropdown
              options={existingOrderNumbers}
              selected={filter.orderNumber}
              onChange={(selected) => setFilter(prev => ({ ...prev, orderNumber: selected }))}
              placeholder="All Orders"
              compact
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">Species</label>
            <MultiSelectDropdown
              options={existingSpecies}
              selected={filter.species}
              onChange={(selected) => setFilter(prev => ({ ...prev, species: selected }))}
              placeholder="All Species"
              compact
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">Butcher / Processor</label>
            <MultiSelectDropdown
              options={butcherLocationOptions}
              selected={resolveLocationNamesFromIds(filter.locationIds)}
              onChange={(names) => setFilter(prev => ({ ...prev, locationIds: resolveLocationIdsFromNames(names) }))}
              placeholder="All Butchers"
              compact
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">Order Tags</label>
            <MultiSelectDropdown
              options={butcherTagOptions}
              selected={resolveTagNamesFromIds(filter.tagIds)}
              onChange={(names) => setFilter(prev => ({ ...prev, tagIds: resolveTagIdsFromNames(names) }))}
              placeholder="All Order Tags"
              compact
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">Cut Name</label>
            <MultiSelectDropdown
              options={existingCutNames}
              selected={filter.cutName}
              onChange={(selected) => setFilter(prev => ({ ...prev, cutName: selected }))}
              placeholder="All Cuts"
              compact
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 mb-1">Categories</label>
            <NestedCategoryMultiSelect
              primaryOptions={existingPrimaryCategories}
              subOptions={categoryMap}
              selectedPrimary={filter.primaryCategory}
              selectedSub={filter.subCategory}
              onChange={(primary, sub) => setFilter(prev => ({ ...prev, primaryCategory: primary, subCategory: sub }))}
              placeholder="All Categories"
              compact
            />
          </div>
        </div>

        {/* Footer: Raw CSV Toggle & Quick Sync */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-cool-gray-800">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-cool-gray-300 hover:text-white cursor-pointer select-none bg-cool-gray-850 border border-cool-gray-700 hover:border-cool-gray-600 px-3 py-1.5 rounded-lg transition">
            <input
              type="checkbox"
              className="rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-3.5 h-3.5 shrink-0"
              checked={viewOriginalNames}
              onChange={(e) => {
                setViewOriginalNames(e.target.checked);
                setOrdersFilter(prev => ({ ...prev, cutName: [] }));
                setReportFilter(prev => ({ ...prev, cutName: [] }));
              }}
            />
            <span>Raw CSV Item Names</span>
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {showCopyToReportsAction && activeCount > 0 && (
              <button
                type="button"
                data-testid="butcher-copy-filters-to-reports-btn"
                onClick={() => {
                  setReportFilter({ ...filter });
                  setActiveTab('reports');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 transition flex items-center gap-1.5 font-bold text-xs cursor-pointer"
                title="Apply these exact Logs filters to the Reports page"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Open Filtered View in Reports</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderActiveFilterSummaryBar = (
    testId: string,
    filter: ButcherOrderFilterState,
    setFilter: React.Dispatch<React.SetStateAction<ButcherOrderFilterState>>,
    activeCount: number,
    basisOptions?: {
      mode: ButcherReportMode;
      onResetMode: () => void;
      excludedCount?: number;
    },
  ) => {
    if (activeCount === 0) return null;

    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (basisOptions && basisOptions.mode !== 'actuals') {
      const basisLabel =
        basisOptions.mode === 'estimates'
          ? 'Basis: Corrected Estimates'
          : basisOptions.excludedCount && basisOptions.excludedCount > 0
            ? `Basis: Exclude Flagged (${basisOptions.excludedCount} excluded)`
            : 'Basis: Exclude Flagged';
      chips.push({
        key: 'report-basis',
        label: basisLabel,
        onRemove: basisOptions.onResetMode,
      });
    }
    if (filter.search.trim()) {
      chips.push({
        key: 'search',
        label: `Search: "${filter.search.trim()}"`,
        onRemove: () => setFilter(prev => ({ ...prev, search: '' })),
      });
    }
    if (filter.startDate || filter.endDate) {
      const fieldPrefix = filter.dateField !== 'any' ? `${BUTCHER_DATE_FILTER_FIELD_LABELS[filter.dateField]}: ` : '';
      if (filter.startDate && filter.endDate) {
        chips.push({
          key: 'date-range',
          label: `${fieldPrefix}${filter.startDate} → ${filter.endDate}`,
          onRemove: () => setFilter(prev => ({ ...prev, startDate: '', endDate: '' })),
        });
      } else if (filter.startDate) {
        chips.push({
          key: 'date-start',
          label: `${fieldPrefix}After ${filter.startDate}`,
          onRemove: () => setFilter(prev => ({ ...prev, startDate: '' })),
        });
      } else if (filter.endDate) {
        chips.push({
          key: 'date-end',
          label: `${fieldPrefix}Before ${filter.endDate}`,
          onRemove: () => setFilter(prev => ({ ...prev, endDate: '' })),
        });
      }
    }
    for (const num of filter.orderNumber) {
      chips.push({
        key: `order-${num}`,
        label: `Order #${num}`,
        onRemove: () => setFilter(prev => ({ ...prev, orderNumber: prev.orderNumber.filter(v => v !== num) })),
      });
    }
    for (const sp of filter.species) {
      chips.push({
        key: `species-${sp}`,
        label: `Species: ${sp}`,
        onRemove: () => setFilter(prev => ({ ...prev, species: prev.species.filter(v => v !== sp) })),
      });
    }
    for (const locId of filter.locationIds) {
      const locLabel = locId === '__unassigned__' ? 'Unassigned Butcher' : (locationNameById.get(locId) || locId);
      chips.push({
        key: `loc-${locId}`,
        label: `Butcher: ${locLabel}`,
        onRemove: () => setFilter(prev => ({ ...prev, locationIds: prev.locationIds.filter(v => v !== locId) })),
      });
    }
    for (const tid of filter.tagIds) {
      const tagLabel = butcherTags.find(t => t.id === tid)?.name || tid;
      chips.push({
        key: `tag-${tid}`,
        label: `Tag: ${tagLabel}`,
        onRemove: () => setFilter(prev => ({ ...prev, tagIds: prev.tagIds.filter(v => v !== tid) })),
      });
    }
    for (const cut of filter.cutName) {
      chips.push({
        key: `cut-${cut}`,
        label: `Cut: ${cut}`,
        onRemove: () => setFilter(prev => ({ ...prev, cutName: prev.cutName.filter(v => v !== cut) })),
      });
    }
    for (const cat of filter.primaryCategory) {
      chips.push({
        key: `pcat-${cat}`,
        label: `Category: ${cat}`,
        onRemove: () => setFilter(prev => ({ ...prev, primaryCategory: prev.primaryCategory.filter(v => v !== cat) })),
      });
    }
    for (const sub of filter.subCategory) {
      chips.push({
        key: `scat-${sub}`,
        label: `Sub-Category: ${sub}`,
        onRemove: () => setFilter(prev => ({ ...prev, subCategory: prev.subCategory.filter(v => v !== sub) })),
      });
    }

    return (
      <div
        data-testid={testId}
        className="butcher-surface-card rounded-xl px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
      >
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-cool-gray-400 mr-1">
            Active Filters:
          </span>
          {chips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 font-semibold text-[11px]"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Remove filter ${chip.label}`}
                className="text-cyan-300/80 hover:text-white cursor-pointer"
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setFilter(createEmptyButcherOrderFilter());
            basisOptions?.onResetMode();
          }}
          className="text-[11px] font-bold text-cool-gray-400 hover:text-red-400 inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <RotateCcw size={11} />
          <span>Clear all</span>
        </button>
      </div>
    );
  };

  const activeTabFilterDrawer = isFilterPanelOpen ? (
    activeTab === 'orders' ? (
      renderUnifiedFilterPanel(
        'butcher-orders-filter-panel',
        ordersFilter,
        setOrdersFilter,
        ordersActiveFilterCount,
        true
      )
    ) : activeTab === 'review' ? (
      <div
        id="butcher-review-filter-panel"
        className="mt-3 p-3 sm:p-4 bg-cool-gray-900/95 border border-cool-gray-750/90 rounded-xl shadow-xl shadow-black/30 backdrop-blur-md animate-fade-in text-xs space-y-3"
      >
        <div className="flex flex-col md:flex-row md:items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search size={14} className="text-cool-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search review orders, species, butcher, tags, or notes..."
              className="block w-full rounded-lg border-0 bg-cool-gray-850 pl-9 pr-8 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-750 placeholder:text-cool-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 py-1.5 text-xs transition"
              value={reviewSearch}
              onChange={(e) => setReviewSearch(e.target.value)}
            />
            {reviewSearch && (
              <button
                type="button"
                onClick={() => setReviewSearch('')}
                className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-cool-gray-400 hover:text-white cursor-pointer"
                title="Clear search input"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {existingSpecies.length > 0 && (
            <div className="w-full md:w-44">
              <MultiSelectDropdown
                options={existingSpecies}
                selected={reviewSpeciesFilter}
                onChange={setReviewSpeciesFilter}
                placeholder="All Species"
                compact
              />
            </div>
          )}
          {butcherTags.length > 0 && (
            <div className="w-full md:w-44">
              <MultiSelectDropdown
                options={butcherTagOptions}
                selected={resolveTagNamesFromIds(reviewTagFilter)}
                onChange={(names) => setReviewTagFilter(resolveTagIdsFromNames(names))}
                placeholder="All Order Tags"
                compact
              />
            </div>
          )}
          {reviewActiveFilterCount > 0 && (
            <button
              type="button"
              onClick={resetReviewFilters}
              className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-red-400 border border-cool-gray-700 transition flex items-center gap-1 font-bold text-xs cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Review Category Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {[
            { key: 'all' as const, label: 'All Items', count: reviewQueueSummary.counts.totalOrdersNeedingReview },
            { key: 'anomaly' as const, label: 'Yield Anomalies', count: reviewQueueSummary.counts.anomaly },
            { key: 'missing_weights' as const, label: 'Missing Weights', count: reviewQueueSummary.counts.missing_weights },
            { key: 'missing_fee' as const, label: 'Missing Butcher Fee', count: reviewQueueSummary.counts.missing_fee },
            { key: 'missing_cuts' as const, label: 'Pending Cuts', count: reviewQueueSummary.counts.missing_cuts },
            { key: 'missing_metadata' as const, label: 'Incomplete Metadata', count: reviewQueueSummary.counts.missing_metadata },
          ].map((cat) => (
            <button
              key={cat.key}
              type="button"
              onClick={() => setReviewFilterCategory(cat.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
                reviewFilterCategory === cat.key
                  ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                  : 'bg-cool-gray-850 text-cool-gray-300 border-cool-gray-700 hover:text-white'
              }`}
            >
              <span>{cat.label}</span>
              <span className="font-mono tabular-nums opacity-80">{cat.count}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReviewFilterCategory('closed')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
              reviewFilterCategory === 'closed'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                : 'bg-cool-gray-850 text-emerald-300 border-cool-gray-700 hover:border-emerald-500/50 hover:text-emerald-200'
            }`}
          >
            <Lock size={11} />
            <span>Closed Audits</span>
            <span className="font-mono tabular-nums opacity-80">{reviewQueueSummary.counts.closed}</span>
          </button>
        </div>
      </div>
    ) : activeTab === 'reports' ? (
      renderUnifiedFilterPanel(
        'butcher-reports-filter-panel',
        reportFilter,
        setReportFilter,
        reportsActiveFilterCount,
        false,
        true
      )
    ) : null
  ) : null;

  return (
    <div id="butcher-records-view" className="flex-1 overflow-x-clip bg-cool-gray-900 text-cool-gray-200">
      {activeTabFilterDrawer &&
        (filterPanelContainer
          ? createPortal(activeTabFilterDrawer, filterPanelContainer)
          : activeTabFilterDrawer)}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8 space-y-5">

        {activeTab === 'spreadsheet' && (
          <ButcherSpreadsheetView
            state={state}
            dispatch={dispatch}
            isFilterPanelOpen={isFilterPanelOpen}
            filterPanelContainer={filterPanelContainer}
            onActiveFilterCountChange={onActiveFilterCountChange}
            orderSelectionRequest={spreadsheetSelectionRequest}
            onSelectedOrderIdsChange={setSpreadsheetActiveOrderIds}
          />
        )}

        {activeTab === 'review' && (
          <div id="butcher-review-queue-panel" className="space-y-4">
            {reviewActiveFilterCount > 0 && (
              <div className="flex items-center justify-between gap-2 flex-wrap bg-cool-gray-800/70 border border-cool-gray-700 rounded-xl px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap text-cool-gray-300">
                  <span className="font-bold text-cyan-300">Active View:</span>
                  <span className="px-2 py-0.5 rounded bg-cool-gray-900 border border-cool-gray-700 font-semibold text-white">
                    {reviewCategoryLabels[reviewFilterCategory]}
                  </span>
                  {reviewSearch.trim() && (
                    <span className="px-2 py-0.5 rounded bg-cool-gray-900 border border-cool-gray-700 text-cool-gray-200">
                      Search: &ldquo;{reviewSearch.trim()}&rdquo;
                    </span>
                  )}
                  {reviewSpeciesFilter.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-cool-gray-900 border border-cool-gray-700 text-cool-gray-200">
                      Species: {reviewSpeciesFilter.join(', ')}
                    </span>
                  )}
                  {reviewTagFilter.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-cool-gray-900 border border-cool-gray-700 text-cool-gray-200">
                      Tags: {resolveTagNamesFromIds(reviewTagFilter).join(', ')}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={resetReviewFilters}
                  className="text-xs font-bold text-cool-gray-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              </div>
            )}

            {/* Queue Items */}
            {(() => {
              if (reviewFilterCategory === 'closed') {
                const closedItems = reviewQueueSummary.closedItems.filter((item) => matchesReviewFilters(item.order));
                if (closedItems.length === 0) {
                  return (
                    <div className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl p-10 text-center space-y-2">
                      <Lock size={28} className="text-cool-gray-500 mx-auto" />
                      <p className="text-sm font-bold text-white">No closed audits yet</p>
                      <p className="text-xs text-cool-gray-400">
                        Use <strong className="text-cool-gray-200">Close Audit</strong> on any review item or <strong className="text-cool-gray-200">Save &amp; Close Audit</strong> inside the Weight Audit modal to finalize an order and silence future reminders.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {closedItems.map((item) => {
                      const { order, analysis } = item;
                      const loc = locations.find((l) => l.id === order.locationId);
                      const hasEst = Boolean(
                        order.estimatedWeights &&
                          (['liveWeight', 'hotWeight', 'coldWeight', 'packagedWeight'] as const).some(
                            (f) => typeof order.estimatedWeights?.[f] === 'number' && (order.estimatedWeights?.[f] || 0) > 0
                          )
                      );
                      return (
                        <div
                          key={order.id}
                          className="bg-cool-gray-800 border border-emerald-500/25 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                        >
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                              <span className="text-base font-extrabold text-white">
                                Order #{order.orderNumber}
                              </span>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-bold text-emerald-300">
                                <Lock size={11} />
                                Audit Closed
                                {order.auditClosedAt ? ` · ${new Date(order.auditClosedAt).toLocaleDateString()}` : ''}
                              </span>
                              <span className="text-xs font-semibold text-cool-gray-400">
                                {order.species} · {loc ? loc.name : 'Unknown Butcher'} ·{' '}
                                {order.killDate || 'No Kill Date'}
                              </span>
                              {resolveOrderTags(order, butcherTags).map(tag => (
                                <span
                                  key={tag.id}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cool-gray-900 border border-cool-gray-700 text-[11px] font-semibold text-cool-gray-200"
                                >
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: tag.color || '#06b6d4' }}
                                  />
                                  {tag.name}
                                </span>
                              ))}
                              {analysis.flaggedFields.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                                  <Flag size={12} />
                                  {analysis.flaggedFields.length} Flagged
                                </span>
                              )}
                              {hasEst && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400">
                                  <Calculator size={12} />
                                  Estimate Saved
                                </span>
                              )}
                            </div>
                            {order.estimatedWeights?.note ? (
                              <p className="text-xs text-cool-gray-300">
                                <span className="text-cool-gray-500 font-semibold">Audit Note:</span> {order.estimatedWeights.note}
                              </p>
                            ) : (
                              <p className="text-xs text-cool-gray-400">
                                Silenced from active Review Queue reminders even as other orders or baselines change.
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <button
                              type="button"
                              onClick={() => setReviewingOrder(order)}
                              className="px-3.5 py-2 bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-200 border border-cool-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Calculator size={14} />
                              Inspect Audit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                dispatch({
                                  type: 'EDIT_BUTCHER_ORDER',
                                  payload: {
                                    orderId: order.id,
                                    updates: { auditClosed: false, auditClosedAt: undefined },
                                  },
                                })
                              }
                              className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                              title="Reopen this order for active Review Queue monitoring"
                            >
                              <RotateCcw size={14} />
                              Reopen Audit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const filteredReviewItems = reviewQueueSummary.items.filter(
                (item) =>
                  (reviewFilterCategory === 'all' ? true : item.categories.has(reviewFilterCategory)) &&
                  matchesReviewFilters(item.order)
              );
              if (filteredReviewItems.length === 0) {
                return (
                  <div className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl p-10 text-center space-y-2">
                    <CheckCircle2 size={28} className="text-emerald-400 mx-auto" />
                    <p className="text-sm font-bold text-white">
                      {reviewActiveFilterCount === 0
                        ? 'All butcher orders are verified and finalized'
                        : 'No orders match the active review filters'}
                    </p>
                    <p className="text-xs text-cool-gray-400">
                      You can still open any order from the Logs tab or Closed Audits filter anytime to inspect or adjust estimates later.
                    </p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {filteredReviewItems.map((item) => {
                    const { order, analysis, issues } = item;
                    const loc = locations.find((l) => l.id === order.locationId);
                    return (
                      <div
                        key={order.id}
                        className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="space-y-2.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-base font-extrabold text-white">
                              Order #{order.orderNumber}
                            </span>
                            <span className="text-xs font-semibold text-cool-gray-400">
                              {order.species} · {loc ? loc.name : 'Unknown Butcher'} ·{' '}
                              {order.killDate || 'No Kill Date'}
                            </span>
                            {resolveOrderTags(order, butcherTags).map(tag => (
                              <span
                                key={tag.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-cool-gray-900 border border-cool-gray-700 text-[11px] font-semibold text-cool-gray-200"
                              >
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: tag.color || '#06b6d4' }}
                                />
                                {tag.name}
                              </span>
                            ))}
                            {analysis.flaggedFields.length > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-400">
                                <Flag size={12} />
                                {analysis.flaggedFields.length} Flagged
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            {issues.map((iss) => (
                              <div
                                key={iss.id}
                                className="flex items-start gap-2 text-xs text-cool-gray-300"
                              >
                                {iss.severity === 'critical' ? (
                                  <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                                ) : iss.severity === 'warning' ? (
                                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                                ) : (
                                  <ClipboardCheck size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                                )}
                                <span>
                                  <strong className="text-white">{iss.title}:</strong>{' '}
                                  {iss.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          <button
                            type="button"
                            onClick={() => setReviewingOrder(order)}
                            className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Calculator size={14} />
                            Review & Estimate
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              dispatch({
                                type: 'EDIT_BUTCHER_ORDER',
                                payload: {
                                  orderId: order.id,
                                  updates: {
                                    auditClosed: true,
                                    auditClosedAt: new Date().toISOString(),
                                  },
                                },
                              })
                            }
                            className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            title="Finalize and close this audit so it won't reappear as other orders or baselines change"
                          >
                            <Lock size={13} />
                            Close Audit
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingOrder(order)}
                            className="px-3 py-2 bg-cool-gray-900 hover:bg-cool-gray-750 text-cool-gray-200 border border-cool-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Edit3 size={14} />
                            Edit Order
                          </button>
                          {item.categories.has('missing_cuts') && (
                            <button
                              type="button"
                              onClick={() => handleStartReceiveMoreCuts(order)}
                              className="px-3 py-2 bg-cool-gray-900 hover:bg-cool-gray-750 text-emerald-300 border border-cool-gray-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Upload size={14} />
                              Upload CSV
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-5">
            {renderActiveFilterSummaryBar(
              'butcher-orders-active-filters',
              ordersFilter,
              setOrdersFilter,
              ordersActiveFilterCount
            )}

            {reviewQueueSummary.counts.anomaly > 0 && (
              <div
                className="butcher-surface-card rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ borderColor: 'color-mix(in srgb, var(--ha-warning-color, #f59e0b) 50%, transparent)' }}
              >
                <div className="flex items-center gap-2.5 text-xs text-cool-gray-200">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                  <span>
                    <strong className="text-white">
                      {reviewQueueSummary.counts.anomaly} butcher order
                      {reviewQueueSummary.counts.anomaly === 1 ? '' : 's'}
                    </strong>{' '}
                    {reviewQueueSummary.counts.anomaly === 1 ? 'has' : 'have'} yield anomalies or flagged weights awaiting review ({reviewQueueSummary.counts.totalOrdersNeedingReview} total in backlog).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setReviewFilterCategory('anomaly');
                    setActiveTab('review');
                  }}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Review Queue
                </button>
              </div>
            )}

            {/* Aggregate Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="butcher-stat-card p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-cool-gray-300 text-xs font-bold uppercase tracking-wider mb-1">Total Orders</span>
                <span className="text-3xl font-extrabold text-white font-mono tabular-nums">{aggregateStats.totalOrders}</span>
              </div>
              <div className="butcher-stat-card p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-cool-gray-300 text-xs font-bold uppercase tracking-wider mb-1">Total Pieces</span>
                <span className="text-3xl font-extrabold text-white font-mono tabular-nums">{aggregateStats.totalPieces}</span>
              </div>
              <div className="butcher-stat-card p-4 rounded-2xl flex flex-col items-center justify-center">
                <span className="text-cool-gray-300 text-xs font-bold uppercase tracking-wider mb-1">Total Net Weight</span>
                <span className="text-3xl font-extrabold text-cyan-400 font-mono tabular-nums">{aggregateStats.totalWeight.toFixed(2)} lbs</span>
              </div>
            </div>

            {/* Selection / Send-to-Reports Bar */}
            {filteredOrders.length > 0 && (() => {
              const allFilteredSelected = filteredOrders.every(o => validSelectedOrderIdSet.has(o.id));
              const selectedCount = validSelectedOrderIdSet.size;
              return (
                <div
                  data-testid="butcher-logs-selection-bar"
                  style={{ top: 'var(--header-height, 68px)' }}
                  className={`sticky z-30 rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs transition backdrop-blur-md ${
                    selectedCount > 0
                      ? 'bg-cyan-950/95 border border-cyan-500/60 shadow-lg'
                      : 'butcher-surface-card shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="inline-flex items-center gap-2 font-semibold text-cool-gray-200 hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        data-testid="butcher-select-all-orders-checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFilteredOrders}
                        className="rounded bg-cool-gray-900 border-cool-gray-600 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-4 h-4 shrink-0"
                      />
                      <span>Select all shown ({filteredOrders.length})</span>
                    </label>
                    {selectedCount > 0 ? (
                      <span
                        data-testid="butcher-selected-orders-count"
                        className="font-bold text-cyan-300 font-mono tabular-nums"
                      >
                        {selectedCount} {selectedCount === 1 ? 'order' : 'orders'} selected
                      </span>
                    ) : (
                      <span className="text-cool-gray-400 hidden sm:inline">
                        Check orders to send them to Reports or Spreadsheet
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedCount > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderIdsForReport([])}
                          className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white border border-cool-gray-700 font-bold text-xs transition cursor-pointer"
                        >
                          Clear
                        </button>
                        {reportFilter.orderNumber.length > 0 && (
                          <button
                            type="button"
                            data-testid="butcher-append-to-reports-btn"
                            onClick={() => handleSendOrdersToReports(Array.from(validSelectedOrderIdSet), 'append')}
                            className="px-3 py-1.5 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-750 text-cyan-300 border border-cyan-500/40 font-bold text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                            title="Add checked orders onto the existing Reports order filter"
                          >
                            <Plus size={13} />
                            <span>Add to Reports ({reportFilter.orderNumber.length} active)</span>
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid="butcher-send-to-reports-btn"
                          onClick={() => handleSendOrdersToReports(Array.from(validSelectedOrderIdSet), 'replace')}
                          className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="Filter the Reports page to these selected orders"
                        >
                          <BarChart3 size={14} />
                          <span>Send to Reports ({selectedCount})</span>
                        </button>
                        {validSpreadsheetActiveOrderIds.length > 0 && (
                          <button
                            type="button"
                            data-testid="butcher-append-to-spreadsheet-btn"
                            onClick={() => handleSendOrdersToSpreadsheet(Array.from(validSelectedOrderIdSet), 'append')}
                            className="px-3 py-1.5 rounded-lg bg-cool-gray-850 hover:bg-cool-gray-750 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                            title="Add checked orders onto the existing Spreadsheet order selection"
                          >
                            <Plus size={13} />
                            <span>Add to Spreadsheet ({validSpreadsheetActiveOrderIds.length} active)</span>
                          </button>
                        )}
                        <button
                          type="button"
                          data-testid="butcher-send-to-spreadsheet-btn"
                          onClick={() => handleSendOrdersToSpreadsheet(Array.from(validSelectedOrderIdSet), 'replace')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                          title="Open these selected orders in the Butcher Spreadsheet"
                        >
                          <FileSpreadsheet size={14} />
                          <span>Send to Spreadsheet ({selectedCount})</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
            
            <div className="space-y-6">
              {filteredOrders.length === 0 ? (
                <div className="butcher-surface-card text-center py-12 rounded-2xl">
                  <p className="text-cool-gray-300 text-sm font-medium">No butcher orders found.</p>
                </div>
              ) : (
                filteredOrders.map(order => {
                  const loc = locations.find(l => l.id === order.locationId);
                  const stats = getOrderStats(order.id);
                  const orderRecs = recordsByOrderId.get(order.id) || [];
                  const oStats = computeOrderStats(order, orderRecs);
                  const orderTimeline = computeOrderTimelineMetrics(
                    order,
                    orderRecs,
                    oStats,
                    locationNameById
                  );
                  const orderAnalysis = reviewQueueSummary.allOrderAnalyses.get(order.id);
                  const isExpanded = expandedOrder === order.id;
                  const isSelectedForReport = validSelectedOrderIdSet.has(order.id);
                  const hasEstimatedWeights = Boolean(
                    order.estimatedWeights &&
                    (['liveWeight', 'hotWeight', 'coldWeight', 'packagedWeight'] as const).some(
                      f => typeof order.estimatedWeights?.[f] === 'number' && (order.estimatedWeights?.[f] || 0) > 0
                    )
                  );
                  
                  return (
                    <article
                      key={order.id}
                      data-testid="butcher-order-card"
                      data-expanded={isExpanded ? 'true' : 'false'}
                      data-selected-for-report={isSelectedForReport ? 'true' : 'false'}
                      className={`butcher-log-card rounded-2xl overflow-hidden ${isExpanded ? 'butcher-log-card--expanded' : ''} ${isSelectedForReport ? 'ring-2 ring-cyan-500/65' : ''}`}
                    >
                      {/* Distinct Card Header Band */}
                      <div className="butcher-log-card-header px-4 sm:px-5 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <label
                              className="inline-flex items-center cursor-pointer shrink-0"
                              title={`Select Order #${order.orderNumber} to send to Reports or Spreadsheet`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                data-testid="butcher-order-select-checkbox"
                                aria-label={`Select Order #${order.orderNumber} for Reports or Spreadsheet`}
                                checked={isSelectedForReport}
                                onChange={() => toggleOrderSelectionForReport(order.id)}
                                className="rounded bg-cool-gray-900 border-cool-gray-500 text-cyan-500 focus:ring-cyan-500/60 cursor-pointer w-4 h-4"
                              />
                            </label>
                            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                              Order #{order.orderNumber}
                            </h2>
                            <span
                              data-testid="butcher-order-species-badge"
                              className="px-2.5 py-0.5 bg-[var(--ha-bg-chip)] text-[var(--ha-text-primary)] border border-[var(--ha-border)] rounded-md text-xs font-bold uppercase tracking-wider"
                            >
                              {order.species}
                            </span>
                            {resolveOrderTags(order, butcherTags).map(tag => (
                              <span
                                key={tag.id}
                                data-testid="butcher-order-tag-badge"
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[var(--ha-bg-chip)] border border-[var(--ha-border)] rounded-md text-xs font-semibold text-[var(--ha-text-primary)]"
                                title={
                                  tag.weightCheckMode === 'separate_baseline'
                                    ? `${tag.name} (Separate Yield Baseline)`
                                    : tag.weightCheckMode === 'exclude_from_baseline'
                                      ? `${tag.name} (Excluded from Statistical Baseline)`
                                      : tag.name
                                }
                              >
                                <span
                                  className="w-2 h-2 rounded-sm shrink-0"
                                  style={{ backgroundColor: tag.color || '#06b6d4' }}
                                />
                                <span>{tag.name}</span>
                              </span>
                            ))}
                            {stats.count === 0 && (
                              <span className="text-amber-300 text-xs font-bold">
                                Pending Cuts (Drop-Off)
                              </span>
                            )}
                            {order.auditClosed && (
                              <button
                                type="button"
                                onClick={() => setReviewingOrder(order)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/35 text-xs font-bold text-emerald-300 hover:text-emerald-200 transition cursor-pointer whitespace-nowrap"
                                title={`Audit closed${order.auditClosedAt ? ` on ${new Date(order.auditClosedAt).toLocaleDateString()}` : ''} — silenced from Review Queue reminders. Click to inspect or reopen.`}
                              >
                                <Lock size={11} />
                                <span>Audit Closed</span>
                              </button>
                            )}
                            {orderAnalysis && orderAnalysis.flaggedFields.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setReviewingOrder(order)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 hover:text-rose-300 transition cursor-pointer whitespace-nowrap"
                                title="Click to inspect or update flagged weights and estimates"
                              >
                                <Flag size={12} />
                                <span>
                                  Flagged ({orderAnalysis.flaggedFields.map(f => BUTCHER_WEIGHT_FIELD_LABELS[f].replace(' Weight', '')).join(', ')})
                                </span>
                              </button>
                            )}
                            {orderAnalysis && orderAnalysis.needsReview && !order.auditClosed && (
                              <button
                                type="button"
                                onClick={() => setReviewingOrder(order)}
                                className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer whitespace-nowrap"
                                title="Yield anomaly detected — click to review"
                              >
                                <AlertTriangle size={12} />
                                <span>Yield Alert</span>
                              </button>
                            )}
                            {hasEstimatedWeights && (
                              <button
                                type="button"
                                onClick={() => setReviewingOrder(order)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition cursor-pointer whitespace-nowrap"
                                title="Corrected weight estimate saved — click to edit anytime"
                              >
                                <Calculator size={12} />
                                <span>Estimate Saved</span>
                              </button>
                            )}
                          </div>
                          <div className="text-xs sm:text-sm text-cool-gray-300 flex items-center gap-2 flex-wrap">
                            {loc ? (
                              <span className="text-cyan-400 font-semibold">{loc.name}</span>
                            ) : (
                              <span className="text-cool-gray-400">Unknown Butcher</span>
                            )}
                            {order.killDate && (
                              <>
                                <span aria-hidden="true" className="text-cool-gray-400">·</span>
                                <span className="font-mono tabular-nums text-cool-gray-300">Kill {order.killDate}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReviewingOrder(order);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                              !order.auditClosed && (orderAnalysis?.needsReview || (orderAnalysis?.flaggedFields.length || 0) > 0)
                                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/45'
                                : 'butcher-log-chip-btn'
                            }`}
                            title={`Audit carcass weights, flag wrong numbers, or edit estimates for Order #${order.orderNumber}`}
                          >
                            <Flag size={14} />
                            <span>Audit Weights</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setManualEntryTargetOrder(order);
                              setIsManualEntryOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap"
                            title={`Manually enter cuts, weights, and serial numbers for Order #${order.orderNumber}`}
                          >
                            <Plus size={15} />
                            <span>Add Items Manually</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartReceiveMoreCuts(order);
                            }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 ${
                              stats.count === 0
                                ? 'bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40'
                                : 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            } rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap`}
                            title={stats.count === 0 ? "Upload cutsheet CSV for this drop-off order" : "Receive additional cuts into this existing butcher log"}
                          >
                            {stats.count === 0 ? <Upload size={15} /> : <PlusCircle size={15} />}
                            <span>{stats.count === 0 ? 'Upload Cutsheet CSV' : 'Receive Additional Cuts'}</span>
                          </button>

                          <span aria-hidden="true" className="hidden sm:inline-block h-5 border-l butcher-log-divider mx-0.5" />

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingOrder(order);
                            }}
                            className="butcher-log-action-icon p-2 rounded-lg hover:text-cyan-400 cursor-pointer"
                            title="Edit order details"
                            aria-label={`Edit Order #${order.orderNumber}`}
                          >
                            <Edit3 size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(order.id);
                            }}
                            className="butcher-log-action-icon p-2 rounded-lg hover:text-red-400 cursor-pointer"
                            title="Delete order"
                            aria-label={`Delete Order #${order.orderNumber}`}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      </div>

                      {/* Card Body: 3 Equal-Height Vertical Overview Panels */}
                      <div className="p-3.5 sm:p-4 space-y-3">
                        <div
                          data-testid="butcher-order-quick-metrics"
                          className="grid grid-cols-1 md:grid-cols-3 gap-3"
                        >
                          {/* Panel 1: Dates & Timeline */}
                          <div className="butcher-log-summary-panel rounded-xl p-3.5 flex flex-col justify-between">
                            <h3 className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider mb-2.5">Dates &amp; Timeline</h3>
                            <div className="space-y-1.5 text-xs sm:text-[13px]">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Birth Date</span>
                                <span className="text-white font-semibold font-mono tabular-nums">{order.birthDate || '—'}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Kill Date</span>
                                <span className="text-white font-semibold font-mono tabular-nums">{order.killDate || '—'}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Pickup Date</span>
                                <span className="text-white font-semibold font-mono tabular-nums">{order.pickupDate || '—'}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2 border-t butcher-log-divider pt-1.5 mt-1.5">
                                <span className="text-cool-gray-300 font-medium">Days Alive</span>
                                <span className="text-white font-bold font-mono tabular-nums">
                                  {orderTimeline.daysAlive !== null ? `${orderTimeline.daysAlive}d` : '—'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-400 font-semibold">Turnaround</span>
                                <span className={`font-bold font-mono tabular-nums ${orderTimeline.killToPickupDays !== null ? 'text-cyan-400' : 'text-cool-gray-400'}`}>
                                  {orderTimeline.killToPickupDays !== null ? `${orderTimeline.killToPickupDays}d` : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Panel 2: Weights & Yields */}
                          <div className="butcher-log-summary-panel rounded-xl p-3.5 flex flex-col justify-between">
                            <h3 className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider mb-2.5">Weights &amp; Yields</h3>
                            <div className="space-y-1.5 text-xs sm:text-[13px]">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Animals</span>
                                <span className="text-white font-semibold font-mono tabular-nums">{order.animalCount || '—'}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Live Weight</span>
                                <span className="font-mono tabular-nums font-semibold flex items-center gap-1.5">
                                  <span className={order.weightAnomalies?.liveWeight?.status === 'flagged' ? 'text-rose-400 line-through' : 'text-white'}>
                                    {order.liveWeight ? `${order.liveWeight} lbs` : '—'}
                                  </span>
                                  {order.estimatedWeights?.liveWeight && order.estimatedWeights.liveWeight > 0 && (
                                    <span className="text-[11px] text-cyan-400 font-bold">
                                      (Est {order.estimatedWeights.liveWeight.toFixed(0)})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Cold Weight</span>
                                <span className="font-mono tabular-nums font-semibold flex items-center gap-1.5">
                                  <span className={order.weightAnomalies?.coldWeight?.status === 'flagged' ? 'text-rose-400 line-through' : 'text-white'}>
                                    {order.coldWeight ? `${order.coldWeight} lbs` : '—'}
                                  </span>
                                  {order.estimatedWeights?.coldWeight && order.estimatedWeights.coldWeight > 0 && (
                                    <span className="text-[11px] text-cyan-400 font-bold">
                                      (Est {order.estimatedWeights.coldWeight.toFixed(0)})
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="flex justify-between items-center gap-2 border-t butcher-log-divider pt-1.5 mt-1.5">
                                <span className="text-cool-gray-300 font-medium">Yield (Cold / Live)</span>
                                <span className={`font-bold font-mono tabular-nums ${order.liveWeight && order.coldWeight ? 'text-emerald-400' : 'text-cool-gray-400'}`}>
                                  {order.liveWeight && order.coldWeight ? `${((order.coldWeight / order.liveWeight) * 100).toFixed(1)}%` : '—'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-400 font-semibold">Finished Yield</span>
                                <span className={`font-bold font-mono tabular-nums ${oStats.finishToLiveYield > 0 ? 'text-cyan-400' : 'text-cool-gray-400'}`}>
                                  {oStats.finishToLiveYield > 0 ? `${oStats.finishToLiveYield.toFixed(1)}%` : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Panel 3: Order Statistics (Output & Fees) */}
                          <div className="butcher-log-summary-panel rounded-xl p-3.5 flex flex-col justify-between">
                            <h3 className="text-[11px] font-bold text-cool-gray-300 uppercase tracking-wider mb-2.5">Order Statistics</h3>
                            <div className="space-y-1.5 text-xs sm:text-[13px]">
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Total Records</span>
                                <span className="text-white font-bold font-mono tabular-nums">{stats.count}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Total Pieces</span>
                                <span className="text-white font-bold font-mono tabular-nums">{stats.totalPieces}</span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-300">Net Weight</span>
                                <span className="text-white font-bold font-mono tabular-nums">{stats.totalWeight.toFixed(2)} lbs</span>
                              </div>
                              <div className="flex justify-between items-center gap-2 border-t butcher-log-divider pt-1.5 mt-1.5">
                                <span className="text-cool-gray-300 font-medium">Butcher Fee</span>
                                <span className={`font-extrabold font-mono tabular-nums ${order.butcherFee !== undefined && order.butcherFee > 0 ? 'text-cyan-400' : 'text-cool-gray-400'}`}>
                                  {order.butcherFee !== undefined && order.butcherFee > 0 ? `$${Number(order.butcherFee).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                                </span>
                              </div>
                              <div className="flex justify-between items-center gap-2">
                                <span className="text-cool-gray-400 font-semibold">Cost / packaged lb</span>
                                <span className={`font-bold font-mono tabular-nums ${order.butcherFee !== undefined && order.butcherFee > 0 && stats.totalWeight > 0 ? 'text-emerald-400' : 'text-cool-gray-400'}`}>
                                  {order.butcherFee !== undefined && order.butcherFee > 0 && stats.totalWeight > 0
                                    ? `$${(order.butcherFee / stats.totalWeight).toFixed(2)}/lb`
                                    : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {orderTimeline.hasWarnings && (
                          <div
                            data-testid="butcher-order-date-warning"
                            className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/35 flex items-start gap-2 text-xs text-amber-300"
                          >
                            <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              {orderTimeline.warnings.map((w, idx) => (
                                <div key={`${w.code}-${idx}`}>{w.message}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {order.notes && (
                          <div className="pt-2.5 border-t butcher-log-divider text-xs text-cool-gray-200 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2.5">
                            <span className="font-bold text-cool-gray-400 uppercase tracking-wider text-[11px] shrink-0">Notes</span>
                            <p className="whitespace-pre-line leading-snug">{order.notes}</p>
                          </div>
                        )}

                        {order.documents && order.documents.length > 0 && (
                          <div className="pt-2.5 border-t butcher-log-divider flex flex-wrap items-center gap-2">
                            <span className="font-bold text-cool-gray-400 uppercase tracking-wider text-[11px] shrink-0">Documents</span>
                            {order.documents.map((doc: any) => (
                              <a
                                key={doc.id}
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="butcher-log-chip-btn px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer group"
                              >
                                <Link size={12} className="text-cyan-400 shrink-0" />
                                <span className="truncate max-w-[200px]">{resolveDocumentDisplayName(doc, documentLinkTypes)}</span>
                                <ExternalLink size={11} className="text-cool-gray-400 group-hover:text-cyan-400 transition shrink-0" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Full-Width Interactive Breakdown Toggle Bar */}
                      <button
                        type="button"
                        aria-expanded={isExpanded}
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className={`w-full px-4 sm:px-5 py-2 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer butcher-log-toggle-bar ${
                          isExpanded ? 'butcher-log-toggle-bar--expanded' : ''
                        }`}
                      >
                        <span>{isExpanded ? 'Hide Timeline, Yields & Cut Breakdown' : 'View Timeline, Yields & Cut Breakdown'}</span>
                        <ChevronDown
                          size={15}
                          className={`transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isExpanded && (() => {
                        const breakdown = getCutBreakdown(order.id);
                        
                        return (
                          <div
                            data-testid="butcher-order-expanded-drawer"
                            className="butcher-log-expanded-drawer p-4 sm:p-6 space-y-5"
                          >
                            {/* Detailed Processing Timeline & Pacing (Fixed 8-metric grid across all orders) */}
                            <div
                              data-testid="butcher-order-timeline-strip"
                              className="butcher-log-subpanel rounded-xl p-4 space-y-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                                  Processing Timeline &amp; Pacing
                                </span>
                                <span className="text-xs font-mono tabular-nums text-cool-gray-300">
                                  {orderTimeline.firstPackDate
                                    ? orderTimeline.firstPackDate === orderTimeline.lastPackDate
                                      ? `Packed ${orderTimeline.firstPackDate}`
                                      : `Packed ${orderTimeline.firstPackDate} → ${orderTimeline.lastPackDate}`
                                    : 'No package dates yet'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-xs">
                                <div>
                                  <p className="text-[11px] text-cool-gray-400 font-medium">Birth Date</p>
                                  <p className="font-mono tabular-nums font-bold text-white mt-0.5 text-sm">
                                    {order.birthDate || '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-cool-gray-400 font-medium">Days Alive</p>
                                  <p className="font-mono tabular-nums font-bold text-cyan-400 mt-0.5 text-sm">
                                    {orderTimeline.daysAlive !== null
                                      ? `${orderTimeline.daysAlive}d (${formatDaysAsMonths(orderTimeline.daysAlive)})`
                                      : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-cool-gray-400 font-medium">Kill → 1st Pack</p>
                                  <p className="font-mono tabular-nums font-bold text-amber-400 mt-0.5 text-sm">
                                    {orderTimeline.killToFirstPackDays !== null
                                      ? `${orderTimeline.killToFirstPackDays}d`
                                      : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-cool-gray-400 font-medium">Kill → Last Pack</p>
                                  <p className="font-mono tabular-nums font-bold text-violet-400 mt-0.5 text-sm">
                                    {orderTimeline.killToLastPackDays !== null
                                      ? `${orderTimeline.killToLastPackDays}d`
                                      : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-cool-gray-400 font-medium">Package Time</p>
                                  <p className="font-mono tabular-nums font-bold text-emerald-400 mt-0.5 text-sm">
                                    {orderTimeline.packageSpanDays !== null
                                      ? `${orderTimeline.packageSpanDays}d · ${orderTimeline.distinctPackDays} act`
                                      : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-cool-gray-400 font-medium">Post-Pack Hold</p>
                                  <p className="font-mono tabular-nums font-bold text-rose-400 mt-0.5 text-sm">
                                    {orderTimeline.lastPackToPickupDays !== null
                                      ? `${orderTimeline.lastPackToPickupDays}d`
                                      : '—'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[11px] text-cool-gray-400 font-medium">Daily Gain (ADG)</p>
                                  <p className="font-mono tabular-nums font-bold text-white mt-0.5 text-sm">
                                    {orderTimeline.liveWeightPerDayAlive !== null
                                      ? `${orderTimeline.liveWeightPerDayAlive.toFixed(2)} lb/d`
                                      : '—'}
                                  </p>
                                  {orderTimeline.hotWeightPerDayAlive !== null && (
                                    <p className="text-[11px] text-cool-gray-400 font-mono tabular-nums">
                                      {orderTimeline.hotWeightPerDayAlive.toFixed(2)} lb/d hot
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[11px] text-cool-gray-400 font-medium">Pack Throughput</p>
                                  <p className="font-mono tabular-nums font-bold text-white mt-0.5 text-sm">
                                    {orderTimeline.packagedLbsPerPackDay !== null
                                      ? `${orderTimeline.packagedLbsPerPackDay.toFixed(0)} lb/d`
                                      : '—'}
                                  </p>
                                  {orderTimeline.packagesPerPackDay !== null && (
                                    <p className="text-[11px] text-cool-gray-400 font-mono tabular-nums">
                                      {orderTimeline.packagesPerPackDay.toFixed(0)} pkgs/d
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            {(orderAnalysis?.needsReview || (orderAnalysis?.flaggedFields.length || 0) > 0 || hasEstimatedWeights) && (
                              <div className="butcher-log-subpanel rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="text-xs text-cool-gray-300 space-y-0.5">
                                  <div className="font-bold text-white flex items-center gap-1.5">
                                    {orderAnalysis?.flaggedFields.length ? (
                                      <Flag size={13} className="text-rose-400 shrink-0" />
                                    ) : orderAnalysis?.needsReview ? (
                                      <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                                    ) : (
                                      <Calculator size={13} className="text-cyan-400 shrink-0" />
                                    )}
                                    <span>
                                      {orderAnalysis?.flaggedFields.length
                                        ? `Flagged fields: ${orderAnalysis.flaggedFields.map(f => BUTCHER_WEIGHT_FIELD_LABELS[f]).join(', ')}`
                                        : orderAnalysis?.needsReview
                                        ? `Yield anomaly detected vs. ${orderAnalysis.baselineLabel} baseline`
                                        : 'Corrected weight estimate saved on this order'}
                                    </span>
                                  </div>
                                  {orderAnalysis?.findings.slice(0, 1).map(f => (
                                    <div key={f.id} className="text-xs text-cool-gray-400">{f.message}</div>
                                  ))}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setReviewingOrder(order)}
                                  className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  Open Weight Audit &amp; Estimates
                                </button>
                              </div>
                            )}

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Left Pane: Yield & Performance Dashboard */}
                              <div className="space-y-4">
                                <h4 className="text-xs font-extrabold text-white flex items-center gap-2 uppercase tracking-wider">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan-400"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                                  Yield &amp; Carcass Performance
                                </h4>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="butcher-log-subpanel p-3.5 rounded-xl">
                                    <div className="text-cool-gray-300 text-[11px] font-semibold">Hot Weight Yield</div>
                                    <div className="text-lg font-extrabold text-white font-mono tabular-nums mt-1">
                                      {oStats.hotWeightYield > 0 ? `${oStats.hotWeightYield.toFixed(1)}%` : '—'}
                                    </div>
                                    <div className="text-[11px] text-cool-gray-400 mt-0.5">Hot Carcass / Live weight</div>
                                  </div>

                                  <div className="butcher-log-subpanel p-3.5 rounded-xl">
                                    <div className="text-cool-gray-300 text-[11px] font-semibold">Cooler Shrinkage</div>
                                    <div className="text-lg font-extrabold text-rose-400 font-mono tabular-nums mt-1">
                                      {oStats.coolerShrinkage > 0 ? `${oStats.coolerShrinkage.toFixed(1)}%` : '—'}
                                    </div>
                                    <div className="text-[11px] text-cool-gray-400 mt-0.5">Hot vs. Cold hanging loss</div>
                                  </div>

                                  <div className="butcher-log-subpanel p-3.5 rounded-xl">
                                    <div className="text-cool-gray-300 text-[11px] font-semibold">Cutting Yield</div>
                                    <div className="text-lg font-extrabold text-emerald-400 font-mono tabular-nums mt-1">
                                      {oStats.cuttingYield > 0 ? `${oStats.cuttingYield.toFixed(1)}%` : '—'}
                                    </div>
                                    <div className="text-[11px] text-cool-gray-400 mt-0.5">Packaged meat / Cold weight</div>
                                  </div>

                                  <div className="butcher-log-subpanel p-3.5 rounded-xl">
                                    <div className="text-cool-gray-300 text-[11px] font-semibold">Total Finished Yield</div>
                                    <div className="text-lg font-extrabold text-cyan-400 font-mono tabular-nums mt-1">
                                      {oStats.finishToLiveYield > 0 ? `${oStats.finishToLiveYield.toFixed(1)}%` : '—'}
                                    </div>
                                    <div className="text-[11px] text-cool-gray-400 mt-0.5">Packaged meat / Live weight</div>
                                  </div>
                                </div>

                                <div className="butcher-log-subpanel p-4 rounded-xl space-y-3.5">
                                  <h5 className="text-xs font-bold text-cool-gray-300 uppercase tracking-wider">Weight Loss &amp; Yield Journey</h5>
                                  <div className="space-y-3.5">
                                    {/* Live Weight */}
                                    <div>
                                      <div className="flex justify-between items-baseline gap-2 text-xs text-cool-gray-200 mb-1.5">
                                        <span className="font-medium">Live Weight</span>
                                        <span className="font-bold text-white font-mono tabular-nums">{oStats.liveWeight ? `${oStats.liveWeight.toFixed(1)} lbs` : 'Not specified'}</span>
                                      </div>
                                      <div className="butcher-progress-track w-full h-2 rounded-sm overflow-hidden">
                                        <div className="h-full bg-cyan-500 rounded-sm" style={{ width: oStats.liveWeight ? '100%' : '0%' }}></div>
                                      </div>
                                    </div>

                                    {/* Hot Weight */}
                                    <div>
                                      <div className="flex justify-between items-baseline gap-2 text-xs text-cool-gray-200 mb-1.5 flex-wrap">
                                        <span className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium">Hot Carcass Weight</span>
                                          {oStats.hotWeight > 0 && oStats.liveWeight > 0 && (
                                            <span className="text-[11px] text-amber-400 font-semibold font-mono tabular-nums">
                                              −{oStats.dressingLoss.toFixed(1)} lbs dressing loss
                                            </span>
                                          )}
                                        </span>
                                        <span className="font-bold text-white font-mono tabular-nums">
                                          {oStats.hotWeight > 0
                                            ? `${oStats.hotWeight.toFixed(1)} lbs${oStats.liveWeight > 0 ? ` (${oStats.hotWeightYield.toFixed(1)}%)` : ''}`
                                            : 'Not specified'}
                                        </span>
                                      </div>
                                      <div className="butcher-progress-track w-full h-2 rounded-sm overflow-hidden">
                                        <div
                                          className="h-full bg-amber-500 rounded-sm"
                                          style={{ width: oStats.hotWeight > 0 ? `${Math.min(100, Math.max(0, oStats.liveWeight > 0 ? oStats.hotWeightYield : 100))}%` : '0%' }}
                                        ></div>
                                      </div>
                                    </div>

                                    {/* Cold Weight */}
                                    <div>
                                      <div className="flex justify-between items-baseline gap-2 text-xs text-cool-gray-200 mb-1.5 flex-wrap">
                                        <span className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium">Cold Carcass Weight</span>
                                          {oStats.coldWeight > 0 && oStats.hotWeight > 0 && (
                                            <span className="text-[11px] text-rose-400 font-semibold font-mono tabular-nums">
                                              −{oStats.coolerLoss.toFixed(1)} lbs hanging ({oStats.coolerShrinkage.toFixed(1)}%)
                                            </span>
                                          )}
                                        </span>
                                        <span className="font-bold text-white font-mono tabular-nums">
                                          {oStats.coldWeight > 0
                                            ? `${oStats.coldWeight.toFixed(1)} lbs${oStats.liveWeight > 0 ? ` (${((oStats.coldWeight / oStats.liveWeight) * 100).toFixed(1)}%)` : ''}`
                                            : 'Not specified'}
                                        </span>
                                      </div>
                                      <div className="butcher-progress-track w-full h-2 rounded-sm overflow-hidden">
                                        <div
                                          className="h-full bg-indigo-500 rounded-sm"
                                          style={{ width: oStats.coldWeight > 0 ? `${Math.min(100, Math.max(0, oStats.liveWeight > 0 ? (oStats.coldWeight / oStats.liveWeight) * 100 : 100))}%` : '0%' }}
                                        ></div>
                                      </div>
                                    </div>

                                    {/* Packaged Weight */}
                                    <div>
                                      <div className="flex justify-between items-baseline gap-2 text-xs text-cool-gray-200 mb-1.5 flex-wrap">
                                        <span className="flex items-center gap-2 flex-wrap">
                                          <span className="font-medium">Take-Home Packaged</span>
                                          {oStats.coldWeight > 0 && (
                                            <span className="text-[11px] text-emerald-400 font-semibold font-mono tabular-nums">
                                              −{oStats.cuttingLoss.toFixed(1)} lbs cutting loss
                                            </span>
                                          )}
                                        </span>
                                        <span className="font-bold text-cyan-400 font-mono tabular-nums">
                                          {oStats.packagedWeight.toFixed(1)} lbs ({oStats.finishToLiveYield.toFixed(1)}%)
                                        </span>
                                      </div>
                                      <div className="butcher-progress-track w-full h-2 rounded-sm overflow-hidden">
                                        <div className="h-full bg-cyan-400 rounded-sm" style={{ width: `${Math.min(100, Math.max(0, oStats.finishToLiveYield))}%` }}></div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                {!oStats.liveWeight && !oStats.hotWeight && !oStats.coldWeight && (
                                  <div className="butcher-log-subpanel p-3.5 rounded-xl text-xs text-cool-gray-300">
                                    <span className="text-white font-bold">Tip:</span> Edit this order and specify the <span className="text-white font-semibold">Live Wt, Hot Wt, and Cold Wt</span> to display dressing percentages, cooler shrinkage, and carcass loss progression.
                                  </div>
                                )}
                              </div>

                              {/* Right Pane: Detailed Cut Breakdown with Individual Cut Percentages */}
                              {(() => {
                                const filteredBreakdown = filterCutBreakdown(breakdown, cutBreakdownSearch);
                                const hasCutFilter = cutBreakdownSearch.trim().length > 0;
                                return (
                                  <div className="space-y-4">
                                    <h4 className="text-xs font-extrabold text-white flex items-center justify-between gap-2 uppercase tracking-wider">
                                      <span className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-cyan-400"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
                                        Cuts Breakdown &amp; Take-Home Share
                                      </span>
                                      <span className="text-xs text-cool-gray-300 font-mono tabular-nums font-semibold">
                                        {hasCutFilter
                                          ? `${filteredBreakdown.length} / ${breakdown.length} cuts`
                                          : `${breakdown.length} ${breakdown.length === 1 ? 'cut' : 'cuts'}`}
                                      </span>
                                    </h4>
                                    
                                    {breakdown.length === 0 ? (
                                      <div className="butcher-log-subpanel text-center py-6 px-4 rounded-xl space-y-3">
                                        <p className="text-xs font-bold text-amber-400">No cut records uploaded yet</p>
                                        <p className="text-xs text-cool-gray-300 max-w-md mx-auto">
                                          This drop-off order was started without cuts. You can add cuts manually or upload a butcher CSV cutsheet anytime.
                                        </p>
                                        <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setManualEntryTargetOrder(order);
                                              setIsManualEntryOpen(true);
                                            }}
                                            className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                          >
                                            <Plus size={14} />
                                            Add Cuts Manually
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleStartReceiveMoreCuts(order)}
                                            className="butcher-log-chip-btn px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                          >
                                            <Upload size={14} />
                                            Upload Cutsheet CSV
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="butcher-log-subpanel rounded-xl overflow-hidden">
                                        <div className="px-3 py-2 border-b butcher-log-divider">
                                          <div className="relative flex items-center">
                                            <Search size={13} className="absolute left-2.5 text-cool-gray-400 pointer-events-none" />
                                            <input
                                              type="text"
                                              data-testid="butcher-cut-breakdown-search"
                                              value={cutBreakdownSearch}
                                              onChange={e => setCutBreakdownSearch(e.target.value)}
                                              placeholder="Filter cuts..."
                                              aria-label={`Filter cuts in Order #${order.orderNumber}`}
                                              className="w-full bg-[var(--ha-bg-chip)]/60 border border-[var(--ha-border)] rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-cool-gray-400 focus:outline-none focus:border-cyan-500/70 transition"
                                            />
                                            {hasCutFilter && (
                                              <button
                                                type="button"
                                                onClick={() => setCutBreakdownSearch('')}
                                                aria-label="Clear cut filter"
                                                className="absolute right-2 text-cool-gray-400 hover:text-white transition cursor-pointer"
                                              >
                                                <X size={13} />
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                        <div className="max-h-[360px] overflow-y-auto butcher-log-row-divider">
                                          {filteredBreakdown.length === 0 ? (
                                            <div className="px-3.5 py-6 text-center text-xs text-cool-gray-400 space-y-2">
                                              <p>No cuts matching &ldquo;{cutBreakdownSearch.trim()}&rdquo;.</p>
                                              <button
                                                type="button"
                                                onClick={() => setCutBreakdownSearch('')}
                                                className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                                              >
                                                Clear filter
                                              </button>
                                            </div>
                                          ) : (
                                            filteredBreakdown.map(cut => {
                                              const cutPct = oStats.packagedWeight > 0 ? (cut.totalWeight / oStats.packagedWeight) * 100 : 0;
                                              return (
                                                <div
                                                  key={cut.name}
                                                  className="px-3.5 py-2.5 flex flex-col justify-between gap-1.5 hover:bg-[var(--ha-bg-chip)]/40 transition-colors"
                                                >
                                                  <div className="flex justify-between items-start gap-3 text-xs">
                                                    <div className="min-w-0">
                                                      <p className="font-bold text-white truncate">{cut.name}</p>
                                                      <p className="text-[11px] text-cool-gray-400 font-mono tabular-nums mt-0.5">
                                                        {cut.totalPieces} pcs · {cut.count} {cut.count === 1 ? 'pkg' : 'pkgs'}
                                                      </p>
                                                    </div>
                                                    <div className="text-right shrink-0 font-mono tabular-nums">
                                                      <p className="font-extrabold text-cyan-400">{cut.totalWeight.toFixed(2)} lbs</p>
                                                      <p className="text-[11px] text-cool-gray-300 font-semibold mt-0.5">{cutPct.toFixed(1)}% of pack</p>
                                                    </div>
                                                  </div>
                                                  <div className="butcher-progress-track w-full h-1.5 rounded-sm overflow-hidden">
                                                    <div className="h-full bg-cyan-500 rounded-sm" style={{ width: `${Math.min(100, Math.max(0, cutPct))}%` }}></div>
                                                  </div>
                                                </div>
                                              );
                                            })
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Clear Visual Closure Footer for Expanded Order */}
                            <div className="pt-3 border-t butcher-log-divider flex items-center justify-between gap-3 flex-wrap">
                              <span className="text-xs text-cool-gray-400 font-medium">
                                Order #{order.orderNumber} · {order.species}
                              </span>
                              <button
                                type="button"
                                onClick={() => setExpandedOrder(null)}
                                className="butcher-log-chip-btn px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                              >
                                <ChevronDown size={14} className="rotate-180" />
                                <span>Collapse Breakdown</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'import' && (
          <div className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl p-4 sm:p-6">
            {unmappedCuts.length > 0 && (
              <div className="bg-yellow-950/30 p-6 rounded-2xl border border-yellow-800/50 shadow-sm space-y-6 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-yellow-900 mb-2">Import Attribute Mapping Wizard</h3>
                  <p className="text-sm text-yellow-800 font-medium">
                    Please map the unmatched items from the CSV to your product catalog.
                  </p>
                </div>
                
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                  {unmappedCuts.map((uncut) => (
                    <div key={uncut.rawCut} className="bg-cool-gray-850 p-4 rounded-xl border border-yellow-800/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="font-bold text-cool-gray-100 text-sm flex items-center gap-2">
                          {uncut.namePart}
                          <span className="bg-cool-gray-750 text-cool-gray-400 font-mono text-[10px] px-2 py-0.5 rounded-md font-bold border border-cool-gray-700">
                            Item #{uncut.itemNumber || 'N/A'}
                          </span>
                        </div>
                        <div className="text-xs text-cool-gray-400 mt-1 font-mono">Raw data: "{uncut.rawCut}"</div>
                      </div>
                      
                      <div className="w-full md:w-80 shrink-0">
                        <SearchableProductSelect
                          uncut={uncut}
                          products={products}
                          value={cutMappings[uncut.rawCut] || ''}
                          onChange={(val) => setCutMappings({ ...cutMappings, [uncut.rawCut]: val })}
                          onCreateNew={() => {
                            setCreateNewProductFor(uncut);
                            setCutMappings({ ...cutMappings, [uncut.rawCut]: '' });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex justify-end items-center gap-3 pt-4 border-t border-yellow-800/50">
                  <button 
                    type="button"
                    onClick={() => { 
                      resetImportCutsState();
                    }} 
                    className="px-5 py-2.5 text-yellow-800 hover:bg-yellow-900/50 font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel Import
                  </button>
                  <button 
                    type="button"
                    onClick={() => finalizeImportMapping()} 
                    disabled={unmappedCuts.some(c => !cutMappings[c.rawCut])} 
                    className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all cursor-pointer flex items-center gap-2 text-sm"
                  >
                    <CheckCircle2 size={16} />
                    {targetOrderId ? (
                      targetOrderStats ? (
                        targetOrderStats.updateCount > 0 && targetOrderStats.newCount > 0
                          ? `Save Mappings & Append ${targetOrderStats.newCount} New Cuts (${targetOrderStats.updateCount} updated • Total ${targetOrderStats.projectedTotal})`
                          : `Save Mappings & Append ${targetOrderStats.newCount} Cuts (Order Total: ${targetOrderStats.projectedTotal})`
                      ) : (
                        `Save Mappings & Finalize Append (${pendingImport?.records.length || 0} Cuts)`
                      )
                    ) : (
                      `Save Mappings & Complete Import (${pendingImport?.records.length || parsedRecords.length} Cuts)`
                    )}
                  </button>
                </div>
              </div>
            )}

            {createNewProductFor && (
              <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-cool-gray-850 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-cool-gray-750 max-h-[90vh] overflow-y-auto">
                  <h3 className="text-xl font-bold mb-4 text-white">Create New Product</h3>
                  <p className="text-sm text-cool-gray-400 mb-6">
                    Create a new product to map to <strong>{createNewProductFor.rawCut}</strong>.
                  </p>
                  <ManagementForms.ProductForm 
                    dispatch={dispatch} 
                    onClose={() => {
                      setCreateNewProductFor(null);
                      setCutMappings({...cutMappings, [createNewProductFor.rawCut]: ''});
                    }} 
                    products={products} 
                    state={state}
                    existingProduct={{ 
                      id: '', 
                      name: createNewProductFor.namePart, 
                      primaryCategory: '', 
                      subCategory: '', 
                      productNumbers: createNewProductFor.itemNumber ? [createNewProductFor.itemNumber] : []
                    } as Product}
                    onProductCreated={(newProduct) => { 
                      dispatch({ type: 'ADD_PRODUCT', payload: { product: newProduct } }); 
                      setCutMappings({ ...cutMappings, [createNewProductFor.rawCut]: newProduct.id }); 
                      setCreateNewProductFor(null);
                    }} 
                  />
                </div>
              </div>
            )}

            {unmappedCuts.length === 0 && (
            <form onSubmit={handleImportSubmit} className="space-y-6">
              
              {/* Target Order Mode Selector */}
              <div className="bg-cool-gray-900 border border-cool-gray-750 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-extrabold text-cool-gray-300 uppercase tracking-wider">
                    Order Destination & Mode
                  </span>
                  {targetOrderId && (
                    <span className="text-xs bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Appending to Order #{importForm.orderNumber}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      resetImportCutsState();
                      setTargetOrderId(null);
                      setImportForm({
                        orderNumber: '',
                        species: '',
                        animalCount: '',
                        killDate: '',
                        pickupDate: '',
                        birthDate: '',
                        notes: '',
                        liveWeight: '',
                        hotWeight: '',
                        coldWeight: '',
                        locationId: '',
                        importToOffSite: false,
                        targetLocationId: '',
                        targetPallet: '',
                        documents: [],
                        butcherFee: '',
                        tagIds: []
                      });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                      !targetOrderId 
                        ? 'bg-cyan-600 text-white shadow-md' 
                        : 'bg-cool-gray-800 text-cool-gray-400 hover:text-white border border-cool-gray-700'
                    }`}
                  >
                    <Plus size={15} />
                    Start New Butcher Order
                  </button>

                  {orders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const first = orders[0];
                        handleStartReceiveMoreCuts(first);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        targetOrderId 
                          ? 'bg-emerald-600 text-white shadow-md' 
                          : 'bg-cool-gray-800 text-cool-gray-400 hover:text-white border border-cool-gray-700'
                      }`}
                    >
                      <Upload size={15} />
                      Receive Additional Cuts into Existing Log
                    </button>
                  )}
                </div>

                {targetOrderId ? (
                  <div className="space-y-2 pt-2 border-t border-cool-gray-800">
                    <label className="block text-xs font-bold text-cool-gray-400">Select Existing Target Butcher Log</label>
                    <select
                      value={targetOrderId}
                      onChange={(e) => {
                        const selected = orders.find(o => o.id === e.target.value);
                        if (selected) {
                          handleStartReceiveMoreCuts(selected);
                        }
                      }}
                      className="w-full bg-cool-gray-800 border border-cool-gray-700 rounded-lg px-3 py-2 text-white font-medium focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                    >
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          Order #{o.orderNumber} - {o.species} ({o.animalCount ? `${o.animalCount} animals` : 'No count'}, Kill: {o.killDate || 'N/A'})
                        </option>
                      ))}
                    </select>
                    <div className="text-xs bg-emerald-950/40 border border-emerald-800/40 p-3 rounded-lg text-emerald-300 leading-relaxed">
                      <strong>⚡ Single-Log Preservation Active:</strong> Additional cuts from your amended CSV will be added directly into <strong>Order #{importForm.orderNumber}</strong>. Serialized cuts will be merged into this single log without duplicating animal counts, live weights, hot weights, or kill dates.
                    </div>
                  </div>
                ) : (
                  <div className="text-xs bg-cyan-950/30 border border-cyan-800/40 p-3 rounded-lg text-cyan-300 flex items-start gap-2">
                    <span className="text-cyan-400 font-bold shrink-0">💡 Animal Drop-Off:</span>
                    <span>
                      You don't need a CSV cutsheet right now. Enter your species, animal count, drop-off/kill date, and order number (or generate a temporary one). You can attach the cutsheet CSV later when cuts are ready!
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-cool-gray-300">
                      Cutsheet CSV <span className="text-xs font-normal text-cool-gray-400">(Optional for drop-off)</span>
                    </label>
                    {parsedRecords.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          resetImportCutsState();
                        }}
                        className="text-xs text-red-400 hover:text-red-300 font-medium cursor-pointer"
                      >
                        Remove CSV
                      </button>
                    )}
                  </div>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-cool-gray-700 border-dashed rounded-xl cursor-pointer bg-cool-gray-900/50 hover:bg-cool-gray-750 hover:border-cyan-500/50 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                      <Upload className="w-8 h-8 mb-2 text-cool-gray-400" />
                      <p className="text-sm text-cool-gray-300 font-medium">
                        <span className="font-bold text-cyan-400">Click to upload CSV</span> or drag and drop
                      </p>
                      <p className="text-[11px] text-cool-gray-500 mt-1">Leave empty to start a drop-off order without cuts</p>
                    </div>
                    <input 
                      key={fileInputKey} 
                      type="file" 
                      className="hidden" 
                      accept=".csv" 
                      onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                      onChange={handleFileUpload} 
                    />
                  </label>

                  {/* Manual Entry alternative option */}
                  <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-cool-gray-850 to-cool-gray-900 border border-cool-gray-750 rounded-xl shadow-xs">
                    <div className="space-y-0.5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">Different butcher without a CSV?</span>
                        <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800/80 px-2 py-0.5 rounded font-bold uppercase">Manual</span>
                      </div>
                      <p className="text-[11px] text-cool-gray-400">
                        Use the interactive form to select cuts, enter individual or bulk weights, and assign serials.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const existing = targetOrderId ? orders.find(o => o.id === targetOrderId) || null : null;
                        setManualEntryTargetOrder(existing);
                        setIsManualEntryOpen(true);
                      }}
                      className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 active:scale-95"
                    >
                      <Plus size={15} />
                      <span>Enter Cuts Manually</span>
                    </button>
                  </div>

                  {parsedRecords.length > 0 && (
                    <div className="p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-xs text-emerald-300 font-semibold space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                          Ready for Intake: {parsedRecords.length} cuts
                        </span>
                        {targetOrderId && targetOrderStats && (
                          <span className="bg-emerald-900/70 border border-emerald-700/60 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-emerald-200">
                            Resulting Order Total: {targetOrderStats.projectedTotal} cuts
                          </span>
                        )}
                      </div>
                      {targetOrderId && targetOrderStats && (
                        <div className="text-[11px] text-emerald-300/90 flex items-center gap-3 pt-1 border-t border-emerald-800/40 flex-wrap">
                          <span>Existing cuts in order: <strong className="text-white font-bold">{targetOrderStats.existingCount}</strong></span>
                          <span>Newly added cuts: <strong className="text-emerald-300 font-bold">+{targetOrderStats.newCount}</strong></span>
                          {targetOrderStats.updateCount > 0 && (
                            <span>Cuts updating existing records: <strong className="text-amber-300 font-bold">{targetOrderStats.updateCount}</strong></span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-cool-gray-400">Order #</label>
                        <button
                          type="button"
                          onClick={() => setImportForm(prev => ({ ...prev, orderNumber: generateTempOrderNumber() }))}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 px-1.5 py-0.5 rounded cursor-pointer transition"
                          title="Generate a temporary order ID"
                        >
                          Auto Temp #
                        </button>
                      </div>
                      <input 
                        type="text" 
                        placeholder="e.g. 1042 or TEMP-..."
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none text-sm placeholder:text-cool-gray-600"
                        value={importForm.orderNumber || ''}
                        onChange={e => setImportForm({...importForm, orderNumber: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Species *</label>
                      <CreatableDropdown
                        options={existingSpecies}
                        value={importForm.species || ''}
                        onChange={(val) => setImportForm({...importForm, species: val})}
                        placeholder="e.g. Pork"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Birth Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={importForm.birthDate || ''}
                        onChange={e => setImportForm({...importForm, birthDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Kill Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={importForm.killDate || ''}
                        onChange={e => setImportForm({...importForm, killDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Pickup Date</label>
                      <input 
                        type="date" 
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={importForm.pickupDate || ''}
                        onChange={e => setImportForm({...importForm, pickupDate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-cool-gray-400 mb-1">Animal Count</label>
                      <input 
                        type="number"
                        min="1" 
                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                        value={importForm.animalCount ?? ''}
                        onChange={e => setImportForm({...importForm, animalCount: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-cool-gray-900/50 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-4 gap-4 border border-cool-gray-700">
                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Live Weight (lbs)</label>
                  <input 
                    type="number" step="any"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={importForm.liveWeight ?? ''}
                    onChange={e => setImportForm({...importForm, liveWeight: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Hot Weight (lbs)</label>
                  <input 
                    type="number" step="any"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={importForm.hotWeight ?? ''}
                    onChange={e => setImportForm({...importForm, hotWeight: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Cold Weight (lbs)</label>
                  <input 
                    type="number" step="any"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={importForm.coldWeight ?? ''}
                    onChange={e => setImportForm({...importForm, coldWeight: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Butcher Fee ($)</label>
                  <input 
                    type="number" step="any" min="0"
                    placeholder="0.00"
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    value={importForm.butcherFee ?? ''}
                    onChange={e => setImportForm({...importForm, butcherFee: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-cool-gray-300 mb-2">
                      Butcher / Location Source <span className="text-red-400">*</span>
                    </label>
                    <select
                      required
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={importForm.locationId || ''}
                      onChange={e => {
                        const newLocId = e.target.value;
                        setImportForm(prev => {
                          let nextPallet = prev.targetPallet;
                          // If no explicit targetLocationId, then Butcher Source is the effective destination
                          if (!prev.targetLocationId && nextPallet) {
                            const newLoc = locations.find(l => l.id === newLocId);
                            const currentPalletLocName = palletLocationMap.get(nextPallet.toLowerCase().trim());
                            if (currentPalletLocName && newLoc && currentPalletLocName.toLowerCase() !== newLoc.name.toLowerCase()) {
                              nextPallet = '';
                            }
                          }
                          return {
                            ...prev,
                            locationId: newLocId,
                            targetPallet: nextPallet
                          };
                        });
                      }}
                    >
                      <option value="">-- Select Source --</option>
                      {locations.filter(l => l.type === 'delivery_pickup' || !l.isHome).map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="bg-cool-gray-900/50 p-4 rounded-xl border border-cool-gray-700">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <div className="mt-0.5">
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded border-cool-gray-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-cool-gray-900 bg-cool-gray-800"
                          checked={importForm.importToOffSite}
                          onChange={e => setImportForm({...importForm, importToOffSite: e.target.checked})}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">Import directly into Off-Site Inventory</p>
                        <p className="text-xs text-cool-gray-400 mt-1">If checked, this will add all {parsedRecords.length} records directly into your active Off-Site inventory. Leave unchecked to only store historical records.</p>
                      </div>
                    </label>

                    {importForm.importToOffSite && (
                      <div className="mt-4 pt-3 border-t border-cool-gray-800 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                            Destination Storage Location
                          </label>
                          <select
                            className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:ring-1 focus:ring-cyan-500 outline-none"
                            value={importForm.targetLocationId || ''}
                            onChange={e => {
                              const newTargetLocId = e.target.value;
                              const effLocId = newTargetLocId || importForm.locationId || '';
                              const effLoc = locations.find(l => l.id === effLocId);
                              setImportForm(prev => {
                                let nextPallet = prev.targetPallet;
                                if (nextPallet) {
                                  const currentPalletLocName = palletLocationMap.get(nextPallet.toLowerCase().trim());
                                  if (currentPalletLocName && effLoc && currentPalletLocName.toLowerCase() !== effLoc.name.toLowerCase()) {
                                    nextPallet = '';
                                  }
                                }
                                return {
                                  ...prev,
                                  targetLocationId: newTargetLocId,
                                  targetPallet: nextPallet
                                };
                              });
                            }}
                          >
                            <option value="">Same as Butcher Source ({locations.find(l => l.id === importForm.locationId)?.name || 'Default Source'})</option>
                            {locations.map(loc => (
                              <option key={loc.id} value={loc.id}>{loc.name} {loc.isHome ? '(Farm / Home)' : loc.type === 'storage' ? '(Storage Facility)' : ''}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-cool-gray-300 mb-1">
                            Destination Pallet / Placement <span className="text-red-400 font-extrabold">*</span> {activeTargetLocation ? <span className="text-cyan-400 font-normal">at {activeTargetLocation.name}</span> : ''}
                          </label>
                          <PalletCreatableSelect
                            options={existingActivePalletsForDestination}
                            value={importForm.targetPallet || ''}
                            onChange={(val) => setImportForm({...importForm, targetPallet: val})}
                            placeholder={activeTargetLocation?.name ? `Select active pallet at ${activeTargetLocation.name} (Required) or type to create new...` : `Select existing active pallet (Required) or type to create new...`}
                            destinationName={activeTargetLocation?.name || ''}
                            palletLocationMap={palletLocationMap}
                            required={true}
                            hasError={!importForm.targetPallet?.trim()}
                          />
                          {!importForm.targetPallet?.trim() && (
                            <p className="text-[11px] text-amber-400 font-medium mt-1.5 flex items-center gap-1.5">
                              <AlertCircle size={13} className="shrink-0 text-amber-400" />
                              <span>Pallet selection is required when importing into off-site inventory.</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-cool-gray-300 mb-2">Generic Notes</label>
                  <textarea
                    rows={4}
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none resize-none mb-4"
                    placeholder="Add generic notes about this butcher order (animals, transport, yield comments)..."
                    value={importForm.notes || ''}
                    onChange={e => setImportForm({...importForm, notes: e.target.value})}
                  />

                  {/* Butcher Order Tags / Flags */}
                  <div className="border-t border-cool-gray-700/50 pt-4 mb-4">
                    <label className="block text-xs font-bold text-cool-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <TagIcon size={12} className="text-cyan-400" />
                      Order Tags / Flags
                    </label>
                    {butcherTags.length === 0 ? (
                      <p className="text-xs text-cool-gray-500 bg-cool-gray-900/30 p-2.5 rounded-lg border border-cool-gray-800">
                        No order tags configured yet. Add tags (e.g., Retired Sow) in Catalog &amp; Settings → Operations → Butcher Settings.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {butcherTags.map(tag => {
                          const isSelected = (importForm.tagIds || []).includes(tag.id);
                          const modeSuffix =
                            tag.weightCheckMode === 'separate_baseline'
                              ? 'Split'
                              : tag.weightCheckMode === 'exclude_from_baseline'
                                ? 'Exclude'
                                : null;
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => {
                                const current = importForm.tagIds || [];
                                const next = isSelected
                                  ? current.filter(id => id !== tag.id)
                                  : [...current, tag.id];
                                setImportForm({ ...importForm, tagIds: next });
                              }}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                isSelected
                                  ? 'bg-cool-gray-800 border-cyan-500 text-white'
                                  : 'bg-cool-gray-900 border-cool-gray-750 text-cool-gray-400 hover:text-cool-gray-200 hover:border-cool-gray-600'
                              }`}
                            >
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: tag.color || '#06b6d4' }}
                              />
                              <span>{tag.name}</span>
                              {modeSuffix && (
                                <span className="text-[10px] text-cool-gray-400 font-normal">· {modeSuffix}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Associated Documents in Import Form */}
                  <div className="border-t border-cool-gray-700/50 pt-4">
                    <label className="block text-xs font-bold text-cool-gray-400 mb-2 uppercase tracking-wider">Associated Document Links</label>
                    
                    {(!importForm.documents || importForm.documents.length === 0) ? (
                      <p className="text-xs text-cool-gray-500 italic mb-3 bg-cool-gray-900/30 p-2.5 rounded-lg text-center text-cool-gray-400">No documents added yet.</p>
                    ) : (
                      <div className="space-y-2 mb-3">
                        {importForm.documents.map((doc: any) => (
                          <div key={doc.id} className="flex items-center justify-between bg-cool-gray-900/50 p-2 rounded-lg border border-cool-gray-800 text-xs">
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                              <Link size={14} className="text-cool-gray-400 shrink-0" />
                              <span className="font-bold text-white truncate">{resolveDocumentDisplayName(doc, documentLinkTypes)}</span>
                              <span className="text-cool-gray-500 truncate text-[11px] font-mono">({doc.url})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updatedDocs = (importForm.documents || []).filter((d: any) => d.id !== doc.id);
                                setImportForm({ ...importForm, documents: updatedDocs });
                              }}
                              className="text-cool-gray-500 hover:text-red-400 p-1 rounded hover:bg-cool-gray-800 transition shrink-0"
                              title="Remove document link"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="bg-cool-gray-900/30 p-3 rounded-xl border border-cool-gray-800 space-y-3">
                      <p className="text-xs font-bold text-cool-gray-300">Add a Document Link</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {documentLinkTypes.length > 0 && (
                          <select
                            className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 sm:col-span-2"
                            value={
                              documentLinkTypes.some(t => t.id === importNewDocTypeId)
                                ? importNewDocTypeId
                                : '__CUSTOM__'
                            }
                            onChange={e => setImportNewDocTypeId(e.target.value)}
                          >
                            <option value="__CUSTOM__">Custom Link Name...</option>
                            {documentLinkTypes.map(dt => (
                              <option key={dt.id} value={dt.id}>{dt.name}</option>
                            ))}
                          </select>
                        )}
                        {(documentLinkTypes.length === 0 || !documentLinkTypes.some(t => t.id === importNewDocTypeId)) && (
                          <input
                            type="text"
                            placeholder="Document Name (e.g. Cutsheet, Invoice, Yield)"
                            className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                            value={importNewDocName}
                            onChange={e => setImportNewDocName(e.target.value)}
                          />
                        )}
                        <input
                          type="url"
                          placeholder="URL (https://...)"
                          className={`bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 ${
                            documentLinkTypes.some(t => t.id === importNewDocTypeId) ? 'sm:col-span-2' : ''
                          }`}
                          value={importNewDocUrl}
                          onChange={e => setImportNewDocUrl(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-cool-gray-800">
                        {documentLinkTypes.length === 0 ? (
                          <span className="text-[11px] text-cool-gray-500">
                            Tip: Add reusable link types in Butcher Settings.
                          </span>
                        ) : <span />}
                        <button
                          type="button"
                          onClick={() => {
                            const matchedType = documentLinkTypes.find(t => t.id === importNewDocTypeId);
                            const name = matchedType ? matchedType.name : importNewDocName.trim();
                            let url = importNewDocUrl.trim();
                            if (!name || !url) return;
                            
                            if (!/^https?:\/\//i.test(url)) {
                              url = 'https://' + url;
                            }

                            const newDoc: ButcherOrderDocument = {
                              id: crypto.randomUUID(),
                              name,
                              url,
                              ...(matchedType ? { typeId: matchedType.id } : {})
                            };
                            
                            setImportForm({
                              ...importForm,
                              documents: [...(importForm.documents || []), newDoc]
                            });
                            
                            setImportNewDocName('');
                            setImportNewDocUrl('');
                          }}
                          className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} />
                          Attach Document Link
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validation Warning when off-site import is missing a pallet selection */}
              {importForm.importToOffSite && !importForm.targetPallet?.trim() && (targetOrderId || parsedRecords.length > 0) && (
                <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl text-amber-300 text-xs font-semibold">
                  <AlertCircle size={16} className="shrink-0 text-amber-400" />
                  <span>A destination pallet is required before importing cuts into off-site inventory. Please select or enter a pallet above.</span>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-cool-gray-700 gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleClearImportForm}
                  className="px-5 py-3 bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-300 hover:text-white border border-cool-gray-700 font-extrabold rounded-xl transition-colors flex items-center gap-2 cursor-pointer text-sm"
                >
                  <X size={18} />
                  Cancel / Clear Form
                </button>
                <button
                  type="submit"
                  disabled={
                    targetOrderId 
                      ? (!parsedRecords.length || (importForm.importToOffSite && !importForm.targetPallet?.trim())) 
                      : (!importForm.species || !importForm.species.trim() || (importForm.importToOffSite && parsedRecords.length > 0 && !importForm.targetPallet?.trim()))
                  }
                  title={
                    importForm.importToOffSite && !importForm.targetPallet?.trim() && (targetOrderId || parsedRecords.length > 0)
                      ? "A destination pallet must be selected or created for off-site inventory"
                      : undefined
                  }
                  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold rounded-xl shadow-md transition-colors flex items-center gap-2 text-sm cursor-pointer"
                >
                  <ArrowRight size={18} />
                  {targetOrderId ? (
                    parsedRecords.length > 0 ? (
                      targetOrderStats && targetOrderStats.updateCount > 0 ? (
                        targetOrderStats.newCount > 0 ? (
                          `Upload & Append: ${targetOrderStats.newCount} New Cuts (${targetOrderStats.updateCount} updated • Total ${targetOrderStats.projectedTotal})`
                        ) : (
                          `Upload & Update ${targetOrderStats.updateCount} Existing Cuts in Order #${importForm.orderNumber}`
                        )
                      ) : (
                        `Upload & Append ${parsedRecords.length} Cuts to Order #${importForm.orderNumber} (Order Total: ${targetOrderStats?.projectedTotal ?? parsedRecords.length})`
                      )
                    ) : (
                      `Upload Cutsheet CSV to Append Cuts to Order #${importForm.orderNumber}`
                    )
                  ) : (
                    parsedRecords.length > 0
                      ? `Import Order & ${parsedRecords.length} Cuts`
                      : `Start Butcher Order (${(importForm.orderNumber || '').trim() || 'Auto Temp #'})`
                  )}
                </button>
              </div>
            </form>
            )}
          </div>
        )}

        {activeTab === 'reports' && (() => {
          // Filter using the unified filter engine and sort chronologically
          const matchedOrders = orders.filter(o =>
            matchesButcherOrderFilters(o, recordsByOrderId.get(o.id) || [], reportFilter, {
              tags: butcherTags,
              locationName: locationNameById.get((o.locationId || '').trim()) || '',
              viewOriginalNames,
            })
          ).sort((a, b) => {
            const dateA = a.killDate || a.pickupDate || '';
            const dateB = b.killDate || b.pickupDate || '';
            return dateA.localeCompare(dateB) || a.createdAt - b.createdAt;
          });

          const allMatchedOrdersWithMode = matchedOrders.map(o => {
            const matchingRecords = recordsByOrderId.get(o.id) || [];
            const analysis = reviewQueueSummary.allOrderAnalyses.get(o.id);
            const modeResult = computeOrderStatsWithMode(o, matchingRecords, reportMode, analysis);
            return {
              order: o,
              stats: modeResult.stats,
              actualStats: modeResult.actualStats,
              modeResult,
              analysis,
            };
          });

          const excludedFlaggedOrders = reportMode === 'exclude_flagged'
            ? allMatchedOrdersWithMode.filter(item => item.modeResult.excludedFromAverages)
            : [];

          const rOrdersWithStats = reportMode === 'exclude_flagged'
            ? allMatchedOrdersWithMode.filter(item => !item.modeResult.excludedFromAverages)
            : allMatchedOrdersWithMode;

          const timelineReport = computeButcherTimelineReport(
            rOrdersWithStats.map(({ order, stats }) => ({
              order,
              records: recordsByOrderId.get(order.id) || [],
              stats,
            })),
            locationNameById
          );

          // Calculate Averages (Per-Animal basis)
          const averages = (() => {
            let liveSum = 0, liveAnimals = 0;
            let hotSum = 0, hotAnimals = 0;
            let coldSum = 0, coldAnimals = 0;
            let packSum = 0, packAnimals = 0;
            
            let hotYieldSum = 0, hotYieldCount = 0;
            let shrinkSum = 0, shrinkCount = 0;
            let cutYieldSum = 0, cutYieldCount = 0;
            let finishLiveSum = 0, finishLiveCount = 0;

            rOrdersWithStats.forEach(({ order, stats }) => {
              const animalCount = Math.max(1, order.animalCount || 1);
              
              if (stats.liveWeight > 0) {
                liveSum += stats.liveWeight;
                liveAnimals += animalCount;
              }
              if (stats.hotWeight > 0) {
                hotSum += stats.hotWeight;
                hotAnimals += animalCount;
              }
              if (stats.coldWeight > 0) {
                coldSum += stats.coldWeight;
                coldAnimals += animalCount;
              }
              if (stats.packagedWeight > 0) {
                packSum += stats.packagedWeight;
                packAnimals += animalCount;
              }

              if (stats.hotWeightYield > 0) {
                hotYieldSum += stats.hotWeightYield;
                hotYieldCount++;
              }
              if (stats.coolerShrinkage > 0) {
                shrinkSum += stats.coolerShrinkage;
                shrinkCount++;
              }
              if (stats.cuttingYield > 0) {
                cutYieldSum += stats.cuttingYield;
                cutYieldCount++;
              }
              if (stats.finishToLiveYield > 0) {
                finishLiveSum += stats.finishToLiveYield;
                finishLiveCount++;
              }
            });

            return {
              avgLive: liveAnimals > 0 ? liveSum / liveAnimals : 0,
              avgHot: hotAnimals > 0 ? hotSum / hotAnimals : 0,
              avgCold: coldAnimals > 0 ? coldSum / coldAnimals : 0,
              avgPackaged: packAnimals > 0 ? packSum / packAnimals : 0,
              avgHotYield: hotYieldCount > 0 ? hotYieldSum / hotYieldCount : 0,
              avgShrink: shrinkCount > 0 ? shrinkSum / shrinkCount : 0,
              avgCutYield: cutYieldCount > 0 ? cutYieldSum / cutYieldCount : 0,
              avgFinishLive: finishLiveCount > 0 ? finishLiveSum / finishLiveCount : 0,
            };
          })();

          // Group by Species for comparisons (Per-Animal basis)
          const speciesComparisonData = (() => {
            const grouped: Record<string, {
              species: string;
              orderCount: number;
              animalCount: number;
              liveSum: number; liveAnimals: number;
              hotYieldSum: number; hotYieldCount: number;
              shrinkSum: number; shrinkCount: number;
              cutYieldSum: number; cutYieldCount: number;
              packagedSum: number; packagedAnimals: number;
            }> = {};

            rOrdersWithStats.forEach(({ order, stats }) => {
              const sp = order.species || 'Unknown';
              const aCount = Math.max(1, order.animalCount || 1);
              if (!grouped[sp]) {
                grouped[sp] = {
                  species: sp,
                  orderCount: 0,
                  animalCount: 0,
                  liveSum: 0, liveAnimals: 0,
                  hotYieldSum: 0, hotYieldCount: 0,
                  shrinkSum: 0, shrinkCount: 0,
                  cutYieldSum: 0, cutYieldCount: 0,
                  packagedSum: 0, packagedAnimals: 0
                };
              }

              const g = grouped[sp];
              g.orderCount++;
              g.animalCount += aCount;
              if (stats.liveWeight > 0) {
                g.liveSum += stats.liveWeight;
                g.liveAnimals += aCount;
              }
              if (stats.hotWeightYield > 0) {
                g.hotYieldSum += stats.hotWeightYield;
                g.hotYieldCount++;
              }
              if (stats.coolerShrinkage > 0) {
                g.shrinkSum += stats.coolerShrinkage;
                g.shrinkCount++;
              }
              if (stats.cuttingYield > 0) {
                g.cutYieldSum += stats.cuttingYield;
                g.cutYieldCount++;
              }
              if (stats.packagedWeight > 0) {
                g.packagedSum += stats.packagedWeight;
                g.packagedAnimals += aCount;
              }
            });

            return Object.values(grouped).map(g => ({
              species: g.species,
              orderCount: g.orderCount,
              animalCount: g.animalCount,
              avgLive: g.liveAnimals > 0 ? g.liveSum / g.liveAnimals : 0,
              avgHotYield: g.hotYieldCount > 0 ? g.hotYieldSum / g.hotYieldCount : 0,
              avgShrink: g.shrinkCount > 0 ? g.shrinkSum / g.shrinkCount : 0,
              avgCutYield: g.cutYieldCount > 0 ? g.cutYieldSum / g.cutYieldCount : 0,
              avgPackaged: g.packagedAnimals > 0 ? g.packagedSum / g.packagedAnimals : 0,
              totalPackaged: g.packagedSum,
            })).sort((a, b) => b.orderCount - a.orderCount);
          })();

          // Rebuilt responsive chart geometry (viewBox 760x300) with guaranteed fit & clipping
          const SVG_W = 760;
          const SVG_H = 300;
          const chartPaddingLeft = 58;
          const chartPaddingRight = 24;
          const chartPaddingTop = 20;
          const chartPaddingBottom = 38;
          const plotWidth = SVG_W - chartPaddingLeft - chartPaddingRight;
          const plotHeight = SVG_H - chartPaddingTop - chartPaddingBottom;
          const plotBottom = chartPaddingTop + plotHeight;
          const totalPoints = rOrdersWithStats.length;

          const getPointX = (idx: number) =>
            chartPaddingLeft + (totalPoints > 1 ? (idx / (totalPoints - 1)) * plotWidth : plotWidth / 2);

          // 1. Yield Trends: dynamic auto-fitting Y-axis so extreme actuals (>100% or negative shrink) always fit cleanly
          const yieldRawSeries = rOrdersWithStats.map(({ order, stats, actualStats, modeResult, analysis }, idx) => ({
            order,
            stats,
            actualStats,
            modeResult,
            analysis,
            x: getPointX(idx),
            dressingVal: stats.liveWeight > 0 && stats.hotWeight > 0 ? stats.hotWeightYield : null,
            shrinkVal: stats.hotWeight > 0 && stats.coldWeight > 0 ? stats.coolerShrinkage : null,
            cuttingVal: stats.coldWeight > 0 && stats.packagedWeight > 0 ? stats.cuttingYield : null,
            takeHomeVal: stats.liveWeight > 0 && stats.packagedWeight > 0 ? stats.finishToLiveYield : null,
          }));

          const visibleYieldValues: number[] = [];
          yieldRawSeries.forEach(pt => {
            if (visibleYieldSeries.dressing && pt.dressingVal !== null) visibleYieldValues.push(pt.dressingVal);
            if (visibleYieldSeries.shrink && pt.shrinkVal !== null) visibleYieldValues.push(pt.shrinkVal);
            if (visibleYieldSeries.cutting && pt.cuttingVal !== null) visibleYieldValues.push(pt.cuttingVal);
            if (visibleYieldSeries.takeHome && pt.takeHomeVal !== null) visibleYieldValues.push(pt.takeHomeVal);
          });

          const yieldYScale = computeChartYAxisScale(visibleYieldValues, {
            baselineMin: 0,
            baselineMax: 100,
            headroomRatio: 0.1,
            targetIntervals: 4,
            allowNegative: true,
          });
          const yieldAutoExpanded = yieldYScale.min < 0 || yieldYScale.max > 100;

          const yieldCoords = yieldRawSeries.map(pt => ({
            ...pt,
            yDressing: pt.dressingVal !== null ? yieldYScale.mapY(pt.dressingVal, chartPaddingTop, plotHeight) : null,
            yShrink: pt.shrinkVal !== null ? yieldYScale.mapY(pt.shrinkVal, chartPaddingTop, plotHeight) : null,
            yCutting: pt.cuttingVal !== null ? yieldYScale.mapY(pt.cuttingVal, chartPaddingTop, plotHeight) : null,
            yTakeHome: pt.takeHomeVal !== null ? yieldYScale.mapY(pt.takeHomeVal, chartPaddingTop, plotHeight) : null,
          }));

          // 2. Weights Timeline (Per-Animal basis): auto-fitting Y-axis across visible weight series
          const weightRawSeries = rOrdersWithStats.map(({ order, stats, actualStats, modeResult, analysis }, idx) => ({
            order,
            stats,
            actualStats,
            modeResult,
            analysis,
            x: getPointX(idx),
            liveVal: stats.liveWeightPerAnimal > 0 ? stats.liveWeightPerAnimal : null,
            hotVal: stats.hotWeightPerAnimal > 0 ? stats.hotWeightPerAnimal : null,
            coldVal: stats.coldWeightPerAnimal > 0 ? stats.coldWeightPerAnimal : null,
            packagedVal: stats.packagedWeightPerAnimal > 0 ? stats.packagedWeightPerAnimal : null,
          }));

          const visibleWeightValues: number[] = [];
          weightRawSeries.forEach(pt => {
            if (visibleWeightSeries.live && pt.liveVal !== null) visibleWeightValues.push(pt.liveVal);
            if (visibleWeightSeries.hot && pt.hotVal !== null) visibleWeightValues.push(pt.hotVal);
            if (visibleWeightSeries.cold && pt.coldVal !== null) visibleWeightValues.push(pt.coldVal);
            if (visibleWeightSeries.packaged && pt.packagedVal !== null) visibleWeightValues.push(pt.packagedVal);
          });

          const weightYScale = computeChartYAxisScale(visibleWeightValues, {
            baselineMin: 0,
            baselineMax: 10,
            headroomRatio: 0.12,
            targetIntervals: 4,
            allowNegative: false,
          });
          const weightZeroY = weightYScale.mapY(0, chartPaddingTop, plotHeight);

          const weightCoords = weightRawSeries.map(pt => ({
            ...pt,
            yLive: pt.liveVal !== null ? weightYScale.mapY(pt.liveVal, chartPaddingTop, plotHeight) : null,
            yHot: pt.hotVal !== null ? weightYScale.mapY(pt.hotVal, chartPaddingTop, plotHeight) : null,
            yCold: pt.coldVal !== null ? weightYScale.mapY(pt.coldVal, chartPaddingTop, plotHeight) : null,
            yPackaged: pt.packagedVal !== null ? weightYScale.mapY(pt.packagedVal, chartPaddingTop, plotHeight) : null,
          }));

          // 3. Cuts Over Time (multi-select, compare, additive) with O(1) per-order lookup & dynamic Y scale
          const activeCutsForTrend = selectedCutsForTrend.length > 0
            ? selectedCutsForTrend
            : (reportData.breakdown[0]?.name ? [reportData.breakdown[0].name] : []);

          const CUT_COLORS = [
            '#22d3ee', // cyan
            '#f43f5e', // rose
            '#10b981', // emerald
            '#fbbf24', // amber
            '#8b5cf6', // violet
            '#ec4899', // pink
            '#3b82f6', // blue
            '#f97316', // orange
          ];

          const cutTrendCoordsAdditive = rOrdersWithStats.map(({ order, stats }) => {
            const orderRecords = recordsByOrderId.get(order.id) || [];
            let combinedWeight = 0;
            orderRecords.forEach(r => {
              const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
              if (name && activeCutsForTrend.some(cName => cName.toLowerCase() === name.toLowerCase())) {
                combinedWeight += r.netWeight;
              }
            });
            const pct = stats.packagedWeight > 0 ? (combinedWeight / stats.packagedWeight) * 100 : 0;
            return {
              order,
              weight: combinedWeight,
              percentage: pct,
            };
          });

          const cutTrendsByCut = activeCutsForTrend.map(cutName => {
            const coords = rOrdersWithStats.map(({ order, stats }) => {
              const orderRecords = recordsByOrderId.get(order.id) || [];
              let cutWeight = 0;
              orderRecords.forEach(r => {
                const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
                if (name && name.toLowerCase() === cutName.toLowerCase()) {
                  cutWeight += r.netWeight;
                }
              });
              const pct = stats.packagedWeight > 0 ? (cutWeight / stats.packagedWeight) * 100 : 0;
              return {
                order,
                weight: cutWeight,
                percentage: pct,
              };
            });
            return {
              cutName,
              coords,
            };
          });

          const visibleCutPctValues: number[] =
            cutTrendMode === 'additive'
              ? cutTrendCoordsAdditive.map(c => c.percentage)
              : cutTrendsByCut.flatMap(t => t.coords.map(c => c.percentage));

          const cutYScale = computeChartYAxisScale(visibleCutPctValues, {
            baselineMin: 0,
            baselineMax: 10,
            headroomRatio: 0.15,
            targetIntervals: 4,
            allowNegative: false,
          });
          const cutZeroY = cutYScale.mapY(0, chartPaddingTop, plotHeight);

          const cutTrendPointCoordsAdditive = cutTrendCoordsAdditive.map((c, idx) => ({
            ...c,
            x: getPointX(idx),
            y: cutYScale.mapY(c.percentage, chartPaddingTop, plotHeight),
          }));

          const cutTrendsPointCoordsByCut = cutTrendsByCut.map((trend, trendIdx) => ({
            cutName: trend.cutName,
            color: CUT_COLORS[trendIdx % CUT_COLORS.length],
            points: trend.coords.map((c, idx) => ({
              ...c,
              x: getPointX(idx),
              y: cutYScale.mapY(c.percentage, chartPaddingTop, plotHeight),
            })),
          }));

          const cutTrendPointCoords = cutTrendMode === 'additive'
            ? cutTrendPointCoordsAdditive
            : (cutTrendsPointCoordsByCut[0]?.points || []);

          // Total packaged meat respecting estimates mode when no cut/category filter narrows the dataset
          const totalPackagedSummaryLbs =
            reportMode === 'estimates' &&
            reportFilter.cutName.length === 0 &&
            reportFilter.primaryCategory.length === 0 &&
            reportFilter.subCategory.length === 0
              ? rOrdersWithStats.reduce((sum, item) => sum + item.stats.packagedWeight, 0)
              : reportData.totalWeight;

          // Filtered aggregated cut breakdown for the Cut Breakdown report type
          const filteredReportBreakdown = filterCutBreakdown(reportData.breakdown, reportBreakdownSearch);
          let pricedBreakdownCutCount = 0;
          const totalBreakdownEstValue = filteredReportBreakdown.reduce((sum, cut) => {
            const matchedProd = products.find(
              p =>
                (cut.productId && p.id === cut.productId) ||
                p.name.trim().toLowerCase() === cut.name.trim().toLowerCase()
            );
            const price = matchedProd?.salePrice || 0;
            const unit = matchedProd?.salePriceUnit || 'lb';
            if (price > 0) pricedBreakdownCutCount += 1;
            const cutVal = price > 0 ? (unit === 'package' ? cut.count * price : cut.totalWeight * price) : 0;
            return sum + cutVal;
          }, 0);

          const toggleYieldSeries = (key: keyof typeof visibleYieldSeries) => {
            setVisibleYieldSeries(prev => {
              const activeCount = Object.values(prev).filter(Boolean).length;
              if (prev[key] && activeCount <= 1) return prev;
              return { ...prev, [key]: !prev[key] };
            });
          };

          const toggleWeightSeries = (key: keyof typeof visibleWeightSeries) => {
            setVisibleWeightSeries(prev => {
              const activeCount = Object.values(prev).filter(Boolean).length;
              if (prev[key] && activeCount <= 1) return prev;
              return { ...prev, [key]: !prev[key] };
            });
          };

          const reportBasisShortLabel =
            reportMode === 'estimates'
              ? 'Corrected Estimates'
              : reportMode === 'exclude_flagged'
                ? 'Exclude Flagged'
                : 'Actuals';

          const reportKpiContext: ButcherReportKpiContext = {
            orderCount: reportData.orderCount,
            animalCount: reportData.animalCount,
            reportMode,
            averages,
            ordersWithStats: rOrdersWithStats.map(({ order, stats }) => ({ order, stats })),
            totalPackagedLbs: totalPackagedSummaryLbs,
            cutTrends: {
              selectedCuts: activeCutsForTrend,
              mode: cutTrendMode === 'additive' ? 'additive' : 'compare',
              additivePoints: cutTrendCoordsAdditive.map(c => ({
                orderNumber: c.order.orderNumber,
                weight: c.weight,
                percentage: c.percentage,
              })),
            },
            breakdown: {
              allRows: reportData.breakdown,
              filteredRows: filteredReportBreakdown,
              totalWeightAll: reportData.totalWeight,
              searchQuery: reportBreakdownSearch,
              totalEstValue: totalBreakdownEstValue,
              pricedCutCount: pricedBreakdownCutCount,
            },
            speciesComparison: speciesComparisonData,
            timelineReport,
          };

          const activeReportKpis = buildButcherReportKpis(reportGraphTab, reportKpiContext);
          const kpiGridColsClass = getKpiGridColumnsClass(activeReportKpis.length);
          const kpiToneClass: Record<ButcherReportKpiTone, string> = {
            neutral: 'text-white',
            cyan: 'text-cyan-400',
            amber: 'text-amber-400',
            rose: 'text-rose-400',
            emerald: 'text-emerald-400',
            indigo: 'text-indigo-400',
            blue: 'text-blue-400',
            violet: 'text-violet-400',
          };

          const reportTabBtnClass = (active: boolean) =>
            `px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center gap-1.5 ${
              active
                ? 'bg-cyan-600 text-white shadow'
                : 'text-cool-gray-400 hover:text-white'
            }`;

          return (
            <div className="space-y-3.5">
              {renderActiveFilterSummaryBar(
                'butcher-reports-active-filters',
                reportFilter,
                setReportFilter,
                reportsActiveFilterCount,
                {
                  mode: reportMode,
                  onResetMode: () => setReportMode('actuals'),
                  excludedCount: excludedFlaggedOrders.length,
                }
              )}

              {/* 1. Primary Report Type Selector Bar (above contextual statistics for scalable multi-report workspace) */}
              <div
                data-testid="butcher-report-selector-bar"
                className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 shadow-sm"
              >
                <div
                  data-testid="butcher-report-type-selector"
                  className="flex flex-wrap items-center bg-cool-gray-950 p-1 rounded-xl border border-cool-gray-700 gap-1"
                >
                  {BUTCHER_REPORT_DEFINITIONS.map(def => {
                    const active = reportGraphTab === def.id;
                    const badge = def.getBadge?.(reportKpiContext);
                    return (
                      <button
                        key={def.id}
                        type="button"
                        data-testid={def.testId}
                        title={def.description}
                        onClick={() => setReportGraphTab(def.id)}
                        className={reportTabBtnClass(active)}
                      >
                        <span>{def.label}</span>
                        {badge && (
                          <span
                            className={`font-mono text-[10px] ${
                              badge.tone === 'amber'
                                ? active
                                  ? 'text-amber-200'
                                  : 'text-amber-400'
                                : active
                                  ? 'text-cyan-100'
                                  : 'text-cool-gray-500'
                            }`}
                          >
                            ({badge.text})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-cool-gray-400 bg-cool-gray-950/70 border border-cool-gray-750 rounded-lg px-2.5 py-1 whitespace-nowrap">
                    Basis: <strong className="text-cool-gray-100">{reportBasisShortLabel}</strong>
                  </span>
                  {reviewQueueSummary.counts.anomaly > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewFilterCategory('anomaly');
                        setActiveTab('review');
                      }}
                      className="px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                    >
                      <AlertTriangle size={12} />
                      <span>Review {reviewQueueSummary.counts.anomaly} Flagged</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Contextual Report Statistics Strip (dynamically tailored to the active report) */}
              <div
                data-testid="butcher-reports-kpi-strip"
                data-report-type={reportGraphTab}
                className={`grid ${kpiGridColsClass} gap-2`}
              >
                {activeReportKpis.map(kpi => (
                  <div
                    key={kpi.id}
                    data-testid={`butcher-report-kpi-${kpi.id}`}
                    className="butcher-stat-card rounded-xl px-3 py-2.5 flex flex-col justify-between min-w-0"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cool-gray-400 truncate">
                      {kpi.label}
                    </span>
                    <div className="mt-1 flex items-baseline gap-1 min-w-0">
                      <span
                        className={`text-base font-extrabold font-mono tabular-nums truncate ${
                          kpiToneClass[kpi.tone || 'neutral']
                        }`}
                        title={kpi.value}
                      >
                        {kpi.value}
                      </span>
                      {kpi.unit && (
                        <span className="text-[10px] font-semibold text-cool-gray-400 shrink-0">
                          {kpi.unit}
                        </span>
                      )}
                    </div>
                    {kpi.subValue && (
                      <span
                        className="mt-0.5 text-[10px] text-cool-gray-500 font-mono tabular-nums truncate"
                        title={kpi.subValue}
                      >
                        {kpi.subValue}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* 3. Active Report Visualization / Table Body */}
              <div
                data-testid="butcher-reports-dashboard"
                className="bg-cool-gray-800 border border-cool-gray-700 rounded-2xl overflow-hidden shadow-xl"
              >
                {/* Active Report Content */}
                <div className="p-4 sm:p-5 bg-cool-gray-800">
                  {totalPoints === 0 && reportGraphTab !== 'breakdown' ? (
                    <div className="text-center py-16 text-cool-gray-400 border border-dashed border-cool-gray-700 rounded-xl">
                      <p className="font-semibold">No orders matching the active filters to render trends.</p>
                      <p className="text-xs text-cool-gray-500 mt-1">Adjust your dates, species, reporting basis, or filters using the Filters button in the top bar.</p>
                    </div>
                  ) : (
                    <>
                      {/* 1. YIELD TRENDS LINE GRAPH */}
                      {reportGraphTab === 'yields' && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {([
                                { key: 'dressing' as const, label: 'Dressing (Hot/Live)', color: '#f59e0b' },
                                { key: 'shrink' as const, label: 'Cooler Shrink %', color: '#f43f5e' },
                                { key: 'cutting' as const, label: 'Cutting (Packaged/Cold)', color: '#10b981' },
                                { key: 'takeHome' as const, label: 'Standing Yield (Packaged/Live)', color: '#22d3ee' },
                              ]).map(series => {
                                const active = visibleYieldSeries[series.key];
                                return (
                                  <button
                                    key={series.key}
                                    type="button"
                                    onClick={() => toggleYieldSeries(series.key)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                      active
                                        ? 'bg-cool-gray-900 text-cool-gray-100 border-cool-gray-600'
                                        : 'bg-cool-gray-950/50 text-cool-gray-500 border-cool-gray-800 hover:text-cool-gray-300'
                                    }`}
                                  >
                                    <span
                                      className="w-2.5 h-0.5 inline-block shrink-0"
                                      style={{ backgroundColor: active ? series.color : '#4b5563' }}
                                    />
                                    <span>{series.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {yieldAutoExpanded && (
                              <span
                                data-testid="butcher-yield-autoscale-badge"
                                className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1"
                              >
                                Y-axis scaled ({formatCompactAxisNumber(yieldYScale.min, '%')} to {formatCompactAxisNumber(yieldYScale.max, '%')}) to fit outliers
                              </span>
                            )}
                          </div>

                          <div className="relative pt-1">
                            <svg
                              data-testid="butcher-yield-trends-svg"
                              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                              className="w-full max-h-[360px] h-auto block overflow-hidden"
                            >
                              <defs>
                                <clipPath id="butcher-yield-plot-clip">
                                  <rect
                                    x={chartPaddingLeft - 12}
                                    y={chartPaddingTop - 12}
                                    width={plotWidth + 24}
                                    height={plotHeight + 24}
                                  />
                                </clipPath>
                              </defs>

                              {/* Dynamic Y-Axis Grid Lines */}
                              {yieldYScale.ticks.map((val) => {
                                const y = yieldYScale.mapY(val, chartPaddingTop, plotHeight);
                                const isZero = val === 0;
                                return (
                                  <g key={val}>
                                    <line
                                      x1={chartPaddingLeft}
                                      y1={y}
                                      x2={SVG_W - chartPaddingRight}
                                      y2={y}
                                      stroke={isZero ? '#6b7280' : '#4b5563'}
                                      strokeWidth={isZero ? '1.2' : '1'}
                                      strokeDasharray={isZero ? undefined : '3 3'}
                                      opacity={isZero ? 0.55 : 0.3}
                                    />
                                    <text
                                      x={chartPaddingLeft - 8}
                                      y={y + 3.5}
                                      textAnchor="end"
                                      className="fill-cool-gray-400 font-mono text-[10px] font-bold"
                                    >
                                      {formatCompactAxisNumber(val, '%')}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* 100% reference marker when outliers stretch the axis above 100% */}
                              {yieldYScale.max > 100 && !yieldYScale.ticks.includes(100) && (() => {
                                const y100 = yieldYScale.mapY(100, chartPaddingTop, plotHeight);
                                return (
                                  <g opacity={0.45}>
                                    <line
                                      x1={chartPaddingLeft}
                                      y1={y100}
                                      x2={SVG_W - chartPaddingRight}
                                      y2={y100}
                                      stroke="#f59e0b"
                                      strokeWidth="1"
                                      strokeDasharray="5 4"
                                    />
                                  </g>
                                );
                              })()}

                              {/* Hover vertical guide */}
                              {hoveredPointIdx !== null && yieldCoords[hoveredPointIdx] && (
                                <line
                                  x1={yieldCoords[hoveredPointIdx].x}
                                  y1={chartPaddingTop}
                                  x2={yieldCoords[hoveredPointIdx].x}
                                  y2={plotBottom}
                                  stroke="#22d3ee"
                                  strokeWidth="1"
                                  strokeDasharray="3 3"
                                  opacity={0.65}
                                />
                              )}

                              {/* Curves & Points inside clipped plot bounds */}
                              <g clipPath="url(#butcher-yield-plot-clip)">
                                {totalPoints > 1 && (
                                  <>
                                    {visibleYieldSeries.dressing && (
                                      <path
                                        d={buildSegmentedSvgPath(yieldCoords.map(c => ({ x: c.x, y: c.yDressing })))}
                                        fill="none"
                                        stroke="#f59e0b"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                    {visibleYieldSeries.shrink && (
                                      <path
                                        d={buildSegmentedSvgPath(yieldCoords.map(c => ({ x: c.x, y: c.yShrink })))}
                                        fill="none"
                                        stroke="#f43f5e"
                                        strokeWidth="2"
                                        strokeDasharray="3 2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                    {visibleYieldSeries.cutting && (
                                      <path
                                        d={buildSegmentedSvgPath(yieldCoords.map(c => ({ x: c.x, y: c.yCutting })))}
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                    {visibleYieldSeries.takeHome && (
                                      <path
                                        d={buildSegmentedSvgPath(yieldCoords.map(c => ({ x: c.x, y: c.yTakeHome })))}
                                        fill="none"
                                        stroke="#22d3ee"
                                        strokeWidth="2.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                  </>
                                )}

                                {yieldCoords.map((pt, idx) => {
                                  const isAnomalous = Boolean(pt.analysis?.needsReview || (pt.analysis?.flaggedFields.length || 0) > 0);
                                  const anchorY =
                                    (visibleYieldSeries.takeHome ? pt.yTakeHome : null) ??
                                    (visibleYieldSeries.dressing ? pt.yDressing : null) ??
                                    (visibleYieldSeries.cutting ? pt.yCutting : null) ??
                                    (visibleYieldSeries.shrink ? pt.yShrink : null);
                                  return (
                                    <g key={pt.order.id}>
                                      {isAnomalous && anchorY !== null && (
                                        <circle
                                          cx={pt.x}
                                          cy={anchorY}
                                          r={hoveredPointIdx === idx ? 9 : 7}
                                          fill="none"
                                          stroke={pt.analysis?.flaggedFields.length ? '#f43f5e' : '#f59e0b'}
                                          strokeWidth="1.8"
                                          strokeDasharray="2 2"
                                        />
                                      )}
                                      {visibleYieldSeries.dressing && pt.yDressing !== null && (
                                        <circle cx={pt.x} cy={pt.yDressing} r={hoveredPointIdx === idx ? 5.5 : 3.2} className="fill-amber-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                      )}
                                      {visibleYieldSeries.shrink && pt.yShrink !== null && (
                                        <circle cx={pt.x} cy={pt.yShrink} r={hoveredPointIdx === idx ? 5.5 : 3} className="fill-rose-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                      )}
                                      {visibleYieldSeries.cutting && pt.yCutting !== null && (
                                        <circle cx={pt.x} cy={pt.yCutting} r={hoveredPointIdx === idx ? 5.5 : 3.2} className="fill-emerald-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                      )}
                                      {visibleYieldSeries.takeHome && pt.yTakeHome !== null && (
                                        <circle cx={pt.x} cy={pt.yTakeHome} r={hoveredPointIdx === idx ? 6 : 3.8} className="fill-cyan-400 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                      )}
                                    </g>
                                  );
                                })}
                              </g>

                              {/* X Axis labels */}
                              {yieldCoords.map((pt, idx) => {
                                const labelInterval = Math.max(1, Math.ceil(totalPoints / 8));
                                if (idx % labelInterval !== 0 && idx !== totalPoints - 1) return null;
                                return (
                                  <text
                                    key={pt.order.id}
                                    x={pt.x}
                                    y={plotBottom + 18}
                                    textAnchor="middle"
                                    className="fill-cool-gray-400 font-mono text-[9.5px] font-bold"
                                  >
                                    {pt.order.killDate ? pt.order.killDate.slice(5) : `#${pt.order.orderNumber}`}
                                  </text>
                                );
                              })}

                              {/* Interaction Columns */}
                              {yieldCoords.map((pt, idx) => {
                                const colWidth = plotWidth / Math.max(1, totalPoints);
                                return (
                                  <rect
                                    key={pt.order.id}
                                    x={Math.max(chartPaddingLeft, pt.x - colWidth / 2)}
                                    y={chartPaddingTop}
                                    width={Math.max(12, colWidth)}
                                    height={plotHeight}
                                    fill="transparent"
                                    className="cursor-pointer hover:fill-cyan-400/5 transition-colors"
                                    onMouseEnter={() => setHoveredPointIdx(idx)}
                                    onMouseLeave={() => setHoveredPointIdx(null)}
                                    onClick={() => setReviewingOrder(pt.order)}
                                  />
                                );
                              })}
                            </svg>

                            {/* Floating Interactive Tooltip */}
                            {hoveredPointIdx !== null && yieldCoords[hoveredPointIdx] && (() => {
                              const pt = yieldCoords[hoveredPointIdx];
                              return (
                                <div
                                  className="absolute bg-cool-gray-900/95 backdrop-blur border border-cool-gray-700/80 p-3.5 rounded-xl shadow-2xl text-xs text-cool-gray-200 pointer-events-none z-10 space-y-1.5 w-72 animate-fade-in"
                                  style={{
                                    left: `${Math.min(82, Math.max(18, (pt.x / SVG_W) * 100))}%`,
                                    top: '12px',
                                    transform: 'translateX(-50%)',
                                  }}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-white text-sm">Order #{pt.order.orderNumber}</span>
                                    <span className="text-[10px] font-bold uppercase text-cool-gray-400">{pt.order.species}</span>
                                  </div>
                                  <div className="text-[10px] text-cool-gray-400 flex justify-between">
                                    <span>Kill Date: {pt.order.killDate || 'N/A'}</span>
                                    {pt.modeResult.usedEstimates && (
                                      <span className="text-cyan-400 font-bold">Using Corrected Estimates</span>
                                    )}
                                    {!pt.modeResult.usedEstimates && pt.analysis?.flaggedFields.length ? (
                                      <span className="text-rose-400 font-bold">Flagged Anomaly</span>
                                    ) : !pt.modeResult.usedEstimates && pt.analysis?.needsReview ? (
                                      <span className="text-amber-400 font-bold">Yield Outlier</span>
                                    ) : null}
                                  </div>
                                  <div className="h-px bg-cool-gray-800 my-1"></div>

                                  <div className="flex justify-between font-mono tabular-nums">
                                    <span className="text-amber-400">Dressing Yield:</span>
                                    <span className="font-bold text-white">
                                      {pt.dressingVal !== null ? `${pt.dressingVal.toFixed(1)}%` : 'N/A'}
                                      {pt.modeResult.usedEstimates && pt.actualStats.hotWeightYield > 0 && Math.abs(pt.stats.hotWeightYield - pt.actualStats.hotWeightYield) > 0.05 && (
                                        <span className="text-cool-gray-500 font-normal ml-1">(raw {pt.actualStats.hotWeightYield.toFixed(1)}%)</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between font-mono tabular-nums">
                                    <span className="text-rose-400">Cooler Shrink:</span>
                                    <span className="font-bold text-white">
                                      {pt.shrinkVal !== null ? `${pt.shrinkVal.toFixed(1)}%` : 'N/A'}
                                      {pt.modeResult.usedEstimates && pt.actualStats.hotWeight > 0 && pt.actualStats.coldWeight > 0 && Math.abs(pt.stats.coolerShrinkage - pt.actualStats.coolerShrinkage) > 0.05 && (
                                        <span className="text-cool-gray-500 font-normal ml-1">(raw {pt.actualStats.coolerShrinkage.toFixed(1)}%)</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between font-mono tabular-nums">
                                    <span className="text-emerald-400">Cutting Yield:</span>
                                    <span className="font-bold text-white">
                                      {pt.cuttingVal !== null ? `${pt.cuttingVal.toFixed(1)}%` : 'N/A'}
                                      {pt.modeResult.usedEstimates && pt.actualStats.cuttingYield > 0 && Math.abs(pt.stats.cuttingYield - pt.actualStats.cuttingYield) > 0.05 && (
                                        <span className="text-cool-gray-500 font-normal ml-1">(raw {pt.actualStats.cuttingYield.toFixed(1)}%)</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-t border-cool-gray-800 pt-1 mt-1 font-semibold font-mono tabular-nums">
                                    <span className="text-cyan-400">Total Take-Home:</span>
                                    <span className="font-bold text-cyan-400">
                                      {pt.takeHomeVal !== null ? `${pt.takeHomeVal.toFixed(1)}%` : 'N/A'}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-cool-gray-500 pt-0.5">Click point to audit or flag weights</div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* 2. WEIGHTS TIMELINE AREA/LINE GRAPH */}
                      {reportGraphTab === 'weights' && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {([
                                { key: 'live' as const, label: 'Standing Live', color: '#3b82f6' },
                                { key: 'hot' as const, label: 'Hot Carcass', color: '#f59e0b' },
                                { key: 'cold' as const, label: 'Cold Carcass', color: '#6366f1' },
                                { key: 'packaged' as const, label: 'Packaged Meat', color: '#22d3ee' },
                              ]).map(series => {
                                const active = visibleWeightSeries[series.key];
                                return (
                                  <button
                                    key={series.key}
                                    type="button"
                                    onClick={() => toggleWeightSeries(series.key)}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                      active
                                        ? 'bg-cool-gray-900 text-cool-gray-100 border-cool-gray-600'
                                        : 'bg-cool-gray-950/50 text-cool-gray-500 border-cool-gray-800 hover:text-cool-gray-300'
                                    }`}
                                  >
                                    <span
                                      className="w-2.5 h-0.5 inline-block shrink-0"
                                      style={{ backgroundColor: active ? series.color : '#4b5563' }}
                                    />
                                    <span>{series.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                            <span className="text-[11px] text-cool-gray-400 font-semibold">Per-animal lbs</span>
                          </div>

                          <div className="relative pt-1">
                            <svg
                              data-testid="butcher-weights-timeline-svg"
                              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                              className="w-full max-h-[360px] h-auto block overflow-hidden"
                            >
                              <defs>
                                <clipPath id="butcher-weight-plot-clip">
                                  <rect
                                    x={chartPaddingLeft - 12}
                                    y={chartPaddingTop - 12}
                                    width={plotWidth + 24}
                                    height={plotHeight + 24}
                                  />
                                </clipPath>
                                <linearGradient id="liveWeightGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.22" />
                                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="packWeightGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.18" />
                                  <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                                </linearGradient>
                              </defs>

                              {/* Dynamic Y-Axis Grid Lines */}
                              {weightYScale.ticks.map((val) => {
                                const y = weightYScale.mapY(val, chartPaddingTop, plotHeight);
                                const isZero = val === 0;
                                return (
                                  <g key={val}>
                                    <line
                                      x1={chartPaddingLeft}
                                      y1={y}
                                      x2={SVG_W - chartPaddingRight}
                                      y2={y}
                                      stroke={isZero ? '#6b7280' : '#4b5563'}
                                      strokeWidth={isZero ? '1.2' : '1'}
                                      strokeDasharray={isZero ? undefined : '3 3'}
                                      opacity={isZero ? 0.55 : 0.3}
                                    />
                                    <text
                                      x={chartPaddingLeft - 8}
                                      y={y + 3.5}
                                      textAnchor="end"
                                      className="fill-cool-gray-400 font-mono text-[10px] font-bold"
                                    >
                                      {formatCompactAxisNumber(val)}
                                    </text>
                                  </g>
                                );
                              })}

                              {/* Hover vertical guide */}
                              {hoveredWeightPointIdx !== null && weightCoords[hoveredWeightPointIdx] && (
                                <line
                                  x1={weightCoords[hoveredWeightPointIdx].x}
                                  y1={chartPaddingTop}
                                  x2={weightCoords[hoveredWeightPointIdx].x}
                                  y2={plotBottom}
                                  stroke="#3b82f6"
                                  strokeWidth="1"
                                  strokeDasharray="3 3"
                                  opacity={0.65}
                                />
                              )}

                              {/* Curves & Dots clipped cleanly to plot box */}
                              <g clipPath="url(#butcher-weight-plot-clip)">
                                {totalPoints > 1 && (
                                  <>
                                    {visibleWeightSeries.live && (
                                      <path
                                        d={buildSegmentedAreaPath(weightCoords.map(c => ({ x: c.x, y: c.yLive })), weightZeroY)}
                                        fill="url(#liveWeightGrad)"
                                      />
                                    )}
                                    {visibleWeightSeries.packaged && (
                                      <path
                                        d={buildSegmentedAreaPath(weightCoords.map(c => ({ x: c.x, y: c.yPackaged })), weightZeroY)}
                                        fill="url(#packWeightGrad)"
                                      />
                                    )}
                                    {visibleWeightSeries.live && (
                                      <path
                                        d={buildSegmentedSvgPath(weightCoords.map(c => ({ x: c.x, y: c.yLive })))}
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="2.4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                    {visibleWeightSeries.hot && (
                                      <path
                                        d={buildSegmentedSvgPath(weightCoords.map(c => ({ x: c.x, y: c.yHot })))}
                                        fill="none"
                                        stroke="#f59e0b"
                                        strokeWidth="2"
                                        strokeDasharray="3 2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                    {visibleWeightSeries.cold && (
                                      <path
                                        d={buildSegmentedSvgPath(weightCoords.map(c => ({ x: c.x, y: c.yCold })))}
                                        fill="none"
                                        stroke="#6366f1"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                    {visibleWeightSeries.packaged && (
                                      <path
                                        d={buildSegmentedSvgPath(weightCoords.map(c => ({ x: c.x, y: c.yPackaged })))}
                                        fill="none"
                                        stroke="#22d3ee"
                                        strokeWidth="2.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    )}
                                  </>
                                )}

                                {weightCoords.map((pt, idx) => {
                                  const isAnomalous = Boolean(pt.analysis?.needsReview || (pt.analysis?.flaggedFields.length || 0) > 0);
                                  const anchorY =
                                    (visibleWeightSeries.live ? pt.yLive : null) ??
                                    (visibleWeightSeries.hot ? pt.yHot : null) ??
                                    (visibleWeightSeries.cold ? pt.yCold : null) ??
                                    (visibleWeightSeries.packaged ? pt.yPackaged : null);
                                  return (
                                    <g key={pt.order.id}>
                                      {isAnomalous && anchorY !== null && (
                                        <circle
                                          cx={pt.x}
                                          cy={anchorY}
                                          r={hoveredWeightPointIdx === idx ? 9 : 7}
                                          fill="none"
                                          stroke={pt.analysis?.flaggedFields.length ? '#f43f5e' : '#f59e0b'}
                                          strokeWidth="1.8"
                                          strokeDasharray="2 2"
                                        />
                                      )}
                                      {visibleWeightSeries.live && pt.yLive !== null && (
                                        <circle cx={pt.x} cy={pt.yLive} r={hoveredWeightPointIdx === idx ? 5.5 : 3.2} className="fill-blue-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                      )}
                                      {visibleWeightSeries.hot && pt.yHot !== null && (
                                        <circle cx={pt.x} cy={pt.yHot} r={hoveredWeightPointIdx === idx ? 5 : 3} className="fill-amber-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                      )}
                                      {visibleWeightSeries.cold && pt.yCold !== null && (
                                        <circle cx={pt.x} cy={pt.yCold} r={hoveredWeightPointIdx === idx ? 5 : 3} className="fill-indigo-500 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                      )}
                                      {visibleWeightSeries.packaged && pt.yPackaged !== null && (
                                        <circle cx={pt.x} cy={pt.yPackaged} r={hoveredWeightPointIdx === idx ? 6 : 3.8} className="fill-cyan-400 stroke-cool-gray-900 stroke-2 transition-all duration-150" />
                                      )}
                                    </g>
                                  );
                                })}
                              </g>

                              {/* Axis Labels */}
                              {weightCoords.map((pt, idx) => {
                                const labelInterval = Math.max(1, Math.ceil(totalPoints / 8));
                                if (idx % labelInterval !== 0 && idx !== totalPoints - 1) return null;
                                return (
                                  <text
                                    key={pt.order.id}
                                    x={pt.x}
                                    y={plotBottom + 18}
                                    textAnchor="middle"
                                    className="fill-cool-gray-400 font-mono text-[9.5px] font-bold"
                                  >
                                    {pt.order.killDate ? pt.order.killDate.slice(5) : `#${pt.order.orderNumber}`}
                                  </text>
                                );
                              })}

                              {/* Interactive Overlays */}
                              {weightCoords.map((pt, idx) => {
                                const colWidth = plotWidth / Math.max(1, totalPoints);
                                return (
                                  <rect
                                    key={pt.order.id}
                                    x={Math.max(chartPaddingLeft, pt.x - colWidth / 2)}
                                    y={chartPaddingTop}
                                    width={Math.max(12, colWidth)}
                                    height={plotHeight}
                                    fill="transparent"
                                    className="cursor-pointer hover:fill-blue-500/5 transition-colors"
                                    onMouseEnter={() => setHoveredWeightPointIdx(idx)}
                                    onMouseLeave={() => setHoveredWeightPointIdx(null)}
                                    onClick={() => setReviewingOrder(pt.order)}
                                  />
                                );
                              })}
                            </svg>

                            {/* Tooltip */}
                            {hoveredWeightPointIdx !== null && weightCoords[hoveredWeightPointIdx] && (() => {
                              const pt = weightCoords[hoveredWeightPointIdx];
                              return (
                                <div
                                  className="absolute bg-cool-gray-900/95 backdrop-blur border border-cool-gray-700/80 p-3.5 rounded-xl shadow-2xl text-xs text-cool-gray-200 pointer-events-none z-10 space-y-1.5 w-72 animate-fade-in"
                                  style={{
                                    left: `${Math.min(82, Math.max(18, (pt.x / SVG_W) * 100))}%`,
                                    top: '12px',
                                    transform: 'translateX(-50%)',
                                  }}
                                >
                                  <div className="flex justify-between items-center">
                                    <span className="font-extrabold text-white text-sm">Order #{pt.order.orderNumber}</span>
                                    <span className="text-[10px] font-bold uppercase text-cool-gray-400">{pt.order.species}</span>
                                  </div>
                                  <div className="text-[10px] text-cool-gray-400 flex justify-between">
                                    <span>Kill Date: {pt.order.killDate || 'N/A'}</span>
                                    {pt.modeResult.usedEstimates ? (
                                      <span className="text-cyan-400 font-bold">Using Corrected Estimates</span>
                                    ) : pt.analysis?.flaggedFields.length ? (
                                      <span className="text-rose-400 font-bold">Flagged Anomaly</span>
                                    ) : pt.analysis?.needsReview ? (
                                      <span className="text-amber-400 font-bold">Yield Outlier</span>
                                    ) : null}
                                  </div>
                                  <div className="h-px bg-cool-gray-800 my-1"></div>

                                  <div className="flex justify-between text-blue-400 font-mono tabular-nums">
                                    <span>Live (per animal):</span>
                                    <span className="font-bold">
                                      {pt.stats.liveWeightPerAnimal > 0 ? `${pt.stats.liveWeightPerAnimal.toFixed(1)} lbs` : 'N/A'}
                                      {pt.modeResult.usedEstimates && Math.abs(pt.stats.liveWeight - pt.actualStats.liveWeight) > 0.1 && (
                                        <span className="text-[10px] text-cool-gray-500 font-normal ml-1">(raw {pt.actualStats.liveWeightPerAnimal.toFixed(1)})</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-amber-400 font-mono tabular-nums">
                                    <span>Hot (per animal):</span>
                                    <span className="font-bold">
                                      {pt.stats.hotWeightPerAnimal > 0 ? `${pt.stats.hotWeightPerAnimal.toFixed(1)} lbs` : 'N/A'}
                                      {pt.modeResult.usedEstimates && Math.abs(pt.stats.hotWeight - pt.actualStats.hotWeight) > 0.1 && (
                                        <span className="text-[10px] text-cool-gray-500 font-normal ml-1">(raw {pt.actualStats.hotWeightPerAnimal.toFixed(1)})</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-indigo-400 font-mono tabular-nums">
                                    <span>Cold (per animal):</span>
                                    <span className="font-bold">
                                      {pt.stats.coldWeightPerAnimal > 0 ? `${pt.stats.coldWeightPerAnimal.toFixed(1)} lbs` : 'N/A'}
                                      {pt.modeResult.usedEstimates && Math.abs(pt.stats.coldWeight - pt.actualStats.coldWeight) > 0.1 && (
                                        <span className="text-[10px] text-cool-gray-500 font-normal ml-1">(raw {pt.actualStats.coldWeightPerAnimal.toFixed(1)})</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-cyan-400 border-t border-cool-gray-800 pt-1 mt-1 font-semibold font-mono tabular-nums">
                                    <span>Packaged (per animal):</span>
                                    <span className="font-bold">
                                      {pt.stats.packagedWeightPerAnimal > 0 ? `${pt.stats.packagedWeightPerAnimal.toFixed(1)} lbs` : '0.0 lbs'}
                                      {pt.modeResult.usedEstimates && Math.abs(pt.stats.packagedWeight - pt.actualStats.packagedWeight) > 0.1 && (
                                        <span className="text-[10px] text-cool-gray-500 font-normal ml-1">(raw {pt.actualStats.packagedWeightPerAnimal.toFixed(1)})</span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-cool-gray-500 pt-0.5">Click point to audit or flag weights</div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* 3. CUTS OVER TIME TREND LINE GRAPH */}
                      {reportGraphTab === 'cuts' && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-cool-gray-750/80 pb-3">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 w-full sm:w-auto">
                              <div className="w-full sm:w-64">
                                <label className="block text-[10px] text-cool-gray-400 font-bold uppercase tracking-wider mb-1">Target Cuts to Analyze</label>
                                <MultiSelectDropdown
                                  options={reportData.breakdown.map(c => c.name)}
                                  selected={selectedCutsForTrend}
                                  onChange={(selected) => setSelectedCutsForTrend(selected)}
                                  placeholder={activeCutsForTrend[0] || "Select cuts..."}
                                  compact
                                />
                              </div>
                              {activeCutsForTrend.length > 1 && (
                                <div className="shrink-0">
                                  <label className="block text-[10px] text-cool-gray-400 font-bold uppercase tracking-wider mb-1">Trend Mode</label>
                                  <div className="flex bg-cool-gray-900 border border-cool-gray-700 rounded-lg p-0.5 h-[34px] items-center">
                                    <button
                                      type="button"
                                      onClick={() => setCutTrendMode('comparison')}
                                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all h-full flex items-center cursor-pointer ${cutTrendMode === 'comparison' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-white'}`}
                                    >
                                      Compare
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setCutTrendMode('additive')}
                                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all h-full flex items-center cursor-pointer ${cutTrendMode === 'additive' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-400 hover:text-white'}`}
                                    >
                                      Additive Sum
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {cutTrendMode === 'comparison' && cutTrendsPointCoordsByCut.length > 0 && (
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                {cutTrendsPointCoordsByCut.map(trend => (
                                  <span key={trend.cutName} className="inline-flex items-center gap-1.5 text-cool-gray-300 font-medium">
                                    <span className="w-2.5 h-0.5 inline-block" style={{ backgroundColor: trend.color }} />
                                    <span className="truncate max-w-[140px]">{trend.cutName}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {activeCutsForTrend.length === 0 ? (
                            <div className="text-center py-12 text-cool-gray-500">No cuts found to analyze. Please import some orders.</div>
                          ) : (
                            <div className="relative pt-1">
                              <svg
                                data-testid="butcher-cuts-trend-svg"
                                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                                className="w-full max-h-[360px] h-auto block overflow-hidden"
                              >
                                <defs>
                                  <clipPath id="butcher-cut-plot-clip">
                                    <rect
                                      x={chartPaddingLeft - 12}
                                      y={chartPaddingTop - 12}
                                      width={plotWidth + 24}
                                      height={plotHeight + 24}
                                    />
                                  </clipPath>
                                  <linearGradient id="cutProportionGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.28" />
                                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>

                                {/* Dynamic Y-Axis Grid Lines */}
                                {cutYScale.ticks.map((val) => {
                                  const y = cutYScale.mapY(val, chartPaddingTop, plotHeight);
                                  const isZero = val === 0;
                                  return (
                                    <g key={val}>
                                      <line
                                        x1={chartPaddingLeft}
                                        y1={y}
                                        x2={SVG_W - chartPaddingRight}
                                        y2={y}
                                        stroke={isZero ? '#6b7280' : '#4b5563'}
                                        strokeWidth={isZero ? '1.2' : '1'}
                                        strokeDasharray={isZero ? undefined : '3 3'}
                                        opacity={isZero ? 0.55 : 0.3}
                                      />
                                      <text
                                        x={chartPaddingLeft - 8}
                                        y={y + 3.5}
                                        textAnchor="end"
                                        className="fill-cool-gray-400 font-mono text-[10px] font-bold"
                                      >
                                        {formatCompactAxisNumber(val, '%')}
                                      </text>
                                    </g>
                                  );
                                })}

                                {/* Hover vertical guide */}
                                {hoveredCutTrendIdx !== null && cutTrendPointCoords[hoveredCutTrendIdx] && (
                                  <line
                                    x1={cutTrendPointCoords[hoveredCutTrendIdx].x}
                                    y1={chartPaddingTop}
                                    x2={cutTrendPointCoords[hoveredCutTrendIdx].x}
                                    y2={plotBottom}
                                    stroke="#22d3ee"
                                    strokeWidth="1"
                                    strokeDasharray="3 3"
                                    opacity={0.65}
                                  />
                                )}

                                <g clipPath="url(#butcher-cut-plot-clip)">
                                  {cutTrendMode === 'additive' && totalPoints > 1 && (
                                    <>
                                      <path
                                        d={buildSegmentedAreaPath(cutTrendPointCoordsAdditive, cutZeroY)}
                                        fill="url(#cutProportionGrad)"
                                      />
                                      <path
                                        d={buildSegmentedSvgPath(cutTrendPointCoordsAdditive)}
                                        fill="none"
                                        stroke="#22d3ee"
                                        strokeWidth="2.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                    </>
                                  )}

                                  {cutTrendMode === 'comparison' && totalPoints > 1 && cutTrendsPointCoordsByCut.map((trendData) => (
                                    <path
                                      key={trendData.cutName}
                                      d={buildSegmentedSvgPath(trendData.points)}
                                      fill="none"
                                      stroke={trendData.color}
                                      strokeWidth="2.4"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  ))}

                                  {cutTrendMode === 'additive' && cutTrendPointCoordsAdditive.map((pt, idx) => (
                                    <circle
                                      key={pt.order.id}
                                      cx={pt.x}
                                      cy={pt.y}
                                      r={hoveredCutTrendIdx === idx ? 6 : 3.8}
                                      className="fill-cyan-400 stroke-cool-gray-900 stroke-2 transition-all duration-150"
                                    />
                                  ))}

                                  {cutTrendMode === 'comparison' && cutTrendsPointCoordsByCut.map((trendData) =>
                                    trendData.points.map((pt, idx) => (
                                      <circle
                                        key={`${trendData.cutName}-${pt.order.id}`}
                                        cx={pt.x}
                                        cy={pt.y}
                                        r={hoveredCutTrendIdx === idx ? 5.5 : 3.4}
                                        fill={trendData.color}
                                        className="stroke-cool-gray-900 stroke-1.5 transition-all duration-150"
                                      />
                                    ))
                                  )}
                                </g>

                                {/* Axis Labels */}
                                {cutTrendPointCoords.map((pt, idx) => {
                                  const labelInterval = Math.max(1, Math.ceil(totalPoints / 8));
                                  if (idx % labelInterval !== 0 && idx !== totalPoints - 1) return null;
                                  return (
                                    <text
                                      key={pt.order.id}
                                      x={pt.x}
                                      y={plotBottom + 18}
                                      textAnchor="middle"
                                      className="fill-cool-gray-400 font-mono text-[9.5px] font-bold"
                                    >
                                      {pt.order.killDate ? pt.order.killDate.slice(5) : `#${pt.order.orderNumber}`}
                                    </text>
                                  );
                                })}

                                {/* Interactor Columns */}
                                {cutTrendPointCoords.map((pt, idx) => {
                                  const colWidth = plotWidth / Math.max(1, totalPoints);
                                  return (
                                    <rect
                                      key={pt.order.id}
                                      x={Math.max(chartPaddingLeft, pt.x - colWidth / 2)}
                                      y={chartPaddingTop}
                                      width={Math.max(12, colWidth)}
                                      height={plotHeight}
                                      fill="transparent"
                                      className="cursor-pointer hover:fill-cyan-400/5 transition-colors"
                                      onMouseEnter={() => setHoveredCutTrendIdx(idx)}
                                      onMouseLeave={() => setHoveredCutTrendIdx(null)}
                                    />
                                  );
                                })}
                              </svg>

                              {/* Rich Dynamic Tooltip */}
                              {hoveredCutTrendIdx !== null && (() => {
                                const orderData = rOrdersWithStats[hoveredCutTrendIdx];
                                if (!orderData) return null;
                                const { order, stats } = orderData;
                                const ptX = getPointX(hoveredCutTrendIdx);

                                return (
                                  <div
                                    className="absolute bg-cool-gray-900/95 backdrop-blur border border-cool-gray-700/80 p-3.5 rounded-xl shadow-2xl text-xs text-cool-gray-200 pointer-events-none z-10 space-y-1.5 w-72 animate-fade-in"
                                    style={{
                                      left: `${Math.min(82, Math.max(18, (ptX / SVG_W) * 100))}%`,
                                      top: '12px',
                                      transform: 'translateX(-50%)',
                                    }}
                                  >
                                    <div className="flex justify-between items-center border-b border-cool-gray-800 pb-1.5">
                                      <span className="font-extrabold text-white text-sm">Order #{order.orderNumber}</span>
                                      <span className="px-1.5 py-0.5 bg-cyan-950/40 text-cyan-400 rounded text-[9px] font-bold uppercase">{order.species}</span>
                                    </div>
                                    <div className="text-[10px] text-cool-gray-400 flex justify-between">
                                      <span>Kill Date: {order.killDate || 'N/A'}</span>
                                      <span>Packaged: {stats.packagedWeight.toFixed(0)} lbs</span>
                                    </div>

                                    <div className="h-px bg-cool-gray-800 my-1"></div>

                                    {cutTrendMode === 'additive' ? (
                                      <>
                                        <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1">Additive Cuts:</div>
                                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                                          {activeCutsForTrend.map(cName => {
                                            const orderRecords = recordsByOrderId.get(order.id) || [];
                                            let cWeight = 0;
                                            orderRecords.forEach(r => {
                                              const name = viewOriginalNames ? r.originalCutName : (r.normalizedCutName || r.originalCutName);
                                              if (name && name.toLowerCase() === cName.toLowerCase()) {
                                                cWeight += r.netWeight;
                                              }
                                            });
                                            const pct = stats.packagedWeight > 0 ? (cWeight / stats.packagedWeight) * 100 : 0;
                                            return (
                                              <div key={cName} className="flex justify-between text-[11px] text-cool-gray-300">
                                                <span className="truncate max-w-[150px]">{cName}</span>
                                                <span className="font-medium text-white">{cWeight.toFixed(1)} lbs ({pct.toFixed(1)}%)</span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                        <div className="border-t border-cool-gray-800/80 pt-1.5 mt-1.5 flex justify-between font-extrabold text-cyan-400">
                                          <span>Total Additive:</span>
                                          <span>
                                            {cutTrendPointCoordsAdditive[hoveredCutTrendIdx]?.weight.toFixed(1)} lbs ({cutTrendPointCoordsAdditive[hoveredCutTrendIdx]?.percentage.toFixed(1)}%)
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div className="text-[10px] text-cool-gray-400 font-bold uppercase tracking-wider mb-1">Compared Cuts:</div>
                                        <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 scrollbar-thin">
                                          {cutTrendsPointCoordsByCut.map((trend) => {
                                            const pt = trend.points[hoveredCutTrendIdx];
                                            if (!pt) return null;
                                            return (
                                              <div key={trend.cutName} className="flex justify-between items-center text-[11px]">
                                                <div className="flex items-center gap-1.5 truncate max-w-[150px]">
                                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: trend.color }}></span>
                                                  <span className="text-cool-gray-300 truncate">{trend.cutName}</span>
                                                </div>
                                                <span className="font-bold text-white shrink-0">
                                                  {pt.weight > 0 ? `${pt.weight.toFixed(1)} lbs` : '0 lbs'}
                                                  <span className="text-cool-gray-400 text-[10px] font-normal ml-1">({pt.percentage.toFixed(1)}%)</span>
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 4. AGGREGATED CUT BREAKDOWN REPORT TYPE */}
                      {reportGraphTab === 'breakdown' && (
                        <div data-testid="butcher-reports-breakdown-panel" className="space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="relative flex-1 max-w-sm">
                              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                                <Search size={13} className="text-cool-gray-400" />
                              </div>
                              <input
                                type="text"
                                data-testid="butcher-reports-breakdown-search"
                                value={reportBreakdownSearch}
                                onChange={(e) => setReportBreakdownSearch(e.target.value)}
                                placeholder="Filter cuts in breakdown..."
                                className="block w-full rounded-lg border border-cool-gray-700 bg-cool-gray-900 pl-8 pr-7 py-1.5 text-xs text-cool-gray-100 placeholder:text-cool-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
                              />
                              {reportBreakdownSearch && (
                                <button
                                  type="button"
                                  onClick={() => setReportBreakdownSearch('')}
                                  className="absolute inset-y-0 right-0 flex items-center pr-2 text-cool-gray-400 hover:text-white cursor-pointer"
                                  title="Clear cut search"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-cool-gray-400 bg-cool-gray-900 border border-cool-gray-700 px-2.5 py-1 rounded-lg font-mono tabular-nums">
                                {reportBreakdownSearch.trim()
                                  ? `${filteredReportBreakdown.length} / ${reportData.breakdown.length} cuts`
                                  : `${reportData.breakdown.length} unique cuts`}
                              </span>
                              {totalBreakdownEstValue > 0 && (
                                <span className="text-xs font-extrabold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2.5 py-1 rounded-lg font-mono tabular-nums">
                                  Est. Total Value: ${totalBreakdownEstValue.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="overflow-x-auto border border-cool-gray-750 rounded-xl bg-cool-gray-900/40">
                            <table className="w-full text-left text-sm">
                              <thead className="bg-cool-gray-900/80 text-cool-gray-400 text-xs uppercase tracking-wider">
                                <tr>
                                  <th className="px-4 py-3 font-bold">Cut Name</th>
                                  <th className="px-4 py-3 font-bold text-right">Unit Sales Price</th>
                                  <th className="px-4 py-3 font-bold text-right">Packages</th>
                                  <th className="px-4 py-3 font-bold text-right">Total Pieces</th>
                                  <th className="px-4 py-3 font-bold text-right">Pack Share %</th>
                                  <th className="px-4 py-3 font-bold text-right">Total Net Weight</th>
                                  <th className="px-4 py-3 font-bold text-right">Est. Sales Value</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-cool-gray-700/60">
                                {filteredReportBreakdown.map((cut) => {
                                  const cutPct = reportData.totalWeight > 0 ? (cut.totalWeight / reportData.totalWeight) * 100 : 0;
                                  const matchedProd = products.find(
                                    p =>
                                      (cut.productId && p.id === cut.productId) ||
                                      p.name.trim().toLowerCase() === cut.name.trim().toLowerCase()
                                  );
                                  const unitPrice = matchedProd?.salePrice || 0;
                                  const unit = matchedProd?.salePriceUnit || 'lb';
                                  const estValue = unitPrice > 0 ? (unit === 'package' ? cut.count * unitPrice : cut.totalWeight * unitPrice) : 0;
                                  return (
                                    <tr key={cut.name} className="hover:bg-cool-gray-750/30 transition group">
                                      <td className="px-4 py-3 font-bold text-cool-gray-200 group-hover:text-cyan-400 transition-colors">{cut.name}</td>
                                      <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-cool-gray-400">
                                        {unitPrice > 0 ? `$${unitPrice.toFixed(2)} / ${unit === 'package' ? 'pkg' : 'lb'}` : '—'}
                                      </td>
                                      <td className="px-4 py-3 text-right font-medium text-cool-gray-300 font-mono tabular-nums">{cut.count}</td>
                                      <td className="px-4 py-3 text-right font-medium text-cool-gray-300 font-mono tabular-nums">{cut.totalPieces}</td>
                                      <td className="px-4 py-3 text-right font-bold text-cool-gray-400 font-mono tabular-nums">{cutPct.toFixed(1)}%</td>
                                      <td className="px-4 py-3 text-right font-extrabold text-cyan-400 font-mono tabular-nums">{cut.totalWeight.toFixed(2)} lbs</td>
                                      <td className="px-4 py-3 text-right font-mono font-extrabold text-emerald-400 tabular-nums">
                                        {estValue > 0 ? `$${estValue.toFixed(2)}` : '—'}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {filteredReportBreakdown.length === 0 && (
                                  <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-cool-gray-500 font-semibold">
                                      {reportBreakdownSearch.trim()
                                        ? `No cuts matching "${reportBreakdownSearch.trim()}".`
                                        : 'No records match the current filters.'}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                              {filteredReportBreakdown.length > 0 && (
                                <tfoot className="bg-cool-gray-900/90 border-t border-cool-gray-700 text-xs font-bold">
                                  <tr>
                                    <td className="px-4 py-2.5 text-cool-gray-300 uppercase tracking-wider">
                                      Totals ({filteredReportBreakdown.length} cuts)
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-cool-gray-500">—</td>
                                    <td className="px-4 py-2.5 text-right text-white font-mono tabular-nums">
                                      {filteredReportBreakdown.reduce((s, c) => s + c.count, 0)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-white font-mono tabular-nums">
                                      {filteredReportBreakdown.reduce((s, c) => s + c.totalPieces, 0)}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-cool-gray-300 font-mono tabular-nums">
                                      {reportData.totalWeight > 0
                                        ? `${((filteredReportBreakdown.reduce((s, c) => s + c.totalWeight, 0) / reportData.totalWeight) * 100).toFixed(1)}%`
                                        : '0.0%'}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-cyan-400 font-mono tabular-nums">
                                      {filteredReportBreakdown.reduce((s, c) => s + c.totalWeight, 0).toFixed(2)} lbs
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-emerald-400 font-mono tabular-nums">
                                      {totalBreakdownEstValue > 0 ? `$${totalBreakdownEstValue.toFixed(2)}` : '—'}
                                    </td>
                                  </tr>
                                </tfoot>
                              )}
                            </table>
                          </div>
                        </div>
                      )}

                      {/* 5. SPECIES COMPARISONS BENTO */}
                      {reportGraphTab === 'species' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {speciesComparisonData.map(sc => (
                            <div key={sc.species} className="bg-cool-gray-900 border border-cool-gray-800 p-5 rounded-2xl space-y-4 hover:border-cool-gray-750 transition-all">
                              <div className="flex justify-between items-center border-b border-cool-gray-800 pb-3">
                                <h5 className="text-lg font-extrabold text-white">{sc.species}</h5>
                                <div className="flex gap-2">
                                  <span className="px-2 py-0.5 bg-cool-gray-800 border border-cool-gray-700 rounded-lg text-[10px] font-bold text-cool-gray-400 uppercase">
                                    {sc.orderCount} {sc.orderCount === 1 ? 'Order' : 'Orders'}
                                  </span>
                                  <span className="px-2 py-0.5 bg-cyan-950/40 border border-cyan-800/40 rounded-lg text-[10px] font-bold text-cyan-400 uppercase">
                                    {sc.animalCount} {sc.animalCount === 1 ? 'Animal' : 'Animals'}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div>
                                  <span className="text-cool-gray-500 font-bold uppercase block text-[9px] tracking-wider">Avg Live Weight (per animal)</span>
                                  <span className="text-sm font-bold text-white">{sc.avgLive > 0 ? `${sc.avgLive.toFixed(1)} lbs` : 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-cool-gray-500 font-bold uppercase block text-[9px] tracking-wider">Avg Packaged Meat (per animal)</span>
                                  <span className="text-sm font-bold text-cyan-400">{sc.avgPackaged > 0 ? `${sc.avgPackaged.toFixed(1)} lbs` : '0.0 lbs'}</span>
                                </div>
                              </div>

                              <div className="space-y-2.5 border-t border-cool-gray-800/60 pt-3">
                                <div>
                                  <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                    <span>Avg Dressing Yield (Hot/Live)</span>
                                    <span className="font-bold text-white">{sc.avgHotYield > 0 ? `${sc.avgHotYield.toFixed(1)}%` : 'N/A'}</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-cool-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, sc.avgHotYield))}%` }}></div>
                                  </div>
                                </div>

                                <div>
                                  <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                    <span>Avg Cooler Hanging Shrink</span>
                                    <span className="font-bold text-rose-400">{sc.avgShrink > 0 ? `${sc.avgShrink.toFixed(1)}%` : 'N/A'}</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-cool-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, sc.avgShrink))}%` }}></div>
                                  </div>
                                </div>

                                <div>
                                  <div className="flex justify-between text-xs text-cool-gray-300 mb-1">
                                    <span>Avg Cutting Yield (Packaged/Cold)</span>
                                    <span className="font-bold text-emerald-400">{sc.avgCutYield > 0 ? `${sc.avgCutYield.toFixed(1)}%` : 'N/A'}</span>
                                  </div>
                                  <div className="w-full h-1.5 bg-cool-gray-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.max(0, Math.min(100, sc.avgCutYield))}%` }}></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {speciesComparisonData.length === 0 && (
                            <div className="col-span-2 text-center py-10 text-cool-gray-500">No species data parsed.</div>
                          )}
                        </div>
                      )}

                      {/* 6. TIMELINES & DATES REPORT */}
                      {reportGraphTab === 'timelines' && (
                        <ButcherTimelinesReport
                          report={timelineReport}
                          ordersById={ordersById}
                          onEditOrder={(ord) => setEditingOrder(ord)}
                          reportMode={reportMode}
                          hideSummaryKpis={true}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Edit Order Modal */}
        {editingOrder && (
          <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-cool-gray-850 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-cool-gray-750 animate-scale-up max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center pb-4 border-b border-cool-gray-750 mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Edit3 className="text-cyan-400" size={18} />
                  Edit Butcher Order
                </h3>
                <button onClick={() => setEditingOrder(null)} className="text-cool-gray-400 hover:text-white transition">
                  <X size={20} />
                </button>
              </div>
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  dispatch({ 
                    type: 'EDIT_BUTCHER_ORDER', 
                    payload: { orderId: editingOrder.id, updates: editingOrder } 
                  });
                  setEditingOrder(null);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Order #</label>
                    <input 
                      type="text" 
                      required
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.orderNumber || ''}
                      onChange={e => setEditingOrder({...editingOrder, orderNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Species</label>
                    <CreatableDropdown
                      options={existingSpecies}
                      value={editingOrder.species || ''}
                      onChange={(val) => setEditingOrder({...editingOrder, species: val})}
                      placeholder="e.g. Pork"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Butcher / Location Source</label>
                    <select
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                      value={editingOrder.locationId || ''}
                      onChange={e => setEditingOrder({...editingOrder, locationId: e.target.value || undefined})}
                    >
                      <option value="">-- Select Butcher / Location --</option>
                      {locations.map(l => (
                        <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Animal Count</label>
                    <input 
                      type="number" 
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.animalCount ?? ''}
                      onChange={e => setEditingOrder({...editingOrder, animalCount: parseFloat(e.target.value) || undefined})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Birth Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.birthDate || ''}
                      onChange={e => setEditingOrder({...editingOrder, birthDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Kill Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.killDate || ''}
                      onChange={e => setEditingOrder({...editingOrder, killDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Pickup Date</label>
                    <input 
                      type="date" 
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.pickupDate || ''}
                      onChange={e => setEditingOrder({...editingOrder, pickupDate: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-cool-gray-400 mb-1">Generic Notes</label>
                  <textarea
                    rows={3}
                    className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
                    placeholder="Add notes about this butcher order..."
                    value={editingOrder.notes || ''}
                    onChange={e => setEditingOrder({...editingOrder, notes: e.target.value})}
                  />
                </div>

                {/* Order Tags / Flags */}
                <div className="border-t border-cool-gray-750 pt-4">
                  <label className="block text-xs font-bold text-cool-gray-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <TagIcon size={12} className="text-cyan-400" />
                    Order Tags / Flags
                  </label>
                  {butcherTags.length === 0 ? (
                    <p className="text-xs text-cool-gray-500 bg-cool-gray-900/30 p-2.5 rounded-lg border border-cool-gray-800">
                      No order tags configured yet. Add tags in Catalog &amp; Settings → Operations → Butcher Settings.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {butcherTags.map(tag => {
                        const isSelected = (editingOrder.tagIds || []).includes(tag.id);
                        const modeSuffix =
                          tag.weightCheckMode === 'separate_baseline'
                            ? 'Split'
                            : tag.weightCheckMode === 'exclude_from_baseline'
                              ? 'Exclude'
                              : null;
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              const current = editingOrder.tagIds || [];
                              const next = isSelected
                                ? current.filter(id => id !== tag.id)
                                : [...current, tag.id];
                              setEditingOrder({ ...editingOrder, tagIds: next });
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                              isSelected
                                ? 'bg-cool-gray-800 border-cyan-500 text-white'
                                : 'bg-cool-gray-900 border-cool-gray-750 text-cool-gray-400 hover:text-cool-gray-200 hover:border-cool-gray-600'
                            }`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color || '#06b6d4' }}
                            />
                            <span>{tag.name}</span>
                            {modeSuffix && (
                              <span className="text-[10px] text-cool-gray-400 font-normal">· {modeSuffix}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-4 border-t border-cool-gray-750 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Live Wt (lbs)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.liveWeight ?? ''}
                      onChange={e => setEditingOrder({...editingOrder, liveWeight: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Hot Wt (lbs)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.hotWeight ?? ''}
                      onChange={e => setEditingOrder({...editingOrder, hotWeight: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Cold Wt (lbs)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.coldWeight ?? ''}
                      onChange={e => setEditingOrder({...editingOrder, coldWeight: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cool-gray-400 mb-1">Fee ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                      value={editingOrder.butcherFee !== undefined ? editingOrder.butcherFee : ''}
                      onChange={e => setEditingOrder({...editingOrder, butcherFee: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* Associated Document Links */}
                <div className="border-t border-cool-gray-750 pt-4">
                  <label className="block text-xs font-bold text-cool-gray-400 mb-2 uppercase tracking-wider">Associated Document Links</label>
                  
                  {/* Current Documents list */}
                  {(!editingOrder.documents || editingOrder.documents.length === 0) ? (
                    <p className="text-xs text-cool-gray-500 italic mb-3 bg-cool-gray-900/30 p-2.5 rounded-lg text-center text-cool-gray-400">No documents attached yet.</p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {editingOrder.documents.map((doc: any) => {
                        const isDocEditing = editingDocId === doc.id;
                        return (
                          <div key={doc.id}>
                            {isDocEditing ? (
                              <div className="bg-cool-gray-950 p-3 rounded-lg border border-cyan-500/30 text-xs space-y-2.5">
                                <p className="text-xs font-bold text-cyan-400">Edit Document Link</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {documentLinkTypes.length > 0 && (
                                    <div className="sm:col-span-2">
                                      <label className="block text-[10px] font-bold text-cool-gray-400 uppercase mb-1">Link Type</label>
                                      <select
                                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                                        value={
                                          documentLinkTypes.some(t => t.id === editingDocTypeId)
                                            ? editingDocTypeId
                                            : '__CUSTOM__'
                                        }
                                        onChange={e => setEditingDocTypeId(e.target.value)}
                                      >
                                        <option value="__CUSTOM__">Custom Link Name...</option>
                                        {documentLinkTypes.map(dt => (
                                          <option key={dt.id} value={dt.id}>{dt.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                  {(documentLinkTypes.length === 0 || !documentLinkTypes.some(t => t.id === editingDocTypeId)) && (
                                    <div>
                                      <label className="block text-[10px] font-bold text-cool-gray-400 uppercase mb-1">Document Name</label>
                                      <input
                                        type="text"
                                        className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                                        value={editingDocName}
                                        onChange={e => setEditingDocName(e.target.value)}
                                        placeholder="e.g. Cutsheet, Invoice"
                                      />
                                    </div>
                                  )}
                                  <div className={documentLinkTypes.some(t => t.id === editingDocTypeId) ? 'sm:col-span-2' : ''}>
                                    <label className="block text-[10px] font-bold text-cool-gray-400 uppercase mb-1">URL (https://...)</label>
                                    <input
                                      type="url"
                                      className="w-full bg-cool-gray-900 border border-cool-gray-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                                      value={editingDocUrl}
                                      onChange={e => setEditingDocUrl(e.target.value)}
                                      placeholder="e.g. https://google.com/..."
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDocId(null);
                                      setEditingDocTypeId('__CUSTOM__');
                                      setEditingDocName('');
                                      setEditingDocUrl('');
                                    }}
                                    className="px-2.5 py-1 text-cool-gray-400 hover:text-white hover:bg-cool-gray-800 rounded transition text-[10px] font-bold"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const matchedType = documentLinkTypes.find(t => t.id === editingDocTypeId);
                                      const name = matchedType ? matchedType.name : editingDocName.trim();
                                      let url = editingDocUrl.trim();
                                      if (!name || !url) return;
                                      if (!/^https?:\/\//i.test(url)) {
                                        url = 'https://' + url;
                                      }
                                      const updatedDocs = (editingOrder.documents || []).map((d: any) =>
                                        d.id === doc.id
                                          ? {
                                              ...d,
                                              name,
                                              url,
                                              typeId: matchedType ? matchedType.id : undefined
                                            }
                                          : d
                                      );
                                      setEditingOrder({ ...editingOrder, documents: updatedDocs });
                                      setEditingDocId(null);
                                      setEditingDocTypeId('__CUSTOM__');
                                      setEditingDocName('');
                                      setEditingDocUrl('');
                                    }}
                                    className="px-2.5 py-1 bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 rounded transition text-[10px] font-bold"
                                  >
                                    Save Changes
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between bg-cool-gray-900/50 p-2.5 rounded-lg border border-cool-gray-800 text-xs">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                                  <Link size={15} className="text-cyan-500 shrink-0" />
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-cool-gray-100 text-sm truncate">{resolveDocumentDisplayName(doc, documentLinkTypes)}</span>
                                    <span className="text-[10px] text-cool-gray-500 truncate font-mono">{doc.url}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDocId(doc.id);
                                      const matchedTypeId =
                                        doc.typeId && documentLinkTypes.some(t => t.id === doc.typeId)
                                          ? doc.typeId
                                          : '__CUSTOM__';
                                      setEditingDocTypeId(matchedTypeId);
                                      setEditingDocName(resolveDocumentDisplayName(doc, documentLinkTypes));
                                      setEditingDocUrl(doc.url);
                                    }}
                                    className="text-cool-gray-400 hover:text-cyan-400 p-1.5 rounded hover:bg-cool-gray-800 transition"
                                    title="Edit document"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedDocs = (editingOrder.documents || []).filter((d: any) => d.id !== doc.id);
                                      setEditingOrder({ ...editingOrder, documents: updatedDocs });
                                    }}
                                    className="text-cool-gray-400 hover:text-red-400 p-1.5 rounded hover:bg-cool-gray-800 transition"
                                    title="Remove document link"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Add Document sub-form */}
                  <div className="bg-cool-gray-900/30 p-3 rounded-xl border border-cool-gray-800 space-y-3">
                    <p className="text-xs font-bold text-cool-gray-300">Add a Document Link</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {documentLinkTypes.length > 0 && (
                        <select
                          className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 sm:col-span-2"
                          value={
                            documentLinkTypes.some(t => t.id === newDocTypeId)
                              ? newDocTypeId
                              : '__CUSTOM__'
                          }
                          onChange={e => setNewDocTypeId(e.target.value)}
                        >
                          <option value="__CUSTOM__">Custom Link Name...</option>
                          {documentLinkTypes.map(dt => (
                            <option key={dt.id} value={dt.id}>{dt.name}</option>
                          ))}
                        </select>
                      )}
                      {(documentLinkTypes.length === 0 || !documentLinkTypes.some(t => t.id === newDocTypeId)) && (
                        <input
                          type="text"
                          placeholder="Document Name (e.g. Cutsheet, Invoice, Yield)"
                          className="bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500"
                          value={newDocName}
                          onChange={e => setNewDocName(e.target.value)}
                        />
                      )}
                      <input
                        type="url"
                        placeholder="URL (https://...)"
                        className={`bg-cool-gray-900 border border-cool-gray-750 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-cyan-500 ${
                          documentLinkTypes.some(t => t.id === newDocTypeId) ? 'sm:col-span-2' : ''
                        }`}
                        value={newDocUrl}
                        onChange={e => setNewDocUrl(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-cool-gray-800">
                      {documentLinkTypes.length === 0 ? (
                        <span className="text-[11px] text-cool-gray-500">
                          Tip: Add reusable link types in Butcher Settings.
                        </span>
                      ) : <span />}
                      <button
                        type="button"
                        onClick={() => {
                          const matchedType = documentLinkTypes.find(t => t.id === newDocTypeId);
                          const name = matchedType ? matchedType.name : newDocName.trim();
                          let url = newDocUrl.trim();
                          if (!name || !url) return;
                          
                          if (!/^https?:\/\//i.test(url)) {
                            url = 'https://' + url;
                          }

                          const newDoc: ButcherOrderDocument = {
                            id: crypto.randomUUID(),
                            name,
                            url,
                            ...(matchedType ? { typeId: matchedType.id } : {})
                          };
                          
                          setEditingOrder({
                            ...editingOrder,
                            documents: [...(editingOrder.documents || []), newDoc]
                          });
                          
                          setNewDocName('');
                          setNewDocUrl('');
                        }}
                        className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} />
                        Attach Document Link
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-between items-center gap-3 pt-4 border-t border-cool-gray-750 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button 
                      type="button"
                      onClick={() => {
                        setManualEntryTargetOrder(editingOrder);
                        setIsManualEntryOpen(true);
                      }}
                      className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Open manual cut entry for this order"
                    >
                      <Plus size={14} />
                      Add Cuts Manually
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const target = editingOrder;
                        setEditingOrder(null);
                        setReviewingOrder(target);
                      }}
                      className="px-3 py-2 bg-cool-gray-800 hover:bg-cool-gray-750 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Flag wrong weights or apply baseline approximations"
                    >
                      <Flag size={14} />
                      Audit / Flag Weights
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setEditingOrder(null)}
                      className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-white rounded-lg text-sm font-bold transition"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-bold transition"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 bg-cool-gray-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-cool-gray-850 rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-cool-gray-750 animate-scale-up">
              <div className="flex justify-between items-center pb-4 border-b border-cool-gray-750">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trash2 className="text-red-400" size={18} />
                  Delete Order
                </h3>
              </div>
              <p className="mt-4 text-cool-gray-300 text-sm">
                Are you sure you want to delete this order? This will NOT remove any items imported to the Off-Site spreadsheet, but will permanently delete this butcher log record.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-600 text-white rounded-lg text-sm font-bold transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    dispatch({ type: 'DELETE_BUTCHER_ORDER', payload: { orderId: deleteConfirmId } });
                    setDeleteConfirmId(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Manual Butcher Item Entry Modal */}
        {isManualEntryOpen && (
          <ManualButcherEntryModal
            state={state}
            dispatch={dispatch}
            initialOrder={manualEntryTargetOrder}
            onClose={() => {
              setIsManualEntryOpen(false);
              setManualEntryTargetOrder(null);
            }}
            onAddToImportForm={handleAddManualCutsToImportForm}
          />
        )}

        {/* Butcher Weight Anomaly Review & Estimation Modal */}
        {reviewingOrder && (
          <ButcherAnomalyReviewModal
            order={reviewingOrder}
            allOrders={orders}
            recordsByOrderId={recordsByOrderId}
            sensitivity={anomalySensitivity}
            butcherTags={butcherTags}
            baselineGroupingMode={baselineGroupingMode}
            locationNameById={locationNameById}
            reviewIssues={
              (
                reviewQueueSummary.items.find(i => i.order.id === reviewingOrder.id) ||
                reviewQueueSummary.closedItems.find(i => i.order.id === reviewingOrder.id)
              )?.issues || []
            }
            onClose={() => setReviewingOrder(null)}
            onSave={(orderId, updates) => {
              dispatch({
                type: 'EDIT_BUTCHER_ORDER',
                payload: { orderId, updates },
              });
            }}
            onOpenEditOrder={(targetOrder) => setEditingOrder(targetOrder)}
          />
        )}

      </div>
    </div>
  );
};
