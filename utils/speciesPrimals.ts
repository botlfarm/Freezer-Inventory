import {
  AppConfigItem,
  ButcherOrder,
  ButcherRecord,
  Product,
  SpeciesPrimal,
} from '../types';
import { ButcherOrderStats } from './butcherStats';
import { parseButcherSpeciesList } from './butcherSettings';

export const UNASSIGNED_PRIMAL_ID = '__unassigned__';

export interface ResolvedProductPrimal {
  primal: SpeciesPrimal;
  species: SpeciesPrimal | null;
  primalId: string;
  primalName: string;
  speciesId: string | null;
  speciesName: string;
  fullLabel: string; // e.g., "Beef · Rib"
}

export interface SpeciesPrimalIndex {
  all: SpeciesPrimal[];
  species: SpeciesPrimal[];
  speciesList: SpeciesPrimal[];
  primals: SpeciesPrimal[];
  primalList: SpeciesPrimal[];
  byId: Map<string, SpeciesPrimal>;
  speciesById: Map<string, SpeciesPrimal>;
  speciesByNameLower: Map<string, SpeciesPrimal>;
  primalById: Map<string, SpeciesPrimal>;
  primalsBySpeciesId: Map<string, SpeciesPrimal[]>;
}

export function sortSpeciesPrimals(items: SpeciesPrimal[]): SpeciesPrimal[] {
  return [...items].sort((a, b) => {
    const orderA = typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });
}

export function buildSpeciesPrimalIndex(
  speciesPrimals: SpeciesPrimal[] | undefined | null,
): SpeciesPrimalIndex {
  const list = Array.isArray(speciesPrimals) ? speciesPrimals : [];
  const byId = new Map<string, SpeciesPrimal>();
  const speciesById = new Map<string, SpeciesPrimal>();
  const speciesByNameLower = new Map<string, SpeciesPrimal>();
  const primalById = new Map<string, SpeciesPrimal>();
  const primalsBySpeciesId = new Map<string, SpeciesPrimal[]>();

  const rawSpecies: SpeciesPrimal[] = [];
  const rawPrimals: SpeciesPrimal[] = [];

  for (const item of list) {
    if (!item || !item.id || !item.name) continue;
    byId.set(item.id, item);
    if (item.type === 'species') {
      rawSpecies.push(item);
      speciesById.set(item.id, item);
      speciesByNameLower.set(item.name.trim().toLowerCase(), item);
      if (!primalsBySpeciesId.has(item.id)) {
        primalsBySpeciesId.set(item.id, []);
      }
    } else if (item.type === 'primal') {
      rawPrimals.push(item);
      primalById.set(item.id, item);
    }
  }

  for (const primal of rawPrimals) {
    if (primal.parentSpeciesId) {
      const bucket = primalsBySpeciesId.get(primal.parentSpeciesId) || [];
      bucket.push(primal);
      primalsBySpeciesId.set(primal.parentSpeciesId, bucket);
    }
  }

  const sortedSpecies = sortSpeciesPrimals(rawSpecies);
  for (const [spId, bucket] of primalsBySpeciesId.entries()) {
    primalsBySpeciesId.set(spId, sortSpeciesPrimals(bucket));
  }

  // Build primals sorted by parent species order, then primal sortOrder
  const speciesOrderIndex = new Map<string, number>();
  sortedSpecies.forEach((sp, idx) => speciesOrderIndex.set(sp.id, idx));

  const sortedPrimals = [...rawPrimals].sort((a, b) => {
    const spIdxA = a.parentSpeciesId ? (speciesOrderIndex.get(a.parentSpeciesId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    const spIdxB = b.parentSpeciesId ? (speciesOrderIndex.get(b.parentSpeciesId) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
    if (spIdxA !== spIdxB) return spIdxA - spIdxB;
    const orderA = typeof a.sortOrder === 'number' && Number.isFinite(a.sortOrder) ? a.sortOrder : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.sortOrder === 'number' && Number.isFinite(b.sortOrder) ? b.sortOrder : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
  });

  return {
    all: list,
    species: sortedSpecies,
    speciesList: sortedSpecies,
    primals: sortedPrimals,
    primalList: sortedPrimals,
    byId,
    speciesById,
    speciesByNameLower,
    primalById,
    primalsBySpeciesId,
  };
}

export function resolvePrimalById(
  primalId: string | undefined | null,
  index: SpeciesPrimalIndex,
): ResolvedProductPrimal | null {
  if (!primalId) return null;
  const primal = index.primalById.get(primalId);
  if (!primal) return null;
  const species = primal.parentSpeciesId ? index.speciesById.get(primal.parentSpeciesId) || null : null;
  const speciesName = species?.name || '';
  const fullLabel = speciesName ? `${speciesName} · ${primal.name}` : primal.name;
  return {
    primal,
    species,
    primalId: primal.id,
    primalName: primal.name,
    speciesId: species?.id || primal.parentSpeciesId || null,
    speciesName,
    fullLabel,
  };
}

export function resolveProductPrimal(
  product: Pick<Product, 'primalId'> | undefined | null,
  index: SpeciesPrimalIndex,
): ResolvedProductPrimal | null {
  if (!product?.primalId) return null;
  return resolvePrimalById(product.primalId, index);
}

export function getAllManagedSpeciesNames(
  speciesPrimals: SpeciesPrimal[] | undefined,
  appConfig?: AppConfigItem[],
  orders: ButcherOrder[] = [],
): string[] {
  const byKey = new Map<string, string>();
  const index = buildSpeciesPrimalIndex(speciesPrimals);
  for (const sp of index.species) {
    const trimmed = sp.name.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, trimmed);
  }
  const legacyList = parseButcherSpeciesList(appConfig);
  for (const sp of legacyList) {
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

export function makeSpeciesIdFromName(name: string, existingIds: Set<string>): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'species';
  let candidate = `sp_${slug}`;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `sp_${slug}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export function generateSpeciesPrimalId(type: 'species' | 'primal'): string {
  const prefix = type === 'species' ? 'sp' : 'pr';
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// AUTOMATIC LEGACY MIGRATION (EMPTY PRIMAL LISTS, IDEMPOTENT)
// ============================================================================

export function migrateLegacySpeciesIntoTable(
  existingSpeciesPrimals: SpeciesPrimal[] | undefined,
  appConfig: AppConfigItem[] | undefined,
  butcherOrders: ButcherOrder[] | undefined,
): {
  speciesPrimals: SpeciesPrimal[];
  butcherOrders: ButcherOrder[];
  changedSpeciesPrimals: boolean;
  changedButcherOrders: boolean;
} {
  const currentList: SpeciesPrimal[] = Array.isArray(existingSpeciesPrimals)
    ? existingSpeciesPrimals.map((item) => ({ ...item }))
    : [];
  const orders: ButcherOrder[] = Array.isArray(butcherOrders)
    ? butcherOrders.map((o) => ({ ...o }))
    : [];

  const existingIds = new Set<string>(currentList.map((i) => i.id));
  const speciesByLower = new Map<string, SpeciesPrimal>();
  const speciesById = new Map<string, SpeciesPrimal>();

  let maxSpeciesOrder = -1;
  for (const item of currentList) {
    if (item.type === 'species') {
      speciesByLower.set(item.name.trim().toLowerCase(), item);
      speciesById.set(item.id, item);
      if (typeof item.sortOrder === 'number' && item.sortOrder > maxSpeciesOrder) {
        maxSpeciesOrder = item.sortOrder;
      }
    }
  }

  let changedSpeciesPrimals = false;
  let changedButcherOrders = false;

  const ensureSpecies = (rawName: string): SpeciesPrimal | null => {
    const trimmed = (rawName || '').trim();
    if (!trimmed) return null;
    const key = trimmed.toLowerCase();
    const existing = speciesByLower.get(key);
    if (existing) return existing;

    maxSpeciesOrder += 1;
    const id = makeSpeciesIdFromName(trimmed, existingIds);
    existingIds.add(id);
    const created: SpeciesPrimal = {
      id,
      name: trimmed,
      type: 'species',
      sortOrder: maxSpeciesOrder,
    };
    currentList.push(created);
    speciesByLower.set(key, created);
    speciesById.set(id, created);
    changedSpeciesPrimals = true;
    return created;
  };

  // 1. Migrate species from legacy app_config.butcher_species_list
  const legacySpecies = parseButcherSpeciesList(appConfig);
  for (const spName of legacySpecies) {
    ensureSpecies(spName);
  }

  // 2. Migrate species referenced on butcher orders and link speciesId
  for (let i = 0; i < orders.length; i++) {
    const order = orders[i];
    if (order.speciesId && speciesById.has(order.speciesId)) {
      const linked = speciesById.get(order.speciesId)!;
      if (order.species !== linked.name) {
        orders[i] = { ...order, species: linked.name };
        changedButcherOrders = true;
      }
      continue;
    }

    const spName = (order.species || '').trim();
    if (!spName) continue;
    const ensured = ensureSpecies(spName);
    if (ensured && (order.speciesId !== ensured.id || order.species !== ensured.name)) {
      orders[i] = {
        ...order,
        speciesId: ensured.id,
        species: ensured.name,
      };
      changedButcherOrders = true;
    }
  }

  return {
    speciesPrimals: currentList,
    butcherOrders: orders,
    changedSpeciesPrimals,
    changedButcherOrders,
  };
}

// ============================================================================
// ATOMIC MUTATION HELPERS (SHARED BY SERVER REDUCER & UNIT TESTS)
// ============================================================================

export function applyAddSpeciesPrimal(
  list: SpeciesPrimal[],
  entry: SpeciesPrimal,
): { nextList: SpeciesPrimal[]; added: SpeciesPrimal | null; error?: string } {
  const name = (entry.name || '').trim();
  if (!name) {
    return { nextList: list, added: null, error: 'Name is required.' };
  }
  const type = entry.type === 'primal' ? 'primal' : 'species';
  const parentSpeciesId = type === 'primal' ? (entry.parentSpeciesId || '').trim() : undefined;

  if (type === 'primal') {
    if (!parentSpeciesId) {
      return { nextList: list, added: null, error: 'Parent species is required for a primal cut.' };
    }
    const parentExists = list.some((i) => i.type === 'species' && i.id === parentSpeciesId);
    if (!parentExists) {
      return { nextList: list, added: null, error: 'Selected parent species does not exist.' };
    }
    const duplicate = list.some(
      (i) =>
        i.type === 'primal' &&
        i.parentSpeciesId === parentSpeciesId &&
        i.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      return { nextList: list, added: null, error: `Primal "${name}" already exists for this species.` };
    }
  } else {
    const duplicate = list.some(
      (i) => i.type === 'species' && i.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      return { nextList: list, added: null, error: `Species "${name}" already exists.` };
    }
  }

  const siblings = list.filter((i) =>
    type === 'species'
      ? i.type === 'species'
      : i.type === 'primal' && i.parentSpeciesId === parentSpeciesId,
  );
  const maxOrder = siblings.reduce(
    (max, item) => (typeof item.sortOrder === 'number' && item.sortOrder > max ? item.sortOrder : max),
    -1,
  );

  const created: SpeciesPrimal = {
    id: (entry.id || '').trim() || generateSpeciesPrimalId(type),
    name,
    type,
    parentSpeciesId,
    icon: entry.icon?.trim() || undefined,
    description: entry.description?.trim() || undefined,
    sortOrder: typeof entry.sortOrder === 'number' && Number.isFinite(entry.sortOrder) ? entry.sortOrder : maxOrder + 1,
  };

  return {
    nextList: [...list, created],
    added: created,
  };
}

export function applyEditSpeciesPrimal(
  list: SpeciesPrimal[],
  butcherOrders: ButcherOrder[],
  id: string,
  updates: Partial<Omit<SpeciesPrimal, 'id' | 'type'>>,
): {
  nextList: SpeciesPrimal[];
  nextOrders: ButcherOrder[];
  updated: SpeciesPrimal | null;
  affectedOrderCount: number;
  error?: string;
} {
  const existing = list.find((i) => i.id === id);
  if (!existing) {
    return { nextList: list, nextOrders: butcherOrders, updated: null, affectedOrderCount: 0, error: 'Entry not found.' };
  }

  const nextName = updates.name !== undefined ? updates.name.trim() : existing.name;
  if (!nextName) {
    return { nextList: list, nextOrders: butcherOrders, updated: null, affectedOrderCount: 0, error: 'Name cannot be empty.' };
  }

  const nextParentId =
    existing.type === 'primal'
      ? updates.parentSpeciesId !== undefined
        ? updates.parentSpeciesId.trim()
        : existing.parentSpeciesId
      : undefined;

  if (existing.type === 'primal') {
    if (!nextParentId || !list.some((i) => i.type === 'species' && i.id === nextParentId)) {
      return { nextList: list, nextOrders: butcherOrders, updated: null, affectedOrderCount: 0, error: 'Parent species does not exist.' };
    }
    const duplicate = list.some(
      (i) =>
        i.id !== id &&
        i.type === 'primal' &&
        i.parentSpeciesId === nextParentId &&
        i.name.trim().toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      return { nextList: list, nextOrders: butcherOrders, updated: null, affectedOrderCount: 0, error: `Primal "${nextName}" already exists for this species.` };
    }
  } else {
    const duplicate = list.some(
      (i) => i.id !== id && i.type === 'species' && i.name.trim().toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      return { nextList: list, nextOrders: butcherOrders, updated: null, affectedOrderCount: 0, error: `Species "${nextName}" already exists. Use Rename / Merge to combine species.` };
    }
  }

  const updated: SpeciesPrimal = {
    ...existing,
    name: nextName,
    parentSpeciesId: nextParentId,
    icon: updates.icon !== undefined ? (updates.icon.trim() || undefined) : existing.icon,
    description: updates.description !== undefined ? (updates.description.trim() || undefined) : existing.description,
    sortOrder: updates.sortOrder !== undefined ? updates.sortOrder : existing.sortOrder,
  };

  const nextList = list.map((i) => (i.id === id ? updated : i));

  let affectedOrderCount = 0;
  let nextOrders = butcherOrders;
  if (existing.type === 'species' && existing.name !== nextName) {
    const oldLower = existing.name.trim().toLowerCase();
    nextOrders = butcherOrders.map((order) => {
      if (order.speciesId === existing.id || (order.species || '').trim().toLowerCase() === oldLower) {
        affectedOrderCount += 1;
        return { ...order, speciesId: existing.id, species: nextName };
      }
      return order;
    });
  }

  return { nextList, nextOrders, updated, affectedOrderCount };
}

export function applyDeleteSpeciesPrimal(
  list: SpeciesPrimal[],
  products: Product[],
  butcherOrders: ButcherOrder[],
  id: string,
  reassignToPrimalId?: string | null,
): {
  nextList: SpeciesPrimal[];
  nextProducts: Product[];
  deleted: SpeciesPrimal | null;
  affectedProductCount: number;
  deletedChildPrimalCount: number;
  error?: string;
} {
  const target = list.find((i) => i.id === id);
  if (!target) {
    return {
      nextList: list,
      nextProducts: products,
      deleted: null,
      affectedProductCount: 0,
      deletedChildPrimalCount: 0,
      error: 'Entry not found.',
    };
  }

  if (target.type === 'species') {
    const oldLower = target.name.trim().toLowerCase();
    const orderUsage = butcherOrders.filter(
      (o) => o.speciesId === target.id || (o.species || '').trim().toLowerCase() === oldLower,
    ).length;
    if (orderUsage > 0) {
      return {
        nextList: list,
        nextProducts: products,
        deleted: null,
        affectedProductCount: 0,
        deletedChildPrimalCount: 0,
        error: `"${target.name}" is used by ${orderUsage} butcher order${orderUsage === 1 ? '' : 's'}. Rename or merge it into another species instead.`,
      };
    }

    const childPrimalIds = new Set(
      list.filter((i) => i.type === 'primal' && i.parentSpeciesId === target.id).map((i) => i.id),
    );
    const nextList = list.filter((i) => i.id !== target.id && !childPrimalIds.has(i.id));

    let affectedProductCount = 0;
    const nextProducts = products.map((p) => {
      if (p.primalId && childPrimalIds.has(p.primalId)) {
        affectedProductCount += 1;
        const { primalId: _removed, ...rest } = p;
        return rest as Product;
      }
      return p;
    });

    return {
      nextList,
      nextProducts,
      deleted: target,
      affectedProductCount,
      deletedChildPrimalCount: childPrimalIds.size,
    };
  }

  // Deleting a primal cut
  const validReassignId =
    reassignToPrimalId &&
    reassignToPrimalId !== target.id &&
    list.some((i) => i.type === 'primal' && i.id === reassignToPrimalId)
      ? reassignToPrimalId
      : undefined;

  const nextList = list.filter((i) => i.id !== target.id);
  let affectedProductCount = 0;
  const nextProducts = products.map((p) => {
    if (p.primalId === target.id) {
      affectedProductCount += 1;
      if (validReassignId) {
        return { ...p, primalId: validReassignId };
      }
      const { primalId: _removed, ...rest } = p;
      return rest as Product;
    }
    return p;
  });

  return {
    nextList,
    nextProducts,
    deleted: target,
    affectedProductCount,
    deletedChildPrimalCount: 0,
  };
}

export function applyRenameOrMergeSpecies(
  list: SpeciesPrimal[],
  products: Product[],
  butcherOrders: ButcherOrder[],
  oldNameRaw: string,
  newNameRaw: string,
): {
  nextList: SpeciesPrimal[];
  nextProducts: Product[];
  nextOrders: ButcherOrder[];
  affectedOrderCount: number;
  affectedProductCount: number;
  mergedIntoExisting: boolean;
  targetSpeciesId: string | null;
} {
  const oldName = oldNameRaw.trim();
  const newName = newNameRaw.trim();
  const oldKey = oldName.toLowerCase();
  const newKey = newName.toLowerCase();

  if (!oldName || !newName) {
    return {
      nextList: list,
      nextProducts: products,
      nextOrders: butcherOrders,
      affectedOrderCount: 0,
      affectedProductCount: 0,
      mergedIntoExisting: false,
      targetSpeciesId: null,
    };
  }

  let workingList = list.map((i) => ({ ...i }));
  let workingProducts = products.map((p) => ({ ...p }));

  let sourceSpecies = workingList.find(
    (i) => i.type === 'species' && i.name.trim().toLowerCase() === oldKey,
  );
  const existingTarget = workingList.find(
    (i) => i.type === 'species' && i.name.trim().toLowerCase() === newKey && i.id !== sourceSpecies?.id,
  );

  const mergedIntoExisting = Boolean(existingTarget && oldKey !== newKey);
  let targetSpeciesId: string;
  let affectedProductCount = 0;

  if (existingTarget) {
    // Merge sourceSpecies into existingTarget (preserving newName casing on target)
    targetSpeciesId = existingTarget.id;
    workingList = workingList.map((i) =>
      i.id === existingTarget.id ? { ...i, name: newName } : i,
    );

    if (sourceSpecies) {
      const targetPrimalsByLower = new Map<string, SpeciesPrimal>();
      workingList
        .filter((i) => i.type === 'primal' && i.parentSpeciesId === existingTarget.id)
        .forEach((p) => targetPrimalsByLower.set(p.name.trim().toLowerCase(), p));

      const remappedPrimalIds = new Map<string, string>();
      const primalsToRemove = new Set<string>();

      for (const item of workingList) {
        if (item.type === 'primal' && item.parentSpeciesId === sourceSpecies.id) {
          const matchingTargetPrimal = targetPrimalsByLower.get(item.name.trim().toLowerCase());
          if (matchingTargetPrimal) {
            remappedPrimalIds.set(item.id, matchingTargetPrimal.id);
            primalsToRemove.add(item.id);
          } else {
            item.parentSpeciesId = existingTarget.id;
            targetPrimalsByLower.set(item.name.trim().toLowerCase(), item);
          }
        }
      }

      workingList = workingList.filter(
        (i) => i.id !== sourceSpecies!.id && !primalsToRemove.has(i.id),
      );

      if (remappedPrimalIds.size > 0) {
        workingProducts = workingProducts.map((p) => {
          if (p.primalId && remappedPrimalIds.has(p.primalId)) {
            affectedProductCount += 1;
            return { ...p, primalId: remappedPrimalIds.get(p.primalId) };
          }
          return p;
        });
      }
    }
  } else if (sourceSpecies) {
    // Straight rename of existing species row
    targetSpeciesId = sourceSpecies.id;
    workingList = workingList.map((i) =>
      i.id === sourceSpecies!.id ? { ...i, name: newName } : i,
    );
  } else {
    // Neither existed in table yet — create target species row
    const existingIds = new Set(workingList.map((i) => i.id));
    targetSpeciesId = makeSpeciesIdFromName(newName, existingIds);
    const maxOrder = workingList
      .filter((i) => i.type === 'species')
      .reduce((m, i) => (typeof i.sortOrder === 'number' && i.sortOrder > m ? i.sortOrder : m), -1);
    workingList.push({
      id: targetSpeciesId,
      name: newName,
      type: 'species',
      sortOrder: maxOrder + 1,
    });
  }

  let affectedOrderCount = 0;
  const nextOrders = butcherOrders.map((order) => {
    const spLower = (order.species || '').trim().toLowerCase();
    const matchesSource =
      (sourceSpecies && order.speciesId === sourceSpecies.id) || spLower === oldKey;
    const matchesTargetCasingFix =
      (order.speciesId === targetSpeciesId || spLower === newKey) &&
      (order.species !== newName || order.speciesId !== targetSpeciesId);

    if (matchesSource || matchesTargetCasingFix) {
      if (order.species !== newName || order.speciesId !== targetSpeciesId) {
        affectedOrderCount += 1;
      }
      return {
        ...order,
        species: newName,
        speciesId: targetSpeciesId,
      };
    }
    return order;
  });

  return {
    nextList: workingList,
    nextProducts: workingProducts,
    nextOrders,
    affectedOrderCount,
    affectedProductCount,
    mergedIntoExisting,
    targetSpeciesId,
  };
}

export function applyReorderSpeciesPrimals(
  list: SpeciesPrimal[],
  orderedIds: string[],
  parentSpeciesId?: string,
): SpeciesPrimal[] {
  const rank = new Map<string, number>();
  orderedIds.forEach((id, idx) => rank.set(id, idx));

  return list.map((item) => {
    const matchesScope = parentSpeciesId
      ? item.type === 'primal' && item.parentSpeciesId === parentSpeciesId
      : item.type === 'species';
    if (matchesScope && rank.has(item.id)) {
      return { ...item, sortOrder: rank.get(item.id)! };
    }
    return item;
  });
}

// ============================================================================
// BUTCHER PRIMAL CUTS ANALYTICS ENGINE
// ============================================================================

export interface ButcherPrimalCutChildRow {
  name: string;
  productId?: string;
  packageCount: number;
  totalPieces: number;
  totalWeight: number;
  pctOfPrimal: number;
  pctOfPackaged: number;
  estValue: number;
}

export interface ButcherPrimalReportRow {
  primalId: string; // UNASSIGNED_PRIMAL_ID for unassigned cuts
  primalName: string;
  speciesId: string | null;
  speciesName: string;
  isUnassigned: boolean;
  packageCount: number;
  totalPieces: number;
  totalWeight: number;
  pctOfPackaged: number;
  pctOfColdCarcass: number | null;
  avgWeightPerHead: number;
  estValue: number;
  pricedPackageWeight: number;
  orderCount: number;
  cuts: ButcherPrimalCutChildRow[];
}

export interface ButcherPrimalOrderTrendPoint {
  orderId: string;
  orderNumber: string;
  killDate?: string;
  species: string;
  orderPackagedWeight: number;
  weightsByPrimalId: Record<string, number>;
  pctByPrimalId: Record<string, number>;
}

export interface ButcherPrimalReportData {
  rows: ButcherPrimalReportRow[];
  assignedRows: ButcherPrimalReportRow[];
  unassignedRow: ButcherPrimalReportRow | null;
  totalPackagedWeight: number;
  totalColdWeight: number;
  totalAssignedWeight: number;
  totalUnassignedWeight: number;
  assignedCoveragePct: number;
  totalEstValue: number;
  totalAnimalCount: number;
  totalOrderCount: number;
  trendPoints: ButcherPrimalOrderTrendPoint[];
}

export interface PrimalRecordInput {
  orderId?: string;
  productId?: string;
  cuts?: string;
  originalCutName?: string;
  normalizedCutName?: string;
  pieces?: number;
  netWeight?: number;
}

export function computeRecordEstimatedValue(
  product: Product | undefined,
  netWeight: number,
  pieces: number,
  packageCount: number = 1,
): number {
  if (!product || !product.salePrice || product.salePrice <= 0) return 0;
  if (product.salePriceUnit === 'package') {
    return packageCount * product.salePrice;
  }
  // Default 'lb'
  return netWeight * product.salePrice;
}

export function buildButcherPrimalReport(
  ordersWithStats: Array<{ order: ButcherOrder; stats: ButcherOrderStats }>,
  recordsByOrderId: Map<string, PrimalRecordInput[]>,
  products: Product[],
  speciesPrimals: SpeciesPrimal[],
  options: {
    viewOriginalNames?: boolean;
    speciesFilter?: string; // Optional speciesId or 'ALL'
  } = {},
): ButcherPrimalReportData {
  const spIndex = buildSpeciesPrimalIndex(speciesPrimals);
  const productById = new Map<string, Product>();
  const productByNameLower = new Map<string, Product>();
  for (const p of products) {
    productById.set(p.id, p);
    productByNameLower.set(p.name.trim().toLowerCase(), p);
  }

  let totalPackagedWeight = 0;
  let totalColdWeight = 0;
  let totalAnimalCount = 0;

  type PrimalAccumulator = {
    primalId: string;
    primalName: string;
    speciesId: string | null;
    speciesName: string;
    isUnassigned: boolean;
    packageCount: number;
    totalPieces: number;
    totalWeight: number;
    estValue: number;
    pricedPackageWeight: number;
    orderIds: Set<string>;
    cuts: Map<
      string,
      {
        name: string;
        productId?: string;
        packageCount: number;
        totalPieces: number;
        totalWeight: number;
        estValue: number;
      }
    >;
  };

  const accumulators = new Map<string, PrimalAccumulator>();
  const trendPoints: ButcherPrimalOrderTrendPoint[] = [];

  for (const { order, stats } of ordersWithStats) {
    const orderRecords = recordsByOrderId.get(order.id) || [];
    const animals = Math.max(1, Number(order.animalCount) || 1);
    totalAnimalCount += animals;
    if (stats.coldWeight > 0) {
      totalColdWeight += stats.coldWeight;
    }

    const orderWeightsByPrimal: Record<string, number> = {};
    let orderActualRecordWeight = 0;

    for (const rec of orderRecords) {
      const weight = Number(rec.netWeight) || 0;
      const pieces = Number(rec.pieces) || 0;
      const matchedProduct =
        (rec.productId ? productById.get(rec.productId) : undefined) ||
        (rec.normalizedCutName ? productByNameLower.get(rec.normalizedCutName.trim().toLowerCase()) : undefined) ||
        (rec.cuts ? productByNameLower.get(rec.cuts.trim().toLowerCase()) : undefined);

      const resolved = resolveProductPrimal(matchedProduct, spIndex);

      if (
        options.speciesFilter &&
        options.speciesFilter !== 'ALL' &&
        resolved &&
        resolved.speciesId !== options.speciesFilter
      ) {
        continue;
      }

      const primalId = resolved ? resolved.primalId : UNASSIGNED_PRIMAL_ID;
      const primalName = resolved ? resolved.primalName : 'Unassigned Primal';
      const speciesId = resolved ? resolved.speciesId : null;
      const speciesName = resolved ? resolved.speciesName : (order.species || 'Unassigned');
      const isUnassigned = !resolved;

      orderActualRecordWeight += weight;
      totalPackagedWeight += weight;
      orderWeightsByPrimal[primalId] = (orderWeightsByPrimal[primalId] || 0) + weight;

      let acc = accumulators.get(primalId);
      if (!acc) {
        acc = {
          primalId,
          primalName,
          speciesId,
          speciesName,
          isUnassigned,
          packageCount: 0,
          totalPieces: 0,
          totalWeight: 0,
          estValue: 0,
          pricedPackageWeight: 0,
          orderIds: new Set(),
          cuts: new Map(),
        };
        accumulators.set(primalId, acc);
      }

      const estVal = computeRecordEstimatedValue(matchedProduct, weight, pieces, 1);
      acc.packageCount += 1;
      acc.totalPieces += pieces;
      acc.totalWeight += weight;
      acc.estValue += estVal;
      if (estVal > 0) acc.pricedPackageWeight += weight;
      acc.orderIds.add(order.id);

      const cutLabel = options.viewOriginalNames
        ? rec.originalCutName || rec.cuts || matchedProduct?.name || 'Unknown Cut'
        : matchedProduct?.name || rec.normalizedCutName || rec.cuts || rec.originalCutName || 'Unknown Cut';
      const cutKey = matchedProduct?.id ? `prod:${matchedProduct.id}` : `name:${cutLabel.toLowerCase()}`;

      let cutAcc = acc.cuts.get(cutKey);
      if (!cutAcc) {
        cutAcc = {
          name: cutLabel,
          productId: matchedProduct?.id,
          packageCount: 0,
          totalPieces: 0,
          totalWeight: 0,
          estValue: 0,
        };
        acc.cuts.set(cutKey, cutAcc);
      }
      cutAcc.packageCount += 1;
      cutAcc.totalPieces += pieces;
      cutAcc.totalWeight += weight;
      cutAcc.estValue += estVal;
    }

    const denom = stats.packagedWeight > 0 ? stats.packagedWeight : orderActualRecordWeight;
    const pctByPrimalId: Record<string, number> = {};
    for (const [pId, wt] of Object.entries(orderWeightsByPrimal)) {
      pctByPrimalId[pId] = denom > 0 ? (wt / denom) * 100 : 0;
    }

    trendPoints.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      killDate: order.killDate,
      species: order.species,
      orderPackagedWeight: denom,
      weightsByPrimalId: orderWeightsByPrimal,
      pctByPrimalId,
    });
  }

  let totalAssignedWeight = 0;
  let totalUnassignedWeight = 0;
  let totalEstValue = 0;

  const allRows: ButcherPrimalReportRow[] = Array.from(accumulators.values()).map((acc) => {
    if (acc.isUnassigned) {
      totalUnassignedWeight += acc.totalWeight;
    } else {
      totalAssignedWeight += acc.totalWeight;
    }
    totalEstValue += acc.estValue;

    const cuts: ButcherPrimalCutChildRow[] = Array.from(acc.cuts.values())
      .map((c) => ({
        name: c.name,
        productId: c.productId,
        packageCount: c.packageCount,
        totalPieces: c.totalPieces,
        totalWeight: c.totalWeight,
        pctOfPrimal: acc.totalWeight > 0 ? (c.totalWeight / acc.totalWeight) * 100 : 0,
        pctOfPackaged: totalPackagedWeight > 0 ? (c.totalWeight / totalPackagedWeight) * 100 : 0,
        estValue: c.estValue,
      }))
      .sort((a, b) => b.totalWeight - a.totalWeight);

    return {
      primalId: acc.primalId,
      primalName: acc.primalName,
      speciesId: acc.speciesId,
      speciesName: acc.speciesName,
      isUnassigned: acc.isUnassigned,
      packageCount: acc.packageCount,
      totalPieces: acc.totalPieces,
      totalWeight: acc.totalWeight,
      pctOfPackaged: totalPackagedWeight > 0 ? (acc.totalWeight / totalPackagedWeight) * 100 : 0,
      pctOfColdCarcass: totalColdWeight > 0 ? (acc.totalWeight / totalColdWeight) * 100 : null,
      avgWeightPerHead: totalAnimalCount > 0 ? acc.totalWeight / totalAnimalCount : 0,
      estValue: acc.estValue,
      pricedPackageWeight: acc.pricedPackageWeight,
      orderCount: acc.orderIds.size,
      cuts,
    };
  });

  const assignedRows = allRows
    .filter((r) => !r.isUnassigned)
    .sort((a, b) => b.totalWeight - a.totalWeight);
  const unassignedRow = allRows.find((r) => r.isUnassigned) || null;
  const rows = unassignedRow ? [...assignedRows, unassignedRow] : assignedRows;

  const assignedCoveragePct =
    totalPackagedWeight > 0 ? (totalAssignedWeight / totalPackagedWeight) * 100 : 0;

  return {
    rows,
    assignedRows,
    unassignedRow,
    totalPackagedWeight,
    totalColdWeight,
    totalAssignedWeight,
    totalUnassignedWeight,
    assignedCoveragePct,
    totalEstValue,
    totalAnimalCount,
    totalOrderCount: ordersWithStats.length,
    trendPoints,
  };
}
