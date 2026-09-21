import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { InventoryState, Action, UndoSnapshotItem, OperatingMode, ConnectedClientInfo, ForcedMultiUser, OperationalZone, ZoneClientCounts, View, getOperationalZone } from '../types';
import { getApiUrl, fetchWithRetry } from './apiUrl';
import { getClientAuditHeaders } from '../utils/clientDevice';

export type { OperatingMode, ForcedMultiUser, OperationalZone, ZoneClientCounts };

const defaultInitialState: InventoryState = {
  freezers: [],
  containers: [],
  products: [],
  categories: [],
  meatCuts: [],
  history: [],
};

export interface SingleUserLock {
  clientId: string;
  holderName: string;
  acquiredAt: number;
  lastActiveAt: number;
  scope?: 'all' | 'onsite' | 'offsite';
  breakInRequest?: {
    requestedByClientId: string;
    requestedByName: string;
    requestedAt: number;
  } | null;
}

export interface LocalUndoSnapshot {
  id: string;
  historyId: string;
  actionType: string;
  description: string;
  timestamp: string;
  user?: string;
  targetId?: string;
  changedSlices?: Partial<InventoryState>;
  state?: InventoryState;
  createdAt: number;
}

const getActionDescription = (action: Action): string => {
  if (!action) return 'Inventory action';
  switch (action.type as string) {
    case 'UPDATE_MEAT_QUANTITY': return 'Updated cut quantity';
    case 'BATCH_UPDATE_MEAT_QUANTITY': return 'Batch updated cut quantities';
    case 'MOVE_MEAT_CUTS': return 'Moved cuts to location';
    case 'STAGE_OFFSITE_ITEM': return 'Staged off-site cut';
    case 'STAGE_OFFSITE_BOX': return 'Staged off-site box';
    case 'BATCH_STAGE_OFFSITE_ITEMS': return 'Batch staged off-site items';
    case 'CREATE_OFFSITE_ENTRY': return 'Created off-site entry';
    case 'UPDATE_OFFSITE_ENTRY': return 'Updated off-site entry';
    case 'DELETE_OFFSITE_ENTRY': return 'Deleted off-site entry';
    case 'CREATE_CONTAINER': return 'Created container/box';
    case 'UPDATE_CONTAINER': return 'Updated container';
    case 'DELETE_CONTAINER': return 'Deleted container';
    case 'UPDATE_MOVEMENT_ORDER': return 'Updated movement order';
    case 'CREATE_MOVEMENT_ORDER': return 'Created movement order';
    default:
      return (action as any).payload?.description || (action as any).description || `Action: ${action.type}`;
  }
};

const TABLE_TO_KEY_MAP: Record<string, keyof InventoryState> = {
  'meat_cuts': 'meatCuts',
  'containers': 'containers',
  'freezers': 'freezers',
  'products': 'products',
  'categories': 'categories',
  'pallets': 'pallets',
  'boxes': 'boxes',
  'custom_lists': 'customLists',
  'tags': 'tags',
  'locations': 'locations',
  'movement_orders': 'movementOrders',
  'off_site_entries': 'offSiteEntries',
  'butcher_orders': 'butcherOrders',
  'history': 'history',
  'notification_settings': 'notificationSettings',
  'notification_logs': 'notificationLogs'
};

const STATE_ARRAY_KEYS: (keyof InventoryState)[] = [
  'freezers',
  'containers',
  'meatCuts',
  'products',
  'categories',
  'pallets',
  'boxes',
  'customLists',
  'tags',
  'locations',
  'movementOrders',
  'offSiteEntries',
  'butcherOrders',
  'history',
  'notificationSettings',
  'notificationLogs',
  'containerTemplates'
];

function reconcileStateReferences(
  prevState: InventoryState,
  updatedState: InventoryState,
  affectedTables?: string[]
): InventoryState {
  if (!prevState || !updatedState) return updatedState;

  const affectedKeys = new Set<keyof InventoryState>();
  if (affectedTables && Array.isArray(affectedTables) && affectedTables.length > 0) {
    affectedTables.forEach(t => {
      if (TABLE_TO_KEY_MAP[t]) {
        affectedKeys.add(TABLE_TO_KEY_MAP[t]);
      }
    });
  }

  const result: any = { ...updatedState };

  for (const key of STATE_ARRAY_KEYS) {
    if (affectedTables && affectedTables.length > 0) {
      if (!affectedKeys.has(key) && prevState[key] !== undefined) {
        result[key] = prevState[key];
      }
    } else {
      // Fallback: If lengths match and items match, preserve prevState reference
      const prevArr = prevState[key];
      const nextArr = updatedState[key];
      if (Array.isArray(prevArr) && Array.isArray(nextArr)) {
        if (prevArr.length === 0 && nextArr.length === 0) {
          result[key] = prevArr;
        } else if (prevArr === nextArr) {
          result[key] = prevArr;
        }
      }
    }
  }

  return result;
}

export const useInventory = (activeView: View = 'product') => {
  const activeZone = useMemo<OperationalZone>(() => getOperationalZone(activeView), [activeView]);
  const activeViewRef = useRef<View>(activeView);
  const activeZoneRef = useRef<OperationalZone>(activeZone);

  useEffect(() => {
    activeViewRef.current = activeView;
    activeZoneRef.current = activeZone;
  }, [activeView, activeZone]);

  const [zoneClientCounts, setZoneClientCountsState] = useState<ZoneClientCounts>({ total: 1, onsite: 1, offsite: 0 });
  const zoneClientCountsRef = useRef<ZoneClientCounts>({ total: 1, onsite: 1, offsite: 0 });
  const setZoneClientCounts = useCallback((countsOrUpdater: ZoneClientCounts | ((prev: ZoneClientCounts) => ZoneClientCounts)) => {
    setZoneClientCountsState(prev => {
      const next = typeof countsOrUpdater === 'function' ? countsOrUpdater(prev) : countsOrUpdater;
      zoneClientCountsRef.current = next;
      return next;
    });
  }, []);

  const activeZoneClientCount = useMemo(() => {
    return activeZone === 'offsite' ? (zoneClientCounts.offsite ?? 0) : (zoneClientCounts.onsite ?? 1);
  }, [activeZone, zoneClientCounts]);

  const clientIdRef = useRef<string>(
    (() => {
      try {
        let savedId = sessionStorage.getItem('freezer_session_client_id');
        if (!savedId) {
          savedId = 'c_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
          sessionStorage.setItem('freezer_session_client_id', savedId);
        }
        return savedId;
      } catch {
        return 'c_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      }
    })()
  );
  const [state, setState] = useState<InventoryState>(defaultInitialState);
  const [undoStack, setUndoStack] = useState<InventoryState[]>([]);
  const [redoStack, setRedoStack] = useState<InventoryState[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasLoadedInitial, setHasLoadedInitial] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPendingChanges, setHasPendingChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPendingSync, setIsPendingSync] = useState<boolean>(false);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);

  const [isCollaborativeMode, setIsCollaborativeModeState] = useState<boolean>(false);
  const isCollaborativeModeRef = useRef<boolean>(false);
  const setIsCollaborativeMode = useCallback((valOrUpdater: boolean | ((prev: boolean) => boolean)) => {
    setIsCollaborativeModeState(prev => {
      const next = typeof valOrUpdater === 'function' ? valOrUpdater(prev) : valOrUpdater;
      isCollaborativeModeRef.current = next;
      return next;
    });
  }, []);

  const recalculateCollaborativeMode = useCallback((forced?: ForcedMultiUser | null, zCounts?: ZoneClientCounts) => {
    const activeForced = forced !== undefined ? forced : forcedMultiUserRef.current;
    if (activeForced && (activeForced as any).enabled !== false) {
      setIsCollaborativeMode(true);
      return;
    }
    if (operatingModeRef.current === 'single') {
      setIsCollaborativeMode(false);
      return;
    }
    const currentCounts = zCounts || zoneClientCountsRef.current;
    const currentZone = activeZoneRef.current;
    const currentZoneCount = currentZone === 'offsite' ? (currentCounts.offsite ?? 0) : (currentCounts.onsite ?? 1);
    setIsCollaborativeMode(currentZoneCount > 1);
  }, [setIsCollaborativeMode]);

  const [activeClientCount, setActiveClientCountState] = useState<number>(1);
  const activeClientCountRef = useRef<number>(1);
  const setActiveClientCount = useCallback((countOrUpdater: number | ((prev: number) => number)) => {
    setActiveClientCountState(prev => {
      const next = typeof countOrUpdater === 'function' ? countOrUpdater(prev) : countOrUpdater;
      activeClientCountRef.current = next;
      return next;
    });
  }, []);

  const [connectedClients, setConnectedClients] = useState<ConnectedClientInfo[]>([]);
  const collaborativeDecayTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Operating Modes: 'auto' (default: smart solo/multi), 'multi' (forced live sync), 'single' (exclusive server lock)
  const [operatingMode, setOperatingModeState] = useState<OperatingMode>('auto');
  const operatingModeRef = useRef<OperatingMode>('auto');
  useEffect(() => {
    operatingModeRef.current = operatingMode;
  }, [operatingMode]);

  // Forced Multi-User state (set when any device enforces Multi-User Mode)
  const [forcedMultiUser, setForcedMultiUserState] = useState<ForcedMultiUser | null>(null);
  const forcedMultiUserRef = useRef<ForcedMultiUser | null>(null);
  const [forcedMultiLocks, setForcedMultiLocksState] = useState<Record<string, ForcedMultiUser | null>>({
    all: null,
    onsite: null,
    offsite: null
  });
  const forcedMultiLocksRef = useRef<Record<string, ForcedMultiUser | null>>({
    all: null,
    onsite: null,
    offsite: null
  });
  useEffect(() => {
    forcedMultiUserRef.current = forcedMultiUser;
  }, [forcedMultiUser]);

  // Single-User Mode States (Active when operatingMode === 'single' and lock is held)
  const [isSingleUserMode, setIsSingleUserMode] = useState<boolean>(false);
  const [singleUserLock, setSingleUserLock] = useState<SingleUserLock | null>(null);
  const [singleUserLocks, setSingleUserLocksState] = useState<Record<string, SingleUserLock | null>>({
    all: null,
    onsite: null,
    offsite: null
  });
  const singleUserLocksRef = useRef<Record<string, SingleUserLock | null>>({
    all: null,
    onsite: null,
    offsite: null
  });

  // In-memory local device undo stack (zero flash/SSD wear) - declared before undoSnapshots
  const localUndoStackRef = useRef<LocalUndoSnapshot[]>([]);

  // Reconstruct undo list directly from audit log (state.history) with zero latency and zero RAM duplication
  const undoSnapshots = useMemo<UndoSnapshotItem[]>(() => {
    if (isSingleUserMode && localUndoStackRef.current.length > 0) {
      return localUndoStackRef.current.map(s => ({
        id: s.id,
        historyId: s.historyId,
        actionType: s.actionType,
        description: s.description,
        timestamp: s.timestamp,
        user: s.user,
        targetId: s.targetId,
        createdAt: s.createdAt
      }));
    }
    if (!state.history || !Array.isArray(state.history)) return [];
    return state.history
      .filter(h => 
        h && 
        h.description && 
        !h.description.startsWith('Undid action:') && 
        !h.description.startsWith('Archived & purged') &&
        !h.description.startsWith('State restored')
      )
      .slice(0, 15)
      .map(h => ({
        id: h.id,
        historyId: h.id,
        actionType: (h as any).undoData?.type || 'AUDIT_LOG_ACTION',
        description: h.description,
        timestamp: h.timestamp,
        user: h.user || 'User',
        targetId: h.targetId,
        createdAt: new Date(h.timestamp).getTime() || Date.now()
      }));
  }, [state.history, isSingleUserMode]);
  const [hasUnsyncedLocalChanges, setHasUnsyncedLocalChanges] = useState<boolean>(false);
  const [breakInCountdown, setBreakInCountdown] = useState<number | null>(null);

  const getToken = () => 'ha-token-bypass';

  // Refs to maintain latest states for stable hook callbacks
  const stateRef = useRef<InventoryState>(state);
  const undoStackRef = useRef<InventoryState[]>(undoStack);
  const redoStackRef = useRef<InventoryState[]>(redoStack);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    undoStackRef.current = undoStack;
  }, [undoStack]);

  useEffect(() => {
    redoStackRef.current = redoStack;
  }, [redoStack]);

  // Request queueing mechanism to prevent concurrent DB state races
  const pendingCountRef = useRef<number>(0);
  const queuePromiseRef = useRef<Promise<any>>(Promise.resolve());
  const rollbackStateRef = useRef<InventoryState | null>(null);

  const pushLocalUndo = useCallback((action: Action, prevState: InventoryState, nextState?: InventoryState) => {
    if (!action || action.type === 'UNDO' || action.type === 'PURGE_HISTORY' || action.type === 'REPLACE_STATE') return;
    const desc = getActionDescription(action);
    const snapId = 'snap-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const histId = 'hist-' + Date.now();
    const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';

    // Compute only changed slices if nextState is provided to avoid 6MB RAM retention per snapshot
    const changedSlices: Partial<InventoryState> = {};
    if (nextState) {
      const sliceKeys: (keyof InventoryState)[] = [
        'meatCuts', 'containers', 'freezers', 'products', 'categories',
        'pallets', 'boxes', 'customLists', 'tags', 'locations',
        'movementOrders', 'offSiteEntries', 'butcherOrders'
      ];
      for (const k of sliceKeys) {
        if (prevState[k] !== nextState[k]) {
          (changedSlices as any)[k] = prevState[k];
        }
      }
    }

    const hasSlices = Object.keys(changedSlices).length > 0;
    const entry: LocalUndoSnapshot = {
      id: snapId,
      historyId: histId,
      actionType: action.type,
      description: desc,
      timestamp: new Date().toISOString(),
      user: storedUserName,
      targetId: (action as any).payload?.id || (action as any).payload?.meatCutId || '',
      changedSlices: hasSlices ? changedSlices : undefined,
      state: !hasSlices ? prevState : undefined,
      createdAt: Date.now()
    };

    localUndoStackRef.current = [entry, ...localUndoStackRef.current].slice(0, 15);
  }, []);

  // Debounced server sync refs
  const globalDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingQuantityUpdatesRef = useRef<Record<string, number>>({});
  const inFlightQuantityUpdatesRef = useRef<Record<string, number>>({});
  const latestLocalQuantityRef = useRef<Record<string, { quantity: number; timestamp: number }>>({});
  const lastEditingPingRef = useRef<number>(0);

  const movementDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMovementUpdatesRef = useRef<Record<string, any>>({});

  const listToggleDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingListToggleUpdatesRef = useRef<Record<string, {
    listId: string;
    productId: string;
    notes?: string;
    forceState?: boolean;
    controlSource?: any;
    threshold?: number;
  }>>({});

  // Helper to send an action to the server with sequential request queueing
  const sendActionToServer = useCallback(async (action: Action): Promise<boolean> => {
    const token = getToken();

    // Capture baseline state to roll back to if transaction sequence fails
    if (pendingCountRef.current === 0) {
      rollbackStateRef.current = stateRef.current;
    }

    // Track in-flight sequential requests
    pendingCountRef.current += 1;
    setIsSaving(true);
    setIsPendingSync(true);

    // Chain the API calls to process sequentially with retry and network resilience
    const promise = queuePromiseRef.current.then(async () => {
      try {
        const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || '';
        const auditHeaders = getClientAuditHeaders();
        const res = await fetchWithRetry(getApiUrl('api/inventory/action'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Client-Id': clientIdRef.current,
            ...auditHeaders,
            ...(storedUserName ? { 'X-User-Name': storedUserName } : {})
          },
          body: JSON.stringify({ action })
        }, 3, 350, 10000);

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: res.statusText }));
          const errMsg = errData.message || errData.error || 'Failed to apply change on the server.';
          const errorObj = new Error(errMsg);
          (errorObj as any).details = errData.details || errData.error || errMsg;
          (errorObj as any).actionType = action?.type;
          (errorObj as any).isReadOnlyPreview = errData.error === 'READ_ONLY_PREVIEW_MODE' || errData.isPreviewMode || errMsg.includes('Live Preview Mode');
          (errorObj as any).isSingleUserLocked = errData.error === 'SINGLE_USER_LOCKED';
          if (errData.error === 'SINGLE_USER_LOCKED' && errData.holderName) {
            setSingleUserLock({
              clientId: 'locked_holder',
              holderName: errData.holderName,
              acquiredAt: Date.now(),
              lastActiveAt: Date.now(),
              scope: errData.scope || 'all'
            });
          }
          throw errorObj;
        }

        const updatedState = await res.json();
        return updatedState;
      } catch (err: any) {
        if (!err.isReadOnlyPreview && !err.isSingleUserLocked && !err.message?.includes('READ_ONLY_PREVIEW_MODE') && !err.message?.includes('Live Preview Mode')) {
          console.warn('Action server sync issue:', err.message);
        }
        throw err;
      }
    });

    // Capture failures gracefully and keep the queue chain moving forward
    queuePromiseRef.current = promise.catch(() => {});

    // Sync client state with the final server state once all pending operations are done
    return new Promise<boolean>((resolve) => {
      promise.then((updatedState) => {
        pendingCountRef.current -= 1;

        if (pendingCountRef.current === 0) {
          setIsSaving(false);
          const hasRemainingPending = Object.keys(pendingQuantityUpdatesRef.current).length > 0 || 
                                      Object.keys(pendingMovementUpdatesRef.current).length > 0 || 
                                      Object.keys(pendingListToggleUpdatesRef.current).length > 0;
          setHasPendingChanges(hasRemainingPending);
          setIsPendingSync(hasRemainingPending);

          const rollbackState = rollbackStateRef.current;
          if (rollbackState && isSingleUserMode) {
            pushLocalUndo(action, rollbackState, updatedState);
          }

          // Merge any pending or in-flight local quantity updates on top of updatedState to prevent race overwrites
          const affectedTables = (updatedState as any)?._affectedTables;
          let finalState = reconcileStateReferences(stateRef.current, updatedState, affectedTables);
          const pendingQtyKeys = Object.keys(pendingQuantityUpdatesRef.current);
          const inFlightQtyKeys = Object.keys(inFlightQuantityUpdatesRef.current);
          const activeLocalKeys = new Set([...pendingQtyKeys, ...inFlightQtyKeys]);

          if (activeLocalKeys.size > 0) {
            const cutsMap = new Map<string, any>();
            (finalState.meatCuts || []).forEach((mc: any) => cutsMap.set(mc.id, { ...mc }));

            // Also check stateRef for any cut that might have been removed by server while in-flight
            (stateRef.current.meatCuts || []).forEach((mc: any) => {
              if (activeLocalKeys.has(mc.id) && !cutsMap.has(mc.id)) {
                cutsMap.set(mc.id, { ...mc });
              }
            });

            activeLocalKeys.forEach((cutId) => {
              const localPending = pendingQuantityUpdatesRef.current[cutId];
              const localInFlight = inFlightQuantityUpdatesRef.current[cutId];
              const localVal = localPending !== undefined ? localPending : localInFlight;

              if (localVal !== undefined) {
                if (cutsMap.has(cutId)) {
                  cutsMap.get(cutId).quantity = localVal;
                }
              }
            });

            finalState = {
              ...finalState,
              meatCuts: Array.from(cutsMap.values()).filter((mc: any) => mc.quantity > 0)
            };
          }

          if (pendingCountRef.current === 0 && pendingQtyKeys.length === 0) {
            latestLocalQuantityRef.current = {};
          }
          const pendingMovementKeys = Object.keys(pendingMovementUpdatesRef.current);
          if (pendingMovementKeys.length > 0) {
            finalState = {
              ...finalState,
              movementOrders: (finalState.movementOrders || []).map((o: any) => {
                if (pendingMovementUpdatesRef.current[o.id]) {
                  return { ...o, ...pendingMovementUpdatesRef.current[o.id] };
                }
                return o;
              })
            };
          }

          stateRef.current = finalState;
          setState(finalState);
          rollbackStateRef.current = null;
        }
        resolve(true);
      }).catch((err) => {
        pendingCountRef.current -= 1;

        if (pendingCountRef.current === 0) {
          setIsSaving(false);
          const hasRemainingPending = Object.keys(pendingQuantityUpdatesRef.current).length > 0 || 
                                      Object.keys(pendingMovementUpdatesRef.current).length > 0 || 
                                      Object.keys(pendingListToggleUpdatesRef.current).length > 0;
          setHasPendingChanges(hasRemainingPending);
          setIsPendingSync(hasRemainingPending);

          if (err.isReadOnlyPreview || err.message?.includes('READ_ONLY_PREVIEW_MODE') || err.message?.includes('Live Preview Mode')) {
            window.dispatchEvent(new CustomEvent('read-only-preview-attempt', { detail: { message: err.message } }));
          } else if (err.isSingleUserLocked || err.message?.includes('SINGLE_USER_LOCKED')) {
            const rollbackState = rollbackStateRef.current;
            if (rollbackState) {
              setState(rollbackState);
            }
            rollbackStateRef.current = null;
            window.dispatchEvent(new CustomEvent('action-error-occurred', {
              detail: {
                message: err.message || 'Single-User Lock active.',
                details: err.details,
                actionType: err.actionType
              }
            }));
          } else {
            const isNetworkFailure = (typeof navigator !== 'undefined' && !navigator.onLine) ||
              err.name === 'AbortError' ||
              err.message?.includes('Failed to fetch') ||
              err.message?.includes('Network request failed') ||
              err.message?.includes('NetworkError');

            if (isNetworkFailure) {
              // Graceful offline queueing: keep optimistic changes in memory and flag unsaved state
              console.warn('Network unavailable during sync; local updates preserved.');
              setHasPendingChanges(true);
              setIsPendingSync(true);
              rollbackStateRef.current = null;
            } else {
              const rollbackState = rollbackStateRef.current;
              if (rollbackState) {
                setState(rollbackState);
              }
              rollbackStateRef.current = null;
              window.dispatchEvent(new CustomEvent('action-error-occurred', {
                detail: {
                  message: err.message || 'Failed to apply change on the server.',
                  details: err.details,
                  actionType: err.actionType
                }
              }));
            }
          }
        }
        resolve(false);
      });
    });
  }, []);

  // Flush all pending debounced updates (quantities, movement orders, list toggles)
  const flushAllPendingSyncs = useCallback(async () => {
    const pendingQtyKeys = Object.keys(pendingQuantityUpdatesRef.current);
    const pendingMovementKeys = Object.keys(pendingMovementUpdatesRef.current);
    const pendingListToggleKeys = Object.keys(pendingListToggleUpdatesRef.current);

    if (pendingQtyKeys.length === 0 && pendingMovementKeys.length === 0 && pendingListToggleKeys.length === 0) {
      setHasPendingChanges(false);
      setIsPendingSync(false);
      setIsSaving(false);
      return true;
    }

    if (globalDebounceTimerRef.current) {
      clearTimeout(globalDebounceTimerRef.current);
      globalDebounceTimerRef.current = null;
    }
    if (movementDebounceTimerRef.current) {
      clearTimeout(movementDebounceTimerRef.current);
      movementDebounceTimerRef.current = null;
    }
    if (listToggleDebounceTimerRef.current) {
      clearTimeout(listToggleDebounceTimerRef.current);
      listToggleDebounceTimerRef.current = null;
    }

    setIsSaving(true);
    setIsPendingSync(true);

    try {
      // 1. Flush quantity updates
      if (pendingQtyKeys.length > 0) {
        const updatesToSync = { ...pendingQuantityUpdatesRef.current };
        pendingQuantityUpdatesRef.current = {};
        Object.assign(inFlightQuantityUpdatesRef.current, updatesToSync);

        try {
          await sendActionToServer({
            type: 'BATCH_UPDATE_MEAT_QUANTITY',
            payload: { updates: updatesToSync }
          });
        } finally {
          for (const k of Object.keys(updatesToSync)) {
            delete inFlightQuantityUpdatesRef.current[k];
          }
        }
      }

      // 2. Flush movement updates
      if (pendingMovementKeys.length > 0) {
        const movementUpdatesToSync = { ...pendingMovementUpdatesRef.current };
        pendingMovementUpdatesRef.current = {};

        for (const orderId of Object.keys(movementUpdatesToSync)) {
          await sendActionToServer({
            type: 'UPDATE_MOVEMENT_ORDER',
            payload: { id: orderId, updates: movementUpdatesToSync[orderId] }
          });
        }
      }

      // 3. Flush list toggle updates
      if (pendingListToggleKeys.length > 0) {
        const listUpdatesToSync = Object.values(pendingListToggleUpdatesRef.current);
        pendingListToggleUpdatesRef.current = {};

        await sendActionToServer({
          type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST',
          payload: { updates: listUpdatesToSync }
        });
      }
    } catch (err) {
      console.error('Error during flushAllPendingSyncs:', err);
    } finally {
      const remainingQtyKeys = Object.keys(pendingQuantityUpdatesRef.current);
      const remainingMovementKeys = Object.keys(pendingMovementUpdatesRef.current);
      const remainingListToggleKeys = Object.keys(pendingListToggleUpdatesRef.current);

      const stillHasPending = remainingQtyKeys.length > 0 || remainingMovementKeys.length > 0 || remainingListToggleKeys.length > 0;
      setHasPendingChanges(stillHasPending);
      setIsSaving(stillHasPending || pendingCountRef.current > 0);
      setIsPendingSync(stillHasPending || pendingCountRef.current > 0);
    }
    return true;
  }, [sendActionToServer]);

  // Flush any pending debounced quantity updates instantly to the server
  const flushPendingUpdates = useCallback(async () => {
    return flushAllPendingSyncs();
  }, [flushAllPendingSyncs]);

  // Flush any pending debounced movement updates instantly to the server
  const flushPendingMovementUpdates = useCallback(async () => {
    return flushAllPendingSyncs();
  }, [flushAllPendingSyncs]);

  // Flush any pending debounced list toggle updates instantly to the server
  const flushPendingListToggleUpdates = useCallback(async () => {
    return flushAllPendingSyncs();
  }, [flushAllPendingSyncs]);

  // Lightweight undo snapshot synchronizer - derived dynamically from state.history
  const fetchUndoSnapshots = useCallback(async () => {
    // No-op: undoSnapshots is derived automatically from audit log state.history
  }, []);

  // Execute undo action with optional snapshot or history ID
  const executeUndo = useCallback(async (snapshotId?: string, historyId?: string) => {
    setIsUndoing(true);
    try {
      // 1. Single-User Mode: execute 100% locally in device memory with zero server roundtrips
      if (isSingleUserMode) {
        const localStack = localUndoStackRef.current;
        if (localStack.length === 0) {
          return {
            success: false,
            error: 'No local actions available to undo.'
          };
        }
        let targetIndex = 0;
        if (snapshotId) {
          targetIndex = localStack.findIndex(s => s.id === snapshotId);
        } else if (historyId) {
          targetIndex = localStack.findIndex(s => s.historyId === historyId || s.targetId === historyId);
        }
        if (targetIndex < 0) targetIndex = 0;
        const targetEntry = localStack[targetIndex];
        const restoredState = { ...stateRef.current };
        if (targetEntry.changedSlices && Object.keys(targetEntry.changedSlices).length > 0) {
          Object.assign(restoredState, JSON.parse(JSON.stringify(targetEntry.changedSlices)));
        } else if (targetEntry.state) {
          Object.assign(restoredState, JSON.parse(JSON.stringify(targetEntry.state)));
        }

        const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
        const undoAuditDesc = `Undid action: "${targetEntry.description}" (performed locally)`;
        restoredState.history = [
          {
            id: 'hist-' + Date.now(),
            timestamp: new Date().toISOString(),
            description: undoAuditDesc,
            targetId: targetEntry.targetId || 'local-undo',
            user: storedUserName
          },
          ...(restoredState.history || [])
        ];

        localUndoStackRef.current = localStack.slice(targetIndex + 1);
        setState(restoredState);
        try {
          localStorage.setItem('freezer_single_user_cache', JSON.stringify({ state: restoredState, timestamp: Date.now() }));
          setHasUnsyncedLocalChanges(true);
        } catch (e) {}

        return {
          success: true,
          undoneDescription: targetEntry.description
        };
      }

      // Pre-check: if no specific target is given and history has no entries, return early
      if (!snapshotId && !historyId && (!stateRef.current.history || stateRef.current.history.length === 0)) {
        return {
          success: false,
          error: 'No recent actions available to undo in audit log.'
        };
      }

      // 2. Normal mode: invoke audit-log reconstruction on server
      const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || '';
      const auditHeaders = getClientAuditHeaders();
      const res = await fetchWithRetry(getApiUrl('api/inventory/undo'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': clientIdRef.current,
          ...auditHeaders,
          ...(storedUserName ? { 'X-User-Name': storedUserName } : {})
        },
        body: JSON.stringify({ snapshotId, historyId })
      }, 2, 300, 10000);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: res.statusText }));
        return {
          success: false,
          error: errData?.error || 'No undoable action found in audit log.'
        };
      }
      const data = await res.json().catch(() => ({ error: 'Invalid response from server' }));
      if (data.state) {
        setState(data.state);
      }
      if (localUndoStackRef.current.length > 0) {
        localUndoStackRef.current = localUndoStackRef.current.slice(1);
      }
      return {
        success: true,
        undoneDescription: data.undoneDescription || data.message || 'Action undone successfully'
      };
    } catch (err: any) {
      console.warn('Undo request could not be processed:', err.message);
      return {
        success: false,
        error: err.message || 'Failed to undo action'
      };
    } finally {
      setIsUndoing(false);
    }
  }, [isSingleUserMode]);

  // Fetch the active state from the API
  const fetchState = useCallback(async (showSpinner = false) => {
    // Avoid clobbering in-flight network actions during background refreshes
    if (!showSpinner && pendingCountRef.current > 0) {
      return;
    }

    if (showSpinner) {
      latestLocalQuantityRef.current = {};
      setIsLoading(true);
    }
    const token = getToken();
    try {
      const res = await fetchWithRetry(`${getApiUrl('api/inventory')}?_t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store'
      }, 3, 300, 10000);
      if (!res.ok) {
        throw new Error('Failed to retrieve inventory from server.');
      }
      const data = await res.json();
      
      // Preserve any pending local debounced changes or in-flight updates
      const affectedTables = (data as any)?._affectedTables;
      let finalData = reconcileStateReferences(stateRef.current, data, affectedTables);
      const pendingQtyKeys = Object.keys(pendingQuantityUpdatesRef.current);
      const inFlightQtyKeys = Object.keys(inFlightQuantityUpdatesRef.current);
      const activeLocalKeys = new Set([...pendingQtyKeys, ...inFlightQtyKeys]);

      if (activeLocalKeys.size > 0) {
        const cutsMap = new Map<string, any>();
        (finalData.meatCuts || []).forEach((mc: any) => cutsMap.set(mc.id, { ...mc }));

        (stateRef.current.meatCuts || []).forEach((mc: any) => {
          if (activeLocalKeys.has(mc.id) && !cutsMap.has(mc.id)) {
            cutsMap.set(mc.id, { ...mc });
          }
        });

        activeLocalKeys.forEach((cutId) => {
          const localPending = pendingQuantityUpdatesRef.current[cutId];
          const localInFlight = inFlightQuantityUpdatesRef.current[cutId];
          const localVal = localPending !== undefined ? localPending : localInFlight;

          if (localVal !== undefined && cutsMap.has(cutId)) {
            cutsMap.get(cutId).quantity = localVal;
          }
        });

        finalData = {
          ...finalData,
          meatCuts: Array.from(cutsMap.values()).filter((mc: any) => mc.quantity > 0)
        };
      }

      const pendingMovementKeys = Object.keys(pendingMovementUpdatesRef.current);
      if (pendingMovementKeys.length > 0) {
        finalData = {
          ...finalData,
          movementOrders: (finalData.movementOrders || []).map((o: any) => {
            if (pendingMovementUpdatesRef.current[o.id]) {
              return { ...o, ...pendingMovementUpdatesRef.current[o.id] };
            }
            return o;
          })
        };
      }

      stateRef.current = finalData;
      setState(finalData);
      setError(null);
      fetchUndoSnapshots().catch(() => {});
    } catch (err: any) {
      setError(err.message || 'Error occurred fetching inventory.');
    } finally {
      setIsLoading(false);
      setHasLoadedInitial(true);
    }
  }, [fetchUndoSnapshots]);

  // Dispatch an action with instant client updates and debounced server sync for quantities and movement orders
  const dispatch = useCallback(async (action: Action): Promise<boolean> => {
    // Non-blocking flush of pending updates when triggering other non-batched actions
    const hasPendingQty = Object.keys(pendingQuantityUpdatesRef.current).length > 0;
    const hasPendingMovement = Object.keys(pendingMovementUpdatesRef.current).length > 0;
    const hasPendingList = Object.keys(pendingListToggleUpdatesRef.current).length > 0;
    if ((hasPendingQty || hasPendingMovement || hasPendingList) && 
        action.type !== 'UPDATE_MEAT_QUANTITY' && 
        action.type !== 'UPDATE_MOVEMENT_ORDER' && 
        action.type !== 'TOGGLE_PRODUCT_ON_LIST' && 
        action.type !== 'BATCH_TOGGLE_PRODUCTS_ON_LIST' &&
        action.type !== 'APPEND_MOVEMENT_ORDER_IDS' &&
        action.type !== 'REMOVE_MOVEMENT_ORDER_IDS') {
      flushAllPendingSyncs().catch(() => {});
    }

    // Persistent Undo implementation integrated with DB
    if (action.type === 'UNDO') {
      const snapshotId = (action as any).payload?.snapshotId;
      const historyId = (action as any).payload?.historyId;
      const res = await executeUndo(snapshotId, historyId);
      return res.success;
    }

    if (action.type === 'REDO') {
      const currentRedoStack = redoStackRef.current;
      if (currentRedoStack.length === 0) return false;
      const next = currentRedoStack[currentRedoStack.length - 1];
      const newStack = currentRedoStack.slice(0, -1);

      const success = await sendActionToServer({ type: 'REPLACE_STATE', payload: next });
      if (success) {
        setUndoStack(prevUndo => [...prevUndo, stateRef.current].slice(-10));
        setRedoStack(newStack);
        return true;
      }
      return false;
    }

    // Queue quantity updates for debounced batch syncing
    if (action.type === 'UPDATE_MEAT_QUANTITY') {
      pushLocalUndo(action, stateRef.current);
      const { meatCutId, newQuantity } = action.payload;

      // In-flight race protection: record synchronous local user intent with timestamp
      latestLocalQuantityRef.current[meatCutId] = {
        quantity: newQuantity,
        timestamp: Date.now()
      };

      setState(prev => {
        const updatedMeatCuts = prev.meatCuts.map(m => 
          m.id === meatCutId ? { ...m, quantity: newQuantity } : m
        ).filter(m => m.quantity > 0);

        let updatedContainers = prev.containers;
        const targetCut = prev.meatCuts.find(m => m.id === meatCutId);
        if (targetCut && newQuantity === 0) {
          const containerId = targetCut.containerId;
          const remains = updatedMeatCuts.some(mc => mc.containerId === containerId);
          if (!remains) {
            const container = prev.containers.find(c => c.id === containerId);
            if (container && container.deleteOnEmpty) {
              updatedContainers = prev.containers.filter(c => c.id !== containerId);
            }
          }
        }

        const next = {
          ...prev,
          meatCuts: updatedMeatCuts,
          containers: updatedContainers
        };
        stateRef.current = next;
        return next;
      });

      // Debounce the server synchronization across all quantity changes
      if (globalDebounceTimerRef.current) {
        clearTimeout(globalDebounceTimerRef.current);
      }

      pendingQuantityUpdatesRef.current[meatCutId] = newQuantity;
      setHasPendingChanges(true);
      setIsPendingSync(true);

      // In Collaborative or Forced Multi-User Mode, notify others
      const isCollab = isCollaborativeModeRef.current || activeClientCountRef.current > 1 || operatingModeRef.current === 'multi';
      if (isCollab) {
        const now = Date.now();
        if (now - lastEditingPingRef.current > 1000) {
          lastEditingPingRef.current = now;
          fetch(getApiUrl('api/inventory/editing'), {
            method: 'POST',
            headers: {
              'x-client-id': clientIdRef.current
            }
          }).catch(() => {});
        }
      }

      // Always schedule rapid debounced server sync (800ms in multi/collab, 1200ms in solo)
      if (globalDebounceTimerRef.current) {
        clearTimeout(globalDebounceTimerRef.current);
      }
      globalDebounceTimerRef.current = setTimeout(flushAllPendingSyncs, isCollab ? 800 : 1200);

      return Promise.resolve(true);
    }

    // Queue movement order updates for debounced batch syncing
    if (action.type === 'UPDATE_MOVEMENT_ORDER') {
      pushLocalUndo(action, stateRef.current);
      const { id, updates } = action.payload;

      setState(prev => {
        const orders = prev.movementOrders || [];
        const updatedOrders = orders.map(o => o.id === id ? { ...o, ...updates } : o);
        return {
          ...prev,
          movementOrders: updatedOrders
        };
      });

      pendingMovementUpdatesRef.current[id] = {
        ...(pendingMovementUpdatesRef.current[id] || {}),
        ...updates
      };
      setHasPendingChanges(true);
      setIsPendingSync(true);

      lastUserActivityRef.current = Date.now();
      const isCollabMovement = isCollaborativeModeRef.current || activeClientCountRef.current > 1 || operatingModeRef.current === 'multi';
      if (movementDebounceTimerRef.current) {
        clearTimeout(movementDebounceTimerRef.current);
      }
      movementDebounceTimerRef.current = setTimeout(flushAllPendingSyncs, isCollabMovement ? 800 : 1200);

      return Promise.resolve(true);
    }

    if (action.type === 'APPEND_MOVEMENT_ORDER_IDS') {
      const { id, pickedBoxIds = [], pickedItemIds = [], deliveredBoxIds = [], deliveredItemIds = [] } = action.payload;

      let finalPickedBoxIds: string[] = [];
      let finalPickedItemIds: string[] = [];
      let finalDeliveredBoxIds: string[] = [];
      let finalDeliveredItemIds: string[] = [];

      setState(prev => {
        const orders = prev.movementOrders || [];
        const updatedOrders = orders.map(o => {
          if (o.id !== id) return o;
          finalPickedBoxIds = Array.from(new Set([...(o.pickedBoxIds || []), ...pickedBoxIds]));
          finalPickedItemIds = Array.from(new Set([...(o.pickedItemIds || []), ...pickedItemIds]));
          finalDeliveredBoxIds = Array.from(new Set([...(o.deliveredBoxIds || []), ...deliveredBoxIds]));
          finalDeliveredItemIds = Array.from(new Set([...(o.deliveredItemIds || []), ...deliveredItemIds]));
          return {
            ...o,
            pickedBoxIds: finalPickedBoxIds,
            pickedItemIds: finalPickedItemIds,
            deliveredBoxIds: finalDeliveredBoxIds,
            deliveredItemIds: finalDeliveredItemIds
          };
        });
        return {
          ...prev,
          movementOrders: updatedOrders
        };
      });

      if (movementDebounceTimerRef.current) {
        clearTimeout(movementDebounceTimerRef.current);
      }

      pendingMovementUpdatesRef.current[id] = {
        ...(pendingMovementUpdatesRef.current[id] || {}),
        pickedBoxIds: finalPickedBoxIds,
        pickedItemIds: finalPickedItemIds,
        deliveredBoxIds: finalDeliveredBoxIds,
        deliveredItemIds: finalDeliveredItemIds
      };
      setHasPendingChanges(true);
      setIsPendingSync(true);

      movementDebounceTimerRef.current = setTimeout(flushPendingMovementUpdates, 50); // 50ms instant debounce for scanner

      return Promise.resolve(true);
    }

    if (action.type === 'REMOVE_MOVEMENT_ORDER_IDS') {
      const { id, pickedBoxIds = [], pickedItemIds = [], deliveredBoxIds = [], deliveredItemIds = [] } = action.payload;

      let finalPickedBoxIds: string[] = [];
      let finalPickedItemIds: string[] = [];
      let finalDeliveredBoxIds: string[] = [];
      let finalDeliveredItemIds: string[] = [];

      setState(prev => {
        const orders = prev.movementOrders || [];
        const updatedOrders = orders.map(o => {
          if (o.id !== id) return o;
          finalPickedBoxIds = (o.pickedBoxIds || []).filter(x => !pickedBoxIds.includes(x));
          finalPickedItemIds = (o.pickedItemIds || []).filter(x => !pickedItemIds.includes(x));
          finalDeliveredBoxIds = (o.deliveredBoxIds || []).filter(x => !deliveredBoxIds.includes(x));
          finalDeliveredItemIds = (o.deliveredItemIds || []).filter(x => !deliveredItemIds.includes(x));
          return {
            ...o,
            pickedBoxIds: finalPickedBoxIds,
            pickedItemIds: finalPickedItemIds,
            deliveredBoxIds: finalDeliveredBoxIds,
            deliveredItemIds: finalDeliveredItemIds
          };
        });
        return {
          ...prev,
          movementOrders: updatedOrders
        };
      });

      if (movementDebounceTimerRef.current) {
        clearTimeout(movementDebounceTimerRef.current);
      }

      pendingMovementUpdatesRef.current[id] = {
        ...(pendingMovementUpdatesRef.current[id] || {}),
        pickedBoxIds: finalPickedBoxIds,
        pickedItemIds: finalPickedItemIds,
        deliveredBoxIds: finalDeliveredBoxIds,
        deliveredItemIds: finalDeliveredItemIds
      };
      setHasPendingChanges(true);
      setIsPendingSync(true);

      movementDebounceTimerRef.current = setTimeout(flushPendingMovementUpdates, 50); // 50ms instant debounce for scanner

      return Promise.resolve(true);
    }

    // Instant optimistic client update for MOVE_CONTAINER
    if (action.type === 'EDIT_CONTAINER') {
      const { containerId, updates, applyGlobally } = action.payload;
      setState(prev => {
        const originalContainer = prev.containers.find(c => c.id === containerId);
        if (!originalContainer) return prev;
        const originalNameLower = originalContainer.name.trim().toLowerCase();
        const originalTplId = originalContainer.templateId;

        let updatedContainers = prev.containers;
        let updatedTemplates = prev.containerTemplates || [];

        if (applyGlobally) {
          updatedContainers = prev.containers.map(c => {
            const isSameName = c.name.trim().toLowerCase() === originalNameLower;
            const isSameTpl = originalTplId && c.templateId === originalTplId;
            if (c.id === containerId || isSameName || isSameTpl) {
              return { ...c, ...updates };
            }
            return c;
          });

          updatedTemplates = updatedTemplates.map(t => {
            if ((originalTplId && t.id === originalTplId) || t.name.trim().toLowerCase() === originalNameLower) {
              return {
                ...t,
                ...(updates.name ? { name: updates.name } : {}),
                ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl } : {})
              };
            }
            return t;
          });
        } else {
          const isTemplateContainer = !!originalTplId || (prev.containerTemplates || []).some(t => t.name.trim().toLowerCase() === originalNameLower);
          updatedContainers = prev.containers.map(c => {
            if (c.id === containerId) {
              return {
                ...c,
                ...updates,
                templateId: undefined,
                ...(isTemplateContainer ? { deleteOnEmpty: true } : {})
              };
            }
            return c;
          });
        }

        return {
          ...prev,
          containers: updatedContainers,
          containerTemplates: updatedTemplates
        };
      });

      return sendActionToServer(action);
    }

    if (action.type === 'DELETE_CONTAINER_TEMPLATE') {
      const { id } = action.payload;
      setState(prev => {
        const template = (prev.containerTemplates || []).find(t => t.id === id);
        const tplNameLower = template ? template.name.trim().toLowerCase() : '';
        return {
          ...prev,
          containerTemplates: (prev.containerTemplates || []).filter(t => t.id !== id),
          containers: prev.containers.map(c => {
            const matchesId = c.templateId === id;
            const matchesName = tplNameLower && c.name.trim().toLowerCase() === tplNameLower;
            if (matchesId || matchesName) {
              return { ...c, templateId: undefined, deleteOnEmpty: true };
            }
            return c;
          })
        };
      });

      return sendActionToServer(action);
    }

    if (action.type === 'EDIT_CONTAINER_TEMPLATE') {
      const { id, updates } = action.payload;
      setState(prev => ({
        ...prev,
        containerTemplates: (prev.containerTemplates || []).map(t => t.id === id ? { ...t, ...updates } : t),
        containers: prev.containers.map(c => c.templateId === id ? {
          ...c,
          name: updates.name !== undefined ? updates.name : c.name,
          imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : c.imageUrl
        } : c)
      }));

      return sendActionToServer(action);
    }

    if (action.type === 'ADD_CONTAINER_TEMPLATE') {
      const { id, name, imageUrl } = action.payload;
      const tplId = id || ('tpl_' + Math.random().toString(36).substring(2, 9));
      setState(prev => ({
        ...prev,
        containerTemplates: [
          ...(prev.containerTemplates || []),
          { id: tplId, name: name.trim(), imageUrl }
        ]
      }));

      return sendActionToServer(action);
    }

    if (action.type === 'DELETE_CONTAINER') {
      const { containerId } = action.payload;
      setState(prev => ({
        ...prev,
        containers: prev.containers.map(c => c.id === containerId ? { ...c, freezerId: undefined, isArchived: true } : c),
        meatCuts: prev.meatCuts.map(mc => mc.containerId === containerId ? { ...mc, containerId: 'staging_loose' } : mc)
      }));
      return sendActionToServer(action);
    }

    if (action.type === 'TOGGLE_CONTAINER_ARCHIVED') {
      const { containerId, isArchived } = action.payload;
      setState(prev => ({
        ...prev,
        containers: prev.containers.map(c => c.id === containerId ? { ...c, isArchived: !!isArchived } : c),
        meatCuts: isArchived
          ? prev.meatCuts.map(mc => mc.containerId === containerId ? { ...mc, containerId: 'staging_loose' } : mc)
          : prev.meatCuts
      }));
      return sendActionToServer(action);
    }

    if (action.type === 'DELETE_FREEZER') {
      const freezerId = action.payload.id;
      const looseId = freezerId + '_loose';
      setState(prev => ({
        ...prev,
        freezers: prev.freezers.filter(f => f.id !== freezerId),
        containers: prev.containers
          .filter(c => c.id !== looseId)
          .map(c => c.freezerId === freezerId ? { ...c, freezerId: undefined } : c),
        meatCuts: prev.meatCuts.map(mc => mc.containerId === looseId ? { ...mc, containerId: 'staging_loose' } : mc)
      }));
      return sendActionToServer(action);
    }

    if (action.type === 'MOVE_CONTAINER') {
      const { containerId, newFreezerId, emptyCuts } = action.payload;

      setState(prev => {
        let updatedMeatCuts = prev.meatCuts;
        let updatedContainers = prev.containers;

        if (emptyCuts) {
          updatedMeatCuts = prev.meatCuts.map(mc => 
            mc.containerId === containerId ? { ...mc, containerId: 'staging_loose' } : mc
          );
        }

        const targetContainer = prev.containers.find(c => c.id === containerId);
        if (targetContainer) {
          if (emptyCuts) {
            updatedContainers = prev.containers.map(c => 
              c.id === containerId ? { ...c, freezerId: undefined, isArchived: true } : c
            );
          } else {
            updatedContainers = prev.containers.map(c => 
              c.id === containerId ? { ...c, freezerId: newFreezerId } : c
            );
          }
        }

        return {
          ...prev,
          meatCuts: updatedMeatCuts,
          containers: updatedContainers
        };
      });

      return sendActionToServer(action);
    }

    // Instant optimistic client update for MOVE_MEAT_QUANTITY
    if (action.type === 'MOVE_MEAT_QUANTITY') {
      const { meatCutId, productId, newContainerId, quantity, sourceContainerId } = action.payload;

      setState(prev => {
        let sourceCut = prev.meatCuts.find(m => m.id === meatCutId);
        if (!sourceCut && sourceContainerId) {
          if (productId) {
            sourceCut = prev.meatCuts.find(m => m.containerId === sourceContainerId && m.productId === productId);
          } else {
            sourceCut = prev.meatCuts.find(m => m.containerId === sourceContainerId);
          }
        }
        if (!sourceCut && productId) {
          sourceCut = prev.meatCuts.find(m => m.productId === productId);
        }

        if (!sourceCut) return prev;
        const moveQty = Math.min(Number(quantity) || 0, sourceCut.quantity);
        if (moveQty <= 0) return prev;

        const resolvedSourceCutId = sourceCut.id;
        const actualSourceContainerId = sourceContainerId || sourceCut.containerId;
        const newSourceQty = sourceCut.quantity - moveQty;

        let updatedMeatCuts = prev.meatCuts
          .map(mc => mc.id === resolvedSourceCutId ? { ...mc, quantity: newSourceQty } : mc)
          .filter(mc => mc.quantity > 0);

        const destCut = updatedMeatCuts.find(mc => mc.containerId === newContainerId && mc.productId === sourceCut.productId);
        if (destCut) {
          updatedMeatCuts = updatedMeatCuts.map(mc => mc.id === destCut.id ? { ...mc, quantity: destCut.quantity + moveQty } : mc);
        } else {
          updatedMeatCuts = [
            ...updatedMeatCuts,
            {
              id: 'temp-' + Math.random().toString(36).substring(2, 9),
              productId: sourceCut.productId,
              containerId: newContainerId,
              quantity: moveQty,
              notes: sourceCut.notes,
              tagIds: sourceCut.tagIds ? [...sourceCut.tagIds] : []
            }
          ];
        }

        let updatedContainers = prev.containers;
        if (actualSourceContainerId && actualSourceContainerId !== 'staging_loose' && !actualSourceContainerId.endsWith('_loose')) {
          const remainingInSource = updatedMeatCuts.some(mc => mc.containerId === actualSourceContainerId);
          if (!remainingInSource) {
            updatedContainers = prev.containers.map(c => 
              c.id === actualSourceContainerId ? { ...c, freezerId: undefined, isArchived: true } : c
            );
          }
        }

        return {
          ...prev,
          meatCuts: updatedMeatCuts,
          containers: updatedContainers
        };
      });

      return sendActionToServer(action);
    }

    // Instant optimistic client update for MOVE_STAGING_TO_OFFSITE
    if (action.type === 'MOVE_STAGING_TO_OFFSITE') {
      setState(prev => {
        const stagedContainers = prev.containers.filter(c => !c.freezerId);
        const stagedContainerIds = new Set(stagedContainers.map(c => c.id));
        return {
          ...prev,
          containers: prev.containers.filter(c => c.freezerId),
          meatCuts: prev.meatCuts.filter(mc => mc.containerId !== 'staging_loose' && !stagedContainerIds.has(mc.containerId))
        };
      });

      return sendActionToServer(action);
    }

    // Optimistic update for TOGGLE_PRODUCT_ON_LIST to prevent checkbox lag and debounce syncing
    if (action.type === 'TOGGLE_PRODUCT_ON_LIST') {
      const { listId, productId, notes, forceState, controlSource, threshold } = action.payload;
      let finalForceState: boolean | undefined = undefined;

      setState(prev => {
        const lists = prev.customLists || [];
        const updatedLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          const exists = cl.items.some(item => item.productId === productId);
          const shouldHave = forceState !== undefined ? forceState : !exists;
          
          finalForceState = shouldHave;

          let nextItems = [...cl.items];
          if (shouldHave) {
            if (!exists) {
              const prod = prev.products?.find(p => p.id === productId);
              const defaultThreshold = prod?.listThresholds?.[listId];
              const defaultCS = prod?.listControlSources?.[listId] || 'onsite_count';
              nextItems.push({
                productId,
                notes: notes || '',
                addedAt: new Date().toISOString(),
                controlSource: controlSource || defaultCS,
                threshold: threshold !== undefined ? threshold : defaultThreshold,
                notifyEnabled: true
              });
            } else {
              nextItems = nextItems.map(item => {
                if (item.productId !== productId) return item;
                const updated = { ...item };
                if (notes !== undefined) updated.notes = notes;
                if (controlSource !== undefined) updated.controlSource = controlSource;
                if (threshold !== undefined) updated.threshold = threshold;
                return updated;
              });
            }
          } else {
            nextItems = nextItems.filter(item => item.productId !== productId);
          }
          
          return { ...cl, items: nextItems };
        });

        let updatedProducts = prev.products || [];
        if (threshold !== undefined) {
          updatedProducts = updatedProducts.map(p => {
            if (p.id !== productId) return p;
            const existingThresholds = { ...(p.listThresholds || {}) };
            if (threshold === null || threshold === undefined) {
              delete existingThresholds[listId];
            } else {
              existingThresholds[listId] = threshold;
            }
            return { ...p, listThresholds: existingThresholds };
          });
        }

        return {
          ...prev,
          customLists: updatedLists,
          products: updatedProducts
        };
      });

      if (listToggleDebounceTimerRef.current) {
        clearTimeout(listToggleDebounceTimerRef.current);
      }

      const key = `${listId}::${productId}`;
      pendingListToggleUpdatesRef.current[key] = {
        listId,
        productId,
        notes,
        forceState: finalForceState ?? forceState,
        controlSource,
        threshold
      };
      setHasPendingChanges(true);
      setIsPendingSync(true);

      lastUserActivityRef.current = Date.now();
      const isCollabToggle = isCollaborativeModeRef.current || activeClientCountRef.current > 1 || operatingModeRef.current === 'multi';
      if (listToggleDebounceTimerRef.current) {
        clearTimeout(listToggleDebounceTimerRef.current);
      }
      listToggleDebounceTimerRef.current = setTimeout(flushAllPendingSyncs, isCollabToggle ? 800 : 1200);

      return Promise.resolve(true);
    }

    // Optimistic update for UPDATE_LIST_ITEM_CONTROL_SOURCE
    if (action.type === 'UPDATE_LIST_ITEM_CONTROL_SOURCE') {
      const { listId, productId, controlSource } = action.payload;
      setState(prev => {
        const lists = prev.customLists || [];
        const updatedLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          return {
            ...cl,
            items: cl.items.map(item => item.productId === productId ? { ...item, controlSource } : item)
          };
        });
        return {
          ...prev,
          customLists: updatedLists
        };
      });

      return sendActionToServer(action);
    }

    // Optimistic update for UPDATE_LIST_ITEM_THRESHOLD
    if (action.type === 'UPDATE_LIST_ITEM_THRESHOLD') {
      const { listId, productId, threshold } = action.payload;
      setState(prev => {
        const lists = prev.customLists || [];
        const updatedLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          return {
            ...cl,
            items: cl.items.map(item => item.productId === productId ? { ...item, threshold } : item)
          };
        });

        const updatedProducts = (prev.products || []).map(p => {
          if (p.id !== productId) return p;
          const copy = { ...(p.listThresholds || {}) };
          if (threshold === null || threshold === undefined) {
            delete copy[listId];
          } else {
            copy[listId] = threshold;
          }
          return { ...p, listThresholds: copy };
        });

        return {
          ...prev,
          customLists: updatedLists,
          products: updatedProducts
        };
      });

      return sendActionToServer(action);
    }

    // Optimistic update for UPDATE_LIST_ITEM_NOTE
    if (action.type === 'UPDATE_LIST_ITEM_NOTE') {
      const { listId, productId, notes } = action.payload;
      setState(prev => {
        const lists = prev.customLists || [];
        const updatedLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          return {
            ...cl,
            items: cl.items.map(item => item.productId === productId ? { ...item, notes } : item)
          };
        });
        return {
          ...prev,
          customLists: updatedLists
        };
      });

      return sendActionToServer(action);
    }

    // Optimistic update for TOGGLE_LIST_ITEM_NOTIFICATION
    if (action.type === 'TOGGLE_LIST_ITEM_NOTIFICATION') {
      const { listId, productId, notifyEnabled } = action.payload;
      setState(prev => {
        const lists = prev.customLists || [];
        const updatedLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          return {
            ...cl,
            items: cl.items.map(item => item.productId === productId ? { ...item, notifyEnabled: !!notifyEnabled } : item)
          };
        });
        return {
          ...prev,
          customLists: updatedLists
        };
      });

      return sendActionToServer(action);
    }

    // Optimistic update for BATCH_TOGGLE_PRODUCTS_ON_LIST
    if (action.type === 'BATCH_TOGGLE_PRODUCTS_ON_LIST') {
      const { updates } = action.payload;
      setState(prev => {
        let currentLists = [...(prev.customLists || [])];
        let currentProducts = [...(prev.products || [])];

        for (const update of updates) {
          const { listId, productId, notes, forceState, controlSource, threshold } = update;
          currentLists = currentLists.map(cl => {
            if (cl.id !== listId) return cl;
            const exists = cl.items.some(item => item.productId === productId);
            const shouldHave = forceState !== undefined ? forceState : !exists;

            let nextItems = [...cl.items];
            if (shouldHave) {
              if (!exists) {
                const prod = currentProducts.find(p => p.id === productId);
                const defaultThreshold = prod?.listThresholds?.[listId];
                const defaultCS = prod?.listControlSources?.[listId] || 'onsite_count';
                nextItems.push({
                  productId,
                  notes: notes || '',
                  addedAt: new Date().toISOString(),
                  controlSource: controlSource || defaultCS,
                  threshold: (threshold !== undefined && threshold !== null) ? threshold : defaultThreshold,
                  notifyEnabled: true
                });
              } else {
                nextItems = nextItems.map(item => {
                  if (item.productId !== productId) return item;
                  const updated = { ...item };
                  if (notes !== undefined) updated.notes = notes;
                  if (controlSource !== undefined) updated.controlSource = controlSource;
                  if (threshold !== undefined) {
                    updated.threshold = threshold !== null ? threshold : undefined;
                  }
                  return updated;
                });
              }
            } else {
              nextItems = nextItems.filter(item => item.productId !== productId);
            }

            return { ...cl, items: nextItems };
          });

          if (threshold !== undefined) {
            currentProducts = currentProducts.map(p => {
              if (p.id !== productId) return p;
              const existingThresholds = { ...(p.listThresholds || {}) };
              if (threshold === null || threshold === undefined) {
                delete existingThresholds[listId];
              } else {
                existingThresholds[listId] = threshold;
              }
              return { ...p, listThresholds: existingThresholds };
            });
          }
        }

        return {
          ...prev,
          customLists: currentLists,
          products: currentProducts
        };
      });

      return sendActionToServer(action);
    }

    // For all other regular actions, send immediately
    return await sendActionToServer(action);
  }, [sendActionToServer, flushPendingUpdates, flushPendingMovementUpdates, flushPendingListToggleUpdates, pushLocalUndo, executeUndo]);

  // Sync auth and state fetches
  useEffect(() => {
    fetchState(true);
    fetchConnectedClients().catch(() => {});
    return () => {
      const token = getToken();
      const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || '';
      const auditHeaders = getClientAuditHeaders();
      const baseHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Client-Id': clientIdRef.current,
        ...auditHeaders,
        ...(storedUserName ? { 'X-User-Name': storedUserName } : {})
      };

      // Clear timers and sync remaining on unmount
      const pendingIds = Object.keys(pendingQuantityUpdatesRef.current);
      if (pendingIds.length > 0) {
        const updatesToSync = { ...pendingQuantityUpdatesRef.current };
        pendingQuantityUpdatesRef.current = {};

        if (globalDebounceTimerRef.current) {
          clearTimeout(globalDebounceTimerRef.current);
          globalDebounceTimerRef.current = null;
        }

        fetch(getApiUrl('api/inventory/action'), {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({
            action: {
              type: 'BATCH_UPDATE_MEAT_QUANTITY',
              payload: { updates: updatesToSync }
            }
          })
        }).catch(err => console.error('Failed to sync on unmount:', err));
      }

      const pendingMovementIds = Object.keys(pendingMovementUpdatesRef.current);
      if (pendingMovementIds.length > 0) {
        const movementUpdatesToSync = { ...pendingMovementUpdatesRef.current };
        pendingMovementUpdatesRef.current = {};

        if (movementDebounceTimerRef.current) {
          clearTimeout(movementDebounceTimerRef.current);
          movementDebounceTimerRef.current = null;
        }

        Object.keys(movementUpdatesToSync).forEach(orderId => {
          fetch(getApiUrl('api/inventory/action'), {
            method: 'POST',
            headers: baseHeaders,
            body: JSON.stringify({
              action: {
                type: 'UPDATE_MOVEMENT_ORDER',
                payload: { id: orderId, updates: movementUpdatesToSync[orderId] }
              }
            })
          }).catch(err => console.error('Failed to sync movement on unmount:', err));
        });
      }

      const pendingListToggleKeys = Object.keys(pendingListToggleUpdatesRef.current);
      if (pendingListToggleKeys.length > 0) {
        const listToggleUpdatesToSync = Object.values(pendingListToggleUpdatesRef.current);
        pendingListToggleUpdatesRef.current = {};

        if (listToggleDebounceTimerRef.current) {
          clearTimeout(listToggleDebounceTimerRef.current);
          listToggleDebounceTimerRef.current = null;
        }

        fetch(getApiUrl('api/inventory/action'), {
          method: 'POST',
          headers: baseHeaders,
          body: JSON.stringify({
            action: {
              type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST',
              payload: { updates: listToggleUpdatesToSync }
            }
          })
        }).catch(err => console.error('Failed to sync list toggles on unmount:', err));
      }
    };
  }, [fetchState]);

  // Single-User Mode API Actions
  const updateForcedMulti = useCallback((forced: ForcedMultiUser | null, forcedMultis?: Record<string, ForcedMultiUser | null>) => {
    if (forcedMultis) {
      setForcedMultiLocksState(forcedMultis);
      forcedMultiLocksRef.current = forcedMultis;
    }
    const curZone = activeZoneRef.current;
    let relevantForced: ForcedMultiUser | null = null;
    if (forcedMultis) {
      relevantForced = forcedMultis.all || forcedMultis[curZone] || null;
    } else if (forced) {
      const fScope = (forced as any).scope || 'all';
      if (fScope === 'all' || fScope === curZone || forced.setByClientId === clientIdRef.current) {
        relevantForced = forced;
      }
    }
    setForcedMultiUserState(relevantForced);
    forcedMultiUserRef.current = relevantForced;
    if (relevantForced && (relevantForced as any).enabled !== false) {
      if (!isSingleUserMode) {
        setOperatingModeState('multi');
        setIsCollaborativeMode(true);
      }
    } else {
      if (operatingModeRef.current === 'multi') {
        setOperatingModeState('auto');
        recalculateCollaborativeMode(null);
      }
    }
  }, [isSingleUserMode, setIsCollaborativeMode, recalculateCollaborativeMode]);

  const updateSingleUserLock = useCallback((lock: SingleUserLock | null, locksByZone?: Record<string, SingleUserLock | null>) => {
    if (locksByZone) {
      setSingleUserLocksState(locksByZone);
      singleUserLocksRef.current = locksByZone;
    }
    const curZone = activeZoneRef.current;
    let relevantLock: SingleUserLock | null = null;
    if (locksByZone) {
      relevantLock = locksByZone.all || locksByZone[curZone] || null;
    } else if (lock) {
      const lockScope = lock.scope || 'all';
      if (lockScope === 'all' || lockScope === curZone || lock.clientId === clientIdRef.current) {
        relevantLock = lock;
      }
    }

    setSingleUserLock(relevantLock);
    if (relevantLock) {
      if (relevantLock.clientId === clientIdRef.current) {
        setIsSingleUserMode(true);
        setOperatingModeState('single');
        localStorage.setItem('freezer_single_user_active', 'true');
        if (relevantLock.breakInRequest && relevantLock.breakInRequest.requestedByClientId !== clientIdRef.current) {
          setBreakInCountdown(prev => (prev === null ? 5 : prev));
        } else {
          setBreakInCountdown(null);
        }
      } else {
        setIsSingleUserMode(false);
        if (operatingModeRef.current === 'single') {
          if (forcedMultiUserRef.current) {
            setOperatingModeState('multi');
            setIsCollaborativeMode(true);
          } else {
            setOperatingModeState('auto');
          }
        }
        localStorage.removeItem('freezer_single_user_active');
        setBreakInCountdown(null);
      }
    } else {
      setIsSingleUserMode(false);
      if (operatingModeRef.current === 'single') {
        if (forcedMultiUserRef.current) {
          setOperatingModeState('multi');
          setIsCollaborativeMode(true);
        } else {
          setOperatingModeState('auto');
        }
      }
      localStorage.removeItem('freezer_single_user_active');
      setBreakInCountdown(null);
    }
  }, [setIsCollaborativeMode]);

  const claimSingleUserMode = useCallback(async (claimScope?: 'all' | 'onsite' | 'offsite'): Promise<{ success: boolean; message?: string }> => {
    const token = getToken();
    const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
    const scope = claimScope || activeZoneRef.current || 'onsite';
    // Optimistic UI state
    setIsSingleUserMode(true);
    setOperatingModeState('single');
    localStorage.setItem('freezer_single_user_active', 'true');

    try {
      const res = await fetchWithRetry(getApiUrl('api/single-user/claim'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current,
          'X-User-Name': storedUserName,
          'X-Client-Zone': activeZoneRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current, userName: storedUserName, scope })
      }, 2, 300, 8000);
      if (!res.ok) {
        setIsSingleUserMode(false);
        setOperatingModeState('auto');
        localStorage.removeItem('freezer_single_user_active');
        const errData = await res.json().catch(() => ({}));
        return { success: false, message: errData.message || 'Error claiming Single-User Mode' };
      }
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        updateSingleUserLock(data.lock, data.locks);
        if (data.forcedMultis !== undefined || data.forcedMulti !== undefined) {
          updateForcedMulti(data.forcedMulti, data.forcedMultis);
        }
        return { success: true };
      } else {
        // Roll back if claimed by another user
        setIsSingleUserMode(false);
        setOperatingModeState('auto');
        localStorage.removeItem('freezer_single_user_active');
        updateSingleUserLock(data.lock, data.locks);
        return { success: false, message: data.message || 'Single-User Mode is locked by another user.' };
      }
    } catch (err: any) {
      setIsSingleUserMode(false);
      setOperatingModeState('auto');
      localStorage.removeItem('freezer_single_user_active');
      return { success: false, message: err.message || 'Error claiming Single-User Mode' };
    }
  }, [updateSingleUserLock, updateForcedMulti]);

  const releaseSingleUserMode = useCallback(async (releaseScope?: 'all' | 'onsite' | 'offsite'): Promise<boolean> => {
    const token = getToken();
    const scope = releaseScope || activeZoneRef.current || 'onsite';
    // Instant optimistic update
    setIsSingleUserMode(false);
    setOperatingModeState('auto');
    setSingleUserLock(null);
    setBreakInCountdown(null);
    localStorage.removeItem('freezer_single_user_active');
    localStorage.removeItem('freezer_single_user_cache');
    setHasUnsyncedLocalChanges(false);

    try {
      flushAllPendingSyncs();
      const res = await fetchWithRetry(getApiUrl('api/single-user/release'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current,
          'X-Client-Zone': activeZoneRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current, scope })
      }, 2, 200, 6000);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.locks) {
          updateSingleUserLock(data.lock, data.locks);
        }
        if (data.forcedMultis) {
          updateForcedMulti(data.forcedMulti, data.forcedMultis);
        }
      }
      return res.ok;
    } catch (err) {
      console.warn('Failed to release Single-User Mode on server:', err);
      return false;
    }
  }, [flushAllPendingSyncs, updateSingleUserLock, updateForcedMulti]);

  const requestBreakIn = useCallback(async (scope?: 'all' | 'onsite' | 'offsite'): Promise<{ success: boolean; message?: string }> => {
    const token = getToken();
    const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'Another User';
    const targetScope = scope || activeZoneRef.current || 'onsite';
    try {
      const res = await fetchWithRetry(getApiUrl('api/single-user/request-break-in'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current,
          'X-User-Name': storedUserName,
          'X-Client-Zone': activeZoneRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current, userName: storedUserName, scope: targetScope })
      }, 2, 300, 8000);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return { success: false, message: errData.message || 'Failed to request break-in' };
      }
      const data = await res.json().catch(() => ({}));
      if (data && (data.locks || data.lock)) {
        updateSingleUserLock(data.lock, data.locks);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to request break-in' };
    }
  }, [updateSingleUserLock]);

  const cancelBreakIn = useCallback(async () => {
    const token = getToken();
    try {
      const res = await fetchWithRetry(getApiUrl('api/single-user/cancel-break-in'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current,
          'X-Client-Zone': activeZoneRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current, zone: activeZoneRef.current })
      }, 2, 200, 6000);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.locks) {
          updateSingleUserLock(null, data.locks);
        }
      }
      setBreakInCountdown(null);
    } catch (e) {}
  }, [updateSingleUserLock]);

  const forceReleaseSingleUserLock = useCallback(async () => {
    const token = getToken();
    try {
      await fetchWithRetry(getApiUrl('api/single-user/force-release'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current })
      }, 2, 200, 6000);
      setSingleUserLock(null);
      setIsSingleUserMode(false);
      setOperatingModeState('auto');
      setBreakInCountdown(null);
      localStorage.removeItem('freezer_single_user_active');
    } catch (e) {}
  }, []);

  // 3-Way Mode Controller: 'auto' | 'multi' | 'single'
  const setOperatingMode = useCallback(async (mode: OperatingMode, claimScope?: 'all' | 'onsite' | 'offsite'): Promise<{ success: boolean; message?: string }> => {
    const token = getToken();
    const currentUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
    const targetScope = claimScope || activeZoneRef.current || 'onsite';

    if (mode === operatingModeRef.current && !isSingleUserMode && !singleUserLock) {
      return { success: true };
    }

    if (mode === 'single') {
      const res = await claimSingleUserMode(targetScope);
      if (res.success) {
        setIsCollaborativeMode(false);
        setForcedMultiUserState(null);
        forcedMultiUserRef.current = null;
        return { success: true };
      } else {
        return res;
      }
    } else if (mode === 'multi') {
      setIsSingleUserMode(false);
      setSingleUserLock(null);
      setOperatingModeState('multi');
      setIsCollaborativeMode(true);
      const newForced: ForcedMultiUser = {
        enabled: true,
        setByClientId: clientIdRef.current,
        setByName: currentUserName,
        activatedAt: Date.now(),
        lastActiveAt: Date.now(),
        scope: targetScope
      };
      setForcedMultiUserState(newForced);
      forcedMultiUserRef.current = newForced;
      localStorage.removeItem('freezer_single_user_active');

      try {
        await releaseSingleUserMode('all');
      } catch (e) {}
      flushAllPendingSyncs().catch(() => {});

      // Broadcast change to server so all other connected devices switch to Multi mode
      try {
        const res = await fetchWithRetry(getApiUrl('api/operating-mode/set'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Client-Id': clientIdRef.current,
            'X-User-Name': currentUserName,
            'X-Client-Zone': activeZoneRef.current
          },
          body: JSON.stringify({ mode: 'multi', clientId: clientIdRef.current, userName: currentUserName, scope: targetScope })
        }, 2, 200, 6000);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.locks) {
            updateSingleUserLock(null, data.locks);
          }
          if (data.forcedMultis) {
            updateForcedMulti(data.forcedMulti, data.forcedMultis);
          }
        }
      } catch (e) {
        console.warn('Failed to notify server of multi mode:', e);
      }

      return { success: true };
    } else {
      // 'auto'
      setIsSingleUserMode(false);
      setOperatingModeState('auto');
      setSingleUserLock(null);
      setForcedMultiUserState(null);
      forcedMultiUserRef.current = null;
      setSingleUserLocksState({ all: null, onsite: null, offsite: null });
      singleUserLocksRef.current = { all: null, onsite: null, offsite: null };
      localStorage.removeItem('freezer_single_user_active');
      localStorage.removeItem('freezer_single_user_cache');
      recalculateCollaborativeMode(null);

      try {
        await releaseSingleUserMode('all');
      } catch (e) {}
      flushAllPendingSyncs().catch(() => {});

      // Broadcast change to server so all other connected devices revert to Auto mode
      try {
        const res = await fetchWithRetry(getApiUrl('api/operating-mode/set'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Client-Id': clientIdRef.current,
            'X-User-Name': currentUserName,
            'X-Client-Zone': activeZoneRef.current
          },
          body: JSON.stringify({ mode: 'auto', clientId: clientIdRef.current, userName: currentUserName, scope: 'all' })
        }, 2, 200, 6000);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.locks) {
            updateSingleUserLock(null, data.locks);
          }
          if (data.forcedMultis) {
            updateForcedMulti(null, data.forcedMultis);
          }
        }
      } catch (e) {
        console.warn('Failed to notify server of auto mode:', e);
      }

      return { success: true };
    }
  }, [isSingleUserMode, singleUserLock, claimSingleUserMode, releaseSingleUserMode, flushAllPendingSyncs, setIsCollaborativeMode, recalculateCollaborativeMode, updateSingleUserLock, updateForcedMulti]);

  // Break-In countdown timer effect (5s countdown)
  useEffect(() => {
    if (breakInCountdown === null) return;
    if (breakInCountdown <= 0) {
      releaseSingleUserMode();
      return;
    }
    const timer = setInterval(() => {
      setBreakInCountdown(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [breakInCountdown, releaseSingleUserMode]);

  // Periodic heartbeat when in Single-User Mode or holding Forced Multi Mode
  useEffect(() => {
    const isForcedMultiOwner = forcedMultiUser?.setByClientId === clientIdRef.current;
    if (!isSingleUserMode && !isForcedMultiOwner) return;
    const heartbeatInterval = setInterval(() => {
      const token = getToken();
      fetch(getApiUrl('api/single-user/heartbeat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current,
          'X-Client-Zone': activeZoneRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current, zone: activeZoneRef.current })
      }).then(res => (res.ok ? res.json().catch(() => null) : null)).then(data => {
        if (data && data.forcedMultis !== undefined) {
          updateForcedMulti(data.forcedMulti, data.forcedMultis);
        } else if (data && data.forcedMulti !== undefined) {
          updateForcedMulti(data.forcedMulti);
        }
        if (data && data.locks !== undefined) {
          updateSingleUserLock(data.lock, data.locks);
        }
      }).catch(() => {});
    }, 5000);

    return () => clearInterval(heartbeatInterval);
  }, [isSingleUserMode, forcedMultiUser, updateForcedMulti, updateSingleUserLock]);

  // Comprehensive Activity & Interaction Tracking (Clicks, Touches, Scrolling, Wheel, Typing, Menu/Route navigation)
  const lastUserActivityRef = useRef<number>(Date.now());
  useEffect(() => {
    const handleUserInteraction = () => {
      lastUserActivityRef.current = Date.now();
    };

    // Capture all interactions across document and window
    window.addEventListener('pointerdown', handleUserInteraction, { capture: true, passive: true });
    window.addEventListener('mousedown', handleUserInteraction, { capture: true, passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', handleUserInteraction, { capture: true, passive: true });
    window.addEventListener('input', handleUserInteraction, { capture: true, passive: true });
    window.addEventListener('change', handleUserInteraction, { capture: true, passive: true });
    window.addEventListener('scroll', handleUserInteraction, { capture: true, passive: true });
    window.addEventListener('wheel', handleUserInteraction, { capture: true, passive: true });
    window.addEventListener('popstate', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleUserInteraction, { capture: true } as any);
      window.removeEventListener('mousedown', handleUserInteraction, { capture: true } as any);
      window.removeEventListener('touchstart', handleUserInteraction, { capture: true } as any);
      window.removeEventListener('keydown', handleUserInteraction, { capture: true } as any);
      window.removeEventListener('input', handleUserInteraction, { capture: true } as any);
      window.removeEventListener('change', handleUserInteraction, { capture: true } as any);
      window.removeEventListener('scroll', handleUserInteraction, { capture: true } as any);
      window.removeEventListener('wheel', handleUserInteraction, { capture: true } as any);
      window.removeEventListener('popstate', handleUserInteraction);
    };
  }, []);

  // Smart Idle Watchdog: Syncs pending local changes only during collaborative/multi mode or extended 5-minute inactivity in Solo mode
  useEffect(() => {
    const idleCheckInterval = setInterval(() => {
      const pendingQtyKeys = Object.keys(pendingQuantityUpdatesRef.current);
      const pendingMovementKeys = Object.keys(pendingMovementUpdatesRef.current);
      const pendingListToggleKeys = Object.keys(pendingListToggleUpdatesRef.current);
      const hasPending = pendingQtyKeys.length > 0 || pendingMovementKeys.length > 0 || pendingListToggleKeys.length > 0;

      if (!hasPending) return;

      const idleDuration = Date.now() - lastUserActivityRef.current;
      const isCollab = isCollaborativeMode || activeClientCount > 1 || operatingMode === 'multi';
      if (isCollab) {
        if (idleDuration >= 1500) {
          flushAllPendingSyncs();
        }
      } else {
        // Solo/Single-User Default: Only sync after 5 minutes of total user inactivity
        if (idleDuration >= 5 * 60 * 1000) {
          flushAllPendingSyncs();
        }
      }
    }, 1000);

    return () => clearInterval(idleCheckInterval);
  }, [isCollaborativeMode, activeClientCount, operatingMode, flushAllPendingSyncs]);

  // Flush pending changes immediately when Collaborative Mode or Forced Multi is active
  useEffect(() => {
    if (isCollaborativeMode || activeClientCount > 1 || operatingMode === 'multi') {
      flushAllPendingSyncs().catch(() => {});
    }
  }, [isCollaborativeMode, activeClientCount, operatingMode, flushAllPendingSyncs]);

  // Forced Mode Inactivity Watchdog: Automatically reverts forced Single-User or Multi-User mode to Auto after 5 minutes of inactivity
  useEffect(() => {
    if (operatingMode === 'auto') return;
    const autoTimeoutInterval = setInterval(() => {
      const idleTime = Date.now() - lastUserActivityRef.current;
      if (idleTime >= 5 * 60 * 1000) {
        console.log(`Operating mode "${operatingMode}" auto-timed out after 5m inactivity. Reverting to Auto mode.`);
        if (operatingMode === 'single') {
          releaseSingleUserMode();
        } else if (operatingMode === 'multi') {
          setOperatingModeState('auto');
          setIsCollaborativeMode(false);
          flushAllPendingSyncs().catch(() => {});
        }
      }
    }, 10000);

    return () => clearInterval(autoTimeoutInterval);
  }, [operatingMode, releaseSingleUserMode, flushAllPendingSyncs]);

  // Active Client Heartbeat: Continuously updates server lastActive every 4s ONLY while tab is visible
  useEffect(() => {
    const sendHeartbeat = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      const token = getToken();
      const userName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
      fetch(getApiUrl('api/inventory/clients/heartbeat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current,
          'X-User-Name': userName,
          'X-Client-Zone': activeZoneRef.current,
          'X-Client-View': activeViewRef.current,
          ...getClientAuditHeaders()
        },
        body: JSON.stringify({
          clientId: clientIdRef.current,
          userName,
          zone: activeZoneRef.current,
          currentView: activeViewRef.current
        })
      }).then(res => res.ok ? res.json().catch(() => null) : null).then(data => {
        if (data && data.zoneCounts) {
          setZoneClientCounts(data.zoneCounts);
          recalculateCollaborativeMode(undefined, data.zoneCounts);
        }
      }).catch(() => {});
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 4000);
    return () => clearInterval(heartbeatInterval);
  }, [setZoneClientCounts, recalculateCollaborativeMode]);

  // Immediate view/zone change heartbeat trigger
  useEffect(() => {
    recalculateCollaborativeMode();
    const token = getToken();
    const userName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
    fetch(getApiUrl('api/inventory/clients/heartbeat'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Client-Id': clientIdRef.current,
        'X-User-Name': userName,
        'X-Client-Zone': activeZone,
        'X-Client-View': activeView,
        ...getClientAuditHeaders()
      },
      body: JSON.stringify({
        clientId: clientIdRef.current,
        userName,
        zone: activeZone,
        currentView: activeView
      })
    }).then(res => res.ok ? res.json().catch(() => null) : null).then(data => {
      if (data && data.zoneCounts) {
        setZoneClientCounts(data.zoneCounts);
        recalculateCollaborativeMode(undefined, data.zoneCounts);
      }
    }).catch(() => {});
  }, [activeZone, activeView, recalculateCollaborativeMode, setZoneClientCounts]);

  // Screen timeout / Sleep / Tab Background / Blur & Focus Synchronization Triggers
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Immediately flush any pending debounced updates when screen sleeps or tab backgrounds
        flushAllPendingSyncs();

        // In Single-User Mode, sync state to server while keeping lock active
        if (isSingleUserMode) {
          const token = getToken();
          fetch(getApiUrl('api/single-user/sync-state'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Client-Id': clientIdRef.current
            },
            body: JSON.stringify({ clientId: clientIdRef.current, fullState: stateRef.current })
          }).catch(() => {});
        } else {
          // In Auto/Multi mode, send a quick departure notification so other users immediately return to Single mode
          try {
            const leaveUrl = getApiUrl('api/inventory/clients/leave');
            const payload = JSON.stringify({ clientId: clientIdRef.current });
            if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
              const blob = new Blob([payload], { type: 'application/json' });
              navigator.sendBeacon(leaveUrl, blob);
            } else {
              fetch(leaveUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientIdRef.current },
                body: payload,
                keepalive: true
              }).catch(() => {});
            }
          } catch (e) {}
        }
      } else if (document.visibilityState === 'visible') {
        // On screen wake / return to tab: immediately touch client heartbeat and refresh state
        const token = getToken();
        const userName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
        fetch(getApiUrl('api/inventory/clients/heartbeat'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Client-Id': clientIdRef.current,
            'X-User-Name': userName,
            ...getClientAuditHeaders()
          },
          body: JSON.stringify({ clientId: clientIdRef.current, userName })
        }).catch(() => {});

        const pendingQtyKeys = Object.keys(pendingQuantityUpdatesRef.current);
        const pendingMovementKeys = Object.keys(pendingMovementUpdatesRef.current);
        const pendingListToggleKeys = Object.keys(pendingListToggleUpdatesRef.current);
        const hasPending = pendingQtyKeys.length > 0 || pendingMovementKeys.length > 0 || pendingListToggleKeys.length > 0;
        if (!hasPending && !isSingleUserMode) {
          fetchState(false);
        }
      }
    };

    const handlePageHide = () => {
      flushAllPendingSyncs();
      try {
        const leaveUrl = getApiUrl('api/inventory/clients/leave');
        const payload = JSON.stringify({ clientId: clientIdRef.current });
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(leaveUrl, blob);
        } else {
          fetch(leaveUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientIdRef.current },
            body: payload,
            keepalive: true
          }).catch(() => {});
        }
      } catch (e) {}
    };

    const handleOnline = () => {
      // When network reconnects, automatically attempt to flush any pending syncs and refresh state
      flushAllPendingSyncs().catch(() => {});
      if (!isSingleUserMode) {
        fetchState(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      window.removeEventListener('online', handleOnline);
      handlePageHide();
    };
  }, [isSingleUserMode, flushAllPendingSyncs, fetchState]);

  const inFlightClientsFetchRef = useRef<Promise<ConnectedClientInfo[]> | null>(null);
  const lastClientsFetchTimeRef = useRef<number>(0);
  const clientsBackoffUntilRef = useRef<number>(0);
  const connectedClientsRef = useRef<ConnectedClientInfo[]>(connectedClients);

  useEffect(() => {
    connectedClientsRef.current = connectedClients;
  }, [connectedClients]);

  const fetchConnectedClients = useCallback(async (force = false): Promise<ConnectedClientInfo[]> => {
    const now = Date.now();
    // If rate-limited or backed off, avoid calling server until cooldown expires
    if (!force && now < clientsBackoffUntilRef.current) {
      return connectedClientsRef.current;
    }

    // Throttle background calls to at most once every 12 seconds
    if (!force && now - lastClientsFetchTimeRef.current < 12000) {
      return connectedClientsRef.current;
    }

    // Return in-flight request if one is already pending
    if (inFlightClientsFetchRef.current) {
      return inFlightClientsFetchRef.current;
    }

    const fetchPromise = (async () => {
      try {
        lastClientsFetchTimeRef.current = Date.now();
        const token = getToken();
        const userName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
        const res = await fetch(getApiUrl('api/inventory/clients'), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Client-Id': clientIdRef.current,
            'X-User-Name': userName,
            'X-Client-Zone': activeZoneRef.current,
            'X-Client-View': activeViewRef.current,
            ...getClientAuditHeaders()
          }
        });

        if (res.status === 429) {
          // Rate limited: back off for 30 seconds
          clientsBackoffUntilRef.current = Date.now() + 30000;
          return connectedClientsRef.current;
        }

        if (!res.ok) {
          return connectedClientsRef.current;
        }

        const text = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch {
          // Non-JSON response (e.g. rate limit text, proxy error) - back off for 20s
          clientsBackoffUntilRef.current = Date.now() + 20000;
          return connectedClientsRef.current;
        }

        if (data && data.clients && Array.isArray(data.clients)) {
          setConnectedClients(data.clients);
          const count = data.count ?? data.clients.length;
          setActiveClientCount(count);
          let zCounts: ZoneClientCounts = data.zoneCounts;
          if (!zCounts) {
            let onsite = 0;
            let offsite = 0;
            for (const c of data.clients) {
              if (c.zone === 'offsite') offsite++;
              else onsite++;
            }
            zCounts = { total: count, onsite, offsite };
          }
          setZoneClientCounts(zCounts);
          if (data.forcedMulti !== undefined) {
            updateForcedMulti(data.forcedMulti);
          }
          recalculateCollaborativeMode(data.forcedMulti, zCounts);
          return data.clients;
        }
        return connectedClientsRef.current;
      } catch (err: any) {
        // Network / fetch error or offline - silently back off without spamming console
        clientsBackoffUntilRef.current = Date.now() + 15000;
        return connectedClientsRef.current;
      } finally {
        inFlightClientsFetchRef.current = null;
      }
    })();

    inFlightClientsFetchRef.current = fetchPromise;
    return fetchPromise;
  }, [setActiveClientCount, setIsCollaborativeMode, updateForcedMulti]);

  const disconnectClient = useCallback(async (targetClientId: string): Promise<boolean> => {
    try {
      const res = await fetch(getApiUrl(`api/inventory/clients/disconnect/${encodeURIComponent(targetClientId)}`), {
        method: 'POST'
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        setConnectedClients(prev => prev.filter(c => c.id !== targetClientId));
        if (data.count !== undefined) {
          setActiveClientCount(data.count);
          if (data.count <= 1) {
            setIsCollaborativeMode(false);
          }
        }
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Failed to disconnect client:', err);
      return false;
    }
  }, [setActiveClientCount, setIsCollaborativeMode]);

  const forceSyncAllClients = useCallback(async (): Promise<{ success: boolean; count: number }> => {
    try {
      // Immediately flush our own local pending changes first
      await flushAllPendingSyncs();
      const res = await fetch(getApiUrl('api/inventory/clients/force-sync'), {
        method: 'POST'
      });
      if (!res.ok) return { success: false, count: activeClientCountRef.current };
      const data = await res.json().catch(() => null);
      await fetchState(true);
      return { success: !!data?.success, count: data?.count ?? activeClientCountRef.current };
    } catch (err) {
      console.warn('Failed to force sync all clients:', err);
      return { success: false, count: activeClientCountRef.current };
    }
  }, [flushAllPendingSyncs, fetchState]);

  // Proactive background presence polling (every 30s) to keep client count and multi-user recognition in sync as safety net
  useEffect(() => {
    const clientsPollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchConnectedClients().catch(() => {});
    }, 30000);
    return () => clearInterval(clientsPollInterval);
  }, [fetchConnectedClients]);

  // Window Focus trigger: refresh client count when switching windows or returning to the browser
  useEffect(() => {
    const handleFocus = () => {
      if (!isSingleUserMode) {
        fetchConnectedClients().catch(() => {});
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isSingleUserMode, fetchConnectedClients]);

  return {
    state,
    dispatch,
    isLoading,
    hasLoadedInitial,
    error,
    hasPendingChanges,
    isSaving,
    isPendingSync,
    clientId: clientIdRef.current,
    refreshState: fetchState,
    undoStack,
    redoStack,
    undoSnapshots,
    undoSnapshotCount: undoSnapshots.length,
    fetchUndoSnapshots,
    executeUndo,
    isUndoing,
    operatingMode,
    setOperatingMode,
    forcedMultiUser,
    updateForcedMulti,
    isSingleUserMode,
    singleUserLock,
    singleUserLocks,
    forcedMultiLocks,
    claimSingleUserMode,
    releaseSingleUserMode,
    requestBreakIn,
    cancelBreakIn,
    forceReleaseSingleUserLock,
    updateSingleUserLock,
    hasUnsyncedLocalChanges,
    breakInCountdown,
    setBreakInCountdown,
    isCollaborativeMode,
    setIsCollaborativeMode,
    activeClientCount,
    setActiveClientCount,
    connectedClients,
    setConnectedClients,
    fetchConnectedClients,
    disconnectClient,
    forceSyncAllClients,
    flushAllPendingSyncs,
    zoneClientCounts,
    setZoneClientCounts,
    activeZone,
    activeZoneClientCount,
    recalculateCollaborativeMode
  };
};
