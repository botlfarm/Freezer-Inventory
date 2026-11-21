// Shared audit history classification, summarization, and undo policy utilities
import {
  HistoryEntry,
  HistoryEntryDetails,
  HistoryItemDetail,
  HistoryScope,
  HistoryUndoMode,
  MovementOrder,
  OffSiteEntry,
  Product
} from '../types';

export const HISTORY_PREVIEW_ITEM_LIMIT = 100;
export const UNDO_JOURNAL_MAX_OPS = 25;

export interface BuildHistoryDetailsInput {
  actionType?: string;
  undoMode?: HistoryUndoMode;
  relatedOrderId?: string;
  orderNumber?: string;
  orderName?: string;
  locationName?: string;
  palletName?: string;
  itemCount?: number;
  totalPieces?: number;
  totalWeight?: number;
  changedFields?: string[];
  items?: HistoryItemDetail[];
}

export function buildHistoryDetails(input: BuildHistoryDetailsInput): HistoryEntryDetails {
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const totalCount = input.itemCount !== undefined ? input.itemCount : rawItems.length;

  let computedPieces = 0;
  let computedWeight = 0;
  for (let i = 0; i < rawItems.length; i++) {
    const it = rawItems[i];
    if (typeof it.pieces === 'number' && !isNaN(it.pieces)) {
      computedPieces += it.pieces;
    }
    if (typeof it.weight === 'number' && !isNaN(it.weight)) {
      computedWeight += it.weight;
    }
  }

  const totalPieces = input.totalPieces !== undefined ? input.totalPieces : (rawItems.length > 0 ? computedPieces : undefined);
  const rawWeight = input.totalWeight !== undefined ? input.totalWeight : (rawItems.length > 0 ? computedWeight : undefined);
  const totalWeight = rawWeight !== undefined ? Math.round(rawWeight * 100) / 100 : undefined;

  const previewItems = rawItems.length > 0 ? rawItems.slice(0, HISTORY_PREVIEW_ITEM_LIMIT) : undefined;
  const truncatedCount =
    rawItems.length > HISTORY_PREVIEW_ITEM_LIMIT
      ? rawItems.length - HISTORY_PREVIEW_ITEM_LIMIT
      : input.itemCount !== undefined && input.itemCount > (previewItems?.length || 0)
        ? input.itemCount - (previewItems?.length || 0)
        : undefined;

  const details: HistoryEntryDetails = {};
  if (input.actionType) details.actionType = input.actionType;
  if (input.undoMode) details.undoMode = input.undoMode;
  if (input.relatedOrderId) details.relatedOrderId = input.relatedOrderId;
  if (input.orderNumber) details.orderNumber = input.orderNumber;
  if (input.orderName) details.orderName = input.orderName;
  if (input.locationName) details.locationName = input.locationName;
  if (input.palletName) details.palletName = input.palletName;
  if (totalCount > 0 || input.itemCount !== undefined) details.itemCount = totalCount;
  if (totalPieces !== undefined && totalPieces > 0) details.totalPieces = totalPieces;
  if (totalWeight !== undefined && totalWeight > 0) details.totalWeight = totalWeight;
  if (input.changedFields && input.changedFields.length > 0) details.changedFields = input.changedFields;
  if (previewItems && previewItems.length > 0) details.items = previewItems;
  if (truncatedCount && truncatedCount > 0) details.truncatedCount = truncatedCount;

  return details;
}

export function buildOffSiteEntryPreviewItem(
  entry: Partial<OffSiteEntry> & { normalizedCutName?: string },
  productById?: Map<string, Product>,
  action?: string
): HistoryItemDetail {
  const product = entry.productId && productById ? productById.get(entry.productId) : undefined;
  const cut =
    product?.name ||
    entry.cuts ||
    entry.normalizedCutName ||
    entry.originalCutName ||
    'Off-Site Cut';

  const pallet = (entry.currentLocation || entry.pallet || '').trim() || undefined;
  const location = (entry.location || '').trim() || undefined;
  const box = (entry.box || '').trim() || undefined;
  const serial = (entry.serial || '').trim() || undefined;
  const note = (entry.notes || '').trim() || undefined;

  const item: HistoryItemDetail = { cut };
  if (entry.id) item.id = entry.id;
  if (serial) item.serial = serial;
  if (box) item.box = box;
  if (pallet) item.pallet = pallet;
  if (location) item.location = location;
  if (typeof entry.pieces === 'number') item.pieces = entry.pieces;
  if (typeof entry.netWeight === 'number' && entry.netWeight > 0) {
    item.weight = Math.round(entry.netWeight * 100) / 100;
  }
  if (note) item.note = note;
  if (action) item.action = action;

  return item;
}

export interface ScopeLookupContext {
  offSiteEntryIds?: Set<string>;
  butcherOrderIds?: Set<string>;
  movementOrderIds?: Set<string>;
  palletIds?: Set<string>;
  locationIds?: Set<string>;
  productIds?: Set<string>;
}

const VALID_SCOPES = new Set<HistoryScope>(['onsite', 'offsite', 'butcher', 'system']);

export function resolveHistoryScope(
  entry: Partial<HistoryEntry>,
  context?: ScopeLookupContext
): HistoryScope {
  if (entry.scope && VALID_SCOPES.has(entry.scope)) {
    return entry.scope;
  }

  const actionType = (entry.details?.actionType || '').toUpperCase();
  if (actionType) {
    if (actionType.includes('BUTCHER')) return 'butcher';
    if (
      actionType.includes('OFFSITE') ||
      actionType.includes('MOVEMENT_ORDER') ||
      actionType.includes('PALLET') ||
      actionType === 'MOVE_STAGING_TO_OFFSITE'
    ) {
      return 'offsite';
    }
    if (
      actionType.includes('LOCATION') ||
      actionType.includes('PRODUCT') ||
      actionType.includes('CATEGORY') ||
      actionType.includes('TAG') && !actionType.includes('MEAT') ||
      actionType.includes('VOICE_DICTIONARY') ||
      actionType.includes('CONTAINER_TEMPLATE') ||
      actionType.includes('CUSTOM_LIST') ||
      actionType.includes('NOTIFICATION') ||
      actionType === 'PURGE_HISTORY' ||
      actionType === 'REPLACE_STATE'
    ) {
      return 'system';
    }
  }

  const targetId = (entry.targetId || '').trim();
  const targetLower = targetId.toLowerCase();
  const descLower = (entry.description || '').toLowerCase();

  // Direct entity ID matches
  if (targetId && context?.butcherOrderIds?.has(targetId)) return 'butcher';
  if (targetId && context?.offSiteEntryIds?.has(targetId)) return 'offsite';
  if (targetId && context?.movementOrderIds?.has(targetId)) return 'offsite';
  if (targetId && context?.palletIds?.has(targetId)) return 'offsite';
  if (targetId && context?.locationIds?.has(targetId)) return 'system';

  // Target ID sentinel patterns
  if (
    targetLower === 'butcher' ||
    targetLower.startsWith('butcher-') ||
    targetLower.startsWith('butcher_')
  ) {
    return 'butcher';
  }
  if (
    targetLower === 'offsite-removal' ||
    targetLower === 'offsite-import' ||
    targetLower === 'offsite-bulk-edit' ||
    targetLower === 'offsite-bulk-delete' ||
    targetLower === 'offsite-clear' ||
    targetLower === 'movement-completed' ||
    targetLower === 'movement-partial' ||
    targetLower === 'movement-revert' ||
    targetLower.startsWith('offsite-') ||
    targetLower.startsWith('movement-')
  ) {
    return 'offsite';
  }
  if (
    targetLower === 'history-maintenance' ||
    targetLower === 'bulk-product-delete' ||
    targetLower === 'bulk-product-edit' ||
    targetLower === 'category-delete' ||
    targetLower === 'location' ||
    targetLower.startsWith('loc-') ||
    targetLower.startsWith('custom-list-') ||
    targetLower === 'notification-settings' ||
    (targetId && context?.productIds?.has(targetId) && (
      descLower.includes('product ') ||
      descLower.includes('created product') ||
      descLower.includes('updated product') ||
      descLower.includes('deleted')
    ))
  ) {
    return 'system';
  }

  // Description keyword heuristics for legacy records
  if (
    descLower.includes('butcher order') ||
    descLower.includes('cutsheet') ||
    descLower.includes('kill date')
  ) {
    return 'butcher';
  }

  if (
    descLower.includes('offsite') ||
    descLower.includes('off-site') ||
    descLower.includes('movement order') ||
    descLower.includes('staging worksheet') ||
    descLower.includes('from staging to off-site') ||
    descLower.startsWith('pallet ') ||
    descLower.includes('renamed pallet') ||
    descLower.includes('assigned pallet') ||
    descLower.includes('notes for pallet')
  ) {
    return 'offsite';
  }

  if (
    descLower.startsWith('location "') ||
    descLower.startsWith('created a new tag') ||
    descLower.startsWith('tag "') && (descLower.includes('details updated') || descLower.includes('permanently deleted')) ||
    descLower.startsWith('product "') ||
    descLower.startsWith('bulk deleted ') ||
    descLower.startsWith('bulk changed ') ||
    descLower.startsWith('category "') ||
    descLower.startsWith('container template "') ||
    descLower.includes('voice dictionary rule') ||
    descLower.startsWith('archived & purged') ||
    descLower.startsWith('state restored') ||
    descLower.startsWith('custom list ') ||
    descLower.startsWith('updated notification settings')
  ) {
    return 'system';
  }

  return 'onsite';
}

export function getHistoryUndoMode(entry: Partial<HistoryEntry>): HistoryUndoMode {
  if (entry.details?.undoMode) {
    return entry.details.undoMode;
  }

  if (entry.undoData) {
    return 'standard';
  }

  const targetLower = (entry.targetId || '').toLowerCase();
  const descLower = (entry.description || '').toLowerCase();

  if (targetLower === 'movement-completed' || targetLower === 'movement-partial') {
    return 'order_revert';
  }

  if (
    targetLower === 'history-maintenance' ||
    targetLower === 'movement-revert' ||
    targetLower === 'offsite-import' ||
    targetLower === 'offsite-bulk-edit' ||
    targetLower === 'offsite-bulk-delete' ||
    targetLower === 'offsite-clear' ||
    descLower.startsWith('archived & purged') ||
    descLower.startsWith('state restored') ||
    descLower.startsWith('undid action:')
  ) {
    return 'audit_only';
  }

  return 'standard';
}

export function isMovementOrderStatusMilestone(
  existingOrder: Partial<MovementOrder> | undefined,
  updates: Partial<MovementOrder> | undefined
): { isMilestone: boolean; previousStatus?: string; nextStatus?: string } {
  if (!existingOrder || !updates || updates.status === undefined) {
    return { isMilestone: false };
  }
  const previousStatus = existingOrder.status;
  const nextStatus = updates.status;
  if (!nextStatus || nextStatus === previousStatus) {
    return { isMilestone: false };
  }
  return {
    isMilestone: true,
    previousStatus,
    nextStatus
  };
}

export function shouldSkipUndoSqlJournal(
  historyEntry: Partial<HistoryEntry> | undefined,
  inverseOpsCount: number
): boolean {
  if (!historyEntry || !historyEntry.id) return true;
  const undoMode = historyEntry.details?.undoMode;
  if (undoMode === 'audit_only' || undoMode === 'order_revert') {
    return true;
  }
  if (inverseOpsCount <= 0 || inverseOpsCount > UNDO_JOURNAL_MAX_OPS) {
    return true;
  }
  return false;
}
