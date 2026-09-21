import { HistoryEntry, MeatCut, OffSiteEntry, Container, Freezer, Product, MovementOrder, ButcherOrder } from '../types';

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

  // 1. Identify packages and lots currently in the system (Active physical custody)
  const activeSerials = new Set<string>();
  const activeItemIds = new Set<string>();
  const activeLots = new Set<string>();
  const activeContainerIds = new Set<string>();

  // On-site cuts currently in stock
  meatCuts.forEach(cut => {
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
  });

  // Off-site entries currently in stock (not archived and pieces > 0)
  offSiteEntries.forEach(entry => {
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
    }
  });

  // Active containers currently existing in system
  containers.forEach(c => {
    if (!c.isArchived) {
      activeContainerIds.add(c.id);
    }
  });

  // 2. Build index of all known serials and lot numbers (active and historical)
  const allKnownSerials = new Map<string, string>(); // lower -> original
  const allKnownLots = new Map<string, string>();     // lower -> original

  offSiteEntries.forEach(e => {
    if (e.serial && e.serial.trim()) {
      allKnownSerials.set(e.serial.trim().toLowerCase(), e.serial.trim());
    }
    if (e.lot && e.lot.trim()) {
      allKnownLots.set(e.lot.trim().toLowerCase(), e.lot.trim());
    }
  });

  meatCuts.forEach(c => {
    if (c.serial && c.serial.trim()) {
      allKnownSerials.set(c.serial.trim().toLowerCase(), c.serial.trim());
    }
    if (c.lot && c.lot.trim()) {
      allKnownLots.set(c.lot.trim().toLowerCase(), c.lot.trim());
    }
  });

  // 3. Track the LAST SEEN timestamp for each package and lot in the system
  // If active, last seen is Infinity (still in custody).
  const packageLastSeen = new Map<string, number>();
  const lotLastSeen = new Map<string, number>();

  activeSerials.forEach(s => packageLastSeen.set(`serial:${s}`, Infinity));
  activeItemIds.forEach(id => packageLastSeen.set(`id:${id}`, Infinity));
  activeLots.forEach(l => lotLastSeen.set(`lot:${l}`, Infinity));

  // Check movement orders for package activity dates
  movementOrders.forEach(mo => {
    const moTime = new Date(mo.executedAt || mo.date || '').getTime();
    if (!isNaN(moTime)) {
      (mo.moves || []).forEach(m => {
        if (m.entryId) {
          const key = `id:${m.entryId.toLowerCase()}`;
          if (packageLastSeen.get(key) !== Infinity) {
            packageLastSeen.set(key, Math.max(packageLastSeen.get(key) || 0, moTime));
          }
        }
      });
      (mo.originalEntries || []).forEach(oe => {
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
      });
    }
  });

  // Check all history entries to record the most recent event timestamp for departed packages
  (history || []).forEach(h => {
    const hTime = new Date(h.timestamp).getTime();
    if (isNaN(hTime)) return;

    if (h.targetId) {
      const targetLower = h.targetId.toLowerCase();
      // If targetId is an item ID
      if (packageLastSeen.get(`id:${targetLower}`) !== Infinity) {
        packageLastSeen.set(`id:${targetLower}`, Math.max(packageLastSeen.get(`id:${targetLower}`) || 0, hTime));
      }
      // If targetId is a serial
      if (allKnownSerials.has(targetLower)) {
        if (packageLastSeen.get(`serial:${targetLower}`) !== Infinity) {
          packageLastSeen.set(`serial:${targetLower}`, Math.max(packageLastSeen.get(`serial:${targetLower}`) || 0, hTime));
        }
      }
    }

    // Check description for serial or lot mentions
    const descLower = (h.description || '').toLowerCase();
    allKnownSerials.forEach((_, serialLower) => {
      if (serialLower.length >= 3 && descLower.includes(serialLower)) {
        if (packageLastSeen.get(`serial:${serialLower}`) !== Infinity) {
          packageLastSeen.set(`serial:${serialLower}`, Math.max(packageLastSeen.get(`serial:${serialLower}`) || 0, hTime));
        }
      }
    });

    allKnownLots.forEach((_, lotLower) => {
      if (lotLower.length >= 3 && descLower.includes(lotLower)) {
        if (lotLastSeen.get(`lot:${lotLower}`) !== Infinity) {
          lotLastSeen.set(`lot:${lotLower}`, Math.max(lotLastSeen.get(`lot:${lotLower}`) || 0, hTime));
        }
      }
    });
  });

  // 4. Partition history entries into toKeep and toPurge
  const toKeep: HistoryEntry[] = [];
  const toPurge: HistoryEntry[] = [];
  let protectedActiveCount = 0;

  (history || []).forEach(h => {
    const hTime = new Date(h.timestamp).getTime();
    if (isNaN(hTime)) {
      toKeep.push(h);
      return;
    }

    let packageLastSeenTime: number | null = null;
    let lotLastSeenTime: number | null = null;
    let isTiedToActiveContainer = false;

    if (h.targetId) {
      const targetLower = h.targetId.toLowerCase();
      if (activeContainerIds.has(h.targetId)) {
        isTiedToActiveContainer = true;
      }
      if (packageLastSeen.has(`id:${targetLower}`)) {
        packageLastSeenTime = Math.max(packageLastSeenTime ?? 0, packageLastSeen.get(`id:${targetLower}`)!);
      }
      if (packageLastSeen.has(`serial:${targetLower}`)) {
        packageLastSeenTime = Math.max(packageLastSeenTime ?? 0, packageLastSeen.get(`serial:${targetLower}`)!);
      }
    }

    const descLower = (h.description || '').toLowerCase();
    allKnownSerials.forEach((_, serialLower) => {
      if (serialLower.length >= 3 && descLower.includes(serialLower)) {
        if (packageLastSeen.has(`serial:${serialLower}`)) {
          packageLastSeenTime = Math.max(packageLastSeenTime ?? 0, packageLastSeen.get(`serial:${serialLower}`)!);
        }
      }
    });

    allKnownLots.forEach((_, lotLower) => {
      if (lotLower.length >= 3 && descLower.includes(lotLower)) {
        if (lotLastSeen.has(`lot:${lotLower}`)) {
          lotLastSeenTime = Math.max(lotLastSeenTime ?? 0, lotLastSeen.get(`lot:${lotLower}`)!);
        }
      }
    });

    // Evaluation Rule:
    // A. If tied to a package:
    if (packageLastSeenTime !== null) {
      // Package is still active in the system: NEVER purge!
      if (packageLastSeenTime === Infinity) {
        protectedActiveCount++;
        toKeep.push(h);
        return;
      }
      // Package has departed the system: check how long it has been out of our hands
      const outOfHandsDuration = now - packageLastSeenTime;
      if (outOfHandsDuration < retentionMs) {
        // Less than X years out of our hands: PROTECTED!
        toKeep.push(h);
        return;
      }
      // Package has been out of our hands for at least X years: eligible for purge
      toPurge.push(h);
      return;
    }

    // B. If tied to a lot:
    if (lotLastSeenTime !== null) {
      if (lotLastSeenTime === Infinity) {
        protectedActiveCount++;
        toKeep.push(h);
        return;
      }
      const outOfHandsDuration = now - lotLastSeenTime;
      if (outOfHandsDuration < retentionMs) {
        toKeep.push(h);
        return;
      }
      toPurge.push(h);
      return;
    }

    // C. If tied to an active container currently in use:
    if (isTiedToActiveContainer) {
      toKeep.push(h);
      return;
    }

    // D. General/system maintenance entry not tied to a package:
    // Retain unless the action itself was performed >= retentionMs ago
    if (hTime < cutoffTime) {
      toPurge.push(h);
    } else {
      toKeep.push(h);
    }
  });

  return {
    toKeep,
    toPurge,
    totalEntries: (history || []).length,
    activePackagesCount: activeSerials.size + activeItemIds.size,
    protectedActiveCount,
    purgedCount: toPurge.length,
    keptCount: toKeep.length
  };
}
