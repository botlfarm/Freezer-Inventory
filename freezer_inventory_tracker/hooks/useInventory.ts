import { useState, useEffect, useCallback, useRef } from 'react';
import { InventoryState, Action } from '../types';
import { getApiUrl } from './apiUrl';

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
  breakInRequest?: {
    requestedByClientId: string;
    requestedByName: string;
    requestedAt: number;
  } | null;
}

export const useInventory = () => {
  const clientIdRef = useRef<string>(
    (() => {
      try {
        let savedId = localStorage.getItem('freezer_client_id');
        if (!savedId) {
          savedId = 'c_' + Math.random().toString(36).substring(2, 15);
          localStorage.setItem('freezer_client_id', savedId);
        }
        return savedId;
      } catch {
        return 'c_' + Math.random().toString(36).substring(2, 15);
      }
    })()
  );
  const [state, setState] = useState<InventoryState>(defaultInitialState);
  const [undoStack, setUndoStack] = useState<InventoryState[]>([]);
  const [redoStack, setRedoStack] = useState<InventoryState[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isPendingSync, setIsPendingSync] = useState<boolean>(false);

  // Single-User Mode States
  const [isSingleUserMode, setIsSingleUserMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('freezer_single_user_active') === 'true';
    } catch {
      return false;
    }
  });
  const [singleUserLock, setSingleUserLock] = useState<SingleUserLock | null>(null);
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

  // Debounced server sync refs
  const globalDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingQuantityUpdatesRef = useRef<Record<string, number>>({});
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

    // Chain the API calls to process sequentially
    const promise = queuePromiseRef.current.then(async () => {
      try {
        const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || '';
        const res = await fetch(getApiUrl('api/inventory/action'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Client-Id': clientIdRef.current,
            ...(storedUserName ? { 'X-User-Name': storedUserName } : {})
          },
          body: JSON.stringify({ action })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: res.statusText }));
          const errMsg = errData.message || errData.error || 'Failed to apply change on the server.';
          const errorObj = new Error(errMsg);
          (errorObj as any).details = errData.details || errData.error || errMsg;
          (errorObj as any).actionType = action?.type;
          (errorObj as any).isReadOnlyPreview = errData.error === 'READ_ONLY_PREVIEW_MODE' || errData.isPreviewMode || errMsg.includes('Live Preview Mode');
          throw errorObj;
        }

        const updatedState = await res.json();
        return updatedState;
      } catch (err: any) {
        if (!err.isReadOnlyPreview && !err.message?.includes('READ_ONLY_PREVIEW_MODE') && !err.message?.includes('Live Preview Mode')) {
          console.error('Action error:', err.message);
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
          const rollbackState = rollbackStateRef.current;
          if (rollbackState) {
            setUndoStack(prevStack => [...prevStack, rollbackState].slice(-10));
            setRedoStack([]);
          }
          setState(updatedState);
          rollbackStateRef.current = null;
        }
        resolve(true);
      }).catch((err) => {
        pendingCountRef.current -= 1;

        if (pendingCountRef.current === 0) {
          const rollbackState = rollbackStateRef.current;
          if (rollbackState) {
            setState(rollbackState);
          }
          rollbackStateRef.current = null;
          if (err.isReadOnlyPreview || err.message?.includes('READ_ONLY_PREVIEW_MODE') || err.message?.includes('Live Preview Mode')) {
            window.dispatchEvent(new CustomEvent('read-only-preview-attempt', { detail: { message: err.message } }));
          } else {
            window.dispatchEvent(new CustomEvent('action-error-occurred', {
              detail: {
                message: err.message || 'Failed to apply change on the server.',
                details: err.details,
                actionType: err.actionType
              }
            }));
          }
        }
        resolve(false);
      });
    });
  }, []);

  // Flush any pending debounced quantity updates instantly to the server
  const flushPendingUpdates = useCallback(async () => {
    const pendingIds = Object.keys(pendingQuantityUpdatesRef.current);
    if (pendingIds.length === 0) return;

    if (globalDebounceTimerRef.current) {
      clearTimeout(globalDebounceTimerRef.current);
      globalDebounceTimerRef.current = null;
    }

    const updatesToSync = { ...pendingQuantityUpdatesRef.current };
    pendingQuantityUpdatesRef.current = {};

    // Only keep isPendingSync true if there are still pending other updates
    const hasOthers = Object.keys(pendingMovementUpdatesRef.current).length > 0 || Object.keys(pendingListToggleUpdatesRef.current).length > 0;
    setIsPendingSync(hasOthers);

    await sendActionToServer({
      type: 'BATCH_UPDATE_MEAT_QUANTITY',
      payload: { updates: updatesToSync }
    });
  }, [sendActionToServer]);

  // Flush any pending debounced movement updates instantly to the server
  const flushPendingMovementUpdates = useCallback(async () => {
    const pendingIds = Object.keys(pendingMovementUpdatesRef.current);
    if (pendingIds.length === 0) return;

    if (movementDebounceTimerRef.current) {
      clearTimeout(movementDebounceTimerRef.current);
      movementDebounceTimerRef.current = null;
    }

    const updatesToSync = { ...pendingMovementUpdatesRef.current };
    pendingMovementUpdatesRef.current = {};

    // Only keep isPendingSync true if there are still pending other updates
    const hasOthers = Object.keys(pendingQuantityUpdatesRef.current).length > 0 || Object.keys(pendingListToggleUpdatesRef.current).length > 0;
    setIsPendingSync(hasOthers);

    for (const orderId of Object.keys(updatesToSync)) {
      await sendActionToServer({
        type: 'UPDATE_MOVEMENT_ORDER',
        payload: { id: orderId, updates: updatesToSync[orderId] }
      });
    }
  }, [sendActionToServer]);

  // Flush any pending debounced list toggle updates instantly to the server
  const flushPendingListToggleUpdates = useCallback(async () => {
    const keys = Object.keys(pendingListToggleUpdatesRef.current);
    if (keys.length === 0) return;

    if (listToggleDebounceTimerRef.current) {
      clearTimeout(listToggleDebounceTimerRef.current);
      listToggleDebounceTimerRef.current = null;
    }

    const updatesToSync = Object.values(pendingListToggleUpdatesRef.current);
    pendingListToggleUpdatesRef.current = {};

    // Only keep isPendingSync true if there are still pending other updates
    const hasOthers = Object.keys(pendingQuantityUpdatesRef.current).length > 0 || Object.keys(pendingMovementUpdatesRef.current).length > 0;
    setIsPendingSync(hasOthers);

    await sendActionToServer({
      type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST',
      payload: { updates: updatesToSync }
    });
  }, [sendActionToServer]);

  // Global Inactivity Tracker: Delays batch sync during active scrolling/touching
  useEffect(() => {
    const handleActivity = () => {
      // Only delay if we actually have pending updates waiting to sync
      if (Object.keys(pendingQuantityUpdatesRef.current).length > 0) {
        if (globalDebounceTimerRef.current) {
          clearTimeout(globalDebounceTimerRef.current);
          globalDebounceTimerRef.current = setTimeout(flushPendingUpdates, 2000);
        }
      }
      if (Object.keys(pendingMovementUpdatesRef.current).length > 0) {
        if (movementDebounceTimerRef.current) {
          clearTimeout(movementDebounceTimerRef.current);
          movementDebounceTimerRef.current = setTimeout(flushPendingMovementUpdates, 2000);
        }
      }
      if (Object.keys(pendingListToggleUpdatesRef.current).length > 0) {
        if (listToggleDebounceTimerRef.current) {
          clearTimeout(listToggleDebounceTimerRef.current);
          listToggleDebounceTimerRef.current = setTimeout(flushPendingListToggleUpdates, 2000);
        }
      }
    };

    window.addEventListener('scroll', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [flushPendingUpdates, flushPendingMovementUpdates, flushPendingListToggleUpdates]);

  // Fetch the active state from the API
  const fetchState = useCallback(async (showSpinner = false) => {
    const token = getToken();
    if (showSpinner) {
      setIsLoading(true);
    }
    try {
      const res = await fetch(getApiUrl('api/inventory'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Failed to retrieve inventory from server.');
      }
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error occurred fetching inventory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Dispatch an action with instant client updates and debounced server sync for quantities and movement orders
  const dispatch = useCallback(async (action: Action): Promise<boolean> => {
    // Non-blocking flush of pending updates when triggering other actions
    if (action.type !== 'UPDATE_MEAT_QUANTITY') {
      flushPendingUpdates().catch(() => {});
    }
    if (action.type !== 'UPDATE_MOVEMENT_ORDER') {
      flushPendingMovementUpdates().catch(() => {});
    }
    if (action.type !== 'TOGGLE_PRODUCT_ON_LIST' && action.type !== 'BATCH_TOGGLE_PRODUCTS_ON_LIST') {
      flushPendingListToggleUpdates().catch(() => {});
    }

    // Local client-side Undo/Redo implementation integrated with DB
    if (action.type === 'UNDO') {
      const currentUndoStack = undoStackRef.current;
      if (currentUndoStack.length === 0) return false;
      const prev = currentUndoStack[currentUndoStack.length - 1];
      const newStack = currentUndoStack.slice(0, -1);

      const success = await sendActionToServer({ type: 'REPLACE_STATE', payload: prev });
      if (success) {
        setRedoStack(prevRedo => [...prevRedo, stateRef.current].slice(-10));
        setUndoStack(newStack);
        return true;
      }
      return false;
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
      const { meatCutId, newQuantity } = action.payload;

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

        return {
          ...prev,
          meatCuts: updatedMeatCuts,
          containers: updatedContainers
        };
      });

      // Debounce the server synchronization across all quantity changes
      if (globalDebounceTimerRef.current) {
        clearTimeout(globalDebounceTimerRef.current);
      }

      pendingQuantityUpdatesRef.current[meatCutId] = newQuantity;
      setIsPendingSync(true);

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

      globalDebounceTimerRef.current = setTimeout(flushPendingUpdates, 2000); // 2000ms global debounce interval

      return Promise.resolve(true);
    }

    // Queue movement order updates for debounced batch syncing
    if (action.type === 'UPDATE_MOVEMENT_ORDER') {
      const { id, updates } = action.payload;

      setState(prev => {
        const orders = prev.movementOrders || [];
        const updatedOrders = orders.map(o => o.id === id ? { ...o, ...updates } : o);
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
        ...updates
      };
      setIsPendingSync(true);

      movementDebounceTimerRef.current = setTimeout(flushPendingMovementUpdates, 2000); // 2000ms global debounce interval

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
      setIsPendingSync(true);

      movementDebounceTimerRef.current = setTimeout(flushPendingMovementUpdates, 2000);

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
      setIsPendingSync(true);

      movementDebounceTimerRef.current = setTimeout(flushPendingMovementUpdates, 2000);

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

    if (action.type === 'MOVE_CONTAINER') {
      const { containerId, newFreezerId, emptyCuts } = action.payload;

      setState(prev => {
        let updatedMeatCuts = prev.meatCuts;
        let updatedContainers = prev.containers;

        if (emptyCuts) {
          updatedMeatCuts = prev.meatCuts.filter(mc => mc.containerId !== containerId);
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
      setIsPendingSync(true);

      listToggleDebounceTimerRef.current = setTimeout(flushPendingListToggleUpdates, 2000);

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
  }, [sendActionToServer, flushPendingUpdates, flushPendingMovementUpdates, flushPendingListToggleUpdates]);

  // Sync auth and state fetches
  useEffect(() => {
    fetchState(true);
    return () => {
      const token = getToken();
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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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
  const claimSingleUserMode = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    const token = getToken();
    const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
    try {
      const res = await fetch(getApiUrl('api/single-user/claim'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current,
          'X-User-Name': storedUserName
        },
        body: JSON.stringify({ clientId: clientIdRef.current, userName: storedUserName })
      });
      const data = await res.json();
      if (data.success) {
        setIsSingleUserMode(true);
        setSingleUserLock(data.lock);
        localStorage.setItem('freezer_single_user_active', 'true');
        try {
          localStorage.setItem('freezer_single_user_cache', JSON.stringify({ state: stateRef.current, timestamp: Date.now() }));
        } catch (e) {}
        return { success: true };
      } else {
        setSingleUserLock(data.lock);
        return { success: false, message: data.message || 'Single-User Mode is locked by another user.' };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Error claiming Single-User Mode' };
    }
  }, []);

  const releaseSingleUserMode = useCallback(async (fullStateToSync?: InventoryState): Promise<boolean> => {
    const token = getToken();
    try {
      const stateToSave = fullStateToSync || stateRef.current;
      const res = await fetch(getApiUrl('api/single-user/sync-and-release'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current, fullState: stateToSave })
      });
      const data = await res.json();
      if (data.state) {
        setState(data.state);
      }
      setIsSingleUserMode(false);
      setSingleUserLock(null);
      setBreakInCountdown(null);
      localStorage.removeItem('freezer_single_user_active');
      localStorage.removeItem('freezer_single_user_cache');
      setHasUnsyncedLocalChanges(false);
      return true;
    } catch (err) {
      console.error('Failed to release Single-User Mode:', err);
      return false;
    }
  }, []);

  const requestBreakIn = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    const token = getToken();
    const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'Another User';
    try {
      const res = await fetch(getApiUrl('api/single-user/request-break-in'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current,
          'X-User-Name': storedUserName
        },
        body: JSON.stringify({ clientId: clientIdRef.current, userName: storedUserName })
      });
      const data = await res.json();
      if (data.lock) {
        setSingleUserLock(data.lock);
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to request break-in' };
    }
  }, []);

  const cancelBreakIn = useCallback(async () => {
    const token = getToken();
    try {
      await fetch(getApiUrl('api/single-user/cancel-break-in'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current })
      });
      setBreakInCountdown(null);
    } catch (e) {}
  }, []);

  const updateSingleUserLock = useCallback((lock: SingleUserLock | null) => {
    setSingleUserLock(lock);
    if (lock) {
      if (lock.clientId === clientIdRef.current) {
        setIsSingleUserMode(true);
        localStorage.setItem('freezer_single_user_active', 'true');
        if (lock.breakInRequest && lock.breakInRequest.requestedByClientId !== clientIdRef.current) {
          setBreakInCountdown(prev => (prev === null ? 5 : prev));
        } else {
          setBreakInCountdown(null);
        }
      } else {
        setIsSingleUserMode(false);
        localStorage.removeItem('freezer_single_user_active');
        setBreakInCountdown(null);
      }
    } else {
      setIsSingleUserMode(false);
      localStorage.removeItem('freezer_single_user_active');
      setBreakInCountdown(null);
    }
  }, []);

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

  // Periodic heartbeat when in Single-User Mode
  useEffect(() => {
    if (!isSingleUserMode) return;
    const heartbeatInterval = setInterval(() => {
      const token = getToken();
      fetch(getApiUrl('api/single-user/heartbeat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Id': clientIdRef.current
        },
        body: JSON.stringify({ clientId: clientIdRef.current })
      }).catch(() => {});
    }, 15000);

    return () => clearInterval(heartbeatInterval);
  }, [isSingleUserMode]);

  // User Inactivity & Auto-Sync when idle for 5+ minutes
  const lastUserActivityRef = useRef<number>(Date.now());
  useEffect(() => {
    const handleUserInteraction = () => {
      lastUserActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    if (!isSingleUserMode) return;
    const idleCheckInterval = setInterval(() => {
      const idleTime = Date.now() - lastUserActivityRef.current;
      if (idleTime >= 5 * 60 * 1000) {
        console.log('User idle for 5 minutes in Single-User mode. Syncing state and releasing lock...');
        releaseSingleUserMode();
      }
    }, 10000);

    return () => clearInterval(idleCheckInterval);
  }, [isSingleUserMode, releaseSingleUserMode]);

  // Tab blur / window hidden auto-sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isSingleUserMode) {
        console.log('App tab lost focus/hidden in Single-User Mode. Auto-syncing state to server...');
        const token = getToken();
        fetch(getApiUrl('api/single-user/sync-and-release'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Client-Id': clientIdRef.current
          },
          body: JSON.stringify({ clientId: clientIdRef.current, fullState: stateRef.current })
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isSingleUserMode]);

  // Cache state changes locally in Single-User mode
  useEffect(() => {
    if (isSingleUserMode && state !== defaultInitialState) {
      try {
        localStorage.setItem('freezer_single_user_cache', JSON.stringify({ state, timestamp: Date.now() }));
        setHasUnsyncedLocalChanges(true);
      } catch (e) {}
    }
  }, [state, isSingleUserMode]);

  return {
    state,
    dispatch,
    isLoading,
    error,
    isPendingSync,
    clientId: clientIdRef.current,
    refreshState: fetchState,
    undoStack,
    redoStack,
    isSingleUserMode,
    singleUserLock,
    claimSingleUserMode,
    releaseSingleUserMode,
    requestBreakIn,
    cancelBreakIn,
    updateSingleUserLock,
    hasUnsyncedLocalChanges,
    breakInCountdown,
    setBreakInCountdown
  };
};
