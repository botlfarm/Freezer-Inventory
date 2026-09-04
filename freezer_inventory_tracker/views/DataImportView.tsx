import React, { useState, useMemo, useEffect } from 'react';
import { InventoryState, Action, Product, Container, MeatCut, Freezer } from '../types';
import { 
  Database, Upload, Download, FileText, CheckCircle2, AlertTriangle, 
  ArrowRight, Info, Library, Layers, Box, HelpCircle, RefreshCw, Sparkles, 
  X, Check, FolderOpen, Image as ImageIcon, Loader2, Play, Trash2, Eye, Settings,
  Globe, Clock
} from 'lucide-react';
import JSZip from 'jszip';
import { generateUUID } from '../components/uuidHelper';
import { getApiUrl } from '../hooks/apiUrl';

interface DataImportViewProps {
  state: InventoryState;
  dispatch: any; 
  onNavigateToView: (view: any) => void;
}

export function DataImportView({ state, dispatch, onNavigateToView }: DataImportViewProps) {
  const [activeTab, setActiveTab] = useState<'backup' | 'wipe'>('backup');
  
  const [onSiteBackups, setOnSiteBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [newSnapshotType, setNewSnapshotType] = useState<'sqlite' | 'zip'>('sqlite');
  const [backupSections, setBackupSections] = useState<string[]>(['full']);

  // Granular backup & restore configuration toggles
  const [selFreezers, setSelFreezers] = useState(true);
  const [selContainers, setSelContainers] = useState(true);
  const [selItems, setSelItems] = useState(true);
  const [selInventory, setSelInventory] = useState(true);
  const [selOffSite, setSelOffSite] = useState(true);
  const [selPics, setSelPics] = useState(true);
  const [selCustomLists, setSelCustomLists] = useState(true);
  const [selTags, setSelTags] = useState(true);
  const [selHistory, setSelHistory] = useState(true);
  const [exportingZip, setExportingZip] = useState(false);
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  // Dual-Schedule Rolling Automatic Snapshots Settings
  const [dbAutoEnabled, setDbAutoEnabled] = useState(true);
  const [dbAutoInterval, setDbAutoInterval] = useState(1);
  const [dbAutoMaxCount, setDbAutoMaxCount] = useState(7);
  const [dbBackupHour, setDbBackupHour] = useState(2);

  const [zipAutoEnabled, setZipAutoEnabled] = useState(true);
  const [zipAutoInterval, setZipAutoInterval] = useState(7);
  const [zipAutoMaxCount, setZipAutoMaxCount] = useState(2);

  const [backupTimezone, setBackupTimezone] = useState<string>(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  });
  const [serverLocalTime, setServerLocalTime] = useState<string>('');

  const [lastAutoSnapshot, setLastAutoSnapshot] = useState('');
  const [loadingAutoConfig, setLoadingAutoConfig] = useState(false);

  const fetchAutoConfig = async () => {
    setLoadingAutoConfig(true);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl('api/backups/config'), {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setDbAutoEnabled(data.dbRollingEnabled ?? data.rollingEnabled ?? true);
        setDbAutoInterval(data.dbRollingInterval ?? data.dbRollingIntervalDays ?? 1);
        setDbAutoMaxCount(data.dbRollingMaxCount ?? 7);
        setDbBackupHour(data.dbBackupHour ?? 2);

        setZipAutoEnabled(data.fullZipRollingEnabled ?? true);
        setZipAutoInterval(data.fullZipRollingInterval ?? data.fullZipRollingIntervalDays ?? 7);
        setZipAutoMaxCount(data.fullZipRollingMaxCount ?? 2);

        if (data.timezone || data.effectiveTimezone) {
          setBackupTimezone(data.timezone || data.effectiveTimezone);
        }
        if (data.currentLocalTime) {
          setServerLocalTime(data.currentLocalTime);
        }

        setLastAutoSnapshot(data.lastBackupTimestamp || '');
      }
    } catch (err) {
      console.error('Failed to get auto config:', err);
    } finally {
      setLoadingAutoConfig(false);
    }
  };

  const handleSaveAutoConfig = async () => {
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl('api/backups/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          dbRollingEnabled: dbAutoEnabled,
          dbRollingInterval: dbAutoInterval,
          dbRollingIntervalDays: dbAutoInterval,
          dbRollingMaxCount: dbAutoMaxCount,
          dbBackupHour: dbBackupHour,
          fullZipRollingEnabled: zipAutoEnabled,
          fullZipRollingInterval: zipAutoInterval,
          fullZipRollingIntervalDays: zipAutoInterval,
          fullZipRollingMaxCount: zipAutoMaxCount,
          timezone: backupTimezone
        })
      });
      if (res.ok) {
        const data = await res.json();
        setLastAutoSnapshot(data.lastBackupTimestamp || '');
        if (data.currentLocalTime) {
          setServerLocalTime(data.currentLocalTime);
        }
        showToastMessage('success', 'Rolling snapshot schedule parameters saved successfully!');
        loadOnSiteBackups();
      } else {
        showToastMessage('error', 'Failed to update auto-snapshot configs.');
      }
    } catch (err: any) {
      showToastMessage('error', `Error: ${err.message}`);
    }
  };

  const loadOnSiteBackups = async () => {
    setLoadingBackups(true);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl('api/backups'), {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setOnSiteBackups(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchPreview = async (filename: string) => {
    setLoadingPreview(filename);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl(`api/backups/preview/${filename}`), {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      } else {
        const errJson = await res.json();
        showToastMessage('error', errJson.error || 'Failed to fetch snapshot preview.');
      }
    } catch (err: any) {
      showToastMessage('error', `Preview error: ${err.message}`);
    } finally {
      setLoadingPreview(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'backup') {
      loadOnSiteBackups();
      fetchAutoConfig();
    }
  }, [activeTab]);

  const liveTotals = useMemo(() => {
    let onSiteSumQty = 0;
    let onSiteSumPieces = 0;
    let onSiteSumWeight = 0;
    (state.meatCuts || []).forEach((mc: any) => {
      if (mc.productId) {
        onSiteSumQty += Number(mc.quantity || 0);
      } else {
        onSiteSumPieces += Number(mc.pieces || 0);
        onSiteSumWeight += Number(mc.netWeight || 0);
      }
    });

    let offSiteSumPieces = 0;
    let offSiteSumWeight = 0;
    (state.offSiteEntries || []).forEach((e: any) => {
      offSiteSumPieces += parseFloat(String(e.pieces || 0).replace(/[^0-9.]/g, '')) || 0;
      offSiteSumWeight += parseFloat(String(e.netWeight || 0).replace(/[^0-9.]/g, '')) || 0;
    });

    return {
      freezers: (state.freezers || []).length,
      containers: (state.containers || []).length,
      products: (state.products || []).length,
      meatCuts: (state.meatCuts || []).length,
      offSiteEntries: (state.offSiteEntries || []).length,
      customLists: (state.customLists || []).length,
      tags: (state.tags || []).length,
      history: (state.history || []).length,
      butcherOrders: (state.butcherOrders || []).length,
      butcherRecords: (state.butcherRecords || []).length,
      onSiteSumQty,
      onSiteSumPieces,
      onSiteSumWeight,
      offSiteSumPieces,
      offSiteSumWeight
    };
  }, [state]);

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; label: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    title?: string;
    total: number;
    current: number;
    status: string;
    unit?: string;
  } | null>(null);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(blob);
    });
  };

  // Custom alert/confirm overlays
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm';
    onConfirm?: () => void;
  } | null>(null);

  const triggerAlert = (title: string, message: string) => {
    setModalState({ isOpen: true, title, message, type: 'alert' });
  };

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalState({ isOpen: true, title, message, type: 'confirm', onConfirm });
  };

  const showToastMessage = (type: 'success' | 'error', label: string) => {
    setStatusMessage({ type, label });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  // Bulk Wipe Database & Section Cleanups
  const handleWipeAllData = () => {
    triggerConfirm(
      "🔥 EXTREME WARNING: WIPE ENTIRE DATABASE",
      "Are you absolutely certain you want to completely erase ALL data? This will instantly delete all freezers, all containers (bags/boxes/bins), all product/meat list definitions, all stock counts, and history logs. This action is irreversible!",
      () => {
        const emptyState: InventoryState = {
          freezers: [],
          containers: [
            {
              id: 'staging_loose',
              name: 'Loose',
              deleteOnEmpty: false,
              icon: 'generic',
              freezerId: undefined
            }
          ],
          products: [],
          meatCuts: [],
          history: [{
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            description: "Database completely wiped and reset to a clean blank state.",
            targetId: 'db-wipe'
          }]
        };
        dispatch({ type: 'REPLACE_STATE', payload: emptyState }).then((success: boolean) => {
          if (success) {
            showToastMessage('success', "Database completely wiped back to start!");
            setTimeout(() => {
              onNavigateToView('freezer');
            }, 1500);
          } else {
            showToastMessage('error', "Failed contacting central server to execute database wipe.");
          }
        });
      }
    );
  };

  const handleBulkDeleteFreezers = () => {
    triggerConfirm(
      "Delete All Freezers",
      "Are you sure you want to delete all freezer cabinets? The custom containment bins inside them will be moved to the 'Unassigned' category. Freezer-only loose layers will be deleted and their loose contents safely moved to the staging Loose bag.",
      () => {
        let updatedCuts = [...state.meatCuts];
        const updatedContainers = state.containers
          .map(c => {
            if (c.id.endsWith('_loose') && c.id !== 'staging_loose') {
              updatedCuts = updatedCuts.map(cut => 
                cut.containerId === c.id ? { ...cut, containerId: 'staging_loose' } : cut
              );
              return null;
            }
            return { ...c, freezerId: undefined };
          })
          .filter(Boolean) as Container[];

        const nextState: InventoryState = {
          ...state,
          freezers: [],
          containers: updatedContainers,
          meatCuts: updatedCuts,
          history: [{
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            description: "Bulk deleted all freezer cabinets. Bins moved to Unassigned.",
            targetId: 'bulk-delete-freezers'
          }, ...state.history].slice(0, 100)
        };

        dispatch({ type: 'REPLACE_STATE', payload: nextState }).then((success: boolean) => {
          if (success) {
            showToastMessage('success', "All freezers deleted. Containers moved to Unassigned!");
          } else {
            showToastMessage('error', "Failed to execute server request.");
          }
        });
      }
    );
  };

  const handleBulkDeleteContainers = () => {
    triggerConfirm(
      "Delete All Containers & Bins",
      "Are you sure you want to delete all custom bags, boxes, bins, and custom placements? All active inventory inside these containers will be safely moved to flat, unassigned 'Loose' layers so you don't lose any inventory counts.",
      () => {
        const essentialContainers = state.containers.filter(c => c.id === 'staging_loose' || c.id.endsWith('_loose'));
        const updatedCuts = state.meatCuts.map(cut => {
          const originalContainer = state.containers.find(c => c.id === cut.containerId);
          if (originalContainer) {
            if (originalContainer.id === 'staging_loose' || originalContainer.id.endsWith('_loose')) {
              return cut;
            }
            const targetContId = originalContainer.freezerId ? `${originalContainer.freezerId}_loose` : 'staging_loose';
            return { ...cut, containerId: targetContId };
          }
          return { ...cut, containerId: 'staging_loose' };
        });

        const nextState: InventoryState = {
          ...state,
          containers: essentialContainers,
          meatCuts: updatedCuts,
          history: [{
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            description: "Bulk deleted all custom container structures. Active stock shifted to Loose stock.",
            targetId: 'bulk-delete-containers'
          }, ...state.history].slice(0, 100)
        };

        dispatch({ type: 'REPLACE_STATE', payload: nextState }).then((success: boolean) => {
          if (success) {
            showToastMessage('success', "All custom containers removed. Stock relocated to Loose layers!");
          } else {
            showToastMessage('error', "Failed to execute server request.");
          }
        });
      }
    );
  };

  const handleBulkDeleteProducts = () => {
    triggerConfirm(
      "Delete All Product Specifications",
      "Are you sure you want to delete all product definitions and catalog files? Since active count items require a product reference, this will also wipe out your entire stock count records!",
      () => {
        const nextState: InventoryState = {
          ...state,
          products: [],
          meatCuts: [],
          history: [{
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            description: "Bulk deleted all custom product specifications and wiped associated inventory counts.",
            targetId: 'bulk-delete-products'
          }, ...state.history].slice(0, 100)
        };

        dispatch({ type: 'REPLACE_STATE', payload: nextState }).then((success: boolean) => {
          if (success) {
            showToastMessage('success', "All product specs and inventory counts wiped!");
          } else {
            showToastMessage('error', "Failed to execute server request.");
          }
        });
      }
    );
  };

  const handleBulkClearInventory = () => {
    triggerConfirm(
      "Clear All Inventory Counts",
      "Are you sure you want to clear all active inventory counts? This will empty all meat stock records across all freezer cabinets and containers, resetting counts to 0, but keeping your physical layouts and product catalog intact.",
      () => {
        const nextState: InventoryState = {
          ...state,
          meatCuts: [],
          history: [{
            id: generateUUID(),
            timestamp: new Date().toISOString(),
            description: "Cleared all meat inventory count tallies across the system.",
            targetId: 'bulk-clear-inventory'
          }, ...state.history].slice(0, 100)
        };

        dispatch({ type: 'REPLACE_STATE', payload: nextState }).then((success: boolean) => {
          if (success) {
            showToastMessage('success', "Inventory counts cleared to blank!");
          } else {
            showToastMessage('error', "Failed to execute server request.");
          }
        });
      }
    );
  };

  // On-Site Backup Management
  const handleCreateOnSiteBackup = async () => {
    try {
      const activeSections: string[] = [];
      if (selFreezers) activeSections.push('freezers');
      if (selContainers) activeSections.push('containers');
      if (selItems) activeSections.push('catalog');
      if (selInventory) activeSections.push('inventory');
      if (selOffSite) activeSections.push('offsite');
      if (selCustomLists) activeSections.push('customLists');
      if (selTags) activeSections.push('tags');

      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl('api/backups/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: snapshotName,
          type: newSnapshotType,
          sections: activeSections
        })
      });
      if (res.ok) {
        setSnapshotName('');
        showToastMessage('success', `${newSnapshotType === 'zip' ? 'Full Package ZIP' : 'SQLite Database'} snapshot created successfully!`);
        loadOnSiteBackups();
      } else {
        showToastMessage('error', 'Failed to create internal snapshot.');
      }
    } catch (e: any) {
      showToastMessage('error', `Snapshot error: ${e.message}`);
    }
  };

  const handleStartLivePreviewMode = async (filename: string) => {
    if (typeof (window as any).__startPreviewMode === 'function') {
      await (window as any).__startPreviewMode(filename);
    } else {
      try {
        const res = await fetch(getApiUrl('api/backups/preview-mode/start'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        if (res.ok) {
          showToastMessage('success', `Live snapshot preview mode started for ${filename}. All views are now read-only.`);
        } else {
          const errData = await res.json().catch(() => ({}));
          showToastMessage('error', `Failed to start preview mode: ${errData.error || res.statusText}`);
        }
      } catch (err: any) {
        showToastMessage('error', `Network error starting preview mode: ${err.message}`);
      }
    }
  };

  const handleRestoreOnSiteBackup = (filename: string) => {
    triggerConfirm(
      "Restore Database Snapshot",
      `Are you sure you want to restore the snapshot: ${filename}? Depending on your selection, this could overwrite your active inventory.`,
      async () => {
        try {
          const activeSections: string[] = [];
          if (selFreezers) activeSections.push('freezers');
          if (selContainers) activeSections.push('containers');
          if (selItems) activeSections.push('catalog');
          if (selInventory) activeSections.push('inventory');
          if (selOffSite) activeSections.push('offsite');
          if (selPics) activeSections.push('images');
          if (selCustomLists) activeSections.push('customLists');
          if (selTags) activeSections.push('tags');
          if (selHistory) activeSections.push('history');

          if (activeSections.length === 0) {
            showToastMessage('error', 'Select at least one scope/section to restore!');
            return;
          }

          const token = localStorage.getItem('freezerToken');
          const res = await fetch(getApiUrl(`api/backups/restore/${filename}`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ sections: activeSections, restoreImages: selPics })
          });
          if (res.ok) {
            showToastMessage('success', 'Restored successfully. Refreshing...');
            setTimeout(() => window.location.reload(), 1500);
          } else {
            showToastMessage('error', 'Failed to restore snapshot.');
          }
        } catch (e: any) {
          showToastMessage('error', `Restore error: ${e.message}`);
        }
      }
    );
  };

  const handleDeleteOnSiteBackup = (filename: string) => {
    triggerConfirm(
      "Delete Snapshot",
      `Delete snapshot file: ${filename}? This cannot be undone.`,
      async () => {
        try {
          const token = localStorage.getItem('freezerToken');
          const res = await fetch(getApiUrl(`api/backups/${filename}`), {
            method: 'DELETE',
            headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
          });
          if (res.ok) {
            showToastMessage('success', 'Snapshot deleted.');
            loadOnSiteBackups();
          } else {
            showToastMessage('error', 'Failed to delete snapshot.');
          }
        } catch (e: any) {
          showToastMessage('error', `Delete error: ${e.message}`);
        }
      }
    );
  };

  const handleDownloadOnSiteBackup = async (filename: string) => {
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl(`api/backups/download/${filename}`), {
        method: 'GET',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToastMessage('success', `Snapshot download started!`);
      } else {
        showToastMessage('error', 'Failed to download snapshot.');
      }
    } catch (e: any) {
      showToastMessage('error', `Download error: ${e.message}`);
    }
  };

  const handleUploadAndRestoreBackup = async (file: File) => {
    if (!file) return;
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';

    if (isZip) {
      handleImportFileChange(file);
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['db'].includes(fileExt || '')) {
      showToastMessage('error', 'Only .db database and .zip archive files are supported for restore!');
      return;
    }

    triggerConfirm(
      'Confirm Database Restore',
      'Are you absolutely sure you want to replace your actively selected inventory database with this uploaded backup file (.db)? This will overwrite your active inventory.',
      async () => {
        setUploadProgress({ title: 'Restoring Database', total: 100, current: 10, status: 'Reading database file...', unit: '%' });
        try {
          const base64 = await blobToBase64(file);

          setUploadProgress({ title: 'Restoring Database', total: 100, current: 40, status: 'Uploading backup to server snapshot vault...', unit: '%' });
          const token = localStorage.getItem('freezerToken');
          const uploadRes = await fetch(getApiUrl('api/backups/upload'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ filename: file.name, base64 })
          });

          if (!uploadRes.ok) {
            const errJson = await uploadRes.json();
            throw new Error(errJson.error || 'Failed to upload backup to vault.');
          }

          const uploadReply = await uploadRes.json();
          const savedFilename = uploadReply.filename;

          setUploadProgress({ title: 'Restoring Database', total: 100, current: 75, status: 'Applying and restoring database snapshot...', unit: '%' });
          
          const activeSections: string[] = [];
          if (selFreezers) activeSections.push('freezers');
          if (selContainers) activeSections.push('containers');
          if (selItems) activeSections.push('catalog');
          if (selInventory) activeSections.push('inventory');
          if (selOffSite) activeSections.push('offsite');
          if (selPics) activeSections.push('images');
          if (selCustomLists) activeSections.push('customLists');
          if (selTags) activeSections.push('tags');
          if (selHistory) activeSections.push('history');

          if (activeSections.length === 0) {
            throw new Error('Select at least one scope/section to restore!');
          }

          const restoreRes = await fetch(getApiUrl(`api/backups/restore/${savedFilename}`), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ sections: activeSections, restoreImages: selPics })
          });

          if (restoreRes.ok) {
            setUploadProgress(null);
            showToastMessage('success', 'Backup file uploaded and restored successfully!');
            setTimeout(() => window.location.reload(), 1500);
          } else {
            const errJson = await restoreRes.json();
            throw new Error(errJson.error || 'Failed to restore uploaded backup.');
          }
        } catch (e: any) {
          setUploadProgress(null);
          showToastMessage('error', `Upload & Restore error: ${e.message}`);
        }
      }
    );
  };

  const handleUploadSnapshotOnly = async (file: File) => {
    if (!file) return;
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!['db', 'zip', 'json', 'csv'].includes(fileExt || '')) {
      showToastMessage('error', 'Only .db, .zip, .json, and .csv files can be uploaded as snapshots!');
      return;
    }

    try {
      const token = localStorage.getItem('freezerToken');
      const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunking for large files

      if (file.size <= CHUNK_SIZE) {
        setUploadProgress({ title: 'Uploading Snapshot', total: 100, current: 20, status: 'Reading snapshot file...', unit: '%' });
        const base64 = await blobToBase64(file);
        setUploadProgress({ title: 'Uploading Snapshot', total: 100, current: 70, status: 'Uploading to snapshot vault...', unit: '%' });

        const uploadRes = await fetch(getApiUrl('api/backups/upload'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ filename: file.name, base64 })
        });

        if (uploadRes.ok) {
          setUploadProgress(null);
          showToastMessage('success', 'Snapshot file uploaded and saved to Point-in-Time snapshots library!');
          loadOnSiteBackups();
        } else {
          const errJson = await uploadRes.json();
          throw new Error(errJson.error || 'Failed to upload snapshot file.');
        }
      } else {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        for (let c = 0; c < totalChunks; c++) {
          const start = c * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          const chunkBlob = file.slice(start, end);
          const chunkBase64 = await blobToBase64(chunkBlob);

          setUploadProgress({
            title: 'Uploading Snapshot to Vault',
            total: totalChunks,
            current: c + 1,
            status: `Uploading snapshot chunk ${c + 1} of ${totalChunks} (${Math.round(((c + 1) / totalChunks) * 100)}%)...`,
            unit: 'chunks'
          });

          const res = await fetch(getApiUrl('api/backups/upload-chunk'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              uploadId,
              chunkIndex: c,
              totalChunks,
              filename: file.name,
              base64: chunkBase64
            })
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error || `Chunk upload failed at part ${c + 1}`);
          }
        }

        setUploadProgress(null);
        showToastMessage('success', 'Snapshot file uploaded and saved to Point-in-Time snapshots library!');
        loadOnSiteBackups();
      }
    } catch (e: any) {
      setUploadProgress(null);
      showToastMessage('error', `Snapshot upload failed: ${e.message}`);
    }
  };

  const handleDownloadZipBackup = async () => {
    setExportingZip(true);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl('api/backups/export-zip'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          includeFreezers: selFreezers,
          includeContainers: selContainers,
          includeProducts: selItems,
          includeMeatCuts: selInventory,
          includeOffSite: selOffSite,
          includeImages: selPics,
          includeCustomLists: selCustomLists,
          includeTags: selTags,
          includeHistory: selHistory
        })
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `freezer_inventory_comprehensive_backup_${new Date().toISOString().slice(0, 10)}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showToastMessage('success', 'Comprehensive backup ZIP downloaded successfully!');
      } else {
        showToastMessage('error', 'Failed to generate comprehensive backup ZIP.');
      }
    } catch (err: any) {
      showToastMessage('error', `Download error: ${err.message}`);
    } finally {
      setExportingZip(false);
    }
  };

  const handleImportFileChange = (file: File) => {
    if (!file) return;
    const isZip = file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed';

    if (!isZip) {
      showToastMessage('error', 'Only .zip files are supported for comprehensive package imports!');
      return;
    }

    triggerConfirm(
      "Confirm Comprehensive Import",
      `Are you sure you want to restore the selected components? This will overwrite existing elements in On-Site, Off-Site, and/or Image Uploads according to your selection.`,
      async () => {
        setUploadProgress({ title: 'Opening Package', total: 100, current: 10, status: 'Opening backup ZIP package...', unit: '%' });
        try {
          const jsZip = new JSZip();
          const zip = await jsZip.loadAsync(file);

          setUploadProgress({ title: 'Extracting Package', total: 100, current: 20, status: 'Scanning package entries...', unit: '%' });

          // Extract database & data entries
          let onSiteText: string | null = null;
          let offSiteText: string | null = null;
          let dbBuffer: Uint8Array | null = null;

          const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
          const imageEntries: { name: string; file: JSZip.JSZipObject }[] = [];

          for (const filename of Object.keys(zip.files)) {
            const entry = zip.files[filename];
            if (entry.dir) continue;
            const normalizedFilename = filename.replace(/\\/g, '/');
            const lowerName = normalizedFilename.toLowerCase();
            const cleanName = normalizedFilename.split('/').pop() || normalizedFilename;
            const dotIdx = cleanName.lastIndexOf('.');
            const ext = dotIdx !== -1 ? cleanName.substring(dotIdx).toLowerCase() : '';

            if (!onSiteText && (lowerName.endsWith('inventory-on-site.json') || lowerName.endsWith('inventory.json') || lowerName.endsWith('.json'))) {
              onSiteText = await entry.async("string");
            } else if (!offSiteText && (lowerName.endsWith('inventory-off-site.csv') || lowerName.endsWith('offsite.csv') || lowerName.endsWith('.csv'))) {
              offSiteText = await entry.async("string");
            } else if (!dbBuffer && lowerName.endsWith('.db')) {
              dbBuffer = await entry.async("uint8array");
            }

            const isImageFile = validExtensions.includes(ext);
            const isInImageFolder = lowerName.includes('images/') || lowerName.includes('photos/') || lowerName.includes('uploads/');
            if (cleanName && (isImageFile || isInImageFolder)) {
              if (validExtensions.includes(ext)) {
                imageEntries.push({ name: cleanName, file: entry });
              }
            }
          }

          // Build lightweight package with only database files for immediate backend restoration
          const dbZip = new JSZip();
          if (onSiteText) dbZip.file("inventory-on-site.json", onSiteText);
          if (offSiteText) dbZip.file("inventory-off-site.csv", offSiteText);
          if (dbBuffer) dbZip.file("inventory.db", dbBuffer);
          const dbPackageBase64 = await dbZip.generateAsync({ type: "base64" });

          setUploadProgress({ title: 'Restoring Database', total: 100, current: 40, status: 'Restoring database records and schemas...', unit: '%' });

          const token = localStorage.getItem('freezerToken');
          const res = await fetch(getApiUrl('api/backups/import-zip'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
              base64: dbPackageBase64,
              restoreFreezers: selFreezers,
              restoreContainers: selContainers,
              restoreProducts: selItems,
              restoreMeatCuts: selInventory,
              restoreOffSite: selOffSite,
              restoreImages: false, // Handled separately in resilient batches
              restoreCustomLists: selCustomLists,
              restoreTags: selTags,
              restoreHistory: selHistory
            })
          });

          if (!res.ok) {
            let errorMsg = 'Failed to restore ZIP database.';
            try {
              const contentType = res.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const errJson = await res.json();
                errorMsg = errJson.error || errorMsg;
              } else {
                const errText = await res.text();
                errorMsg = errText.length < 200 ? `${errorMsg} (${errText})` : `${errorMsg} (HTTP ${res.status})`;
              }
            } catch {
              errorMsg = `${errorMsg} (HTTP ${res.status})`;
            }
            throw new Error(errorMsg);
          }

          const dbReply = await res.json();

          // Resilient Batch Photo Asset Restoration
          if (selPics && imageEntries.length > 0) {
            const BATCH_SIZE = 5;
            let uploadedImagesCount = 0;

            for (let i = 0; i < imageEntries.length; i += BATCH_SIZE) {
              const batch = imageEntries.slice(i, i + BATCH_SIZE);
              
              setUploadProgress({
                title: 'Restoring Photo Assets',
                total: imageEntries.length,
                current: uploadedImagesCount,
                status: `Preparing photo batch (${uploadedImagesCount + 1}-${Math.min(uploadedImagesCount + batch.length, imageEntries.length)} of ${imageEntries.length})...`,
                unit: 'photos'
              });

              const batchPayload = await Promise.all(
                batch.map(async (item) => ({
                  filename: item.name,
                  base64: await item.file.async("base64")
                }))
              );

              try {
                const batchRes = await fetch(getApiUrl('api/backups/upload-images-batch'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                  },
                  body: JSON.stringify({ images: batchPayload })
                });

                if (batchRes.ok) {
                  uploadedImagesCount += batch.length;
                } else {
                  throw new Error('Batch upload endpoint failed, falling back to individual');
                }
              } catch (batchErr) {
                console.warn('Batch upload fallback triggered:', batchErr);
                for (const item of batchPayload) {
                  try {
                    await fetch(getApiUrl('api/backups/upload-image'), {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                      },
                      body: JSON.stringify(item)
                    });
                  } catch (singleErr) {
                    console.warn(`Failed to upload ${item.filename}:`, singleErr);
                  }
                  uploadedImagesCount++;
                }
              }

              setUploadProgress({
                title: 'Restoring Photo Assets',
                total: imageEntries.length,
                current: Math.min(uploadedImagesCount, imageEntries.length),
                status: `Uploaded ${Math.min(uploadedImagesCount, imageEntries.length)} of ${imageEntries.length} photos...`,
                unit: 'photos'
              });
            }
          }

          setUploadProgress(null);
          const successMsg = selPics && imageEntries.length > 0
            ? `${dbReply.message || 'Database restored'} and ${imageEntries.length} photos imported successfully!`
            : (dbReply.message || 'Restored successfully!');
          showToastMessage('success', successMsg);
          setTimeout(() => window.location.reload(), 1500);

        } catch (e: any) {
          setUploadProgress(null);
          showToastMessage('error', `Import ZIP error: ${e.message}`);
        }
      }
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-2 animate-fade-in text-cool-gray-300">
      
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-cool-gray-800">
        <div>
          <h2 className="text-2xl font-bold font-sans tracking-tight text-white flex items-center gap-3">
            <span className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-500/30">
              <Database className="w-6 h-6 text-cyan-400" />
            </span>
            System Database Manager
          </h2>
          <p className="text-xs text-cool-gray-400 mt-1.5 leading-relaxed">
            Manage complete and partial database backups, point-in-time state snapshots, operations restoration, and bulk cleaning controls safely.
          </p>
        </div>
        
        <button
          onClick={() => onNavigateToView('freezer')}
          className="self-start md:self-auto px-4 py-2 rounded-xl bg-cool-gray-850 hover:bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-200 text-xs font-bold transition duration-150 cursor-pointer"
        >
          Back to Freezer Map
        </button>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-xl border mb-6 flex items-start gap-3 text-xs md:text-sm font-semibold shadow-xl ${
          statusMessage.type === 'success' 
            ? 'bg-green-950/35 border-green-500/30 text-green-300' 
            : 'bg-red-950/25 border-red-500/30 text-red-300'
        }`}>
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-cyan-400 animate-pulse" />
          <span>{statusMessage.label}</span>
        </div>
      )}

      {/* Selector Panels tabs */}
      <div className="flex border-b border-cool-gray-800 mb-6 font-medium flex-wrap">
        <button
          onClick={() => setActiveTab('backup')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition duration-150 border-b-2 cursor-pointer ${
            activeTab === 'backup' 
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/10' 
              : 'border-transparent text-cool-gray-450 hover:text-white'
          }`}
        >
          💾 System Snapshots & Backups
        </button>
        <button
          onClick={() => setActiveTab('wipe')}
          className={`px-5 py-3 text-xs uppercase tracking-wider font-bold transition duration-150 border-b-2 cursor-pointer ${
            activeTab === 'wipe' 
              ? 'border-rose-500 text-rose-450 bg-rose-950/10' 
              : 'border-transparent text-cool-gray-450 hover:text-rose-400'
          }`}
        >
          🗑️ Reset Database (Bulk Deletes)
        </button>
      </div>

      {/* TAB B: Backup / Restore snapshots ZIP */}
      {activeTab === 'backup' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="bg-cool-gray-850 border border-cool-gray-800 rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" /> Point-in-Time Snapshots & Backup Vault
              </h3>
              <p className="text-xs text-cool-gray-400 leading-relaxed">
                Create local snapshots or full package archives, manage backups in your central snapshot library, and execute selective data restores with live snapshot comparison previewing.
              </p>
            </div>

            {/* Create Snapshot & Upload Card */}
            <div className="bg-cool-gray-900/80 border border-cool-gray-750 p-5 rounded-2xl shadow-inner space-y-4">
              <div className="flex items-center gap-2 border-b border-cool-gray-800 pb-3">
                <div className="p-1 px-2 rounded bg-indigo-500/10 text-indigo-400 font-bold text-[10px] tracking-wider uppercase">📸 Snapshot Builder</div>
                <h4 className="text-xs font-black uppercase tracking-wider text-cool-gray-200">Create New System Snapshot</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Snapshot Name */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider">
                    Snapshot Name / Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Pre-butcher-restock-june"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    className="w-full bg-cool-gray-950 border border-cool-gray-750 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-cool-gray-600 focus:border-indigo-500 focus:ring-0"
                  />
                </div>

                {/* Format Selection: Database Only (.db) vs Database + Photos (.zip) */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider">
                    Snapshot Backup Format
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewSnapshotType('sqlite')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                        newSnapshotType === 'sqlite'
                          ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                          : 'bg-cool-gray-950 border-cool-gray-800 text-cool-gray-400 hover:text-cool-gray-200'
                      }`}
                    >
                      <Database className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <span className="block text-white text-xs">Database Only (.db)</span>
                        <span className="block text-[9px] text-cool-gray-450 font-normal">SQLite DB tables</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewSnapshotType('zip')}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition cursor-pointer flex items-center gap-2 ${
                        newSnapshotType === 'zip'
                          ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200'
                          : 'bg-cool-gray-950 border-cool-gray-800 text-cool-gray-400 hover:text-cool-gray-200'
                      }`}
                    >
                      <FolderOpen className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <span className="block text-white text-xs">DB + Photos (.zip)</span>
                        <span className="block text-[9px] text-cool-gray-450 font-normal">Full Zip archive</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCreateOnSiteBackup}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" /> Create Snapshot / Backup
                </button>

                <div className="relative w-full sm:w-auto">
                  <input
                    type="file"
                    accept=".db,.zip"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleUploadSnapshotOnly(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer block"
                  />
                  <div className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-cool-gray-750 bg-cool-gray-950 hover:bg-cool-gray-900 text-cool-gray-300 text-xs font-bold uppercase tracking-wider text-center transition flex justify-center items-center gap-2 cursor-pointer">
                    <Upload className="w-4 h-4 text-indigo-400" /> Upload Backup File to Vault
                  </div>
                </div>
              </div>
            </div>

            {/* Snapshot Vault Library */}
            <div className="border border-cool-gray-750 bg-cool-gray-905/70 rounded-2xl p-5 space-y-3">
              <div className="flex justify-between items-center border-b border-cool-gray-800 pb-3">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-400" /> Local Snapshot & Backup List ({onSiteBackups.length})
                </h4>
                <button
                  onClick={loadOnSiteBackups}
                  className="p-1.5 hover:bg-cool-gray-800 text-cool-gray-400 hover:text-white rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
                  title="Refresh snapshot list"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              <div className="bg-cool-gray-950/60 border border-cool-gray-800 rounded-xl overflow-y-auto max-h-72 p-2 min-h-[140px]">
                {loadingBackups ? (
                  <div className="flex justify-center items-center p-8 gap-2 text-xs text-cool-gray-450">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> Loading snapshot list...
                  </div>
                ) : onSiteBackups.length === 0 ? (
                  <div className="text-center p-8 text-xs text-cool-gray-500">
                    No snapshots or backup files found in local vault.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {onSiteBackups.map(b => (
                      <div key={b.filename} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-cool-gray-900 border border-cool-gray-800 hover:border-cool-gray-700 transition gap-2">
                        <div className="flex flex-col overflow-hidden min-w-0">
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <span className="text-xs font-bold text-white truncate font-mono" title={b.filename}>{b.filename}</span>
                            {b.type === 'sqlite' && (
                              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-md shrink-0">SQLITE DB</span>
                            )}
                            {b.type === 'zip' && (
                              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-cyan-950 text-cyan-300 border border-cyan-800 rounded-md shrink-0">FULL ZIP (DB + PHOTOS)</span>
                            )}
                            {b.type === 'json' && (
                              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-md shrink-0">JSON</span>
                            )}
                            {b.type === 'csv' && (
                              <span className="px-2 py-0.5 text-[9px] font-extrabold bg-amber-950 text-amber-300 border border-amber-800 rounded-md shrink-0">CSV</span>
                            )}
                          </div>
                          <span className="text-[10px] text-cool-gray-450 mt-0.5">
                            Created: <strong className="text-cool-gray-300">{new Date(b.createdAt).toLocaleString()}</strong> &bull; Size: <strong className="text-cool-gray-300">{(b.size / 1024).toFixed(1)} KB</strong>
                          </span>
                        </div>

                        {/* Actions: Download, Preview and Restore, Delete */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto pt-1 sm:pt-0">
                          <button
                            onClick={() => handleDownloadOnSiteBackup(b.filename)}
                            className="px-2.5 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-300 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                            title="Download snapshot file to computer"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </button>

                          <button
                            onClick={() => fetchPreview(b.filename)}
                            disabled={loadingPreview === b.filename}
                            className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800/60 text-emerald-300 text-xs font-extrabold rounded-lg transition cursor-pointer flex items-center gap-1"
                            title="Preview and restore snapshot to database with comparison window"
                          >
                            {loadingPreview === b.filename ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                            ) : (
                              <RefreshCw className="w-3.5 h-3.5" />
                            )}
                            Preview and Restore
                          </button>

                          <button
                            onClick={() => handleDeleteOnSiteBackup(b.filename)}
                            className="p-1.5 hover:bg-rose-950 text-rose-400 rounded-lg transition cursor-pointer flex"
                            title="Delete snapshot permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Dual Rolling Automatic Snapshots Schedules Section */}
            <div className="border border-cool-gray-750 bg-cool-gray-900/50 rounded-2xl p-5 space-y-4">
              <div>
                <h4 className="text-md font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" /> Dual-Schedule Rolling Automatic Snapshots
                </h4>
                <p className="text-xs text-cool-gray-450 mt-1 leading-relaxed">
                  Configure independent background schedules for lightweight nightly database backups and comprehensive weekly full archives.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Schedule 1: Database-Only Backup (Nightly) */}
                <div className="p-4 bg-cool-gray-950 border border-cool-gray-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-cool-gray-850 pb-2">
                    <span className="text-xs font-extrabold text-indigo-300 flex items-center gap-1.5">
                      <Database className="w-4 h-4" /> Database-Only Rolling Schedule
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={dbAutoEnabled}
                        onChange={(e) => setDbAutoEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-900 text-indigo-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-cool-gray-300">
                        {dbAutoEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <span className="block text-[10px] text-cool-gray-450 font-bold uppercase mb-1">Frequency (Days)</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={dbAutoInterval}
                        onChange={(e) => setDbAutoInterval(parseInt(e.target.value) || 1)}
                        className="w-full bg-cool-gray-900 border border-cool-gray-800 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-cool-gray-450 font-bold uppercase mb-1">Retention Limit</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={dbAutoMaxCount}
                        onChange={(e) => setDbAutoMaxCount(parseInt(e.target.value) || 1)}
                        className="w-full bg-cool-gray-900 border border-cool-gray-800 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-cool-gray-450 font-bold uppercase mb-1">Backup Hour</span>
                      <select
                        value={dbBackupHour}
                        onChange={(e) => setDbBackupHour(parseInt(e.target.value) ?? 2)}
                        className="w-full bg-cool-gray-900 border border-cool-gray-800 rounded-lg px-2 py-1.5 text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                      >
                        {Array.from({ length: 24 }).map((_, hr) => {
                          const ampm = hr >= 12 ? 'PM' : 'AM';
                          const displayHour = hr % 12 === 0 ? 12 : hr % 12;
                          return (
                            <option key={hr} value={hr} className="bg-cool-gray-900 text-white">
                              {displayHour}:00 {ampm}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-cool-gray-500">
                    Recommended: Frequency = 1 day (Nightly), Retention = 7 backups (1 week).
                  </p>
                </div>

                {/* Schedule 2: Full Backup (Database + Photos Zip) */}
                <div className="p-4 bg-cool-gray-950 border border-cool-gray-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-cool-gray-850 pb-2">
                    <span className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                      <FolderOpen className="w-4 h-4" /> Full Archive (DB + Photos) Schedule
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={zipAutoEnabled}
                        onChange={(e) => setZipAutoEnabled(e.target.checked)}
                        className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-900 text-cyan-500 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-cool-gray-300">
                        {zipAutoEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] text-cool-gray-450 font-bold uppercase mb-1">Frequency (Days)</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={zipAutoInterval}
                        onChange={(e) => setZipAutoInterval(parseInt(e.target.value) || 1)}
                        className="w-full bg-cool-gray-900 border border-cool-gray-800 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold text-xs"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-cool-gray-450 font-bold uppercase mb-1">Retention Limit</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={zipAutoMaxCount}
                        onChange={(e) => setZipAutoMaxCount(parseInt(e.target.value) || 1)}
                        className="w-full bg-cool-gray-900 border border-cool-gray-800 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-cool-gray-500">
                    Recommended: Frequency = 7 days (Weekly), Retention = 2 backups.
                  </p>
                </div>
              </div>

              {/* Timezone & Scheduling Clock Reference */}
              <div className="p-4 bg-cool-gray-950 border border-cool-gray-800 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cool-gray-850 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white">Scheduled Timezone & Target Clock</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        if (detected) {
                          setBackupTimezone(detected);
                          showToastMessage('success', `Detected browser timezone: ${detected}`);
                        }
                      } catch (e) {}
                    }}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer bg-emerald-950/40 hover:bg-emerald-900/40 border border-emerald-800/60 px-2.5 py-1 rounded-lg transition"
                  >
                    <Clock className="w-3 h-3" /> Auto-Detect Browser Timezone
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[10px] text-cool-gray-450 font-bold uppercase mb-1">Backup Target Timezone</label>
                    <select
                      value={backupTimezone}
                      onChange={(e) => setBackupTimezone(e.target.value)}
                      className="w-full bg-cool-gray-900 border border-cool-gray-800 rounded-lg px-3 py-1.5 text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="America/New_York">America/New_York (Eastern Time - US)</option>
                      <option value="America/Chicago">America/Chicago (Central Time - US)</option>
                      <option value="America/Denver">America/Denver (Mountain Time - US)</option>
                      <option value="America/Phoenix">America/Phoenix (Mountain Standard - Arizona)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (Pacific Time - US)</option>
                      <option value="America/Anchorage">America/Anchorage (Alaska Time)</option>
                      <option value="Pacific/Honolulu">Pacific/Honolulu (Hawaii Time)</option>
                      <option value="America/Toronto">America/Toronto (Eastern Time - Canada)</option>
                      <option value="America/Vancouver">America/Vancouver (Pacific Time - Canada)</option>
                      <option value="Europe/London">Europe/London (GMT / BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET / CEST)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET / CEST)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEST / AEDT)</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      {backupTimezone && ![
                        "America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", 
                        "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu", "America/Toronto", 
                        "America/Vancouver", "Europe/London", "Europe/Paris", "Europe/Berlin", 
                        "Australia/Sydney", "UTC"
                      ].includes(backupTimezone) && (
                        <option value={backupTimezone}>{backupTimezone} (Custom / System)</option>
                      )}
                    </select>
                  </div>
                  <div className="bg-cool-gray-900 border border-cool-gray-800 rounded-lg p-2.5 text-xs text-cool-gray-300 flex flex-col justify-center">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-cool-gray-450 font-bold uppercase">Next DB Snapshot Trigger</span>
                      <span className="font-mono font-bold text-indigo-400">
                        {dbBackupHour % 12 === 0 ? 12 : dbBackupHour % 12}:00 {dbBackupHour >= 12 ? 'PM' : 'AM'}
                      </span>
                    </div>
                    <div className="text-[10px] text-cool-gray-450 mt-1 flex items-center justify-between">
                      <span>Timezone:</span>
                      <span className="font-mono text-emerald-400 font-bold">{backupTimezone}</span>
                    </div>
                    {serverLocalTime && (
                      <div className="text-[10px] text-cool-gray-450 mt-0.5 flex items-center justify-between">
                        <span>Current Target Time:</span>
                        <span className="font-mono text-cool-gray-300">{serverLocalTime}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {lastAutoSnapshot && (
                <p className="text-[10px] text-cool-gray-500 pt-1 leading-relaxed flex items-center gap-1.5">
                  <span>📅</span> Last rolling auto-snapshot run: <strong className="text-cool-gray-300 font-mono">{new Date(lastAutoSnapshot).toLocaleString()}</strong>
                </p>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveAutoConfig}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold uppercase tracking-wider rounded-xl transition shadow-lg cursor-pointer flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Save Rolling Snapshot Schedules
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB C: Database Control Unit / Bulk Reset */}
      {activeTab === 'wipe' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Main Extreme Warning Alert Block */}
          <div className="p-5 rounded-2xl bg-red-950/30 border border-red-500/30 flex items-start gap-4 shadow-2xl">
            <div className="p-3 rounded-xl bg-red-950 border border-red-800/40 text-red-400 flex-shrink-0 animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <h3 className="text-md font-bold text-red-300 font-sans tracking-tight uppercase">
                Danger Zone & Database Reset Console
              </h3>
              <p className="text-xs leading-relaxed text-cool-gray-350">
                These utilities perform absolute operations that bypass individual item deleted logs. Re-routing or erasing actions will instantly apply to the offline storage and coordinate real-time updates with other connected restockers. Please double check before executing.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Complete Database Wipe */}
            <div className="bg-cool-gray-850 border border-red-500/20 hover:border-red-500/30 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl transition">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-bold font-sans">
                  <Trash2 className="w-5 h-5" />
                  <h4>Empty Database Wiped Clean</h4>
                </div>
                <p className="text-xs text-cool-gray-450 leading-relaxed">
                  Completely empty the database, resetting the system back to its clean start. Deletes all freezers, custom container bins, product lists, active inventory counts, and activity logs.
                </p>
              </div>
              <button
                type="button"
                onClick={handleWipeAllData}
                className="w-full py-2.5 px-4 rounded-xl bg-red-900/40 hover:bg-red-700/60 text-red-200 border border-red-500/30 text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Reset Database to Start
              </button>
            </div>

            {/* Clear Counts Only */}
            <div className="bg-cool-gray-850 border border-cool-gray-850/60 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold font-sans">
                  <span className="p-1 rounded bg-amber-550/10 text-amber-400">🔢</span>
                  <h4>Wipe Core Counts Only</h4>
                </div>
                <p className="text-xs text-cool-gray-450 leading-relaxed">
                  Reset your logged count tallies back to 0. This wipes out all item counts across all freezer shelves and boxes, but leaves your physical freezers, container configurations, and product catalogs fully intact.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBulkClearInventory}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-900/20 hover:bg-amber-800/40 text-amber-300 border border-amber-500/30 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Clear Inventory Counts
              </button>
            </div>

            {/* Delete Freezers Only */}
            <div className="bg-cool-gray-850 border border-cool-gray-850/60 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold font-sans">
                  <Layers className="w-4 h-4" />
                  <h4>Delete Freezer Cabinets</h4>
                </div>
                <p className="text-xs text-cool-gray-450 leading-relaxed">
                  Delete all physical freezers. Any custom bin placements inside these freezers are preserved but moved to the 'Unassigned' catalog. Freezer-only loose layers will have their counts safely mapped back to the general Loose section.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBulkDeleteFreezers}
                className="w-full py-2.5 px-4 rounded-xl bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Delete All Freezer Structures
              </button>
            </div>

            {/* Delete Containers Only */}
            <div className="bg-cool-gray-850 border border-cool-gray-850/60 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-indigo-400 font-bold font-sans">
                  <Box className="w-4 h-4" />
                  <h4>Delete Custom Bins & Bags</h4>
                </div>
                <p className="text-xs text-cool-gray-450 leading-relaxed">
                  Wipes out all custom cardboard boxes, Purple baskets, bins, and generic shelves. Any active count elements currently inside these containers are automatically relocated to flat 'Loose' stock layers so counts aren't lost.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBulkDeleteContainers}
                className="w-full py-2.5 px-4 rounded-xl bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Delete All Containers/Bins
              </button>
            </div>

            {/* Delete Products Catalog Only */}
            <div className="bg-cool-gray-850 border border-cool-gray-850/60 rounded-2xl p-6 flex flex-col justify-between space-y-4 shadow-xl md:col-span-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-400 font-bold font-sans">
                  <Library className="w-4 h-4 text-rose-400" />
                  <h4>Delete Product Definitions Catalog</h4>
                </div>
                <p className="text-xs text-cool-gray-450 leading-relaxed">
                  Erases all customized meat cuts descriptions and product specs. Note: Since inventory items are linked to their parent product configurations, executing this catalog reset will also completely empty your active stock counts automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={handleBulkDeleteProducts}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-950/20 hover:bg-rose-900/35 border border-rose-500/20 hover:border-rose-500/45 text-rose-300 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
              >
                Wipe Entire Item Product Catalog
              </button>
            </div>

          </div>

        </div>
      )}



      {/* Concurrent Background Image Upload Loading Progress Overlay */}
      {uploadProgress && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[99999] flex items-center justify-center p-4">
          <div className="bg-cool-gray-900 border border-cool-gray-750 p-8 rounded-2xl max-w-sm w-full shadow-2xl text-center space-y-5 animate-fade-in">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mx-auto" />
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                {uploadProgress.title || 'System Backup & Restore Operation'}
              </h3>
              <p className="text-[11px] text-cool-gray-400 leading-normal">{uploadProgress.status}</p>
            </div>
            {uploadProgress.total > 0 && (
              <div className="space-y-2">
                <div className="w-full bg-cool-gray-850 h-2 rounded-full overflow-hidden border border-cool-gray-800">
                  <div 
                    className="bg-cyan-400 h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${Math.min(100, Math.max(0, (uploadProgress.current / uploadProgress.total) * 100))}%` }}
                  />
                </div>
                <p className="text-[10px] text-cool-gray-450 font-bold uppercase">
                  {uploadProgress.unit === 'photos'
                    ? `Progress: ${uploadProgress.current} / ${uploadProgress.total} photos restored`
                    : uploadProgress.unit === 'chunks'
                      ? `Progress: ${uploadProgress.current} / ${uploadProgress.total} chunks transferred`
                      : `Progress: ${Math.round((uploadProgress.current / uploadProgress.total) * 100)}% (${uploadProgress.current} / ${uploadProgress.total})`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Standard modal dialog alerts to bypass sandbox prompt-blockers */}
      {modalState?.isOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-800/40 mt-0.5 text-cyan-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-md font-bold text-white leading-normal truncate">{modalState.title}</h3>
                <p className="text-xs text-cool-gray-400 mt-1.5 leading-relaxed whitespace-pre-wrap max-h-[250px] overflow-y-auto pr-1">
                  {modalState.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-cool-gray-800/75">
              {modalState.type === 'confirm' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setModalState(null)}
                    className="px-4 py-2 rounded-xl bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (modalState.onConfirm) modalState.onConfirm();
                      setModalState(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold cursor-pointer"
                  >
                    Yes, Proceed
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setModalState(null)}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Restoration Preview Portal */}
      {previewData && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-cool-gray-900 border border-cool-gray-750 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-cool-gray-800 bg-cool-gray-905 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-950 border border-indigo-850 text-indigo-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Snapshot Restoration Preview</h3>
                  <p className="text-[11px] text-cool-gray-450 mt-0.5">
                    File: <span className="text-indigo-400 font-mono font-bold">{previewData.filename}</span> &bull; 
                    Size: <span className="text-white font-semibold">{(previewData.size / 1024).toFixed(1)} KB</span> &bull; 
                    Created: <span className="text-white font-semibold">{new Date(previewData.createdAt).toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="p-1.5 hover:bg-cool-gray-850 text-cool-gray-400 hover:text-white rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Informational Warning banner */}
              <div className="p-4 bg-amber-950/40 border border-amber-800/40 rounded-xl flex gap-3 text-xs leading-relaxed text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-amber-300 block font-bold mb-0.5">Destructive Overlay Hazard</strong>
                  Restoring any checked sections below will completely replace your active database items. Sections left unchecked will remain unaltered in your active view. Please verify the snapshot's properties before applying.
                </div>
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Comparison Table */}
                <div className="lg:col-span-3 space-y-3">
                  <div className="bg-cool-gray-955 border border-cool-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-cool-gray-900 border-b border-cool-gray-800/70">
                      <span className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider">Database Records Comparison</span>
                    </div>
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-cool-gray-800 text-cool-gray-400 bg-cool-gray-900/40 text-[10px] uppercase font-bold">
                          <th className="py-2.5 px-4">Database Section</th>
                          <th className="py-2.5 px-4 text-center">Active DB</th>
                          <th className="py-2.5 px-4 text-center">Snapshot File</th>
                          <th className="py-2.5 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cool-gray-800/60 font-medium">
                        {/* Freezers */}
                        <tr className={selFreezers ? "bg-cool-gray-850/20" : "opacity-50"}>
                          <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                            <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> Freezers (Locations)
                          </td>
                          <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{previewData.currentCounts?.freezers ?? liveTotals.freezers}</td>
                          <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.freezers ?? 0}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selFreezers ? "bg-amber-950/80 border border-amber-800/40 text-amber-300" : "bg-cool-gray-800 text-cool-gray-400"}`}>
                              {selFreezers ? "WILL OVERWRITE" : "SKIPPED"}
                            </span>
                          </td>
                        </tr>
                        {/* Containers */}
                        <tr className={selContainers ? "bg-cool-gray-850/20" : "opacity-50"}>
                          <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                            <Box className="w-3.5 h-3.5 text-yellow-500" /> Containers (Bins/Boxes)
                          </td>
                          <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{previewData.currentCounts?.containers ?? liveTotals.containers}</td>
                          <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.containers ?? 0}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selContainers ? "bg-amber-950/80 border border-amber-800/40 text-amber-300" : "bg-cool-gray-800 text-cool-gray-400"}`}>
                              {selContainers ? "WILL OVERWRITE" : "SKIPPED"}
                            </span>
                          </td>
                        </tr>
                        {/* Catalog */}
                        <tr className={selItems ? "bg-cool-gray-850/20" : "opacity-50"}>
                          <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                            <Library className="w-3.5 h-3.5 text-emerald-400" /> Product Catalog
                          </td>
                          <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{previewData.currentCounts?.products ?? liveTotals.products}</td>
                          <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.products ?? 0}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selItems ? "bg-amber-950/80 border border-amber-800/40 text-amber-300" : "bg-cool-gray-800 text-cool-gray-400"}`}>
                              {selItems ? "WILL OVERWRITE" : "SKIPPED"}
                            </span>
                          </td>
                        </tr>
                        {/* Onsite Meat Cuts */}
                        <tr className={selInventory ? "bg-cool-gray-850/20" : "opacity-50"}>
                          <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-pink-400" /> On-site Meat Cuts
                          </td>
                          <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{previewData.currentCounts?.meatCuts ?? liveTotals.meatCuts}</td>
                          <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.meatCuts ?? 0}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selInventory ? "bg-amber-950/80 border border-amber-800/40 text-amber-300" : "bg-cool-gray-800 text-cool-gray-400"}`}>
                              {selInventory ? "WILL OVERWRITE" : "SKIPPED"}
                            </span>
                          </td>
                        </tr>
                        {/* Offsite Entries */}
                        <tr className={selOffSite ? "bg-cool-gray-850/20" : "opacity-50"}>
                          <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-cyan-400" /> Off-site Cold Storage
                          </td>
                          <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{previewData.currentCounts?.offSiteEntries ?? liveTotals.offSiteEntries}</td>
                          <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.offSiteEntries ?? 0}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selOffSite ? "bg-amber-950/80 border border-amber-800/40 text-amber-300" : "bg-cool-gray-800 text-cool-gray-400"}`}>
                              {selOffSite ? "WILL OVERWRITE" : "SKIPPED"}
                            </span>
                          </td>
                        </tr>
                        {/* Custom Lists */}
                        <tr className={selCustomLists ? "bg-cool-gray-850/20" : "opacity-50"}>
                          <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                            <Settings className="w-3.5 h-3.5 text-orange-400" /> Custom Shopping Lists
                          </td>
                          <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{previewData.currentCounts?.customLists ?? liveTotals.customLists}</td>
                          <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.customLists ?? 0}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selCustomLists ? "bg-amber-950/80 border border-amber-800/40 text-amber-300" : "bg-cool-gray-800 text-cool-gray-400"}`}>
                              {selCustomLists ? "WILL OVERWRITE" : "SKIPPED"}
                            </span>
                          </td>
                        </tr>
                        {/* Tags */}
                        <tr className={selTags ? "bg-cool-gray-850/20" : "opacity-50"}>
                          <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Quality/Status Tags
                          </td>
                          <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{previewData.currentCounts?.tags ?? liveTotals.tags}</td>
                          <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.tags ?? 0}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selTags ? "bg-amber-950/80 border border-amber-800/40 text-amber-300" : "bg-cool-gray-800 text-cool-gray-400"}`}>
                              {selTags ? "WILL OVERWRITE" : "SKIPPED"}
                            </span>
                          </td>
                        </tr>
                        {/* History */}
                        <tr className={selHistory ? "bg-cool-gray-850/20" : "opacity-50"}>
                          <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-purple-400" /> Activity History Logs
                          </td>
                          <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{previewData.currentCounts?.history ?? liveTotals.history}</td>
                          <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.history ?? 0}</td>
                          <td className="py-2.5 px-4 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${selHistory ? "bg-amber-950/80 border border-amber-800/40 text-amber-300" : "bg-cool-gray-800 text-cool-gray-400"}`}>
                              {selHistory ? "WILL OVERWRITE" : "SKIPPED"}
                            </span>
                          </td>
                        </tr>
                        {/* Butcher Records (if present) */}
                        {((previewData.counts.butcherOrders ?? 0) > 0 || (previewData.counts.butcherRecords ?? 0) > 0) && (
                          <>
                            <tr className="bg-cool-gray-900/30">
                              <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-red-400" /> Butcher Carcass Orders
                              </td>
                              <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{liveTotals.butcherOrders}</td>
                              <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.butcherOrders ?? 0}</td>
                              <td className="py-2.5 px-4 text-right">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-950/80 border border-amber-800/40 text-amber-300">
                                  OVERWRITES WITH INVENTORY
                                </span>
                              </td>
                            </tr>
                            <tr className="bg-cool-gray-900/30">
                              <td className="py-2.5 px-4 text-white flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-red-400" /> Butcher Packaged Cuts
                              </td>
                              <td className="py-2.5 px-4 text-center text-cool-gray-300 font-mono">{liveTotals.butcherRecords}</td>
                              <td className="py-2.5 px-4 text-center text-indigo-300 font-mono font-bold">{previewData.counts.butcherRecords ?? 0}</td>
                              <td className="py-2.5 px-4 text-right">
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-950/80 border border-amber-800/40 text-amber-300">
                                  OVERWRITES WITH INVENTORY
                                </span>
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Scope Toggles & Totals */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Scope Selector in Modal */}
                  <div className="bg-cool-gray-955 border border-cool-gray-800 rounded-xl p-4 space-y-3">
                    <span className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider">
                      Configure Restoration Sections
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 px-1.5 rounded hover:bg-cool-gray-800/30 transition">
                        <input
                          type="checkbox"
                          checked={selFreezers}
                          onChange={(e) => setSelFreezers(e.target.checked)}
                          className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-950 text-indigo-500 cursor-pointer focus:ring-0"
                        />
                        <span className="text-xs text-white">Freezers (Locations)</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 px-1.5 rounded hover:bg-cool-gray-800/30 transition">
                        <input
                          type="checkbox"
                          checked={selContainers}
                          onChange={(e) => setSelContainers(e.target.checked)}
                          className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-950 text-indigo-500 cursor-pointer focus:ring-0"
                        />
                        <span className="text-xs text-white">Containers (Bins/Boxes)</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 px-1.5 rounded hover:bg-cool-gray-800/30 transition">
                        <input
                          type="checkbox"
                          checked={selItems}
                          onChange={(e) => setSelItems(e.target.checked)}
                          className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-950 text-indigo-500 cursor-pointer focus:ring-0"
                        />
                        <span className="text-xs text-white">Product Catalog definitions</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 px-1.5 rounded hover:bg-cool-gray-800/30 transition">
                        <input
                          type="checkbox"
                          checked={selInventory}
                          onChange={(e) => setSelInventory(e.target.checked)}
                          className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-950 text-indigo-500 cursor-pointer focus:ring-0"
                        />
                        <span className="text-xs text-white">On-site Stock counts</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 px-1.5 rounded hover:bg-cool-gray-800/30 transition">
                        <input
                          type="checkbox"
                          checked={selOffSite}
                          onChange={(e) => setSelOffSite(e.target.checked)}
                          className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-950 text-indigo-500 cursor-pointer focus:ring-0"
                        />
                        <span className="text-xs text-white">Off-site Cold Storage</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 px-1.5 rounded hover:bg-cool-gray-800/30 transition">
                        <input
                          type="checkbox"
                          checked={selCustomLists}
                          onChange={(e) => setSelCustomLists(e.target.checked)}
                          className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-950 text-indigo-500 cursor-pointer focus:ring-0"
                        />
                        <span className="text-xs text-white">Custom Shopping Lists</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 px-1.5 rounded hover:bg-cool-gray-800/30 transition">
                        <input
                          type="checkbox"
                          checked={selTags}
                          onChange={(e) => setSelTags(e.target.checked)}
                          className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-955 text-indigo-500 cursor-pointer focus:ring-0"
                        />
                        <span className="text-xs text-white">Quality/Status Tags</span>
                      </label>
                      <label className="flex items-center gap-2.5 cursor-pointer select-none py-1 px-1.5 rounded hover:bg-cool-gray-800/30 transition">
                        <input
                          type="checkbox"
                          checked={selHistory}
                          onChange={(e) => setSelHistory(e.target.checked)}
                          className="w-4 h-4 rounded border-cool-gray-700 bg-cool-gray-955 text-indigo-500 cursor-pointer focus:ring-0"
                        />
                        <span className="text-xs text-white">Activity History Logs</span>
                      </label>
                    </div>
                  </div>

                  {/* Weights and Pieces Panel */}
                  <div className="bg-cool-gray-955 border border-cool-gray-800 rounded-xl p-4 space-y-2.5">
                    <span className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider">
                      Physical Item Totals Comparison
                    </span>
                    <div className="space-y-2 text-xs">
                      {/* On Site */}
                      <div className="p-2 rounded bg-cool-gray-900 border border-cool-gray-850">
                        <span className="text-[10px] font-bold text-cool-gray-400 block uppercase tracking-wider mb-1">On-Site Inventory totals</span>
                        <div className="grid grid-cols-2 gap-1.5 text-cool-gray-300">
                          <div>
                            <span className="text-[10px] text-cool-gray-500 block">Active Database:</span>
                            <span className="font-mono text-white font-bold">{liveTotals.onSiteSumQty}</span> standard packages, <span className="font-mono text-white font-bold">{liveTotals.onSiteSumPieces}</span> cuts
                          </div>
                          <div>
                            <span className="text-[10px] text-cool-gray-500 block">Snapshot File:</span>
                            <span className="font-mono text-indigo-300 font-bold">{previewData.onSiteSumQty || 0}</span> standard packages, <span className="font-mono text-indigo-300 font-bold">{previewData.onSiteSumPieces || 0}</span> cuts
                          </div>
                        </div>
                      </div>

                      {/* Off Site */}
                      <div className="p-2 rounded bg-cool-gray-900 border border-cool-gray-850">
                        <span className="text-[10px] font-bold text-cool-gray-400 block uppercase tracking-wider mb-1">Off-Site Inventory totals</span>
                        <div className="grid grid-cols-2 gap-1.5 text-cool-gray-300">
                          <div>
                            <span className="text-[10px] text-cool-gray-500 block">Active Database:</span>
                            <span className="font-mono text-white font-bold">{liveTotals.offSiteSumPieces}</span> pieces (<span className="font-mono text-emerald-400 font-bold">{liveTotals.offSiteSumWeight.toFixed(1)} lbs</span>)
                          </div>
                          <div>
                            <span className="text-[10px] text-cool-gray-500 block">Snapshot File:</span>
                            <span className="font-mono text-indigo-300 font-bold">{previewData.offSiteSumPieces || 0}</span> pieces (<span className="font-mono text-indigo-300 font-bold">{(previewData.offSiteSumWeight || 0).toFixed(1)} lbs</span>)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sample Data & Contents Inspector */}
              <div className="bg-cool-gray-955 border border-cool-gray-800 rounded-xl p-4">
                <span className="block text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider mb-2">
                  {previewData.type === 'zip' ? 'Zip Archive Capsule Contents' : 'Snapshot Sample Items Listing'}
                </span>
                
                {previewData.type === 'zip' && previewData.zipFiles ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                    {previewData.zipFiles.map((f: any, idx: number) => (
                      <div key={idx} className="p-2 bg-cool-gray-900 rounded border border-cool-gray-850 flex justify-between items-center text-cool-gray-300">
                        <span className="text-white truncate max-w-[250px]" title={f.name}>{f.name}</span>
                        <span className="text-cool-gray-450 font-bold shrink-0">{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                    {previewData.counts.images > 0 && (
                      <div className="p-2 bg-indigo-950/20 rounded border border-indigo-900/30 flex justify-between items-center text-indigo-300 md:col-span-2">
                        <span className="flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Compressed Product Photograph Assets</span>
                        <span className="font-mono font-bold">{previewData.counts.images} images packaged</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {previewData.samples?.freezers?.length > 0 && (
                      <div className="p-2 bg-cool-gray-900 rounded border border-cool-gray-850 flex flex-col gap-0.5">
                        <strong className="text-cool-gray-400 uppercase text-[9px] tracking-wider">Freezers Sample Names:</strong>
                        <span className="text-cool-gray-200 font-semibold">{previewData.samples.freezers.join(' • ')}</span>
                      </div>
                    )}
                    {previewData.samples?.containers?.length > 0 && (
                      <div className="p-2 bg-cool-gray-900 rounded border border-cool-gray-850 flex flex-col gap-0.5">
                        <strong className="text-cool-gray-400 uppercase text-[9px] tracking-wider">Containers Sample Names:</strong>
                        <span className="text-cool-gray-200 font-semibold">{previewData.samples.containers.join(' • ')}</span>
                      </div>
                    )}
                    {previewData.samples?.products?.length > 0 && (
                      <div className="p-2 bg-cool-gray-900 rounded border border-cool-gray-850 flex flex-col gap-0.5">
                        <strong className="text-cool-gray-400 uppercase text-[9px] tracking-wider">Catalog Products Sample Names:</strong>
                        <span className="text-cool-gray-200 font-semibold truncate">{previewData.samples.products.join(' • ')}</span>
                      </div>
                    )}
                    {previewData.samples?.customLists?.length > 0 && (
                      <div className="p-2 bg-cool-gray-900 rounded border border-cool-gray-850 flex flex-col gap-0.5">
                        <strong className="text-cool-gray-400 uppercase text-[9px] tracking-wider">Custom Shopping Lists:</strong>
                        <span className="text-cool-gray-200 font-semibold">{previewData.samples.customLists.join(' • ')}</span>
                      </div>
                    )}
                    {previewData.samples?.tags?.length > 0 && (
                      <div className="p-2 bg-cool-gray-900 rounded border border-cool-gray-850 flex flex-col gap-0.5">
                        <strong className="text-cool-gray-400 uppercase text-[9px] tracking-wider">Quality/Status Tags:</strong>
                        <span className="text-cool-gray-200 font-semibold">{previewData.samples.tags.join(' • ')}</span>
                      </div>
                    )}
                    {previewData.samples?.offSiteCuts?.length > 0 && (
                      <div className="p-2 bg-cool-gray-900 rounded border border-cool-gray-850 flex flex-col gap-0.5">
                        <strong className="text-cool-gray-400 uppercase text-[9px] tracking-wider">Offsite Cuts Sample Names:</strong>
                        <span className="text-cool-gray-200 font-semibold truncate">{previewData.samples.offSiteCuts.join(' • ')}</span>
                      </div>
                    )}
                    {Object.keys(previewData.counts || {}).length === 0 && (
                      <div className="text-cool-gray-500 italic text-center py-2">
                        No inspectable records or sample values found in this backup format.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-cool-gray-800 bg-cool-gray-905 flex justify-between items-center shrink-0">
              <span className="text-xs text-cool-gray-450 font-medium">
                Double-check selected sections. Click Restore to apply snapshot.
              </span>
              <div className="flex gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="px-4 py-2 rounded-xl bg-cool-gray-800 hover:bg-cool-gray-750 border border-cool-gray-700 text-cool-gray-200 text-xs font-semibold cursor-pointer transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fname = previewData.filename;
                    setPreviewData(null);
                    handleStartLivePreviewMode(fname);
                  }}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-extrabold cursor-pointer transition shadow-lg flex items-center gap-1.5"
                  title="Spin up a temporary read-only live preview of this snapshot across all application tabs"
                >
                  <Eye className="w-3.5 h-3.5" /> Launch Live Preview Mode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fname = previewData.filename;
                    setPreviewData(null);
                    handleRestoreOnSiteBackup(fname);
                  }}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold cursor-pointer transition shadow-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Confirm Restore Selected
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
