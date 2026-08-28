export interface Freezer {
  id:string;
  name: string;
  isSpecial?: boolean;
  isLooseOnly?: boolean;
  isPallet?: boolean;
}

export interface ContainerTemplate {
  id: string;
  name: string;
  icon: string;
  imageUrl?: string;
  createdAt?: string;
}

export interface Container {
  id: string;
  name: string;
  freezerId?: string; // Optional: A container without a freezerId is "unplaced"
  templateId?: string; // Optional: Link to a ContainerTemplate catalog definition
  imageUrl?: string;
  deleteOnEmpty?: boolean;
  icon: string;
  isBox?: boolean;
  color?: string;
  isArchived?: boolean;
}

export interface Product {
  id: string;
  name: string;
  primaryCategory: string;
  subCategory: string;
  imageUrl?: string;
  productNumbers?: string[];
  barcode?: string;
  salePrice?: number;
  salePriceUnit?: 'lb' | 'package';
  listThresholds?: { [listId: string]: number };
  listControlSources?: { [listId: string]: ControlSourceType };
  defaultTagIds?: string[];
  listActive?: { [listId: string]: boolean };
  listNotes?: { [listId: string]: string };
  isArchived?: boolean;
}


export interface AppPallet {
  id: string; // Used as the pallet name string
  notes?: string;
  storageLocationId?: string;
  tagIds?: string[];
  isArchived?: boolean;
}

export interface AppBox {
  id: string; // Used as the box name string
  palletId?: string;
  notes?: string;
  tagIds?: string[];
  isArchived?: boolean;
}

export interface OffSiteEntry {
  id: string;
  serial: string;
  cuts?: string;
  originalCutName?: string;
  productId?: string;
    packDate?: string;
  lot?: string;
  pieces: number;
  netWeight: number;
    box?: string;
  moveTo?: string;
  currentLocation?: string; // Pallet e.g. "P3-03262026", "Home", etc.
  pallet?: string; // Explicit Pallet name
  location?: string; // Registered location in catalogue
  notes?: string;
  boxNotes?: string;
  sourceLocation?: string; // Supplier / butcher of origin
  storageLocationId?: string; // Links this entry (and its parent pallet) to a specific AppLocation
  tagIds?: string[];
  historical?: boolean;
  orderId?: string;
  importedToOffSite?: boolean;
  archived?: boolean;
  staged?: boolean;
  wrongLabel?: string;
  isWrongLabel?: boolean;
  wrongLabelOriginal?: string;
}

export type ButcherRecord = OffSiteEntry;

export interface MeatCut {
  id: string;
  productId: string;
  quantity: number;
  containerId: string;
  notes?: string;
  tagIds?: string[];
  originalCutName?: string;
  wrongLabel?: string;
  isWrongLabel?: boolean;
  wrongLabelOriginal?: string;
  serial?: string;
  packDate?: string;
  weight?: number;
}

export interface HistoryEntry {
  id: string;
  timestamp: string; // ISO string
  description: string;
  targetId: string; // ID of MeatCut or Container
  user?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'primary' | 'sub';
  parentPrimary?: string; // used if type === 'sub'
  icon?: string;
}

export interface Tag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  textColor?: string;
  excludeFromDisplayRestock?: boolean;
}

export interface AppLocation {
  id: string;
  name: string;
  address?: string;
  contact?: string;
  notes?: string;
  isHome: boolean;
  type: 'storage' | 'delivery_pickup';
  hasPallets?: boolean;
}

export type ControlSourceType = 'onsite_count' | 'offsite_count' | 'offsite_weight' | 'total_count';

export interface CustomListItem {
  productId: string;
  notes?: string;
  addedAt?: string;
  notifyEnabled?: boolean;
  controlSource?: ControlSourceType;
  threshold?: number;
}

export interface CustomList {
  id: string;
  name: string;
  description: string;
  allowNotes: boolean;
  isInventoryControlled: boolean;
  controlType?: 'auto' | 'prompt';
  controlCondition?: 'min' | 'max';
  items: CustomListItem[];
  notificationEnabled?: boolean;
  notificationType?: 'all_items' | 'newly_added_only' | 'item_specific';
  lastNotifiedAt?: string;
}

export interface NotificationSettings {
  id: string;
  digestEnabled: boolean;
  digestMode: 'combined' | 'individual';
  digestTime: string;
  method: 'ha_persistent' | 'ha_notify' | 'smtp_email' | 'webhook' | 'in_app';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpTo?: string;
  smtpSecure?: boolean;
  webhookUrl?: string;
  haNotifyService?: string;
  haUrl?: string;
  haToken?: string;
  lastDigestSentAt?: string;
}

export interface NotificationLog {
  id: string;
  sentAt: string;
  title: string;
  message: string;
  method: string;
  status: 'success' | 'failed';
  error?: string;
}


export interface MovementItem {
  entryId: string;
  targetLocation: string; 
  actualLocation?: string; 
  originalLocation?: string;
  originalCurrentLocation?: string;
}

export interface MovementDestination {
  id: string; // Unique identifier (e.g. locationId + palletName)
  locationId: string;
  locationName: string;
  palletName?: string;
}

export interface MovementOrder {
  id: string;
  name: string;
  description?: string;
  date: string;
  status: 'planning' | 'finalized' | 'completed';
  palletsInPlay: string[];
  locationsInPlay: string[];
  targetDestinations?: MovementDestination[];
  moves: MovementItem[];
  executedAt?: string;
  originalEntries?: OffSiteEntry[];
  pickedBoxIds?: string[];
  deliveredBoxIds?: string[];
  pickedItemIds?: string[];
  deliveredItemIds?: string[];
  flags?: Record<string, string>;
}

export interface ButcherOrderDocument {
  id: string;
  name: string;
  url: string;
}

export interface ButcherOrder {
  id: string;
  orderNumber: string;
  species: string;
  killDate?: string;
  pickupDate?: string;
  birthDate?: string;
  notes?: string;
  animalCount?: number;
  liveWeight: number;
  hotWeight: number;
  coldWeight: number;
  locationId?: string;
  targetLocation?: string;
  targetPallet?: string;
  pallet?: string;
  createdAt: number;
  documents?: ButcherOrderDocument[];
  butcherFee?: number;
}


export type InventoryState = {
  freezers: Freezer[];
  containers: Container[];
  containerTemplates?: ContainerTemplate[];
  products: Product[];
  meatCuts: MeatCut[];
  history: HistoryEntry[];
  offSiteEntries?: OffSiteEntry[];
  pallets?: AppPallet[];
  boxes?: AppBox[];
  butcherOrders?: ButcherOrder[];
  butcherRecords?: ButcherRecord[];
  categories?: Category[];
  customLists?: CustomList[];
  tags?: Tag[];
  locations?: AppLocation[];
  movementOrders?: MovementOrder[];
  previousState?: InventoryState; // For undo functionality
  isDemoMode?: boolean;
  isPreviewMode?: boolean;
  previewBackupFilename?: string;
  notificationSettings?: NotificationSettings[];
  notificationLogs?: NotificationLog[];
};

export type View = 'freezer' | 'product' | 'library' | 'history' | 'reconcile' | 'import' | 'display_case' | 'restock' | 'offsite' | 'butcher_records';

export type Action =
  | { type: 'ADD_FREEZER'; payload: { name: string; isSpecial?: boolean; isLooseOnly?: boolean; isPallet?: boolean } }
  | { type: 'EDIT_FREEZER'; payload: { id: string; name: string; isSpecial?: boolean; isLooseOnly?: boolean; isPallet?: boolean } }
  | { type: 'DELETE_FREEZER'; payload: { id: string } }
  | { type: 'ADD_CONTAINER'; payload: { id?: string; name: string; freezerId?: string; templateId?: string; imageUrl?: string; deleteOnEmpty?: boolean; icon: string; } }
  | { type: 'ADD_CONTAINER_TEMPLATE'; payload: { id?: string; name: string; icon: string; imageUrl?: string } }
  | { type: 'EDIT_CONTAINER_TEMPLATE'; payload: { id: string; updates: Partial<Omit<ContainerTemplate, 'id'>> } }
  | { type: 'DELETE_CONTAINER_TEMPLATE'; payload: { id: string } }
  | { type: 'TOGGLE_CONTAINER_ARCHIVED'; payload: { containerId: string; isArchived: boolean } }
  | { type: 'ADD_PRODUCT'; payload: { product: Product } }
  | { type: 'EDIT_PRODUCT'; payload: { productId: string; updates: Partial<Omit<Product, 'id'>> } }
  | { type: 'ADD_MEAT_CUT'; payload: { productId: string; quantity: number; containerId: string; notes?: string; tagIds?: string[]; originalCutName?: string; } }
  | { type: 'BATCH_UPDATE_MEAT_QUANTITY'; payload: { updates: Record<string, number> } }
  | { type: 'UPDATE_MEAT_QUANTITY'; payload: { meatCutId: string; newQuantity: number } }
  | { type: 'UPDATE_MEAT_NOTES'; payload: { meatCutId: string; notes: string; originalCutName?: string } }
  | { type: 'TOGGLE_MEAT_TAG'; payload: { meatCutId: string; tagId: string } }
  | { type: 'TOGGLE_OFFSITE_ENTRY_TAG'; payload: { entryId: string; tagId: string } }
  | { type: 'ADD_TAG'; payload: { tag: Tag } }
  | { type: 'EDIT_TAG'; payload: { tagId: string; updates: Partial<Omit<Tag, 'id'>> } }
  | { type: 'DELETE_TAG'; payload: { tagId: string } }
  | { type: 'ADD_LOCATION'; payload: { id?: string; name: string; address?: string; contact?: string; notes?: string; isHome: boolean; type: 'storage' | 'delivery_pickup' } }
  | { type: 'EDIT_LOCATION'; payload: { locationId: string; updates: Partial<Omit<AppLocation, 'id'>> } }
  | { type: 'DELETE_LOCATION'; payload: { locationId: string } }
  | { type: 'SET_HOME_LOCATION'; payload: { locationId: string } }
  | { type: 'EDIT_NOTE'; payload: { meatCutId: string; initialNotes: string } }
  | { type: 'RECONCILE_QUANTITIES'; payload: { updates: Array<{ meatCutId: string; newQuantity: number }> } }
  | { type: 'MOVE_MEAT_QUANTITY'; payload: { meatCutId: string; newContainerId: string; quantity: number; sourceContainerId: string; productId?: string; } }
  | { type: 'MOVE_CONTAINER'; payload: { containerId: string; newFreezerId?: string; emptyCuts?: boolean } }
  | { type: 'DELETE_CONTAINER'; payload: { containerId: string } }
  | { type: 'DELETE_PRODUCT'; payload: { productId: string } }
  | { type: 'BULK_DELETE_PRODUCTS'; payload: { productIds: string[] } }
  | { type: 'BULK_EDIT_PRODUCTS'; payload: { productIds: string[]; updates: { primaryCategory?: string; subCategory?: string; defaultTagIds?: string[]; defaultTagsMode?: 'append' | 'replace'; isArchived?: boolean } } }
  | { type: 'DELETE_CATEGORY'; payload: { name: string; type: 'primary' | 'sub'; parentPrimary?: string } }
  | { type: 'EDIT_CONTAINER'; payload: { containerId: string; updates: Partial<Omit<Container, 'id' | 'freezerId'>>; applyGlobally?: boolean } }
  | { type: 'BULK_ADD_MEAT_CUTS'; payload: { items: Array<{ productId: string; quantity: number; notes?: string; tagIds?: string[]; originalCutName?: string; }>, containerId: string } }
  | { type: 'RENAME_CATEGORY'; payload: { oldName: string; newName: string; type: 'primary' | 'sub' } }
  | { type: 'UPDATE_CATEGORY_DECORATION'; payload: { name: string; type: 'primary' | 'sub'; parentPrimary?: string; icon?: string } }
  | { type: 'ADD_OFFSITE_ENTRY'; payload: { entry: OffSiteEntry } }
  | { type: 'UPDATE_OFFSITE_ENTRY'; payload: { id: string; updates: Partial<OffSiteEntry> } }
  | { type: 'DELETE_OFFSITE_ENTRY'; payload: { id: string } }
  | { type: 'BULK_DELETE_OFFSITE_ENTRIES'; payload: { ids: string[] } }
  | { type: 'BULK_EDIT_OFFSITE_ENTRIES'; payload: { ids: string[]; updates: Partial<OffSiteEntry> } }
  | { type: 'IMPORT_OFFSITE_ENTRIES'; payload: { entries: OffSiteEntry[]; replaceAll?: boolean } }
  | { type: 'CLEAR_OFFSITE_ENTRIES' }
  | { type: 'ASSIGN_PALLET_LOCATION'; payload: { palletName: string; storageLocationId: string } }
  | { type: 'RENAME_PALLET'; payload: { oldName: string; newName: string } }
  | { type: 'UPDATE_PALLET_NOTES'; payload: { palletId: string; notes: string } }
  | { type: 'MOVE_STAGING_TO_OFFSITE' }
  | { type: 'FINALIZE_OFFSITE_STAGING'; payload: { entries: OffSiteEntry[]; movementOrderName?: string } }
  | { type: 'REPLACE_STATE'; payload: InventoryState }
  | { type: 'ADD_MOVEMENT_ORDER'; payload: { order: MovementOrder } }
  | { type: 'UPDATE_MOVEMENT_ORDER'; payload: { id: string; updates: Partial<MovementOrder> } }
  | { type: 'APPEND_MOVEMENT_ORDER_IDS'; payload: { id: string; pickedBoxIds?: string[]; pickedItemIds?: string[]; deliveredBoxIds?: string[]; deliveredItemIds?: string[] } }
  | { type: 'REMOVE_MOVEMENT_ORDER_IDS'; payload: { id: string; pickedBoxIds?: string[]; pickedItemIds?: string[]; deliveredBoxIds?: string[]; deliveredItemIds?: string[] } }
  | { type: 'DELETE_MOVEMENT_ORDER'; payload: { id: string } }
  | { type: 'EXECUTE_MOVEMENT_ORDER'; payload: { id: string } }
  | { type: 'REVERT_MOVEMENT_ORDER'; payload: { id: string } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'ADD_CUSTOM_LIST'; payload: { name: string; description: string; allowNotes: boolean; isInventoryControlled: boolean; controlType?: 'auto' | 'prompt'; controlCondition?: 'min' | 'max'; } }
  | { type: 'EDIT_CUSTOM_LIST'; payload: { listId: string; updates: Partial<Omit<CustomList, 'id' | 'items'>> } }
  | { type: 'DELETE_CUSTOM_LIST'; payload: { listId: string } }
  | { type: 'TOGGLE_PRODUCT_ON_LIST'; payload: { listId: string; productId: string; notes?: string; forceState?: boolean; controlSource?: ControlSourceType; threshold?: number } }
  | { type: 'BATCH_TOGGLE_PRODUCTS_ON_LIST'; payload: { updates: Array<{ listId: string; productId: string; notes?: string; forceState?: boolean; controlSource?: ControlSourceType; threshold?: number }> } }
  | { type: 'UPDATE_LIST_ITEM_CONTROL_SOURCE'; payload: { listId: string; productId: string; controlSource: ControlSourceType } }
  | { type: 'UPDATE_LIST_ITEM_THRESHOLD'; payload: { listId: string; productId: string; threshold: number | null } }
  | { type: 'UPDATE_LIST_ITEM_NOTE'; payload: { listId: string; productId: string; notes: string } }
  | { type: 'TOGGLE_LIST_ITEM_NOTIFICATION'; payload: { listId: string; productId: string; notifyEnabled: boolean } }
  | { type: 'ADD_BUTCHER_ORDER'; payload: { order: ButcherOrder; records: OffSiteEntry[]; targetLocation?: string; targetPallet?: string } }
  | { type: 'DELETE_BUTCHER_ORDER'; payload: { orderId: string } }
  | { type: 'EDIT_BUTCHER_ORDER'; payload: { orderId: string; updates: Partial<ButcherOrder> } }
  | { type: 'UPDATE_NOTIFICATION_SETTINGS'; payload: Partial<NotificationSettings> }
  | { type: 'CLEAR_NOTIFICATION_LOGS' }
  | { type: 'TOGGLE_CUSTOM_LIST_ITEM_NOTIFY'; payload: { listId: string; productId: string; notifyEnabled: boolean } }
  | { type: 'CORRECT_MEAT_LABEL'; payload: { meatCutId: string; correctProductId: string; notes?: string } }
  | { type: 'CORRECT_OFFSITE_LABEL'; payload: { entryId: string; correctProductId: string; notes?: string } }
  | { type: 'BULK_CORRECT_OFFSITE_LABEL'; payload: { entryIds: string[]; correctProductId: string; notes?: string } }
  | { type: 'REVERT_MEAT_LABEL'; payload: { meatCutId: string } }
  | { type: 'REVERT_OFFSITE_LABEL'; payload: { entryId: string } }
  | { type: 'BULK_REVERT_OFFSITE_LABEL'; payload: { entryIds: string[] } }
  | { type: 'SPLIT_MEAT_CUT'; payload: { meatCutId: string; splitQuantity: number; notes?: string; tagIds?: string[] } }
  | { type: 'PURGE_HISTORY'; payload: { olderThanDays?: number; keepMax?: number; clearAll?: boolean } };


export type ModalType =
  | { type: 'ADD_FREEZER' }
  | { type: 'ADD_CONTAINER'; freezerId?: string }
  | { type: 'ADD_MEAT'; containerId: string; productId?: string }
  | { type: 'HISTORY'; targetId: string; targetName: string }
  | { type: 'MOVE_MEAT'; meatCutId: string }
  | { type: 'MOVE_CONTAINER'; containerId: string }
  | { type: 'EDIT_CONTAINER'; containerId: string }
  | { type: 'EDIT_PRODUCT'; productId: string }
  | { type: 'BULK_ADD_MEAT'; productId?: string }
  | { type: 'EDIT_NOTE'; meatCutId: string; initialNotes: string; initialOriginalCutName?: string }
  | { type: 'WRONG_LABEL'; meatCutId: string }
  | { type: 'RESTOCK_PROMPT'; productId: string; actionType: 'add' | 'remove'; productName: string }
  | { type: 'ADD_TO_LIST'; productId: string }
  | { type: 'SELECT_MEAT_TAGS'; meatCutId: string }
  | { type: 'SPLIT_ITEM'; meatCutId: string }
  | { type: 'CHANGE_CONTAINER_FLOW'; containerId: string }
  | { type: 'LIST_THRESHOLD_ALERT'; listId: string; productId: string; actionType: 'add' | 'remove'; currentValue: number; thresholdValue: number; controlCondition: 'min' | 'max' }
  | null;
