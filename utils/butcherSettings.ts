import {
  AppConfigItem,
  ButcherBaselineGroupingMode,
  ButcherDocumentLinkType,
  ButcherOrder,
  ButcherOrderDocument,
  ButcherOrderTag,
  ButcherRecord,
  ButcherTagWeightCheckMode,
} from '../types';
import { clampSensitivity, DEFAULT_ANOMALY_SENSITIVITY } from './butcherStats';
import { parseCalendarDate } from './butcherTimelines';

export const BUTCHER_SPECIES_CONFIG_KEY = 'butcher_species_list';
export const BUTCHER_ORDER_TAGS_CONFIG_KEY = 'butcher_order_tags';
export const BUTCHER_DOC_LINK_TYPES_CONFIG_KEY = 'butcher_document_link_types';
export const BUTCHER_BASELINE_GROUPING_CONFIG_KEY = 'butcher_anomaly_baseline_grouping';
export const BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY = 'butcher_anomaly_sensitivity';

export const DEFAULT_BUTCHER_BASELINE_GROUPING_MODE: ButcherBaselineGroupingMode = 'species';

export const BUTCHER_BASELINE_GROUPING_META: Record<
  ButcherBaselineGroupingMode,
  { label: string; shortLabel: string; description: string }
> = {
  species: {
    label: 'Species Only (All Butchers)',
    shortLabel: 'Species Only',
    description:
      'Compares each harvest against all clean orders of the same species across every butcher/processor.',
  },
  species_and_butcher: {
    label: 'Species & Butcher (Per Processor)',
    shortLabel: 'Species & Butcher',
    description:
      'Groups baselines by both species and assigned butcher location so processor-specific practices (trim style, skinning, or cooler hang time) stay isolated.',
  },
};

export const BUTCHER_TAG_COLOR_PRESETS: Array<{ value: string; label: string }> = [
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f43f5e', label: 'Rose' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#64748b', label: 'Slate' },
];

export const BUTCHER_TAG_WEIGHT_MODE_META: Record<
  ButcherTagWeightCheckMode,
  { label: string; shortLabel: string; description: string }
> = {
  normal: {
    label: 'Standard Species Baseline',
    shortLabel: 'Standard',
    description:
      'Used for filtering, sorting, and reports. Evaluated against the normal species yield baseline.',
  },
  separate_baseline: {
    label: 'Separate Baseline Cohort',
    shortLabel: 'Separate Cohort',
    description:
      'Compares tagged orders against other clean peers carrying the same tag (e.g., Retired Sows vs. Retired Sows) without skewing standard species averages.',
  },
  exclude_from_baseline: {
    label: 'Exclude from Anomaly Baseline',
    shortLabel: 'Exclude Baseline',
    description:
      'Keeps tagged orders out of species averages and pauses automatic statistical yield alerts (physical impossibilities like Hot > Live are still flagged).',
  },
};

type AppConfigSource = AppConfigItem[] | Record<string, string> | undefined | null;

function readConfigString(source: AppConfigSource, key: string): string | null {
  if (!source) return null;
  if (Array.isArray(source)) {
    const found = source.find((item) => item && item.key === key);
    return typeof found?.value === 'string' ? found.value : null;
  }
  if (typeof source === 'object') {
    const val = (source as Record<string, unknown>)[key];
    return typeof val === 'string' ? val : null;
  }
  return null;
}

export function normalizeButcherBaselineGroupingMode(raw: unknown): ButcherBaselineGroupingMode {
  if (raw === 'species_and_butcher' || raw === 'species') {
    return raw;
  }
  return DEFAULT_BUTCHER_BASELINE_GROUPING_MODE;
}

export function parseButcherBaselineGroupingMode(
  source: AppConfigSource,
): ButcherBaselineGroupingMode {
  const raw = readConfigString(source, BUTCHER_BASELINE_GROUPING_CONFIG_KEY);
  if (!raw) return DEFAULT_BUTCHER_BASELINE_GROUPING_MODE;
  const trimmed = raw.trim();
  if (trimmed === 'species_and_butcher' || trimmed === 'species') {
    return trimmed;
  }
  try {
    return normalizeButcherBaselineGroupingMode(JSON.parse(trimmed));
  } catch {
    return DEFAULT_BUTCHER_BASELINE_GROUPING_MODE;
  }
}

export function hasButcherAnomalySensitivityConfig(source: AppConfigSource): boolean {
  const raw = readConfigString(source, BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY);
  return raw !== null && raw.trim() !== '';
}

export function parseButcherAnomalySensitivity(source: AppConfigSource): number {
  const raw = readConfigString(source, BUTCHER_ANOMALY_SENSITIVITY_CONFIG_KEY);
  if (!raw || !raw.trim()) return DEFAULT_ANOMALY_SENSITIVITY;
  const trimmed = raw.trim();
  const direct = Number(trimmed);
  if (Number.isFinite(direct)) {
    return clampSensitivity(direct);
  }
  try {
    const parsed = JSON.parse(trimmed);
    const num = typeof parsed === 'number' ? parsed : Number(parsed);
    if (Number.isFinite(num)) {
      return clampSensitivity(num);
    }
  } catch {
    // Ignore malformed value
  }
  return DEFAULT_ANOMALY_SENSITIVITY;
}

export function normalizeWeightCheckMode(raw: unknown): ButcherTagWeightCheckMode {
  if (raw === 'separate_baseline' || raw === 'exclude_from_baseline' || raw === 'normal') {
    return raw;
  }
  return 'normal';
}

export function normalizeSpeciesList(rawList: unknown): string[] {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of rawList) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    result.push(trimmed);
  }
  return result.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function parseButcherSpeciesList(source: AppConfigSource): string[] {
  const raw = readConfigString(source, BUTCHER_SPECIES_CONFIG_KEY);
  if (!raw) return [];
  try {
    return normalizeSpeciesList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function parseButcherOrderTags(source: AppConfigSource): ButcherOrderTag[] {
  const raw = readConfigString(source, BUTCHER_ORDER_TAGS_CONFIG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seenIds = new Set<string>();
    const tags: ButcherOrderTag[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!id || !name || seenIds.has(id)) continue;
      seenIds.add(id);
      tags.push({
        id,
        name,
        description: typeof item.description === 'string' && item.description.trim() ? item.description.trim() : undefined,
        color: typeof item.color === 'string' && item.color.trim() ? item.color.trim() : '#06b6d4',
        weightCheckMode: normalizeWeightCheckMode(item.weightCheckMode),
      });
    }
    return tags;
  } catch {
    return [];
  }
}

export function parseButcherDocumentLinkTypes(source: AppConfigSource): ButcherDocumentLinkType[] {
  const raw = readConfigString(source, BUTCHER_DOC_LINK_TYPES_CONFIG_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    const types: ButcherDocumentLinkType[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      const lower = name.toLowerCase();
      if (!id || !name || seenIds.has(id) || seenNames.has(lower)) continue;
      seenIds.add(id);
      seenNames.add(lower);
      types.push({ id, name });
    }
    return types;
  } catch {
    return [];
  }
}

export function getAllButcherSpeciesOptions(
  managedSpecies: string[],
  orders: ButcherOrder[] = [],
): string[] {
  const byKey = new Map<string, string>();
  for (const sp of managedSpecies) {
    const trimmed = (sp || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, trimmed);
  }
  for (const order of orders) {
    const trimmed = (order.species || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, trimmed);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function getButcherSpeciesUsageCounts(
  orders: ButcherOrder[] = [],
): Map<string, { label: string; count: number }> {
  const map = new Map<string, { label: string; count: number }>();
  for (const order of orders) {
    const trimmed = (order.species || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { label: trimmed, count: 1 });
    }
  }
  return map;
}

export function getButcherTagUsageCounts(orders: ButcherOrder[] = []): Map<string, number> {
  const counts = new Map<string, number>();
  for (const order of orders) {
    const ids = Array.isArray(order.tagIds) ? order.tagIds : [];
    const uniqueOrderIds = new Set(ids);
    uniqueOrderIds.forEach((id) => {
      if (!id) return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
  }
  return counts;
}

export function getButcherDocLinkTypeUsageCounts(
  orders: ButcherOrder[] = [],
  linkTypes: ButcherDocumentLinkType[] = [],
): Map<string, { byTypeId: number; byLegacyName: number; total: number }> {
  const counts = new Map<string, { byTypeId: number; byLegacyName: number; total: number }>();
  const nameToTypeId = new Map<string, string>();

  for (const t of linkTypes) {
    counts.set(t.id, { byTypeId: 0, byLegacyName: 0, total: 0 });
    nameToTypeId.set(t.name.trim().toLowerCase(), t.id);
  }

  for (const order of orders) {
    const docs = Array.isArray(order.documents) ? order.documents : [];
    for (const doc of docs) {
      if (doc.typeId && counts.has(doc.typeId)) {
        const entry = counts.get(doc.typeId)!;
        entry.byTypeId += 1;
        entry.total += 1;
      } else if (!doc.typeId && doc.name) {
        const matchedId = nameToTypeId.get(doc.name.trim().toLowerCase());
        if (matchedId && counts.has(matchedId)) {
          const entry = counts.get(matchedId)!;
          entry.byLegacyName += 1;
          entry.total += 1;
        }
      }
    }
  }

  return counts;
}

export function resolveDocumentDisplayName(
  doc: ButcherOrderDocument,
  linkTypes: ButcherDocumentLinkType[] = [],
): string {
  if (doc.typeId) {
    const matched = linkTypes.find((t) => t.id === doc.typeId);
    if (matched) return matched.name;
  }
  return doc.name || 'Document Link';
}

export function resolveOrderTags(
  order: Pick<ButcherOrder, 'tagIds'>,
  allTags: ButcherOrderTag[] = [],
): ButcherOrderTag[] {
  if (!Array.isArray(order.tagIds) || order.tagIds.length === 0 || allTags.length === 0) {
    return [];
  }
  const byId = new Map(allTags.map((t) => [t.id, t]));
  const result: ButcherOrderTag[] = [];
  const seen = new Set<string>();
  for (const id of order.tagIds) {
    if (seen.has(id)) continue;
    const found = byId.get(id);
    if (found) {
      seen.add(id);
      result.push(found);
    }
  }
  return result;
}

// ============================================================================
// ATOMIC BULK MUTATION HELPERS (SHARED BY SERVER REDUCER & UNIT TESTS)
// ============================================================================

export function applyButcherSpeciesRename(
  orders: ButcherOrder[],
  managedSpecies: string[],
  oldNameRaw: string,
  newNameRaw: string,
): {
  nextOrders: ButcherOrder[];
  nextSpeciesList: string[];
  affectedOrderCount: number;
  mergedIntoExisting: boolean;
} {
  const oldName = oldNameRaw.trim();
  const newName = newNameRaw.trim();
  const oldKey = oldName.toLowerCase();
  const newKey = newName.toLowerCase();

  if (!oldName || !newName) {
    return {
      nextOrders: orders,
      nextSpeciesList: normalizeSpeciesList(managedSpecies),
      affectedOrderCount: 0,
      mergedIntoExisting: false,
    };
  }

  const allExistingKeys = new Set<string>();
  managedSpecies.forEach((sp) => {
    if (sp.trim()) allExistingKeys.add(sp.trim().toLowerCase());
  });
  orders.forEach((o) => {
    if (o.species && o.species.trim()) allExistingKeys.add(o.species.trim().toLowerCase());
  });

  const mergedIntoExisting = oldKey !== newKey && allExistingKeys.has(newKey);

  let affectedOrderCount = 0;
  const nextOrders = orders.map((order) => {
    const sp = (order.species || '').trim();
    if (sp.toLowerCase() === oldKey && sp !== newName) {
      affectedOrderCount += 1;
      return { ...order, species: newName };
    }
    if (sp.toLowerCase() === oldKey && oldKey === newKey && order.species !== newName) {
      affectedOrderCount += 1;
      return { ...order, species: newName };
    }
    return order;
  });

  const nextRawSpecies = managedSpecies
    .filter((sp) => sp.trim().toLowerCase() !== oldKey)
    .concat(newName);

  // If renaming changed casing of an existing target, replace target casing cleanly
  const dedupedSpecies: string[] = [];
  const seen = new Set<string>();
  // Put newName first so its exact casing wins
  seen.add(newKey);
  dedupedSpecies.push(newName);
  for (const sp of nextRawSpecies) {
    const trimmed = sp.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    dedupedSpecies.push(trimmed);
  }
  dedupedSpecies.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return {
    nextOrders,
    nextSpeciesList: dedupedSpecies,
    affectedOrderCount,
    mergedIntoExisting,
  };
}

export function applyButcherOrderTagDelete(
  orders: ButcherOrder[],
  tags: ButcherOrderTag[],
  tagId: string,
): {
  nextOrders: ButcherOrder[];
  nextTags: ButcherOrderTag[];
  affectedOrderCount: number;
  deletedTag: ButcherOrderTag | null;
} {
  const deletedTag = tags.find((t) => t.id === tagId) || null;
  const nextTags = tags.filter((t) => t.id !== tagId);

  let affectedOrderCount = 0;
  const nextOrders = orders.map((order) => {
    if (!Array.isArray(order.tagIds) || !order.tagIds.includes(tagId)) {
      return order;
    }
    affectedOrderCount += 1;
    const filtered = order.tagIds.filter((id) => id !== tagId);
    return {
      ...order,
      tagIds: filtered.length > 0 ? filtered : undefined,
    };
  });

  return {
    nextOrders,
    nextTags,
    affectedOrderCount,
    deletedTag,
  };
}

export function applyButcherDocumentTypeRename(
  orders: ButcherOrder[],
  linkTypes: ButcherDocumentLinkType[],
  typeId: string,
  newNameRaw: string,
  alsoMatchByName: boolean = true,
): {
  nextOrders: ButcherOrder[];
  nextLinkTypes: ButcherDocumentLinkType[];
  affectedDocumentCount: number;
  affectedOrderCount: number;
  oldName: string | null;
} {
  const newName = newNameRaw.trim();
  const targetType = linkTypes.find((t) => t.id === typeId);
  if (!targetType || !newName) {
    return {
      nextOrders: orders,
      nextLinkTypes: linkTypes,
      affectedDocumentCount: 0,
      affectedOrderCount: 0,
      oldName: targetType?.name || null,
    };
  }

  const oldName = targetType.name;
  const oldKey = oldName.trim().toLowerCase();

  const nextLinkTypes = linkTypes.map((t) =>
    t.id === typeId ? { ...t, name: newName } : t,
  );

  let affectedDocumentCount = 0;
  let affectedOrderCount = 0;

  const nextOrders = orders.map((order) => {
    if (!Array.isArray(order.documents) || order.documents.length === 0) return order;
    let orderChanged = false;
    const nextDocs = order.documents.map((doc) => {
      if (doc.typeId === typeId) {
        if (doc.name !== newName) {
          orderChanged = true;
          affectedDocumentCount += 1;
          return { ...doc, name: newName };
        }
        return doc;
      }
      if (
        alsoMatchByName &&
        !doc.typeId &&
        (doc.name || '').trim().toLowerCase() === oldKey
      ) {
        orderChanged = true;
        affectedDocumentCount += 1;
        return { ...doc, typeId, name: newName };
      }
      return doc;
    });

    if (orderChanged) {
      affectedOrderCount += 1;
      return { ...order, documents: nextDocs };
    }
    return order;
  });

  return {
    nextOrders,
    nextLinkTypes,
    affectedDocumentCount,
    affectedOrderCount,
    oldName,
  };
}

export function applyButcherDocumentTypeDelete(
  orders: ButcherOrder[],
  linkTypes: ButcherDocumentLinkType[],
  typeId: string,
): {
  nextOrders: ButcherOrder[];
  nextLinkTypes: ButcherDocumentLinkType[];
  detachedDocumentCount: number;
  deletedType: ButcherDocumentLinkType | null;
} {
  const deletedType = linkTypes.find((t) => t.id === typeId) || null;
  const nextLinkTypes = linkTypes.filter((t) => t.id !== typeId);

  let detachedDocumentCount = 0;
  const nextOrders = orders.map((order) => {
    if (!Array.isArray(order.documents) || order.documents.length === 0) return order;
    let changed = false;
    const nextDocs = order.documents.map((doc) => {
      if (doc.typeId === typeId) {
        changed = true;
        detachedDocumentCount += 1;
        const { typeId: _removed, ...rest } = doc;
        return {
          ...rest,
          name: doc.name || deletedType?.name || 'Document Link',
        };
      }
      return doc;
    });
    return changed ? { ...order, documents: nextDocs } : order;
  });

  return {
    nextOrders,
    nextLinkTypes,
    detachedDocumentCount,
    deletedType,
  };
}

export function upsertAppConfigItem(
  appConfig: AppConfigItem[] | undefined,
  key: string,
  value: string,
  updatedAt: string = new Date().toISOString(),
): AppConfigItem[] {
  const list = Array.isArray(appConfig) ? [...appConfig] : [];
  const idx = list.findIndex((item) => item.key === key);
  if (idx >= 0) {
    list[idx] = { key, value, updatedAt };
  } else {
    list.push({ key, value, updatedAt });
  }
  return list;
}

export function matchesButcherOrderSearch(
  order: Pick<
    ButcherOrder,
    'orderNumber' | 'species' | 'notes' | 'tagIds' | 'weightAnomalies' | 'estimatedWeights'
  >,
  query: string,
  allTags: ButcherOrderTag[] = [],
  locationName: string = '',
): boolean {
  const lower = (query || '').trim().toLowerCase();
  if (!lower) return true;

  if ((order.orderNumber || '').toLowerCase().includes(lower)) return true;
  if ((order.species || '').toLowerCase().includes(lower)) return true;
  if (locationName && locationName.toLowerCase().includes(lower)) return true;
  if ((order.notes || '').toLowerCase().includes(lower)) return true;
  if ((order.estimatedWeights?.note || '').toLowerCase().includes(lower)) return true;

  if (order.weightAnomalies && typeof order.weightAnomalies === 'object') {
    for (const flag of Object.values(order.weightAnomalies)) {
      if (flag?.reason && flag.reason.toLowerCase().includes(lower)) {
        return true;
      }
    }
  }

  const assignedTags = resolveOrderTags(order, allTags);
  if (assignedTags.some((t) => (t.name || '').toLowerCase().includes(lower))) {
    return true;
  }

  return false;
}

// ============================================================================
// UNIFIED BUTCHER LOGS & REPORTS FILTER ENGINE
// ============================================================================

export type ButcherDateFilterField = 'any' | 'killDate' | 'pickupDate' | 'packDate';

export const BUTCHER_DATE_FILTER_FIELD_LABELS: Record<ButcherDateFilterField, string> = {
  any: 'Any Date',
  killDate: 'Kill Date',
  pickupDate: 'Pickup Date',
  packDate: 'Pack Date',
};

export interface ButcherOrderFilterState {
  search: string;
  dateField: ButcherDateFilterField;
  startDate: string; // YYYY-MM-DD (on or after)
  endDate: string; // YYYY-MM-DD (on or before)
  orderNumber: string[];
  species: string[];
  locationIds: string[];
  tagIds: string[];
  cutName: string[];
  primaryCategory: string[];
  subCategory: string[];
}

export function createEmptyButcherOrderFilter(
  overrides: Partial<ButcherOrderFilterState> = {},
): ButcherOrderFilterState {
  return {
    search: '',
    dateField: 'any',
    startDate: '',
    endDate: '',
    orderNumber: [],
    species: [],
    locationIds: [],
    tagIds: [],
    cutName: [],
    primaryCategory: [],
    subCategory: [],
    ...overrides,
  };
}

export function countActiveButcherFilters(filter: ButcherOrderFilterState): number {
  return (
    (filter.search.trim() ? 1 : 0) +
    (filter.startDate ? 1 : 0) +
    (filter.endDate ? 1 : 0) +
    filter.orderNumber.length +
    filter.species.length +
    filter.locationIds.length +
    filter.tagIds.length +
    filter.cutName.length +
    filter.primaryCategory.length +
    filter.subCategory.length
  );
}

function formatUtcIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type ButcherDateRangePreset = '30d' | '90d' | '12m' | 'ytd';

export function computeDateRangePreset(
  preset: ButcherDateRangePreset,
  referenceDate: Date = new Date(),
): { startDate: string; endDate: string } {
  const endUtc = new Date(
    Date.UTC(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()),
  );
  const startUtc = new Date(endUtc.getTime());

  if (preset === '30d') {
    startUtc.setUTCDate(startUtc.getUTCDate() - 30);
  } else if (preset === '90d') {
    startUtc.setUTCDate(startUtc.getUTCDate() - 90);
  } else if (preset === '12m') {
    startUtc.setUTCFullYear(startUtc.getUTCFullYear() - 1);
  } else if (preset === 'ytd') {
    startUtc.setUTCMonth(0, 1);
  }

  return {
    startDate: formatUtcIsoDate(startUtc),
    endDate: formatUtcIsoDate(endUtc),
  };
}

export function matchesButcherDateRange(
  order: Pick<ButcherOrder, 'killDate' | 'pickupDate'>,
  orderRecords: Pick<ButcherRecord, 'packDate'>[],
  dateField: ButcherDateFilterField,
  startDate: string,
  endDate: string,
): boolean {
  const startParsed = startDate ? parseCalendarDate(startDate) : null;
  const endParsed = endDate ? parseCalendarDate(endDate) : null;
  if (!startParsed && !endParsed) return true;

  const rawCandidates: Array<string | undefined> = [];
  if (dateField === 'killDate') {
    rawCandidates.push(order.killDate);
  } else if (dateField === 'pickupDate') {
    rawCandidates.push(order.pickupDate);
  } else if (dateField === 'packDate') {
    for (const r of orderRecords) rawCandidates.push(r.packDate);
  } else {
    rawCandidates.push(order.killDate, order.pickupDate);
    for (const r of orderRecords) rawCandidates.push(r.packDate);
  }

  const parsedDates: string[] = [];
  for (const raw of rawCandidates) {
    const parsed = parseCalendarDate(raw);
    if (parsed) parsedDates.push(parsed.iso);
  }
  if (parsedDates.length === 0) return false;

  return parsedDates.some((iso) => {
    if (startParsed && iso < startParsed.iso) return false;
    if (endParsed && iso > endParsed.iso) return false;
    return true;
  });
}

export interface FilterableButcherRecord {
  packDate?: string;
  originalCutName?: string;
  normalizedCutName?: string;
  cuts?: string;
  primaryCategory?: string;
  subCategory?: string;
}

export function matchesButcherRecordFilter(
  record: FilterableButcherRecord,
  filter: Pick<ButcherOrderFilterState, 'cutName' | 'primaryCategory' | 'subCategory'>,
  viewOriginalNames: boolean = false,
): boolean {
  if (filter.cutName.length > 0) {
    const name = viewOriginalNames
      ? record.originalCutName || ''
      : record.normalizedCutName || record.cuts || record.originalCutName || '';
    const lowerName = name.toLowerCase();
    if (!filter.cutName.some((val) => val.toLowerCase() === lowerName)) {
      return false;
    }
  }

  if (filter.primaryCategory.length > 0) {
    const primary = (record.primaryCategory || 'Uncategorized').toLowerCase();
    if (!filter.primaryCategory.some((val) => val.toLowerCase() === primary)) {
      return false;
    }
  }

  if (filter.subCategory.length > 0) {
    const sub = (record.subCategory || 'Uncategorized').toLowerCase();
    if (!filter.subCategory.some((val) => val.toLowerCase() === sub)) {
      return false;
    }
  }

  return true;
}

export function matchesButcherOrderFilters(
  order: ButcherOrder,
  orderRecords: FilterableButcherRecord[],
  filter: ButcherOrderFilterState,
  options: {
    tags?: ButcherOrderTag[];
    locationName?: string;
    viewOriginalNames?: boolean;
  } = {},
): boolean {
  if (filter.search.trim()) {
    if (
      !matchesButcherOrderSearch(
        order,
        filter.search,
        options.tags || [],
        options.locationName || '',
      )
    ) {
      return false;
    }
  }

  if (filter.startDate || filter.endDate) {
    if (
      !matchesButcherDateRange(
        order,
        orderRecords,
        filter.dateField,
        filter.startDate,
        filter.endDate,
      )
    ) {
      return false;
    }
  }

  if (filter.orderNumber.length > 0) {
    const orderNumLower = (order.orderNumber || '').trim().toLowerCase();
    if (!filter.orderNumber.some((val) => val.trim().toLowerCase() === orderNumLower)) {
      return false;
    }
  }

  if (filter.species.length > 0) {
    const speciesLower = (order.species || '').trim().toLowerCase();
    if (!filter.species.some((val) => val.trim().toLowerCase() === speciesLower)) {
      return false;
    }
  }

  if (filter.locationIds.length > 0) {
    const locKey = (order.locationId || '').trim() || '__unassigned__';
    if (!filter.locationIds.includes(locKey)) {
      return false;
    }
  }

  if (filter.tagIds.length > 0) {
    if (!(order.tagIds || []).some((tid) => filter.tagIds.includes(tid))) {
      return false;
    }
  }

  const hasRecordLevelFilter =
    filter.cutName.length > 0 ||
    filter.primaryCategory.length > 0 ||
    filter.subCategory.length > 0;

  if (hasRecordLevelFilter) {
    if (
      !orderRecords.some((r) =>
        matchesButcherRecordFilter(r, filter, Boolean(options.viewOriginalNames)),
      )
    ) {
      return false;
    }
  }

  return true;
}

export function mergeOrderNumbersForReportFilter(
  existing: string[],
  toAdd: string[],
  mode: 'replace' | 'append' = 'replace',
): string[] {
  const base = mode === 'append' ? existing : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of [...base, ...toAdd]) {
    const trimmed = (raw || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function mergeOrderIdsForSpreadsheetFilter(
  existing: string[],
  toAdd: string[],
  mode: 'replace' | 'append' = 'replace',
): string[] {
  const base = mode === 'append' ? existing : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of [...base, ...toAdd]) {
    const trimmed = (raw || '').trim();
    if (!trimmed || trimmed === 'ALL') continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}


