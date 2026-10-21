import { InventoryState, MeatCut, Container, HistoryEntry, Product } from '../types';

export interface UserAuditMeta {
  user?: string;
  clientDevice?: string;
  clientInfo?: string;
}

/**
 * Check if a meat cut matches a given variant by product, notes, tags, and original/wrong labels.
 */
export function isSameVariant(
  cut: { productId: string; notes?: string; tagIds?: string[]; originalCutName?: string; wrongLabel?: string },
  productId: string,
  notes?: string,
  tagIds?: string[],
  originalCutName?: string,
  wrongLabel?: string
): boolean {
  if (cut.productId !== productId) return false;

  const normCutNotes = (cut.notes || '').trim();
  const normTargetNotes = (notes || '').trim();
  if (normCutNotes !== normTargetNotes) return false;

  const normCutOrig = (cut.originalCutName || '').trim();
  const normTargetOrig = (originalCutName || '').trim();
  if (normCutOrig !== normTargetOrig) return false;

  const normCutWrong = (cut.wrongLabel || '').trim();
  const normTargetWrong = (wrongLabel || '').trim();
  if (normCutWrong !== normTargetWrong) return false;

  const cutTags = [...(cut.tagIds || [])].sort().join(',');
  const targetTags = [...(tagIds || [])].sort().join(',');
  if (cutTags !== targetTags) return false;

  return true;
}

/**
 * Consolidate duplicate meat cuts with matching variant signatures within a single container.
 */
export function consolidateMeatCutsInContainer(containerId: string, state: InventoryState): InventoryState {
  if (!containerId || !state || !state.meatCuts) return state;
  const cutsInContainer = (state.meatCuts || []).filter(mc => mc.containerId === containerId && mc.quantity > 0);
  if (cutsInContainer.length <= 1) return state;

  const groupMap = new Map<string, MeatCut[]>();

  for (const cut of cutsInContainer) {
    const normNotes = (cut.notes || '').trim();
    const sortedTagIds = [...(cut.tagIds || [])].sort().join(',');
    const normOrig = (cut.originalCutName || '').trim();
    const normWrong = (cut.wrongLabel || '').trim();
    const key = `${cut.productId}|||${normNotes}|||${sortedTagIds}|||${normOrig}|||${normWrong}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(cut);
  }

  let hasDuplicates = false;
  const otherCuts = (state.meatCuts || []).filter(mc => mc.containerId !== containerId);
  const consolidatedContainerCuts: MeatCut[] = [];

  for (const [, group] of groupMap.entries()) {
    if (group.length === 1) {
      consolidatedContainerCuts.push(group[0]);
    } else {
      hasDuplicates = true;
      const primaryCut = group[0];
      const totalQuantity = group.reduce((sum, item) => sum + item.quantity, 0);
      consolidatedContainerCuts.push({
        ...primaryCut,
        quantity: totalQuantity,
      });
    }
  }

  if (hasDuplicates) {
    return {
      ...state,
      meatCuts: [...otherCuts, ...consolidatedContainerCuts],
    };
  }
  return state;
}

/**
 * Helper to build an audit history entry.
 */
export function createHistoryEntry(
  description: string,
  targetId: string,
  userMeta?: UserAuditMeta,
  undoData?: any
): HistoryEntry {
  return {
    id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    description,
    targetId,
    user: userMeta?.user || 'System',
    clientDevice: userMeta?.clientDevice,
    clientInfo: userMeta?.clientInfo,
    undoData: undoData || undefined,
  };
}

/**
 * Handle container state when all its meat cuts are removed or zeroed out.
 */
export function handleEmptyContainer(
  containerId: string,
  state: InventoryState,
  userMeta?: UserAuditMeta
): InventoryState {
  const isContainerEmpty = !(state.meatCuts || []).some(mc => mc.containerId === containerId && mc.quantity > 0);
  if (!isContainerEmpty) {
    return state;
  }

  const container = (state.containers || []).find(c => c.id === containerId);
  if (!container) return state;

  // Staging / loose or special containers remain active
  const isBuiltIn =
    container.id === 'staging_loose' ||
    container.id.endsWith('_loose') ||
    container.name.toLowerCase().includes('loose');

  if (isBuiltIn) {
    return state;
  }

  if (container.deleteOnEmpty) {
    // Retire container
    const h = createHistoryEntry(
      `Container "${container.name}" was emptied and retired.`,
      containerId,
      userMeta,
      { type: 'RESTORE_DELETED_CONTAINER', container: { ...container } }
    );
    return {
      ...state,
      containers: (state.containers || []).filter(c => c.id !== containerId),
      history: [h, ...(state.history || [])],
    };
  }

  // Otherwise archive the container
  const h = createHistoryEntry(
    `Container "${container.name}" was emptied and archived.`,
    containerId,
    userMeta,
    { type: 'RESTORE_EMPTIED_CONTAINER', containerId: container.id }
  );

  return {
    ...state,
    containers: (state.containers || []).map(c =>
      c.id === containerId ? { ...c, freezerId: undefined, isArchived: true } : c
    ),
    history: [h, ...(state.history || [])],
  };
}

/**
 * INBOUND OPERATION:
 * Add new stock to a container. If matching variant already exists in that container,
 * increment its quantity; otherwise create a new meat cut.
 */
export function inboundMeatCut(
  state: InventoryState,
  payload: {
    productId: string;
    quantity: number;
    containerId: string;
    notes?: string;
    tagIds?: string[];
    originalCutName?: string;
    weight?: number;
    packDate?: string;
    lot?: string;
  },
  userMeta?: UserAuditMeta
): { state: InventoryState; cutId: string } {
  const product = (state.products || []).find(p => p.id === payload.productId);
  if (!product) {
    throw new Error(`Product with ID "${payload.productId}" not found.`);
  }

  if (payload.quantity <= 0) {
    throw new Error('Inbound quantity must be greater than zero.');
  }

  const container = (state.containers || []).find(c => c.id === payload.containerId);
  const containerName = container ? container.name : payload.containerId;

  const existingCut = (state.meatCuts || []).find(
    mc =>
      mc.containerId === payload.containerId &&
      isSameVariant(mc, payload.productId, payload.notes, payload.tagIds, payload.originalCutName)
  );

  let updatedState = { ...state };
  let cutId = '';

  if (existingCut) {
    cutId = existingCut.id;
    const newQuantity = existingCut.quantity + payload.quantity;
    const updatedCuts = (updatedState.meatCuts || []).map(mc =>
      mc.id === existingCut.id ? { ...mc, quantity: newQuantity } : mc
    );
    const hist = createHistoryEntry(
      `Inbound: Added ${payload.quantity}x "${product.name}" into "${containerName}". New total: ${newQuantity}.`,
      cutId,
      userMeta
    );
    updatedState = {
      ...updatedState,
      meatCuts: updatedCuts,
      history: [hist, ...(updatedState.history || [])],
    };
  } else {
    cutId = `cut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newCut: MeatCut = {
      id: cutId,
      productId: payload.productId,
      quantity: payload.quantity,
      containerId: payload.containerId,
      notes: payload.notes,
      tagIds: payload.tagIds || product.defaultTagIds || [],
      originalCutName: payload.originalCutName,
      weight: payload.weight,
      packDate: payload.packDate,
      lot: payload.lot,
    };
    const hist = createHistoryEntry(
      `Inbound: Created ${payload.quantity}x "${product.name}" in "${containerName}".`,
      cutId,
      userMeta
    );
    updatedState = {
      ...updatedState,
      meatCuts: [...(updatedState.meatCuts || []), newCut],
      history: [hist, ...(updatedState.history || [])],
    };
  }

  return { state: updatedState, cutId };
}

/**
 * OUTBOUND OPERATION:
 * Deplete or reduce quantity of an item from inventory (sale, consumption, or discard).
 * If quantity reaches zero, the item is removed from active cuts and empty container checks run.
 */
export function outboundMeatCut(
  state: InventoryState,
  meatCutId: string,
  quantityToDeduct: number,
  userMeta?: UserAuditMeta
): { state: InventoryState; remainingQuantity: number } {
  const cut = (state.meatCuts || []).find(mc => mc.id === meatCutId);
  if (!cut) {
    throw new Error(`Meat cut with ID "${meatCutId}" not found.`);
  }

  if (quantityToDeduct <= 0) {
    throw new Error('Deduction quantity must be greater than zero.');
  }

  if (quantityToDeduct > cut.quantity) {
    throw new Error(
      `Cannot outbound ${quantityToDeduct} items. Available quantity is only ${cut.quantity}.`
    );
  }

  const product = (state.products || []).find(p => p.id === cut.productId);
  const productName = product ? product.name : 'Item';
  const newQuantity = cut.quantity - quantityToDeduct;

  let nextCuts: MeatCut[];
  if (newQuantity <= 0) {
    nextCuts = (state.meatCuts || []).filter(mc => mc.id !== meatCutId);
  } else {
    nextCuts = (state.meatCuts || []).map(mc =>
      mc.id === meatCutId ? { ...mc, quantity: newQuantity } : mc
    );
  }

  const hist = createHistoryEntry(
    `Outbound: Depleted ${quantityToDeduct}x "${productName}" (Remaining: ${newQuantity}).`,
    meatCutId,
    userMeta,
    {
      type: 'RESTORE_MEAT_CUT_QUANTITY',
      meatCutId,
      previousQuantity: cut.quantity,
    }
  );

  let nextState: InventoryState = {
    ...state,
    meatCuts: nextCuts,
    history: [hist, ...(state.history || [])],
  };

  if (newQuantity <= 0) {
    nextState = handleEmptyContainer(cut.containerId, nextState, userMeta);
  }

  return { state: nextState, remainingQuantity: newQuantity };
}

/**
 * MOVE OPERATION:
 * Move an entire cut or partial quantity of a cut from one container to another.
 * Handles split items, variant consolidation at the destination, and source empty cleanup.
 */
export function moveMeatCut(
  state: InventoryState,
  payload: {
    meatCutId: string;
    newContainerId: string;
    quantity: number;
    sourceContainerId?: string;
  },
  userMeta?: UserAuditMeta
): { state: InventoryState; destCutId: string } {
  const sourceCut = (state.meatCuts || []).find(mc => mc.id === payload.meatCutId);
  if (!sourceCut) {
    throw new Error(`Source meat cut "${payload.meatCutId}" not found.`);
  }

  const moveQty = Math.min(payload.quantity, sourceCut.quantity);
  if (moveQty <= 0) {
    throw new Error('Move quantity must be greater than zero.');
  }

  const product = (state.products || []).find(p => p.id === sourceCut.productId);
  const productName = product ? product.name : 'Product';

  const sourceContainer = (state.containers || []).find(c => c.id === sourceCut.containerId);
  const destContainer = (state.containers || []).find(c => c.id === payload.newContainerId);

  if (!destContainer) {
    throw new Error(`Destination container "${payload.newContainerId}" not found.`);
  }

  const sourceName = sourceContainer ? sourceContainer.name : 'Source';
  const destName = destContainer.name;

  // Deduct from source
  const remainingSourceQty = sourceCut.quantity - moveQty;
  let nextCuts: MeatCut[];
  if (remainingSourceQty <= 0) {
    nextCuts = (state.meatCuts || []).filter(mc => mc.id !== sourceCut.id);
  } else {
    nextCuts = (state.meatCuts || []).map(mc =>
      mc.id === sourceCut.id ? { ...mc, quantity: remainingSourceQty } : mc
    );
  }

  // Check if destination already has a matching variant
  const existingDestCut = nextCuts.find(
    mc =>
      mc.containerId === payload.newContainerId &&
      isSameVariant(mc, sourceCut.productId, sourceCut.notes, sourceCut.tagIds, sourceCut.originalCutName)
  );

  let destCutId = '';
  if (existingDestCut) {
    destCutId = existingDestCut.id;
    nextCuts = nextCuts.map(mc =>
      mc.id === existingDestCut.id ? { ...mc, quantity: mc.quantity + moveQty } : mc
    );
  } else {
    destCutId = `cut-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newCut: MeatCut = {
      id: destCutId,
      productId: sourceCut.productId,
      containerId: payload.newContainerId,
      quantity: moveQty,
      notes: sourceCut.notes,
      tagIds: sourceCut.tagIds ? [...sourceCut.tagIds] : [],
      originalCutName: sourceCut.originalCutName,
      weight: sourceCut.weight,
      packDate: sourceCut.packDate,
      lot: sourceCut.lot,
    };
    nextCuts.push(newCut);
  }

  const hist = createHistoryEntry(
    `Moved ${moveQty}x "${productName}" from "${sourceName}" to "${destName}".`,
    destCutId,
    userMeta,
    {
      type: 'RESTORE_MOVE_MEAT',
      sourceCutId: sourceCut.id,
      prevSourceQuantity: sourceCut.quantity,
      destCutId,
    }
  );

  let nextState: InventoryState = {
    ...state,
    meatCuts: nextCuts,
    history: [hist, ...(state.history || [])],
  };

  if (remainingSourceQty <= 0) {
    nextState = handleEmptyContainer(sourceCut.containerId, nextState, userMeta);
  }

  return { state: nextState, destCutId };
}

/**
 * MOVE CONTAINER OPERATION:
 * Move an entire container to another freezer or unassigned staging area.
 */
export function moveContainer(
  state: InventoryState,
  payload: {
    containerId: string;
    newFreezerId?: string;
  },
  userMeta?: UserAuditMeta
): InventoryState {
  const container = (state.containers || []).find(c => c.id === payload.containerId);
  if (!container) {
    throw new Error(`Container "${payload.containerId}" not found.`);
  }

  const oldFreezer = (state.freezers || []).find(f => f.id === container.freezerId);
  const newFreezer = payload.newFreezerId
    ? (state.freezers || []).find(f => f.id === payload.newFreezerId)
    : undefined;

  const oldFreezerName = oldFreezer ? oldFreezer.name : 'Staging Area';
  const newFreezerName = newFreezer ? newFreezer.name : 'Staging Area';

  const updatedContainers = (state.containers || []).map(c =>
    c.id === payload.containerId ? { ...c, freezerId: payload.newFreezerId, isArchived: false } : c
  );

  const hist = createHistoryEntry(
    `Container "${container.name}" moved from "${oldFreezerName}" to "${newFreezerName}".`,
    container.id,
    userMeta
  );

  return {
    ...state,
    containers: updatedContainers,
    history: [hist, ...(state.history || [])],
  };
}
