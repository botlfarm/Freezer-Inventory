import { ButcherOrder, ButcherRecord } from '../types';

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
