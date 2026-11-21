import {
  ButcherBaselineGroupingMode,
  ButcherOrder,
  ButcherOrderTag,
  ButcherRecord,
  ButcherWeightField,
  ButcherReportMode,
} from '../types';

export interface ButcherOrderStats {
  count: number;
  totalPieces: number;
  packagedWeight: number;
  avgPackageWeight: number;
  avgPiecesPerPackage: number;

  // Original Weights
  liveWeight: number;
  hotWeight: number;
  coldWeight: number;

  // Per Animal Weights
  liveWeightPerAnimal: number;
  hotWeightPerAnimal: number;
  coldWeightPerAnimal: number;
  packagedWeightPerAnimal: number;

  // Yield percentages
  hotWeightYield: number;
  coolerShrinkage: number;
  cuttingYield: number;
  finishToLiveYield: number;
  finishToHotYield: number;
  finishToColdYield: number;

  // Loss weights in lbs
  totalLoss: number;
  dressingLoss: number;
  coolerLoss: number;
  cuttingLoss: number;
}

export function computeOrderStats(order: ButcherOrder, matchingRecords: ButcherRecord[]): ButcherOrderStats {
  let totalPieces = 0;
  let totalWeight = 0;
  matchingRecords.forEach(r => {
    totalPieces += r.pieces || 0;
    totalWeight += r.netWeight || 0;
  });

  const count = matchingRecords.length;
  const live = order.liveWeight || 0;
  const hot = order.hotWeight || 0;
  const cold = order.coldWeight || 0;
  const animalCount = Math.max(1, order.animalCount || 1);

  return {
    count,
    totalPieces,
    packagedWeight: totalWeight,
    avgPackageWeight: count > 0 ? totalWeight / count : 0,
    avgPiecesPerPackage: count > 0 ? totalPieces / count : 0,

    // Original Weights
    liveWeight: live,
    hotWeight: hot,
    coldWeight: cold,

    // Per Animal Weights
    liveWeightPerAnimal: live / animalCount,
    hotWeightPerAnimal: hot / animalCount,
    coldWeightPerAnimal: cold / animalCount,
    packagedWeightPerAnimal: totalWeight / animalCount,

    // Yield percentages
    hotWeightYield: live > 0 ? (hot / live) * 100 : 0,
    coolerShrinkage: hot > 0 ? ((hot - cold) / hot) * 100 : 0,
    cuttingYield: cold > 0 ? (totalWeight / cold) * 100 : 0,
    finishToLiveYield: live > 0 ? (totalWeight / live) * 100 : 0,
    finishToHotYield: hot > 0 ? (totalWeight / hot) * 100 : 0,
    finishToColdYield: cold > 0 ? (totalWeight / cold) * 100 : 0,

    // Loss weights in lbs
    totalLoss: Math.max(0, live - totalWeight),
    dressingLoss: Math.max(0, live - hot),
    coolerLoss: Math.max(0, hot - cold),
    cuttingLoss: Math.max(0, cold - totalWeight),
  };
}

export function calculateDaysAlive(birthDate?: string, killDate?: string): number | null {
  if (!birthDate || !killDate) return null;
  const birth = new Date(birthDate);
  const kill = new Date(killDate);
  if (isNaN(birth.getTime()) || isNaN(kill.getTime())) return null;
  const diffTime = kill.getTime() - birth.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : null;
}

export interface CutAggregation {
  name: string;
  pieces: number;
  weight: number;
  packageCount: number;
  percentageOfTotalWeight: number;
}

export function aggregateCutsByProduct(
  records: ButcherRecord[],
  productNameMap?: Map<string, string>
): CutAggregation[] {
  const map = new Map<string, { pieces: number; weight: number; count: number }>();
  let grandTotalWeight = 0;

  for (const record of records) {
    let name = record.cuts || record.originalCutName || 'Unknown Cut';
    if (record.productId && productNameMap && productNameMap.has(record.productId)) {
      name = productNameMap.get(record.productId)!;
    }

    const current = map.get(name) || { pieces: 0, weight: 0, count: 0 };
    const pieces = record.pieces || 0;
    const weight = record.netWeight || 0;

    current.pieces += pieces;
    current.weight += weight;
    current.count += 1;
    grandTotalWeight += weight;

    map.set(name, current);
  }

  const results: CutAggregation[] = [];
  for (const [name, data] of map.entries()) {
    results.push({
      name,
      pieces: data.pieces,
      weight: data.weight,
      packageCount: data.count,
      percentageOfTotalWeight: grandTotalWeight > 0 ? (data.weight / grandTotalWeight) * 100 : 0,
    });
  }

  return results.sort((a, b) => b.weight - a.weight);
}

/**
 * Live-filters a cut breakdown list by matching all whitespace-separated query tokens
 * case-insensitively against each cut's display name.
 */
export function filterCutBreakdown<T extends { name: string }>(cuts: T[], query: string): T[] {
  const normalized = (query || '').trim().toLowerCase();
  if (!normalized) return cuts;
  const terms = normalized.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return cuts;
  return cuts.filter(cut => {
    const name = (cut.name || '').toLowerCase();
    return terms.every(term => name.includes(term));
  });
}

// ============================================================================
// ANOMALY DETECTION, SPECIES BASELINES, WEIGHT ESTIMATION & REVIEW QUEUE
// ============================================================================

export const DEFAULT_ANOMALY_SENSITIVITY = 2.0;
export const MIN_ANOMALY_SENSITIVITY = 1.2;
export const MAX_ANOMALY_SENSITIVITY = 3.5;

/** Exponential recency decay half-life (~2 years) so recent harvests carry higher weight than multi-year drift. */
export const RECENCY_HALF_LIFE_DAYS = 730;
/** Minimum weight floor so very old orders never vanish completely when recent sample counts are small. */
export const MIN_RECENCY_WEIGHT = 0.05;
const MS_PER_DAY = 86_400_000;

export const BUTCHER_WEIGHT_FIELD_LABELS: Record<ButcherWeightField, string> = {
  liveWeight: 'Live Weight',
  hotWeight: 'Hot Carcass Weight',
  coldWeight: 'Cold Carcass Weight',
  packagedWeight: 'Packaged Meat Weight',
};

export type YieldMetricKey =
  | 'hotToLive'
  | 'coldToLive'
  | 'packagedToLive'
  | 'coolerShrink'
  | 'cuttingYield'
  | 'packagedToHot';

export const YIELD_METRIC_LABELS: Record<YieldMetricKey, string> = {
  hotToLive: 'Dressing Yield (Hot / Live)',
  coldToLive: 'Cold Carcass / Live Weight',
  packagedToLive: 'Standing Yield (Packaged / Live)',
  coolerShrink: 'Cooler Shrinkage (Hot - Cold) / Hot',
  cuttingYield: 'Cutting Yield (Packaged / Cold)',
  packagedToHot: 'Packaged / Hot Weight',
};

const METRIC_FIELDS: Record<YieldMetricKey, [ButcherWeightField, ButcherWeightField]> = {
  hotToLive: ['hotWeight', 'liveWeight'],
  coldToLive: ['coldWeight', 'liveWeight'],
  packagedToLive: ['packagedWeight', 'liveWeight'],
  coolerShrink: ['hotWeight', 'coldWeight'],
  cuttingYield: ['packagedWeight', 'coldWeight'],
  packagedToHot: ['packagedWeight', 'hotWeight'],
};

export interface SpeciesBaselineSample {
  orderId: string;
  value: number;
  timestamp: number | null;
  recencyWeight: number;
}

export interface SpeciesBaselineMetricStats {
  count: number;
  mean: number;
  median: number;
  stdDev: number;
  madSigma: number;
  samples: SpeciesBaselineSample[];
}

export interface SpeciesBaseline {
  speciesKey: string;
  speciesLabel: string;
  cleanOrderCount: number;
  metrics: Record<YieldMetricKey, SpeciesBaselineMetricStats>;
}

export interface ButcherAnomalyFinding {
  id: string;
  type: 'physical' | 'statistical' | 'manual';
  severity: 'critical' | 'warning';
  metric?: YieldMetricKey;
  message: string;
  actualPct?: number;
  baselinePct?: number;
  deltaPct?: number;
  zScore?: number;
  likelyFields: ButcherWeightField[];
}

export type ButcherBaselineButcherFilter = 'setting' | 'same_butcher' | 'all_butchers';

export type ButcherBaselineComparisonScope =
  | { mode: 'auto'; butcherFilter?: ButcherBaselineButcherFilter }
  | { mode: 'standard'; butcherFilter?: ButcherBaselineButcherFilter }
  | { mode: 'all_species'; butcherFilter?: ButcherBaselineButcherFilter }
  | { mode: 'tag_cohort'; tagIds: string[]; butcherFilter?: ButcherBaselineButcherFilter };

export interface BaselineScopeOption {
  id: string;
  label: string;
  description: string;
  scope: ButcherBaselineComparisonScope;
  cleanPeerCount: number;
}

export interface ButcherOrderAnomalyAnalysis {
  orderId: string;
  speciesKey: string;
  baselineLabel: string;
  baselineGroupingMode: ButcherBaselineGroupingMode;
  baselineScopeUsed: ButcherBaselineComparisonScope;
  excludedFromStatisticalBaseline: boolean;
  excludedByTags: ButcherOrderTag[];
  cohortTags: ButcherOrderTag[];
  cleanPeerCount: number;
  actualWeights: Record<ButcherWeightField, number>;
  effectiveWeights: Record<ButcherWeightField, number>;
  adjustedFields: ButcherWeightField[];
  actualYields: Record<YieldMetricKey, number | null>;
  effectiveYields: Record<YieldMetricKey, number | null>;
  findings: ButcherAnomalyFinding[];
  suspectFields: ButcherWeightField[];
  flaggedFields: ButcherWeightField[];
  dismissedFields: ButcherWeightField[];
  hasPhysicalErrors: boolean;
  hasStatisticalAnomalies: boolean;
  hasManualFlags: boolean;
  needsReview: boolean;
  auditClosed: boolean;
  suggestedEstimates: Partial<Record<ButcherWeightField, number>>;
  estimateExplanations: Partial<Record<ButcherWeightField, string>>;
  speciesBaseline: SpeciesBaseline | null;
}

export interface ModeAdjustedOrderStats {
  stats: ButcherOrderStats;
  actualStats: ButcherOrderStats;
  mode: ButcherReportMode;
  usedEstimates: boolean;
  estimatedFields: ButcherWeightField[];
  flaggedFields: ButcherWeightField[];
  excludedFromAverages: boolean;
}

export function normalizeSpeciesKey(species?: string): string {
  return (species || 'Unknown').trim().toLowerCase() || 'unknown';
}

export function clampSensitivity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_ANOMALY_SENSITIVITY;
  return Math.min(MAX_ANOMALY_SENSITIVITY, Math.max(MIN_ANOMALY_SENSITIVITY, Math.round(value * 10) / 10));
}

/**
 * Extracts a deterministic harvest timestamp (in ms) from killDate -> pickupDate -> createdAt.
 */
export function getOrderHarvestTimestamp(order: ButcherOrder): number | null {
  for (const rawDate of [order.killDate, order.pickupDate]) {
    if (typeof rawDate === 'string' && rawDate.trim()) {
      const parsed = Date.parse(rawDate.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  if (typeof order.createdAt === 'number' && Number.isFinite(order.createdAt) && order.createdAt > 0) {
    return order.createdAt;
  }
  return null;
}

/**
 * Exponentially decays older harvest weights relative to referenceTimestamp using a 2-year half-life.
 */
export function computeRecencyWeight(
  sampleTimestamp: number | null,
  referenceTimestamp: number | null,
  halfLifeDays: number = RECENCY_HALF_LIFE_DAYS
): number {
  if (
    sampleTimestamp === null ||
    referenceTimestamp === null ||
    !Number.isFinite(sampleTimestamp) ||
    !Number.isFinite(referenceTimestamp)
  ) {
    return 1;
  }
  const ageDays = Math.max(0, (referenceTimestamp - sampleTimestamp) / MS_PER_DAY);
  if (ageDays <= 0) return 1;
  const decayed = Math.exp((-Math.LN2 * ageDays) / Math.max(1, halfLifeDays));
  return Math.max(MIN_RECENCY_WEIGHT, decayed);
}

function assignRecencyWeights(samples: SpeciesBaselineSample[]): SpeciesBaselineSample[] {
  let maxTs: number | null = null;
  for (const s of samples) {
    if (s.timestamp !== null && Number.isFinite(s.timestamp)) {
      if (maxTs === null || s.timestamp > maxTs) {
        maxTs = s.timestamp;
      }
    }
  }
  if (maxTs === null) {
    return samples.map(s => ({ ...s, recencyWeight: 1 }));
  }
  return samples.map(s => ({
    ...s,
    recencyWeight: computeRecencyWeight(s.timestamp, maxTs),
  }));
}

function calcMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calcWeightedMean(items: { value: number; weight: number }[]): number {
  if (items.length === 0) return 0;
  let weightSum = 0;
  let weightedSum = 0;
  for (const item of items) {
    const w = Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0;
    weightSum += w;
    weightedSum += w * item.value;
  }
  if (weightSum <= 0) return calcMean(items.map(i => i.value));
  return weightedSum / weightSum;
}

function calcWeightedMedian(items: { value: number; weight: number }[]): number {
  if (items.length === 0) return 0;
  if (items.length === 1) return items[0].value;
  const sorted = [...items].sort((a, b) => a.value - b.value);
  let totalWeight = 0;
  for (const item of sorted) {
    totalWeight += Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0;
  }
  if (totalWeight <= 0) {
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1].value + sorted[mid].value) / 2
      : sorted[mid].value;
  }

  const halfWeight = totalWeight / 2;
  let cumWeight = 0;
  for (let i = 0; i < sorted.length; i++) {
    const w = Number.isFinite(sorted[i].weight) && sorted[i].weight > 0 ? sorted[i].weight : 0;
    cumWeight += w;
    if (Math.abs(cumWeight - halfWeight) < 1e-9 && i + 1 < sorted.length) {
      return (sorted[i].value + sorted[i + 1].value) / 2;
    }
    if (cumWeight >= halfWeight - 1e-9) {
      return sorted[i].value;
    }
  }
  return sorted[sorted.length - 1].value;
}

function calcWeightedStdDev(items: { value: number; weight: number }[], mean: number): number {
  if (items.length < 2) return 0;
  let weightSum = 0;
  let weightedSqSum = 0;
  for (const item of items) {
    const w = Number.isFinite(item.weight) && item.weight > 0 ? item.weight : 0;
    weightSum += w;
    weightedSqSum += w * Math.pow(item.value - mean, 2);
  }
  if (weightSum <= 0) return 0;
  return Math.sqrt(weightedSqSum / weightSum);
}

function calcWeightedMadSigma(items: { value: number; weight: number }[], medianVal: number): number {
  if (items.length < 2) return 0;
  const deviations = items.map(item => ({
    value: Math.abs(item.value - medianVal),
    weight: item.weight,
  }));
  const mad = calcWeightedMedian(deviations);
  return 1.4826 * mad;
}

function computeMetricStats(rawSamples: SpeciesBaselineSample[]): SpeciesBaselineMetricStats {
  const samples = assignRecencyWeights(rawSamples);
  const weightedItems = samples.map(s => ({ value: s.value, weight: s.recencyWeight }));
  const mean = calcWeightedMean(weightedItems);
  const median = calcWeightedMedian(weightedItems);
  const stdDev = calcWeightedStdDev(weightedItems, mean);
  const madSigma = calcWeightedMadSigma(weightedItems, median);
  return {
    count: samples.length,
    mean,
    median,
    stdDev,
    madSigma,
    samples,
  };
}

export function getPackagedWeightForOrder(
  orderId: string,
  matchingRecords: ButcherRecord[]
): number {
  return matchingRecords.reduce((sum, r) => sum + (r.netWeight || 0), 0);
}

export function groupRecordsByOrderId(records: ButcherRecord[]): Map<string, ButcherRecord[]> {
  const map = new Map<string, ButcherRecord[]>();
  for (const r of records) {
    if (!r.orderId) continue;
    const arr = map.get(r.orderId);
    if (arr) {
      arr.push(r);
    } else {
      map.set(r.orderId, [r]);
    }
  }
  return map;
}

function hasPhysicalConflictForPair(
  metric: YieldMetricKey,
  weights: Record<ButcherWeightField, number>
): boolean {
  const { liveWeight: live, hotWeight: hot, coldWeight: cold, packagedWeight: pack } = weights;
  if (live > 0 && hot > 0 && hot > live && (metric === 'hotToLive')) return true;
  if (hot > 0 && cold > 0 && cold > hot && (metric === 'coolerShrink' || metric === 'coldToLive')) return true;
  if (live > 0 && cold > 0 && cold > live && metric === 'coldToLive') return true;
  if (cold > 0 && pack > 0 && pack > cold && (metric === 'cuttingYield' || metric === 'packagedToLive' || metric === 'packagedToHot')) return true;
  if (hot > 0 && pack > 0 && pack > hot && (metric === 'packagedToHot' || metric === 'packagedToLive')) return true;
  if (live > 0 && pack > 0 && pack > live && metric === 'packagedToLive') return true;
  return false;
}

export function computeOrderRawYields(
  weights: Record<ButcherWeightField, number>
): Record<YieldMetricKey, number | null> {
  const { liveWeight: live, hotWeight: hot, coldWeight: cold, packagedWeight: pack } = weights;
  return {
    hotToLive: live > 0 && hot > 0 ? (hot / live) * 100 : null,
    coldToLive: live > 0 && cold > 0 ? (cold / live) * 100 : null,
    packagedToLive: live > 0 && pack > 0 ? (pack / live) * 100 : null,
    coolerShrink: hot > 0 && cold > 0 ? ((hot - cold) / hot) * 100 : null,
    cuttingYield: cold > 0 && pack > 0 ? (pack / cold) * 100 : null,
    packagedToHot: hot > 0 && pack > 0 ? (pack / hot) * 100 : null,
  };
}

function getOrderTagClassification(
  order: ButcherOrder,
  tagById: Map<string, ButcherOrderTag>
): {
  assignedTags: ButcherOrderTag[];
  excludedByTags: ButcherOrderTag[];
  cohortTags: ButcherOrderTag[];
} {
  const rawIds = Array.isArray(order.tagIds) ? order.tagIds : [];
  const assignedTags: ButcherOrderTag[] = [];
  const seen = new Set<string>();
  for (const id of rawIds) {
    if (seen.has(id)) continue;
    const t = tagById.get(id);
    if (t) {
      seen.add(id);
      assignedTags.push(t);
    }
  }
  const excludedByTags = assignedTags.filter(t => t.weightCheckMode === 'exclude_from_baseline');
  const cohortTags = assignedTags.filter(t => t.weightCheckMode === 'separate_baseline');
  return { assignedTags, excludedByTags, cohortTags };
}

export const UNASSIGNED_BUTCHER_KEY = '__unassigned__';

export function normalizeButcherKey(locationId?: string): string {
  return (locationId || '').trim() || UNASSIGNED_BUTCHER_KEY;
}

export function resolveButcherDisplayName(
  locationId?: string,
  locationNameById?: Map<string, string>
): string {
  const trimmed = (locationId || '').trim();
  if (!trimmed) return 'Unassigned Butcher';
  return locationNameById?.get(trimmed) || trimmed;
}

export function buildSpeciesButcherBaselineKey(
  speciesKey: string,
  groupingMode: ButcherBaselineGroupingMode = 'species',
  locationId?: string
): string {
  if (groupingMode === 'species_and_butcher') {
    return `${speciesKey}::butcher::${normalizeButcherKey(locationId)}`;
  }
  return speciesKey;
}

function formatBaseBaselineLabel(
  speciesLabel: string,
  effectiveGrouping: ButcherBaselineGroupingMode,
  locationId?: string,
  locationNameById?: Map<string, string>
): string {
  if (effectiveGrouping === 'species_and_butcher') {
    return `${speciesLabel} · ${resolveButcherDisplayName(locationId, locationNameById)}`;
  }
  return speciesLabel;
}

function getEffectiveGroupingForScope(
  groupingMode: ButcherBaselineGroupingMode,
  scope: ButcherBaselineComparisonScope
): ButcherBaselineGroupingMode {
  if (scope.butcherFilter === 'same_butcher') return 'species_and_butcher';
  if (scope.butcherFilter === 'all_butchers') return 'species';
  return groupingMode;
}

export function buildCohortBaselineKey(baseKey: string, tagIds: string[]): string {
  const sorted = Array.from(new Set(tagIds.filter(Boolean))).sort();
  if (sorted.length === 0) return baseKey;
  return `${baseKey}::cohort::${sorted.join('+')}`;
}

export function serializeBaselineScope(scope: ButcherBaselineComparisonScope): string {
  const filterSuffix =
    scope.butcherFilter === 'same_butcher' || scope.butcherFilter === 'all_butchers'
      ? `::${scope.butcherFilter}`
      : '';
  if (scope.mode === 'tag_cohort') {
    const sorted = Array.from(new Set(scope.tagIds.filter(Boolean))).sort();
    return `tag_cohort:${sorted.join('+')}${filterSuffix}`;
  }
  return `${scope.mode}${filterSuffix}`;
}

function computeBaselineFromOrders(
  matchingOrders: ButcherOrder[],
  recordsByOrderId: Map<string, ButcherRecord[]>,
  speciesKey: string,
  speciesLabel: string
): SpeciesBaseline {
  const cleanOrderIds = new Set<string>();
  const samples: Record<YieldMetricKey, SpeciesBaselineSample[]> = {
    hotToLive: [],
    coldToLive: [],
    packagedToLive: [],
    coolerShrink: [],
    cuttingYield: [],
    packagedToHot: [],
  };

  for (const order of matchingOrders) {
    const matching = recordsByOrderId.get(order.id) || [];
    const packagedWeight = getPackagedWeightForOrder(order.id, matching);
    const weights: Record<ButcherWeightField, number> = {
      liveWeight: order.liveWeight || 0,
      hotWeight: order.hotWeight || 0,
      coldWeight: order.coldWeight || 0,
      packagedWeight,
    };
    const yields = computeOrderRawYields(weights);
    const flags = order.weightAnomalies || {};
    const harvestTimestamp = getOrderHarvestTimestamp(order);

    let orderContributedClean = false;
    (Object.keys(METRIC_FIELDS) as YieldMetricKey[]).forEach(metric => {
      const val = yields[metric];
      if (val === null || !Number.isFinite(val)) return;
      if (val <= 0 || val > 100) return;
      if (hasPhysicalConflictForPair(metric, weights)) return;
      const [fA, fB] = METRIC_FIELDS[metric];
      if (flags[fA]?.status === 'flagged' || flags[fB]?.status === 'flagged') return;

      samples[metric].push({
        orderId: order.id,
        value: val,
        timestamp: harvestTimestamp,
        recencyWeight: 1,
      });
      orderContributedClean = true;
    });

    if (orderContributedClean) {
      cleanOrderIds.add(order.id);
    }
  }

  return {
    speciesKey,
    speciesLabel,
    cleanOrderCount: cleanOrderIds.size,
    metrics: {
      hotToLive: computeMetricStats(samples.hotToLive),
      coldToLive: computeMetricStats(samples.coldToLive),
      packagedToLive: computeMetricStats(samples.packagedToLive),
      coolerShrink: computeMetricStats(samples.coolerShrink),
      cuttingYield: computeMetricStats(samples.cuttingYield),
      packagedToHot: computeMetricStats(samples.packagedToHot),
    },
  };
}

/**
 * Computes clean per-species (or per-species & butcher) and per-separate-baseline-tag-cohort
 * baseline yield percentages from unflagged, physically valid orders.
 * Orders carrying an `exclude_from_baseline` or `separate_baseline` tag do not pollute the
 * standard pool; `separate_baseline` orders populate their dedicated cohort baseline(s).
 */
export function computeSpeciesBaselines(
  orders: ButcherOrder[],
  recordsByOrderId: Map<string, ButcherRecord[]>,
  butcherTags: ButcherOrderTag[] = [],
  groupingMode: ButcherBaselineGroupingMode = 'species',
  locationNameById?: Map<string, string>
): Map<string, SpeciesBaseline> {
  const tagById = new Map(butcherTags.map(t => [t.id, t]));
  const buckets = new Map<
    string,
    { label: string; orders: ButcherOrder[] }
  >();

  const addOrderToBucket = (key: string, label: string, order: ButcherOrder) => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { label, orders: [] };
      buckets.set(key, bucket);
    }
    bucket.orders.push(order);
  };

  for (const order of orders) {
    const speciesKey = normalizeSpeciesKey(order.species);
    const speciesLabel = (order.species || 'Unknown').trim() || 'Unknown';
    const baseKey = buildSpeciesButcherBaselineKey(speciesKey, groupingMode, order.locationId);
    const baseLabel = formatBaseBaselineLabel(
      speciesLabel,
      groupingMode,
      order.locationId,
      locationNameById
    );
    const { excludedByTags, cohortTags } = getOrderTagClassification(order, tagById);

    // Ensure the standard base bucket key exists even if all orders are tagged
    if (!buckets.has(baseKey)) {
      buckets.set(baseKey, { label: baseLabel, orders: [] });
    }

    if (excludedByTags.length > 0) {
      continue;
    }

    if (cohortTags.length > 0) {
      // Populate exact combined cohort key (for multi-tag cohort orders)
      const combinedIds = cohortTags.map(t => t.id);
      const combinedKey = buildCohortBaselineKey(baseKey, combinedIds);
      const combinedLabel = `${baseLabel} · ${cohortTags.map(t => t.name).join(' + ')}`;
      addOrderToBucket(combinedKey, combinedLabel, order);

      // Also populate each individual cohort tag bucket so single-tag peers still match
      if (cohortTags.length > 1) {
        for (const tag of cohortTags) {
          const singleKey = buildCohortBaselineKey(baseKey, [tag.id]);
          addOrderToBucket(singleKey, `${baseLabel} · ${tag.name}`, order);
        }
      }
      continue;
    }

    addOrderToBucket(baseKey, baseLabel, order);
  }

  const baselines = new Map<string, SpeciesBaseline>();
  for (const [key, bucket] of buckets.entries()) {
    baselines.set(
      key,
      computeBaselineFromOrders(bucket.orders, recordsByOrderId, key, bucket.label)
    );
  }

  return baselines;
}

function countLeaveOneOutCleanPeers(baseline: SpeciesBaseline | null, excludeOrderId: string): number {
  if (!baseline) return 0;
  const peerIds = new Set<string>();
  (Object.keys(METRIC_FIELDS) as YieldMetricKey[]).forEach(metric => {
    const samples = baseline.metrics[metric]?.samples || [];
    for (const s of samples) {
      if (s.orderId !== excludeOrderId) {
        peerIds.add(s.orderId);
      }
    }
  });
  return peerIds.size;
}

function resolveBaselineForOrderAndScope(
  order: ButcherOrder,
  allOrders: ButcherOrder[],
  recordsByOrderId: Map<string, ButcherRecord[]>,
  butcherTags: ButcherOrderTag[],
  comparisonScope: ButcherBaselineComparisonScope,
  precomputedBaselines?: Map<string, SpeciesBaseline>,
  groupingMode: ButcherBaselineGroupingMode = 'species',
  locationNameById?: Map<string, string>
): {
  baseline: SpeciesBaseline | null;
  baselineLabel: string;
  effectiveGroupingMode: ButcherBaselineGroupingMode;
  excludedFromStatisticalBaseline: boolean;
  excludedByTags: ButcherOrderTag[];
  cohortTags: ButcherOrderTag[];
} {
  const tagById = new Map(butcherTags.map(t => [t.id, t]));
  const speciesKey = normalizeSpeciesKey(order.species);
  const speciesLabel = (order.species || 'Unknown').trim() || 'Unknown';
  const effectiveGrouping = getEffectiveGroupingForScope(groupingMode, comparisonScope);
  const baseKey = buildSpeciesButcherBaselineKey(speciesKey, effectiveGrouping, order.locationId);
  const baseLabel = formatBaseBaselineLabel(
    speciesLabel,
    effectiveGrouping,
    order.locationId,
    locationNameById
  );
  const orderButcherKey = normalizeButcherKey(order.locationId);
  const matchesGroup = (o: ButcherOrder) =>
    normalizeSpeciesKey(o.species) === speciesKey &&
    (effectiveGrouping !== 'species_and_butcher' ||
      normalizeButcherKey(o.locationId) === orderButcherKey);

  const getBaselines = () =>
    precomputedBaselines && effectiveGrouping === groupingMode
      ? precomputedBaselines
      : computeSpeciesBaselines(
          allOrders,
          recordsByOrderId,
          butcherTags,
          effectiveGrouping,
          locationNameById
        );

  const { excludedByTags, cohortTags } = getOrderTagClassification(order, tagById);

  if (comparisonScope.mode === 'all_species') {
    const matchingOrders = allOrders.filter(matchesGroup);
    const label = `${baseLabel} (All Orders)`;
    return {
      baseline: computeBaselineFromOrders(matchingOrders, recordsByOrderId, `${baseKey}::all`, label),
      baselineLabel: label,
      effectiveGroupingMode: effectiveGrouping,
      excludedFromStatisticalBaseline: false,
      excludedByTags,
      cohortTags,
    };
  }

  if (comparisonScope.mode === 'standard') {
    const baselines = getBaselines();
    const stdBaseline = baselines.get(baseKey) || null;
    const filterSuffix =
      comparisonScope.butcherFilter === 'all_butchers' ? ' · All Butchers' : '';
    return {
      baseline: stdBaseline,
      baselineLabel: `${baseLabel}${filterSuffix} (Standard)`,
      effectiveGroupingMode: effectiveGrouping,
      excludedFromStatisticalBaseline: false,
      excludedByTags,
      cohortTags,
    };
  }

  if (comparisonScope.mode === 'tag_cohort') {
    const reqIds = Array.from(new Set(comparisonScope.tagIds.filter(Boolean))).sort();
    if (reqIds.length === 0) {
      const baselines = getBaselines();
      return {
        baseline: baselines.get(baseKey) || null,
        baselineLabel: baseLabel,
        effectiveGroupingMode: effectiveGrouping,
        excludedFromStatisticalBaseline: false,
        excludedByTags,
        cohortTags,
      };
    }
    const reqNames = reqIds.map(id => tagById.get(id)?.name || id);
    const label = `${baseLabel} · ${reqNames.join(' + ')}`;
    const matchingOrders = allOrders.filter(o => {
      if (!matchesGroup(o)) return false;
      const oTagSet = new Set(Array.isArray(o.tagIds) ? o.tagIds : []);
      return reqIds.every(reqId => oTagSet.has(reqId));
    });
    return {
      baseline: computeBaselineFromOrders(
        matchingOrders,
        recordsByOrderId,
        buildCohortBaselineKey(baseKey, reqIds),
        label
      ),
      baselineLabel: label,
      effectiveGroupingMode: effectiveGrouping,
      excludedFromStatisticalBaseline: false,
      excludedByTags,
      cohortTags,
    };
  }

  // mode === 'auto'
  if (excludedByTags.length > 0) {
    return {
      baseline: null,
      baselineLabel: `${baseLabel} (Excluded by ${excludedByTags.map(t => t.name).join(', ')})`,
      effectiveGroupingMode: effectiveGrouping,
      excludedFromStatisticalBaseline: true,
      excludedByTags,
      cohortTags,
    };
  }

  const baselines = getBaselines();
  if (cohortTags.length > 0) {
    const cohortKey = buildCohortBaselineKey(baseKey, cohortTags.map(t => t.id));
    const label = `${baseLabel} · ${cohortTags.map(t => t.name).join(' + ')}`;
    const cohortBaseline =
      baselines.get(cohortKey) || computeBaselineFromOrders([], recordsByOrderId, cohortKey, label);
    return {
      baseline: cohortBaseline,
      baselineLabel: label,
      effectiveGroupingMode: effectiveGrouping,
      excludedFromStatisticalBaseline: false,
      excludedByTags,
      cohortTags,
    };
  }

  const stdBaseline = baselines.get(baseKey) || null;
  return {
    baseline: stdBaseline,
    baselineLabel: stdBaseline?.speciesLabel || baseLabel,
    effectiveGroupingMode: effectiveGrouping,
    excludedFromStatisticalBaseline: false,
    excludedByTags,
    cohortTags,
  };
}

/**
 * Builds the selectable baseline comparison options for the Weight Audit modal so operators
 * can inspect an order (especially one with multiple tags or processor-specific yields) against
 * its auto cohort, individual tags, combined multi-tag cohort, standard baseline, all orders,
 * or cross-compare Same Butcher vs. All Butchers on demand.
 */
export function listAvailableBaselineScopesForOrder(
  order: ButcherOrder,
  allOrders: ButcherOrder[],
  recordsByOrderId: Map<string, ButcherRecord[]>,
  butcherTags: ButcherOrderTag[] = [],
  groupingMode: ButcherBaselineGroupingMode = 'species',
  locationNameById?: Map<string, string>
): BaselineScopeOption[] {
  const tagById = new Map(butcherTags.map(t => [t.id, t]));
  const speciesLabel = (order.species || 'Unknown').trim() || 'Unknown';
  const baseLabel = formatBaseBaselineLabel(
    speciesLabel,
    groupingMode,
    order.locationId,
    locationNameById
  );
  const { assignedTags, excludedByTags, cohortTags } = getOrderTagClassification(order, tagById);
  const baselines = computeSpeciesBaselines(
    allOrders,
    recordsByOrderId,
    butcherTags,
    groupingMode,
    locationNameById
  );

  const options: BaselineScopeOption[] = [];
  const seenScopeIds = new Set<string>();

  const pushOption = (opt: BaselineScopeOption) => {
    if (seenScopeIds.has(opt.id)) return;
    seenScopeIds.add(opt.id);
    options.push(opt);
  };

  // 1. Auto scope (mirrors Review Queue behavior)
  const autoResolved = resolveBaselineForOrderAndScope(
    order,
    allOrders,
    recordsByOrderId,
    butcherTags,
    { mode: 'auto' },
    baselines,
    groupingMode,
    locationNameById
  );
  const autoPeers = countLeaveOneOutCleanPeers(autoResolved.baseline, order.id);
  const autoDesc = excludedByTags.length > 0
    ? `Statistical alerts paused by ${excludedByTags.map(t => t.name).join(', ')}`
    : cohortTags.length > 0
      ? `Matches order's cohort tag${cohortTags.length > 1 ? 's' : ''}: ${cohortTags.map(t => t.name).join(' + ')}`
      : groupingMode === 'species_and_butcher'
        ? `Standard ${baseLabel} baseline (Species & Butcher setting)`
        : `Standard ${speciesLabel} baseline across all butchers`;
  pushOption({
    id: 'auto',
    label: `Auto (${autoResolved.baselineLabel})`,
    description: autoDesc,
    scope: { mode: 'auto' },
    cleanPeerCount: autoPeers,
  });

  // 2. If the order has 2+ assigned tags (of any mode), offer combined multi-tag cohort
  if (assignedTags.length >= 2) {
    const comboIds = assignedTags.map(t => t.id);
    const comboScope: ButcherBaselineComparisonScope = { mode: 'tag_cohort', tagIds: comboIds };
    const comboResolved = resolveBaselineForOrderAndScope(
      order,
      allOrders,
      recordsByOrderId,
      butcherTags,
      comboScope,
      baselines,
      groupingMode,
      locationNameById
    );
    pushOption({
      id: serializeBaselineScope(comboScope),
      label: `${baseLabel} · ${assignedTags.map(t => t.name).join(' + ')}`,
      description: 'Peers carrying all tags currently assigned to this order',
      scope: comboScope,
      cleanPeerCount: countLeaveOneOutCleanPeers(comboResolved.baseline, order.id),
    });
  }

  // 3. Each tag currently assigned to the order individually
  for (const tag of assignedTags) {
    const tagScope: ButcherBaselineComparisonScope = { mode: 'tag_cohort', tagIds: [tag.id] };
    const resolved = resolveBaselineForOrderAndScope(
      order,
      allOrders,
      recordsByOrderId,
      butcherTags,
      tagScope,
      baselines,
      groupingMode,
      locationNameById
    );
    pushOption({
      id: serializeBaselineScope(tagScope),
      label: `${baseLabel} · ${tag.name}`,
      description: `All clean ${baseLabel} peers tagged "${tag.name}"`,
      scope: tagScope,
      cleanPeerCount: countLeaveOneOutCleanPeers(resolved.baseline, order.id),
    });
  }

  // 4. Other configured butcher tags that have clean peers of this group
  const assignedIdSet = new Set(assignedTags.map(t => t.id));
  for (const tag of butcherTags) {
    if (assignedIdSet.has(tag.id)) continue;
    const tagScope: ButcherBaselineComparisonScope = { mode: 'tag_cohort', tagIds: [tag.id] };
    const resolved = resolveBaselineForOrderAndScope(
      order,
      allOrders,
      recordsByOrderId,
      butcherTags,
      tagScope,
      baselines,
      groupingMode,
      locationNameById
    );
    const peerCount = countLeaveOneOutCleanPeers(resolved.baseline, order.id);
    if (peerCount > 0) {
      pushOption({
        id: serializeBaselineScope(tagScope),
        label: `${baseLabel} · ${tag.name}`,
        description: `Compare against ${baseLabel} peers tagged "${tag.name}"`,
        scope: tagScope,
        cleanPeerCount: peerCount,
      });
    }
  }

  // 5. Standard Baseline (excluding separate-cohort & excluded orders)
  const stdResolved = resolveBaselineForOrderAndScope(
    order,
    allOrders,
    recordsByOrderId,
    butcherTags,
    { mode: 'standard' },
    baselines,
    groupingMode,
    locationNameById
  );
  pushOption({
    id: 'standard',
    label: `${baseLabel} · Standard Baseline`,
    description: `Clean ${baseLabel} orders without special baseline tags`,
    scope: { mode: 'standard' },
    cleanPeerCount: countLeaveOneOutCleanPeers(stdResolved.baseline, order.id),
  });

  // 6. All Orders in Group (including tagged)
  const allResolved = resolveBaselineForOrderAndScope(
    order,
    allOrders,
    recordsByOrderId,
    butcherTags,
    { mode: 'all_species' },
    baselines,
    groupingMode,
    locationNameById
  );
  pushOption({
    id: 'all_species',
    label: `${baseLabel} · All Orders (Incl. Tagged)`,
    description: `Every clean ${baseLabel} order regardless of tags`,
    scope: { mode: 'all_species' },
    cleanPeerCount: countLeaveOneOutCleanPeers(allResolved.baseline, order.id),
  });

  // 7. Cross-mode comparison override (All Butchers when in Species & Butcher mode, or Same Butcher Only when in Species Only mode)
  if (groupingMode === 'species_and_butcher') {
    const allButchersScope: ButcherBaselineComparisonScope = {
      mode: 'standard',
      butcherFilter: 'all_butchers',
    };
    const allButchersResolved = resolveBaselineForOrderAndScope(
      order,
      allOrders,
      recordsByOrderId,
      butcherTags,
      allButchersScope,
      undefined,
      groupingMode,
      locationNameById
    );
    pushOption({
      id: serializeBaselineScope(allButchersScope),
      label: `${speciesLabel} · All Butchers (Standard)`,
      description: `Compare across all clean ${speciesLabel} orders from every butcher`,
      scope: allButchersScope,
      cleanPeerCount: countLeaveOneOutCleanPeers(allButchersResolved.baseline, order.id),
    });
  } else if ((order.locationId || '').trim()) {
    const butcherName = resolveButcherDisplayName(order.locationId, locationNameById);
    const sameButcherScope: ButcherBaselineComparisonScope = {
      mode: 'standard',
      butcherFilter: 'same_butcher',
    };
    const sameButcherResolved = resolveBaselineForOrderAndScope(
      order,
      allOrders,
      recordsByOrderId,
      butcherTags,
      sameButcherScope,
      undefined,
      groupingMode,
      locationNameById
    );
    pushOption({
      id: serializeBaselineScope(sameButcherScope),
      label: `${speciesLabel} · ${butcherName} Only (Standard)`,
      description: `Compare strictly against clean ${speciesLabel} orders from ${butcherName}`,
      scope: sameButcherScope,
      cleanPeerCount: countLeaveOneOutCleanPeers(sameButcherResolved.baseline, order.id),
    });
  }

  return options;
}

function getPreferredBaselineRate(
  baseline: SpeciesBaseline | null,
  metric: YieldMetricKey,
  excludeOrderId?: string
): { pct: number; sampleCount: number } | null {
  if (!baseline) return null;
  const metricStats = baseline.metrics[metric];
  if (!metricStats || metricStats.samples.length === 0) return null;
  const filtered = excludeOrderId
    ? metricStats.samples.filter(s => s.orderId !== excludeOrderId)
    : metricStats.samples;
  // Never fall back to the target order's own yield ratio; that produces a circular self-estimate
  if (filtered.length === 0) return null;
  const weightedPool = assignRecencyWeights(filtered).map(s => ({
    value: s.value,
    weight: s.recencyWeight,
  }));
  const pct = weightedPool.length >= 4 ? calcWeightedMedian(weightedPool) : calcWeightedMean(weightedPool);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  return { pct, sampleCount: weightedPool.length };
}

function getEffectiveWeightsForOrder(
  order: ButcherOrder,
  packagedWeight: number
): {
  actualWeights: Record<ButcherWeightField, number>;
  effectiveWeights: Record<ButcherWeightField, number>;
  adjustedFields: ButcherWeightField[];
} {
  const actualWeights: Record<ButcherWeightField, number> = {
    liveWeight: order.liveWeight || 0,
    hotWeight: order.hotWeight || 0,
    coldWeight: order.coldWeight || 0,
    packagedWeight,
  };
  const est = order.estimatedWeights;
  const effectiveWeights: Record<ButcherWeightField, number> = { ...actualWeights };
  const adjustedFields: ButcherWeightField[] = [];

  (['liveWeight', 'hotWeight', 'coldWeight', 'packagedWeight'] as ButcherWeightField[]).forEach((f) => {
    const estVal = est?.[f];
    if (typeof estVal === 'number' && Number.isFinite(estVal) && estVal > 0) {
      effectiveWeights[f] = estVal;
      if (Math.abs(estVal - actualWeights[f]) > 0.01) {
        adjustedFields.push(f);
      }
    }
  });

  return { actualWeights, effectiveWeights, adjustedFields };
}

/**
 * Computes suggested weight approximations for each weight field using trusted weights
 * (unflagged actuals, user-supplied replacement estimates, or confirmed-valid fields)
 * and clean per-species yield baselines.
 */
export function computeSuggestedWeights(
  order: ButcherOrder,
  packagedWeight: number,
  baseline: SpeciesBaseline | null,
  suspectFields: ButcherWeightField[] = []
): {
  suggestedEstimates: Partial<Record<ButcherWeightField, number>>;
  estimateExplanations: Partial<Record<ButcherWeightField, string>>;
} {
  const { actualWeights, effectiveWeights: weights } = getEffectiveWeightsForOrder(order, packagedWeight);
  const flags = order.weightAnomalies || {};
  const suspectSet = new Set(suspectFields);

  const hasCustomEstimate = (field: ButcherWeightField): boolean => {
    const val = order.estimatedWeights?.[field];
    return typeof val === 'number' && Number.isFinite(val) && val > 0;
  };
  const isAdjusted = (field: ButcherWeightField): boolean =>
    hasCustomEstimate(field) && Math.abs(weights[field] - actualWeights[field]) > 0.01;
  const isConfirmedValid = (field: ButcherWeightField): boolean =>
    flags[field]?.status === 'dismissed';
  const anchorLabel = (field: ButcherWeightField, baseLabel: string): string =>
    isAdjusted(field) ? `${baseLabel} (est.)` : baseLabel;

  const suggestedEstimates: Partial<Record<ButcherWeightField, number>> = {};
  const estimateExplanations: Partial<Record<ButcherWeightField, string>> = {};

  const isTrustedForBound = (field: ButcherWeightField): boolean => {
    if (weights[field] <= 0) return false;
    if (flags[field]?.status === 'flagged' && !hasCustomEstimate(field)) return false;
    if (suspectSet.has(field) && !hasCustomEstimate(field) && !isConfirmedValid(field)) return false;
    return true;
  };

  const STAGE_ORDER: ButcherWeightField[] = ['liveWeight', 'hotWeight', 'coldWeight', 'packagedWeight'];

  const buildEstimate = (target: ButcherWeightField) => {
    const targetIdx = STAGE_ORDER.indexOf(target);
    const trustedUpstream = STAGE_ORDER.slice(0, targetIdx).filter(isTrustedForBound);
    const trustedDownstream = STAGE_ORDER.slice(targetIdx + 1).filter(isTrustedForBound);
    const maxBound =
      trustedUpstream.length > 0 ? Math.min(...trustedUpstream.map(f => weights[f])) : Infinity;
    const minBound =
      trustedDownstream.length > 0 ? Math.max(...trustedDownstream.map(f => weights[f])) : 0;

    // Pass 1: use strictly non-flagged (or replacement-estimated), non-suspect (or user-confirmed/estimated) anchors
    // Pass 2: fallback to any usable anchor if Pass 1 had none
    for (const strict of [true, false]) {
      const candidates: { value: number; desc: string }[] = [];
      const canUse = (anchor: ButcherWeightField) => {
        if (anchor === target || weights[anchor] <= 0) return false;
        // Flagged weights without a custom replacement estimate cannot act as anchors
        if (flags[anchor]?.status === 'flagged' && !hasCustomEstimate(anchor)) return false;
        // User-adjusted weights and Confirmed Valid weights act as trusted Tier-1 anchors
        if (strict && suspectSet.has(anchor) && !hasCustomEstimate(anchor) && !isConfirmedValid(anchor)) {
          return false;
        }
        return true;
      };

      // Use the nearest usable upstream anchor and nearest usable downstream anchor so
      // confirmed atypical upstream/downstream transitions (e.g. skinned Live->Hot) don't jump
      // across an adjacent trusted weight and project physically impossible numbers.
      if (target === 'liveWeight') {
        const rHot = getPreferredBaselineRate(baseline, 'hotToLive', order.id);
        const rCold = getPreferredBaselineRate(baseline, 'coldToLive', order.id);
        const rPack = getPreferredBaselineRate(baseline, 'packagedToLive', order.id);
        if (canUse('hotWeight') && rHot) {
          candidates.push({
            value: weights.hotWeight / (rHot.pct / 100),
            desc: `${anchorLabel('hotWeight', 'Hot')} ${weights.hotWeight.toFixed(1)} lbs ÷ ${rHot.pct.toFixed(1)}% Dressing avg [downstream]`,
          });
        } else if (canUse('coldWeight') && rCold) {
          candidates.push({
            value: weights.coldWeight / (rCold.pct / 100),
            desc: `${anchorLabel('coldWeight', 'Cold')} ${weights.coldWeight.toFixed(1)} lbs ÷ ${rCold.pct.toFixed(1)}% Cold/Live avg [downstream]`,
          });
        } else if (canUse('packagedWeight') && rPack) {
          candidates.push({
            value: weights.packagedWeight / (rPack.pct / 100),
            desc: `${anchorLabel('packagedWeight', 'Packaged')} ${weights.packagedWeight.toFixed(1)} lbs ÷ ${rPack.pct.toFixed(1)}% Standing avg [downstream]`,
          });
        }
      } else if (target === 'hotWeight') {
        const rHot = getPreferredBaselineRate(baseline, 'hotToLive', order.id);
        if (canUse('liveWeight') && rHot) {
          candidates.push({
            value: weights.liveWeight * (rHot.pct / 100),
            desc: `${anchorLabel('liveWeight', 'Live')} ${weights.liveWeight.toFixed(1)} lbs × ${rHot.pct.toFixed(1)}% Dressing avg [upstream]`,
          });
        }
        const rShrink = getPreferredBaselineRate(baseline, 'coolerShrink', order.id);
        const rPackHot = getPreferredBaselineRate(baseline, 'packagedToHot', order.id);
        if (canUse('coldWeight') && rShrink && rShrink.pct < 99) {
          candidates.push({
            value: weights.coldWeight / (1 - rShrink.pct / 100),
            desc: `${anchorLabel('coldWeight', 'Cold')} ${weights.coldWeight.toFixed(1)} lbs ÷ (1 - ${rShrink.pct.toFixed(1)}% Shrink avg) [downstream]`,
          });
        } else if (canUse('packagedWeight') && rPackHot) {
          candidates.push({
            value: weights.packagedWeight / (rPackHot.pct / 100),
            desc: `${anchorLabel('packagedWeight', 'Packaged')} ${weights.packagedWeight.toFixed(1)} lbs ÷ ${rPackHot.pct.toFixed(1)}% Pack/Hot avg [downstream]`,
          });
        }
      } else if (target === 'coldWeight') {
        const rShrink = getPreferredBaselineRate(baseline, 'coolerShrink', order.id);
        const rCold = getPreferredBaselineRate(baseline, 'coldToLive', order.id);
        if (canUse('hotWeight') && rShrink) {
          candidates.push({
            value: weights.hotWeight * (1 - rShrink.pct / 100),
            desc: `${anchorLabel('hotWeight', 'Hot')} ${weights.hotWeight.toFixed(1)} lbs × (1 - ${rShrink.pct.toFixed(1)}% Shrink avg) [upstream]`,
          });
        } else if (canUse('liveWeight') && rCold) {
          candidates.push({
            value: weights.liveWeight * (rCold.pct / 100),
            desc: `${anchorLabel('liveWeight', 'Live')} ${weights.liveWeight.toFixed(1)} lbs × ${rCold.pct.toFixed(1)}% Cold/Live avg [upstream]`,
          });
        }
        const rCut = getPreferredBaselineRate(baseline, 'cuttingYield', order.id);
        if (canUse('packagedWeight') && rCut) {
          candidates.push({
            value: weights.packagedWeight / (rCut.pct / 100),
            desc: `${anchorLabel('packagedWeight', 'Packaged')} ${weights.packagedWeight.toFixed(1)} lbs ÷ ${rCut.pct.toFixed(1)}% Cutting avg [downstream]`,
          });
        }
      } else if (target === 'packagedWeight') {
        const rCut = getPreferredBaselineRate(baseline, 'cuttingYield', order.id);
        const rPackHot = getPreferredBaselineRate(baseline, 'packagedToHot', order.id);
        const rPackLive = getPreferredBaselineRate(baseline, 'packagedToLive', order.id);
        if (canUse('coldWeight') && rCut) {
          candidates.push({
            value: weights.coldWeight * (rCut.pct / 100),
            desc: `${anchorLabel('coldWeight', 'Cold')} ${weights.coldWeight.toFixed(1)} lbs × ${rCut.pct.toFixed(1)}% Cutting avg [upstream]`,
          });
        } else if (canUse('hotWeight') && rPackHot) {
          candidates.push({
            value: weights.hotWeight * (rPackHot.pct / 100),
            desc: `${anchorLabel('hotWeight', 'Hot')} ${weights.hotWeight.toFixed(1)} lbs × ${rPackHot.pct.toFixed(1)}% Pack/Hot avg [upstream]`,
          });
        } else if (canUse('liveWeight') && rPackLive) {
          candidates.push({
            value: weights.liveWeight * (rPackLive.pct / 100),
            desc: `${anchorLabel('liveWeight', 'Live')} ${weights.liveWeight.toFixed(1)} lbs × ${rPackLive.pct.toFixed(1)}% Standing avg [upstream]`,
          });
        }
      }

      if (candidates.length > 0) {
        let activeCandidates = candidates;
        if (minBound <= maxBound) {
          const withinPhysicalBounds = candidates.filter(
            c => c.value >= minBound - 0.05 && c.value <= maxBound + 0.05
          );
          if (withinPhysicalBounds.length > 0) {
            activeCandidates = withinPhysicalBounds;
          }
        }
        let avg = calcMean(activeCandidates.map(c => c.value));
        let clamped = false;
        if (minBound <= maxBound && Number.isFinite(avg)) {
          if (avg > maxBound) {
            avg = maxBound;
            clamped = true;
          } else if (avg < minBound) {
            avg = minBound;
            clamped = true;
          }
        }
        if (Number.isFinite(avg) && avg > 0) {
          suggestedEstimates[target] = Math.round(avg * 10) / 10;
          estimateExplanations[target] =
            activeCandidates.map(c => c.desc).join(' · ') +
            (clamped ? ' (clamped to valid physical bounds)' : '');
        }
        break;
      }
    }
  };

  (['liveWeight', 'hotWeight', 'coldWeight', 'packagedWeight'] as ButcherWeightField[]).forEach(buildEstimate);

  return { suggestedEstimates, estimateExplanations };
}

/**
 * Performs physical error checks, leave-one-out statistical significance testing against
 * clean species peers, cross-ratio triangulation, and weight approximation.
 * Re-evaluates live using any supplied estimatedWeights and skips checks involving
 * unestimated flagged weights so fixed or remaining anomalies update immediately.
 */
export function analyzeOrderAnomalies(
  order: ButcherOrder,
  matchingRecords: ButcherRecord[],
  allOrders: ButcherOrder[],
  recordsByOrderId: Map<string, ButcherRecord[]>,
  sensitivityInput: number = DEFAULT_ANOMALY_SENSITIVITY,
  precomputedBaselines?: Map<string, SpeciesBaseline>,
  butcherTags: ButcherOrderTag[] = [],
  comparisonScope: ButcherBaselineComparisonScope = { mode: 'auto' },
  groupingMode: ButcherBaselineGroupingMode = 'species',
  locationNameById?: Map<string, string>
): ButcherOrderAnomalyAnalysis {
  const sensitivity = clampSensitivity(sensitivityInput);
  const speciesKey = normalizeSpeciesKey(order.species);
  const {
    baseline: speciesBaseline,
    baselineLabel,
    effectiveGroupingMode,
    excludedFromStatisticalBaseline,
    excludedByTags,
    cohortTags,
  } = resolveBaselineForOrderAndScope(
    order,
    allOrders,
    recordsByOrderId,
    butcherTags,
    comparisonScope,
    precomputedBaselines,
    groupingMode,
    locationNameById
  );

  const packagedWeight = getPackagedWeightForOrder(order.id, matchingRecords);
  const { actualWeights, effectiveWeights, adjustedFields } = getEffectiveWeightsForOrder(
    order,
    packagedWeight
  );
  const actualYields = computeOrderRawYields(actualWeights);
  const effectiveYields = computeOrderRawYields(effectiveWeights);
  const flags = order.weightAnomalies || {};

  const hasCustomEstimate = (field: ButcherWeightField): boolean => {
    const val = order.estimatedWeights?.[field];
    return typeof val === 'number' && Number.isFinite(val) && val > 0;
  };
  const isUnestimatedFlagged = (field: ButcherWeightField): boolean =>
    flags[field]?.status === 'flagged' && !hasCustomEstimate(field);
  const isAdjusted = (field: ButcherWeightField): boolean =>
    adjustedFields.includes(field);
  const fmtEffectiveWeight = (field: ButcherWeightField): string =>
    isAdjusted(field)
      ? `${effectiveWeights[field].toFixed(1)} lbs (est.)`
      : `${effectiveWeights[field].toFixed(1)} lbs`;

  const findings: ButcherAnomalyFinding[] = [];
  const fieldSuspicionScore: Record<ButcherWeightField, number> = {
    liveWeight: 0,
    hotWeight: 0,
    coldWeight: 0,
    packagedWeight: 0,
  };

  const scorePhysicalPair = (fields: ButcherWeightField[]) => {
    fields.forEach(f => {
      if (flags[f]?.status !== 'dismissed') {
        fieldSuspicionScore[f] += 3;
      }
    });
  };

  // 1. Deterministic Physical Integrity Checks on Effective Weights
  if (
    !isUnestimatedFlagged('liveWeight') &&
    !isUnestimatedFlagged('hotWeight') &&
    effectiveWeights.liveWeight > 0 &&
    effectiveWeights.hotWeight > effectiveWeights.liveWeight
  ) {
    findings.push({
      id: 'phys-hot-gt-live',
      type: 'physical',
      severity: 'critical',
      metric: 'hotToLive',
      message: `Hot carcass weight (${fmtEffectiveWeight('hotWeight')}) exceeds live weight (${fmtEffectiveWeight('liveWeight')}).`,
      actualPct: effectiveYields.hotToLive ?? undefined,
      likelyFields: ['liveWeight', 'hotWeight'],
    });
    scorePhysicalPair(['liveWeight', 'hotWeight']);
  }

  if (
    !isUnestimatedFlagged('hotWeight') &&
    !isUnestimatedFlagged('coldWeight') &&
    effectiveWeights.hotWeight > 0 &&
    effectiveWeights.coldWeight > effectiveWeights.hotWeight
  ) {
    findings.push({
      id: 'phys-cold-gt-hot',
      type: 'physical',
      severity: 'critical',
      metric: 'coolerShrink',
      message: `Cold carcass weight (${fmtEffectiveWeight('coldWeight')}) exceeds hot weight (${fmtEffectiveWeight('hotWeight')}), producing negative cooler shrink.`,
      actualPct: effectiveYields.coolerShrink ?? undefined,
      likelyFields: ['hotWeight', 'coldWeight'],
    });
    scorePhysicalPair(['hotWeight', 'coldWeight']);
  }

  if (
    !isUnestimatedFlagged('coldWeight') &&
    !isUnestimatedFlagged('packagedWeight') &&
    effectiveWeights.coldWeight > 0 &&
    effectiveWeights.packagedWeight > effectiveWeights.coldWeight
  ) {
    findings.push({
      id: 'phys-pack-gt-cold',
      type: 'physical',
      severity: 'critical',
      metric: 'cuttingYield',
      message: `Packaged meat (${fmtEffectiveWeight('packagedWeight')}) exceeds cold carcass weight (${fmtEffectiveWeight('coldWeight')}).`,
      actualPct: effectiveYields.cuttingYield ?? undefined,
      likelyFields: ['coldWeight', 'packagedWeight'],
    });
    scorePhysicalPair(['coldWeight', 'packagedWeight']);
  } else if (
    !isUnestimatedFlagged('hotWeight') &&
    !isUnestimatedFlagged('packagedWeight') &&
    effectiveWeights.hotWeight > 0 &&
    effectiveWeights.packagedWeight > effectiveWeights.hotWeight
  ) {
    findings.push({
      id: 'phys-pack-gt-hot',
      type: 'physical',
      severity: 'critical',
      metric: 'packagedToHot',
      message: `Packaged meat (${fmtEffectiveWeight('packagedWeight')}) exceeds hot carcass weight (${fmtEffectiveWeight('hotWeight')}).`,
      actualPct: effectiveYields.packagedToHot ?? undefined,
      likelyFields: ['hotWeight', 'packagedWeight'],
    });
    scorePhysicalPair(['hotWeight', 'packagedWeight']);
  } else if (
    !isUnestimatedFlagged('liveWeight') &&
    !isUnestimatedFlagged('packagedWeight') &&
    effectiveWeights.liveWeight > 0 &&
    effectiveWeights.packagedWeight > effectiveWeights.liveWeight
  ) {
    findings.push({
      id: 'phys-pack-gt-live',
      type: 'physical',
      severity: 'critical',
      metric: 'packagedToLive',
      message: `Packaged meat (${fmtEffectiveWeight('packagedWeight')}) exceeds live weight (${fmtEffectiveWeight('liveWeight')}).`,
      actualPct: effectiveYields.packagedToLive ?? undefined,
      likelyFields: ['liveWeight', 'packagedWeight'],
    });
    scorePhysicalPair(['liveWeight', 'packagedWeight']);
  }

  // 2. Statistical Significance Comparison (Leave-One-Out per Species on Effective Yields)
  // Evaluate direct adjacent transitions first so confirmed transition anomalies (e.g., skinned Live->Hot)
  // don't cascade false alerts across span metrics onto normal downstream weights.
  let maxPeerCount = 0;
  const checkedMetrics: YieldMetricKey[] = [
    'hotToLive',
    'coolerShrink',
    'cuttingYield',
    'coldToLive',
    'packagedToHot',
    'packagedToLive',
  ];
  const anomalousMetrics = new Set<YieldMetricKey>();
  const normalMetrics = new Set<YieldMetricKey>();

  for (const metric of checkedMetrics) {
    if (excludedFromStatisticalBaseline || !speciesBaseline) continue;
    const [fA, fB] = METRIC_FIELDS[metric];
    if (isUnestimatedFlagged(fA) || isUnestimatedFlagged(fB)) continue;

    const confirmedLiveToHotAnomaly =
      anomalousMetrics.has('hotToLive') &&
      flags.liveWeight?.status === 'dismissed' &&
      flags.hotWeight?.status === 'dismissed' &&
      effectiveWeights.hotWeight > 0 &&
      !isUnestimatedFlagged('hotWeight');
    const confirmedHotToColdAnomaly =
      anomalousMetrics.has('coolerShrink') &&
      flags.hotWeight?.status === 'dismissed' &&
      flags.coldWeight?.status === 'dismissed' &&
      effectiveWeights.coldWeight > 0 &&
      !isUnestimatedFlagged('coldWeight');

    if (metric === 'coldToLive' && confirmedLiveToHotAnomaly) continue;
    if (metric === 'packagedToHot' && confirmedHotToColdAnomaly) continue;
    if (metric === 'packagedToLive' && (confirmedLiveToHotAnomaly || confirmedHotToColdAnomaly)) {
      continue;
    }

    const orderVal = effectiveYields[metric];
    if (orderVal === null || !Number.isFinite(orderVal)) continue;

    const metricStats = speciesBaseline?.metrics[metric];
    if (!metricStats) continue;

    const peerSamples = assignRecencyWeights(
      metricStats.samples.filter(s => s.orderId !== order.id)
    );
    if (peerSamples.length > maxPeerCount) maxPeerCount = peerSamples.length;
    if (peerSamples.length < 3) continue;

    const weightedPeers = peerSamples.map(s => ({ value: s.value, weight: s.recencyWeight }));
    const peerMedian = calcWeightedMedian(weightedPeers);
    const peerMean = calcWeightedMean(weightedPeers);
    const peerCenter = weightedPeers.length >= 4 ? peerMedian : peerMean;
    const peerMadSigma = calcWeightedMadSigma(weightedPeers, peerMedian);
    const peerStdDev = calcWeightedStdDev(weightedPeers, peerMean);

    const floorSpread = metric === 'coolerShrink' ? 1.0 : 2.0;
    const rawSpread = peerMadSigma > 0 ? peerMadSigma : peerStdDev;
    const spread = Math.max(rawSpread, floorSpread);

    const delta = orderVal - peerCenter;
    const zScore = delta / spread;
    const minDelta = metric === 'coolerShrink' ? sensitivity * 0.75 : sensitivity * 1.5;

    if (Math.abs(zScore) >= sensitivity && Math.abs(delta) >= minDelta) {
      anomalousMetrics.add(metric);
      fieldSuspicionScore[fA] += 2;
      fieldSuspicionScore[fB] += 2;

      const usesEstimate = isAdjusted(fA) || isAdjusted(fB);
      const direction = delta > 0 ? 'higher' : 'lower';
      findings.push({
        id: `stat-${metric}`,
        type: 'statistical',
        severity: Math.abs(zScore) >= sensitivity + 1.0 ? 'critical' : 'warning',
        metric,
        message: `${YIELD_METRIC_LABELS[metric]} is ${orderVal.toFixed(1)}%${usesEstimate ? ' (adjusted)' : ''} vs. ${peerCenter.toFixed(1)}% ${baselineLabel} baseline (${Math.abs(delta).toFixed(1)} pts ${direction}, ${Math.abs(zScore).toFixed(1)}σ).`,
        actualPct: orderVal,
        baselinePct: peerCenter,
        deltaPct: delta,
        zScore,
        likelyFields: [fA, fB],
      });
    } else {
      normalMetrics.add(metric);
      fieldSuspicionScore[fA] -= 2.1;
      fieldSuspicionScore[fB] -= 2.1;
    }
  }

  // 3. Cross-Ratio Triangulation to rank likely culprit fields (excluding confirmed-valid fields)
  const rankedSuspects = (Object.keys(fieldSuspicionScore) as ButcherWeightField[])
    .filter(f => fieldSuspicionScore[f] > 0 && flags[f]?.status !== 'dismissed')
    .sort((a, b) => fieldSuspicionScore[b] - fieldSuspicionScore[a]);

  const suspectSet = new Set<ButcherWeightField>(rankedSuspects);
  findings.forEach(f => {
    if (f.type === 'physical') {
      if (suspectSet.size === 0) {
        f.likelyFields.forEach(lf => {
          if (flags[lf]?.status !== 'dismissed') {
            suspectSet.add(lf);
          }
        });
      }
    }
  });
  if (suspectSet.size === 0 && anomalousMetrics.size > 0) {
    findings.forEach(f => {
      if (f.type === 'statistical') {
        f.likelyFields.forEach(lf => {
          if (flags[lf]?.status !== 'dismissed') {
            suspectSet.add(lf);
          }
        });
      }
    });
  }

  const suspectFields = Array.from(suspectSet).sort(
    (a, b) => fieldSuspicionScore[b] - fieldSuspicionScore[a]
  );

  // 4. Manual flags & Dismissed states
  const flaggedFields = (Object.keys(flags) as ButcherWeightField[]).filter(
    f => flags[f]?.status === 'flagged'
  );
  const dismissedFields = (Object.keys(flags) as ButcherWeightField[]).filter(
    f => flags[f]?.status === 'dismissed'
  );

  for (const field of flaggedFields) {
    const flagInfo = flags[field]!;
    findings.push({
      id: `manual-${field}`,
      type: 'manual',
      severity: 'critical',
      message: `${BUTCHER_WEIGHT_FIELD_LABELS[field]} flagged as wrong${flagInfo.reason ? `: ${flagInfo.reason}` : '.'}`,
      likelyFields: [field],
    });
  }

  const hasPhysicalErrors = findings.some(f => f.type === 'physical');
  const hasStatisticalAnomalies = findings.some(f => f.type === 'statistical');
  const hasManualFlags = flaggedFields.length > 0;

  // Needs review if there are unreviewed physical/statistical suspects OR if adjusted numbers still violate physical bounds
  const unreviewedSuspects = suspectFields.filter(
    f => flags[f]?.status !== 'flagged' && flags[f]?.status !== 'dismissed'
  );
  const unreviewedSuspectSet = new Set(unreviewedSuspects);

  const hasUnresolvedPhysical = findings.some(f => f.type === 'physical');
  const hasUnresolvedStatistical = findings.some(f => {
    if (f.type !== 'statistical') return false;
    if (f.likelyFields.some(lf => unreviewedSuspectSet.has(lf))) return true;
    return !f.likelyFields.some(
      lf => flags[lf]?.status === 'flagged' || flags[lf]?.status === 'dismissed'
    );
  });
  const hasPhysicalWithAdjustedError = findings.some(
    f => f.type === 'physical' && f.likelyFields.some(lf => isAdjusted(lf) || hasCustomEstimate(lf))
  );

  const auditClosed = Boolean(order.auditClosed);
  const rawNeedsReview =
    (unreviewedSuspects.length > 0 && (hasUnresolvedPhysical || hasUnresolvedStatistical)) ||
    hasPhysicalWithAdjustedError;
  const needsReview = auditClosed ? false : rawNeedsReview;

  // 5. Suggested Estimates (using effective weights & confirmed-valid anchors)
  const { suggestedEstimates, estimateExplanations } = computeSuggestedWeights(
    order,
    packagedWeight,
    speciesBaseline,
    Array.from(new Set([...suspectFields, ...flaggedFields]))
  );

  return {
    orderId: order.id,
    speciesKey,
    baselineLabel,
    baselineGroupingMode: effectiveGroupingMode,
    baselineScopeUsed: comparisonScope,
    excludedFromStatisticalBaseline,
    excludedByTags,
    cohortTags,
    cleanPeerCount: maxPeerCount,
    actualWeights,
    effectiveWeights,
    adjustedFields,
    actualYields,
    effectiveYields,
    findings,
    suspectFields,
    flaggedFields,
    dismissedFields,
    hasPhysicalErrors,
    hasStatisticalAnomalies,
    hasManualFlags,
    needsReview,
    auditClosed,
    suggestedEstimates,
    estimateExplanations,
    speciesBaseline,
  };
}

/**
 * Resolves effective ButcherOrderStats under a chosen reporting mode:
 * - 'actuals': Uses exact butcher-reported weights.
 * - 'estimates': Applies user-saved estimatedWeights, or falls back to system-suggested estimates for flagged fields.
 * - 'exclude_flagged': Flags orders with flagged weights so aggregate averages/charts can exclude corrupted ratios.
 */
export function computeOrderStatsWithMode(
  order: ButcherOrder,
  matchingRecords: ButcherRecord[],
  mode: ButcherReportMode,
  analysis?: ButcherOrderAnomalyAnalysis
): ModeAdjustedOrderStats {
  const actualStats = computeOrderStats(order, matchingRecords);
  const flags = order.weightAnomalies || {};
  const flaggedFields = (Object.keys(flags) as ButcherWeightField[]).filter(
    f => flags[f]?.status === 'flagged'
  );

  if (mode === 'actuals') {
    return {
      stats: actualStats,
      actualStats,
      mode,
      usedEstimates: false,
      estimatedFields: [],
      flaggedFields,
      excludedFromAverages: false,
    };
  }

  if (mode === 'exclude_flagged') {
    return {
      stats: actualStats,
      actualStats,
      mode,
      usedEstimates: false,
      estimatedFields: [],
      flaggedFields,
      excludedFromAverages: flaggedFields.length > 0,
    };
  }

  // mode === 'estimates'
  const saved = order.estimatedWeights || {};
  const suggested = analysis?.suggestedEstimates || {};
  const estimatedFields: ButcherWeightField[] = [];

  const resolveWeight = (field: ButcherWeightField, actualVal: number): number => {
    const savedVal = saved[field];
    if (typeof savedVal === 'number' && Number.isFinite(savedVal) && savedVal > 0) {
      if (Math.abs(savedVal - actualVal) > 0.01) {
        estimatedFields.push(field);
      }
      return savedVal;
    }
    if (flags[field]?.status === 'flagged') {
      const sugVal = suggested[field];
      if (typeof sugVal === 'number' && Number.isFinite(sugVal) && sugVal > 0) {
        estimatedFields.push(field);
        return sugVal;
      }
    }
    return actualVal;
  };

  const live = resolveWeight('liveWeight', actualStats.liveWeight);
  const hot = resolveWeight('hotWeight', actualStats.hotWeight);
  const cold = resolveWeight('coldWeight', actualStats.coldWeight);
  const packaged = resolveWeight('packagedWeight', actualStats.packagedWeight);
  const animalCount = Math.max(1, order.animalCount || 1);

  const stats: ButcherOrderStats = {
    count: actualStats.count,
    totalPieces: actualStats.totalPieces,
    packagedWeight: packaged,
    avgPackageWeight: actualStats.count > 0 ? packaged / actualStats.count : 0,
    avgPiecesPerPackage: actualStats.avgPiecesPerPackage,
    liveWeight: live,
    hotWeight: hot,
    coldWeight: cold,
    liveWeightPerAnimal: live / animalCount,
    hotWeightPerAnimal: hot / animalCount,
    coldWeightPerAnimal: cold / animalCount,
    packagedWeightPerAnimal: packaged / animalCount,
    hotWeightYield: live > 0 ? (hot / live) * 100 : 0,
    coolerShrinkage: hot > 0 ? ((hot - cold) / hot) * 100 : 0,
    cuttingYield: cold > 0 ? (packaged / cold) * 100 : 0,
    finishToLiveYield: live > 0 ? (packaged / live) * 100 : 0,
    finishToHotYield: hot > 0 ? (packaged / hot) * 100 : 0,
    finishToColdYield: cold > 0 ? (packaged / cold) * 100 : 0,
    totalLoss: Math.max(0, live - packaged),
    dressingLoss: Math.max(0, live - hot),
    coolerLoss: Math.max(0, hot - cold),
    cuttingLoss: Math.max(0, cold - packaged),
  };

  return {
    stats,
    actualStats,
    mode,
    usedEstimates: estimatedFields.length > 0,
    estimatedFields,
    flaggedFields,
    excludedFromAverages: false,
  };
}

// ============================================================================
// UNIFIED ORDER REVIEW & FINALIZATION QUEUE
// ============================================================================

export type OrderReviewIssueCategory =
  | 'anomaly'
  | 'missing_weights'
  | 'missing_fee'
  | 'missing_cuts'
  | 'missing_metadata';

export interface OrderReviewIssue {
  id: string;
  category: OrderReviewIssueCategory;
  fieldKey: string; // Used for reviewIgnoredFields N/A marking
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface OrderReviewItem {
  order: ButcherOrder;
  analysis: ButcherOrderAnomalyAnalysis;
  issues: OrderReviewIssue[];
  categories: Set<OrderReviewIssueCategory>;
  hasPendingEstimates: boolean;
}

export interface OrderReviewQueueSummary {
  items: OrderReviewItem[];
  closedItems: OrderReviewItem[];
  allOrderAnalyses: Map<string, ButcherOrderAnomalyAnalysis>;
  counts: {
    totalOrdersNeedingReview: number;
    anomaly: number;
    missing_weights: number;
    missing_fee: number;
    missing_cuts: number;
    missing_metadata: number;
    closed: number;
  };
}

export function analyzeOrderReviewQueue(
  orders: ButcherOrder[],
  recordsByOrderId: Map<string, ButcherRecord[]>,
  sensitivity: number = DEFAULT_ANOMALY_SENSITIVITY,
  butcherTags: ButcherOrderTag[] = [],
  groupingMode: ButcherBaselineGroupingMode = 'species',
  locationNameById?: Map<string, string>
): OrderReviewQueueSummary {
  const baselines = computeSpeciesBaselines(
    orders,
    recordsByOrderId,
    butcherTags,
    groupingMode,
    locationNameById
  );
  const allOrderAnalyses = new Map<string, ButcherOrderAnomalyAnalysis>();
  const items: OrderReviewItem[] = [];
  const closedItems: OrderReviewItem[] = [];

  const counts = {
    totalOrdersNeedingReview: 0,
    anomaly: 0,
    missing_weights: 0,
    missing_fee: 0,
    missing_cuts: 0,
    missing_metadata: 0,
    closed: 0,
  };

  for (const order of orders) {
    const matching = recordsByOrderId.get(order.id) || [];
    const analysis = analyzeOrderAnomalies(
      order,
      matching,
      orders,
      recordsByOrderId,
      sensitivity,
      baselines,
      butcherTags,
      { mode: 'auto' },
      groupingMode,
      locationNameById
    );
    allOrderAnalyses.set(order.id, analysis);

    const ignored = new Set(order.reviewIgnoredFields || []);
    const issues: OrderReviewIssue[] = [];

    // 1. Weight Anomalies & Pending Estimates
    if (analysis.needsReview) {
      issues.push({
        id: 'issue-anomaly-review',
        category: 'anomaly',
        fieldKey: 'anomalyReview',
        title: analysis.hasPhysicalErrors ? 'Physical Weight Conflict' : 'Yield Anomaly Detected',
        description: analysis.findings
          .filter(f => f.type === 'physical' || f.type === 'statistical')
          .map(f => f.message)
          .slice(0, 2)
          .join(' '),
        severity: analysis.hasPhysicalErrors ? 'critical' : 'warning',
      });
    }

    const flaggedMissingEstimate = analysis.flaggedFields.filter(f => {
      const est = order.estimatedWeights?.[f];
      return est === undefined || est === null || est <= 0;
    });
    if (flaggedMissingEstimate.length > 0 && !order.auditClosed) {
      issues.push({
        id: 'issue-flagged-needs-estimate',
        category: 'anomaly',
        fieldKey: 'flaggedEstimate',
        title: 'Flagged Weight Needs Estimate',
        description: `${flaggedMissingEstimate.map(f => BUTCHER_WEIGHT_FIELD_LABELS[f]).join(', ')} flagged as wrong without a saved corrected estimate.`,
        severity: 'warning',
      });
    }

    // 2. Missing Weights
    if (!ignored.has('missingWeights')) {
      const missingWeights: string[] = [];
      if (!order.liveWeight || order.liveWeight <= 0) {
        if (!ignored.has('liveWeight')) missingWeights.push('Live Wt');
      }
      if (!order.hotWeight || order.hotWeight <= 0) {
        if (!ignored.has('hotWeight')) missingWeights.push('Hot Wt');
      }
      if (!order.coldWeight || order.coldWeight <= 0) {
        if (!ignored.has('coldWeight')) missingWeights.push('Cold Wt');
      }
      if (missingWeights.length > 0) {
        issues.push({
          id: 'issue-missing-weights',
          category: 'missing_weights',
          fieldKey: 'missingWeights',
          title: `Missing ${missingWeights.join(', ')}`,
          description: `Carcass weight record is incomplete (${missingWeights.join(', ')} missing or 0).`,
          severity: 'warning',
        });
      }
    }

    // 3. Missing Butcher Fee
    if ((!order.butcherFee || order.butcherFee <= 0) && !ignored.has('butcherFee')) {
      issues.push({
        id: 'issue-missing-fee',
        category: 'missing_fee',
        fieldKey: 'butcherFee',
        title: 'Missing Butcher Fee',
        description: 'No processing cost recorded for $/lb cost analysis.',
        severity: 'info',
      });
    }

    // 4. Pending / Missing Cuts
    if (matching.length === 0 && !ignored.has('cuts')) {
      issues.push({
        id: 'issue-missing-cuts',
        category: 'missing_cuts',
        fieldKey: 'cuts',
        title: 'No Cuts Recorded',
        description: 'Drop-off or partial order has no cutsheet CSV or manual cuts yet.',
        severity: 'warning',
      });
    }

    // 5. Missing Order Metadata (Temp order #, kill date, animal count)
    if (!ignored.has('missingMetadata')) {
      const missingMeta: string[] = [];
      if ((order.orderNumber || '').toUpperCase().startsWith('TEMP-') && !ignored.has('orderNumber')) {
        missingMeta.push('Temporary Order #');
      }
      if (!order.killDate && !ignored.has('killDate')) {
        missingMeta.push('Kill Date');
      }
      if ((!order.animalCount || order.animalCount <= 0) && !ignored.has('animalCount')) {
        missingMeta.push('Animal Count');
      }
      if (missingMeta.length > 0) {
        issues.push({
          id: 'issue-missing-metadata',
          category: 'missing_metadata',
          fieldKey: 'missingMetadata',
          title: `Incomplete Details (${missingMeta.join(', ')})`,
          description: `Order is missing ${missingMeta.join(', ').toLowerCase()}.`,
          severity: 'info',
        });
      }
    }

    if (order.auditClosed) {
      counts.closed++;
      closedItems.push({
        order,
        analysis,
        issues,
        categories: new Set(issues.map(i => i.category)),
        hasPendingEstimates: flaggedMissingEstimate.length > 0,
      });
      continue;
    }

    if (issues.length > 0) {
      const categories = new Set(issues.map(i => i.category));
      counts.totalOrdersNeedingReview++;
      categories.forEach(cat => {
        counts[cat]++;
      });

      items.push({
        order,
        analysis,
        issues,
        categories,
        hasPendingEstimates: flaggedMissingEstimate.length > 0,
      });
    }
  }

  return {
    items,
    closedItems,
    allOrderAnalyses,
    counts,
  };
}

// ============================================================================
// DYNAMIC CHART SCALING & SEGMENTED SVG PATH HELPERS
// ============================================================================

export interface ChartYAxisScale {
  min: number;
  max: number;
  step: number;
  ticks: number[];
  mapY: (value: number, plotTop: number, plotHeight: number) => number;
}

export interface ChartYAxisScaleOptions {
  /** Lower floor included in the domain (default 0). */
  baselineMin?: number;
  /** Minimum upper ceiling included in the domain (default 10). */
  baselineMax?: number;
  /** Extra padding ratio added when data exceeds baseline bounds (default 0.1). */
  headroomRatio?: number;
  /** Approximate number of tick intervals (default 4). */
  targetIntervals?: number;
  /** Whether negative data values can push the min below baselineMin (default false). */
  allowNegative?: boolean;
}

function pickNiceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = Math.pow(10, exponent);
  const fraction = rawStep / magnitude;
  let niceFraction: number;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * magnitude;
}

function normalizeTickNumber(val: number): number {
  const rounded = Math.round(val * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Computes a clean, auto-fitting Y-axis domain and human-readable ticks so all plotted values
 * — including extreme actual-weight outliers or negative shrink values — always fit inside the plot box.
 */
export function computeChartYAxisScale(
  values: Array<number | null | undefined>,
  options: ChartYAxisScaleOptions = {},
): ChartYAxisScale {
  const {
    baselineMin = 0,
    baselineMax = 10,
    headroomRatio = 0.1,
    targetIntervals = 4,
    allowNegative = false,
  } = options;

  const finiteValues = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );

  let dataMin = baselineMin;
  let dataMax = baselineMax;

  for (const v of finiteValues) {
    if (allowNegative && v < dataMin) dataMin = v;
    if (v > dataMax) dataMax = v;
  }

  const rawSpan = Math.max(dataMax - dataMin, 1e-6);

  // Only add headroom beyond the baseline when actual data pushes past it (or when baselineMax is small)
  const paddedMax =
    dataMax > baselineMax ? dataMax + rawSpan * headroomRatio : baselineMax;
  const paddedMin =
    allowNegative && dataMin < baselineMin
      ? dataMin - rawSpan * headroomRatio
      : baselineMin;

  const paddedSpan = Math.max(paddedMax - paddedMin, 1e-6);
  const intervals = Math.max(2, targetIntervals);
  const step = pickNiceStep(paddedSpan / intervals);

  const min = normalizeTickNumber(Math.floor(paddedMin / step) * step);
  let max = normalizeTickNumber(Math.ceil(paddedMax / step) * step);
  if (max <= min) {
    max = normalizeTickNumber(min + step * intervals);
  }

  const ticks: number[] = [];
  const totalSteps = Math.max(1, Math.round((max - min) / step));
  // Guard against excessive ticks if floating point rounding causes drift
  const safeStep = totalSteps > 8 ? pickNiceStep((max - min) / intervals) : step;
  const finalMin = normalizeTickNumber(Math.floor(min / safeStep) * safeStep);
  const finalMax = normalizeTickNumber(Math.ceil(max / safeStep) * safeStep);
  const count = Math.min(10, Math.max(1, Math.round((finalMax - finalMin) / safeStep)));

  for (let i = 0; i <= count; i++) {
    ticks.push(normalizeTickNumber(finalMin + i * safeStep));
  }

  const actualMin = ticks[0];
  const actualMax = ticks[ticks.length - 1];
  const domainSpan = Math.max(actualMax - actualMin, 1e-6);

  const mapY = (value: number, plotTop: number, plotHeight: number): number => {
    if (!Number.isFinite(value)) return plotTop + plotHeight;
    const ratio = (value - actualMin) / domainSpan;
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    return plotTop + (1 - clampedRatio) * plotHeight;
  };

  return {
    min: actualMin,
    max: actualMax,
    step: safeStep,
    ticks,
    mapY,
  };
}

/**
 * Formats chart Y-axis labels compactly so large outliers (e.g. 15,000 lbs) never clip off the left margin.
 */
export function formatCompactAxisNumber(value: number, suffix: string = ''): string {
  if (!Number.isFinite(value)) return `0${suffix}`;
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const num = (value / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace(/\.0$/, '');
    return `${num}M${suffix}`;
  }
  if (abs >= 10_000) {
    const num = (value / 1_000).toFixed(abs >= 100_000 ? 0 : 1).replace(/\.0$/, '');
    return `${num}k${suffix}`;
  }
  const rounded = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
  return `${rounded}${suffix}`;
}

/**
 * Builds an SVG line path string that skips null/non-finite gaps cleanly instead of dropping to zero.
 */
export function buildSegmentedSvgPath(points: Array<{ x: number; y: number | null }>): string {
  let d = '';
  let inSegment = false;
  for (const pt of points) {
    if (pt.y === null || !Number.isFinite(pt.y) || !Number.isFinite(pt.x)) {
      inSegment = false;
      continue;
    }
    d += `${inSegment ? ' L ' : d ? ' M ' : 'M '}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    inSegment = true;
  }
  return d;
}

/**
 * Builds a closed SVG area path for each contiguous non-null segment down to baselineY.
 */
export function buildSegmentedAreaPath(
  points: Array<{ x: number; y: number | null }>,
  baselineY: number,
): string {
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let current: Array<{ x: number; y: number }> = [];

  for (const pt of points) {
    if (pt.y === null || !Number.isFinite(pt.y) || !Number.isFinite(pt.x)) {
      if (current.length > 0) {
        segments.push(current);
        current = [];
      }
    } else {
      current.push({ x: pt.x, y: pt.y });
    }
  }
  if (current.length > 0) segments.push(current);

  return segments
    .filter(seg => seg.length >= 2)
    .map(seg => {
      const line = seg
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');
      const last = seg[seg.length - 1];
      const first = seg[0];
      return `${line} L ${last.x.toFixed(1)} ${baselineY.toFixed(1)} L ${first.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
    })
    .join(' ');
}

