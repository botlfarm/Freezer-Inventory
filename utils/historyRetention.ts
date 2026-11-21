// History retention utilities
import { HistoryEntry, MeatCut, OffSiteEntry, Container, Freezer, Product, MovementOrder, ButcherOrder, AppPallet } from '../types';

export interface HistoryRetentionResult {
  toKeep: HistoryEntry[];
  toPurge: HistoryEntry[];
  totalEntries: number;
  activePackagesCount: number;
  protectedActiveCount: number;
  purgedCount: number;
  keptCount: number;
}

/**
 * Calculates history log retention based on package lifecycle and physical custody.
 *
 * RULE: A history log entry is NEVER deleted merely because of its calendar age if the
 * package it belongs to is still in the system, or has not been out of the user's
 * hands for at least `olderThanDays` (e.g. 1, 2, 3, or 5 years).
 *
 * For example: If a package arrived 6 years ago, had moves 4 years ago, and is either
 * still in stock or departed the freezer only 6 months ago, ALL of its history entries are
 * protected from deletion because it has not been out of custody for the specified years.
 */
export function calculateHistoryRetention(
  history: HistoryEntry[],
  state: {
    meatCuts?: MeatCut[];
    offSiteEntries?: OffSiteEntry[];
    containers?: Container[];
    freezers?: Freezer[];
    products?: Product[];
    movementOrders?: MovementOrder[];
    butcherOrders?: ButcherOrder[];
    pallets?: AppPallet[];
  },
  olderThanDays: number
): HistoryRetentionResult {
  const now = Date.now();
  const retentionMs = olderThanDays * 86400 * 1000;
  const cutoffTime = now - retentionMs;

  const meatCuts = state.meatCuts || [];
  const offSiteEntries = state.offSiteEntries || [];
  const containers = state.containers || [];
  const movementOrders = state.movementOrders || [];
  const butcherOrders = state.butcherOrders || [];
  const pallets = state.pallets || [];
  const historyList = history || [];

  // 1. Identify packages and lots currently in the system (Active physical custody)
  const activeSerials = new Set<string>();
  const activeItemIds = new Set<string>();
  const activeLots = new Set<string>();
  const activeContainerIds = new Set<string>();
  const activeButcherOrderIds = new Set<string>();
  const activePalletNames = new Set<string>();
  const activeMovementOrderIds = new Set<string>();

  for (let i = 0; i < meatCuts.length; i++) {
    const cut = meatCuts[i];
    if ((cut.quantity ?? 1) > 0) {
      if (cut.id) activeItemIds.add(cut.id.toLowerCase());
      if (cut.serial && cut.serial.trim()) {
        activeSerials.add(cut.serial.trim().toLowerCase());
      }
      if (cut.lot && cut.lot.trim()) {
        activeLots.add(cut.lot.trim().toLowerCase());
      }
      if (cut.containerId) {
        activeContainerIds.add(cut.containerId);
      }
    }
  }

  for (let i = 0; i < offSiteEntries.length; i++) {
    const entry = offSiteEntries[i];
    const isArchived = Boolean(entry.archived);
    const pieces = entry.pieces ?? 1;
    if (!isArchived && pieces > 0) {
      if (entry.id) activeItemIds.add(entry.id.toLowerCase());
      if (entry.serial && entry.serial.trim()) {
        activeSerials.add(entry.serial.trim().toLowerCase());
      }
      if (entry.lot && entry.lot.trim()) {
        activeLots.add(entry.lot.trim().toLowerCase());
      }
      if (entry.orderId && entry.orderId.trim()) {
        activeButcherOrderIds.add(entry.orderId.trim().toLowerCase());
      }
      const pName = (entry.currentLocation || entry.pallet || '').trim().toLowerCase();
      if (pName) {
        activePalletNames.add(pName);
      }
    }
  }

  for (let i = 0; i < containers.length; i++) {
    const c = containers[i];
    if (!c.isArchived) {
      activeContainerIds.add(c.id);
    }
  }

  for (let i = 0; i < pallets.length; i++) {
    const p = pallets[i];
    if (!p.isArchived && p.id) {
      activePalletNames.add(p.id.trim().toLowerCase());
    }
  }

  // Track last activity per ButcherOrder and MovementOrder
  const orderLastSeen = new Map<string, number>();
  activeButcherOrderIds.forEach(oid => orderLastSeen.set(oid, Infinity));

  for (let i = 0; i < butcherOrders.length; i++) {
    const bo = butcherOrders[i];
    if (!bo.id) continue;
    const oidLower = bo.id.toLowerCase();
    if (orderLastSeen.get(oidLower) === Infinity) continue;
    const boTime = Math.max(
      bo.createdAt || 0,
      bo.pickupDate ? new Date(bo.pickupDate).getTime() || 0 : 0
    );
    if (boTime > 0) {
      orderLastSeen.set(oidLower, Math.max(orderLastSeen.get(oidLower) || 0, boTime));
    }
  }

  for (let i = 0; i < movementOrders.length; i++) {
    const mo = movementOrders[i];
    if (!mo.id) continue;
    const oidLower = mo.id.toLowerCase();
    if (mo.status === 'planning' || mo.status === 'finalized') {
      activeMovementOrderIds.add(oidLower);
      orderLastSeen.set(oidLower, Infinity);
    } else {
      const moTime = new Date(mo.executedAt || mo.date || '').getTime();
      if (!isNaN(moTime)) {
        orderLastSeen.set(oidLower, Math.max(orderLastSeen.get(oidLower) || 0, moTime));
      }
    }
  }

  // 2. Build index of all known serials and lot numbers (active and historical)
  const allKnownSerials = new Set<string>();
  const allKnownLots = new Set<string>();

  for (let i = 0; i < offSiteEntries.length; i++) {
    const e = offSiteEntries[i];
    if (e.serial && e.serial.trim()) {
      const s = e.serial.trim().toLowerCase();
      if (s.length >= 3) allKnownSerials.add(s);
    }
    if (e.lot && e.lot.trim()) {
      const l = e.lot.trim().toLowerCase();
      if (l.length >= 3) allKnownLots.add(l);
    }
  }

  for (let i = 0; i < meatCuts.length; i++) {
    const c = meatCuts[i];
    if (c.serial && c.serial.trim()) {
      const s = c.serial.trim().toLowerCase();
      if (s.length >= 3) allKnownSerials.add(s);
    }
    if (c.lot && c.lot.trim()) {
      const l = c.lot.trim().toLowerCase();
      if (l.length >= 3) allKnownLots.add(l);
    }
  }

  // Separate single-token identifiers from multi-word identifiers for O(1) token matching
  const singleTokenSerials = new Set<string>();
  const fallbackSerials: string[] = [];
  allKnownSerials.forEach(s => {
    if (/^[a-z0-9_./-]+$/.test(s)) {
      singleTokenSerials.add(s);
    } else {
      fallbackSerials.push(s);
    }
  });

  const singleTokenLots = new Set<string>();
  const fallbackLots: string[] = [];
  allKnownLots.forEach(l => {
    if (/^[a-z0-9_./-]+$/.test(l)) {
      singleTokenLots.add(l);
    } else {
      fallbackLots.push(l);
    }
  });

  // 3. Track the LAST SEEN timestamp for each package and lot in the system
  // If active, last seen is Infinity (still in custody).
  const packageLastSeen = new Map<string, number>();
  const lotLastSeen = new Map<string, number>();

  activeSerials.forEach(s => packageLastSeen.set(`serial:${s}`, Infinity));
  activeItemIds.forEach(id => packageLastSeen.set(`id:${id}`, Infinity));
  activeLots.forEach(l => lotLastSeen.set(`lot:${l}`, Infinity));

  for (let i = 0; i < movementOrders.length; i++) {
    const mo = movementOrders[i];
    const moTime = new Date(mo.executedAt || mo.date || '').getTime();
    if (!isNaN(moTime)) {
      const moves = mo.moves || [];
      for (let j = 0; j < moves.length; j++) {
        const m = moves[j];
        if (m.entryId) {
          const key = `id:${m.entryId.toLowerCase()}`;
          if (packageLastSeen.get(key) !== Infinity) {
            packageLastSeen.set(key, Math.max(packageLastSeen.get(key) || 0, moTime));
          }
        }
      }
      const origEntries = mo.originalEntries || [];
      for (let j = 0; j < origEntries.length; j++) {
        const oe = origEntries[j];
        if (oe.id) {
          const key = `id:${oe.id.toLowerCase()}`;
          if (packageLastSeen.get(key) !== Infinity) {
            packageLastSeen.set(key, Math.max(packageLastSeen.get(key) || 0, moTime));
          }
        }
        if (oe.serial && oe.serial.trim()) {
          const key = `serial:${oe.serial.trim().toLowerCase()}`;
          if (packageLastSeen.get(key) !== Infinity) {
            packageLastSeen.set(key, Math.max(packageLastSeen.get(key) || 0, moTime));
          }
        }
        if (oe.lot && oe.lot.trim()) {
          const key = `lot:${oe.lot.trim().toLowerCase()}`;
          if (lotLastSeen.get(key) !== Infinity) {
            lotLastSeen.set(key, Math.max(lotLastSeen.get(key) || 0, moTime));
          }
        }
      }
    }
  }

  // Helper to extract matched serials and lots from a lowercase description in O(tokens)
  const extractMatchesFromDesc = (descLower: string): { serials: string[]; lots: string[] } => {
    if (!descLower) return { serials: [], lots: [] };
    const matchedSerialsSet = new Set<string>();
    const matchedLotsSet = new Set<string>();

    if (singleTokenSerials.size > 0 || singleTokenLots.size > 0) {
      const compositeTokens = descLower.match(/[a-z0-9_./-]+/g);
      if (compositeTokens) {
        for (let t = 0; t < compositeTokens.length; t++) {
          const tok = compositeTokens[t];
          if (tok.length < 3) continue;
          if (singleTokenSerials.has(tok)) matchedSerialsSet.add(tok);
          if (singleTokenLots.has(tok)) matchedLotsSet.add(tok);
        }
      }
      const alphaNumTokens = descLower.match(/[a-z0-9]+/g);
      if (alphaNumTokens) {
        for (let t = 0; t < alphaNumTokens.length; t++) {
          const tok = alphaNumTokens[t];
          if (tok.length < 3) continue;
          if (singleTokenSerials.has(tok)) matchedSerialsSet.add(tok);
          if (singleTokenLots.has(tok)) matchedLotsSet.add(tok);
        }
      }
    }

    for (let i = 0; i < fallbackSerials.length; i++) {
      if (descLower.includes(fallbackSerials[i])) {
        matchedSerialsSet.add(fallbackSerials[i]);
      }
    }
    for (let i = 0; i < fallbackLots.length; i++) {
      if (descLower.includes(fallbackLots[i])) {
        matchedLotsSet.add(fallbackLots[i]);
      }
    }

    return {
      serials: Array.from(matchedSerialsSet),
      lots: Array.from(matchedLotsSet)
    };
  };

  // Single pre-pass over history entries caching parsed timestamp and matched serials/lots
  interface ParsedHistoryMeta {
    hTime: number;
    targetLower: string;
    matchedSerials: string[];
    matchedLots: string[];
  }
  const parsedMeta: ParsedHistoryMeta[] = new Array(historyList.length);

  for (let i = 0; i < historyList.length; i++) {
    const h = historyList[i];
    const hTime = new Date(h.timestamp).getTime();
    const targetLower = h.targetId ? h.targetId.toLowerCase() : '';
    const descLower = (h.description || '').toLowerCase();
    const { serials: matchedSerials, lots: matchedLots } = extractMatchesFromDesc(descLower);

    parsedMeta[i] = { hTime, targetLower, matchedSerials, matchedLots };

    if (isNaN(hTime)) continue;

    if (targetLower) {
      const isNonPackageEntity =
        orderLastSeen.has(targetLower) ||
        activeButcherOrderIds.has(targetLower) ||
        activeMovementOrderIds.has(targetLower) ||
        activePalletNames.has(targetLower) ||
        activeContainerIds.has(h.targetId);

      if (!isNonPackageEntity && packageLastSeen.get(`id:${targetLower}`) !== Infinity) {
        packageLastSeen.set(`id:${targetLower}`, Math.max(packageLastSeen.get(`id:${targetLower}`) || 0, hTime));
      }
      if (orderLastSeen.has(targetLower) && orderLastSeen.get(targetLower) !== Infinity) {
        orderLastSeen.set(targetLower, Math.max(orderLastSeen.get(targetLower) || 0, hTime));
      }
      if (allKnownSerials.has(targetLower)) {
        if (packageLastSeen.get(`serial:${targetLower}`) !== Infinity) {
          packageLastSeen.set(`serial:${targetLower}`, Math.max(packageLastSeen.get(`serial:${targetLower}`) || 0, hTime));
        }
      }
    }

    for (let s = 0; s < matchedSerials.length; s++) {
      const serialLower = matchedSerials[s];
      if (packageLastSeen.get(`serial:${serialLower}`) !== Infinity) {
        packageLastSeen.set(`serial:${serialLower}`, Math.max(packageLastSeen.get(`serial:${serialLower}`) || 0, hTime));
      }
    }

    for (let l = 0; l < matchedLots.length; l++) {
      const lotLower = matchedLots[l];
      if (lotLastSeen.get(`lot:${lotLower}`) !== Infinity) {
        lotLastSeen.set(`lot:${lotLower}`, Math.max(lotLastSeen.get(`lot:${lotLower}`) || 0, hTime));
      }
    }
  }

  // 4. Partition history entries into toKeep and toPurge using cached metadata
  const toKeep: HistoryEntry[] = [];
  const toPurge: HistoryEntry[] = [];
  let protectedActiveCount = 0;

  for (let i = 0; i < historyList.length; i++) {
    const h = historyList[i];
    const { hTime, targetLower, matchedSerials, matchedLots } = parsedMeta[i];
    if (isNaN(hTime)) {
      toKeep.push(h);
      continue;
    }

    let packageLastSeenTime: number | null = null;
    let lotLastSeenTime: number | null = null;
    let orderLastSeenTime: number | null = null;
    let isTiedToActiveContainerOrPallet = false;

    if (h.targetId) {
      const isNonPackageTarget =
        orderLastSeen.has(targetLower) ||
        activeButcherOrderIds.has(targetLower) ||
        activeMovementOrderIds.has(targetLower) ||
        activePalletNames.has(targetLower) ||
        activeContainerIds.has(h.targetId);

      if (activeContainerIds.has(h.targetId)) {
        isTiedToActiveContainerOrPallet = true;
      }
      if (activePalletNames.has(targetLower)) {
        isTiedToActiveContainerOrPallet = true;
      }
      if (!isNonPackageTarget && packageLastSeen.has(`id:${targetLower}`)) {
        packageLastSeenTime = Math.max(packageLastSeenTime ?? 0, packageLastSeen.get(`id:${targetLower}`)!);
      }
      if (packageLastSeen.has(`serial:${targetLower}`)) {
        packageLastSeenTime = Math.max(packageLastSeenTime ?? 0, packageLastSeen.get(`serial:${targetLower}`)!);
      }
      if (orderLastSeen.has(targetLower)) {
        orderLastSeenTime = Math.max(orderLastSeenTime ?? 0, orderLastSeen.get(targetLower)!);
      }
    }

    if (h.details) {
      if (h.details.palletName && activePalletNames.has(h.details.palletName.trim().toLowerCase())) {
        isTiedToActiveContainerOrPallet = true;
      }
      if (h.details.relatedOrderId) {
        const relLower = h.details.relatedOrderId.trim().toLowerCase();
        if (activeButcherOrderIds.has(relLower) || activeMovementOrderIds.has(relLower)) {
          orderLastSeenTime = Infinity;
        } else if (orderLastSeen.has(relLower)) {
          orderLastSeenTime = Math.max(orderLastSeenTime ?? 0, orderLastSeen.get(relLower)!);
        }
      }
      if (Array.isArray(h.details.items)) {
        for (let d = 0; d < h.details.items.length; d++) {
          const dItem = h.details.items[d];
          if (dItem.id) {
            const dIdKey = `id:${dItem.id.toLowerCase()}`;
            if (packageLastSeen.has(dIdKey)) {
              packageLastSeenTime = Math.max(packageLastSeenTime ?? 0, packageLastSeen.get(dIdKey)!);
            }
          }
          if (dItem.serial) {
            const dSerialKey = `serial:${dItem.serial.trim().toLowerCase()}`;
            if (packageLastSeen.has(dSerialKey)) {
              packageLastSeenTime = Math.max(packageLastSeenTime ?? 0, packageLastSeen.get(dSerialKey)!);
            }
          }
        }
      }
    }

    for (let s = 0; s < matchedSerials.length; s++) {
      const serialLower = matchedSerials[s];
      if (packageLastSeen.has(`serial:${serialLower}`)) {
        packageLastSeenTime = Math.max(packageLastSeenTime ?? 0, packageLastSeen.get(`serial:${serialLower}`)!);
      }
    }

    for (let l = 0; l < matchedLots.length; l++) {
      const lotLower = matchedLots[l];
      if (lotLastSeen.has(`lot:${lotLower}`)) {
        lotLastSeenTime = Math.max(lotLastSeenTime ?? 0, lotLastSeen.get(`lot:${lotLower}`)!);
      }
    }

    // A. If tied to a package:
    if (packageLastSeenTime !== null) {
      if (packageLastSeenTime === Infinity) {
        protectedActiveCount++;
        toKeep.push(h);
        continue;
      }
      const outOfHandsDuration = now - packageLastSeenTime;
      if (outOfHandsDuration < retentionMs) {
        toKeep.push(h);
        continue;
      }
      toPurge.push(h);
      continue;
    }

    // B. If tied to a lot:
    if (lotLastSeenTime !== null) {
      if (lotLastSeenTime === Infinity) {
        protectedActiveCount++;
        toKeep.push(h);
        continue;
      }
      const outOfHandsDuration = now - lotLastSeenTime;
      if (outOfHandsDuration < retentionMs) {
        toKeep.push(h);
        continue;
      }
      toPurge.push(h);
      continue;
    }

    // C. If tied to a butcher order or movement order:
    if (orderLastSeenTime !== null) {
      if (orderLastSeenTime === Infinity) {
        protectedActiveCount++;
        toKeep.push(h);
        continue;
      }
      const outOfHandsDuration = now - orderLastSeenTime;
      if (outOfHandsDuration < retentionMs) {
        toKeep.push(h);
        continue;
      }
      toPurge.push(h);
      continue;
    }

    // D. If tied to an active container or active pallet currently in use:
    if (isTiedToActiveContainerOrPallet) {
      toKeep.push(h);
      continue;
    }

    // E. General/system maintenance entry not tied to a package:
    if (hTime < cutoffTime) {
      toPurge.push(h);
    } else {
      toKeep.push(h);
    }
  }

  return {
    toKeep,
    toPurge,
    totalEntries: historyList.length,
    activePackagesCount: activeSerials.size + activeItemIds.size,
    protectedActiveCount,
    purgedCount: toPurge.length,
    keptCount: toKeep.length
  };
}
