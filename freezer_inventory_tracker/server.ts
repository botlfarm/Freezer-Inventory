import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';

const PORT = 3000;

const app = express();
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// Home Assistant Ingress path prefix stripper middleware.
// This allows the app to adapt dynamically to Home Assistant reverse proxying.
app.use((req, res, next) => {
  const ingressPath = req.headers['x-hassio-ingress-path'];
  if (ingressPath && typeof ingressPath === 'string') {
    if (req.url.startsWith(ingressPath)) {
      req.url = req.url.substring(ingressPath.length);
      if (!req.url.startsWith('/')) {
        req.url = '/' + req.url;
      }
    }
  }
  next();
});

// Path to data directory for configs and fallbacks.
// Home Assistant Add-ons use the root /data directory for persistent volume mount.
let DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR) && fs.existsSync(path.join(process.cwd(), 'freezer_inventory_tracker', 'data'))) {
  DATA_DIR = path.join(process.cwd(), 'freezer_inventory_tracker', 'data');
}
try {
  if (process.env.NODE_ENV === "production" && fs.existsSync('/data') && fs.lstatSync('/data').isDirectory()) {
    DATA_DIR = '/data';
  }
} catch (e) {
  console.warn('Could not test for root /data directory, fallback to localized cwd data.');
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Place uploaded files inside persistent DATA_DIR to survive supervisor image rebuilds or updates
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/images', express.static(UPLOADS_DIR));
app.use('/photos', express.static(UPLOADS_DIR));

// Read-Only Live Preview Guard Middleware
app.use('/api', (req, res, next) => {
  if (isPreviewMode) {
    if (req.method === 'GET') {
      return next();
    }
    const cleanUrl = (req.originalUrl || req.url || '').toLowerCase();
    if (cleanUrl.includes('/backups/preview-mode/end') || cleanUrl.includes('/backups/preview-mode/status')) {
      return next();
    }
    return res.status(403).json({
      error: 'READ_ONLY_PREVIEW_MODE',
      isPreviewMode: true,
      previewBackupFilename,
      message: `You are currently viewing snapshot "${previewBackupFilename || 'Backup'}" in Live Preview Mode. All database modifications are disabled in preview mode.`
    });
  }
  next();
});

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const FALLBACK_DB = path.join(DATA_DIR, 'inventory-db.json');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Interface definition matching client
interface AppInventoryState {
  freezers: any[];
  containers: any[];
  containerTemplates?: any[];
  products: any[];
  categories?: any[];
  meatCuts: any[];
  history: any[];
  offSiteEntries?: any[];
  pallets?: any[];
  boxes?: any[];
  butcherOrders?: any[];
  butcherRecords?: any[];
  customLists?: any[];
  tags?: any[];
  locations?: any[];
  movementOrders?: any[];
  isDemoMode?: boolean;
  isPreviewMode?: boolean;
  previewBackupFilename?: string;
  notificationSettings?: any[];
  notificationLogs?: any[];
}

/**
 * Calculates the UPC-A modulo-10 check digit from the first 11 digits.
 */
function calculateUpcACheckDigit(first11Digits: string): number {
  const digits = String(first11Digits).replace(/\D/g, '');
  if (digits.length < 11) return 0;
  let oddSum = 0;
  let evenSum = 0;
  for (let i = 0; i < 11; i++) {
    const digit = parseInt(digits[i], 10) || 0;
    if (i % 2 === 0) {
      oddSum += digit;
    } else {
      evenSum += digit;
    }
  }
  const total = oddSum * 3 + evenSum;
  return (10 - (total % 10)) % 10;
}

/**
 * Generates the default 0-lb weight-embedded UPC-A barcode for a product using its item number.
 * Example: Item number '15425' -> '215425000003'
 */
function generateDefaultUpcABarcode(itemNumber?: string | number): string | undefined {
  if (itemNumber === undefined || itemNumber === null) return undefined;
  const cleaned = String(itemNumber).replace(/\D/g, '');
  if (!cleaned) return undefined;
  const item5 = cleaned.padStart(5, '0').slice(-5);
  const first11 = `2${item5}00000`;
  const checkDigit = calculateUpcACheckDigit(first11);
  return `${first11}${checkDigit}`;
}

const defaultInitialState: AppInventoryState = {
  freezers: [],
  containers: [],
  products: [],
  categories: [],
  meatCuts: [],
  history: [],
  offSiteEntries: [],
  butcherOrders: [],
  tags: [],
  locations: []
};

// Local Database storage
const SQLITE_DB_PATH = path.join(DATA_DIR, 'inventory.db');
let db: any;
let isDemoMode = false;
let isPreviewMode = false;
let previewBackupFilename: string | null = null;
let activeDbPathOverride: string | null = null;

function getDatabasePath(): string {
  if (isPreviewMode) {
    return path.join(DATA_DIR, 'inventory_preview.db');
  }
  if (activeDbPathOverride) {
    return activeDbPathOverride;
  }
  return isDemoMode ? path.join(DATA_DIR, 'inventory_demo.db') : SQLITE_DB_PATH;
}

const TABLE_SCHEMAS: Record<string, {
  createSql: string;
  columns: string[];
  fromDb: (row: any) => any;
  toDb: (item: any) => any;
}> = {
  freezers: {
    createSql: `
      CREATE TABLE IF NOT EXISTS freezers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        isSpecial INTEGER DEFAULT 0,
        isLooseOnly INTEGER DEFAULT 0,
        isPallet INTEGER DEFAULT 0
      )
    `,
    columns: ['id', 'name', 'isSpecial', 'isLooseOnly', 'isPallet'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      isSpecial: row.isSpecial === 1,
      isLooseOnly: row.isLooseOnly === 1,
      isPallet: row.isPallet === 1
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      isSpecial: item.isSpecial ? 1 : 0,
      isLooseOnly: item.isLooseOnly ? 1 : 0,
      isPallet: item.isPallet ? 1 : 0
    })
  },
  container_templates: {
    createSql: `
      CREATE TABLE IF NOT EXISTS container_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        imageUrl TEXT,
        createdAt TEXT
      )
    `,
    columns: ['id', 'name', 'icon', 'imageUrl', 'createdAt'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      icon: row.icon || 'Folder',
      imageUrl: row.imageUrl || undefined,
      createdAt: row.createdAt || undefined
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      icon: item.icon || 'Folder',
      imageUrl: item.imageUrl || null,
      createdAt: item.createdAt || new Date().toISOString()
    })
  },
  containers: {
    createSql: `
      CREATE TABLE IF NOT EXISTS containers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        freezerId TEXT,
        templateId TEXT,
        imageUrl TEXT,
        deleteOnEmpty INTEGER DEFAULT 0,
        icon TEXT,
        isBox INTEGER DEFAULT 0,
        boxNotes TEXT,
        color TEXT,
        isArchived INTEGER DEFAULT 0
      )
    `,
    columns: ['id', 'name', 'freezerId', 'templateId', 'imageUrl', 'deleteOnEmpty', 'icon', 'isBox', 'boxNotes', 'color', 'isArchived'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      freezerId: row.freezerId || undefined,
      templateId: row.templateId || undefined,
      imageUrl: row.imageUrl || undefined,
      deleteOnEmpty: row.deleteOnEmpty === 1,
      icon: row.icon || 'Folder',
      isBox: row.isBox === 1,
      boxNotes: row.boxNotes || undefined,
      color: row.color || undefined,
      isArchived: row.isArchived === 1
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      freezerId: item.freezerId || null,
      templateId: item.templateId || null,
      imageUrl: item.imageUrl || null,
      deleteOnEmpty: item.deleteOnEmpty ? 1 : 0,
      icon: item.icon || 'Folder',
      isBox: item.isBox ? 1 : 0,
      boxNotes: item.boxNotes || null,
      color: item.color || null,
      isArchived: item.isArchived ? 1 : 0
    })
  },
  products: {
    createSql: `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        primaryCategory TEXT NOT NULL,
        subCategory TEXT NOT NULL,
        imageUrl TEXT,
        productNumbers TEXT,
        listThresholds TEXT,
        defaultTagIds TEXT,
        listControlSources TEXT,
        barcode TEXT,
        isArchived INTEGER DEFAULT 0,
        salePrice REAL DEFAULT 0,
        salePriceUnit TEXT DEFAULT 'lb'
      )
    `,
    columns: ['id', 'name', 'primaryCategory', 'subCategory', 'imageUrl', 'productNumbers', 'listThresholds', 'defaultTagIds', 'listControlSources', 'barcode', 'isArchived', 'salePrice', 'salePriceUnit'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      primaryCategory: row.primaryCategory,
      subCategory: row.subCategory,
      imageUrl: row.imageUrl || undefined,
      productNumbers: row.productNumbers ? JSON.parse(row.productNumbers) : [],
      barcode: row.barcode || undefined,
      listThresholds: row.listThresholds ? JSON.parse(row.listThresholds) : {},
      defaultTagIds: row.defaultTagIds ? JSON.parse(row.defaultTagIds) : [],
      listControlSources: row.listControlSources ? JSON.parse(row.listControlSources) : {},
      isArchived: row.isArchived === 1 || row.isArchived === true || row.isArchived === '1' ? true : false,
      salePrice: row.salePrice !== undefined && row.salePrice !== null ? Number(row.salePrice) : 0,
      salePriceUnit: row.salePriceUnit || 'lb'
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      primaryCategory: item.primaryCategory,
      subCategory: item.subCategory,
      imageUrl: item.imageUrl || null,
      productNumbers: item.productNumbers ? JSON.stringify(item.productNumbers) : null,
      barcode: item.barcode || null,
      listThresholds: item.listThresholds ? JSON.stringify(item.listThresholds) : null,
      defaultTagIds: item.defaultTagIds ? JSON.stringify(item.defaultTagIds) : null,
      listControlSources: item.listControlSources ? JSON.stringify(item.listControlSources) : null,
      isArchived: item.isArchived ? 1 : 0,
      salePrice: item.salePrice !== undefined && item.salePrice !== null ? Number(item.salePrice) : 0,
      salePriceUnit: item.salePriceUnit || 'lb'
    })
  },
  categories: {
    createSql: `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parentPrimary TEXT,
        icon TEXT
      )
    `,
    columns: ['id', 'name', 'type', 'parentPrimary', 'icon'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      parentPrimary: row.parentPrimary || undefined,
      icon: row.icon || undefined
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      parentPrimary: item.parentPrimary || null,
      icon: item.icon || null
    })
  },
  meat_cuts: {
    createSql: `
      CREATE TABLE IF NOT EXISTS meat_cuts (
        id TEXT PRIMARY KEY,
        productId TEXT,
        quantity REAL,
        containerId TEXT,
        notes TEXT,
        tagIds TEXT,
        originalCutName TEXT,
        wrongLabel TEXT
      )
    `,
    columns: [
      'id', 'productId', 'quantity', 'containerId', 'notes', 'tagIds', 'originalCutName', 'wrongLabel'
    ],
    fromDb: (row: any) => {
      const wrongLabelVal = (row.wrongLabel && String(row.wrongLabel).trim().length > 0) ? String(row.wrongLabel).trim() : undefined;
      const isWrong = Boolean(wrongLabelVal);
      return {
        id: row.id,
        productId: row.productId,
        quantity: row.quantity ?? 0,
        containerId: row.containerId || '',
        notes: row.notes || undefined,
        tagIds: row.tagIds ? JSON.parse(row.tagIds) : [],
        originalCutName: row.originalCutName || undefined,
        wrongLabel: wrongLabelVal,
        isWrongLabel: isWrong || undefined
      };
    },
    toDb: (item: any) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      containerId: item.containerId,
      notes: item.notes || null,
      tagIds: item.tagIds ? JSON.stringify(item.tagIds) : null,
      originalCutName: item.originalCutName || null,
      wrongLabel: (item.wrongLabel && typeof item.wrongLabel === 'string' && item.wrongLabel.trim()) ? item.wrongLabel.trim() : null
    })
  },
  history: {
    createSql: `
      CREATE TABLE IF NOT EXISTS history (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        description TEXT NOT NULL,
        targetId TEXT NOT NULL,
        user TEXT
      )
    `,
    columns: ['id', 'timestamp', 'description', 'targetId', 'user'],
    fromDb: (row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      description: row.description,
      targetId: row.targetId,
      user: row.user || undefined
    }),
    toDb: (item: any) => ({
      id: item.id,
      timestamp: item.timestamp,
      description: item.description,
      targetId: item.targetId,
      user: item.user || null
    })
  },
  
  
  pallets: {
    createSql: `
      CREATE TABLE IF NOT EXISTS pallets (
        id TEXT PRIMARY KEY,
        name TEXT,
        notes TEXT,
        storageLocationId TEXT,
        tagIds TEXT,
        isArchived INTEGER DEFAULT 0
      )
    `,
    columns: ['id', 'name', 'notes', 'storageLocationId', 'tagIds', 'isArchived'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      notes: row.notes || undefined,
      storageLocationId: row.storageLocationId || undefined,
      tagIds: row.tagIds ? JSON.parse(row.tagIds) : undefined,
      isArchived: row.isArchived === 1
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      notes: item.notes || null,
      storageLocationId: item.storageLocationId || null,
      tagIds: item.tagIds ? JSON.stringify(item.tagIds) : null,
      isArchived: item.isArchived ? 1 : 0
    })
  },
  boxes: {
    createSql: `
      CREATE TABLE IF NOT EXISTS boxes (
        id TEXT PRIMARY KEY,
        name TEXT,
        palletId TEXT,
        notes TEXT,
        tagIds TEXT,
        isArchived INTEGER DEFAULT 0
      )
    `,
    columns: ['id', 'name', 'palletId', 'notes', 'tagIds', 'isArchived'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      palletId: row.palletId || undefined,
      notes: row.notes || undefined,
      tagIds: row.tagIds ? JSON.parse(row.tagIds) : undefined,
      isArchived: row.isArchived === 1
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      palletId: item.palletId || null,
      notes: item.notes || null,
      tagIds: item.tagIds ? JSON.stringify(item.tagIds) : null,
      isArchived: item.isArchived ? 1 : 0
    })
  },
  off_site_entries: {
    createSql: `
      CREATE TABLE IF NOT EXISTS off_site_entries (
        id TEXT PRIMARY KEY,
        serial TEXT,
        productId TEXT,
        originalCutName TEXT,
        wrongLabel TEXT,
        packDate TEXT,
        lot TEXT,
        pieces INTEGER,
        netWeight REAL,
        box TEXT,
        notes TEXT,
        moveTo TEXT,
        tagIds TEXT,
        orderId TEXT,
        archived INTEGER DEFAULT 0,
        staged INTEGER DEFAULT 0
      )
    `,
    columns: [
      'id', 'serial', 'productId', 'originalCutName', 'wrongLabel',
      'packDate', 'lot', 'pieces', 'netWeight', 'box',
      'notes', 'moveTo', 'tagIds', 'orderId', 'archived', 'staged'
    ],
    fromDb: (row: any) => {
      const wrongLabelVal = (row.wrongLabel && String(row.wrongLabel).trim().length > 0) ? String(row.wrongLabel).trim() : undefined;
      const isWrong = Boolean(wrongLabelVal);
      return {
        id: row.id,
        serial: row.serial || '',
        productId: row.productId || undefined,
        originalCutName: row.originalCutName || '',
        wrongLabel: wrongLabelVal,
        isWrongLabel: isWrong,
        packDate: row.packDate || undefined,
        lot: row.lot || undefined,
        pieces: row.pieces || 0,
        netWeight: row.netWeight || 0,
        box: row.box || undefined,
        notes: row.notes || undefined,
        moveTo: row.moveTo || undefined,
        tagIds: row.tagIds ? JSON.parse(row.tagIds) : undefined,
        orderId: row.orderId || undefined,
        archived: row.archived === 1,
        staged: row.staged === 1
      };
    },
    toDb: (item: any) => ({
      id: item.id,
      serial: item.serial || null,
      productId: item.productId || null,
      originalCutName: item.originalCutName || null,
      wrongLabel: (item.wrongLabel && typeof item.wrongLabel === 'string' && item.wrongLabel.trim()) ? item.wrongLabel.trim() : null,
      packDate: item.packDate || null,
      lot: item.lot || null,
      pieces: item.pieces || 0,
      netWeight: item.netWeight || 0,
      box: item.box || null,
      notes: item.notes || null,
      moveTo: item.moveTo || null,
      tagIds: item.tagIds ? JSON.stringify(item.tagIds) : null,
      orderId: item.orderId || null,
      archived: item.archived ? 1 : 0,
      staged: item.staged ? 1 : 0
    })
  },
  custom_lists: {
    createSql: `
      CREATE TABLE IF NOT EXISTS custom_lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        allowNotes INTEGER DEFAULT 1,
        isInventoryControlled INTEGER DEFAULT 0,
        controlType TEXT,
        controlCondition TEXT,
        items TEXT,
        notificationEnabled INTEGER DEFAULT 0,
        notificationType TEXT DEFAULT 'all_items',
        lastNotifiedAt TEXT
      )
    `,
    columns: ['id', 'name', 'description', 'allowNotes', 'isInventoryControlled', 'controlType', 'controlCondition', 'items', 'notificationEnabled', 'notificationType', 'lastNotifiedAt'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      allowNotes: row.allowNotes === 1,
      isInventoryControlled: row.isInventoryControlled === 1,
      controlType: row.controlType || undefined,
      controlCondition: row.controlCondition || undefined,
      items: row.items ? JSON.parse(row.items) : [],
      notificationEnabled: row.notificationEnabled === 1,
      notificationType: row.notificationType || 'all_items',
      lastNotifiedAt: row.lastNotifiedAt || undefined
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      allowNotes: item.allowNotes ? 1 : 0,
      isInventoryControlled: item.isInventoryControlled ? 1 : 0,
      controlType: item.controlType || null,
      controlCondition: item.controlCondition || null,
      items: item.items ? JSON.stringify(item.items) : null,
      notificationEnabled: item.notificationEnabled ? 1 : 0,
      notificationType: item.notificationType || 'all_items',
      lastNotifiedAt: item.lastNotifiedAt || null
    })
  },
  notification_settings: {
    createSql: `
      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY,
        digestEnabled INTEGER DEFAULT 0,
        digestMode TEXT DEFAULT 'combined',
        digestTime TEXT DEFAULT '20:00',
        timezone TEXT DEFAULT 'America/New_York',
        method TEXT DEFAULT 'in_app',
        smtpHost TEXT,
        smtpPort INTEGER DEFAULT 587,
        smtpUser TEXT,
        smtpPass TEXT,
        smtpFrom TEXT,
        smtpTo TEXT,
        smtpSecure INTEGER DEFAULT 0,
        webhookUrl TEXT,
        haNotifyService TEXT DEFAULT 'notify.notify',
        haUrl TEXT,
        haToken TEXT,
        lastDigestSentAt TEXT
      )
    `,
    columns: [
      'id', 'digestEnabled', 'digestMode', 'digestTime', 'timezone', 'method',
      'smtpHost', 'smtpPort', 'smtpUser', 'smtpPass', 'smtpFrom',
      'smtpTo', 'smtpSecure', 'webhookUrl', 'haNotifyService', 'haUrl', 'haToken', 'lastDigestSentAt'
    ],
    fromDb: (row: any) => ({
      id: row.id,
      digestEnabled: row.digestEnabled === 1,
      digestMode: row.digestMode || 'combined',
      digestTime: row.digestTime || '20:00',
      timezone: row.timezone || 'America/New_York',
      method: row.method || 'in_app',
      smtpHost: row.smtpHost || '',
      smtpPort: row.smtpPort || 587,
      smtpUser: row.smtpUser || '',
      smtpPass: row.smtpPass || '',
      smtpFrom: row.smtpFrom || '',
      smtpTo: row.smtpTo || '',
      smtpSecure: row.smtpSecure === 1,
      webhookUrl: row.webhookUrl || '',
      haNotifyService: row.haNotifyService || 'notify.notify',
      haUrl: row.haUrl || '',
      haToken: row.haToken || '',
      lastDigestSentAt: row.lastDigestSentAt || ''
    }),
    toDb: (item: any) => ({
      id: item.id || 'global',
      digestEnabled: item.digestEnabled ? 1 : 0,
      digestMode: item.digestMode || 'combined',
      digestTime: item.digestTime || '20:00',
      timezone: item.timezone || 'America/New_York',
      method: item.method || 'in_app',
      smtpHost: item.smtpHost || null,
      smtpPort: item.smtpPort || 587,
      smtpUser: item.smtpUser || null,
      smtpPass: item.smtpPass || null,
      smtpFrom: item.smtpFrom || null,
      smtpTo: item.smtpTo || null,
      smtpSecure: item.smtpSecure ? 1 : 0,
      webhookUrl: item.webhookUrl || null,
      haNotifyService: item.haNotifyService || 'notify.notify',
      haUrl: item.haUrl || null,
      haToken: item.haToken || null,
      lastDigestSentAt: item.lastDigestSentAt || null
    })
  },
  notification_logs: {
    createSql: `
      CREATE TABLE IF NOT EXISTS notification_logs (
        id TEXT PRIMARY KEY,
        sentAt TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT
      )
    `,
    columns: ['id', 'sentAt', 'title', 'message', 'method', 'status', 'error'],
    fromDb: (row: any) => ({
      id: row.id,
      sentAt: row.sentAt,
      title: row.title,
      message: row.message,
      method: row.method,
      status: row.status,
      error: row.error || undefined
    }),
    toDb: (item: any) => ({
      id: item.id,
      sentAt: item.sentAt,
      title: item.title,
      message: item.message,
      method: item.method,
      status: item.status,
      error: item.error || null
    })
  },
  tags: {
    createSql: `
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        textColor TEXT,
        excludeFromDisplayRestock INTEGER DEFAULT 0
      )
    `,
    columns: ['id', 'name', 'description', 'color', 'textColor', 'excludeFromDisplayRestock'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      color: row.color || undefined,
      textColor: row.textColor || undefined,
      excludeFromDisplayRestock: row.excludeFromDisplayRestock === 1 || row.excludeFromDisplayRestock === true
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || null,
      color: item.color || null,
      textColor: item.textColor || null,
      excludeFromDisplayRestock: item.excludeFromDisplayRestock ? 1 : 0
    })
  },
  locations: {
    createSql: `
      CREATE TABLE IF NOT EXISTS locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT,
        contact TEXT,
        notes TEXT,
        isHome INTEGER DEFAULT 0,
        type TEXT NOT NULL,
        hasPallets INTEGER DEFAULT 0
      )
    `,
    columns: ['id', 'name', 'address', 'contact', 'notes', 'isHome', 'type', 'hasPallets'],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      address: row.address || undefined,
      contact: row.contact || undefined,
      notes: row.notes || undefined,
      isHome: row.isHome === 1,
      type: row.type,
      hasPallets: row.hasPallets === 1
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      address: item.address || null,
      contact: item.contact || null,
      notes: item.notes || null,
      isHome: item.isHome ? 1 : 0,
      type: item.type,
      hasPallets: item.hasPallets ? 1 : 0
    })
  },
  movement_orders: {
    createSql: `
      CREATE TABLE IF NOT EXISTS movement_orders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        palletsInPlay TEXT,
        locationsInPlay TEXT,
        targetDestinations TEXT,
        moves TEXT,
        executedAt TEXT,
        originalEntries TEXT,
        pickedBoxIds TEXT,
        deliveredBoxIds TEXT,
        pickedItemIds TEXT,
        deliveredItemIds TEXT,
        flags TEXT
      )
    `,
    columns: [
      'id', 'name', 'description', 'date', 'status', 'palletsInPlay', 'locationsInPlay',
      'targetDestinations', 'moves', 'executedAt', 'originalEntries', 'pickedBoxIds',
      'deliveredBoxIds', 'pickedItemIds', 'deliveredItemIds', 'flags'
    ],
    fromDb: (row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      date: row.date,
      status: row.status,
      palletsInPlay: row.palletsInPlay ? JSON.parse(row.palletsInPlay) : [],
      locationsInPlay: row.locationsInPlay ? JSON.parse(row.locationsInPlay) : [],
      targetDestinations: row.targetDestinations ? JSON.parse(row.targetDestinations) : undefined,
      moves: row.moves ? JSON.parse(row.moves) : [],
      executedAt: row.executedAt || undefined,
      originalEntries: row.originalEntries ? JSON.parse(row.originalEntries) : undefined,
      pickedBoxIds: row.pickedBoxIds ? JSON.parse(row.pickedBoxIds) : [],
      deliveredBoxIds: row.deliveredBoxIds ? JSON.parse(row.deliveredBoxIds) : [],
      pickedItemIds: row.pickedItemIds ? JSON.parse(row.pickedItemIds) : [],
      deliveredItemIds: row.deliveredItemIds ? JSON.parse(row.deliveredItemIds) : [],
      flags: row.flags ? JSON.parse(row.flags) : {}
    }),
    toDb: (item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || null,
      date: item.date,
      status: item.status,
      palletsInPlay: item.palletsInPlay ? JSON.stringify(item.palletsInPlay) : null,
      locationsInPlay: item.locationsInPlay ? JSON.stringify(item.locationsInPlay) : null,
      targetDestinations: item.targetDestinations ? JSON.stringify(item.targetDestinations) : null,
      moves: item.moves ? JSON.stringify(item.moves) : null,
      executedAt: item.executedAt || null,
      originalEntries: item.originalEntries ? JSON.stringify(item.originalEntries) : null,
      pickedBoxIds: item.pickedBoxIds ? JSON.stringify(item.pickedBoxIds) : null,
      deliveredBoxIds: item.deliveredBoxIds ? JSON.stringify(item.deliveredBoxIds) : null,
      pickedItemIds: item.pickedItemIds ? JSON.stringify(item.pickedItemIds) : null,
      deliveredItemIds: item.deliveredItemIds ? JSON.stringify(item.deliveredItemIds) : null,
      flags: item.flags ? JSON.stringify(item.flags) : null
    })
  },
  butcher_orders: {
    columns: ['id', 'orderNumber', 'species', 'animalCount', 'killDate', 'pickupDate', 'liveWeight', 'hotWeight', 'coldWeight', 'locationId', 'createdAt', 'birthDate', 'notes', 'documents', 'butcherFee'],
    createSql: `CREATE TABLE IF NOT EXISTS butcher_orders (
      id TEXT PRIMARY KEY,
      orderNumber TEXT NOT NULL,
      species TEXT NOT NULL,
      animalCount INTEGER,
      killDate TEXT NOT NULL,
      pickupDate TEXT,
      liveWeight REAL NOT NULL,
      hotWeight REAL NOT NULL,
      coldWeight REAL NOT NULL,
      locationId TEXT,
      createdAt INTEGER NOT NULL,
      birthDate TEXT,
      notes TEXT,
      documents TEXT,
      butcherFee REAL DEFAULT 0
    )`,
    fromDb: (row: any) => ({
      id: row.id,
      orderNumber: row.orderNumber,
      species: row.species,
      animalCount: row.animalCount,
      killDate: row.killDate || '',
      pickupDate: row.pickupDate || '',
      liveWeight: row.liveWeight,
      hotWeight: row.hotWeight,
      coldWeight: row.coldWeight,
      locationId: row.locationId || undefined,
      createdAt: row.createdAt,
      birthDate: row.birthDate || '',
      notes: row.notes || '',
      documents: row.documents ? JSON.parse(row.documents) : [],
      butcherFee: row.butcherFee !== undefined && row.butcherFee !== null ? row.butcherFee : 0
    }),
    toDb: (item: any) => ({
      id: item.id,
      orderNumber: item.orderNumber,
      species: item.species,
      animalCount: item.animalCount || null,
      killDate: item.killDate || '',
      pickupDate: item.pickupDate || '',
      liveWeight: item.liveWeight,
      hotWeight: item.hotWeight,
      coldWeight: item.coldWeight,
      locationId: item.locationId || null,
      createdAt: item.createdAt,
      birthDate: item.birthDate || '',
      notes: item.notes || '',
      documents: item.documents ? JSON.stringify(item.documents) : null,
      butcherFee: item.butcherFee !== undefined ? item.butcherFee : 0
    })
  },
  app_config: {
    createSql: `
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updatedAt TEXT
      )
    `,
    columns: ['key', 'value', 'updatedAt'],
    fromDb: (row: any) => ({
      key: row.key,
      value: row.value,
      updatedAt: row.updatedAt
    }),
    toDb: (item: any) => ({
      key: item.key,
      value: item.value,
      updatedAt: item.updatedAt || new Date().toISOString()
    })
  }
};


function initDatabase() {
  let dbPath = getDatabasePath();

  const tryInit = () => {
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        const configData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        isDemoMode = !!configData.isDemoMode;
      } catch (e) {
        // ignore
      }
    }
    dbPath = getDatabasePath();
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    
    
    
    // 1. Ensure all relational tables exist according to TABLE_SCHEMAS
    for (const table of Object.keys(TABLE_SCHEMAS)) {
      db.prepare(TABLE_SCHEMAS[table].createSql).run();
    }

    // 2. Ensure boxes and pallets tables have the isArchived column
    try {
      const palletCols = db.prepare("PRAGMA table_info(pallets)").all() as any[];
      if (!palletCols.some(col => col.name === 'isArchived')) {
        db.prepare("ALTER TABLE pallets ADD COLUMN isArchived INTEGER DEFAULT 0").run();
      }
    } catch (e) {
      console.error("Error adding isArchived to pallets:", e);
    }

    try {
      const boxCols = db.prepare("PRAGMA table_info(boxes)").all() as any[];
      if (!boxCols.some(col => col.name === 'isArchived')) {
        db.prepare("ALTER TABLE boxes ADD COLUMN isArchived INTEGER DEFAULT 0").run();
      }
    } catch (e) {
      console.error("Error adding isArchived to boxes:", e);
    }

    try {
      const offSiteCols = db.prepare("PRAGMA table_info(off_site_entries)").all() as any[];
      if (!offSiteCols.some(c => c.name === 'staged')) {
        db.prepare("ALTER TABLE off_site_entries ADD COLUMN staged INTEGER DEFAULT 0").run();
      }
      if (!offSiteCols.some(c => c.name === 'originalCutName')) {
        db.prepare("ALTER TABLE off_site_entries ADD COLUMN originalCutName TEXT").run();
      }
      if (!offSiteCols.some(c => c.name === 'wrongLabel')) {
        console.log("Adding 'wrongLabel' column to off_site_entries table...");
        db.prepare("ALTER TABLE off_site_entries ADD COLUMN wrongLabel TEXT").run();
      }
    } catch (e) {
      console.error("Error adding columns to off_site_entries:", e);
    }

    // 3. Ensure custom_lists and notification_settings have notification & timezone columns
    try {
      const listCols = db.prepare("PRAGMA table_info(custom_lists)").all() as any[];
      if (!listCols.some(col => col.name === 'notificationEnabled')) {
        db.prepare("ALTER TABLE custom_lists ADD COLUMN notificationEnabled INTEGER DEFAULT 0").run();
      }
      if (!listCols.some(col => col.name === 'notificationType')) {
        db.prepare("ALTER TABLE custom_lists ADD COLUMN notificationType TEXT DEFAULT 'all_items'").run();
      }
      if (!listCols.some(col => col.name === 'lastNotifiedAt')) {
        db.prepare("ALTER TABLE custom_lists ADD COLUMN lastNotifiedAt TEXT").run();
      }

      const categoryCols = db.prepare("PRAGMA table_info(categories)").all() as any[];
      if (categoryCols.some(col => col.name === 'color')) {
        console.log("Removing 'color' column from categories table...");
        try {
          db.prepare("ALTER TABLE categories DROP COLUMN color").run();
        } catch (dropErr) {
          console.error("Could not drop color column from categories table:", dropErr);
        }
      }

      const settingsCols = db.prepare("PRAGMA table_info(notification_settings)").all() as any[];
      if (!settingsCols.some(col => col.name === 'timezone')) {
        db.prepare("ALTER TABLE notification_settings ADD COLUMN timezone TEXT DEFAULT 'America/New_York'").run();
      }

      const tagCols = db.prepare("PRAGMA table_info(tags)").all() as any[];
      if (!tagCols.some(col => col.name === 'excludeFromDisplayRestock')) {
        db.prepare("ALTER TABLE tags ADD COLUMN excludeFromDisplayRestock INTEGER DEFAULT 0").run();
      }

      const productCols = db.prepare("PRAGMA table_info(products)").all() as any[];
      if (!productCols.some(col => col.name === 'listControlSources')) {
        console.log("Adding 'listControlSources' column to products table...");
        db.prepare("ALTER TABLE products ADD COLUMN listControlSources TEXT").run();
      }
      if (!productCols.some(col => col.name === 'barcode')) {
        console.log("Adding 'barcode' column to products table...");
        db.prepare("ALTER TABLE products ADD COLUMN barcode TEXT").run();
      }
      if (!productCols.some(col => col.name === 'isArchived')) {
        console.log("Adding 'isArchived' column to products table...");
        db.prepare("ALTER TABLE products ADD COLUMN isArchived INTEGER DEFAULT 0").run();
      }
      if (!productCols.some(col => col.name === 'salePrice')) {
        console.log("Adding 'salePrice' column to products table...");
        db.prepare("ALTER TABLE products ADD COLUMN salePrice REAL DEFAULT 0").run();
      }
      if (!productCols.some(col => col.name === 'salePriceUnit')) {
        console.log("Adding 'salePriceUnit' column to products table...");
        db.prepare("ALTER TABLE products ADD COLUMN salePriceUnit TEXT DEFAULT 'lb'").run();
      }

      // Backfill missing default UPC-A barcodes for products with productNumbers
      try {
        const productsWithoutBarcode = db.prepare("SELECT id, productNumbers, barcode FROM products WHERE barcode IS NULL OR barcode = ''").all() as any[];
        if (productsWithoutBarcode && productsWithoutBarcode.length > 0) {
          const updateBarcodeStmt = db.prepare("UPDATE products SET barcode = ? WHERE id = ?");
          for (const pRow of productsWithoutBarcode) {
            if (pRow.productNumbers) {
              try {
                const nums = JSON.parse(pRow.productNumbers);
                if (Array.isArray(nums) && nums.length > 0 && nums[0]) {
                  const defaultBc = generateDefaultUpcABarcode(nums[0]);
                  if (defaultBc) {
                    updateBarcodeStmt.run(defaultBc, pRow.id);
                  }
                }
              } catch (parseErr) {}
            }
          }
        }
      } catch (bcMigrateErr) {
        console.error("Error backfilling product barcodes in SQLite:", bcMigrateErr);
      }

      const containerCols = db.prepare("PRAGMA table_info(containers)").all() as any[];
      if (!containerCols.some(col => col.name === 'templateId')) {
        console.log("Adding 'templateId' column to containers table...");
        db.prepare("ALTER TABLE containers ADD COLUMN templateId TEXT").run();
      }

      const meatCutCols = db.prepare("PRAGMA table_info(meat_cuts)").all() as any[];
      if (!meatCutCols.some(c => c.name === 'originalCutName')) {
        console.log("Adding 'originalCutName' column to meat_cuts table...");
        db.prepare("ALTER TABLE meat_cuts ADD COLUMN originalCutName TEXT").run();
      }
      if (!meatCutCols.some(c => c.name === 'wrongLabel')) {
        console.log("Adding 'wrongLabel' column to meat_cuts table...");
        db.prepare("ALTER TABLE meat_cuts ADD COLUMN wrongLabel TEXT").run();
      }
    } catch (e) {
      console.error("Error checking/adding notification columns:", e);
    }



    // 4. Ensure explicit custom indexes exist for highly-queried filtering columns
    console.log('Initializing database custom indexes...');
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cuts_product ON meat_cuts(productId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cuts_container ON meat_cuts(containerId)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_containers_freezer ON containers(freezerId)`).run();
    db.prepare(`DROP INDEX IF EXISTS idx_offsite_location`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_offsite_box ON off_site_entries(box)`).run();
    
    // Explicitly drop deprecated butcher_records table if it exists
    try {
      db.prepare("DROP TABLE IF EXISTS butcher_records").run();
    } catch (e) {
      console.error("Error dropping obsolete 'butcher_records' table:", e);
    }

    // Ensure custom_lists has notification columns
    try {
      const listCols = db.prepare("PRAGMA table_info(custom_lists)").all() as any[];
      if (!listCols.some(col => col.name === 'notificationEnabled')) {
        console.log("Adding 'notificationEnabled' column to custom_lists table...");
        db.prepare("ALTER TABLE custom_lists ADD COLUMN notificationEnabled INTEGER DEFAULT 0").run();
      }
      if (!listCols.some(col => col.name === 'notificationType')) {
        console.log("Adding 'notificationType' column to custom_lists table...");
        db.prepare("ALTER TABLE custom_lists ADD COLUMN notificationType TEXT DEFAULT 'all_items'").run();
      }
      if (!listCols.some(col => col.name === 'lastNotifiedAt')) {
        console.log("Adding 'lastNotifiedAt' column to custom_lists table...");
        db.prepare("ALTER TABLE custom_lists ADD COLUMN lastNotifiedAt TEXT").run();
      }

      const settingsCols = db.prepare("PRAGMA table_info(notification_settings)").all() as any[];
      if (!settingsCols.some(col => col.name === 'timezone')) {
        console.log("Adding 'timezone' column to notification_settings table...");
        db.prepare("ALTER TABLE notification_settings ADD COLUMN timezone TEXT DEFAULT 'America/New_York'").run();
      }
    } catch (e) {
      console.error("Error checking/adding notification columns:", e);
    }

    // Ensure butcher_orders has documents column
    try {
      const butcherOrderCols = db.prepare("PRAGMA table_info(butcher_orders)").all() as any[];
      if (!butcherOrderCols.some(col => col.name === 'documents')) {
        console.log("Adding 'documents' column to butcher_orders table...");
        db.prepare("ALTER TABLE butcher_orders ADD COLUMN documents TEXT").run();
      }
      if (!butcherOrderCols.some(col => col.name === 'butcherFee')) {
        console.log("Adding 'butcherFee' column to butcher_orders table...");
        db.prepare("ALTER TABLE butcher_orders ADD COLUMN butcherFee REAL DEFAULT 0").run();
      }
    } catch (e) {
      console.error("Error checking/adding documents or butcherFee column to butcher_orders:", e);
    }

    console.log('Custom indexes initialized successfully.');
  };

  try {
    tryInit();
  } catch (err: any) {
    console.warn('Initial SQLite database check reported issue (initiating automatic recovery flow):', err.message || err);
    
    // Attempt automatic recovery
    try {
      if (db) {
        db.close();
      }
    } catch (closeErr) {
      // ignore
    }
    db = null;

    console.warn(`Attempting automatic database recovery for ${dbPath}...`);
    
    // Move the malformed files to a backup location so they are not deleted permanently
    const timestamp = Date.now();
    const malformedBackup = `${dbPath}_malformed_${timestamp}`;
    let moveSuccess = false;
    
    try {
      if (fs.existsSync(dbPath)) {
        fs.renameSync(dbPath, malformedBackup);
        console.warn(`Moved malformed database file to ${malformedBackup}`);
      }
      if (fs.existsSync(dbPath + '-wal')) {
        fs.renameSync(dbPath + '-wal', malformedBackup + '-wal');
      }
      if (fs.existsSync(dbPath + '-shm')) {
        fs.renameSync(dbPath + '-shm', malformedBackup + '-shm');
      }
      moveSuccess = true;
    } catch (renameErr) {
      console.error('Failed to move malformed database files via rename. Trying to delete directly...', renameErr);
    }

    // If rename failed, try to directly unlink/delete the corrupt files
    if (!moveSuccess) {
      try {
        if (fs.existsSync(dbPath)) {
          fs.unlinkSync(dbPath);
          console.warn(`Successfully deleted malformed database file directly: ${dbPath}`);
        }
        if (fs.existsSync(dbPath + '-wal')) {
          fs.unlinkSync(dbPath + '-wal');
        }
        if (fs.existsSync(dbPath + '-shm')) {
          fs.unlinkSync(dbPath + '-shm');
        }
        moveSuccess = true;
      } catch (unlinkErr) {
        console.error('Failed to delete malformed database files directly:', unlinkErr);
      }
    }

    // If both rename and delete failed (database is locked permanently or inaccessible),
    // override the active database path with a fresh path to bypass the lock and keep the app running.
    if (!moveSuccess) {
      const recoveredDbPath = `${dbPath.slice(0, -3)}_recovered_${timestamp}.db`;
      console.warn(`Database files are permanently locked or inaccessible. Falling back to fresh database path: ${recoveredDbPath}`);
      activeDbPathOverride = recoveredDbPath;
      dbPath = recoveredDbPath;
    }

    // Attempt to restore from the latest valid db backup in BACKUPS_DIR
    let restoredFromBackup = false;
    try {
      if (fs.existsSync(BACKUPS_DIR)) {
        const files = fs.readdirSync(BACKUPS_DIR);
        const dbBackups = files
          .filter(f => f.endsWith('.db'))
          .map(f => {
            const fullPath = path.join(BACKUPS_DIR, f);
            const stat = fs.statSync(fullPath);
            return { filename: f, path: fullPath, mtime: stat.mtime.getTime() };
          })
          .sort((a, b) => b.mtime - a.mtime);

        for (const backup of dbBackups) {
          console.warn(`Attempting to restore from backup: ${backup.filename}`);
          try {
            fs.copyFileSync(backup.path, dbPath);
            
            // Clean up any stale wal/shm files from copying
            if (fs.existsSync(dbPath + '-wal')) {
              try { fs.unlinkSync(dbPath + '-wal'); } catch (e) {}
            }
            if (fs.existsSync(dbPath + '-shm')) {
              try { fs.unlinkSync(dbPath + '-shm'); } catch (e) {}
            }

            // Verify if the restored file can be opened and successfully queried
            const testDb = new Database(dbPath);
            testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            testDb.close();
            
            restoredFromBackup = true;
            console.log(`Successfully restored database from backup: ${backup.filename}`);
            break;
          } catch (restoreErr) {
            console.error(`Backup ${backup.filename} was invalid or failed integrity test:`, restoreErr);
            try {
              if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
              if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
              if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
            } catch (cleanupErr) {}
          }
        }
      }
    } catch (backupsErr) {
      console.error('Error scanning backups directory during recovery:', backupsErr);
    }

    if (!restoredFromBackup) {
      if (fs.existsSync(FALLBACK_DB)) {
        console.warn('No valid SQLite backups found. Re-initializing a fresh database; system will auto-restore from the fallback JSON.');
      } else {
        console.warn('No valid SQLite backups or fallback JSON found. Re-initializing a completely fresh database.');
      }
    }

    // Now initialize again. If this fails, we catch it and force a clean dynamic path.
    try {
      tryInit();
    } catch (secondInitErr) {
      console.error('Second database initialization failed. Forcing a completely fresh empty database...', secondInitErr);
      
      // Close the db if open
      try {
        if (db) db.close();
      } catch (e) {}
      db = null;
      
      // Delete the corrupt files at dbPath
      try {
        if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
        if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
        if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
      } catch (e) {}
      
      // Shift database path to a fresh timestamped path to avoid any locking or disk sector issues
      const finalDbPath = `${getDatabasePath().slice(0, -3)}_fresh_${Date.now()}.db`;
      console.warn(`Setting database path to clean empty database: ${finalDbPath}`);
      activeDbPathOverride = finalDbPath;
      
      // Try one last time to initialize a completely clean database
      tryInit();
    }
  }
}

function saveTableData(tableName: string, items: any[]) {
  const schema = TABLE_SCHEMAS[tableName];
  if (!schema) {
    console.error(`No schema defined for table ${tableName}`);
    return;
  }
  
  const cols = schema.columns;
  const placeholders = cols.map(() => '?').join(', ');
  const insertStmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`);
  
  for (const item of items) {
    if (item && item.id) {
      const dbObj = schema.toDb(item);
      const values = cols.map(col => dbObj[col] === undefined ? null : dbObj[col]);
      insertStmt.run(...values);
    }
  }
}

function loadTableData(tableName: string): any[] {
  try {
    const schema = TABLE_SCHEMAS[tableName];
    if (!schema) {
      console.error(`No schema defined for table ${tableName}`);
      return [];
    }
    const rows = db.prepare(`SELECT * FROM ${tableName}`).all() as any[];
    return rows.map(r => schema.fromDb(r));
  } catch (err) {
    console.error(`Error loading table ${tableName}:`, err);
    return [];
  }
}

function syncTableData(tableName: string, items: any[]) {
  const schema = TABLE_SCHEMAS[tableName];
  if (!schema) {
    console.error(`No schema defined for table ${tableName}`);
    return;
  }
  
  const validItems = (items || []).filter(item => item && item.id);
  const newIds = new Set(validItems.map(item => item.id));
  
  const existingRows = db.prepare(`SELECT id FROM ${tableName}`).all() as { id: string }[];
  const existingIds = new Set(existingRows.map(row => row.id));
  
  const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`);
  
  const cols = schema.columns;
  const placeholders = cols.map(() => '?').join(', ');
  const insertStmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`);
  
  for (const id of existingIds) {
    if (!newIds.has(id)) {
      deleteStmt.run(id);
    }
  }
  
  for (const item of validItems) {
    const dbObj = schema.toDb(item);
    const values = cols.map(col => dbObj[col] === undefined ? null : dbObj[col]);
    insertStmt.run(...values);
  }
}

function loadStateSync(): AppInventoryState {
  if (!db) {
    initDatabase();
  }
  
  const tables = Object.keys(TABLE_SCHEMAS);
  let totalRows = 0;
  for (const table of tables) {
    const res = db.prepare(`SELECT count(*) as count FROM ${table}`).get() as { count: number };
    totalRows += res.count;
  }
  
  if (totalRows === 0 && !fs.existsSync(FALLBACK_DB)) {
    const transaction = db.transaction(() => {
      saveTableData('freezers', defaultInitialState.freezers || []);
      saveTableData('containers', defaultInitialState.containers || []);
      saveTableData('products', defaultInitialState.products || []);
      saveTableData('categories', defaultInitialState.categories || []);
      saveTableData('meat_cuts', defaultInitialState.meatCuts || []);
      saveTableData('history', defaultInitialState.history || []);
      saveTableData('off_site_entries', defaultInitialState.offSiteEntries || []);
      saveTableData('butcher_orders', defaultInitialState.butcherOrders || []);
      saveTableData('custom_lists', defaultInitialState.customLists || []);
      saveTableData('tags', defaultInitialState.tags || []);
      saveTableData('locations', defaultInitialState.locations || []);
      saveTableData('movement_orders', defaultInitialState.movementOrders || []);
    });
    transaction();
    
    try {
      fs.writeFileSync(FALLBACK_DB, JSON.stringify(defaultInitialState, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving initial fallback JSON:', err);
    }
    
    return defaultInitialState;
  }
  
  try {
    const products = loadTableData('products');
    const rawOffSiteEntries = loadTableData('off_site_entries');
    
    const offSiteEntries = rawOffSiteEntries.map((e: any) => {
      const wrongLabelVal = (e.wrongLabel && typeof e.wrongLabel === 'string' && e.wrongLabel.trim()) ? e.wrongLabel.trim() : undefined;
      const isWrong = Boolean(wrongLabelVal);
      return {
        ...e,
        wrongLabel: wrongLabelVal,
        isWrongLabel: isWrong,
        originalCutName: e.originalCutName || undefined
      };
    });

    const rawMeatCuts = loadTableData('meat_cuts');
    const meatCuts = rawMeatCuts.map((mc: any) => {
      const wrongLabelVal = (mc.wrongLabel && typeof mc.wrongLabel === 'string' && mc.wrongLabel.trim()) ? mc.wrongLabel.trim() : undefined;
      const isWrong = Boolean(wrongLabelVal);
      return {
        ...mc,
        wrongLabel: wrongLabelVal,
        isWrongLabel: isWrong ? true : undefined,
        originalCutName: mc.originalCutName || undefined
      };
    });
    
    // Dynamically derive butcherRecords from offSiteEntries where orderId is not null!
    const butcherRecords = offSiteEntries
      .filter((e: any) => e.orderId)
      .map((e: any) => ({
        id: e.id,
        orderId: e.orderId,
        serial: e.serial,
        originalCutName: e.originalCutName || e.cuts,
        normalizedCutName: e.normalizedCutName || e.cuts,
        packDate: e.packDate,
        lot: e.lot,
        pieces: e.pieces,
        netWeight: e.netWeight,
        box: e.box,
        importedToOffSite: !e.archived
      }));

    let notificationSettings = loadTableData('notification_settings');
    if (notificationSettings.length === 0) {
      const defaultSettings = {
        id: 'global',
        digestEnabled: false,
        digestMode: 'combined',
        digestTime: '20:00',
        method: 'in_app',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPass: '',
        smtpFrom: '',
        smtpTo: '',
        smtpSecure: false,
        webhookUrl: '',
        haNotifyService: 'notify.notify',
        haUrl: '',
        haToken: '',
        lastDigestSentAt: ''
      };
      saveTableData('notification_settings', [defaultSettings]);
      notificationSettings = [defaultSettings];
    }

    let containerTemplates = loadTableData('container_templates') || [];

    return {
      freezers: loadTableData('freezers'),
      containers: loadTableData('containers'),
      containerTemplates: containerTemplates,
      products: products,
      categories: loadTableData('categories'),
      meatCuts: meatCuts,
      history: loadTableData('history'),
      offSiteEntries: offSiteEntries,
      pallets: loadTableData('pallets') || [],
      boxes: loadTableData('boxes') || [],
      butcherOrders: loadTableData('butcher_orders'),
      butcherRecords: butcherRecords,
      customLists: loadTableData('custom_lists'),
      tags: loadTableData('tags'),
      locations: loadTableData('locations'),
      movementOrders: loadTableData('movement_orders'),
      notificationSettings: notificationSettings,
      notificationLogs: loadTableData('notification_logs') || []
    };
  } catch (err) {
    console.error('Error loading state from SQLite:', err);
    return defaultInitialState;
  }
}

function saveStateSync(state: AppInventoryState) {
  if (!db) {
    initDatabase();
  }
  
  try {
    const transaction = db.transaction(() => {
      // Filter out dynamically added virtual pallets and boxes before syncing to database!
      const pureFreezers = (state.freezers || []).filter((f: any) => !f.isPallet && !f.id.startsWith('pallet-'));
      const pureContainers = (state.containers || []).filter((c: any) => !c.isBox && !c.id.startsWith('box-'));

      syncTableData('freezers', pureFreezers);
      syncTableData('containers', pureContainers);
      syncTableData('container_templates', state.containerTemplates || []);
      syncTableData('products', state.products || []);
      syncTableData('categories', state.categories || []);
      syncTableData('meat_cuts', state.meatCuts || []);
      syncTableData('history', state.history || []);
      syncTableData('pallets', state.pallets || []);
      syncTableData('boxes', state.boxes || []);
      
      // Combine state.offSiteEntries and state.butcherRecords into off_site_entries table!
      const mergedOffSiteEntriesMap = new Map<string, any>();
      for (const e of state.offSiteEntries || []) {
        mergedOffSiteEntriesMap.set(e.id, { ...e, archived: e.archived ? 1 : 0 });
      }
      for (const r of state.butcherRecords || []) {
        let existing = mergedOffSiteEntriesMap.get(r.id);
        if (!existing && r.serial && r.serial.trim()) {
          const serialLower = r.serial.trim().toLowerCase();
          for (const val of mergedOffSiteEntriesMap.values()) {
            if (val.serial && val.serial.trim().toLowerCase() === serialLower) {
              existing = val;
              break;
            }
          }
        }
        
        if (existing) {
          existing.orderId = r.orderId || existing.orderId;
          if (!existing.wrongLabelOriginal && r.originalCutName && r.originalCutName.trim() !== (existing.cuts || '').trim()) {
            existing.originalCutName = r.originalCutName;
          }
          if (r.normalizedCutName && r.normalizedCutName.trim() !== (existing.cuts || '').trim()) {
            existing.normalizedCutName = r.normalizedCutName;
          }
          // Preserve the existing entry's archived status as it represents active off-site inventory
          existing.archived = (existing.archived === 1 || existing.archived === true) ? 1 : 0;
        } else {
          mergedOffSiteEntriesMap.set(r.id, {
            id: r.id,
            serial: r.serial || '',
            cuts: r.normalizedCutName || r.originalCutName || '',
            originalCutName: r.originalCutName || '',
            normalizedCutName: r.normalizedCutName || '',
            packDate: r.packDate || '',
            lot: r.lot || '',
            pieces: r.pieces ?? 0,
            netWeight: r.netWeight ?? 0,
            box: r.box || '',
            location: r.location || '',
            pallet: r.pallet || '',
            currentLocation: r.currentLocation || '',
            notes: r.notes || '',
            storageLocationId: r.storageLocationId || '',
            boxNotes: r.boxNotes || '',
            moveTo: r.moveTo || '',
            tagIds: r.tagIds || [],
            orderId: r.orderId,
            archived: r.importedToOffSite ? 0 : 1
          });
        }
      }
      const finalOffSiteEntriesList = Array.from(mergedOffSiteEntriesMap.values());
      syncTableData('off_site_entries', finalOffSiteEntriesList);
      
      syncTableData('butcher_orders', state.butcherOrders || []);
      // No separate sync of butcher_records anymore as they are merged in off_site_entries!
      syncTableData('custom_lists', state.customLists || []);
      syncTableData('tags', state.tags || []);
      syncTableData('locations', state.locations || []);
      syncTableData('movement_orders', state.movementOrders || []);
      if (state.notificationSettings) {
        syncTableData('notification_settings', state.notificationSettings);
      }
      if (state.notificationLogs) {
        syncTableData('notification_logs', state.notificationLogs);
      }
    });
    transaction();
  } catch (err) {
    console.error('Error saving state to SQLite:', err);
  }
}

// Helper to guarantee standard special containers exist in the system
function normalizeState(state: AppInventoryState): AppInventoryState {
  const stagingLoose = state.containers.find(c => c.id === 'staging_loose');
  let containers = [...state.containers];
  let changed = false;

  if (!stagingLoose) {
    containers.push({
      id: 'staging_loose',
      name: 'Loose',
      freezerId: undefined
    });
    changed = true;
  } else if (stagingLoose.name !== 'Loose') {
    containers = containers.map(c => c.id === 'staging_loose' ? { ...c, name: 'Loose' } : c);
    changed = true;
  }

  // Ensure every freezer always has its loose stock container
  state.freezers.forEach(f => {
    const looseId = f.id + "_loose";
    const exists = containers.some(c => c.id === looseId);
    if (!exists) {
      containers.push({
        id: looseId,
        name: "Loose",
        freezerId: f.id
      });
      changed = true;
    } else {
      // Ensure freezerId and name of existing loose container are kept correct
      const existing = containers.find(c => c.id === looseId);
      if (existing && (existing.freezerId !== f.id || existing.name !== "Loose")) {
        containers = containers.map(c => c.id === looseId ? { ...c, freezerId: f.id, name: "Loose" } : c);
        changed = true;
      }
    }
  });

  if (changed) {
    state.containers = containers;
  }

  // Ensure categories strip deprecated color properties
  if (state.categories && Array.isArray(state.categories)) {
    state.categories = state.categories.map((c: any) => {
      if (c && typeof c === 'object' && ('color' in c)) {
        const { color, ...rest } = c;
        return rest;
      }
      return c;
    });
  }

  // Guarantee customLists exist and have valid controlSource defaults
  if (!state.customLists) {
    state.customLists = [];
  } else {
    state.customLists = state.customLists.map(cl => ({
      ...cl,
      items: (cl.items || []).map(item => ({
        ...item,
        controlSource: item.controlSource || 'onsite_count'
      }))
    }));
  }

  // Guarantee tags exist
  if (!state.tags) {
    state.tags = [];
  } else {
    // Ensure 'not-for-sale' tag gets excludeFromDisplayRestock = true if present and undefined
    state.tags = state.tags.map(t => {
      if (t.id === 'not-for-sale' && t.excludeFromDisplayRestock === undefined) {
        return { ...t, excludeFromDisplayRestock: true };
      }
      return t;
    });
  }

  // Ensure products have defaultTagIds and default UPC-A barcode
  if (state.products) {
    state.products = state.products.map(p => {
      let barcode = p.barcode;
      if (!barcode && p.productNumbers && p.productNumbers.length > 0 && p.productNumbers[0]) {
        barcode = generateDefaultUpcABarcode(p.productNumbers[0]);
      }
      return {
        ...p,
        defaultTagIds: p.defaultTagIds || [],
        barcode: barcode || undefined
      };
    });
  }

  // Migrate and align meatCuts tags and clean up false wrong-label assignments
  if (state.meatCuts) {
    state.meatCuts = state.meatCuts.map(mc => {
      const tagIds = mc.tagIds || [];
      const updatedTagIds = [...tagIds];
      
      if ((mc as any).workingFrom && !updatedTagIds.includes('use-first')) {
        updatedTagIds.push('use-first');
      }
      if ((mc as any).notForSale && !updatedTagIds.includes('not-for-sale')) {
        updatedTagIds.push('not-for-sale');
      }

      const wrongLabelVal = (mc.wrongLabel && typeof mc.wrongLabel === 'string' && mc.wrongLabel.trim().length > 0) ? mc.wrongLabel.trim() : undefined;
      const isWrong = Boolean(wrongLabelVal);

      const { workingFrom, notForSale, ...rest } = mc as any;
      
      return {
        ...rest,
        originalCutName: mc.originalCutName || undefined,
        wrongLabel: wrongLabelVal,
        isWrongLabel: isWrong ? true : undefined,
        tagIds: updatedTagIds
      } as any;
    });
  }

  // Normalize offsite entries
  if (state.offSiteEntries) {
    state.offSiteEntries = state.offSiteEntries.map(e => {
      const wrongLabelVal = (e.wrongLabel && typeof e.wrongLabel === 'string' && e.wrongLabel.trim().length > 0) ? e.wrongLabel.trim() : undefined;
      const isWrong = Boolean(wrongLabelVal);

      let shouldBeArchived = e.archived === true || e.archived === 1 || String(e.archived) === 'true';
      
      return { 
        ...e, 
        tagIds: e.tagIds || [],
        originalCutName: e.originalCutName || undefined,
        wrongLabel: wrongLabelVal,
        isWrongLabel: isWrong,
        archived: shouldBeArchived,
        ...(shouldBeArchived ? {
          location: '',
          currentLocation: '',
          pallet: '',
          storageLocationId: '',
          moveTo: ''
        } : {})
      };
    });
  }
  
  if (!state.butcherOrders) {
    state.butcherOrders = [];
  } else {
    state.butcherOrders = state.butcherOrders.map(o => ({
      ...o,
      pickupDate: o.pickupDate || '',
      birthDate: o.birthDate || '',
      notes: o.notes || '',
      documents: o.documents || [],
      butcherFee: o.butcherFee !== undefined ? Number(o.butcherFee) : 0
    }));
  }
  if (!state.butcherRecords) {
    state.butcherRecords = [];
  }

  // Guarantee locations array exists
  if (!state.locations) {
    state.locations = [];
  } else {
    state.locations = state.locations.map(loc => ({
      ...loc,
      hasPallets: true
    }));
  }

  // Synchronize pallets and boxes into freezers/containers catalogs
  if (state.offSiteEntries) {
    let nextFreezers = [...(state.freezers || [])];
    let nextContainers = [...(state.containers || [])];
    let catalogsChanged = false;

    // 1. Gather all unique pallets from offSiteEntries and state.pallets
    const uniquePallets = Array.from(new Set([
      ...state.offSiteEntries
        .map(e => e.pallet || e.currentLocation)
        .filter(p => p && p.trim() !== '' && p.toLowerCase() !== 'home'),
      ...(state.pallets || []).map(p => p.name).filter(Boolean)
    ])) as string[];

    for (const pName of uniquePallets) {
      const palletId = 'pallet-' + pName.replace(/\s+/g, '-').toLowerCase();
      const existingPallet = nextFreezers.find(f => f.id === palletId || f.name.toLowerCase() === pName.toLowerCase());
      const pObj = (state.pallets || []).find((p: any) => p.name.toLowerCase().trim() === pName.toLowerCase().trim());
      const isArchivedPallet = pObj ? !!pObj.isArchived : false;

      if (!existingPallet) {
        nextFreezers.push({
          id: palletId,
          name: pName,
          isSpecial: false,
          isLooseOnly: false,
          isPallet: true,
          isArchived: isArchivedPallet
        } as any);
        catalogsChanged = true;
      } else {
        let palletUpdated = false;
        if (!existingPallet.isPallet) {
          existingPallet.isPallet = true;
          palletUpdated = true;
        }
        if ((existingPallet as any).isArchived !== isArchivedPallet) {
          (existingPallet as any).isArchived = isArchivedPallet;
          palletUpdated = true;
        }
        if (palletUpdated) {
          catalogsChanged = true;
        }
      }
    }

    // 2. Gather all unique boxes from offSiteEntries and state.boxes
    const uniqueBoxes = Array.from(new Set([
      ...state.offSiteEntries
        .map(e => e.box)
        .filter(b => b && b.trim() !== ''),
      ...(state.boxes || []).map(b => b.name).filter(Boolean)
    ])) as string[];

    for (const bName of uniqueBoxes) {
      const boxId = 'box-' + bName.replace(/\s+/g, '-').toLowerCase();
      const existingBox = nextContainers.find(c => c.id === boxId || c.name.toLowerCase() === bName.toLowerCase());
      const bObj = (state.boxes || []).find((b: any) => b.name.toLowerCase().trim() === bName.toLowerCase().trim());
      const isArchivedBox = bObj ? !!bObj.isArchived : false;

      // Try to find the pallet/freezer this box is currently on
      const entryWithBox = state.offSiteEntries.find(e => e.box === bName);
      const parentPalletName = entryWithBox ? (entryWithBox.pallet || entryWithBox.currentLocation) : '';
      let parentFreezerId: string | undefined = undefined;
      if (parentPalletName && parentPalletName.trim() !== '' && parentPalletName.toLowerCase() !== 'home') {
        parentFreezerId = 'pallet-' + parentPalletName.replace(/\s+/g, '-').toLowerCase();
      }

      if (!existingBox) {
        nextContainers.push({
          id: boxId,
          name: bName,
          freezerId: parentFreezerId,
          isBox: true,
          deleteOnEmpty: true,
          icon: 'package',
          isArchived: isArchivedBox
        });
        catalogsChanged = true;
      } else {
        let boxUpdated = false;
        if (!existingBox.isBox) {
          existingBox.isBox = true;
          boxUpdated = true;
        }
        if (existingBox.isArchived !== isArchivedBox) {
          existingBox.isArchived = isArchivedBox;
          boxUpdated = true;
        }
        if (existingBox.freezerId !== parentFreezerId) {
          existingBox.freezerId = parentFreezerId;
          boxUpdated = true;
        }
        if (boxUpdated) {
          catalogsChanged = true;
        }
      }
    }

    if (catalogsChanged) {
      state.freezers = nextFreezers;
      state.containers = nextContainers;
    }
  }

  // Intercept and auto-synchronize relational offsite entries and boxNotes
  if (state.offSiteEntries) {
    if (!state.pallets) state.pallets = [];
    if (!state.boxes) state.boxes = [];
    if (!state.locations) state.locations = [];

    // Ensure default unpalletized pallet for non-palletized locations
    (state.locations || []).forEach((loc: any) => {
      if (!loc.isHome && !loc.hasPallets) {
        const defaultPalletName = `${loc.name} - Unpalletized`;
        let pObj = state.pallets.find((p: any) => p.id === defaultPalletName || p.name === defaultPalletName);
        if (!pObj) {
          pObj = {
            id: defaultPalletName,
            name: defaultPalletName,
            storageLocationId: loc.id,
            isArchived: false
          };
          state.pallets.push(pObj);
        } else if (pObj.storageLocationId !== loc.id) {
          pObj.storageLocationId = loc.id;
        }
      }
    });

    state.offSiteEntries = state.offSiteEntries.map(e => {
      if (e.staged) {
        return e;
      }
      const boxName = (e.box || '').trim();
      if (!boxName) {
        return {
          ...e,
          boxNotes: undefined
        };
      }

      // Determine if this entry belongs to a location that does not deal with pallets
      let resolvedLoc = undefined;
      if (e.storageLocationId) {
        resolvedLoc = state.locations.find((l: any) => l.id === e.storageLocationId);
      } else if (e.location) {
        resolvedLoc = state.locations.find((l: any) => l.name.toLowerCase().trim() === e.location?.toLowerCase().trim());
      }

      let defaultPalletForLoc = undefined;
      if (resolvedLoc && !resolvedLoc.isHome && !resolvedLoc.hasPallets) {
        defaultPalletForLoc = `${resolvedLoc.name} - Unpalletized`;
      }

      // 1. Resolve or create box in state.boxes
      let boxObj = state.boxes.find((b: any) => b.id === boxName || b.name === boxName);
      if (!boxObj) {
        let initialPalletId = (e.pallet || e.currentLocation || '').trim() || undefined;
        if (defaultPalletForLoc) {
          initialPalletId = defaultPalletForLoc;
        }
        boxObj = {
          id: boxName,
          name: boxName,
          palletId: initialPalletId,
          notes: e.boxNotes || undefined,
          isArchived: false
        };
        state.boxes.push(boxObj);
      } else {
        // Two-way sync: update box notes if entry has a different/newer value
        if (e.boxNotes !== undefined && e.boxNotes !== boxObj.notes) {
          boxObj.notes = e.boxNotes;
        }
        // Two-way sync: update box pallet reference if entry has a different/newer value
        let incomingPallet = (e.pallet || e.currentLocation || '').trim();
        if (defaultPalletForLoc) {
          incomingPallet = defaultPalletForLoc;
        }
        if (incomingPallet && boxObj.palletId !== incomingPallet) {
          boxObj.palletId = incomingPallet;
        }
      }

      // Sync with containers isArchived
      const boxId = 'box-' + boxName.replace(/\s+/g, '-').toLowerCase();
      const containerObj = state.containers.find(c => c.id === boxId);
      if (containerObj) {
        if (containerObj.isArchived) {
          boxObj.isArchived = true;
        } else if (boxObj.isArchived) {
          containerObj.isArchived = true;
        }
      }

      // 2. Resolve or create pallet in state.pallets
      const palletName = (boxObj.palletId || '').trim();
      let palletObj = palletName ? state.pallets.find((p: any) => p.id === palletName || p.name === palletName) : null;
      if (palletName && !palletObj) {
        palletObj = {
          id: palletName,
          name: palletName,
          storageLocationId: e.storageLocationId || (resolvedLoc ? resolvedLoc.id : undefined),
          isArchived: false
        };
        state.pallets.push(palletObj);
      } else if (palletObj) {
        // Two-way sync: update pallet location if entry has a different/newer value
        if (e.storageLocationId && palletObj.storageLocationId !== e.storageLocationId) {
          palletObj.storageLocationId = e.storageLocationId;
        } else if (e.location && !palletObj.storageLocationId) {
          const loc = state.locations.find((l: any) => l.name.toLowerCase().trim() === e.location?.toLowerCase().trim());
          if (loc) {
            palletObj.storageLocationId = loc.id;
          }
        }
        // If it is our default unpalletized pallet, ensure it has the correct storageLocationId
        if (defaultPalletForLoc && resolvedLoc && palletObj.storageLocationId !== resolvedLoc.id) {
          palletObj.storageLocationId = resolvedLoc.id;
        }
      }

      // Sync pallet isArchived with freezers representation
      if (palletObj) {
        const palletFreezerId = 'pallet-' + palletName.replace(/\s+/g, '-').toLowerCase();
        const freezerObj = state.freezers.find(f => f.id === palletFreezerId);
        if (freezerObj) {
          if ((freezerObj as any).isArchived) {
            palletObj.isArchived = true;
          } else if (palletObj.isArchived) {
            (freezerObj as any).isArchived = true;
          }
        }
      }

      // 3. Derive clean values from single source of truth
      const derivedBoxNotes = boxObj.notes || undefined;
      const derivedPallet = boxObj.palletId || undefined;
      const derivedCurrentLocation = boxObj.palletId || undefined;

      let derivedStorageLocationId = undefined;
      let derivedLocation = undefined;
      if (palletObj) {
        derivedStorageLocationId = palletObj.storageLocationId || undefined;
        if (derivedStorageLocationId) {
          const loc = state.locations.find((l: any) => l.id === derivedStorageLocationId);
          if (loc) {
            derivedLocation = loc.name;
          }
        }
      } else {
        // Fall back to the entry's own location/storageLocationId if no pallet
        derivedStorageLocationId = e.storageLocationId || undefined;
        if (derivedStorageLocationId) {
          const loc = state.locations.find((l: any) => l.id === derivedStorageLocationId);
          if (loc) {
            derivedLocation = loc.name;
          }
        } else if (e.location) {
          const loc = state.locations.find((l: any) => l.name.toLowerCase().trim() === e.location.toLowerCase().trim());
          if (loc) {
            derivedStorageLocationId = loc.id;
            derivedLocation = loc.name;
          } else {
            derivedLocation = e.location;
          }
        }
      }

      // 4. Derive sourceLocation from Butcher Order's locationId pointing to the locations table
      let derivedSourceLocation = undefined;
      if (e.orderId && state.butcherOrders) {
        const order = state.butcherOrders.find((o: any) => o.id === e.orderId);
        if (order && order.locationId && state.locations) {
          const loc = state.locations.find((l: any) => l.id === order.locationId);
          if (loc) {
            derivedSourceLocation = loc.name;
          }
        }
      }

      return {
        ...e,
        boxNotes: derivedBoxNotes,
        pallet: derivedPallet,
        currentLocation: derivedCurrentLocation,
        storageLocationId: derivedStorageLocationId,
        location: derivedLocation,
        sourceLocation: derivedSourceLocation
      };
    });

    // Identify active pallets and boxes across all non-archived off-site entries
    const activePalletNames = new Set<string>();
    const activeBoxNames = new Set<string>();

    state.offSiteEntries.forEach((e: any) => {
      if (!e.archived) {
        const pName = (e.pallet || e.currentLocation || '').trim();
        if (pName && pName.toLowerCase() !== 'home') {
          activePalletNames.add(pName.toLowerCase());
        }
        const boxName = (e.box || '').trim();
        if (boxName) {
          activeBoxNames.add(boxName.toLowerCase());
          const boxObj = state.boxes?.find((b: any) => b.id === boxName || b.name === boxName);
          const bPallet = (boxObj?.palletId || '').trim();
          if (bPallet && bPallet.toLowerCase() !== 'home') {
            activePalletNames.add(bPallet.toLowerCase());
          }
        }
      }
    });

    // Keep pallets/boxes active if they are in pending/draft/planned movement orders
    (state.movementOrders || []).forEach((mo: any) => {
      if (mo.status !== 'completed' && mo.status !== 'cancelled') {
        if (mo.targetDestinations) {
          mo.targetDestinations.forEach((dest: any) => {
            if (dest.palletName && dest.palletName.trim()) {
              activePalletNames.add(dest.palletName.trim().toLowerCase());
            }
          });
        }
        if (mo.moves) {
          mo.moves.forEach((m: any) => {
            if (m.targetLocation && m.targetLocation.trim()) {
              activePalletNames.add(m.targetLocation.trim().toLowerCase());
            }
          });
        }
      }
    });

    // Sync isArchived for pallets (automatically archive any empty ones, unarchive any active ones)
    if (state.pallets) {
      state.pallets = state.pallets.map((p: any) => {
        const pName = (p.id || p.name || '').trim().toLowerCase();
        // Skip default unpalletized placeholders
        if (pName.endsWith(' - unpalletized')) {
          return { ...p, isArchived: false };
        }
        const isActive = activePalletNames.has(pName);
        return {
          ...p,
          isArchived: !isActive
        };
      });
    }

    // Sync isArchived for boxes
    if (state.boxes) {
      state.boxes = state.boxes.map((b: any) => {
        const bName = (b.id || b.name || '').trim().toLowerCase();
        const isActive = activeBoxNames.has(bName);
        return {
          ...b,
          isArchived: !isActive
        };
      });
    }

    // Sync pallet and box isArchived with freezers and containers catalogs representation
    if (state.freezers) {
      state.freezers = state.freezers.map((f: any) => {
        if (f.isPallet) {
          const palletName = f.name;
          const pObj = state.pallets?.find((p: any) => p.name === palletName || p.id === palletName);
          if (pObj) {
            return { ...f, isArchived: !!pObj.isArchived };
          }
        }
        return f;
      });
    }

    if (state.containers) {
      state.containers = state.containers.map((c: any) => {
        if (c.isBox) {
          const boxName = c.name;
          const bObj = state.boxes?.find((b: any) => b.name === boxName || b.id === boxName);
          if (bObj) {
            return { ...c, isArchived: !!bObj.isArchived };
          }
        }
        return c;
      });
    }
  }

  return state;
}

// Helper function to separate container templates from active containers and maintain the 2-table schema
function convertAndNormalizeContainerTemplates(state: AppInventoryState): AppInventoryState {
  if (!state || !state.containers) return state;

  let containerTemplates: any[] = [...(state.containerTemplates || [])];
  // Filter out old hallucinated placeholder templates (e.g. tpl_bag, tpl_box)
  containerTemplates = containerTemplates.filter(t => t && t.id && !t.id.startsWith('tpl_'));

  let containers: any[] = [...(state.containers || [])];
  let meatCuts: any[] = [...(state.meatCuts || [])];
  let history: any[] = [...(state.history || [])];

  const isLooseCheck = (c: any) => {
    if (!c) return false;
    const name = (c.name || '').toLowerCase().trim();
    return (
      c.id === 'staging_loose' ||
      c.id.endsWith('_loose') ||
      name === 'loose' ||
      name === 'loose stock' ||
      name === 'loose display stock' ||
      name === 'uncontainered / loose items'
    );
  };

  // Build lookup map for existing container templates by normalized name
  const templateMap = new Map<string, any>();
  for (const tpl of containerTemplates) {
    if (tpl && tpl.name) {
      templateMap.set(tpl.name.toLowerCase().trim(), tpl);
    }
  }

  // Set of container IDs that currently hold meat cuts
  const containerIdsWithCuts = new Set(meatCuts.map((cut: any) => cut.containerId));

  // Step 1: Separate old unassigned template containers from containers array
  const finalContainers: any[] = [];

  for (const c of containers) {
    if (isLooseCheck(c) || c.isBox) {
      // Keep loose stock and boxes as active containers
      finalContainers.push(c);
      continue;
    }

    const trimmedName = (c.name || '').trim();
    const normalizedName = trimmedName.toLowerCase();
    const isUnassigned = !c.freezerId;

    if (isUnassigned) {
      // Check if cuts exist inside this unassigned container
      const hasCuts = containerIdsWithCuts.has(c.id);

      // Convert this unassigned container into containerTemplates catalog
      if (normalizedName) {
        if (!templateMap.has(normalizedName)) {
          const newTemplate = {
            id: c.id || crypto.randomUUID(),
            name: trimmedName,
            icon: c.icon || 'Folder',
            imageUrl: c.imageUrl || undefined,
            createdAt: new Date().toISOString()
          };
          containerTemplates.push(newTemplate);
          templateMap.set(normalizedName, newTemplate);
        } else {
          // Update existing template if missing image or icon
          const existingTpl = templateMap.get(normalizedName);
          if (!existingTpl.imageUrl && c.imageUrl) {
            existingTpl.imageUrl = c.imageUrl;
          }
          if ((!existingTpl.icon || existingTpl.icon === 'Folder') && c.icon && c.icon !== 'Folder') {
            existingTpl.icon = c.icon;
          }
        }
      }

      if (hasCuts) {
        // If it holds cuts, keep it as an active container in staging so cuts are not lost!
        const matchedTpl = templateMap.get(normalizedName);
        finalContainers.push({
          ...c,
          templateId: matchedTpl ? matchedTpl.id : c.templateId
        });
      }
      // If it doesn't hold cuts, it is safely in containerTemplates catalog, so omit from active containers
    } else {
      // Active placed container in freezer
      let templateId = c.templateId;

      if (!templateId && normalizedName) {
        if (templateMap.has(normalizedName)) {
          templateId = templateMap.get(normalizedName).id;
        } else if (!c.deleteOnEmpty) {
          // Automatically create a template entry for reusable active container
          const autoTpl = {
            id: crypto.randomUUID(),
            name: trimmedName,
            icon: c.icon || 'Folder',
            imageUrl: c.imageUrl || undefined,
            createdAt: new Date().toISOString()
          };
          containerTemplates.push(autoTpl);
          templateMap.set(normalizedName, autoTpl);
          templateId = autoTpl.id;
        }
      }

      finalContainers.push({
        ...c,
        templateId
      });
    }
  }

  // Step 2: Ensure all active containers linked to a template inherit/sync template properties
  const templateIdMap = new Map<string, any>();
  for (const tpl of containerTemplates) {
    templateIdMap.set(tpl.id, tpl);
  }

  const normalizedContainers = finalContainers.map(c => {
    if (c.templateId && templateIdMap.has(c.templateId)) {
      const tpl = templateIdMap.get(c.templateId);
      return {
        ...c,
        name: tpl.name || c.name,
        icon: tpl.icon || c.icon,
        imageUrl: tpl.imageUrl !== undefined ? tpl.imageUrl : c.imageUrl
      };
    }
    return c;
  });

  return {
    ...state,
    containerTemplates,
    containers: normalizedContainers,
    meatCuts,
    history
  };
}

// Load inventory unified getter
async function loadState(): Promise<AppInventoryState> {
  const rawState = loadStateSync();
  const normalized = normalizeState(rawState);
  const converted = convertAndNormalizeContainerTemplates(normalized);
  
  // If anything was modified during normalization or template conversion, save it back to persist updates permanently
  if (JSON.stringify(rawState) !== JSON.stringify(converted)) {
    saveStateSync(converted);
  }
  return { ...converted, isDemoMode, isPreviewMode, previewBackupFilename: previewBackupFilename || undefined };
}

// Unified state saver
async function saveState(state: AppInventoryState) {
  const normalized = normalizeState(state);
  const converted = convertAndNormalizeContainerTemplates(normalized);
  saveStateSync(converted);
}

// ---------------- INVENTORY SYNC ENDPOINTS ----------------

app.post('/api/upload', async (req: any, res) => {
  try {
    const { base64, filename } = req.body;
    if (!base64 || !filename) {
      return res.status(400).json({ error: 'Missing base64 or filename.' });
    }

    let base64Data = base64;
    let fileExtension = 'jpg';
    if (base64.startsWith('data:')) {
      const semicolonIdx = base64.indexOf(';base64,');
      if (semicolonIdx !== -1) {
        const mimeType = base64.substring(5, semicolonIdx);
        base64Data = base64.substring(semicolonIdx + 8);
        fileExtension = mimeType.split('/')[1] || 'jpg';
        if (fileExtension === 'jpeg') fileExtension = 'jpg';
      } else {
        const ext = filename.split('.').pop();
        if (ext) fileExtension = ext;
      }
    } else {
      const ext = filename.split('.').pop();
      if (ext) fileExtension = ext;
    }

    const sanitizedFilename = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExtension}`;
    const filePath = path.join(UPLOADS_DIR, sanitizedFilename);

    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    res.json({ imageUrl: `uploads/${sanitizedFilename}` });
  } catch (err: any) {
    console.error('Upload API error:', err);
    res.status(500).json({ error: `File upload failed: ${err.message}` });
  }
});

// ---------------- BACKUP CONFIGURATION & AUTO-SNAP ----------------

interface AutoSnapshotSettings {
  rollingEnabled: boolean;
  rollingInterval: number;
  rollingMaxCount: number;
  lastBackupTimestamp?: string;

  dbRollingEnabled: boolean;
  dbRollingIntervalDays: number;
  dbRollingMaxCount: number;
  dbLastBackupTimestamp?: string;
  dbBackupHour?: number;

  fullZipRollingEnabled: boolean;
  fullZipRollingIntervalDays: number;
  fullZipRollingMaxCount: number;
  fullZipLastBackupTimestamp?: string;

  isDemoMode?: boolean;
}

const defaultAutoSnapshotSettings: AutoSnapshotSettings = {
  rollingEnabled: false,
  rollingInterval: 7,
  rollingMaxCount: 5,
  lastBackupTimestamp: '',

  dbRollingEnabled: true,
  dbRollingIntervalDays: 1, // Nightly
  dbRollingMaxCount: 7, // 1 week retention
  dbBackupHour: 2, // 2:00 AM

  fullZipRollingEnabled: true,
  fullZipRollingIntervalDays: 7, // Weekly
  fullZipRollingMaxCount: 2, // 2 weeks retention

  isDemoMode: false
};

function loadAutoSnapshotConfig(): AutoSnapshotSettings {
  let dbConfig: any = null;
  try {
    if (!db) initDatabase();
    const row = db.prepare("SELECT value FROM app_config WHERE key = 'auto_snapshot_config'").get() as any;
    if (row && row.value) {
      dbConfig = JSON.parse(row.value);
    }
  } catch (e) {
    // ignore
  }

  if (dbConfig) {
    const merged = { ...defaultAutoSnapshotSettings, ...dbConfig };
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (err) {}
    return merged;
  }

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const diskData = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      const merged = { ...defaultAutoSnapshotSettings, ...diskData };
      saveAutoSnapshotConfig(merged);
      return merged;
    } catch (err) {
      console.error('Error reading auto snapshot config file:', err);
    }
  }

  saveAutoSnapshotConfig(defaultAutoSnapshotSettings);
  return defaultAutoSnapshotSettings;
}

function saveAutoSnapshotConfig(config: AutoSnapshotSettings) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving auto snapshot config to file:', err);
  }

  try {
    if (!db) initDatabase();
    db.prepare(`
      INSERT INTO app_config (key, value, updatedAt)
      VALUES ('auto_snapshot_config', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `).run(JSON.stringify(config), new Date().toISOString());
  } catch (err) {
    console.error('Error saving auto snapshot config to database:', err);
  }
}

function getUserTimezone(): string {
  try {
    if (!db) initDatabase();
    const row = db.prepare("SELECT timezone FROM notification_settings WHERE id = 'global'").get() as any;
    if (row && row.timezone) {
      return row.timezone;
    }
  } catch (e) {}
  return process.env.TZ || 'America/New_York';
}

async function runAutomaticRollingSnapshots() {
  if (isDemoMode || isPreviewMode) return;
  try {
    const config = loadAutoSnapshotConfig();
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const userTz = getUserTimezone();

    const currentInfo = getDateAndMinutesInTz(now, userTz);
    const currentHour = currentInfo.hour;

    // 1. Check Nightly / Scheduled DB Snapshot
    if (config.dbRollingEnabled) {
      const lastDb = config.dbLastBackupTimestamp ? new Date(config.dbLastBackupTimestamp) : null;
      const lastDbInfo = lastDb ? getDateAndMinutesInTz(lastDb, userTz) : null;

      let dayDiff = Infinity;
      if (lastDbInfo) {
        const currentDate = new Date(`${currentInfo.dateStr}T00:00:00Z`);
        const lastBackupDate = new Date(`${lastDbInfo.dateStr}T00:00:00Z`);
        dayDiff = Math.floor((currentDate.getTime() - lastBackupDate.getTime()) / (24 * 60 * 60 * 1000));
      }

      const backupHour = config.dbBackupHour !== undefined ? config.dbBackupHour : 2; // Default to 2 AM local
      const intervalDays = config.dbRollingIntervalDays || (config as any).dbRollingInterval || 1;

      if (!lastDb || (dayDiff >= intervalDays && currentHour >= backupHour)) {
        console.log(`Running automatic rolling DB snapshot (scheduled hour: ${backupHour}:00 ${userTz}, current local time: ${currentInfo.hour}:${currentInfo.minute.toString().padStart(2, '0')}, days elapsed: ${dayDiff})...`);
        const dbFilename = `auto_rolling_db_${timestamp}.db`;
        const dbFilepath = path.join(BACKUPS_DIR, dbFilename);
        if (!db) initDatabase();
        db.prepare('VACUUM INTO ?').run(dbFilepath);

        config.dbLastBackupTimestamp = now.toISOString();
        saveAutoSnapshotConfig(config);

        // Retention cleanup for auto_rolling_db_*.db
        const files = fs.readdirSync(BACKUPS_DIR)
          .filter(f => f.startsWith('auto_rolling_db_') && f.endsWith('.db'))
          .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
          .sort((a, b) => b.time - a.time);

        if (files.length > (config.dbRollingMaxCount || 7)) {
          const toDelete = files.slice(config.dbRollingMaxCount || 7);
          toDelete.forEach(f => {
            try {
              fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
              console.log(`Pruned old automatic DB snapshot: ${f.name}`);
            } catch (e) {}
          });
        }
      }
    }

    // 2. Check Weekly / Scheduled Full Package (DB + Photos ZIP) Snapshot
    if (config.fullZipRollingEnabled) {
      const intervalMs = (config.fullZipRollingIntervalDays || 7) * 24 * 60 * 60 * 1000;
      const lastZip = config.fullZipLastBackupTimestamp ? new Date(config.fullZipLastBackupTimestamp) : null;

      if (!lastZip || (now.getTime() - lastZip.getTime() >= intervalMs)) {
        console.log('Running automatic rolling Full Package ZIP snapshot...');
        const zipFilename = `auto_rolling_full_${timestamp}.zip`;
        const zipFilepath = path.join(BACKUPS_DIR, zipFilename);

        const zip = new AdmZip();
        
        // Add DB
        const tempDbPath = path.join(BACKUPS_DIR, `temp_auto_${timestamp}.db`);
        if (!db) initDatabase();
        db.prepare('VACUUM INTO ?').run(tempDbPath);
        zip.addLocalFile(tempDbPath, '', 'inventory.db');

        // Add config
        zip.addFile('config.json', Buffer.from(JSON.stringify(config, null, 2), 'utf-8'));

        // Add Photos
        if (fs.existsSync(UPLOADS_DIR)) {
          const imgFiles = fs.readdirSync(UPLOADS_DIR);
          imgFiles.forEach(img => {
            const fullImgPath = path.join(UPLOADS_DIR, img);
            if (fs.statSync(fullImgPath).isFile()) {
              zip.addLocalFile(fullImgPath, 'images');
            }
          });
        }

        fs.writeFileSync(zipFilepath, zip.toBuffer());
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);

        config.fullZipLastBackupTimestamp = now.toISOString();
        saveAutoSnapshotConfig(config);

        // Retention cleanup for auto_rolling_full_*.zip
        const files = fs.readdirSync(BACKUPS_DIR)
          .filter(f => f.startsWith('auto_rolling_full_') && f.endsWith('.zip'))
          .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime() }))
          .sort((a, b) => b.time - a.time);

        if (files.length > (config.fullZipRollingMaxCount || 2)) {
          const toDelete = files.slice(config.fullZipRollingMaxCount || 2);
          toDelete.forEach(f => {
            try {
              fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
              console.log(`Pruned old automatic Full ZIP snapshot: ${f.name}`);
            } catch (e) {}
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to run automatic rolling snapshots:', err);
  }
}

// Start auto snapshot checks periodically (every 15 minutes)
setInterval(() => {
  runAutomaticRollingSnapshots().catch(err => console.error(err));
}, 15 * 60 * 1000);

// ---------------- VERSATILE NOTIFICATION PLATFORM ----------------

async function sendNotificationPayload(title: string, message: string, settings: any): Promise<{ success: boolean; error?: string }> {
  try {
    const { method, webhookUrl, haNotifyService, haUrl, haToken, smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom, smtpTo, smtpSecure } = settings;

    if (method === 'ha_persistent' || method === 'ha_notify') {
      let finalUrl = (haUrl || '').trim();
      let finalToken = (haToken || '').trim();

      if (!finalToken && process.env.SUPERVISOR_TOKEN) {
        finalToken = process.env.SUPERVISOR_TOKEN;
      }

      if (!finalUrl && process.env.SUPERVISOR_TOKEN) {
        finalUrl = 'http://supervisor/core/api';
      }

      if (!finalUrl) {
        finalUrl = 'http://localhost:8123/api';
      }

      let cleanBase = finalUrl.replace(/\/+$/, '');
      if (!cleanBase.endsWith('/api') && !cleanBase.includes('/api/')) {
        cleanBase = `${cleanBase}/api`;
      }

      let serviceUrl = '';
      let payload: any = {};

      if (method === 'ha_persistent') {
        serviceUrl = `${cleanBase}/services/persistent_notification/create`;
        payload = {
          title,
          message
        };
      } else {
        let rawSvc = (haNotifyService || 'notify.notify').trim();
        if (rawSvc.startsWith('notify.')) {
          rawSvc = rawSvc.substring(7);
        }
        let domain = 'notify';
        let service = 'notify';

        if (rawSvc.includes('.')) {
          const parts = rawSvc.split('.');
          domain = parts[0] || 'notify';
          service = parts[1] || 'notify';
        } else if (rawSvc === 'persistent_notification' || rawSvc === 'persistent_notification.create') {
          domain = 'persistent_notification';
          service = 'create';
        } else if (rawSvc) {
          domain = 'notify';
          service = rawSvc;
        }

        serviceUrl = `${cleanBase}/services/${domain}/${service}`;
        payload = {
          title,
          message
        };
      }

      console.log(`Sending Home Assistant notification to ${serviceUrl}...`);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (finalToken) {
        headers['Authorization'] = `Bearer ${finalToken}`;
        headers['X-Supervisor-Token'] = finalToken;
      }

      try {
        const response = await fetch(serviceUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          let hint = '';
          if (response.status === 401) {
            hint = ' (Unauthorized: Check your Long-Lived Access Token or Supervisor credentials)';
          } else if (response.status === 404) {
            hint = ` (Not Found: Verify service endpoint "${serviceUrl}" exists in Home Assistant)`;
          }
          throw new Error(`Home Assistant API returned status ${response.status}${hint}: ${errText || response.statusText}`);
        }

        return { success: true };
      } catch (fetchErr: any) {
        if (fetchErr.message?.includes('Home Assistant API returned status')) {
          throw fetchErr;
        }
        const msg = fetchErr.message || String(fetchErr);
        if (msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND') || msg.includes('fetch failed') || fetchErr.name === 'TimeoutError') {
          throw new Error(`Unable to reach Home Assistant at "${cleanBase}". Please verify Home Assistant URL and network connectivity.`);
        }
        throw fetchErr;
      }
    }

    if (method === 'smtp_email') {
      if (!smtpHost || !smtpTo) {
        throw new Error('SMTP host and recipient (To) address must be configured.');
      }

      let nodemailerModule: any = null;
      try {
        const nm = await import('nodemailer');
        nodemailerModule = nm.default || nm;
      } catch {
        throw new Error('Nodemailer package is not available on this system.');
      }

      console.log(`Sending SMTP email to ${smtpTo} via ${smtpHost}...`);
      const transporter = nodemailerModule.createTransport({
        host: smtpHost,
        port: Number(smtpPort || 587),
        secure: !!smtpSecure,
        auth: smtpUser && smtpPass ? {
          user: smtpUser,
          pass: smtpPass
        } : undefined
      });

      const htmlBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px;">${title}</h2>
          <div style="color: #334155; line-height: 1.6; margin-top: 16px; white-space: pre-wrap;">${message.replace(/\n/g, '<br/>')}</div>
          <p style="color: #64748b; font-size: 12px; margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            This is an automated notification from your Freezer Inventory Tracker.
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: smtpFrom || smtpUser || 'freezer-tracker@local',
        to: smtpTo,
        subject: title,
        text: message,
        html: htmlBody
      });

      return { success: true };
    }

    if (method === 'webhook') {
      if (!webhookUrl) {
        throw new Error('Webhook URL must be configured.');
      }

      console.log(`Sending Webhook POST to ${webhookUrl}...`);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          message,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Webhook returned status ${response.status}: ${errText}`);
      }

      return { success: true };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Notification dispatch error:', err);
    return { success: false, error: err.message || String(err) };
  }
}

async function triggerNotification(customListIds?: string[], forceNow: boolean = false): Promise<{ success: boolean; results: any[] }> {
  const state = await loadState();
  const settings = state.notificationSettings?.[0];
  if (!settings) {
    console.warn('No notification settings found.');
    return { success: false, results: [] };
  }

  if (!settings.digestEnabled && !forceNow) {
    console.log('Daily digest is disabled and forceNow is false. Skipping.');
    return { success: true, results: [] };
  }

  let lists = state.customLists || [];
  if (customListIds && customListIds.length > 0) {
    lists = lists.filter(l => customListIds.includes(l.id));
  } else {
    lists = lists.filter(l => l.notificationEnabled);
  }

  if (lists.length === 0) {
    console.log('No custom lists configured for notifications.');
    return { success: true, results: [] };
  }

  const productsMap = new Map<string, any>();
  for (const p of state.products || []) {
    productsMap.set(p.id, p);
  }

  const results: any[] = [];
  const nowStr = new Date().toISOString();

  const formatListItems = (list: any): { text: string; hasItems: boolean; itemsCount: number } => {
    let itemsToNotify = [...list.items];

    if (list.notificationType === 'newly_added_only') {
      const lastNotified = list.lastNotifiedAt ? new Date(list.lastNotifiedAt).getTime() : 0;
      if (lastNotified > 0) {
        itemsToNotify = itemsToNotify.filter(item => {
          const added = item.addedAt ? new Date(item.addedAt).getTime() : 0;
          return added > lastNotified;
        });
      } else {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        itemsToNotify = itemsToNotify.filter(item => {
          const added = item.addedAt ? new Date(item.addedAt).getTime() : 0;
          return added > oneDayAgo;
        });
      }
    } else if (list.notificationType === 'item_specific') {
      itemsToNotify = itemsToNotify.filter(item => item.notifyEnabled);
    }

    if (itemsToNotify.length === 0) {
      return { text: '', hasItems: false, itemsCount: 0 };
    }

    let text = `📋 ${list.name}\n`;
    if (list.description) text += `Description: ${list.description}\n`;
    text += `----------------------------------------\n`;

    itemsToNotify.forEach((item, index) => {
      const product = productsMap.get(item.productId);
      const prodName = product ? product.name : 'Unknown Product';
      const cat = product ? product.primaryCategory || 'Uncategorized' : 'N/A';
      
      const stockQty = (state.meatCuts || [])
        .filter(mc => mc.productId === item.productId)
        .reduce((sum, mc) => sum + (mc.quantity || 0), 0);

      text += `${index + 1}. ${prodName} (Category: ${cat}) | In Stock: ${stockQty}\n`;
      if (list.allowNotes && item.notes) {
        text += `   Notes: ${item.notes}\n`;
      }
      text += `\n`;
    });

    return { text, hasItems: true, itemsCount: itemsToNotify.length };
  };

  if (settings.digestMode === 'combined') {
    let combinedMsg = '';
    let totalItems = 0;
    const notifiedListIds: string[] = [];

    for (const list of lists) {
      const { text, hasItems, itemsCount } = formatListItems(list);
      if (hasItems) {
        combinedMsg += text + `\n\n`;
        totalItems += itemsCount;
        notifiedListIds.push(list.id);
      }
    }

    if (totalItems === 0) {
      console.log('Combined daily digest has no matching items to notify today.');
      return { success: true, results: [] };
    }

    const title = `Freezer Tracker: Daily Combined Digest (${new Date().toLocaleDateString()})`;
    const header = `Here is your daily combined inventory list digest:\n\n`;
    const fullMessage = header + combinedMsg;

    const dispatchResult = await sendNotificationPayload(title, fullMessage, settings);
    
    const logId = crypto.randomUUID();
    const logEntry = {
      id: logId,
      sentAt: nowStr,
      title,
      message: fullMessage,
      method: settings.method,
      status: dispatchResult.success ? 'success' : 'failed',
      error: dispatchResult.error
    };

    const currentLogs = state.notificationLogs || [];
    state.notificationLogs = [logEntry as any, ...currentLogs];

    state.customLists = (state.customLists || []).map(cl => {
      if (notifiedListIds.includes(cl.id)) {
        return { ...cl, lastNotifiedAt: nowStr };
      }
      return cl;
    });

    saveStateSync(state);
    notifyInventoryUpdate();

    results.push({ title, success: dispatchResult.success, error: dispatchResult.error });
  } else {
    for (const list of lists) {
      const { text, hasItems } = formatListItems(list);
      if (!hasItems) continue;

      const title = `Freezer Tracker Digest: ${list.name} (${new Date().toLocaleDateString()})`;
      const fullMessage = `Here is your daily digest for list "${list.name}":\n\n` + text;

      const dispatchResult = await sendNotificationPayload(title, fullMessage, settings);

      const logId = crypto.randomUUID();
      const logEntry = {
        id: logId,
        sentAt: nowStr,
        title,
        message: fullMessage,
        method: settings.method,
        status: dispatchResult.success ? 'success' : 'failed',
        error: dispatchResult.error
      };

      const currentLogs = state.notificationLogs || [];
      state.notificationLogs = [logEntry as any, ...currentLogs];

      state.customLists = (state.customLists || []).map(cl => {
        if (cl.id === list.id) {
          return { ...cl, lastNotifiedAt: nowStr };
        }
        return cl;
      });

      results.push({ title, success: dispatchResult.success, error: dispatchResult.error });
    }

    saveStateSync(state);
    notifyInventoryUpdate();
  }

  if (!forceNow) {
    db.prepare(`
      UPDATE notification_settings 
      SET lastDigestSentAt = ? 
      WHERE id = 'global'
    `).run(nowStr);
  }

  return { success: true, results };
}

function getDateAndMinutesInTz(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find(p => p.type === 'year')?.value || '1970';
    const month = parts.find(p => p.type === 'month')?.value || '01';
    const day = parts.find(p => p.type === 'day')?.value || '01';
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    return {
      dateStr: `${year}-${month}-${day}`,
      totalMinutes: hour * 60 + minute,
      hour,
      minute
    };
  } catch (e) {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      const parts = formatter.formatToParts(date);
      const year = parts.find(p => p.type === 'year')?.value || '1970';
      const month = parts.find(p => p.type === 'month')?.value || '01';
      const day = parts.find(p => p.type === 'day')?.value || '01';
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      return {
        dateStr: `${year}-${month}-${day}`,
        totalMinutes: hour * 60 + minute,
        hour,
        minute
      };
    } catch {
      return {
        dateStr: date.toISOString().split('T')[0],
        totalMinutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes()
      };
    }
  }
}

async function checkAndTriggerScheduledNotifications() {
  if (isDemoMode) return;
  try {
    const state = await loadState();
    const settings = state.notificationSettings?.[0];
    if (!settings || !settings.digestEnabled) return;

    const digestTime = settings.digestTime || '20:00';
    const [targetHour, targetMinute] = digestTime.split(':').map(Number);
    const targetMinutes = targetHour * 60 + targetMinute;

    const now = new Date();
    const userTz = settings.timezone || 'America/New_York';
    const currentInfo = getDateAndMinutesInTz(now, userTz);

    let lastSentDateStr = '';
    if (settings.lastDigestSentAt) {
      const lastSentDate = new Date(settings.lastDigestSentAt);
      if (!isNaN(lastSentDate.getTime())) {
        lastSentDateStr = getDateAndMinutesInTz(lastSentDate, userTz).dateStr;
      }
    }

    if (currentInfo.totalMinutes >= targetMinutes && currentInfo.dateStr !== lastSentDateStr) {
      console.log(`Daily digest scheduled time reached (${digestTime} ${userTz}, current local time: ${currentInfo.hour}:${currentInfo.minute.toString().padStart(2, '0')}). Triggering daily notifications...`);
      const nowStr = now.toISOString();
      settings.lastDigestSentAt = nowStr;
      try {
        db.prepare(`
          UPDATE notification_settings 
          SET lastDigestSentAt = ? 
          WHERE id = 'global'
        `).run(nowStr);
      } catch (e) {
        console.error('Failed to record lastDigestSentAt:', e);
      }
      await triggerNotification();
    }
  } catch (err) {
    console.error('Failed to run scheduled notifications check:', err);
  }
}

// Check scheduled notifications every minute
setInterval(() => {
  checkAndTriggerScheduledNotifications().catch(err => console.error('Error running scheduled notification checks:', err));
}, 60 * 1000);


// ---------------- DEMO MODE ENDPOINTS ----------------

app.get('/api/demo/status', (req, res) => {
  try {
    const config = loadAutoSnapshotConfig();
    res.json({ isDemoMode: !!config.isDemoMode });
  } catch (err: any) {
    res.status(500).json({ error: `Failed to get demo mode status: ${err.message}` });
  }
});

app.post('/api/demo/start', async (req, res) => {
  try {
    console.log('Initiating demo mode...');
    const config = loadAutoSnapshotConfig();
    config.isDemoMode = true;
    saveAutoSnapshotConfig(config);

    if (db) {
      try {
        db.close();
      } catch (e) {
        // ignore
      }
    }

    const demoPath = path.join(DATA_DIR, 'inventory_demo.db');
    
    // Copy the current active database to be the starting point of the demo playground
    if (fs.existsSync(SQLITE_DB_PATH)) {
      fs.copyFileSync(SQLITE_DB_PATH, demoPath);
      // Clean up wal/shm of previous demo db
      const demoWal = `${demoPath}-wal`;
      const demoShm = `${demoPath}-shm`;
      if (fs.existsSync(demoWal)) {
        try { fs.unlinkSync(demoWal); } catch (e) {}
      }
      if (fs.existsSync(demoShm)) {
        try { fs.unlinkSync(demoShm); } catch (e) {}
      }
    }

    // Update global flag and re-init
    isDemoMode = true;
    initDatabase();
    
    // Broadcast state update to everyone
    notifyInventoryUpdate();

    res.json({ success: true, isDemoMode: true, message: 'Entered demo mode. All changes are temporary.' });
  } catch (err: any) {
    console.error('Failed to start demo mode:', err);
    res.status(500).json({ error: `Failed to start demo: ${err.message}` });
  }
});

app.post('/api/demo/end', async (req, res) => {
  try {
    console.log('Exiting demo mode...');
    const config = loadAutoSnapshotConfig();
    config.isDemoMode = false;
    saveAutoSnapshotConfig(config);

    if (db) {
      try {
        db.close();
      } catch (e) {
        // ignore
      }
    }

    const demoPath = path.join(DATA_DIR, 'inventory_demo.db');
    const demoWal = `${demoPath}-wal`;
    const demoShm = `${demoPath}-shm`;

    // Discard the temporary database
    try {
      if (fs.existsSync(demoPath)) fs.unlinkSync(demoPath);
      if (fs.existsSync(demoWal)) fs.unlinkSync(demoWal);
      if (fs.existsSync(demoShm)) fs.unlinkSync(demoShm);
    } catch (e) {
      console.warn('Failed to completely delete demo db files:', e);
    }

    // Update global flag and re-init
    isDemoMode = false;
    initDatabase();

    // Broadcast state update to everyone
    notifyInventoryUpdate();

    res.json({ success: true, isDemoMode: false, message: 'Exited demo mode. Restored live database.' });
  } catch (err: any) {
    console.error('Failed to end demo mode:', err);
    res.status(500).json({ error: `Failed to end demo: ${err.message}` });
  }
});


// ---------------- BACKUP ENDPOINTS ----------------

app.get('/api/backups/config', (req, res) => {
  try {
    const config = loadAutoSnapshotConfig();
    res.json(config);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read auto backup config' });
  }
});

app.post('/api/backups/config', (req, res) => {
  try {
    const { 
      rollingEnabled, rollingInterval, rollingMaxCount,
      dbRollingEnabled, dbRollingIntervalDays, dbRollingInterval, dbRollingMaxCount, dbBackupHour,
      fullZipRollingEnabled, fullZipRollingIntervalDays, fullZipRollingInterval, fullZipRollingMaxCount
    } = req.body;
    
    const current = loadAutoSnapshotConfig();

    if (dbRollingEnabled !== undefined) current.dbRollingEnabled = !!dbRollingEnabled;
    
    const dbInterval = dbRollingIntervalDays !== undefined ? dbRollingIntervalDays : dbRollingInterval;
    if (typeof dbInterval === 'number') current.dbRollingIntervalDays = Math.max(1, dbInterval);
    
    if (typeof dbRollingMaxCount === 'number') current.dbRollingMaxCount = Math.max(1, dbRollingMaxCount);

    if (dbBackupHour !== undefined) {
      current.dbBackupHour = typeof dbBackupHour === 'number' ? Math.min(23, Math.max(0, dbBackupHour)) : 2;
    }

    if (fullZipRollingEnabled !== undefined) current.fullZipRollingEnabled = !!fullZipRollingEnabled;
    
    const zipInterval = fullZipRollingIntervalDays !== undefined ? fullZipRollingIntervalDays : fullZipRollingInterval;
    if (typeof zipInterval === 'number') current.fullZipRollingIntervalDays = Math.max(1, zipInterval);
    
    if (typeof fullZipRollingMaxCount === 'number') current.fullZipRollingMaxCount = Math.max(1, fullZipRollingMaxCount);

    if (rollingEnabled !== undefined) current.rollingEnabled = !!rollingEnabled;
    if (typeof rollingInterval === 'number') current.rollingInterval = Math.max(1, rollingInterval);
    if (typeof rollingMaxCount === 'number') current.rollingMaxCount = Math.max(1, rollingMaxCount);

    saveAutoSnapshotConfig(current);
    
    runAutomaticRollingSnapshots().catch(e => console.error(e));
    
    res.json(current);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update auto backup config' });
  }
});

app.get('/api/backups', (req, res) => {
  try {
    runAutomaticRollingSnapshots().catch(e => console.error(e));

    const files = fs.readdirSync(BACKUPS_DIR);
    const backups = files
      .filter(f => f.endsWith('.json') || f.endsWith('.db') || f.endsWith('.csv') || f.endsWith('.zip'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUPS_DIR, f));
        let type = 'json';
        if (f.endsWith('.db')) type = 'sqlite';
        else if (f.endsWith('.csv')) type = 'csv';
        else if (f.endsWith('.zip')) type = 'zip';
        return {
          filename: f,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          type
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(backups);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to list backups.' });
  }
});

app.post('/api/backups/create', async (req: any, res) => {
  try {
    const { name, type, formats } = req.body;
    const isZip = type === 'zip' || (formats && formats.includes('zip'));
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const customName = name ? `_${name.replace(/[^a-zA-Z0-9_-]/g, '')}` : '';
    const createdFiles: string[] = [];

    if (isZip) {
      const zipFilename = `backup_full${customName}_${timestamp}.zip`;
      const zipFilepath = path.join(BACKUPS_DIR, zipFilename);

      const zip = new AdmZip();
      
      // 1. Add SQLite Database
      const tempDbPath = path.join(BACKUPS_DIR, `temp_create_${timestamp}.db`);
      if (!db) initDatabase();
      db.prepare('VACUUM INTO ?').run(tempDbPath);
      zip.addLocalFile(tempDbPath, '', 'inventory.db');

      // 2. Add Config
      const currentConfig = loadAutoSnapshotConfig();
      zip.addFile('config.json', Buffer.from(JSON.stringify(currentConfig, null, 2), 'utf-8'));

      // 3. Add Photos
      if (fs.existsSync(UPLOADS_DIR)) {
        const imgFiles = fs.readdirSync(UPLOADS_DIR);
        imgFiles.forEach(img => {
          const fullImgPath = path.join(UPLOADS_DIR, img);
          if (fs.statSync(fullImgPath).isFile()) {
            zip.addLocalFile(fullImgPath, 'images');
          }
        });
      }

      fs.writeFileSync(zipFilepath, zip.toBuffer());
      if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      createdFiles.push(zipFilename);
    } else {
      // Default SQLite DB snapshot
      const filename = `backup${customName}_${timestamp}.db`;
      const filepath = path.join(BACKUPS_DIR, filename);
      if (!db) initDatabase();
      db.prepare('VACUUM INTO ?').run(filepath);
      createdFiles.push(filename);
    }

    res.json({ success: true, files: createdFiles });
  } catch (err: any) {
    console.error('Backup creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create backup.' });
  }
});

app.get('/api/backups/preview-mode/status', (req, res) => {
  res.json({ isPreviewMode, previewBackupFilename });
});

app.post('/api/backups/preview-mode/start', async (req, res) => {
  try {
    const { filename } = req.body || {};
    if (!filename || typeof filename !== 'string') {
      return res.status(400).json({ error: 'Filename is required to start live preview mode.' });
    }

    const filepath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: `Snapshot file "${filename}" does not exist.` });
    }

    const previewDbPath = path.join(DATA_DIR, 'inventory_preview.db');
    const previewWal = `${previewDbPath}-wal`;
    const previewShm = `${previewDbPath}-shm`;

    if (db) {
      try { db.close(); } catch (e) {}
      db = null;
    }

    if (fs.existsSync(previewDbPath)) { try { fs.unlinkSync(previewDbPath); } catch (e) {} }
    if (fs.existsSync(previewWal)) { try { fs.unlinkSync(previewWal); } catch (e) {} }
    if (fs.existsSync(previewShm)) { try { fs.unlinkSync(previewShm); } catch (e) {} }

    if (filename.endsWith('.db')) {
      fs.copyFileSync(filepath, previewDbPath);
    } else if (filename.endsWith('.zip')) {
      const zip = new AdmZip(filepath);
      const zipEntries = zip.getEntries();
      const dbEntry = zipEntries.find(e => e.entryName === 'inventory.db');
      if (dbEntry) {
        fs.writeFileSync(previewDbPath, dbEntry.getData());
      } else {
        const jsonEntry = zipEntries.find(e => e.entryName === 'inventory-on-site.json');
        if (jsonEntry) {
          const jsonText = jsonEntry.getData().toString('utf8');
          const parsed = JSON.parse(jsonText);
          isPreviewMode = true;
          previewBackupFilename = filename;
          initDatabase();
          if (parsed && typeof parsed === 'object') {
            saveStateSync(parsed);
          }
          return res.json({ success: true, isPreviewMode: true, previewBackupFilename: filename, message: `Started live snapshot preview for "${filename}".` });
        } else {
          return res.status(400).json({ error: `ZIP archive "${filename}" does not contain inventory.db or inventory-on-site.json.` });
        }
      }
    } else if (filename.endsWith('.json')) {
      isPreviewMode = true;
      previewBackupFilename = filename;
      initDatabase();
      const jsonText = fs.readFileSync(filepath, 'utf8');
      const parsed = JSON.parse(jsonText);
      if (parsed && typeof parsed === 'object') {
        saveStateSync(parsed);
      }
      return res.json({ success: true, isPreviewMode: true, previewBackupFilename: filename, message: `Started live snapshot preview for "${filename}".` });
    } else {
      return res.status(400).json({ error: 'Unsupported snapshot file format for live preview.' });
    }

    isPreviewMode = true;
    previewBackupFilename = filename;
    initDatabase();

    res.json({
      success: true,
      isPreviewMode: true,
      previewBackupFilename: filename,
      message: `Started live snapshot preview for "${filename}". All application views are now in read-only preview mode.`
    });
  } catch (err: any) {
    console.error('Failed to start preview mode:', err);
    res.status(500).json({ error: `Failed to start live preview mode: ${err.message}` });
  }
});

app.post('/api/backups/preview-mode/end', async (req, res) => {
  try {
    isPreviewMode = false;
    previewBackupFilename = null;

    if (db) {
      try { db.close(); } catch (e) {}
      db = null;
    }

    const previewDbPath = path.join(DATA_DIR, 'inventory_preview.db');
    const previewWal = `${previewDbPath}-wal`;
    const previewShm = `${previewDbPath}-shm`;

    if (fs.existsSync(previewDbPath)) { try { fs.unlinkSync(previewDbPath); } catch (e) {} }
    if (fs.existsSync(previewWal)) { try { fs.unlinkSync(previewWal); } catch (e) {} }
    if (fs.existsSync(previewShm)) { try { fs.unlinkSync(previewShm); } catch (e) {} }

    initDatabase();

    res.json({ success: true, isPreviewMode: false, message: 'Exited live snapshot preview mode. Restored live database.' });
  } catch (err: any) {
    console.error('Failed to end preview mode:', err);
    res.status(500).json({ error: `Failed to end live preview mode: ${err.message}` });
  }
});

function selectiveRestoreFromDb(srcDbPath: string, targetSections: string[]) {
  const srcDb = new Database(srcDbPath, { readonly: true });
  try {
    const copyTable = (tableName: string) => {
      try {
        const tableInSrc = srcDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
        if (!tableInSrc) return;
        const tableInTarget = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
        if (!tableInTarget) return;

        const srcCols = (srcDb.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map(c => c.name);
        const targetCols = new Set((db.prepare(`PRAGMA table_info(${tableName})`).all() as any[]).map(c => c.name));
        const commonCols = srcCols.filter(col => targetCols.has(col));

        if (commonCols.length === 0) return;

        const rows = srcDb.prepare(`SELECT ${commonCols.join(', ')} FROM ${tableName}`).all();
        db.prepare(`DELETE FROM ${tableName}`).run();
        if (rows.length > 0) {
          const placeholders = commonCols.map(() => '?').join(',');
          const stmt = db.prepare(`INSERT INTO ${tableName} (${commonCols.join(',')}) VALUES (${placeholders})`);
          for (const item of rows) {
            stmt.run(...commonCols.map(c => (item as any)[c]));
          }
        }
      } catch (err) {
        console.warn(`Selective restore copy table warning (${tableName}):`, err);
      }
    };

    db.transaction(() => {
      if (targetSections.includes('freezers') || targetSections.includes('locations')) {
        copyTable('freezers');
        copyTable('locations');
      }
      if (targetSections.includes('containers')) {
        copyTable('containers');
        copyTable('container_templates');
      }
      if (targetSections.includes('products') || targetSections.includes('catalog')) {
        copyTable('products');
        copyTable('categories');
      }
      if (targetSections.includes('meatCuts') || targetSections.includes('inventory')) {
        copyTable('meat_cuts');
      }
      if (targetSections.includes('offSiteEntries') || targetSections.includes('offsite')) {
        copyTable('off_site_entries');
        copyTable('pallets');
        copyTable('boxes');
        copyTable('butcher_orders');
      }
      if (targetSections.includes('customLists') || targetSections.includes('settings')) {
        copyTable('custom_lists');
        copyTable('movement_orders');
        copyTable('notification_settings');
        copyTable('notification_logs');
        copyTable('app_config');
      }
      if (targetSections.includes('tags')) {
        copyTable('tags');
      }
      if (targetSections.includes('history') || targetSections.includes('audit') || targetSections.includes('logs')) {
        copyTable('history');
      }
    })();
  } finally {
    srcDb.close();
  }
}

app.post('/api/backups/restore/:filename', async (req: any, res) => {
  try {
    const { filename } = req.params;
    const { sections, restoreImages } = req.body; // e.g. ['freezers', 'containers', 'products', 'meatCuts', 'offSiteEntries', 'customLists', 'tags', 'images'] or ['full']
    const filepath = path.join(BACKUPS_DIR, filename);

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found.' });
    }

    const isFullRestore = !sections || sections.length === 0 || sections.includes('full');

    if (filename.endsWith('.db')) {
      if (isFullRestore) {
        db.close();
        const dbPath = getDatabasePath();
        const walPath = `${dbPath}-wal`;
        const shmPath = `${dbPath}-shm`;
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
        fs.copyFileSync(filepath, dbPath);
        initDatabase();
      } else {
        selectiveRestoreFromDb(filepath, sections);
      }
      loadAutoSnapshotConfig();
      notifyInventoryUpdate();
      return res.json({ success: true, message: 'SQLite database restored successfully.' });
    }

    if (filename.endsWith('.zip')) {
      const zip = new AdmZip(filepath);
      const zipEntries = zip.getEntries();
      const dbEntry = zipEntries.find(e => !e.isDirectory && (e.entryName === 'inventory.db' || e.entryName.toLowerCase().endsWith('/inventory.db') || e.entryName.toLowerCase().endsWith('.db')));
      const onSiteEntry = zipEntries.find(e => !e.isDirectory && (e.entryName === 'inventory-on-site.json' || e.entryName.toLowerCase().endsWith('/inventory-on-site.json') || e.entryName.toLowerCase().endsWith('.json')));
      const offSiteEntry = zipEntries.find(e => !e.isDirectory && (e.entryName === 'inventory-off-site.csv' || e.entryName.toLowerCase().endsWith('/inventory-off-site.csv') || e.entryName.toLowerCase().endsWith('.csv')));

      let restoredAny = false;

      if (dbEntry) {
        const tempDbPath = path.join(BACKUPS_DIR, `temp_zip_restore_${Date.now()}.db`);
        fs.writeFileSync(tempDbPath, dbEntry.getData());
        try {
          if (isFullRestore) {
            db.close();
            const dbPath = getDatabasePath();
            const walPath = `${dbPath}-wal`;
            const shmPath = `${dbPath}-shm`;
            if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
            if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
            fs.copyFileSync(tempDbPath, dbPath);
            initDatabase();
          } else {
            selectiveRestoreFromDb(tempDbPath, sections);
          }
          restoredAny = true;
        } finally {
          if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
        }
      } else if (onSiteEntry || offSiteEntry) {
        let currentState = await loadState();
        if (onSiteEntry) {
          try {
            const text = onSiteEntry.getData().toString('utf8');
            const backupData = JSON.parse(text);
            if (backupData) {
              const srcFreezers = backupData.freezers || backupData.locations || backupData.cabinets;
              const srcContainers = backupData.containers || backupData.bins || backupData.boxes;
              const srcProducts = backupData.products || backupData.catalog || backupData.items;
              const srcCategories = backupData.categories;
              const srcMeatCuts = backupData.meatCuts || backupData.meatcuts || backupData.inventory || backupData.stock || backupData.stockCounts || backupData.counts;
              const srcOffSite = backupData.offSiteEntries || backupData.offsiteEntries || backupData.offsite || backupData.offSite;
              const srcHistory = backupData.history || backupData.logs;
              const srcCustomLists = backupData.customLists || backupData.customlists || backupData.lists;
              const srcTags = backupData.tags;

              const doFreezers = isFullRestore || sections?.includes('freezers') || sections?.includes('locations');
              const doContainers = isFullRestore || sections?.includes('containers');
              const doProducts = isFullRestore || sections?.includes('products') || sections?.includes('catalog') || sections?.includes('items');
              const doMeatCuts = isFullRestore || sections?.includes('meatCuts') || sections?.includes('inventory');
              const doOffSite = isFullRestore || sections?.includes('offSiteEntries') || sections?.includes('offsite');
              const doCustomLists = isFullRestore || sections?.includes('customLists');
              const doTags = isFullRestore || sections?.includes('tags');
              const doHistory = isFullRestore || sections?.includes('history') || sections?.includes('audit') || sections?.includes('logs');

              if (isFullRestore) {
                currentState = {
                  ...defaultInitialState,
                  freezers: srcFreezers || defaultInitialState.freezers,
                  containers: srcContainers || defaultInitialState.containers,
                  products: srcProducts || defaultInitialState.products,
                  categories: srcCategories || defaultInitialState.categories || [],
                  meatCuts: srcMeatCuts || defaultInitialState.meatCuts,
                  offSiteEntries: srcOffSite || defaultInitialState.offSiteEntries,
                  history: srcHistory || defaultInitialState.history,
                  customLists: srcCustomLists || defaultInitialState.customLists || [],
                  tags: srcTags || defaultInitialState.tags || [],
                  locations: backupData.locations || defaultInitialState.locations || [],
                  movementOrders: backupData.movementOrders || defaultInitialState.movementOrders || [],
                  notificationSettings: backupData.notificationSettings || currentState.notificationSettings || [],
                  notificationLogs: backupData.notificationLogs || currentState.notificationLogs || [],
                };
              } else {
                if (doFreezers && srcFreezers) currentState.freezers = srcFreezers;
                if (doContainers && srcContainers) currentState.containers = srcContainers;
                if (doProducts && srcProducts) {
                  currentState.products = srcProducts;
                  if (srcCategories) currentState.categories = srcCategories;
                }
                if (doMeatCuts && srcMeatCuts) currentState.meatCuts = srcMeatCuts;
                if (doOffSite && srcOffSite) currentState.offSiteEntries = srcOffSite;
                if (doCustomLists && srcCustomLists) currentState.customLists = srcCustomLists;
                if (doTags && srcTags) currentState.tags = srcTags;
                if (doHistory && srcHistory) currentState.history = srcHistory;
              }
              restoredAny = true;
            }
          } catch (err) {
            console.error('Failed to parse on-site JSON in ZIP restore:', err);
          }
        }

        if (offSiteEntry && (isFullRestore || sections?.includes('offSiteEntries') || sections?.includes('offsite'))) {
          try {
            const csvText = offSiteEntry.getData().toString('utf8');
            const lines = csvText.split(/\r?\n/).filter(line => line.trim());
            if (lines.length > 0) {
              const newEntries = [];
              for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                let cols: string[] = [];
                let currentField = '';
                let inQuotes = false;
                for (let charIndex = 0; charIndex < line.length; charIndex++) {
                  const char = line[charIndex];
                  if (char === '"') inQuotes = !inQuotes;
                  else if (char === ',' && !inQuotes) { cols.push(currentField); currentField = ''; }
                  else currentField += char;
                }
                cols.push(currentField);

                if (cols.length >= 2) {
                  const isNewLayout = cols.length >= 12 || (lines[0] && lines[0].toLowerCase().includes('location') && lines[0].toLowerCase().includes('pallet'));
                  const serial = cols[0] || '0';
                  const cuts = cols[1] || '';
                  const packDate = cols[2] || '';
                  const lot = cols[3] || '';
                  const pieces = parseFloat(String(cols[4] || 0).replace(/[^0-9.]/g, '')) || 0;
                  const netWeight = parseFloat(String(cols[5] || 0).replace(/[^0-9.]/g, '')) || 0;
                  const mwOrderNumber = cols[6] || '';
                  const box = cols[7] || '';
                  let notes = '';
                  let currentLocation = '';
                  let locationName = '';

                  if (isNewLayout) {
                    locationName = cols[8] || '';
                    currentLocation = cols[9] || '';
                    notes = cols[10] || '';
                  } else {
                    currentLocation = cols[9] || '';
                    notes = cols[10] || '';
                  }

                  let storageLocationId = undefined;
                  if (locationName) {
                    const matchedLocName = locationName.trim().toLowerCase();
                    const foundLoc = (currentState.locations || []).find(l => l.name.trim().toLowerCase() === matchedLocName);
                    if (foundLoc) storageLocationId = foundLoc.id;
                  }

                  newEntries.push({
                    id: crypto.randomUUID(),
                    serial,
                    cuts,
                    packDate,
                    lot,
                    pieces,
                    netWeight,
                    mwOrderNumber,
                    box,
                    moveTo: '',
                    location: locationName,
                    pallet: currentLocation,
                    currentLocation: currentLocation,
                    notes,
                    storageLocationId
                  });
                }
              }
              currentState.offSiteEntries = newEntries;
              restoredAny = true;
            }
          } catch (err) {
            console.error('Failed to parse off-site CSV in ZIP restore:', err);
          }
        }

        if (restoredAny) {
          await saveState(currentState);
        }
      }

      if (isFullRestore || restoreImages || sections?.includes('images')) {
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const validImgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        zipEntries.forEach(entry => {
          if (!entry.isDirectory) {
            const entryLower = entry.entryName.toLowerCase();
            const imageName = path.basename(entry.entryName);
            const ext = path.extname(imageName).toLowerCase();
            if (imageName && (validImgExts.includes(ext) || entryLower.includes('images/') || entryLower.includes('photos/') || entryLower.includes('uploads/'))) {
              if (validImgExts.includes(ext)) {
                fs.writeFileSync(path.join(UPLOADS_DIR, imageName), entry.getData());
              }
            }
          }
        });
      }

      notifyInventoryUpdate();
      return res.json({ success: true, message: 'Full Package ZIP restored successfully.' });
    }

    if (filename.endsWith('.csv')) {
      const csvText = fs.readFileSync(filepath, 'utf-8');
      const lines = csvText.split(/\r?\n/);
      if (lines.length > 0) {
        const entries: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const cols: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cols.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          cols.push(current);

          if (cols.length >= 6) {
            entries.push({
              id: crypto.randomUUID(),
              serial: cols[0] || '',
              cuts: cols[1] || '',
              packDate: cols[2] || '',
              lot: cols[3] || '',
              pieces: parseInt(cols[4]) || 0,
              netWeight: parseFloat(cols[5]) || 0,
              mwOrderNumber: cols[6] || '',
              box: cols[7] || '',
              location: cols[8] || '',
              currentLocation: cols[9] || '',
              notes: cols[10] || ''
            });
          }
        }

        let currentState = await loadState();
        currentState.offSiteEntries = entries;
        await saveState(currentState);
        notifyInventoryUpdate();
        return res.json({ success: true, message: 'Offsite inventory entries CSV restored successfully.' });
      }
    }

    const backupData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    let currentState = await loadState();

    const srcFreezers = backupData.freezers || backupData.locations || backupData.cabinets;
    const srcContainers = backupData.containers || backupData.bins || backupData.boxes;
    const srcProducts = backupData.products || backupData.catalog || backupData.items;
    const srcCategories = backupData.categories;
    const srcMeatCuts = backupData.meatCuts || backupData.meatcuts || backupData.inventory || backupData.stock || backupData.stockCounts || backupData.counts;
    const srcOffSite = backupData.offSiteEntries || backupData.offsiteEntries || backupData.offsite || backupData.offSite;
    const srcHistory = backupData.history || backupData.logs;
    const srcCustomLists = backupData.customLists || backupData.customlists || backupData.lists;
    const srcTags = backupData.tags;

    if (isFullRestore) {
      currentState = {
        ...defaultInitialState,
        freezers: srcFreezers || defaultInitialState.freezers,
        containers: srcContainers || defaultInitialState.containers,
        products: srcProducts || defaultInitialState.products,
        categories: srcCategories || defaultInitialState.categories || [],
        meatCuts: srcMeatCuts || defaultInitialState.meatCuts,
        offSiteEntries: srcOffSite || defaultInitialState.offSiteEntries,
        history: srcHistory || defaultInitialState.history,
        customLists: srcCustomLists || defaultInitialState.customLists || [],
        tags: srcTags || defaultInitialState.tags || [],
        locations: backupData.locations || defaultInitialState.locations || [],
        movementOrders: backupData.movementOrders || defaultInitialState.movementOrders || [],
        notificationSettings: backupData.notificationSettings || currentState.notificationSettings || [],
        notificationLogs: backupData.notificationLogs || currentState.notificationLogs || [],
      };
    } else {
      if (sections.includes('locations')) {
        if (srcFreezers) currentState.freezers = srcFreezers;
        if (srcContainers) currentState.containers = srcContainers;
      } else {
        if (sections.includes('freezers') && srcFreezers) currentState.freezers = srcFreezers;
        if (sections.includes('containers') && srcContainers) currentState.containers = srcContainers;
      }
      if ((sections.includes('catalog') || sections.includes('products') || sections.includes('items')) && srcProducts) {
        currentState.products = srcProducts;
        if (srcCategories) currentState.categories = srcCategories;
      }
      if ((sections.includes('inventory') || sections.includes('meatCuts')) && srcMeatCuts) {
        currentState.meatCuts = srcMeatCuts;
      }
      if ((sections.includes('offsite') || sections.includes('offSiteEntries')) && srcOffSite) {
        currentState.offSiteEntries = srcOffSite;
      }
      if (sections.includes('customLists') && srcCustomLists) currentState.customLists = srcCustomLists;
      if (sections.includes('tags') && srcTags) currentState.tags = srcTags;
      if (sections.includes('history') && srcHistory) currentState.history = srcHistory;
    }

    await saveState(currentState);
    notifyInventoryUpdate();
    res.json({ success: true, message: 'Restore completed.' });
  } catch (err: any) {
    console.error('Restore error:', err);
    res.status(500).json({ error: 'Failed to restore backup.' });
  }
});

app.delete('/api/backups/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // VERY Basic sanitization
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid file name' });
    }
    const filepath = path.join(BACKUPS_DIR, filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete backup.' });
  }
});

app.get('/api/backups/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // VERY Basic sanitization
    if (filename.includes('..') || filename.includes('/')) {
        return res.status(400).json({ error: 'Invalid file name' });
    }
    const filepath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found.' });
    }
    res.download(filepath, filename);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to download backup.' });
  }
});

app.get('/api/backups/preview/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/')) {
      return res.status(400).json({ error: 'Invalid file name' });
    }
    const filepath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found.' });
    }

    const stats = fs.statSync(filepath);
    const summary: any = {
      filename,
      size: stats.size,
      createdAt: stats.birthtime.toISOString(),
      type: filename.endsWith('.db') ? 'sqlite' : filename.endsWith('.csv') ? 'csv' : filename.endsWith('.zip') ? 'zip' : 'json',
      counts: {},
      samples: {}
    };

    const parseOffSiteCsvData = (csvText: string) => {
      const lines = csvText.split(/\r?\n/).filter(l => l.trim());
      let piecesSum = 0;
      let weightSum = 0;
      const sampleCuts: string[] = [];
      let count = 0;

      if (lines.length > 1) {
        count = lines.length - 1;
        const headerLine = lines[0];
        let headerCols: string[] = [];
        let currentField = '';
        let inQuotes = false;
        for (let charIndex = 0; charIndex < headerLine.length; charIndex++) {
          const char = headerLine[charIndex];
          if (char === '"') inQuotes = !inQuotes;
          else if (char === ',' && !inQuotes) { headerCols.push(currentField.trim()); currentField = ''; }
          else currentField += char;
        }
        headerCols.push(currentField.trim());

        let piecesIdx = headerCols.findIndex(c => /piece|qty|count/i.test(c));
        let weightIdx = headerCols.findIndex(c => /weight|lbs/i.test(c));
        let cutIdx = headerCols.findIndex(c => /cut|item|name|product/i.test(c));

        if (piecesIdx === -1) piecesIdx = 4;
        if (weightIdx === -1) weightIdx = 5;
        if (cutIdx === -1) cutIdx = 1;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          let cols: string[] = [];
          let field = '';
          let q = false;
          for (let cIdx = 0; cIdx < line.length; cIdx++) {
            const char = line[cIdx];
            if (char === '"') q = !q;
            else if (char === ',' && !q) { cols.push(field.trim()); field = ''; }
            else field += char;
          }
          cols.push(field.trim());

          if (cols.length >= 2) {
            const cutName = cols[cutIdx] || cols[1] || '';
            if (cutName && sampleCuts.length < 5) {
              sampleCuts.push(cutName.replace(/^"|"$/g, ''));
            }
            const rawPieces = cols[piecesIdx] ?? cols[4] ?? '0';
            const rawWeight = cols[weightIdx] ?? cols[5] ?? '0';

            const piecesVal = parseFloat(String(rawPieces).replace(/[^0-9.]/g, '')) || 0;
            const weightVal = parseFloat(String(rawWeight).replace(/[^0-9.]/g, '')) || 0;

            piecesSum += piecesVal;
            weightSum += weightVal;
          }
        }
      }

      return {
        count,
        sampleCuts,
        offSiteSumPieces: piecesSum,
        offSiteSumWeight: weightSum
      };
    };

    const inspectDbFile = (targetDbPath: string, targetSummary: any) => {
      let tempDb: any;
      try {
        tempDb = new Database(targetDbPath, { readonly: true });
        
        const getCount = (table: string) => {
          try {
            const row = tempDb.prepare(`SELECT count(*) as count FROM ${table}`).get();
            return row ? (row as any).count : 0;
          } catch (e) {
            return 0;
          }
        };

        const getNames = (table: string, limit = 5) => {
          try {
            const rows = tempDb.prepare(`SELECT name FROM ${table} LIMIT ${limit}`).all();
            return rows.map((r: any) => r.name);
          } catch (e) {
            return [];
          }
        };

        targetSummary.counts.freezers = getCount('freezers');
        targetSummary.counts.containers = getCount('containers');
        targetSummary.counts.products = getCount('products');
        targetSummary.counts.meatCuts = getCount('meat_cuts');
        targetSummary.counts.offSiteEntries = getCount('off_site_entries');
        targetSummary.counts.customLists = getCount('custom_lists');
        targetSummary.counts.tags = getCount('tags');
        targetSummary.counts.history = getCount('history');
        targetSummary.counts.butcherOrders = getCount('butcher_orders');

        let tempButcherRecordsCount = 0;
        try {
          const row = tempDb.prepare(`SELECT count(*) as count FROM off_site_entries WHERE orderId IS NOT NULL`).get() as any;
          tempButcherRecordsCount = row ? row.count : 0;
        } catch (e) {
          // ignore
        }
        targetSummary.counts.butcherRecords = tempButcherRecordsCount;

        targetSummary.samples.freezers = getNames('freezers');
        targetSummary.samples.containers = getNames('containers');
        targetSummary.samples.products = getNames('products');
        targetSummary.samples.customLists = getNames('custom_lists');
        targetSummary.samples.tags = getNames('tags');

        try {
          const onSiteSum = tempDb.prepare(`SELECT sum(quantity) as sumQty FROM meat_cuts WHERE productId IS NOT NULL`).get() as any;
          targetSummary.onSiteSumQty = onSiteSum ? (onSiteSum.sumQty || 0) : 0;

          const onSiteIndiv = tempDb.prepare(`SELECT sum(pieces) as sumPieces, sum(netWeight) as sumWeight FROM meat_cuts WHERE productId IS NULL`).get() as any;
          targetSummary.onSiteSumPieces = onSiteIndiv ? (onSiteIndiv.sumPieces || 0) : 0;
          targetSummary.onSiteSumWeight = onSiteIndiv ? (onSiteIndiv.sumWeight || 0) : 0;
        } catch (e) {
          // ignore
        }

        try {
          const offSiteRows = tempDb.prepare(`SELECT originalCutName, pieces, netWeight FROM off_site_entries`).all() as any[];
          let dbPieces = 0;
          let dbWeight = 0;
          const sampleCuts: string[] = [];
          for (const r of offSiteRows) {
            const cutName = r.originalCutName;
            if (cutName && sampleCuts.length < 5) sampleCuts.push(cutName);
            dbPieces += parseFloat(String(r.pieces || 0).replace(/[^0-9.]/g, '')) || 0;
            dbWeight += parseFloat(String(r.netWeight || 0).replace(/[^0-9.]/g, '')) || 0;
          }
          targetSummary.offSiteSumPieces = dbPieces;
          targetSummary.offSiteSumWeight = dbWeight;
          if (sampleCuts.length > 0) targetSummary.samples.offSiteCuts = sampleCuts;
        } catch (e) {
          // ignore
        }
      } finally {
        if (tempDb) {
          try { tempDb.close(); } catch (e) {}
        }
      }
    };

    if (filename.endsWith('.db')) {
      try {
        inspectDbFile(filepath, summary);
      } catch (dbErr: any) {
        return res.status(500).json({ error: `Failed to read SQLite backup: ${dbErr.message}` });
      }
    } else if (filename.endsWith('.json')) {
      try {
        const fileContent = fs.readFileSync(filepath, 'utf-8');
        const data = JSON.parse(fileContent);

        const getArrayLength = (arr: any) => Array.isArray(arr) ? arr.length : 0;
        const getNamesSample = (arr: any, limit = 5) => {
          if (!Array.isArray(arr)) return [];
          return arr.slice(0, limit).map((x: any) => x.name || x.id).filter(Boolean);
        };

        summary.counts.freezers = getArrayLength(data.freezers || data.locations || data.cabinets);
        summary.counts.containers = getArrayLength(data.containers || data.bins || data.boxes);
        summary.counts.products = getArrayLength(data.products || data.catalog || data.items);
        
        const meatCuts = data.meatCuts || data.meatcuts || data.inventory || data.stock || data.stockCounts || data.counts || [];
        summary.counts.meatCuts = getArrayLength(meatCuts);

        const offSiteEntries = data.offSiteEntries || data.offsiteEntries || data.offsite || data.offSite || [];
        summary.counts.offSiteEntries = getArrayLength(offSiteEntries);

        summary.counts.customLists = getArrayLength(data.customLists || data.customlists || data.lists);
        summary.counts.tags = getArrayLength(data.tags);
        summary.counts.history = getArrayLength(data.history || data.logs);
        summary.counts.butcherOrders = getArrayLength(data.butcherOrders);
        summary.counts.butcherRecords = getArrayLength(data.butcherRecords);

        summary.samples.freezers = getNamesSample(data.freezers || data.locations || data.cabinets);
        summary.samples.containers = getNamesSample(data.containers || data.bins || data.boxes);
        summary.samples.products = getNamesSample(data.products || data.catalog || data.items);
        summary.samples.customLists = getNamesSample(data.customLists || data.customlists || data.lists);
        summary.samples.tags = getNamesSample(data.tags);

        if (Array.isArray(meatCuts)) {
          let onSiteQty = 0;
          let onSitePieces = 0;
          let onSiteWeight = 0;
          meatCuts.forEach((mc: any) => {
            if ('productId' in mc) {
              onSiteQty += Number(mc.quantity || 0);
            } else {
              onSitePieces += Number(mc.pieces || 0);
              onSiteWeight += Number(mc.netWeight || 0);
            }
          });
          summary.onSiteSumQty = onSiteQty;
          summary.onSiteSumPieces = onSitePieces;
          summary.onSiteSumWeight = onSiteWeight;
        }

        if (Array.isArray(offSiteEntries)) {
          let offSitePieces = 0;
          let offSiteWeight = 0;
          const sampleCuts: string[] = [];
          offSiteEntries.forEach((e: any) => {
            const cutName = e.cuts || e.originalCutName || e.cutName || e.name || '';
            if (cutName && sampleCuts.length < 5) sampleCuts.push(cutName);
            offSitePieces += parseFloat(String(e.pieces || 0).replace(/[^0-9.]/g, '')) || 0;
            offSiteWeight += parseFloat(String(e.netWeight || 0).replace(/[^0-9.]/g, '')) || 0;
          });
          summary.offSiteSumPieces = offSitePieces;
          summary.offSiteSumWeight = offSiteWeight;
          if (sampleCuts.length > 0) summary.samples.offSiteCuts = sampleCuts;
        }
      } catch (jsonErr: any) {
        return res.status(500).json({ error: `Failed to read JSON backup: ${jsonErr.message}` });
      }
    } else if (filename.endsWith('.csv')) {
      try {
        const csvText = fs.readFileSync(filepath, 'utf-8');
        const parsedCsv = parseOffSiteCsvData(csvText);
        summary.counts.offSiteEntries = parsedCsv.count;
        summary.samples.offSiteCuts = parsedCsv.sampleCuts;
        summary.offSiteSumPieces = parsedCsv.offSiteSumPieces;
        summary.offSiteSumWeight = parsedCsv.offSiteSumWeight;
      } catch (csvErr: any) {
        return res.status(500).json({ error: `Failed to read CSV backup: ${csvErr.message}` });
      }
    } else if (filename.endsWith('.zip')) {
      try {
        const zip = new AdmZip(filepath);
        const zipEntries = zip.getEntries();
        summary.zipFiles = zipEntries.map(e => ({ name: e.entryName, size: e.header.size }));
        
        const dbEntry = zipEntries.find(e => e.entryName === 'inventory.db');
        if (dbEntry) {
          const tempDbPath = path.join(BACKUPS_DIR, `temp_zip_preview_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.db`);
          fs.writeFileSync(tempDbPath, dbEntry.getData());
          try {
            inspectDbFile(tempDbPath, summary);
          } finally {
            if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
          }
        }

        const onSiteEntry = zipEntries.find(e => e.entryName === 'inventory-on-site.json');
        if (onSiteEntry) {
          const text = onSiteEntry.getData().toString('utf8');
          const parsed = JSON.parse(text);
          if (parsed) {
            const getArrayLength = (arr: any) => Array.isArray(arr) ? arr.length : 0;
            if (!summary.counts.freezers) summary.counts.freezers = getArrayLength(parsed.freezers || parsed.locations || parsed.cabinets);
            if (!summary.counts.containers) summary.counts.containers = getArrayLength(parsed.containers || parsed.bins || parsed.boxes);
            if (!summary.counts.products) summary.counts.products = getArrayLength(parsed.products || parsed.catalog || parsed.items);
            
            const meatCuts = parsed.meatCuts || parsed.meatcuts || parsed.inventory || parsed.stock || [];
            if (!summary.counts.meatCuts) summary.counts.meatCuts = getArrayLength(meatCuts);
            if (!summary.counts.customLists) summary.counts.customLists = getArrayLength(parsed.customLists || parsed.lists);
            if (!summary.counts.tags) summary.counts.tags = getArrayLength(parsed.tags);
            if (!summary.counts.history) summary.counts.history = getArrayLength(parsed.history || parsed.logs);

            if (Array.isArray(meatCuts) && (summary.onSiteSumQty === undefined || summary.onSiteSumQty === 0)) {
              let onSiteQty = 0;
              let onSitePieces = 0;
              let onSiteWeight = 0;
              meatCuts.forEach((mc: any) => {
                if ('productId' in mc) {
                  onSiteQty += Number(mc.quantity || 0);
                } else {
                  onSitePieces += Number(mc.pieces || 0);
                  onSiteWeight += Number(mc.netWeight || 0);
                }
              });
              summary.onSiteSumQty = onSiteQty;
              summary.onSiteSumPieces = onSitePieces;
              summary.onSiteSumWeight = onSiteWeight;
            }

            const jsonOffSite = parsed.offSiteEntries || parsed.offsiteEntries || parsed.offsite || [];
            if (Array.isArray(jsonOffSite) && jsonOffSite.length > 0 && (!summary.counts.offSiteEntries || summary.counts.offSiteEntries === 0)) {
              let offSitePieces = 0;
              let offSiteWeight = 0;
              const sampleCuts: string[] = [];
              jsonOffSite.forEach((e: any) => {
                const cutName = e.cuts || e.originalCutName || e.cutName || '';
                if (cutName && sampleCuts.length < 5) sampleCuts.push(cutName);
                offSitePieces += parseFloat(String(e.pieces || 0).replace(/[^0-9.]/g, '')) || 0;
                offSiteWeight += parseFloat(String(e.netWeight || 0).replace(/[^0-9.]/g, '')) || 0;
              });
              summary.counts.offSiteEntries = jsonOffSite.length;
              summary.offSiteSumPieces = offSitePieces;
              summary.offSiteSumWeight = offSiteWeight;
              if (!summary.samples.offSiteCuts || summary.samples.offSiteCuts.length === 0) {
                summary.samples.offSiteCuts = sampleCuts;
              }
            }
          }
        }

        const offSiteEntry = zipEntries.find(e => e.entryName === 'inventory-off-site.csv');
        if (offSiteEntry) {
          const csvText = offSiteEntry.getData().toString('utf8');
          const parsedCsv = parseOffSiteCsvData(csvText);
          if (!summary.counts.offSiteEntries || summary.counts.offSiteEntries === 0 || !summary.offSiteSumPieces || summary.offSiteSumPieces === 0) {
            summary.counts.offSiteEntries = parsedCsv.count;
            summary.offSiteSumPieces = parsedCsv.offSiteSumPieces;
            summary.offSiteSumWeight = parsedCsv.offSiteSumWeight;
            if (!summary.samples.offSiteCuts || summary.samples.offSiteCuts.length === 0) {
              summary.samples.offSiteCuts = parsedCsv.sampleCuts;
            }
          }
        }

        const validImgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
        const imagesFolder = zipEntries.filter(e => {
          if (e.isDirectory) return false;
          const lower = e.entryName.toLowerCase();
          const fname = path.basename(e.entryName);
          const ext = path.extname(fname).toLowerCase();
          return validImgExts.includes(ext) || lower.includes('images/') || lower.includes('photos/') || lower.includes('uploads/');
        });
        summary.counts.images = imagesFolder.length;
      } catch (zipErr: any) {
        return res.status(500).json({ error: `Failed to parse ZIP backup: ${zipErr.message}` });
      }
    }

    const currentCounts: any = {};
    if (db) {
      const getDbCount = (tbl: string) => {
        try {
          const row = db.prepare(`SELECT count(*) as c FROM ${tbl}`).get() as any;
          return row ? row.c : 0;
        } catch { return 0; }
      };
      currentCounts.freezers = getDbCount('freezers');
      currentCounts.containers = getDbCount('containers');
      currentCounts.products = getDbCount('products');
      currentCounts.meatCuts = getDbCount('meat_cuts');
      currentCounts.offSiteEntries = getDbCount('off_site_entries');
      currentCounts.customLists = getDbCount('custom_lists');
      currentCounts.tags = getDbCount('tags');
      currentCounts.history = getDbCount('history');
      currentCounts.images = fs.existsSync(UPLOADS_DIR) 
        ? fs.readdirSync(UPLOADS_DIR).filter(f => {
            try { return fs.statSync(path.join(UPLOADS_DIR, f)).isFile(); } catch { return false; }
          }).length 
        : 0;
    }
    summary.currentCounts = currentCounts;

    res.json(summary);
  } catch (err: any) {
    console.error('Backup preview error:', err);
    res.status(500).json({ error: `Failed to fetch snapshot preview: ${err.message}` });
  }
});

app.post('/api/backups/upload', async (req: any, res) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      return res.status(400).json({ error: 'Missing filename or base64 data.' });
    }

    const safeFilename = path.basename(filename);
    if (safeFilename !== filename) {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    if (!['.db', '.json', '.csv', '.zip'].includes(ext)) {
      return res.status(400).json({ error: 'Only .db, .json, .csv, and .zip files are allowed.' });
    }

    let base64Data = base64;
    if (base64.startsWith('data:')) {
      const parts = base64.split(',');
      base64Data = parts[1] || parts[0];
    }

    const buffer = Buffer.from(base64Data, 'base64');
    
    let targetFilename = safeFilename;
    let filepath = path.join(BACKUPS_DIR, targetFilename);
    if (fs.existsSync(filepath)) {
      const baseName = path.basename(safeFilename, ext);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
      targetFilename = `${baseName}_${timestamp}${ext}`;
      filepath = path.join(BACKUPS_DIR, targetFilename);
    }

    fs.writeFileSync(filepath, buffer);
    res.json({ success: true, filename: targetFilename });
  } catch (err: any) {
    console.error('Backup upload error:', err);
    res.status(500).json({ error: `Failed to upload backup: ${err.message}` });
  }
});

app.post('/api/backups/export-zip', async (req: any, res) => {
  try {
    const { 
      includeOnSite, 
      includeOffSite, 
      includeImages,
      includeFreezers,
      includeContainers,
      includeProducts,
      includeMeatCuts,
      includeCustomLists,
      includeTags
    } = req.body;
    const zip = new AdmZip();

    // 1. Always include SQLite Database snapshot (inventory.db)
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const tempDbPath = path.join(BACKUPS_DIR, `temp_export_${timestampStr}.db`);
    if (!db) initDatabase();
    db.prepare('VACUUM INTO ?').run(tempDbPath);
    zip.addLocalFile(tempDbPath, '', 'inventory.db');

    // 2. Add Off-Site CSV if requested
    if (includeOffSite) {
      const state = await loadState();
      const entries = state.offSiteEntries || [];
      const headers = 'Serial,cuts,Pack Date,Lot,# Pieces,Net Weight, Order Number,Box,location,Pallet,Notes';
      const rows = entries.map((e: any) => {
        const cleanCut = (e.cuts || '').includes(',') ? `"${e.cuts}"` : (e.cuts || '');
        const cleanNotes = (e.notes || '').includes(',') ? `"${e.notes}"` : (e.notes || '');
        return [
          e.serial || '',
          cleanCut,
          e.packDate || '',
          e.lot || '',
          e.pieces || '0',
          e.netWeight || '0',
          e.mwOrderNumber || '',
          e.box || '',
          e.location || '',
          e.currentLocation || e.pallet || '',
          cleanNotes
        ].join(',');
      });
      const csvContent = [headers, ...rows].join('\r\n');
      zip.addFile('inventory-off-site.csv', Buffer.from(csvContent, 'utf-8'));
    }

    // 3. Add Photos if requested
    if (includeImages) {
      if (fs.existsSync(UPLOADS_DIR)) {
        const files = fs.readdirSync(UPLOADS_DIR);
        files.forEach(f => {
          const fullPath = path.join(UPLOADS_DIR, f);
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            zip.addLocalFile(fullPath, 'images');
          }
        });
      }
    }

    // 4. Add Config
    const currentConfig = loadAutoSnapshotConfig();
    zip.addFile('config.json', Buffer.from(JSON.stringify(currentConfig, null, 2), 'utf-8'));

    const zipBuffer = zip.toBuffer();
    if (fs.existsSync(tempDbPath)) {
      try { fs.unlinkSync(tempDbPath); } catch (e) {}
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=freezer_inventory_comprehensive_backup_${dateStr}.zip`);
    res.send(zipBuffer);
  } catch (err: any) {
    console.error('Failed to export ZIP backup:', err);
    res.status(500).json({ error: 'Failed to generate ZIP backup.' });
  }
});

app.post('/api/backups/import-zip', async (req: any, res) => {
  try {
    const { 
      base64, 
      restoreOnSite, 
      restoreOffSite, 
      restoreImages,
      restoreFreezers,
      restoreContainers,
      restoreProducts,
      restoreMeatCuts,
      restoreCustomLists,
      restoreTags,
      restoreHistory
    } = req.body;
    if (!base64) {
      return res.status(400).json({ error: 'No backup ZIP file provided.' });
    }

    // Decode zip
    let base64Data = base64;
    if (base64.startsWith('data:')) {
      const commaIdx = base64.indexOf(',');
      if (commaIdx !== -1) {
        base64Data = base64.substring(commaIdx + 1);
      }
    }
    const buffer = Buffer.from(base64Data, 'base64');

    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    let state = await loadState();
    let actionsDesc: string[] = [];

    const doFreezers = restoreFreezers !== undefined ? restoreFreezers : restoreOnSite;
    const doContainers = restoreContainers !== undefined ? restoreContainers : restoreOnSite;
    const doProducts = restoreProducts !== undefined ? restoreProducts : restoreOnSite;
    const doMeatCuts = restoreMeatCuts !== undefined ? restoreMeatCuts : restoreOnSite;
    const doCustomLists = restoreCustomLists !== undefined ? restoreCustomLists : restoreOnSite;
    const doTags = restoreTags !== undefined ? restoreTags : restoreOnSite;
    const doHistory = restoreHistory !== undefined ? restoreHistory : (restoreOnSite !== undefined ? restoreOnSite : true);

    // Parse database entries from ZIP
    const dbEntry = zipEntries.find(e => !e.isDirectory && (e.entryName === 'inventory.db' || e.entryName.toLowerCase().endsWith('/inventory.db') || e.entryName.toLowerCase().endsWith('.db')));
    const onSiteEntry = zipEntries.find(e => !e.isDirectory && (e.entryName === 'inventory-on-site.json' || e.entryName.toLowerCase().endsWith('/inventory-on-site.json') || e.entryName.toLowerCase().endsWith('.json')));
    const offSiteEntry = zipEntries.find(e => !e.isDirectory && (e.entryName === 'inventory-off-site.csv' || e.entryName.toLowerCase().endsWith('/inventory-off-site.csv') || e.entryName.toLowerCase().endsWith('.csv')));

    if (dbEntry) {
      const tempDbPath = path.join(BACKUPS_DIR, `temp_import_zip_${Date.now()}.db`);
      fs.writeFileSync(tempDbPath, dbEntry.getData());
      try {
        const targetSections: string[] = [];
        if (doFreezers) targetSections.push('freezers');
        if (doContainers) targetSections.push('containers');
        if (doProducts) targetSections.push('products');
        if (doMeatCuts) targetSections.push('meatCuts');
        if (restoreOffSite) targetSections.push('offSiteEntries');
        if (doCustomLists) targetSections.push('customLists');
        if (doTags) targetSections.push('tags');
        if (doHistory) targetSections.push('history');

        if (targetSections.length === 0 || targetSections.length >= 7) {
          db.close();
          const dbPath = getDatabasePath();
          const walPath = `${dbPath}-wal`;
          const shmPath = `${dbPath}-shm`;
          if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
          if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
          fs.copyFileSync(tempDbPath, dbPath);
          initDatabase();
          state = await loadState();
          actionsDesc.push('SQLite Database');
        } else {
          selectiveRestoreFromDb(tempDbPath, targetSections);
          state = await loadState();
          actionsDesc.push('Selective Database Tables');
        }
      } catch (err) {
        console.error('Failed to restore SQLite DB from ZIP in import-zip:', err);
      } finally {
        if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
      }
    } else if (onSiteEntry && (doFreezers || doContainers || doProducts || doMeatCuts || doCustomLists || doTags || doHistory)) {
      const text = onSiteEntry.getData().toString('utf8');
      const parsed = JSON.parse(text);
      if (parsed) {
        const zFreezers = parsed.freezers || parsed.locations || parsed.cabinets;
        const zContainers = parsed.containers || parsed.bins || parsed.boxes;
        const zProducts = parsed.products || parsed.catalog || parsed.items;
        const zCategories = parsed.categories;
        const zMeatCuts = parsed.meatCuts || parsed.meatcuts || parsed.inventory || parsed.stock || parsed.stockCounts || parsed.counts;
        const zCustomLists = parsed.customLists || parsed.customlists || parsed.lists;
        const zTags = parsed.tags;
        const zHistory = parsed.history || parsed.logs;

        if (doFreezers && zFreezers) {
          state.freezers = zFreezers;
          if (parsed.locations) state.locations = parsed.locations;
          if (parsed.pallets) state.pallets = parsed.pallets;
          if (parsed.boxes) state.boxes = parsed.boxes;
          actionsDesc.push('Cabinet Structures & Locations');
        }
        if (doContainers && zContainers) {
          state.containers = zContainers;
          if (parsed.containerTemplates) state.containerTemplates = parsed.containerTemplates;
          actionsDesc.push('Containers & Templates');
        }
        if (doProducts && zProducts) {
          state.products = zProducts;
          if (zCategories) state.categories = zCategories;
          actionsDesc.push('Products Catalog');
        }
        if (doMeatCuts && zMeatCuts) {
          state.meatCuts = zMeatCuts;
          actionsDesc.push('Stock Counts');
        }
        if (doCustomLists && zCustomLists) {
          state.customLists = zCustomLists;
          if (parsed.movementOrders) state.movementOrders = parsed.movementOrders;
          if (parsed.notificationSettings) state.notificationSettings = parsed.notificationSettings;
          if (parsed.notificationLogs) state.notificationLogs = parsed.notificationLogs;
          actionsDesc.push('Custom Lists, Movement Orders & Notification Settings');
        }
        if (doTags && zTags) {
          state.tags = zTags;
          actionsDesc.push('Tags');
        }
        if (doHistory && zHistory) {
          state.history = zHistory;
          actionsDesc.push('Activity History');
        }
      }
    }

    // Parse Off-site inventory
    if (offSiteEntry && restoreOffSite) {
      const csvText = offSiteEntry.getData().toString('utf8');
      const lines = csvText.split(/\r?\n/).filter(line => line.trim());
      if (lines.length > 0) {
        const newEntries = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          // Handle simple CSV parse with potential quotes around columns
          let cols: string[] = [];
          let currentField = '';
          let inQuotes = false;
          for (let charIndex = 0; charIndex < line.length; charIndex++) {
            const char = line[charIndex];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              cols.push(currentField);
              currentField = '';
            } else {
              currentField += char;
            }
          }
          cols.push(currentField);

          if (cols.length >= 2) {
            const isNewLayout = cols.length >= 12 || (lines[0] && lines[0].toLowerCase().includes('location') && lines[0].toLowerCase().includes('pallet'));
            
            const serial = cols[0] || '0';
            const cuts = cols[1] || '';
            const packDate = cols[2] || '';
            const lot = cols[3] || '';
            const pieces = parseInt(cols[4]) || 0;
            const netWeight = parseFloat(cols[5]) || 0;
            const mwOrderNumber = cols[6] || '';
            const box = cols[7] || '';
            
            let notes = '';
            let colors = '';
            let currentLocation = '';
            let locationName = '';
            
            if (isNewLayout) {
              locationName = cols[8] || '';
              currentLocation = cols[9] || '';
              notes = cols[10] || '';
              colors = cols[11] || '';
            } else {
              // Old layout: Serial,cuts,Pack Date,Lot,# Pieces,Net... move to,Current,Notes
              currentLocation = cols[9] || '';
              notes = cols[10] || '';
            }
            
            // Map locationName to a storageLocationId if matching catalog locations
            let storageLocationId = undefined;
            if (locationName) {
              const matchedLocName = locationName.trim().toLowerCase();
              const foundLoc = (state.locations || []).find(l => l.name.trim().toLowerCase() === matchedLocName);
              if (foundLoc) {
                storageLocationId = foundLoc.id;
              }
            }

            newEntries.push({
              id: crypto.randomUUID(),
              serial,
              cuts,
              packDate,
              lot,
              pieces,
              netWeight,
              mwOrderNumber,
              box,
              moveTo: '',
              location: locationName,
              pallet: currentLocation,
              currentLocation: currentLocation,
              notes,
              storageLocationId
            });
          }
        }
        state.offSiteEntries = newEntries;
        actionsDesc.push('Off-Site Storage (CSV)');
      }
    }

    // Unzip images folder
    if (restoreImages) {
      let imageCount = 0;
      if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      const validImgExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
      zipEntries.forEach(entry => {
        if (!entry.isDirectory) {
          const entryLower = entry.entryName.toLowerCase().replace(/\\/g, '/');
          const fname = path.basename(entry.entryName.replace(/\\/g, '/'));
          const ext = path.extname(fname).toLowerCase();
          if (fname && (validImgExts.includes(ext) || entryLower.includes('images/') || entryLower.includes('photos/') || entryLower.includes('uploads/'))) {
            if (validImgExts.includes(ext)) {
              const destPath = path.join(UPLOADS_DIR, fname);
              fs.writeFileSync(destPath, entry.getData());
              imageCount++;
            }
          }
        }
      });
      if (imageCount > 0) {
        actionsDesc.push(`${imageCount} Photos`);
      }
    }

    // Add back to history log
    state.history = [
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        description: `Imported comprehensive database ZIP with categories: ${actionsDesc.join(', ') || 'None'}`,
        targetId: 'system-restore'
      },
      ...(state.history || [])
    ].slice(0, 100);

    await saveState(state);
    notifyInventoryUpdate();

    res.json({ success: true, message: `Successfully restored: ${actionsDesc.join(', ') || 'no segments'}` });
  } catch (err: any) {
    console.error('Import ZIP backup error:', err);
    res.status(500).json({ error: `Failed to restore ZIP: ${err.message}` });
  }
});

app.post('/api/backups/upload-image', async (req: any, res) => {
  try {
    const { filename, base64 } = req.body;
    if (!filename || !base64) {
      return res.status(400).json({ error: 'Missing filename or base64 data.' });
    }

    // Safety check for filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    // Ensure it has an image extension
    const ext = path.extname(safeFilename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) {
      return res.status(400).json({ error: 'Only image files are allowed.' });
    }

    let base64Data = base64;
    if (base64.startsWith('data:')) {
      const commaIdx = base64.indexOf(',');
      if (commaIdx !== -1) {
        base64Data = base64.substring(commaIdx + 1);
      }
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const destPath = path.join(UPLOADS_DIR, safeFilename);
    fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));

    res.json({ success: true, message: `Uploaded ${safeFilename}` });
  } catch (err: any) {
    console.error('Failed to upload image during ZIP restore:', err);
    res.status(500).json({ error: `Image restoration failed: ${err.message}` });
  }
});

app.post('/api/backups/upload-images-batch', async (req: any, res) => {
  try {
    const { images } = req.body;
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Missing images array.' });
    }

    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    let savedCount = 0;

    for (const item of images) {
      const { filename, base64 } = item;
      if (!filename || !base64) continue;
      const safeFilename = path.basename(filename);
      if (!safeFilename || safeFilename === '.' || safeFilename === '..') continue;
      const ext = path.extname(safeFilename).toLowerCase();
      if (!validExts.includes(ext)) continue;

      let base64Data = base64;
      if (base64.startsWith('data:')) {
        const commaIdx = base64.indexOf(',');
        if (commaIdx !== -1) {
          base64Data = base64.substring(commaIdx + 1);
        }
      }

      const destPath = path.join(UPLOADS_DIR, safeFilename);
      fs.writeFileSync(destPath, Buffer.from(base64Data, 'base64'));
      savedCount++;
    }

    res.json({ success: true, count: savedCount });
  } catch (err: any) {
    console.error('Failed to upload image batch during restore:', err);
    res.status(500).json({ error: `Image batch upload failed: ${err.message}` });
  }
});

const activeChunkUploads: { [uploadId: string]: { filename: string; tempPath: string; receivedChunks: Set<number>; totalChunks: number; lastActive: number } } = {};

// Auto-cleanup stale chunk uploads after 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const uploadId of Object.keys(activeChunkUploads)) {
    const entry = activeChunkUploads[uploadId];
    if (now - entry.lastActive > 10 * 60 * 1000) {
      if (fs.existsSync(entry.tempPath)) {
        try { fs.unlinkSync(entry.tempPath); } catch (e) {}
      }
      delete activeChunkUploads[uploadId];
    }
  }
}, 60 * 1000);

app.post('/api/backups/upload-chunk', async (req: any, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, filename, base64 } = req.body;
    if (!uploadId || chunkIndex === undefined || !totalChunks || !filename || !base64) {
      return res.status(400).json({ error: 'Missing chunk upload parameters.' });
    }

    const safeFilename = path.basename(filename);
    if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
      return res.status(400).json({ error: 'Invalid filename.' });
    }

    const ext = path.extname(safeFilename).toLowerCase();
    if (!['.db', '.json', '.csv', '.zip'].includes(ext)) {
      return res.status(400).json({ error: 'Only .db, .json, .csv, and .zip files are allowed.' });
    }

    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    let uploadEntry = activeChunkUploads[uploadId];
    if (!uploadEntry) {
      const tempPath = path.join(BACKUPS_DIR, `temp_chunk_${uploadId}_${Date.now()}.tmp`);
      uploadEntry = {
        filename: safeFilename,
        tempPath,
        receivedChunks: new Set<number>(),
        totalChunks,
        lastActive: Date.now()
      };
      activeChunkUploads[uploadId] = uploadEntry;
    }

    let base64Data = base64;
    if (base64.startsWith('data:')) {
      const commaIdx = base64.indexOf(',');
      if (commaIdx !== -1) base64Data = base64.substring(commaIdx + 1);
    }

    const buffer = Buffer.from(base64Data, 'base64');
    fs.appendFileSync(uploadEntry.tempPath, buffer);
    uploadEntry.receivedChunks.add(chunkIndex);
    uploadEntry.lastActive = Date.now();

    if (uploadEntry.receivedChunks.size >= totalChunks || chunkIndex === totalChunks - 1) {
      let targetFilename = uploadEntry.filename;
      let filepath = path.join(BACKUPS_DIR, targetFilename);
      if (fs.existsSync(filepath)) {
        const baseName = path.basename(uploadEntry.filename, ext);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        targetFilename = `${baseName}_${timestamp}${ext}`;
        filepath = path.join(BACKUPS_DIR, targetFilename);
      }

      fs.renameSync(uploadEntry.tempPath, filepath);
      delete activeChunkUploads[uploadId];

      return res.json({ success: true, completed: true, filename: targetFilename });
    }

    res.json({ success: true, completed: false, chunkIndex });
  } catch (err: any) {
    console.error('Chunk upload error:', err);
    res.status(500).json({ error: `Failed to process chunk: ${err.message}` });
  }
});

// ---------------- SERVER-SENT EVENTS REAL-TIME SYNC ----------------

let sseClients: any[] = [];
let currentVersion = 1;

function notifyInventoryUpdate() {
  currentVersion++;
  const message = JSON.stringify({
    type: 'update',
    version: currentVersion
  });
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${message}\n\n`);
      if (typeof client.res.flush === 'function') {
        client.res.flush();
      }
    } catch (err) {
      console.error('Failed to notify client update:', err);
    }
  });
}

function notifyInventoryEditing(excludeClientId?: string) {
  const message = JSON.stringify({ type: 'editing' });
  sseClients.forEach(client => {
    if (client.id !== excludeClientId) {
      try {
        client.res.write(`data: ${message}\n\n`);
        if (typeof client.res.flush === 'function') {
          client.res.flush();
        }
      } catch (err) {
        console.error('Failed to notify client editing:', err);
      }
    }
  });
}

interface SingleUserLock {
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

let singleUserLock: SingleUserLock | null = null;

function broadcastSSE(data: any, excludeClientId?: string) {
  const message = JSON.stringify(data);
  sseClients.forEach(client => {
    if (!excludeClientId || client.id !== excludeClientId) {
      try {
        client.res.write(`data: ${message}\n\n`);
        if (typeof client.res.flush === 'function') {
          client.res.flush();
        }
      } catch (err) {
        // Suppress stream write errors for disconnected clients
      }
    }
  });
}

function isClientConnected(clientId: string): boolean {
  return sseClients.some(client => client.id === clientId);
}

function checkSingleUserLockStaleness() {
  if (singleUserLock) {
    const inactiveDuration = Date.now() - singleUserLock.lastActiveAt;
    // Auto-expire lock if holder has been inactive for over 5 minutes (300,000 ms)
    if (inactiveDuration > 5 * 60 * 1000) {
      console.log(`Single-User lock for "${singleUserLock.holderName}" auto-expired due to inactivity.`);
      singleUserLock = null;
      broadcastSSE({ type: 'single_user_lock_changed', lock: null });
    }
  }
}

app.get('/api/single-user/status', (req, res) => {
  checkSingleUserLockStaleness();
  res.json({ lock: singleUserLock });
});

app.post('/api/single-user/claim', (req, res) => {
  checkSingleUserLockStaleness();
  const clientId = (req.headers['x-client-id'] as string) || req.body.clientId;
  const userName = (req.headers['x-user-name'] as string) || req.body.userName || 'User';

  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required.' });
  }

  // Automatically release lock if the lock holder is no longer connected to SSE
  if (singleUserLock && !isClientConnected(singleUserLock.clientId)) {
    console.log(`Releasing lock held by disconnected client "${singleUserLock.holderName}" for new claim.`);
    singleUserLock = null;
  }

  if (singleUserLock && singleUserLock.clientId !== clientId) {
    return res.status(409).json({
      success: false,
      lock: singleUserLock,
      message: `Single-User Mode is currently locked by ${singleUserLock.holderName}.`
    });
  }

  singleUserLock = {
    clientId,
    holderName: userName,
    acquiredAt: Date.now(),
    lastActiveAt: Date.now(),
    breakInRequest: null
  };

  broadcastSSE({ type: 'single_user_lock_changed', lock: singleUserLock });
  res.json({ success: true, lock: singleUserLock });
});

app.post('/api/single-user/heartbeat', (req, res) => {
  checkSingleUserLockStaleness();
  const clientId = (req.headers['x-client-id'] as string) || req.body.clientId;

  if (singleUserLock && singleUserLock.clientId === clientId) {
    singleUserLock.lastActiveAt = Date.now();
  }

  res.json({ success: true, lock: singleUserLock });
});

app.post('/api/single-user/release', (req, res) => {
  const clientId = (req.headers['x-client-id'] as string) || req.body.clientId;

  if (singleUserLock && singleUserLock.clientId === clientId) {
    singleUserLock = null;
    broadcastSSE({ type: 'single_user_lock_changed', lock: null });
  }

  res.json({ success: true });
});

app.post('/api/single-user/request-break-in', (req, res) => {
  checkSingleUserLockStaleness();
  const clientId = (req.headers['x-client-id'] as string) || req.body.clientId;
  const userName = (req.headers['x-user-name'] as string) || req.body.userName || 'Another User';

  if (!singleUserLock) {
    return res.json({ success: true, lock: null, message: 'No active Single-User lock.' });
  }

  if (singleUserLock.clientId === clientId) {
    return res.json({ success: true, lock: singleUserLock });
  }

  // If current lock holder is no longer connected to SSE, break in and claim immediately
  if (!isClientConnected(singleUserLock.clientId)) {
    console.log(`Lock holder "${singleUserLock.holderName}" is disconnected. Automatically breaking in and assigning lock to "${userName}".`);
    singleUserLock = {
      clientId,
      holderName: userName,
      acquiredAt: Date.now(),
      lastActiveAt: Date.now(),
      breakInRequest: null
    };
    broadcastSSE({ type: 'single_user_lock_changed', lock: singleUserLock });
    return res.json({ success: true, lock: singleUserLock });
  }

  singleUserLock.breakInRequest = {
    requestedByClientId: clientId,
    requestedByName: userName,
    requestedAt: Date.now()
  };

  broadcastSSE({
    type: 'break_in_requested',
    lock: singleUserLock,
    breakIn: singleUserLock.breakInRequest
  });

  res.json({ success: true, lock: singleUserLock });
});

app.post('/api/single-user/cancel-break-in', (req, res) => {
  const clientId = (req.headers['x-client-id'] as string) || req.body.clientId;

  if (singleUserLock && singleUserLock.clientId === clientId) {
    singleUserLock.breakInRequest = null;
    broadcastSSE({
      type: 'break_in_cancelled',
      lock: singleUserLock
    });
  }

  res.json({ success: true, lock: singleUserLock });
});

app.post('/api/single-user/sync-and-release', async (req, res) => {
  const clientId = (req.headers['x-client-id'] as string) || req.body.clientId;
  const { fullState } = req.body || {};

  if (fullState) {
    try {
      await saveState(fullState);
    } catch (err: any) {
      console.error('Failed to save full state in sync-and-release:', err);
    }
  }

  if (singleUserLock && singleUserLock.clientId === clientId) {
    singleUserLock = null;
  }

  const finalState = await loadState();
  broadcastSSE({ type: 'update' });
  broadcastSSE({ type: 'single_user_lock_changed', lock: null });

  res.json({ success: true, state: finalState });
});

app.post('/api/inventory/editing', (req, res) => {
  const clientId = req.headers['x-client-id'] as string;
  notifyInventoryEditing(clientId);
  res.json({ success: true });
});

app.get('/api/inventory/stream', (req: any, res: any) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const clientId = req.query.clientId || String(Date.now() + Math.random());
  const newClient = {
    id: clientId,
    res
  };
  sseClients.push(newClient);

  // Send initial load details including current single user lock status
  res.write(`data: ${JSON.stringify({ type: 'init', version: currentVersion, lock: singleUserLock })}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }
  
  // Keep connection alive with 15-second pings
  const keepAliveInterval = setInterval(() => {
    try {
      res.write(': ping\n\n');
      if (typeof res.flush === 'function') {
        res.flush();
      }
    } catch (err) {
      clearInterval(keepAliveInterval);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Fetch entire visual freezer states
app.get('/api/inventory', async (req, res) => {
  try {
    const state = await loadState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve inventory.' });
  }
});

// Notification endpoints
app.get('/api/notifications/settings', async (req, res) => {
  try {
    const state = await loadState();
    const settings = state.notificationSettings?.[0] || {};
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/notifications/test-settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Settings object is required.' });
    }
    const title = `Freezer Tracker: Test Notification (${new Date().toLocaleDateString()})`;
    const message = `This is a test notification confirming your settings are configured correctly!`;
    const result = await sendNotificationPayload(title, message, settings);
    if (result.success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/notifications/save-settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'Settings are required.' });
    }
    const state = await loadState();
    state.notificationSettings = [settings];
    saveStateSync(state);
    notifyInventoryUpdate();
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/notifications/trigger-now', async (req, res) => {
  try {
    const { listIds } = req.body;
    const result = await triggerNotification(listIds, true);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

app.post('/api/notifications/clear-logs', async (req, res) => {
  try {
    const state = await loadState();
    state.notificationLogs = [];
    saveStateSync(state);
    notifyInventoryUpdate();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

function extractUserFromReq(req: any): string {
  const possibleUser = 
    req.body?.action?.user ||
    req.body?.user ||
    req.headers['x-user-name'] ||
    req.headers['x-app-user'] ||
    req.headers['x-remote-user-name'] ||
    req.headers['x-hass-user-name'] ||
    req.headers['x-ingress-user-name'] ||
    req.headers['x-remote-user'] ||
    req.headers['x-ingress-user'] ||
    req.headers['x-hass-user'] ||
    req.headers['x-forwarded-user'] ||
    req.headers['x-authentik-username'] ||
    'Home Assistant';

  let userStr = String(possibleUser || '').trim();
  if (userStr.startsWith('@')) {
    userStr = userStr.substring(1).trim();
  }
  return userStr || 'Home Assistant';
}

// Process a single action on the backend and return the new unified database state safely
app.post('/api/inventory/action', async (req: any, res) => {
  const { action } = req.body;
  if (!action || !action.type) {
    return res.status(400).json({ error: 'Action type is required.' });
  }

  checkSingleUserLockStaleness();
  const clientId = (req.headers['x-client-id'] as string) || req.body.clientId;
  if (singleUserLock && !isClientConnected(singleUserLock.clientId)) {
    console.log(`Lock holder "${singleUserLock.holderName}" is disconnected. Automatically releasing lock in action endpoint.`);
    singleUserLock = null;
    broadcastSSE({ type: 'single_user_lock_changed', lock: null });
  }

  if (singleUserLock && singleUserLock.clientId !== clientId && action.type !== 'REPLACE_STATE') {
    return res.status(409).json({
      error: 'SINGLE_USER_LOCKED',
      holderName: singleUserLock.holderName,
      message: `Application is locked in Single-User Mode by ${singleUserLock.holderName}.`
    });
  }
  if (singleUserLock && singleUserLock.clientId === clientId) {
    singleUserLock.lastActiveAt = Date.now();
  }

  try {
    const state = await loadState();

    const ingressUser = extractUserFromReq(req);

    // Replay reducer logic locally with active backend user info
    const MAX_HISTORY_PER_ITEM = 10;
    
    const newHistoryEntry = (description: string, targetId: string) => ({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      description,
      targetId,
      user: String(ingressUser)
    });

    const getLocationPhrase = (containerId: string | undefined, currentState: any) => {
      if (!containerId || containerId === 'staging_loose' || containerId === 'unassigned') {
        return 'in Staging Area';
      }
      const container = (currentState.containers || []).find((c: any) => c.id === containerId);
      if (!container) return 'in Unknown Container';
      const freezer = (currentState.freezers || []).find((f: any) => f.id === container.freezerId);
      if (freezer) {
        return `in "${container.name}" in "${freezer.name}"`;
      }
      return `in "${container.name}" (Unassigned Staging)`;
    };
    
    const addHistory = (currentState: any, entry: any) => {
        const relatedHistory = currentState.history.filter((h: any) => h.targetId === entry.targetId);
        const updatedHistory = [entry, ...relatedHistory].slice(0, MAX_HISTORY_PER_ITEM);
        const otherHistory = currentState.history.filter((h: any) => h.targetId !== entry.targetId);
        return [...otherHistory, ...updatedHistory];
    };

    const handleEmptyContainer = (containerId: string, currentState: any) => {
        const isContainerEmpty = !currentState.meatCuts.some((mc: any) => mc.containerId === containerId);
        if (!isContainerEmpty) {
            return currentState;
        }
        
        const container = currentState.containers.find((c: any) => c.id === containerId);
        if (!container) return currentState;

        const isBuiltIn = container.id === 'staging_loose' || container.id.endsWith('_loose') ||
                          container.name.toLowerCase().includes('shelf') || 
                          container.name.toLowerCase().includes('bin1') || 
                          container.name.toLowerCase().includes('bin2') || 
                          container.name.toLowerCase().includes('bin3') ||
                          container.name.toLowerCase().includes('bin 1') || 
                          container.name.toLowerCase().includes('bin 2') || 
                          container.name.toLowerCase().includes('bin 3');

        if (isBuiltIn) {
            const history = newHistoryEntry(`Container "${container.name}" is now empty.`, containerId);
            return {
                ...currentState,
                history: addHistory(currentState, history)
            };
        } else {
            // Archive active container when emptied so history/rollback capability is preserved
            const history = newHistoryEntry(`Container "${container.name}" was emptied and archived.`, containerId);
            return {
                ...currentState,
                containers: currentState.containers.map((c: any) => 
                    c.id === containerId ? { ...c, freezerId: undefined, isArchived: true } : c
                ),
                history: addHistory(currentState, history)
            };
        }
    };

    const isSameVariant = (
        cut: { productId: string; notes?: string; tagIds?: string[]; originalCutName?: string; wrongLabel?: string },
        productId: string,
        notes?: string,
        tagIds?: string[],
        originalCutName?: string,
        wrongLabel?: string
    ): boolean => {
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
    };

    const consolidateMeatCutsInContainer = (containerId: string, currentState: any) => {
        if (!containerId || !currentState || !currentState.meatCuts) return currentState;
        const cutsInContainer = (currentState.meatCuts || []).filter((mc: any) => mc.containerId === containerId && mc.quantity > 0);
        if (cutsInContainer.length <= 1) return currentState;

        const groupMap = new Map<string, any[]>();

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
        const otherCuts = (currentState.meatCuts || []).filter((mc: any) => mc.containerId !== containerId);
        const consolidatedContainerCuts: any[] = [];

        for (const [, group] of groupMap.entries()) {
            if (group.length === 1) {
                consolidatedContainerCuts.push(group[0]);
            } else {
                hasDuplicates = true;
                const primaryCut = group[0];
                const totalQuantity = group.reduce((sum: number, item: any) => sum + item.quantity, 0);
                consolidatedContainerCuts.push({
                    ...primaryCut,
                    quantity: totalQuantity
                });
            }
        }

        if (hasDuplicates) {
            return {
                ...currentState,
                meatCuts: [...otherCuts, ...consolidatedContainerCuts]
            };
        }
        return currentState;
    };

    let nextState = { ...state };

    switch (action.type) {
      case 'ADD_FREEZER': {
        const id = crypto.randomUUID();
        const newFreezer = { 
          id, 
          name: action.payload.name, 
          isSpecial: !!action.payload.isSpecial,
          isLooseOnly: !!action.payload.isLooseOnly,
          isPallet: !!action.payload.isPallet
        };
        nextState.freezers = [...nextState.freezers, newFreezer];
        const looseContainer = { id: id + "_loose", name: "Loose", typeId: "ct4", freezerId: id };
        nextState.containers = [...nextState.containers, looseContainer];
        break;
      }
      case 'EDIT_FREEZER': {
        nextState.freezers = nextState.freezers.map(f => {
          if (f.id === action.payload.id) {
            const isNowSpecial = action.payload.isSpecial !== undefined ? !!action.payload.isSpecial : !!f.isSpecial;
            const isNowLooseOnly = action.payload.isLooseOnly !== undefined ? !!action.payload.isLooseOnly : !!f.isLooseOnly;
            const isNowPallet = action.payload.isPallet !== undefined ? !!action.payload.isPallet : !!f.isPallet;
            
            const existingLoose = nextState.containers.find(c => c.id === f.id + "_loose");
            if (!existingLoose) {
              const looseContainer = { id: f.id + "_loose", name: "Loose", typeId: "ct4", freezerId: f.id };
              nextState.containers = [...nextState.containers, looseContainer];
            } else {
              nextState.containers = nextState.containers.map(c => c.id === f.id + "_loose" ? { ...c, freezerId: f.id } : c);
            }
            return { ...f, name: action.payload.name, isSpecial: isNowSpecial, isLooseOnly: isNowLooseOnly, isPallet: isNowPallet };
          }
          return f;
        });
        break;
      }
      case 'DELETE_FREEZER': {
        const freezerId = action.payload.id;
        const freezer = nextState.freezers.find(f => f.id === freezerId);
        const freezerName = freezer ? freezer.name : 'Unknown Freezer';
        // Unassign containers from this freezer
        nextState.containers = nextState.containers.map(c => c.freezerId === freezerId ? { ...c, freezerId: undefined } : c);
        nextState.freezers = nextState.freezers.filter(f => f.id !== freezerId);
        const history = newHistoryEntry(`Freezer "${freezerName}" was permanently deleted. All containers inside were category-retired as unassigned.`, freezerId);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'ADD_CONTAINER': {
        const { id = crypto.randomUUID(), name, freezerId, templateId, imageUrl, icon = 'Folder', deleteOnEmpty = false } = action.payload;
        const trimmedName = name.trim();

        const newContainer = {
          id,
          name: trimmedName,
          freezerId: freezerId || undefined,
          templateId: templateId || undefined,
          imageUrl: imageUrl || undefined,
          icon,
          deleteOnEmpty: !!deleteOnEmpty,
          isArchived: false
        };

        const freezerName = freezerId ? nextState.freezers.find(f => f.id === freezerId)?.name || 'Freezer' : 'Unassigned';
        const description = freezerId 
          ? `Container "${trimmedName}" created and placed in "${freezerName}".` 
          : `Container "${trimmedName}" created as unassigned active container.`;
        const history = newHistoryEntry(description, id);

        nextState.containers = [...nextState.containers, newContainer];
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'ADD_CONTAINER_TEMPLATE': {
        const { id = crypto.randomUUID(), name, icon = 'Folder', imageUrl } = action.payload;
        const trimmedName = name.trim();
        const templates = nextState.containerTemplates || [];
        const existing = templates.find((t: any) => t.name.toLowerCase().trim() === trimmedName.toLowerCase());
        if (existing) {
          return res.status(400).json({ error: `A container template named "${trimmedName}" already exists.` });
        }
        const newTemplate = {
          id,
          name: trimmedName,
          icon,
          imageUrl: imageUrl || undefined,
          createdAt: new Date().toISOString()
        };
        nextState.containerTemplates = [...templates, newTemplate];
        const history = newHistoryEntry(`Container Template "${trimmedName}" added to catalog.`, id);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'EDIT_CONTAINER_TEMPLATE': {
        const { id, updates } = action.payload;
        let updatedName = '';
        nextState.containerTemplates = (nextState.containerTemplates || []).map((t: any) => {
          if (t.id === id) {
            const merged = { ...t, ...updates };
            updatedName = merged.name;
            return merged;
          }
          return t;
        });

        if (updates) {
          nextState.containers = nextState.containers.map((c: any) => {
            if (c.templateId === id) {
              return {
                ...c,
                name: updates.name !== undefined ? updates.name : c.name,
                icon: updates.icon !== undefined ? updates.icon : c.icon,
                imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : c.imageUrl
              };
            }
            return c;
          });
        }

        const history = newHistoryEntry(`Container Template "${updatedName || id}" updated in catalog.`, id);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'DELETE_CONTAINER_TEMPLATE': {
        const { id } = action.payload;
        const template = (nextState.containerTemplates || []).find((t: any) => t.id === id);
        const tplName = template ? template.name : id;
        const tplNameLower = template ? template.name.trim().toLowerCase() : '';
        nextState.containerTemplates = (nextState.containerTemplates || []).filter((t: any) => t.id !== id);

        nextState.containers = nextState.containers.map((c: any) => {
          const matchesId = c.templateId === id;
          const matchesName = tplNameLower && c.name.trim().toLowerCase() === tplNameLower;
          if (matchesId || matchesName) {
            return { ...c, templateId: undefined, deleteOnEmpty: true };
          }
          return c;
        });

        const history = newHistoryEntry(`Container Template "${tplName}" deleted from catalog. Active containers converted to retire on empty.`, id);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'TOGGLE_CONTAINER_ARCHIVED': {
        const { containerId, isArchived } = action.payload;
        const container = nextState.containers.find(c => c.id === containerId);
        if (!container) break;

        nextState.containers = nextState.containers.map(c => 
          c.id === containerId ? { ...c, isArchived: !!isArchived } : c
        );

        const statusText = isArchived ? 'archived' : 'restored/unarchived';
        const history = newHistoryEntry(`Container "${container.name}" was ${statusText}.`, containerId);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'DELETE_CONTAINER': {
        const { containerId } = action.payload;
        if (containerId === 'staging_loose' || containerId.endsWith('_loose')) {
          break;
        }
        const container = nextState.containers.find(c => c.id === containerId);
        if (!container) break;

        const containerName = container.name || 'Unknown Container';
        // Archive active container instead of hard deleting to preserve historical records and rollback support
        nextState.containers = nextState.containers.map(c => 
          c.id === containerId ? { ...c, freezerId: undefined, isArchived: true } : c
        );

        const history = newHistoryEntry(`Container "${containerName}" was archived.`, containerId);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'ADD_PRODUCT': {
        const product = { ...action.payload.product };
        if (!product.barcode && product.productNumbers && product.productNumbers.length > 0 && product.productNumbers[0]) {
          product.barcode = generateDefaultUpcABarcode(product.productNumbers[0]);
        }
        nextState.products = [...nextState.products, product];
        
        // Sync to customLists
        nextState.customLists = (nextState.customLists || []).map(cl => {
          let nextItems = [...(cl.items || [])];
          const hasItem = nextItems.some(item => item.productId === product.id);
          const shouldHave = product.listActive?.[cl.id] === true;

          if (shouldHave) {
            if (!hasItem) {
              const t = product.listThresholds?.[cl.id];
              const cs = product.listControlSources?.[cl.id];
              nextItems.push({
                productId: product.id,
                notes: product.listNotes?.[cl.id] || '',
                addedAt: new Date().toISOString(),
                controlSource: cs || 'onsite_count',
                threshold: t !== undefined && t !== null ? t : undefined
              });
            } else {
              nextItems = nextItems.map(item => {
                if (item.productId !== product.id) return item;
                const nextItem = { ...item };
                if (product.listThresholds) {
                  const t = product.listThresholds[cl.id];
                  nextItem.threshold = t !== undefined && t !== null ? t : undefined;
                }
                if (product.listControlSources) {
                  const cs = product.listControlSources[cl.id];
                  nextItem.controlSource = cs || 'onsite_count';
                }
                if (product.listNotes) {
                  nextItem.notes = product.listNotes[cl.id] || '';
                }
                return nextItem;
              });
            }
          } else {
            if (product.listActive?.[cl.id] === false) {
              nextItems = nextItems.filter(item => item.productId !== product.id);
            } else {
              nextItems = nextItems.map(item => {
                if (item.productId !== product.id) return item;
                const nextItem = { ...item };
                if (product.listThresholds) {
                  const t = product.listThresholds[cl.id];
                  nextItem.threshold = t !== undefined && t !== null ? t : undefined;
                }
                if (product.listControlSources) {
                  const cs = product.listControlSources[cl.id];
                  nextItem.controlSource = cs || 'onsite_count';
                }
                if (product.listNotes) {
                  nextItem.notes = product.listNotes[cl.id] || '';
                }
                return nextItem;
              });
            }
          }
          return { ...cl, items: nextItems };
        });
        break;
      }
      case 'EDIT_PRODUCT': {
        const { productId, updates } = action.payload;
        nextState.products = nextState.products.map(p => {
          if (p.id === productId) {
            const updated = { ...p, ...updates };
            if (!updated.barcode && updated.productNumbers && updated.productNumbers.length > 0 && updated.productNumbers[0]) {
              updated.barcode = generateDefaultUpcABarcode(updated.productNumbers[0]);
            }
            return updated;
          }
          return p;
        });

        // Sync to customLists items
        nextState.customLists = (nextState.customLists || []).map(cl => {
          let nextItems = [...(cl.items || [])];
          const hasItem = nextItems.some(item => item.productId === productId);
          
          const shouldHave = updates.listActive?.[cl.id] === true;
          const isExplicitActiveSet = updates.listActive !== undefined && updates.listActive[cl.id] !== undefined;

          if (isExplicitActiveSet) {
            if (shouldHave) {
              if (!hasItem) {
                const t = updates.listThresholds?.[cl.id];
                const cs = updates.listControlSources?.[cl.id];
                nextItems.push({
                  productId: productId,
                  notes: updates.listNotes?.[cl.id] || '',
                  addedAt: new Date().toISOString(),
                  controlSource: cs || 'onsite_count',
                  threshold: t !== undefined && t !== null ? t : undefined
                });
              } else {
                nextItems = nextItems.map(item => {
                  if (item.productId !== productId) return item;
                  const nextItem = { ...item };
                  if (updates.listThresholds !== undefined) {
                    const t = updates.listThresholds[cl.id];
                    nextItem.threshold = t !== undefined && t !== null ? t : undefined;
                  }
                  if (updates.listControlSources !== undefined) {
                    const cs = updates.listControlSources[cl.id];
                    nextItem.controlSource = cs || 'onsite_count';
                  }
                  if (updates.listNotes !== undefined) {
                    nextItem.notes = updates.listNotes[cl.id] || '';
                  }
                  return nextItem;
                });
              }
            } else {
              nextItems = nextItems.filter(item => item.productId !== productId);
            }
          } else {
            nextItems = nextItems.map(item => {
              if (item.productId !== productId) return item;
              const nextItem = { ...item };
              if (updates.listThresholds !== undefined) {
                const t = updates.listThresholds[cl.id];
                nextItem.threshold = t !== undefined && t !== null ? t : undefined;
              }
              if (updates.listControlSources !== undefined) {
                const cs = updates.listControlSources[cl.id];
                nextItem.controlSource = cs || 'onsite_count';
              }
              if (updates.listNotes !== undefined) {
                nextItem.notes = updates.listNotes[cl.id] || '';
              }
              return nextItem;
            });
          }
          return { ...cl, items: nextItems };
        });
        break;
      }
      case 'DELETE_PRODUCT': {
        const { productId } = action.payload;
        const product = nextState.products.find(p => p.id === productId);
        const productName = product ? product.name : 'Unknown Product';
        const affectedContainers = Array.from(new Set(
          nextState.meatCuts
            .filter(mc => mc.productId === productId)
            .map(mc => mc.containerId)
        ));
        nextState.products = nextState.products.filter(p => p.id !== productId);
        nextState.meatCuts = nextState.meatCuts.filter(mc => mc.productId !== productId);
        const history = newHistoryEntry(`Product "${productName}" was permanently deleted along with its inventory cuts.`, productId);
        nextState.history = addHistory(nextState, history);

        // Process empty checks
        for (const containerId of affectedContainers) {
          nextState = handleEmptyContainer(containerId, nextState);
        }
        break;
      }
      case 'BULK_DELETE_PRODUCTS': {
        const { productIds } = action.payload;
        if (!productIds || productIds.length === 0) break;
        
        const affectedContainers = new Set<string>();
        const deletedNames: string[] = [];
        
        for (const productId of productIds) {
          const product = nextState.products.find(p => p.id === productId);
          if (product) deletedNames.push(product.name);
          
          nextState.meatCuts
            .filter(mc => mc.productId === productId)
            .forEach(mc => affectedContainers.add(mc.containerId));
            
          nextState.products = nextState.products.filter(p => p.id !== productId);
          nextState.meatCuts = nextState.meatCuts.filter(mc => mc.productId !== productId);
        }
        
        const historyMessage = deletedNames.length > 2 
          ? `Bulk deleted ${deletedNames.length} products: ${deletedNames.slice(0, 2).join(', ')} and ${deletedNames.length - 2} other(s) along with their inventory cuts.`
          : `Bulk deleted products: ${deletedNames.join(', ')} along with their inventory cuts.`;
          
        const history = newHistoryEntry(historyMessage, 'bulk-product-delete');
        nextState.history = addHistory(nextState, history);
        
        for (const containerId of Array.from(affectedContainers)) {
          nextState = handleEmptyContainer(containerId, nextState);
        }
        break;
      }
      case 'BULK_EDIT_PRODUCTS': {
        const { productIds, updates } = action.payload;
        if (!productIds || productIds.length === 0) break;
        
        const editedNames: string[] = [];
        nextState.products = nextState.products.map(p => {
          if (productIds.includes(p.id)) {
            editedNames.push(p.name);
            let nextTags = p.defaultTagIds || [];
            if (updates.defaultTagIds !== undefined) {
              if (updates.defaultTagsMode === 'replace') {
                nextTags = updates.defaultTagIds;
              } else { // append
                nextTags = Array.from(new Set([...nextTags, ...updates.defaultTagIds]));
              }
            }
            return {
              ...p,
              ...(updates.primaryCategory !== undefined ? { primaryCategory: updates.primaryCategory } : {}),
              ...(updates.subCategory !== undefined ? { subCategory: updates.subCategory } : {}),
              ...(updates.defaultTagIds !== undefined ? { defaultTagIds: nextTags } : {}),
              ...(updates.isArchived !== undefined ? { isArchived: updates.isArchived } : {})
            };
          }
          return p;
        });
        
        const updateDescriptionDetails: string[] = [];
        if (updates.primaryCategory !== undefined) updateDescriptionDetails.push(`primary category to "${updates.primaryCategory}"`);
        if (updates.subCategory !== undefined) updateDescriptionDetails.push(`subcategory to "${updates.subCategory}"`);
        if (updates.defaultTagIds !== undefined) {
          const modeWord = updates.defaultTagsMode === 'append' ? 'appended' : 'replaced';
          const tagNames = updates.defaultTagIds.length > 0 ? updates.defaultTagIds.join(', ') : 'none';
          updateDescriptionDetails.push(`${modeWord} default tags (${tagNames})`);
        }
        
        const changeDesc = updateDescriptionDetails.join(' and ');
        const historyMessage = editedNames.length > 2
          ? `Bulk changed ${changeDesc} for ${editedNames.length} products: ${editedNames.slice(0, 2).join(', ')} and ${editedNames.length - 2} others.`
          : `Bulk changed ${changeDesc} for products: ${editedNames.join(', ')}.`;
          
        const history = newHistoryEntry(historyMessage, 'bulk-product-edit');
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'DELETE_CATEGORY': {
        const { name, type, parentPrimary } = action.payload;
        let productsToDelete: any[] = [];
        if (type === 'primary') {
          productsToDelete = nextState.products.filter(p => p.primaryCategory === name);
          nextState.products = nextState.products.filter(p => p.primaryCategory !== name);
          if (nextState.categories) {
            nextState.categories = nextState.categories.filter((c: any) => !(c.type === 'primary' && c.name === name) && !(c.type === 'sub' && c.parentPrimary === name));
          }
        } else {
          productsToDelete = nextState.products.filter(p => p.subCategory === name && (!parentPrimary || p.primaryCategory === parentPrimary));
          nextState.products = nextState.products.filter(p => !(p.subCategory === name && (!parentPrimary || p.primaryCategory === parentPrimary)));
          if (nextState.categories) {
            nextState.categories = nextState.categories.filter((c: any) => !(c.type === 'sub' && c.name === name && (!parentPrimary || c.parentPrimary === parentPrimary)));
          }
        }
        const deleteProductIds = productsToDelete.map(p => p.id);
        const affectedContainers = Array.from(new Set(
          nextState.meatCuts
            .filter(mc => deleteProductIds.includes(mc.productId))
            .map(mc => mc.containerId)
        ));
        nextState.meatCuts = nextState.meatCuts.filter(mc => !deleteProductIds.includes(mc.productId));
        const history = newHistoryEntry(`Category "${name}" (${type}) was permanently deleted along with its ${productsToDelete.length} products.`, 'category-delete');
        nextState.history = addHistory(nextState, history);

        // Process empty checks
        for (const containerId of affectedContainers) {
          nextState = handleEmptyContainer(containerId, nextState);
        }
        break;
      }
      case 'ADD_MEAT_CUT': {
        const { productId, quantity, containerId, notes, tagIds, originalCutName } = action.payload;
        const product = nextState.products.find(p => p.id === productId);
        if (!product) return res.status(400).json({ error: 'Product not found.' });

        const productDefaultTagIds = product.defaultTagIds || [];
        const finalTagIds = tagIds || productDefaultTagIds;

        const existingCut = nextState.meatCuts.find(mc => mc.containerId === containerId && isSameVariant(mc, productId, notes, finalTagIds, originalCutName));

        if (existingCut) {
          const newQuantity = existingCut.quantity + quantity;
          const combinedTagIds = Array.from(new Set([...(existingCut.tagIds || []), ...finalTagIds]));
          const existingNotes = (existingCut.notes || '').trim();
          const newNotes = (notes || '').trim();
          let combinedNotes = existingCut.notes;
          if (newNotes) {
            if (!existingNotes) combinedNotes = newNotes;
            else if (!existingNotes.includes(newNotes)) combinedNotes = `${existingNotes} | ${newNotes}`;
          }
          const existingOriginal = (existingCut.originalCutName || '').trim();
          const newOriginal = (originalCutName || '').trim();
          let combinedOriginal = existingCut.originalCutName;
          if (newOriginal) {
            if (!existingOriginal) combinedOriginal = newOriginal;
            else if (!existingOriginal.includes(newOriginal)) combinedOriginal = `${existingOriginal} | ${newOriginal}`;
          }
          const locPhrase = getLocationPhrase(containerId, nextState);
          
          nextState.meatCuts = nextState.meatCuts.map(mc => mc.id === existingCut.id ? { ...mc, quantity: newQuantity, tagIds: combinedTagIds, notes: combinedNotes, originalCutName: combinedOriginal } : mc);
          const history = newHistoryEntry(`Added ${quantity}x "${product.name}" ${locPhrase}, new total ${newQuantity}.`, existingCut.id);
          nextState.history = addHistory(nextState, history);
        } else {
          const combinedTagIds = [...finalTagIds];

          const newMeatCut = { 
            id: crypto.randomUUID(), 
            productId, 
            quantity, 
            containerId, 
            notes,
            tagIds: combinedTagIds,
            originalCutName: originalCutName || undefined
          };
          const locPhrase = getLocationPhrase(containerId, nextState);
          const history = newHistoryEntry(`${quantity}x "${product.name}" added ${locPhrase}.`, newMeatCut.id);
          nextState.meatCuts = [...nextState.meatCuts, newMeatCut];
          nextState.history = addHistory(nextState, history);
        }
        break;
      }
      case 'BATCH_UPDATE_MEAT_QUANTITY': {
        const { updates } = action.payload; // Record<meatCutId, newQuantity>
        
        let anyChanges = false;
        
        for (const [meatCutId, newQuantity] of Object.entries(updates)) {
            const meatCut = nextState.meatCuts.find(m => m.id === meatCutId);
            if (!meatCut) continue;
            
            const product = nextState.products.find(p => p.id === meatCut.productId);
            if (!product) continue;

            if (meatCut.quantity !== newQuantity) {
                const locPhrase = getLocationPhrase(meatCut.containerId, nextState);
                const history = newHistoryEntry(`Quantity of "${product.name}" ${locPhrase} changed from ${meatCut.quantity} to ${newQuantity} (batch).`, meatCutId);
                nextState.history = addHistory(nextState, history);
                meatCut.quantity = newQuantity;
                anyChanges = true;
            }
        }
        
        if (anyChanges) {
            // Remove zero-quantity items and cleanup containers
            const emptyContainerIds = new Set<string>();
            nextState.meatCuts = nextState.meatCuts.filter(m => {
                if (m.quantity <= 0) {
                    emptyContainerIds.add(m.containerId);
                    return false;
                }
                return true;
            });

            // Cleanup containers that became empty
            for (const containerId of emptyContainerIds) {
                nextState = handleEmptyContainer(containerId, nextState);
            }
        }
        break;
      }
      case 'UPDATE_MEAT_QUANTITY': {
        const { meatCutId, newQuantity } = action.payload;
        const meatCut = nextState.meatCuts.find(m => m.id === meatCutId);
        if (!meatCut) return res.status(400).json({ error: 'Meat Cut not found.' });
        const product = nextState.products.find(p => p.id === meatCut.productId);
        if (!product) return res.status(400).json({ error: 'Product not found.' });

        const locPhrase = getLocationPhrase(meatCut.containerId, nextState);
        const history = newHistoryEntry(`Quantity of "${product.name}" ${locPhrase} changed from ${meatCut.quantity} to ${newQuantity}.`, meatCutId);
        const updatedMeatCuts = nextState.meatCuts.map(m => 
            m.id === meatCutId ? { ...m, quantity: newQuantity } : m
        ).filter(m => m.quantity > 0);
        
        nextState.meatCuts = updatedMeatCuts;
        nextState.history = addHistory(nextState, history);
        nextState = handleEmptyContainer(meatCut.containerId, nextState);
        break;
      }
      case 'UPDATE_MEAT_NOTES': {
        const { meatCutId, notes, originalCutName } = action.payload;
        const meatCut = nextState.meatCuts.find(m => m.id === meatCutId);
        if (!meatCut) return res.status(400).json({ error: 'Meat Cut not found.' });
        const product = nextState.products.find(p => p.id === meatCut.productId);
        
        meatCut.notes = notes;
        meatCut.originalCutName = originalCutName || undefined;
        const locPhrase = getLocationPhrase(meatCut.containerId, nextState);
        const history = newHistoryEntry(`Notes for "${product?.name || 'Item'}" ${locPhrase} updated.`, meatCutId);
        nextState.history = addHistory(nextState, history);
        
        nextState = consolidateMeatCutsInContainer(meatCut.containerId, nextState);
        break;
      }
      case 'SPLIT_MEAT_CUT': {
        const { meatCutId, splitQuantity, notes, tagIds } = action.payload;
        const sourceCut = nextState.meatCuts.find(m => m.id === meatCutId);
        if (!sourceCut) return res.status(400).json({ error: 'Source meat cut not found.' });

        const qtyToSplit = Math.floor(Number(splitQuantity) || 0);
        if (qtyToSplit <= 0 || qtyToSplit >= sourceCut.quantity) {
          return res.status(400).json({ error: 'Invalid split quantity.' });
        }

        const product = nextState.products.find(p => p.id === sourceCut.productId);
        const container = nextState.containers.find(c => c.id === sourceCut.containerId);
        if (!product || !container) return res.status(400).json({ error: 'Product or Container not found.' });

        // Reduce source cut quantity
        sourceCut.quantity -= qtyToSplit;

        const newNotes = notes !== undefined ? notes.trim() : (sourceCut.notes || '').trim();
        const newTagIds = tagIds !== undefined ? tagIds : (sourceCut.tagIds || []);

        const newSplitCut: any = {
          id: crypto.randomUUID(),
          productId: sourceCut.productId,
          quantity: qtyToSplit,
          containerId: sourceCut.containerId,
          notes: newNotes || undefined,
          tagIds: newTagIds.length > 0 ? newTagIds : undefined,
          originalCutName: sourceCut.originalCutName
        };

        nextState.meatCuts = [...nextState.meatCuts, newSplitCut];

        // Auto consolidate in case the target notes/tags match an existing row in this container
        nextState = consolidateMeatCutsInContainer(sourceCut.containerId, nextState);

        const locPhrase = getLocationPhrase(sourceCut.containerId, nextState);
        const history = newHistoryEntry(`Split ${qtyToSplit}x "${product.name}" in ${locPhrase}${newNotes ? ` (Note: "${newNotes}")` : ''}.`, newSplitCut.id);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'CORRECT_MEAT_LABEL': {
        const { meatCutId, correctProductId, notes } = action.payload;
        const meatCut = nextState.meatCuts.find(m => m.id === meatCutId);
        if (!meatCut) return res.status(400).json({ error: 'Meat Cut not found.' });
        
        const oldProduct = nextState.products.find(p => p.id === meatCut.productId);
        const newProduct = nextState.products.find(p => p.id === correctProductId);
        if (!newProduct) return res.status(400).json({ error: 'Selected product not found.' });
        
        const oldName = oldProduct ? oldProduct.name : 'Unknown Cut';
        
        // Store original productId in wrongLabel column if not already set
        if (!meatCut.wrongLabel) {
          meatCut.wrongLabel = meatCut.productId;
        }
        meatCut.isWrongLabel = true;
        
        // Set the meat cut's product to the new correct product ID
        meatCut.productId = correctProductId;
        if (notes !== undefined) {
          meatCut.notes = notes;
        }
        
        const locPhrase = getLocationPhrase(meatCut.containerId, nextState);
        const history = newHistoryEntry(`Label corrected: Changed from "${oldName}" to "${newProduct.name}" ${locPhrase}.`, meatCutId);
        nextState.history = addHistory(nextState, history);
        
        break;
      }
      case 'CORRECT_OFFSITE_LABEL': {
        const { entryId, correctProductId, notes } = action.payload;
        const entry = nextState.offSiteEntries.find(e => e.id === entryId);
        if (!entry) return res.status(400).json({ error: 'Offsite Entry not found.' });
        
        let oldCutsName = '';
        if (entry.productId) {
          const product = nextState.products.find(p => p.id === entry.productId);
          if (product) {
            oldCutsName = product.name;
          }
        }
        if (!oldCutsName) {
          oldCutsName = entry.cuts || entry.originalCutName || 'Unknown Cut';
        }
        const newProduct = nextState.products.find(p => p.id === correctProductId);
        if (!newProduct) return res.status(400).json({ error: 'Selected product not found.' });
        
        // Store original productId in wrongLabel column if not already set
        if (!entry.wrongLabel) {
          let origProdId = entry.productId;
          if (!origProdId) {
            const matchedOrig = nextState.products.find(p => p.name.trim().toLowerCase() === oldCutsName.trim().toLowerCase());
            if (matchedOrig) origProdId = matchedOrig.id;
          }
          entry.wrongLabel = origProdId || oldCutsName;
        }
        entry.isWrongLabel = true;
        entry.productId = correctProductId;
        entry.cuts = newProduct.name;
        if (notes !== undefined) {
          entry.notes = notes;
        }
        
        const history = newHistoryEntry(`Offsite Label corrected: Changed from "${oldCutsName}" to "${newProduct.name}".`, entryId);
        nextState.history = addHistory(nextState, history);
        
        break;
      }
      case 'BULK_CORRECT_OFFSITE_LABEL': {
        const { entryIds, correctProductId, notes } = action.payload;
        const newProduct = nextState.products.find(p => p.id === correctProductId);
        if (!newProduct) return res.status(400).json({ error: 'Selected product not found.' });
        
        for (const entryId of entryIds) {
          const entry = nextState.offSiteEntries.find(e => e.id === entryId);
          if (entry) {
            let oldCutsName = '';
            if (entry.productId) {
              const product = nextState.products.find(p => p.id === entry.productId);
              if (product) {
                oldCutsName = product.name;
              }
            }
            if (!oldCutsName) {
              oldCutsName = entry.cuts || entry.originalCutName || 'Unknown Cut';
            }
            if (!entry.wrongLabel) {
              let origProdId = entry.productId;
              if (!origProdId) {
                const matchedOrig = nextState.products.find(p => p.name.trim().toLowerCase() === oldCutsName.trim().toLowerCase());
                if (matchedOrig) origProdId = matchedOrig.id;
              }
              entry.wrongLabel = origProdId || oldCutsName;
            }
            entry.isWrongLabel = true;
            entry.productId = correctProductId;
            entry.cuts = newProduct.name;
            if (notes !== undefined) {
              entry.notes = notes;
            }
            const history = newHistoryEntry(`Offsite Label corrected (Bulk): Changed from "${oldCutsName}" to "${newProduct.name}".`, entryId);
            nextState.history = addHistory(nextState, history);
          }
        }
        break;
      }
      case 'REVERT_MEAT_LABEL': {
        const { meatCutId } = action.payload;
        const meatCut = nextState.meatCuts.find(m => m.id === meatCutId);
        if (!meatCut) return res.status(400).json({ error: 'Meat Cut not found.' });
        if (!meatCut.wrongLabel && !meatCut.originalCutName) return res.status(400).json({ error: 'This item does not have a wrong label correction to revert.' });

        let restoredProductId = meatCut.wrongLabel;
        let restoredName = '';

        if (restoredProductId) {
          const matchedProduct = nextState.products.find(p => p.id === restoredProductId);
          if (matchedProduct) {
            restoredName = matchedProduct.name;
          }
        }

        if (!restoredProductId && meatCut.originalCutName) {
          const originalName = meatCut.originalCutName;
          const matchedProduct = nextState.products.find(p => p.name.trim().toLowerCase() === originalName.trim().toLowerCase());
          if (matchedProduct) {
            restoredProductId = matchedProduct.id;
            restoredName = matchedProduct.name;
          }
        }

        if (!restoredProductId) {
          return res.status(400).json({ error: 'Could not resolve original product to revert to.' });
        }

        meatCut.productId = restoredProductId;
        meatCut.wrongLabel = undefined;
        meatCut.isWrongLabel = undefined;

        const locPhrase = getLocationPhrase(meatCut.containerId, nextState);
        const history = newHistoryEntry(`Label correction reverted back to original product "${restoredName || 'Original'}" ${locPhrase}.`, meatCutId);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'REVERT_OFFSITE_LABEL': {
        const { entryId } = action.payload;
        const entry = nextState.offSiteEntries.find(e => e.id === entryId);
        if (!entry) return res.status(400).json({ error: 'Offsite Entry not found.' });
        
        let restoredProductId = entry.wrongLabel;
        let restoredName = '';

        if (restoredProductId) {
          const prod = nextState.products.find(p => p.id === restoredProductId);
          if (prod) {
            restoredName = prod.name;
          }
        }

        if (!restoredProductId || !restoredName) {
          const labelToRestore = (entry.originalCutName || entry.cuts || '').trim();
          let matchedProduct = nextState.products.find(p => p.name.trim().toLowerCase() === labelToRestore.toLowerCase());
          if (!matchedProduct && labelToRestore) {
            const cleanName = labelToRestore.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
            matchedProduct = nextState.products.find(p => p.name.trim().toLowerCase() === cleanName);
          }
          if (!matchedProduct && labelToRestore) {
            const matchNum = labelToRestore.match(/^(\d+[a-zA-Z0-9-]*)/);
            const num = matchNum ? matchNum[1] : null;
            if (num) {
              matchedProduct = nextState.products.find(p => p.productNumbers && p.productNumbers.some(n => n.toLowerCase() === num.toLowerCase()));
            }
          }
          if (matchedProduct) {
            restoredProductId = matchedProduct.id;
            restoredName = matchedProduct.name;
          }
        }

        entry.productId = restoredProductId || undefined;
        entry.cuts = restoredName || entry.originalCutName || entry.cuts;
        entry.wrongLabel = undefined;
        entry.isWrongLabel = false;

        const history = newHistoryEntry(`Offsite Label correction reverted back to original label "${entry.cuts}".`, entryId);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'BULK_REVERT_OFFSITE_LABEL': {
        const { entryIds } = action.payload;
        for (const entryId of entryIds) {
          const entry = nextState.offSiteEntries.find(e => e.id === entryId);
          if (entry) {
            let restoredProductId = entry.wrongLabel;
            let restoredName = '';

            if (restoredProductId) {
              const prod = nextState.products.find(p => p.id === restoredProductId);
              if (prod) {
                restoredName = prod.name;
              }
            }

            if (!restoredProductId || !restoredName) {
              const labelToRestore = (entry.originalCutName || entry.cuts || '').trim();
              let matchedProduct = nextState.products.find(p => p.name.trim().toLowerCase() === labelToRestore.toLowerCase());
              if (!matchedProduct && labelToRestore) {
                const cleanName = labelToRestore.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
                matchedProduct = nextState.products.find(p => p.name.trim().toLowerCase() === cleanName);
              }
              if (!matchedProduct && labelToRestore) {
                const matchNum = labelToRestore.match(/^(\d+[a-zA-Z0-9-]*)/);
                const num = matchNum ? matchNum[1] : null;
                if (num) {
                  matchedProduct = nextState.products.find(p => p.productNumbers && p.productNumbers.some(n => n.toLowerCase() === num.toLowerCase()));
                }
              }
              if (matchedProduct) {
                restoredProductId = matchedProduct.id;
                restoredName = matchedProduct.name;
              }
            }

            entry.productId = restoredProductId || undefined;
            entry.cuts = restoredName || entry.originalCutName || entry.cuts;
            entry.wrongLabel = undefined;
            entry.isWrongLabel = false;
            const history = newHistoryEntry(`Offsite Label correction reverted back to original label "${entry.cuts}" (Bulk).`, entryId);
            nextState.history = addHistory(nextState, history);
          }
        }
        break;
      }
      case 'TOGGLE_MEAT_TAG': {
        const { meatCutId, tagId } = action.payload;
        nextState.meatCuts = nextState.meatCuts.map(mc => {
          if (mc.id === meatCutId) {
            const currentTagIds = mc.tagIds || [];
            const isTagSet = currentTagIds.includes(tagId);
            const nextTagIds = isTagSet 
              ? currentTagIds.filter(id => id !== tagId) 
              : [...currentTagIds, tagId];
            
            return {
              ...mc,
              tagIds: nextTagIds
            };
          }
          return mc;
        });
        
        const mc = nextState.meatCuts.find(m => m.id === meatCutId);
        const product = nextState.products.find(p => p.id === mc?.productId);
        const tag = nextState.tags?.find(t => t.id === tagId);
        if (mc && product && tag) {
          const isSet = mc.tagIds?.includes(tagId);
          const tagStateStr = isSet ? 'assigned to' : 'removed from';
          const locPhrase = getLocationPhrase(mc.containerId, nextState);
          const history = newHistoryEntry(`Tag "${tag.name}" was ${tagStateStr} item "${product.name}" ${locPhrase}.`, mc.containerId);
          nextState.history = addHistory(nextState, history);
        }
        if (mc) {
          nextState = consolidateMeatCutsInContainer(mc.containerId, nextState);
        }
        break;
      }
      case 'ADD_TAG': {
        const { tag } = action.payload;
        nextState.tags = [...(nextState.tags || []), tag];
        const history = newHistoryEntry(`Created a new tag "${tag.name}".`, tag.id);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'EDIT_TAG': {
        const { tagId, updates } = action.payload;
        nextState.tags = (nextState.tags || []).map(t => t.id === tagId ? { ...t, ...updates } : t);
        const tag = nextState.tags?.find(t => t.id === tagId);
        const history = newHistoryEntry(`Tag "${tag?.name || 'Tag'}" details updated.`, tagId);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'DELETE_TAG': {
        const { tagId } = action.payload;
        const tag = nextState.tags?.find(t => t.id === tagId);
        nextState.tags = (nextState.tags || []).filter(t => t.id !== tagId);
        // Unassign this tag from any products' defaults
        nextState.products = nextState.products.map(p => {
          if (p.defaultTagIds && p.defaultTagIds.includes(tagId)) {
            return { ...p, defaultTagIds: p.defaultTagIds.filter(id => id !== tagId) };
          }
          return p;
        });
        // Unassign this tag from any meat cuts
        nextState.meatCuts = nextState.meatCuts.map(mc => {
          if (mc.tagIds && mc.tagIds.includes(tagId)) {
            const nextTagIds = (mc.tagIds || []).filter(id => id !== tagId);
            return { ...mc, tagIds: nextTagIds };
          }
          return mc;
        });
        const history = newHistoryEntry(`Tag "${tag?.name || 'Tag'}" was permanently deleted.`, tagId);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'RECONCILE_QUANTITIES': {
        const { updates } = action.payload;
        if (!updates || !Array.isArray(updates)) {
          return res.status(400).json({ error: 'Invalid or missing updates array.' });
        }

        for (const update of updates) {
          const { meatCutId, newQuantity } = update;
          const meatCut = nextState.meatCuts.find(m => m.id === meatCutId);
          if (!meatCut) continue;
          
          const product = nextState.products.find(p => p.id === meatCut.productId);
          if (!product) continue;

          const locPhrase = getLocationPhrase(meatCut.containerId, nextState);
          const history = newHistoryEntry(`Reconciliation: Quantity of "${product.name}" ${locPhrase} changed from ${meatCut.quantity} to ${newQuantity}.`, meatCutId);
          nextState.history = addHistory(nextState, history);

          const updatedMeatCuts = nextState.meatCuts.map(m => 
              m.id === meatCutId ? { ...m, quantity: newQuantity } : m
          ).filter(m => m.quantity > 0);
          
          nextState.meatCuts = updatedMeatCuts;
          nextState = handleEmptyContainer(meatCut.containerId, nextState);
        }
        break;
      }
      case 'MOVE_MEAT_QUANTITY': {
        const { meatCutId, productId, newContainerId, quantity, sourceContainerId, notes, tagIds, originalCutName } = action.payload;
        let sourceCut = nextState.meatCuts.find(m => m.id === meatCutId);

        // Fallback 1: if sourceCut is not found by ID, look up by sourceContainerId, productId, and variant details
        if (!sourceCut && sourceContainerId) {
          if (productId) {
            sourceCut = nextState.meatCuts.find(m => m.containerId === sourceContainerId && isSameVariant(m, productId, notes, tagIds, originalCutName));
            if (!sourceCut) {
              sourceCut = nextState.meatCuts.find(m => m.containerId === sourceContainerId && m.productId === productId);
            }
          } else {
            sourceCut = nextState.meatCuts.find(m => m.containerId === sourceContainerId);
          }
        }

        // Fallback 2: if sourceCut is still not found, search by variant anywhere
        if (!sourceCut && productId) {
          sourceCut = nextState.meatCuts.find(m => isSameVariant(m, productId, notes, tagIds, originalCutName));
          if (!sourceCut) {
            sourceCut = nextState.meatCuts.find(m => m.productId === productId);
          }
        }

        const moveQty = Math.min(Number(quantity) || 0, sourceCut ? sourceCut.quantity : 0);
        if (!sourceCut || moveQty <= 0) return res.status(400).json({ error: 'Invalid move source cut.' });

        const actualSourceContainerId = sourceContainerId || sourceCut.containerId;
        const product = nextState.products.find(p => p.id === sourceCut.productId);
        const oldContainer = nextState.containers.find(c => c.id === actualSourceContainerId);
        const newContainer = nextState.containers.find(c => c.id === newContainerId);
        if (!product || !oldContainer || !newContainer) return res.status(400).json({ error: 'Entities not found for move.' });

        const oldLoc = getLocationPhrase(actualSourceContainerId, nextState);
        const newLoc = getLocationPhrase(newContainerId, nextState);

        const newSourceQuantity = sourceCut.quantity - moveQty;
        const resolvedSourceCutId = sourceCut.id;
        nextState.meatCuts = nextState.meatCuts
          .map(mc => mc.id === resolvedSourceCutId ? { ...mc, quantity: newSourceQuantity } : mc)
          .filter(mc => mc.quantity > 0);
        
        const h1 = newHistoryEntry(`Moved ${moveQty}x "${product.name}" from ${oldLoc} to ${newLoc}. Source remaining: ${newSourceQuantity}.`, resolvedSourceCutId);
        nextState.history = addHistory(nextState, h1);

        const destCut = nextState.meatCuts.find(mc => mc.containerId === newContainerId && isSameVariant(mc, sourceCut.productId, sourceCut.notes, sourceCut.tagIds, sourceCut.originalCutName));
        if (destCut) {
          const newDestQuantity = destCut.quantity + moveQty;
          nextState.meatCuts = nextState.meatCuts.map(mc => mc.id === destCut.id ? { ...mc, quantity: newDestQuantity } : mc);
          const h2 = newHistoryEntry(`Moved ${moveQty}x "${product.name}" to ${newLoc} from ${oldLoc}. Destination total: ${newDestQuantity}.`, destCut.id);
          nextState.history = addHistory(nextState, h2);
        } else {
          const newCutInDest = { 
            id: crypto.randomUUID(), 
            productId: sourceCut.productId, 
            containerId: newContainerId, 
            quantity: moveQty, 
            notes: sourceCut.notes,
            tagIds: sourceCut.tagIds ? [...sourceCut.tagIds] : [],
            originalCutName: sourceCut.originalCutName,
            isWrongLabel: (sourceCut as any).isWrongLabel,
            wrongLabel: (sourceCut as any).wrongLabel,
            wrongLabelOriginal: (sourceCut as any).wrongLabelOriginal || sourceCut.originalCutName,
            serial: (sourceCut as any).serial,
            packDate: (sourceCut as any).packDate,
            weight: (sourceCut as any).weight
          };
          nextState.meatCuts = [...nextState.meatCuts, newCutInDest];
          const h3 = newHistoryEntry(`Moved ${moveQty}x "${product.name}" to ${newLoc} from ${oldLoc}.`, newCutInDest.id);
          nextState.history = addHistory(nextState, h3);
        }
        
        // Maintain Staging Area location for target container intact (do not automatically assign it back to the source container's freezer)

        nextState = handleEmptyContainer(actualSourceContainerId, nextState);
        break;
      }
      case 'MOVE_CONTAINER': {
        const { containerId, newFreezerId, emptyCuts } = action.payload;
        const container = nextState.containers.find(c => c.id === containerId);
        if (!container) return res.status(400).json({ error: 'Container not found.' });

        if (newFreezerId === undefined) {
          if (emptyCuts) {
            // Automatically empty all meat cuts inside this container first
            const cutsInContainer = nextState.meatCuts.filter(mc => mc.containerId === containerId);
            if (cutsInContainer.length > 0) {
              nextState.meatCuts = nextState.meatCuts.filter(mc => mc.containerId !== containerId);
              const emptyHistory = newHistoryEntry(`Container "${container.name}" was emptied of its contents.`, containerId);
              nextState.history = addHistory(nextState, emptyHistory);
            }

            // Determine if it should be completely deleted/retired
            const isDeleteType = !!container.deleteOnEmpty;

            if (isDeleteType) {
              const history = newHistoryEntry(`Container "${container.name}" was emptied and retired.`, containerId);
              const lowerName = container.name.toLowerCase().trim();
              nextState.containers = nextState.containers.filter(c => 
                c.id !== containerId &&
                !( !c.freezerId && c.name.toLowerCase().trim() === lowerName )
              );
              nextState.history = addHistory(nextState, history);
            } else {
              const oldFreezer = nextState.freezers.find(f => f.id === container.freezerId);
              const description = `Container "${container.name}" was emptied and kept in the unused container list (moved from "${oldFreezer?.name || 'Unassigned'}").`;
              const history = newHistoryEntry(description, containerId);
              nextState.containers = nextState.containers.map(c => c.id === containerId ? { ...c, freezerId: undefined } : c);
              nextState.history = addHistory(nextState, history);
            }
          } else {
            // Simple move to Staging table with contents preserved intact
            const oldFreezer = nextState.freezers.find(f => f.id === container.freezerId);
            const description = `Container "${container.name}" moved from "${oldFreezer?.name || 'Unassigned'}" to the Staging/Sorting Area.`;
            const history = newHistoryEntry(description, containerId);
            nextState.containers = nextState.containers.map(c => c.id === containerId ? { ...c, freezerId: undefined } : c);
            nextState.history = addHistory(nextState, history);
          }
        } else {
          // Regular container freezer move
          const oldFreezer = nextState.freezers.find(f => f.id === container.freezerId);
          const newFreezer = newFreezerId ? nextState.freezers.find(f => f.id === newFreezerId) : undefined;
          
          if (newFreezer && newFreezer.isLooseOnly) {
            // Unpack full container into display case loose stocking automatically
            const cutsInContainer = nextState.meatCuts.filter(mc => mc.containerId === containerId);
            const targetLooseContainerId = newFreezerId + "_loose";
            
            cutsInContainer.forEach(cut => {
              if (cut.quantity <= 0) return;
              
              const existingLooseCutIndex = nextState.meatCuts.findIndex(mc => 
                mc.containerId === targetLooseContainerId && 
                isSameVariant(mc, cut.productId, cut.notes, cut.tagIds, cut.originalCutName)
              );
              
              if (existingLooseCutIndex > -1) {
                nextState.meatCuts[existingLooseCutIndex].quantity += cut.quantity;
                if (cut.notes) {
                  const existingNotes = nextState.meatCuts[existingLooseCutIndex].notes;
                  nextState.meatCuts[existingLooseCutIndex].notes = existingNotes 
                    ? `${existingNotes}; ${cut.notes}`
                    : cut.notes;
                }
              } else {
                nextState.meatCuts.push({
                  ...cut,
                  id: 'mc_' + Math.random().toString(36).substr(2, 9),
                  containerId: targetLooseContainerId
                });
              }
            });

            // Remove items of the original unpacked container
            nextState.meatCuts = nextState.meatCuts.filter(mc => mc.containerId !== containerId);

            // Delete or retire the container
            const isDeleteType = !!container.deleteOnEmpty;
            let finalActionDesc = "";

            if (isDeleteType) {
              const lowerName = container.name.toLowerCase().trim();
              nextState.containers = nextState.containers.filter(c => 
                c.id !== containerId &&
                !( !c.freezerId && c.name.toLowerCase().trim() === lowerName )
              );
              finalActionDesc = `Container "${container.name}" was unpacked/unboxed into "${newFreezer.name}" loose layers and retired.`;
            } else {
              nextState.containers = nextState.containers.map(c => c.id === containerId ? { ...c, freezerId: undefined } : c);
              finalActionDesc = `Container "${container.name}" was unboxed into "${newFreezer.name}" loose layers and kept in the unused container list.`;
            }

            const history = newHistoryEntry(finalActionDesc, containerId);
            nextState.history = addHistory(nextState, history);
          } else {
            const description = `Container "${container.name}" moved from "${oldFreezer?.name || 'Unassigned'}" to "${newFreezer?.name || 'Unknown'}".`;
            const history = newHistoryEntry(description, containerId);

            nextState.containers = nextState.containers.map(c => 
              c.id === containerId 
                ? { ...c, freezerId: newFreezerId, deleteOnEmpty: !c.freezerId ? true : c.deleteOnEmpty } 
                : c
            );
            nextState.history = addHistory(nextState, history);
          }
        }
        break;
      }
      case 'EDIT_CONTAINER': {
        const { containerId, updates, applyGlobally } = action.payload;
        const originalContainer = nextState.containers.find(c => c.id === containerId);
        if (!originalContainer) break;

        if (containerId === 'staging_loose' || containerId.endsWith('_loose') || originalContainer.name.toLowerCase().trim() === 'loose') {
          // Do not allow re-naming core "loose" containers
          if (updates.name) delete updates.name;
        }

        const originalNameLower = originalContainer.name.trim().toLowerCase();
        const originalTplId = originalContainer.templateId;

        if (applyGlobally) {
          // Update ALL active containers with same name or same templateId
          nextState.containers = nextState.containers.map(c => {
            const isSameName = c.name.trim().toLowerCase() === originalNameLower;
            const isSameTpl = originalTplId && c.templateId === originalTplId;
            if (c.id === containerId || isSameName || isSameTpl) {
              return { ...c, ...updates };
            }
            return c;
          });

          // Also update the linked container template in catalog if it exists
          if (nextState.containerTemplates) {
            nextState.containerTemplates = nextState.containerTemplates.map((t: any) => {
              if ((originalTplId && t.id === originalTplId) || t.name.trim().toLowerCase() === originalNameLower) {
                return {
                  ...t,
                  ...(updates.name ? { name: updates.name } : {}),
                  ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl } : {})
                };
              }
              return t;
            });
          }
        } else {
          // Update ONLY this single container and break/decouple from template
          const isTemplateContainer = !!originalTplId || (nextState.containerTemplates || []).some((t: any) => t.name.trim().toLowerCase() === originalNameLower);
          nextState.containers = nextState.containers.map(c => {
            if (c.id === containerId) {
              const updated = { ...c, ...updates };
              updated.templateId = undefined;
              if (isTemplateContainer) {
                updated.deleteOnEmpty = true;
              }
              return updated;
            }
            return c;
          });
        }

        const history = newHistoryEntry(`Updated container "${originalContainer.name}".`, containerId);
        nextState.history = addHistory(nextState, history);
        break;
      }
      case 'BULK_ADD_MEAT_CUTS': {
        const { items, containerId } = action.payload;
        const containerName = nextState.containers.find(c => c.id === containerId)?.name || 'Unknown Container';
    
        items.forEach((item: any) => {
            if (!item.productId || item.quantity <= 0) return;
            
            const product = nextState.products.find(p => p.id === item.productId);
            if (!product) return;
    
            const productDefaultTagIds = product.defaultTagIds || [];
            const finalTagIds = item.tagIds || productDefaultTagIds;

            const existingCutIndex = nextState.meatCuts.findIndex(mc => mc.containerId === containerId && isSameVariant(mc, item.productId, item.notes, finalTagIds, item.originalCutName));

            if (existingCutIndex > -1) {
                const existingCut = nextState.meatCuts[existingCutIndex];
                const newQuantity = existingCut.quantity + item.quantity;
                
                const combinedTagIds = Array.from(new Set([...(existingCut.tagIds || []), ...finalTagIds]));
                const existingNotes = (existingCut.notes || '').trim();
                const newNotes = (item.notes || '').trim();
                let combinedNotes = existingCut.notes;
                if (newNotes) {
                  if (!existingNotes) combinedNotes = newNotes;
                  else if (!existingNotes.includes(newNotes)) combinedNotes = `${existingNotes} | ${newNotes}`;
                }
                const existingOriginal = (existingCut.originalCutName || '').trim();
                const newOriginal = (item.originalCutName || '').trim();
                let combinedOriginal = existingCut.originalCutName;
                if (newOriginal) {
                  if (!existingOriginal) combinedOriginal = newOriginal;
                  else if (!existingOriginal.includes(newOriginal)) combinedOriginal = `${existingOriginal} | ${newOriginal}`;
                }
                const locPhrase = getLocationPhrase(containerId, nextState);
                
                nextState.meatCuts[existingCutIndex] = { ...existingCut, quantity: newQuantity, tagIds: combinedTagIds, notes: combinedNotes, originalCutName: combinedOriginal };
                const history = newHistoryEntry(`Added ${item.quantity}x "${product.name}" ${locPhrase}, new total ${newQuantity}.`, existingCut.id);
                nextState.history = addHistory(nextState, history);

            } else {
                const combinedTagIds = [...finalTagIds];

                const newMeatCut = { 
                    id: crypto.randomUUID(), 
                    productId: item.productId, 
                    containerId, 
                    quantity: item.quantity, 
                    notes: item.notes,
                    tagIds: combinedTagIds,
                    originalCutName: item.originalCutName || undefined
                };
                nextState.meatCuts.push(newMeatCut);
                const locPhrase = getLocationPhrase(containerId, nextState);
                const history = newHistoryEntry(`${item.quantity}x "${product.name}" added ${locPhrase}.`, newMeatCut.id);
                nextState.history = addHistory(nextState, history);
            }
        });
        break;
      }
      case 'RENAME_CATEGORY': {
        const { oldName, newName, type } = action.payload;
        if (!newName.trim()) return res.status(400).json({ error: 'New category name is required.' });
        nextState.products = nextState.products.map(p => {
            if (type === 'primary' && p.primaryCategory === oldName) {
                return { ...p, primaryCategory: newName };
            }
            if (type === 'sub' && p.subCategory === oldName) {
                return { ...p, subCategory: newName };
            }
            return p;
        });
        if (nextState.categories) {
          nextState.categories = nextState.categories.map((c: any) => {
            if (type === 'primary' && c.type === 'primary' && c.name === oldName) {
              return { ...c, name: newName };
            }
            if (type === 'sub' && c.type === 'sub' && c.name === oldName) {
              return { ...c, name: newName };
            }
            if (type === 'primary' && c.type === 'sub' && c.parentPrimary === oldName) {
              return { ...c, parentPrimary: newName };
            }
            return c;
          });
        }
        break;
      }
      case 'UPDATE_CATEGORY_DECORATION': {
        const { name, type, parentPrimary, icon } = action.payload;
        if (!nextState.categories) {
          nextState.categories = [];
        }
        
        const existingIdx = nextState.categories.findIndex((c: any) => {
          if (c.type !== type) return false;
          if (c.name.toLowerCase().trim() !== name.toLowerCase().trim()) return false;
          if (type === 'sub') {
            return c.parentPrimary?.toLowerCase().trim() === parentPrimary?.toLowerCase().trim();
          }
          return true;
        });

        const resolvedIcon = icon !== undefined ? (icon === '' || icon === null || icon === 'CLEAR_ICON' ? undefined : icon) : undefined;
        const iconWasProvided = icon !== undefined;

        if (existingIdx > -1) {
          const category = nextState.categories[existingIdx];
          const updatedCategory: any = {
            ...category
          };
          if (iconWasProvided) {
            if (resolvedIcon === undefined) {
              delete updatedCategory.icon;
            } else {
              updatedCategory.icon = resolvedIcon;
            }
          }
          nextState.categories[existingIdx] = updatedCategory;
        } else {
          const newCategory: any = {
            id: crypto.randomUUID(),
            name,
            type,
            parentPrimary
          };
          if (resolvedIcon !== undefined) {
            newCategory.icon = resolvedIcon;
          }
          nextState.categories.push(newCategory);
        }
        break;
      }
      case 'ADD_OFFSITE_ENTRY': {
        const entries = nextState.offSiteEntries || [];
        nextState.offSiteEntries = [...entries, action.payload.entry];
        break;
      }
      
      case 'ADD_BUTCHER_ORDER': {
        const orders = nextState.butcherOrders || [];
        const offSiteEntries = nextState.offSiteEntries || [];
        const products = nextState.products || [];
        const boxes = nextState.boxes || [];
        
        const locId = action.payload.targetLocation || action.payload.order?.locationId || action.payload.order?.targetLocation;
        const selectedLoc = (nextState.locations || []).find((l: any) => l.id === locId || l.name === locId);
        const locationName = selectedLoc?.name || action.payload.targetLocation || action.payload.order?.targetLocation || '';
        const defaultPalletName = (action.payload.targetPallet || action.payload.order?.targetPallet || action.payload.order?.pallet || '').trim();
        
        (action.payload.records || []).forEach((r: any) => {
          // Find or create product
          const productName = (r.normalizedCutName || r.originalCutName || '').trim();
          let productId = null;
          if (productName) {
            let matchedProduct = r.productId ? products.find((p: any) => p.id === r.productId) : undefined;
            if (!matchedProduct) {
              matchedProduct = products.find((p: any) => p.name.trim().toLowerCase() === productName.toLowerCase());
            }
            if (!matchedProduct) {
              matchedProduct = {
                id: crypto.randomUUID(),
                name: productName,
                primaryCategory: 'Uncategorized',
                subCategory: ''
              };
              products.push(matchedProduct);
            } else if (matchedProduct.isArchived) {
              matchedProduct.isArchived = false;
            }
            productId = matchedProduct.id;
          }
          
          let boxId = null;
          if (r.box && r.box.trim()) {
            const boxName = r.box.trim();
            let matchedBox = boxes.find((b: any) => b.name === boxName || b.id === boxName);
            if (!matchedBox) {
              matchedBox = {
                id: boxName,
                name: boxName
              };
              boxes.push(matchedBox);
            }
            boxId = matchedBox.id;
          }
          
          let existingEntry: any = null;
          if (r.serial && r.serial.trim()) {
            const serialLower = r.serial.trim().toLowerCase();
            existingEntry = offSiteEntries.find((e: any) => e.serial && e.serial.trim().toLowerCase() === serialLower);
          }
          
          const isArchived = !r.importedToOffSite;
          const rLoc = (r.location || locationName).trim();
          const rPallet = (r.pallet || r.targetPallet || r.currentLocation || defaultPalletName).trim();
          
          if (existingEntry) {
            existingEntry.orderId = action.payload.order.id;
            existingEntry.originalCutName = r.originalCutName || existingEntry.originalCutName || '';
            if (productId) existingEntry.productId = productId;
            if (!existingEntry.packDate) existingEntry.packDate = r.packDate || '';
            if (!existingEntry.lot) existingEntry.lot = r.lot || '';
            if (!existingEntry.pieces || existingEntry.pieces === 0) existingEntry.pieces = r.pieces ?? 0;
            if (!existingEntry.netWeight || existingEntry.netWeight === 0) existingEntry.netWeight = r.netWeight ?? 0;
            if (boxId && !existingEntry.box) existingEntry.box = boxId;
            
            const wasArchived = !!(existingEntry.archived === 1 || existingEntry.archived === true || String(existingEntry.archived) === 'true');
            const shouldBeArchivedNow = wasArchived || isArchived;
            
            if (shouldBeArchivedNow) {
              existingEntry.location = '';
              existingEntry.pallet = '';
              existingEntry.currentLocation = '';
              existingEntry.storageLocationId = '';
              existingEntry.moveTo = '';
              existingEntry.archived = true;
            } else {
              if (!existingEntry.location || existingEntry.location === '') existingEntry.location = rLoc;
              if (!existingEntry.pallet || existingEntry.pallet === '') existingEntry.pallet = rPallet;
              if (!existingEntry.currentLocation || existingEntry.currentLocation === '') existingEntry.currentLocation = rPallet;
              if (!existingEntry.storageLocationId && selectedLoc?.id) existingEntry.storageLocationId = selectedLoc.id;
              existingEntry.archived = false;
            }
          } else {
            offSiteEntries.push({
              id: r.id || crypto.randomUUID(),
              serial: r.serial || '',
              productId,
              originalCutName: r.originalCutName || '',
              packDate: r.packDate || '',
              lot: r.lot || '',
              pieces: r.pieces ?? 0,
              netWeight: r.netWeight ?? 0,
              box: boxId || '',
              location: isArchived ? '' : rLoc,
              pallet: isArchived ? '' : rPallet,
              currentLocation: isArchived ? '' : rPallet,
              notes: r.notes || '',
              orderId: action.payload.order.id,
              archived: isArchived,
              storageLocationId: isArchived ? '' : (selectedLoc?.id || '')
            });
          }

          if (rPallet && !isArchived) {
            if (!nextState.pallets) nextState.pallets = [];
            let palletObj = nextState.pallets.find((p: any) => (p.id && p.id.toLowerCase() === rPallet.toLowerCase()) || (p.name && p.name.toLowerCase() === rPallet.toLowerCase()));
            if (!palletObj) {
              nextState.pallets.push({
                id: rPallet,
                name: rPallet,
                storageLocationId: selectedLoc?.id,
                isArchived: false
              });
            } else {
              palletObj.isArchived = false;
              if (selectedLoc?.id && !palletObj.storageLocationId) {
                palletObj.storageLocationId = selectedLoc.id;
              }
            }
          }
        });
        
        const existingOrderIdx = orders.findIndex((o: any) => o.id === action.payload.order.id);
        if (existingOrderIdx >= 0) {
          orders[existingOrderIdx] = {
            ...orders[existingOrderIdx],
            ...action.payload.order
          };
          nextState.butcherOrders = [...orders];
        } else {
          nextState.butcherOrders = [...orders, action.payload.order];
        }
        nextState.offSiteEntries = [...offSiteEntries];
        nextState.products = [...products];
        nextState.boxes = [...boxes];
        break;
      }
      
      case 'DELETE_BUTCHER_ORDER': {
        const orderId = action.payload.orderId;
        const orders = nextState.butcherOrders || [];
        nextState.butcherOrders = orders.filter((o: any) => o.id !== orderId);
        
        if (nextState.offSiteEntries) {
          nextState.offSiteEntries = nextState.offSiteEntries
            .filter((e: any) => !(e.orderId === orderId && e.archived))
            .map((e: any) => {
              if (e.orderId === orderId) {
                return { ...e, orderId: '' };
              }
              return e;
            });
        }
        break;
      }
      case 'EDIT_BUTCHER_ORDER': {
        const orderId = action.payload.orderId;
        const updates = action.payload.updates;
        const orders = nextState.butcherOrders || [];
        nextState.butcherOrders = orders.map(o => o.id === orderId ? { ...o, ...updates } : o);
        break;
      }
      case 'UPDATE_OFFSITE_ENTRY': {
        const entries = nextState.offSiteEntries || [];
        nextState.offSiteEntries = entries.map(e => {
          if (e.id === action.payload.id) {
            const updates = { ...action.payload.updates };
            if (updates.location !== undefined) {
              const matchedLoc = nextState.locations?.find((l: any) => l.name.toLowerCase().trim() === (updates.location || '').toLowerCase().trim());
              if (matchedLoc) {
                updates.storageLocationId = matchedLoc.id;
              } else if (updates.location === '') {
                updates.storageLocationId = undefined;
              }
            }
            return { ...e, ...updates };
          }
          return e;
        });
        break;
      }
      case 'UPDATE_OFFSITE_BOX_COLORS': {
        // Purged: No longer support colors
        break;
      }
      case 'TOGGLE_OFFSITE_ENTRY_TAG': {
        const { entryId, tagId } = action.payload;
        const entries = nextState.offSiteEntries || [];
        nextState.offSiteEntries = entries.map(e => {
          if (e.id === entryId) {
            const currentTagIds = e.tagIds || [];
            const isTagSet = currentTagIds.includes(tagId);
            const nextTagIds = isTagSet 
              ? currentTagIds.filter(id => id !== tagId) 
              : [...currentTagIds, tagId];
            return {
              ...e,
              tagIds: nextTagIds
            };
          }
          return e;
        });
        break;
      }
      case 'RENAME_PALLET': {
        const { oldName, newName } = action.payload;
        if (!oldName || !newName || oldName === newName) break;
        const oldLower = oldName.trim().toLowerCase();
        
        // Update OffSiteEntries
        if (nextState.offSiteEntries) {
          nextState.offSiteEntries = nextState.offSiteEntries.map(e => {
            let updated = { ...e };
            let changed = false;
            if ((e.currentLocation || '').trim().toLowerCase() === oldLower) { updated.currentLocation = newName.trim(); changed = true; }
            if ((e.pallet || '').trim().toLowerCase() === oldLower) { updated.pallet = newName.trim(); changed = true; }
            return changed ? updated : e;
          });
        }

        // Update MovementOrders
        if (nextState.movementOrders) {
          nextState.movementOrders = nextState.movementOrders.map(mo => {
            let moUpdated = { ...mo };
            let moChanged = false;
            
            // palletsInPlay
            if (mo.palletsInPlay) {
              const pIdx = mo.palletsInPlay.findIndex(p => p.trim().toLowerCase() === oldLower);
              if (pIdx >= 0) {
                moUpdated.palletsInPlay = [...mo.palletsInPlay];
                moUpdated.palletsInPlay[pIdx] = newName.trim();
                moChanged = true;
              }
            }

            // targetDestinations & moves
            let destIdMap = new Map<string, string>(); // Map old targetLocation ID to new one
            
            if (mo.targetDestinations) {
              const newDests = mo.targetDestinations.map(d => {
                if ((d.palletName || '').trim().toLowerCase() === oldLower) {
                  const newId = `${d.locationId}::${newName.trim()}`;
                  destIdMap.set(d.id, newId);
                  return { ...d, palletName: newName.trim(), id: newId };
                }
                return d;
              });
              if (destIdMap.size > 0) {
                moUpdated.targetDestinations = newDests;
                moChanged = true;
              }
            }

            if (mo.moves && destIdMap.size > 0) {
              moUpdated.moves = mo.moves.map(m => {
                if (destIdMap.has(m.targetLocation)) {
                  return { ...m, targetLocation: destIdMap.get(m.targetLocation)! };
                }
                return m;
              });
              moChanged = true;
            }

            return moChanged ? moUpdated : mo;
          });
        }
        break;
      }
      case 'ASSIGN_PALLET_LOCATION': {
        const { palletName, storageLocationId } = action.payload;
        const entries = nextState.offSiteEntries || [];
        const locs = nextState.locations || [];
        const matchedLoc = locs.find(l => l.id === storageLocationId);
        const resolvedName = matchedLoc ? matchedLoc.name : '';
        nextState.offSiteEntries = entries.map(e => {
          const ePallet = (e.currentLocation || '').trim().toLowerCase();
          const targetPallet = (palletName || '').trim().toLowerCase();
          if (ePallet === targetPallet) {
            return { 
              ...e, 
              storageLocationId: storageLocationId || '',
              location: resolvedName
            };
          }
          return e;
        });
        break;
      }
      case 'UPDATE_PALLET_NOTES': {
        const { palletId, notes } = action.payload;
        if (!palletId) break;
        if (!nextState.pallets) nextState.pallets = [];
        
        const existingIdx = nextState.pallets.findIndex(p => p.id === palletId || p.name === palletId);
        if (existingIdx >= 0) {
          nextState.pallets[existingIdx] = {
            ...nextState.pallets[existingIdx],
            notes: notes || undefined
          };
        } else {
          nextState.pallets.push({
            id: palletId,
            name: palletId,
            notes: notes || undefined,
            isArchived: false
          });
        }
        break;
      }
      case 'MOVE_STAGING_TO_OFFSITE': {
        const homeLocation = nextState.locations?.find(l => l.isHome);
        const homeLocationName = homeLocation?.name || 'Home Base';

        const stagedContainers = nextState.containers.filter(c => !c.isArchived && !c.freezerId && (!c.id.endsWith('_loose') || c.id === 'staging_loose'));
        const stagedContainerIds = new Set(stagedContainers.map(c => c.id));
        
        const stagingCuts = nextState.meatCuts.filter(mc => stagedContainerIds.has(mc.containerId) || mc.containerId === 'staging_loose');

        if (stagingCuts.length === 0) {
          console.log('MOVE_STAGING_TO_OFFSITE: stagingCuts.length is 0. Containers:', nextState.containers.length, 'MeatCuts:', nextState.meatCuts.length);
          break; // Nothing to move
        }
        console.log('MOVE_STAGING_TO_OFFSITE: Moving', stagingCuts.length, 'cuts.');

        const newOffSiteEntries: any[] = [];
        const movedItemIds = new Set<string>();

        for (const mc of stagingCuts) {
          const product = nextState.products.find(p => p.id === mc.productId);
          const cutsName = product?.name || mc.productId || 'Unknown Cut';
          const container = stagedContainers.find(c => c.id === mc.containerId);
          const boxName = container && !container.id.endsWith('_loose') ? container.name : '';

          const isActuallyWrongLabel = Boolean(mc.originalCutName || (mc as any).isWrongLabel || (mc as any).wrongLabel || (mc as any).wrongLabelOriginal);
          const originalName = (mc as any).wrongLabelOriginal || mc.originalCutName || cutsName;

          newOffSiteEntries.push({
            id: crypto.randomUUID(),
            serial: (mc as any).serial || '',
            cuts: cutsName,
            originalCutName: originalName,
            normalizedCutName: cutsName,
            productId: mc.productId,
            isWrongLabel: isActuallyWrongLabel,
            wrongLabel: isActuallyWrongLabel,
            wrongLabelOriginal: isActuallyWrongLabel ? (originalName || undefined) : undefined,
            packDate: (mc as any).packDate || '',
            lot: '',
            pieces: mc.quantity || 1,
            netWeight: (mc as any).weight || 0,
            box: boxName,
            location: homeLocationName,
            storageLocationId: homeLocation?.id,
            currentLocation: '', // No pallet
            pallet: '',
            notes: mc.notes || '',
            tagIds: mc.tagIds ? [...mc.tagIds] : [],
            staged: true
          });
          movedItemIds.add(mc.id);
        }

        // Add to offSiteEntries
        nextState.offSiteEntries = [...(nextState.offSiteEntries || []), ...newOffSiteEntries];

        // Remove the meat cuts from on-site
        nextState.meatCuts = nextState.meatCuts.filter(mc => !movedItemIds.has(mc.id));

        // Archive or remove empty containers that were in staging (except staging_loose)
        const emptyContainerIds = new Set<string>();
        stagedContainers.forEach(c => {
          if (c.id !== 'staging_loose') {
            const hasCuts = nextState.meatCuts.some(mc => mc.containerId === c.id);
            if (!hasCuts) {
              emptyContainerIds.add(c.id);
            }
          }
        });

        nextState.containers = nextState.containers.filter(c => !emptyContainerIds.has(c.id));

        const historyStr = `Moved ${stagingCuts.length} item(s) from Staging to Off-Site Staging Worksheet.`;
        nextState.history = addHistory(nextState, newHistoryEntry(historyStr, 'staging_loose'));
        break;
      }
      case 'FINALIZE_OFFSITE_STAGING': {
        const { entries, movementOrderName } = action.payload;
        if (!entries || entries.length === 0) break;

        // 1. Remove all currently staged entries
        const currentEntries = nextState.offSiteEntries || [];
        nextState.offSiteEntries = currentEntries.filter((e: any) => !e.staged);

        // 2. Add the finalized entries (with staged set to false/0)
        const finalizedEntries = entries.map((e: any) => ({
          ...e,
          staged: false
        }));
        nextState.offSiteEntries = [...nextState.offSiteEntries, ...finalizedEntries];

        // 3. Create a Completed Movement Order for this move
        const uniquePallets = Array.from(new Set(finalizedEntries.map((e: any) => e.pallet || e.currentLocation).filter(Boolean))) as string[];
        const uniqueLocations = Array.from(new Set(finalizedEntries.map((e: any) => e.location).filter(Boolean))) as string[];

        const orderName = movementOrderName || `Moved from Staging (${new Date().toLocaleDateString()})`;
        const movementOrder: any = {
          id: crypto.randomUUID(),
          name: orderName,
          description: `Staging worksheet finalized. Moved ${finalizedEntries.length} item(s) to off-site storage.`,
          date: new Date().toISOString(),
          status: 'completed',
          palletsInPlay: uniquePallets,
          locationsInPlay: uniqueLocations,
          moves: finalizedEntries.map((e: any) => ({
            entryId: e.id,
            targetLocation: e.pallet || e.currentLocation || '',
            actualLocation: e.pallet || e.currentLocation || '',
            originalLocation: 'On-Site Staging',
            originalCurrentLocation: ''
          })),
          executedAt: new Date().toISOString()
        };
        nextState.movementOrders = [...(nextState.movementOrders || []), movementOrder];

        const historyStr = `Finalized Staging Worksheet: Moved ${finalizedEntries.length} item(s) off-site.`;
        nextState.history = addHistory(nextState, newHistoryEntry(historyStr, 'staging_loose'));
        break;
      }
      case 'DELETE_OFFSITE_ENTRY': {
        const entries = nextState.offSiteEntries || [];
        nextState.offSiteEntries = entries.map(e => {
          if (e.id === action.payload.id) {
            if (e.orderId) {
              return { ...e, archived: true };
            }
            return null;
          }
          return e;
        }).filter(Boolean) as any[];
        break;
      }
      case 'BULK_DELETE_OFFSITE_ENTRIES': {
        const entries = nextState.offSiteEntries || [];
        const idsToDelete = new Set(action.payload.ids || []);
        nextState.offSiteEntries = entries.map(e => {
          if (idsToDelete.has(e.id)) {
            if (e.orderId) {
              return { ...e, archived: true };
            }
            return null;
          }
          return e;
        }).filter(Boolean) as any[];
        break;
      }
      case 'BULK_EDIT_OFFSITE_ENTRIES': {
        const entries = nextState.offSiteEntries || [];
        const idsToEdit = new Set(action.payload.ids || []);
        const updates = { ...(action.payload.updates || {}) };

        if (updates.location !== undefined) {
          const matchedLoc = nextState.locations?.find((l: any) => l.name.toLowerCase().trim() === (updates.location || '').toLowerCase().trim());
          if (matchedLoc) {
            updates.storageLocationId = matchedLoc.id;
          } else if (updates.location === '') {
            updates.storageLocationId = undefined;
          }
        }

        if (updates.boxNotes !== undefined) {
          const boxes = nextState.boxes || [];
          const boxNamesToUpdate = new Set<string>();
          entries.forEach(e => {
            if (idsToEdit.has(e.id) && e.box) {
              boxNamesToUpdate.add(e.box.trim());
            }
          });

          boxNamesToUpdate.forEach(bName => {
            let matchedBox = boxes.find(b => b.id === bName || b.name === bName);
            if (matchedBox) {
              matchedBox.notes = updates.boxNotes;
            } else {
              boxes.push({
                id: bName,
                name: bName,
                notes: updates.boxNotes
              });
            }
          });
          nextState.boxes = [...boxes];
        }

        nextState.offSiteEntries = entries.map(e => {
          if (idsToEdit.has(e.id)) {
            return { ...e, ...updates };
          }
          return e;
        });
        break;
      }
      case 'IMPORT_OFFSITE_ENTRIES': {
        const isReplace = !!action.payload.replaceAll;
        const currentEntries = isReplace ? [] : (nextState.offSiteEntries || []);
        const newEntries = action.payload.entries;
        if (isReplace) {
          nextState.offSiteEntries = newEntries;
        } else {
          const nextEntries = currentEntries.map((e: any) => ({ ...e }));
          const newEntriesToPush: any[] = [];
          
          for (const incoming of newEntries) {
            // First try matching by ID
            let existing = incoming.id ? nextEntries.find(e => e.id === incoming.id) : undefined;
            
            // If not found by ID, try matching by serial (if present)
            if (!existing) {
              const incomingSerial = (incoming.serial || '').trim();
              if (incomingSerial && incomingSerial !== '0' && incomingSerial !== '') {
                existing = nextEntries.find(e => e.serial && e.serial.trim().toLowerCase() === incomingSerial.toLowerCase());
              }
            }
            
            if (existing) {
              // Merge info and bring over original names
              existing.originalCutName = incoming.originalCutName || existing.originalCutName || '';
              existing.normalizedCutName = incoming.normalizedCutName || existing.normalizedCutName || '';
              existing.cuts = incoming.cuts || existing.cuts || '';
              if (incoming.productId) {
                existing.productId = incoming.productId;
              }
              
              if (!existing.packDate) existing.packDate = incoming.packDate || '';
              if (!existing.lot) existing.lot = incoming.lot || '';
              if (!existing.pieces || existing.pieces === 0) {
                existing.pieces = incoming.pieces ?? 0;
              }
              if (!existing.netWeight || existing.netWeight === 0) {
                existing.netWeight = incoming.netWeight ?? 0;
              }
              if (!existing.mwOrderNumber) {
                existing.mwOrderNumber = incoming.mwOrderNumber || '';
              }
              if (!existing.box) existing.box = incoming.box || '';
              if (!existing.location) existing.location = incoming.location || '';
              if (!existing.currentLocation) existing.currentLocation = incoming.currentLocation || '';
              if (!existing.notes) existing.notes = incoming.notes || '';
              if (!existing.orderId) existing.orderId = incoming.orderId || '';
              
              // Ensure we don't drop moveTo if provided by the incoming update
              if (incoming.moveTo !== undefined) {
                existing.moveTo = incoming.moveTo;
              }
              continue;
            }
            
            newEntriesToPush.push(incoming);
          }
          nextState.offSiteEntries = [...nextEntries, ...newEntriesToPush];
          const importedProductIds = new Set(newEntries.map((e: any) => e.productId).filter(Boolean));
          if (importedProductIds.size > 0) {
            nextState.products = nextState.products.map((p: any) => {
              if (importedProductIds.has(p.id) && p.isArchived) {
                return { ...p, isArchived: false };
              }
              return p;
            });
          }
        }
        break;
      }
      
      case 'ADD_MOVEMENT_ORDER': {
        const orders = nextState.movementOrders || [];
        nextState.movementOrders = [...orders, action.payload.order];
        break;
      }
      case 'UPDATE_MOVEMENT_ORDER': {
        const orders = nextState.movementOrders || [];
        nextState.movementOrders = orders.map(o => o.id === action.payload.id ? { ...o, ...action.payload.updates } : o);
        break;
      }
      case 'DELETE_MOVEMENT_ORDER': {
        const orders = nextState.movementOrders || [];
        nextState.movementOrders = orders.filter(o => o.id !== action.payload.id);
        break;
      }
      case 'EXECUTE_MOVEMENT_ORDER': {
        const orders = nextState.movementOrders || [];
        const order = orders.find(o => o.id === action.payload.id);
        if (order && nextState.offSiteEntries) {
          const { moveToStaging = false, removeFromInventoryDestIds = [] } = action.payload;

          // Record original entries and locations before executing so we can undo it
          order.originalEntries = nextState.offSiteEntries.filter(e => 
            order.moves.some(m => m.entryId === e.id)
          ).map(e => ({ ...e }));

          order.moves = order.moves.map(m => {
            const entry = nextState.offSiteEntries?.find(e => e.id === m.entryId);
            return {
              ...m,
              originalLocation: entry?.location || '',
              originalCurrentLocation: entry?.currentLocation || ''
            };
          });

          // execute moves
          const movesMap = new Map(order.moves.map(m => [m.entryId, m.actualLocation || m.targetLocation]));

          // STEP 1: CREATE OR UPDATE PALLETS FOR ALL TARGET DESTINATIONS IN THE CORRECT LOCATIONS
          if (order.targetDestinations) {
            for (const dest of order.targetDestinations) {
              if (dest.palletName && dest.palletName.trim()) {
                const palletNameStr = dest.palletName.trim();
                let palletObj = nextState.pallets?.find(p => p.id === palletNameStr || p.name === palletNameStr);
                if (!palletObj) {
                  palletObj = {
                    id: palletNameStr,
                    name: palletNameStr,
                    storageLocationId: dest.locationId,
                    isArchived: false
                  };
                  nextState.pallets = [...(nextState.pallets || []), palletObj];
                } else {
                  palletObj.storageLocationId = dest.locationId;
                  palletObj.isArchived = false;
                }

                // Ensure the corresponding on-site freezer representation is also unarchived
                const palletFreezerId = 'pallet-' + palletNameStr.replace(/\s+/g, '-').toLowerCase();
                const freezerObj = nextState.freezers?.find(f => f.id === palletFreezerId);
                if (freezerObj) {
                  (freezerObj as any).isArchived = false;
                }
              }
            }
          }

          const nextOffSiteEntries: any[] = [];

          // Pre-calculate if any boxes are split and determine their new names/suffixes
          const newBoxNamesMap = new Map<string, string>();
          
          // 1. Group active entries of each box
          const activeEntriesByBox: Record<string, any[]> = {};
          for (const e of nextState.offSiteEntries) {
            if (e.archived) continue;
            const b = (e.box || '').trim();
            if (b && b.toLowerCase() !== 'unassigned-box') {
              if (!activeEntriesByBox[b]) activeEntriesByBox[b] = [];
              activeEntriesByBox[b].push(e);
            }
          }

          // 2. For each box, see if it is split across different destination keys
          for (const [boxName, boxCuts] of Object.entries(activeEntriesByBox)) {
            const destinationGroups: Record<string, any[]> = {};
            for (const cut of boxCuts) {
              const destId = movesMap.get(cut.id);
              let destKey = '';
              if (movesMap.has(cut.id)) {
                const dest = order.targetDestinations?.find(d => d.id === destId);
                if (dest && removeFromInventoryDestIds.includes(dest.id)) {
                  // Removed from inventory - doesn't count towards active/staged groups
                  continue;
                }
                const loc = dest ? nextState.locations?.find((l: any) => l.id === dest.locationId) : null;
                const isHomeLoc = !!(loc && loc.isHome);
                if (moveToStaging && isHomeLoc) {
                  destKey = `staging::${destId}`;
                } else {
                  destKey = `offsite::${destId}`;
                }
              } else {
                destKey = `stay::${cut.location || ''}::${cut.currentLocation || ''}`;
              }

              if (!destinationGroups[destKey]) {
                destinationGroups[destKey] = [];
              }
              destinationGroups[destKey].push(cut);
            }

            const groupKeys = Object.keys(destinationGroups);
            if (groupKeys.length > 1) {
              // The box is split! Force a name change with suffix -A, -B, etc.
              groupKeys.forEach((gKey, idx) => {
                const suffix = String.fromCharCode(65 + idx); // A, B, C...
                const splitBoxName = `${boxName}-${suffix}`;
                for (const cut of destinationGroups[gKey]) {
                  newBoxNamesMap.set(cut.id, splitBoxName);
                }
              });
            }
          }

          // STEP 2 & 3: UPDATE OFF SITE TABLE AND CONVERT STAGING ITEMS TO ON SITE INVENTORY
          for (let e of nextState.offSiteEntries) {
            // Apply new box name if it was split
            if (newBoxNamesMap.has(e.id)) {
              e = { ...e, box: newBoxNamesMap.get(e.id)! };
            }

            if (movesMap.has(e.id)) {
              const destId = movesMap.get(e.id) as string;
              const dest = order.targetDestinations?.find(d => d.id === destId);

              // A) Remove from inventory?
              if (dest && removeFromInventoryDestIds.includes(dest.id)) {
                const histDesc = `Removed "${e.serial || ''} ${e.cuts || ''}" from offsite inventory after delivery to "${dest.locationName}".`;
                const history = newHistoryEntry(histDesc, 'offsite-removal');
                nextState.history = addHistory(nextState, history);
                nextOffSiteEntries.push({ ...e, archived: true, currentLocation: undefined, moveTo: '' });
                continue;
              }

              // B) Move to staging?
              const loc = dest ? nextState.locations?.find((l: any) => l.id === dest.locationId) : null;
              const isHomeLoc = !!(loc && loc.isHome);

              if (moveToStaging && isHomeLoc) {
                const boxName = e.box ? `Box ${e.box.trim()}` : (e.currentLocation ? `Staging Pallet ${e.currentLocation.trim()}` : 'Staging Box');

                let container = nextState.containers?.find(c => !c.freezerId && c.name.trim().toLowerCase() === boxName.trim().toLowerCase());
                if (!container) {
                  container = {
                    id: 'container-' + crypto.randomUUID(),
                    name: boxName.trim(),
                    freezerId: undefined,
                    deleteOnEmpty: true,
                    icon: 'package'
                  };
                  nextState.containers = [...(nextState.containers || []), container];
                }

                let prod = e.productId ? nextState.products?.find(p => p.id === e.productId) : null;
                if (!prod) {
                  const cutsStr = e.cuts || '';
                  let itemNumber = '';
                  let namePart = cutsStr;
                  const match = cutsStr.match(/^(\d+)\s+(.*)$/);
                  if (match) {
                    itemNumber = match[1];
                    namePart = match[2];
                  }

                  prod = nextState.products?.find(p => 
                    (itemNumber && p.productNumbers?.includes(itemNumber)) || 
                    p.name.toLowerCase() === namePart.toLowerCase() ||
                    p.name.toLowerCase() === cutsStr.toLowerCase()
                  );
                }
                if (!prod) {
                  const cutsStr = e.cuts || '';
                  let itemNumber = '';
                  let namePart = cutsStr;
                  const match = cutsStr.match(/^(\d+)\s+(.*)$/);
                  if (match) {
                    itemNumber = match[1];
                    namePart = match[2];
                  }

                  const fallbackId = 'prod-' + crypto.randomUUID();
                  prod = {
                    id: fallbackId,
                    name: namePart || cutsStr || 'Unmapped Offsite Cut',
                    primaryCategory: 'Off-Site',
                    subCategory: 'Unmapped',
                    productNumbers: itemNumber ? [itemNumber] : [],
                    barcode: generateDefaultUpcABarcode(itemNumber) || undefined
                  };
                  nextState.products = [...(nextState.products || []), prod];
                }

                const wrongLabelVal = (e.wrongLabel && typeof e.wrongLabel === 'string' && e.wrongLabel.trim()) ? e.wrongLabel.trim() : undefined;
                const isActuallyWrongLabel = Boolean(wrongLabelVal);

                const existingCut = nextState.meatCuts?.find(mc => mc.containerId === container.id && isSameVariant(mc, prod.id, e.notes, e.tagIds, e.originalCutName, wrongLabelVal));
                const piecesCount = e.pieces || 1;

                if (existingCut) {
                  existingCut.quantity += piecesCount;
                  if (isActuallyWrongLabel && !existingCut.wrongLabel) {
                    existingCut.wrongLabel = wrongLabelVal;
                    existingCut.isWrongLabel = true;
                  }
                  if (e.originalCutName && !existingCut.originalCutName) {
                    existingCut.originalCutName = e.originalCutName;
                  }
                  const histDesc = `Added ${piecesCount}x "${prod.name}" via Staging transition (from offsite movement order: ${order.name}), new total ${existingCut.quantity}.`;
                  const history = newHistoryEntry(histDesc, existingCut.id);
                  nextState.history = addHistory(nextState, history);
                } else {
                  const tagIds = e.tagIds || [];
                  const newMeatCut: any = {
                    id: crypto.randomUUID(),
                    productId: prod.id,
                    quantity: piecesCount,
                    containerId: container.id,
                    notes: e.notes || '',
                    tagIds: tagIds,
                    originalCutName: e.originalCutName || undefined,
                    wrongLabel: wrongLabelVal,
                    isWrongLabel: isActuallyWrongLabel ? true : undefined,
                    serial: e.serial || undefined,
                    packDate: e.packDate || undefined,
                    weight: e.netWeight || undefined
                  };
                  nextState.meatCuts = [...(nextState.meatCuts || []), newMeatCut];
                  const histDesc = `Staged ${piecesCount}x "${prod.name}" in "${container.name}" via offsite movement order "${order.name}".`;
                  const history = newHistoryEntry(histDesc, newMeatCut.id);
                  nextState.history = addHistory(nextState, history);
                }
                nextOffSiteEntries.push({ ...e, archived: true, currentLocation: undefined, moveTo: '' });
                continue;
              }

              // C) Standard offsite move
              if (dest) {
                // Find target location and derive target pallet name
                const targetPalletName = dest.palletName ? dest.palletName.trim() : (loc ? (loc.hasPallets ? 'Unassigned' : `${loc.name} - Unpalletized`) : destId);
                
                // Create or update target pallet
                let palletObj = nextState.pallets?.find(p => p.id === targetPalletName || p.name === targetPalletName);
                if (!palletObj) {
                  palletObj = {
                    id: targetPalletName,
                    name: targetPalletName,
                    storageLocationId: dest.locationId,
                    isArchived: false
                  };
                  nextState.pallets = [...(nextState.pallets || []), palletObj];
                } else {
                  palletObj.storageLocationId = dest.locationId;
                  palletObj.isArchived = false;
                }

                // Ensure corresponding on-site freezer is unarchived
                const palletFreezerId = 'pallet-' + targetPalletName.replace(/\s+/g, '-').toLowerCase();
                const freezerObj = nextState.freezers?.find(f => f.id === palletFreezerId);
                if (freezerObj) {
                  (freezerObj as any).isArchived = false;
                }

                // Create or update box with its new pallet relation
                if (e.box && e.box.trim()) {
                  const boxNameStr = e.box.trim();
                  let boxObj = nextState.boxes?.find((b: any) => b.id === boxNameStr || b.name === boxNameStr);
                  if (!boxObj) {
                    boxObj = {
                      id: boxNameStr,
                      name: boxNameStr,
                      palletId: targetPalletName,
                      isArchived: false
                    };
                    nextState.boxes = [...(nextState.boxes || []), boxObj];
                  } else {
                    boxObj.palletId = targetPalletName;
                    boxObj.isArchived = false;
                  }

                  // Unarchive matching container
                  const boxId = 'box-' + boxNameStr.replace(/\s+/g, '-').toLowerCase();
                  const containerObj = nextState.containers?.find(c => c.id === boxId);
                  if (containerObj) {
                    containerObj.isArchived = false;
                  }
                }

                nextOffSiteEntries.push({ 
                  ...e, 
                  currentLocation: targetPalletName,
                  pallet: targetPalletName,
                  storageLocationId: dest.locationId,
                  location: dest.locationName,
                  moveTo: '',
                  archived: false
                });
              } else {
                nextOffSiteEntries.push({ 
                  ...e, 
                  currentLocation: destId, 
                  pallet: destId,
                  moveTo: '',
                  archived: false
                });
              }
            } else {
              nextOffSiteEntries.push(e);
            }
          }

          nextState.offSiteEntries = nextOffSiteEntries;

          // STEP 4: RETROACTIVE SANITY CHECK & EXPLICIT UNARCHIVING OF ITEMS NOT DESIGNATED FOR REMOVAL/STAGING
          // For all off-site entries, if they should be active, make absolutely sure their box, container, and pallet are unarchived too.
          for (const e of nextState.offSiteEntries) {
            const isMoved = movesMap.has(e.id);
            if (isMoved) {
              const destId = movesMap.get(e.id);
              const dest = order.targetDestinations?.find(d => d.id === destId);
              
              const isRemoved = !!(dest && removeFromInventoryDestIds.includes(dest.id));
              const loc = dest ? nextState.locations?.find((l: any) => l.id === dest.locationId) : null;
              const isStaged = !!(moveToStaging && loc && loc.isHome);

              if (!isRemoved && !isStaged) {
                e.archived = false;

                const targetPalletName = dest && dest.palletName ? dest.palletName.trim() : (loc ? (loc.hasPallets ? 'Unassigned' : `${loc.name} - Unpalletized`) : undefined);
                if (targetPalletName) {
                  e.currentLocation = targetPalletName;
                  e.pallet = targetPalletName;
                }
                if (dest) {
                  e.storageLocationId = dest.locationId;
                  e.location = dest.locationName;
                }

                // Ensure the box and container is unarchived
                if (e.box && e.box.trim()) {
                  const boxNameStr = e.box.trim();
                  let boxObj = nextState.boxes?.find((b: any) => b.id === boxNameStr || b.name === boxNameStr);
                  if (boxObj) {
                    boxObj.isArchived = false;
                    if (targetPalletName) {
                      boxObj.palletId = targetPalletName;
                    }
                  }

                  const boxId = 'box-' + boxNameStr.replace(/\s+/g, '-').toLowerCase();
                  const containerObj = nextState.containers?.find(c => c.id === boxId);
                  if (containerObj) {
                    containerObj.isArchived = false;
                  }
                }

                // Ensure the pallet and freezer is unarchived
                if (targetPalletName) {
                  const palletObj = nextState.pallets?.find((p: any) => p.id === targetPalletName || p.name === targetPalletName);
                  if (palletObj) {
                    palletObj.isArchived = false;
                    if (dest) {
                      palletObj.storageLocationId = dest.locationId;
                    }
                  }

                  const palletFreezerId = 'pallet-' + targetPalletName.replace(/\s+/g, '-').toLowerCase();
                  const freezerObj = nextState.freezers?.find(f => f.id === palletFreezerId);
                  if (freezerObj) {
                    (freezerObj as any).isArchived = false;
                  }
                }
              }
            }
          }

          order.status = 'completed';
          order.executedAt = new Date().toISOString();
          nextState.movementOrders = orders.map(o => o.id === order.id ? order : o);
        }
        break;
      }
      case 'REVERT_MOVEMENT_ORDER': {
        const orders = nextState.movementOrders || [];
        const order = orders.find(o => o.id === action.payload.id);
        if (order && order.status === 'completed' && nextState.offSiteEntries) {
          const originalBoxNames = new Set<string>();

          if (order.originalEntries && order.originalEntries.length > 0) {
            const { originalEntries } = order;

            for (const oe of originalEntries) {
              const b = (oe.box || '').trim();
              if (b) {
                originalBoxNames.add(b);
              }
            }

            for (const e of originalEntries) {
              const move = order.moves.find(m => m.entryId === e.id);
              if (move) {
                const destId = move.actualLocation || move.targetLocation;
                const dest = order.targetDestinations?.find(d => d.id === destId);
                const loc = dest ? nextState.locations?.find((l: any) => l.id === dest.locationId) : null;
                const isHomeLoc = !!(loc && loc.isHome);

                if (isHomeLoc) {
                  // Check if the box name was suffix-split or original
                  let boxName = e.box ? `Box ${e.box.trim()}` : (e.currentLocation ? `Staging Pallet ${e.currentLocation.trim()}` : 'Staging Box');
                  
                  // Also support checking the suffix container if it was split
                  let container = nextState.containers?.find(c => !c.freezerId && c.name.trim().toLowerCase() === boxName.trim().toLowerCase());
                  if (!container && e.box) {
                    // Try to find container matching any split suffix (e.g., Box 24-A, Box 24-B, etc.)
                    const searchPattern = `box ${e.box.trim()}-`;
                    container = nextState.containers?.find(c => !c.freezerId && c.name.trim().toLowerCase().startsWith(searchPattern));
                  }

                  if (container) {
                    const cutsStr = e.cuts || '';
                    let itemNumber = '';
                    let namePart = cutsStr;
                    const match = cutsStr.match(/^(\d+)\s+(.*)$/);
                    if (match) {
                      itemNumber = match[1];
                      namePart = match[2];
                    }
                    const prod = nextState.products?.find(p => 
                      (itemNumber && p.productNumbers?.includes(itemNumber)) || 
                      p.name.toLowerCase() === namePart.toLowerCase() ||
                      p.name.toLowerCase() === cutsStr.toLowerCase()
                    );
                    if (prod) {
                      const wrongLabelVal = (e.wrongLabel && typeof e.wrongLabel === 'string' && e.wrongLabel.trim()) ? e.wrongLabel.trim() : undefined;
                      const existingCut = nextState.meatCuts?.find(mc => mc.containerId === container.id && isSameVariant(mc, prod.id, e.notes, e.tagIds, e.originalCutName, wrongLabelVal));
                      if (existingCut) {
                        existingCut.quantity -= e.pieces || 1;
                        if (existingCut.quantity <= 0) {
                          nextState.meatCuts = nextState.meatCuts.filter(mc => mc.id !== existingCut.id);
                        }
                      }
                    }
                    const isContainerEmpty = !nextState.meatCuts.some(mc => mc.containerId === container.id);
                    if (isContainerEmpty && container.deleteOnEmpty) {
                      nextState.containers = nextState.containers.filter(c => c.id !== container.id);
                    }
                  }
                }
              }

              if (!nextState.offSiteEntries.some(oe => oe.id === e.id)) {
                nextState.offSiteEntries.push(e);
              }
            }
          }

          nextState.offSiteEntries = nextState.offSiteEntries.map(e => {
            const move = order.moves.find(m => m.entryId === e.id);
            const currentBox = (e.box || '').trim();
            let restoredBox = e.box;

            if (currentBox) {
              for (const origBox of originalBoxNames) {
                if (currentBox === origBox || currentBox.startsWith(origBox + '-')) {
                  restoredBox = origBox;
                  break;
                }
              }
            }

            if (move && move.originalLocation !== undefined) {
              const origEntry = order.originalEntries?.find(oe => oe.id === e.id);
              
              // Relational Revert: restore original box and pallet relations
              if (restoredBox && restoredBox.trim()) {
                const boxNameStr = restoredBox.trim();
                const originalPalletName = (origEntry?.pallet || origEntry?.currentLocation || '').trim();
                
                if (originalPalletName) {
                  let boxObj = nextState.boxes?.find((b: any) => b.id === boxNameStr || b.name === boxNameStr);
                  if (boxObj) {
                    boxObj.palletId = originalPalletName;
                    boxObj.isArchived = false;
                  }
                  
                  // Restore original pallet location if possible
                  if (origEntry?.storageLocationId) {
                    let palletObj = nextState.pallets?.find(p => p.id === originalPalletName || p.name === originalPalletName);
                    if (palletObj) {
                      palletObj.storageLocationId = origEntry.storageLocationId;
                      palletObj.isArchived = false;
                    }
                  }
                }
              }

              return {
                ...e,
                box: restoredBox,
                currentLocation: origEntry ? origEntry.currentLocation : e.currentLocation,
                pallet: origEntry ? origEntry.pallet : e.pallet,
                storageLocationId: origEntry ? origEntry.storageLocationId : e.storageLocationId,
                location: origEntry ? origEntry.location : e.location,
                moveTo: '',
                archived: origEntry ? !!origEntry.archived : false
              };
            }

            if (restoredBox !== e.box) {
              return { ...e, box: restoredBox };
            }
            return e;
          });

          order.status = 'finalized';
          delete order.executedAt;
          delete order.originalEntries;
          order.moves = order.moves.map(m => {
            const { originalLocation, originalCurrentLocation, ...rest } = m;
            return rest;
          });
          nextState.movementOrders = orders.map(o => o.id === order.id ? order : o);
        }
        break;
      }

      case 'CLEAR_OFFSITE_ENTRIES': {
        nextState.offSiteEntries = [];
        break;
      }
      case 'ADD_CUSTOM_LIST': {
        const { name, description, allowNotes, isInventoryControlled, controlType, controlCondition, notificationEnabled, notificationType } = action.payload;
        const listId = 'custom-list-' + crypto.randomUUID();
        const lists = nextState.customLists || [];
        const newList = {
          id: listId,
          name: name.trim(),
          description: description ? description.trim() : '',
          allowNotes,
          isInventoryControlled,
          controlType: isInventoryControlled ? (controlType || 'prompt') : undefined,
          controlCondition: isInventoryControlled ? (controlCondition || 'min') : undefined,
          notificationEnabled: !!notificationEnabled,
          notificationType: notificationType || 'all_items',
          lastNotifiedAt: null,
          items: []
        };
        nextState.customLists = [...lists, newList];
        break;
      }
      case 'EDIT_CUSTOM_LIST': {
        const { listId, updates } = action.payload;
        const lists = nextState.customLists || [];
        nextState.customLists = lists.map(cl => cl.id === listId ? { ...cl, ...updates } : cl);
        break;
      }
      case 'DELETE_CUSTOM_LIST': {
        const { listId } = action.payload;
        nextState.customLists = (nextState.customLists || []).filter(cl => cl.id !== listId);
        nextState.products = nextState.products.map(p => {
          if (p.listThresholds && p.listThresholds[listId] !== undefined) {
            const copy = { ...p.listThresholds };
            delete copy[listId];
            return { ...p, listThresholds: copy };
          }
          return p;
        });
        break;
      }
      case 'TOGGLE_PRODUCT_ON_LIST': {
        const { listId, productId, notes, forceState, controlSource, threshold } = action.payload;
        const lists = nextState.customLists || [];
        nextState.customLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          const exists = cl.items.some(item => item.productId === productId);
          const shouldHave = forceState !== undefined ? forceState : !exists;
          
          let nextItems = [...cl.items];
          if (shouldHave) {
            if (!exists) {
              const prod = nextState.products?.find(p => p.id === productId);
              const defaultThreshold = prod?.listThresholds?.[listId];
              const defaultCS = prod?.listControlSources?.[listId] || 'onsite_count';
              nextItems.push({
                productId,
                notes: notes || '',
                addedAt: new Date().toISOString(),
                controlSource: controlSource || defaultCS,
                threshold: threshold !== undefined ? threshold : defaultThreshold
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

        if (threshold !== undefined) {
          nextState.products = (nextState.products || []).map(p => {
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
        break;
      }
      case 'BATCH_TOGGLE_PRODUCTS_ON_LIST': {
        const { updates } = action.payload;
        for (const update of updates) {
          const { listId, productId, notes, forceState, controlSource, threshold } = update;
          const lists = nextState.customLists || [];
          nextState.customLists = lists.map(cl => {
            if (cl.id !== listId) return cl;
            const exists = cl.items.some(item => item.productId === productId);
            const shouldHave = forceState !== undefined ? forceState : !exists;
            
            let nextItems = [...cl.items];
            if (shouldHave) {
              if (!exists) {
                const prod = nextState.products?.find(p => p.id === productId);
                const defaultThreshold = prod?.listThresholds?.[listId];
                const defaultCS = prod?.listControlSources?.[listId] || 'onsite_count';
                nextItems.push({
                  productId,
                  notes: notes || '',
                  addedAt: new Date().toISOString(),
                  controlSource: controlSource || defaultCS,
                  threshold: threshold !== undefined ? threshold : defaultThreshold
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

          if (threshold !== undefined) {
            nextState.products = (nextState.products || []).map(p => {
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
        break;
      }
      case 'UPDATE_LIST_ITEM_CONTROL_SOURCE': {
        const { listId, productId, controlSource } = action.payload;
        const lists = nextState.customLists || [];
        nextState.customLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          return {
            ...cl,
            items: cl.items.map(item => item.productId === productId ? { ...item, controlSource } : item)
          };
        });
        break;
      }
      case 'UPDATE_LIST_ITEM_THRESHOLD': {
        const { listId, productId, threshold } = action.payload;
        const lists = nextState.customLists || [];
        nextState.customLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          return {
            ...cl,
            items: cl.items.map(item => item.productId === productId ? {
              ...item,
              threshold: threshold !== null && threshold !== undefined ? threshold : undefined
            } : item)
          };
        });
        nextState.products = (nextState.products || []).map(p => {
          if (p.id !== productId) return p;
          const copy = { ...(p.listThresholds || {}) };
          if (threshold === null || threshold === undefined) {
            delete copy[listId];
          } else {
            copy[listId] = threshold;
          }
          return { ...p, listThresholds: copy };
        });
        break;
      }
      case 'UPDATE_LIST_ITEM_NOTE': {
        const { listId, productId, notes } = action.payload;
        const lists = nextState.customLists || [];
        nextState.customLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          return {
            ...cl,
            items: cl.items.map(item => item.productId === productId ? { ...item, notes } : item)
          };
        });
        break;
      }
      case 'TOGGLE_LIST_ITEM_NOTIFICATION': {
        const { listId, productId, notifyEnabled } = action.payload;
        const lists = nextState.customLists || [];
        nextState.customLists = lists.map(cl => {
          if (cl.id !== listId) return cl;
          return {
            ...cl,
            items: cl.items.map(item => item.productId === productId ? { ...item, notifyEnabled: !!notifyEnabled } : item)
          };
        });
        break;
      }
      case 'ADD_LOCATION': {
        const { id, name, address, contact, notes, isHome, type } = action.payload;
        const locs = nextState.locations || [];
        const isCurrentlyHome = !!isHome;
        const newLoc = {
          id: id || ('loc-' + crypto.randomUUID()),
          name: name.trim(),
          address: address ? address.trim() : '',
          contact: contact ? contact.trim() : '',
          notes: notes ? notes.trim() : '',
          isHome: isCurrentlyHome,
          type,
          hasPallets: true
        };
        let updatedLocs = [...locs];
        if (isCurrentlyHome) {
          updatedLocs = updatedLocs.map(l => ({ ...l, isHome: false }));
        }
        nextState.locations = [...updatedLocs, newLoc];
        const auditDesc = `Location "${newLoc.name}" was created.`;
        nextState.history = addHistory(nextState, newHistoryEntry(auditDesc, newLoc.id));
        break;
      }
      case 'EDIT_LOCATION': {
        const { locationId, updates } = action.payload;
        const locs = nextState.locations || [];
        let updatedLocs = [...locs];
        if (updates.isHome) {
          updatedLocs = updatedLocs.map(l => ({ ...l, isHome: false }));
        }
        const forcedUpdates = { ...updates, hasPallets: true };
        nextState.locations = updatedLocs.map(l => l.id === locationId ? { ...l, ...forcedUpdates } : l);
        const editedLocName = locs.find(l => l.id === locationId)?.name || 'Unknown Location';
        const auditDesc = `Location "${editedLocName}" was updated.`;
        nextState.history = addHistory(nextState, locationId ? newHistoryEntry(auditDesc, locationId) : { id: crypto.randomUUID(), timestamp: new Date().toISOString(), description: auditDesc, targetId: 'location' });
        break;
      }
      case 'DELETE_LOCATION': {
        const { locationId } = action.payload;
        const locs = nextState.locations || [];
        const deletedLocName = locs.find(l => l.id === locationId)?.name || 'Unknown Location';
        nextState.locations = locs.filter(l => l.id !== locationId);
        const auditDesc = `Location "${deletedLocName}" was permanently deleted.`;
        nextState.history = addHistory(nextState, locationId ? newHistoryEntry(auditDesc, locationId) : { id: crypto.randomUUID(), timestamp: new Date().toISOString(), description: auditDesc, targetId: 'location' });
        break;
      }
      case 'SET_HOME_LOCATION': {
        const { locationId } = action.payload;
        const locs = nextState.locations || [];
        const newHomeLocName = locs.find(l => l.id === locationId)?.name || 'Unknown';
        nextState.locations = locs.map(l => ({
          ...l,
          isHome: l.id === locationId
        }));
        const auditDesc = `Location "${newHomeLocName}" is now set as the primary Home/On-Site location.`;
        nextState.history = addHistory(nextState, locationId ? newHistoryEntry(auditDesc, locationId) : { id: crypto.randomUUID(), timestamp: new Date().toISOString(), description: auditDesc, targetId: 'location' });
        break;
      }
      case 'REPLACE_STATE': {
        nextState = { ...action.payload };
        break;
      }
      case 'PURGE_HISTORY': {
        const { olderThanDays, keepMax, clearAll } = action.payload || {};
        const initialCount = (nextState.history || []).length;
        if (clearAll) {
          nextState.history = [
            {
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              description: `Cleared all ${initialCount} historical audit entries.`,
              targetId: 'history-maintenance',
              user: String(ingressUser)
            }
          ];
        } else if (typeof olderThanDays === 'number' && olderThanDays > 0) {
          const cutoff = Date.now() - (olderThanDays * 86400 * 1000);
          const kept = (nextState.history || []).filter(h => {
            const t = new Date(h.timestamp).getTime();
            return !isNaN(t) && t >= cutoff;
          });
          const removed = initialCount - kept.length;
          const auditEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            description: `Purged ${removed} audit entries older than ${olderThanDays} days (${kept.length} entries remaining).`,
            targetId: 'history-maintenance',
            user: String(ingressUser)
          };
          nextState.history = [auditEntry, ...kept];
        } else if (typeof keepMax === 'number' && keepMax > 0) {
          const sorted = [...(nextState.history || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          const trimmed = sorted.slice(0, keepMax);
          const removed = initialCount - trimmed.length;
          const auditEntry = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            description: `Purged ${removed} older audit entries (retained top ${keepMax} most recent entries).`,
            targetId: 'history-maintenance',
            user: String(ingressUser)
          };
          nextState.history = [auditEntry, ...trimmed];
        }
        break;
      }
      default:
        return res.status(400).json({ error: 'Unsupported action type.' });
    }

    // Save state back to active storage (MySQL or local fallback)
    await saveState(nextState);

    // Broadcast change to other active restockers in real-time
    notifyInventoryUpdate();

    // Return the updated state loaded fresh from database to ensure absolute consistency
    const finalState = await loadState();
    res.json(finalState);

  } catch (err: any) {
    console.error('Error applying inventory action backend:', err);
    res.status(500).json({
      error: 'Failed to process inventory action.',
      details: err.message || String(err),
      message: `Failed to process inventory action: ${err.message || String(err)}`
    });
  }
});

// ---------------- PHOTO MANAGER ENDPOINTS ----------------

app.get('/api/photos', async (req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json([]);
    }
    const state = await loadState();
    const files = fs.readdirSync(UPLOADS_DIR);
    const photos = files
      .map(f => {
        const fullPath = path.join(UPLOADS_DIR, f);
        if (!fs.existsSync(fullPath)) return null;
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) return null;

        const urlPath = `uploads/${f}`;
        const lowUrlPath = urlPath.toLowerCase();
        const lowF = f.toLowerCase();

        const attachments: any[] = [];
        
        // Find attached products
        (state.products || []).forEach(p => {
          if (p.imageUrl) {
            const lowImg = p.imageUrl.toLowerCase();
            if (lowImg === lowUrlPath || lowImg === lowF || lowImg.endsWith('/' + lowF) || lowImg.endsWith('\\' + lowF)) {
              attachments.push({ id: p.id, name: p.name, type: 'product' });
            }
          }
        });

        // Find attached containers
        (state.containers || []).forEach(c => {
          if (c.imageUrl) {
            const lowImg = c.imageUrl.toLowerCase();
            if (lowImg === lowUrlPath || lowImg === lowF || lowImg.endsWith('/' + lowF) || lowImg.endsWith('\\' + lowF)) {
              attachments.push({ id: c.id, name: c.name, type: 'container' });
            }
          }
        });

        return {
          filename: f,
          url: urlPath,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          attachments
        };
      })
      .filter(Boolean);

    res.json(photos);
  } catch (err: any) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ error: 'Failed to retrieve photos' });
  }
});

app.post('/api/photos/delete-bulk', async (req, res) => {
  try {
    const { filenames } = req.body;
    if (!filenames || !Array.isArray(filenames)) {
      return res.status(400).json({ error: 'filenames array is required.' });
    }

    const state = await loadState();
    let dbChanged = false;

    filenames.forEach(f => {
      // Basic sanitization to prevent directory traversal
      if (f.includes('..') || f.includes('/') || f.includes('\\')) {
        return;
      }

      const filePath = path.join(UPLOADS_DIR, f);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error(`Failed to delete file from disk: ${f}`, e);
        }
      }

      const urlPath = `uploads/${f}`;
      const lowUrlPath = urlPath.toLowerCase();
      const lowF = f.toLowerCase();

      // Clear product references
      (state.products || []).forEach(p => {
        if (p.imageUrl) {
          const lowImg = p.imageUrl.toLowerCase();
          if (lowImg === lowUrlPath || lowImg === lowF || lowImg.endsWith('/' + lowF) || lowImg.endsWith('\\' + lowF)) {
            p.imageUrl = undefined;
            dbChanged = true;
          }
        }
      });

      // Clear container references
      (state.containers || []).forEach(c => {
        if (c.imageUrl) {
          const lowImg = c.imageUrl.toLowerCase();
          if (lowImg === lowUrlPath || lowImg === lowF || lowImg.endsWith('/' + lowF) || lowImg.endsWith('\\' + lowF)) {
            c.imageUrl = undefined;
            dbChanged = true;
          }
        }
      });
    });

    if (dbChanged) {
      await saveState(state);
      notifyInventoryUpdate();
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting photos bulk:', err);
    res.status(500).json({ error: 'Failed to delete photos bulk.' });
  }
});

app.post('/api/photos/deduplicate', async (req, res) => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      return res.json({ merged: 0, savedBytes: 0 });
    }

    const state = await loadState();
    const files = fs.readdirSync(UPLOADS_DIR);
    
    // Group files by hash
    const groupsByHash: { [hash: string]: Array<{ filename: string; path: string; size: number }> } = {};

    files.forEach(f => {
      const fullPath = path.join(UPLOADS_DIR, f);
      if (!fs.existsSync(fullPath)) return;
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) return;

      try {
        const fileBuffer = fs.readFileSync(fullPath);
        const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
        if (!groupsByHash[hash]) {
          groupsByHash[hash] = [];
        }
        groupsByHash[hash].push({ filename: f, path: fullPath, size: stat.size });
      } catch (e) {
        console.error(`Failed to calculate hash for ${f}:`, e);
      }
    });

    let mergedCount = 0;
    let savedBytes = 0;
    let dbChanged = false;

    // Process groups with duplicates
    for (const hash of Object.keys(groupsByHash)) {
      const group = groupsByHash[hash];
      if (group.length <= 1) continue;

      // Canonical file is the first one
      const canonical = group[0];
      const canonicalUrl = `uploads/${canonical.filename}`;

      for (let i = 1; i < group.length; i++) {
        const dupe = group[i];
        const dupeUrl = `uploads/${dupe.filename}`;
        const lowDupeUrl = dupeUrl.toLowerCase();
        const lowDupeF = dupe.filename.toLowerCase();

        // Update all products referencing the duplicate
        (state.products || []).forEach(p => {
          if (p.imageUrl) {
            const lowImg = p.imageUrl.toLowerCase();
            if (lowImg === lowDupeUrl || lowImg === lowDupeF || lowImg.endsWith('/' + lowDupeF) || lowImg.endsWith('\\' + lowDupeF)) {
              p.imageUrl = canonicalUrl;
              dbChanged = true;
            }
          }
        });

        // Update all containers referencing the duplicate
        (state.containers || []).forEach(c => {
          if (c.imageUrl) {
            const lowImg = c.imageUrl.toLowerCase();
            if (lowImg === lowDupeUrl || lowImg === lowDupeF || lowImg.endsWith('/' + lowDupeF) || lowImg.endsWith('\\' + lowDupeF)) {
              c.imageUrl = canonicalUrl;
              dbChanged = true;
            }
          }
        });

        // Delete duplicate file from disk
        try {
          if (fs.existsSync(dupe.path)) {
            fs.unlinkSync(dupe.path);
          }
          mergedCount++;
          savedBytes += dupe.size;
        } catch (e) {
          console.error(`Failed to delete duplicate file ${dupe.filename}:`, e);
        }
      }
    }

    if (dbChanged) {
      await saveState(state);
      notifyInventoryUpdate();
    }

    res.json({ success: true, merged: mergedCount, savedBytes });
  } catch (err: any) {
    console.error('Deduplication failed:', err);
    res.status(500).json({ error: 'Failed to deduplicate photos.' });
  }
});

app.post('/api/photos/assign', async (req, res) => {
  try {
    const { imageUrl, targetId, targetType } = req.body;
    if (!targetId || !targetType) {
      return res.status(400).json({ error: 'targetId and targetType are required.' });
    }

    const state = await loadState();
    let found = false;

    if (targetType === 'product') {
      const p = (state.products || []).find(p => p.id === targetId);
      if (p) {
        p.imageUrl = imageUrl || undefined;
        found = true;
      }
    } else if (targetType === 'container') {
      const c = (state.containers || []).find(c => c.id === targetId);
      if (c) {
        c.imageUrl = imageUrl || undefined;
        found = true;
      }
    }

    if (!found) {
      return res.status(404).json({ error: `Target ${targetType} with ID ${targetId} not found.` });
    }

    await saveState(state);
    notifyInventoryUpdate();

    res.json({ success: true });
  } catch (err: any) {
    console.error('Failed to assign photo:', err);
    res.status(500).json({ error: 'Failed to assign photo.' });
  }
});


// ---------------- HOSTING SETUP & SERVER START ----------------

async function startServer() {
  // Vite development integration when not running in production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const appDir = path.join(process.cwd(), 'freezer_inventory_tracker');
    const finalRoot = fs.existsSync(appDir) ? appDir : process.cwd();
    const vite = await createViteServer({
      root: finalRoot,
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.join(process.cwd(), 'dist');
    if (!fs.existsSync(distPath)) {
      distPath = path.join(process.cwd(), 'freezer_inventory_tracker', 'dist');
    }
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Inventory tracker server is booted on port http://localhost:${PORT}`);
  });
}

startServer();
