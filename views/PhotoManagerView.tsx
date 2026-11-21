// Photo manager view
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryState, Action, Product, Container } from '../types';
import { getApiUrl, resolveImageUrl } from '../hooks/apiUrl';
import { authFetch } from '../utils/clientDevice';
import { saveOfflineImage } from '../utils/offlineStorage';
import {
  buildConnectableObjects,
  ConnectableObject,
  ConnectPhotoStatusFilter,
  ConnectTargetTypeFilter,
  doesImageUrlMatchFilename,
  filterConnectableObjects,
  PhotoAttachment,
  PhotoAttachmentType,
} from '../utils/photoManager';
import { 
  Image as ImageIcon, Trash2, Search, Filter, ArrowUpDown, Sparkles, 
  Upload, Check, Plus, AlertTriangle, Link, Unlink, RefreshCw, X, ChevronRight, CheckCircle2, Box, Package, Camera, Layers
} from 'lucide-react';
import { CatalogSearchFilterBar } from '../components/CatalogSearchFilterBar';

interface PhotoItem {
  filename: string;
  url: string;
  size: number;
  mtime: string;
  attachments: PhotoAttachment[];
}

interface PhotoManagerViewProps {
  state: InventoryState;
  dispatch: any; // Dispatch function from hook
  onRefreshState?: () => Promise<void> | void;
  activeSubTab?: 'library' | 'missing';
  onSubTabChange?: (tab: 'library' | 'missing') => void;
  hideInternalHeader?: boolean;
}

export function PhotoManagerView({
  state,
  dispatch,
  onRefreshState,
  activeSubTab: controlledSubTab,
  onSubTabChange,
  hideInternalHeader = false,
}: PhotoManagerViewProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'attached' | 'unattached'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size_desc' | 'size_asc' | 'name_asc'>('newest');
  const [showLibraryFilters, setShowLibraryFilters] = useState(false);
  
  // Bulk selection
  const [selectedFilenames, setSelectedFilenames] = useState<{ [filename: string]: boolean }>({});
  
  // Tabs inside photo manager
  const [internalSubTab, setInternalSubTab] = useState<'library' | 'missing'>('library');
  const subTab = controlledSubTab ?? internalSubTab;
  const setSubTab = onSubTabChange ?? setInternalSubTab;
  const [missingSearch, setMissingSearch] = useState('');
  const [missingFilter, setMissingFilter] = useState<'all' | 'product' | 'container' | 'container_template'>('all');
  const [missingSortBy, setMissingSortBy] = useState<'name_asc' | 'name_desc' | 'type_first'>('name_asc');
  const [showMissingFilters, setShowMissingFilters] = useState(false);

  // Assign photo modal or inline state (from Missing Photos -> pick existing/upload)
  const [assigningElement, setAssigningElement] = useState<{ id: string; name: string; type: PhotoAttachmentType } | null>(null);
  const [showExistingSelector, setShowExistingSelector] = useState(false);

  // Connect selected photo modal state (from Active Photo Files -> connect to item/container)
  const [connectingPhotoFilename, setConnectingPhotoFilename] = useState<string | null>(null);
  const [connectSearch, setConnectSearch] = useState('');
  const [connectTypeFilter, setConnectTypeFilter] = useState<ConnectTargetTypeFilter>('all');
  const [connectPhotoFilter, setConnectPhotoFilter] = useState<ConnectPhotoStatusFilter>('all');
  const [connectBusyKey, setConnectBusyKey] = useState<string | null>(null);
  const [connectFeedback, setConnectFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Status message for optimization or deletes
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  // Custom confirmation modal bypasses iframe confirmation limitations
  const [customConfirm, setCustomConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm?: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const askConfirm = (
    title: string,
    message: string,
    confirmText: string,
    onConfirm: () => void | Promise<void>
  ) => {
    setCustomConfirm({
      isOpen: true,
      title,
      message,
      confirmText,
      onConfirm: async () => {
        setCustomConfirm(prev => ({ ...prev, isOpen: false }));
        await onConfirm();
      }
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const elementFileInputRef = useRef<HTMLInputElement>(null);
  const elementCameraInputRef = useRef<HTMLInputElement>(null);

  const showStatus = (type: 'success' | 'error' | 'info', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 5000);
  };

  // Fetch photos from server
  const fetchPhotos = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await authFetch(getApiUrl('api/photos'), {
        headers: { ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setPhotos(data);
      } else {
        console.error('Failed to fetch photos from API');
      }
    } catch (e) {
      console.error('Error fetching photos:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAfterPhotoMutation = async () => {
    if (onRefreshState) {
      await onRefreshState();
    }
    await fetchPhotos();
  };

  useEffect(() => {
    fetchPhotos();
  }, [state]);

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  };

  // Filter & Sort Photos
  const filteredAndSortedPhotos = useMemo(() => {
    let result = [...photos];

    // Search filter
    if (searchTerm.trim()) {
      const lowSearch = searchTerm.toLowerCase();
      result = result.filter(photo => {
        const matchesFilename = photo.filename.toLowerCase().includes(lowSearch);
        const matchesAttachments = photo.attachments.some(att => att.name.toLowerCase().includes(lowSearch));
        return matchesFilename || matchesAttachments;
      });
    }

    // Attachment status filter
    if (filterType === 'attached') {
      result = result.filter(photo => photo.attachments.length > 0);
    } else if (filterType === 'unattached') {
      result = result.filter(photo => photo.attachments.length === 0);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.mtime).getTime() - new Date(a.mtime).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
      } else if (sortBy === 'size_desc') {
        return b.size - a.size;
      } else if (sortBy === 'size_asc') {
        return a.size - b.size;
      } else if (sortBy === 'name_asc') {
        return a.filename.localeCompare(b.filename);
      }
      return 0;
    });

    return result;
  }, [photos, searchTerm, filterType, sortBy]);

  const connectingPhoto = useMemo(() => {
    if (!connectingPhotoFilename) return null;
    return photos.find((p) => p.filename === connectingPhotoFilename) || null;
  }, [photos, connectingPhotoFilename]);

  const allConnectableObjects = useMemo(() => buildConnectableObjects(state), [state]);

  const connectTypeFilteredObjects = useMemo(
    () =>
      filterConnectableObjects(allConnectableObjects, {
        search: connectSearch,
        typeFilter: connectTypeFilter,
        photoFilter: 'all',
      }),
    [allConnectableObjects, connectSearch, connectTypeFilter]
  );

  const connectPhotoStatusCounts = useMemo(() => {
    let withPhoto = 0;
    let withoutPhoto = 0;
    connectTypeFilteredObjects.forEach((obj) => {
      if (obj.imageUrl) withPhoto++;
      else withoutPhoto++;
    });
    return {
      all: connectTypeFilteredObjects.length,
      withPhoto,
      withoutPhoto,
    };
  }, [connectTypeFilteredObjects]);

  const filteredConnectableObjects = useMemo(
    () =>
      filterConnectableObjects(allConnectableObjects, {
        search: connectSearch,
        typeFilter: connectTypeFilter,
        photoFilter: connectPhotoFilter,
      }),
    [allConnectableObjects, connectSearch, connectTypeFilter, connectPhotoFilter]
  );

  const openConnectPhotoModal = (photo: PhotoItem) => {
    setConnectingPhotoFilename(photo.filename);
    setConnectSearch('');
    setConnectTypeFilter('all');
    setConnectPhotoFilter('all');
    setConnectFeedback(null);
  };

  const closeConnectPhotoModal = () => {
    setConnectingPhotoFilename(null);
    setConnectBusyKey(null);
    setConnectFeedback(null);
  };

  const handleConnectPhotoToTarget = async (
    target: ConnectableObject,
    mode: 'connect' | 'unlink'
  ) => {
    if (!connectingPhoto) return;
    const key = `${target.type}-${target.id}`;
    setConnectBusyKey(key);
    setConnectFeedback(null);

    try {
      const token = localStorage.getItem('freezerToken');
      const res = await authFetch(getApiUrl('api/photos/assign'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          imageUrl: mode === 'connect' ? connectingPhoto.url : '',
          targetId: target.id,
          targetType: target.type,
        }),
      });

      if (res.ok) {
        await refreshAfterPhotoMutation();
        const typeLabel =
          target.type === 'product'
            ? 'item'
            : target.type === 'container_template'
              ? 'container template'
              : 'container';
        setConnectFeedback({
          type: 'success',
          text:
            mode === 'connect'
              ? `Connected photo to ${typeLabel} "${target.name}".`
              : `Unlinked photo from ${typeLabel} "${target.name}".`,
        });
      } else {
        let errText = mode === 'connect' ? 'Failed to connect photo.' : 'Failed to unlink photo.';
        try {
          const data = await res.json();
          if (data?.error) errText = data.error;
        } catch {}
        setConnectFeedback({ type: 'error', text: errText });
      }
    } catch (err: any) {
      setConnectFeedback({
        type: 'error',
        text: `Error updating photo link: ${err?.message || 'Network error'}`,
      });
    } finally {
      setConnectBusyKey(null);
    }
  };

  // Elements missing photos
  const elementsMissingPhotos = useMemo(() => {
    const missing: Array<{ id: string; name: string; type: PhotoAttachmentType; details?: string }> = [];

    // Products missing photos
    if (missingFilter === 'all' || missingFilter === 'product') {
      (state.products || []).forEach(p => {
        if (!p.imageUrl) {
          missing.push({
            id: p.id,
            name: p.name,
            type: 'product',
            details: `${p.primaryCategory} > ${p.subCategory}`
          });
        }
      });
    }

    // Container templates missing photos
    if (missingFilter === 'all' || missingFilter === 'container_template') {
      (state.containerTemplates || []).forEach(t => {
        if (!t.imageUrl) {
          missing.push({
            id: t.id,
            name: t.name,
            type: 'container_template',
            details: 'Container Template'
          });
        }
      });
    }

    // Containers missing photos
    if (missingFilter === 'all' || missingFilter === 'container') {
      (state.containers || []).forEach(c => {
        if (!c.imageUrl && c.id !== 'staging_loose' && !c.id.endsWith('_loose')) {
          missing.push({
            id: c.id,
            name: c.name,
            type: 'container',
            details: c.freezerId ? `Placed in container pool` : 'Unassigned Bin'
          });
        }
      });
    }

    // Search matching
    const filtered = missingSearch.trim()
      ? missing.filter(elem => {
          const low = missingSearch.toLowerCase();
          return elem.name.toLowerCase().includes(low) || (elem.details && elem.details.toLowerCase().includes(low));
        })
      : missing;

    const typeRank: Record<PhotoAttachmentType, number> = {
      product: 0,
      container_template: 1,
      container: 2,
    };

    return [...filtered].sort((a, b) => {
      if (missingSortBy === 'name_desc') {
        return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (missingSortBy === 'type_first') {
        if (a.type !== b.type) return typeRank[a.type] - typeRank[b.type];
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [state, missingFilter, missingSearch, missingSortBy]);

  // Bulk select toggles
  const handleToggleSelect = (filename: string) => {
    setSelectedFilenames(prev => ({
      ...prev,
      [filename]: !prev[filename]
    }));
  };

  const handleSelectAll = (checked: boolean) => {
    const nextSelected: { [filename: string]: boolean } = {};
    if (checked) {
      filteredAndSortedPhotos.forEach(photo => {
        nextSelected[photo.filename] = true;
      });
    }
    setSelectedFilenames(nextSelected);
  };

  const selectedCount = Object.values(selectedFilenames).filter(Boolean).length;

  // Bulk Delete implementation
  const handleBulkDelete = () => {
    const filenamesToDelete = Object.keys(selectedFilenames).filter(filename => selectedFilenames[filename]);
    if (filenamesToDelete.length === 0) return;

    askConfirm(
      "Delete Selected Photos",
      `Are you absolutely sure you want to permanently delete ${filenamesToDelete.length} selected photos? This will remove them from disk and clear all product and container image references instantly.`,
      "Delete Photos",
      async () => {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('freezerToken');
          const res = await authFetch(getApiUrl('api/photos/delete-bulk'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ filenames: filenamesToDelete })
          });

          if (res.ok) {
            showStatus('success', `Successfully deleted ${filenamesToDelete.length} photos and updated references!`);
            setSelectedFilenames({});
            await refreshAfterPhotoMutation();
          } else {
            showStatus('error', 'Failed to delete selected photos.');
          }
        } catch (e: any) {
          showStatus('error', `Error during bulk delete: ${e.message}`);
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  // Single Photo delete
  const handleDeletePhoto = (filename: string) => {
    askConfirm(
      "Delete Photo",
      `Permanently delete photo "${filename}"? All elements referencing this photo will have their image removed.`,
      "Delete Photo",
      async () => {
        setIsLoading(true);
        try {
          const token = localStorage.getItem('freezerToken');
          const res = await authFetch(getApiUrl('api/photos/delete-bulk'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ filenames: [filename] })
          });

          if (res.ok) {
            showStatus('success', `Photo "${filename}" deleted successfully.`);
            await refreshAfterPhotoMutation();
          } else {
            showStatus('error', 'Failed to delete photo.');
          }
        } catch (e: any) {
          showStatus('error', `Error: ${e.message}`);
        } finally {
          setIsLoading(false);
        }
      }
    );
  };

  // Unlink an attachment from a photo
  const handleUnlinkAttachment = (photo: PhotoItem, att: PhotoAttachment) => {
    askConfirm(
      "Unlink Image",
      `Remove this image from "${att.name}"?`,
      "Unlink Image",
      async () => {
        if (att.type === 'product') {
          await dispatch({
            type: 'EDIT_PRODUCT',
            payload: { productId: att.id, updates: { imageUrl: '' } }
          });
        } else if (att.type === 'container_template') {
          await dispatch({
            type: 'EDIT_CONTAINER_TEMPLATE',
            payload: { id: att.id, updates: { imageUrl: '' } }
          });
        } else {
          await dispatch({
            type: 'EDIT_CONTAINER',
            payload: { containerId: att.id, updates: { imageUrl: '' } }
          });
        }
        await fetchPhotos();
        const label = att.type === 'container_template' ? 'container template' : att.type;
        showStatus('success', `Successfully unlinked photo from ${label} "${att.name}".`);
      }
    );
  };

  // Auto Deduplication
  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await authFetch(getApiUrl('api/photos/deduplicate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (res.ok) {
        const result = await res.json();
        if (result.merged > 0) {
          showStatus('success', `✨ Cleanup Success! Merged ${result.merged} duplicate photos, saving ${formatSize(result.savedBytes)} of database disk space!`);
          await refreshAfterPhotoMutation();
        } else {
          showStatus('info', 'No duplicate photos were found. Your library is already fully optimized!');
        }
      } else {
        showStatus('error', 'Failed to perform photo deduplication on server.');
      }
    } catch (e: any) {
      showStatus('error', `Cleanup failed: ${e.message}`);
    } finally {
      setIsDeduplicating(false);
    }
  };

  // Convert File to Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Upload new photo and assign to missing element
  const handleElementFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!assigningElement || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsLoading(true);
    try {
      const base64 = await fileToBase64(file);
      
      let uploadRes;
      let isNetworkError = false;
      try {
        const token = localStorage.getItem('freezerToken');
        uploadRes = await authFetch(getApiUrl('api/upload'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ base64, filename: file.name })
        });
      } catch (fetchErr: any) {
        const errMsgLower = (fetchErr.message || '').toLowerCase();
        const isOffline = (typeof navigator !== 'undefined' && !navigator.onLine) ||
          fetchErr.name === 'AbortError' ||
          errMsgLower.includes('failed to fetch') ||
          errMsgLower.includes('network request failed') ||
          errMsgLower.includes('networkerror') ||
          errMsgLower.includes('load failed') ||
          errMsgLower.includes('failed to load') ||
          errMsgLower.includes('network error') ||
          errMsgLower.includes('connection refused') ||
          errMsgLower.includes('aborted');

        if (isOffline) {
          isNetworkError = true;
        } else {
          throw fetchErr;
        }
      }

      if (isNetworkError) {
        const offlineImgId = `offline-image-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
        const offlineUrl = `uploads/${offlineImgId}.jpg`;
        
        await saveOfflineImage({
          id: offlineImgId,
          base64,
          filename: file.name,
          savedAt: Date.now()
        });

        // Optimistically update the target element's photo and queue the action
        if (assigningElement.type === 'product') {
          await dispatch({
            type: 'EDIT_PRODUCT',
            payload: { productId: assigningElement.id, updates: { imageUrl: offlineUrl } }
          });
        } else if (assigningElement.type === 'container_template') {
          await dispatch({
            type: 'EDIT_CONTAINER_TEMPLATE',
            payload: { id: assigningElement.id, updates: { imageUrl: offlineUrl } }
          });
        } else {
          await dispatch({
            type: 'EDIT_CONTAINER',
            payload: { containerId: assigningElement.id, updates: { imageUrl: offlineUrl } }
          });
        }

        showStatus('success', `✨ Saved locally! You are currently offline. The photo for "${assigningElement.name}" was saved locally and will sync automatically when you reconnect.`);
        setAssigningElement(null);
        return;
      }

      if (!uploadRes) {
        showStatus('error', 'Image upload to server failed.');
        return;
      }

      if (uploadRes.ok) {
        const { imageUrl } = await uploadRes.json();
        const token = localStorage.getItem('freezerToken');
        // Assign to element
        const assignRes = await authFetch(getApiUrl('api/photos/assign'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            imageUrl,
            targetId: assigningElement.id,
            targetType: assigningElement.type
          })
        });

        if (assignRes.ok) {
          const label = assigningElement.type === 'container_template' ? 'container template' : assigningElement.type;
          showStatus('success', `Successfully uploaded and assigned photo to ${label} "${assigningElement.name}"!`);
          setAssigningElement(null);
          await refreshAfterPhotoMutation();
        } else {
          showStatus('error', 'Uploaded photo, but failed to assign to target.');
        }
      } else {
        showStatus('error', 'Image upload to server failed.');
      }
    } catch (err: any) {
      showStatus('error', `Error uploading photo: ${err.message}`);
    } finally {
      setIsLoading(false);
      if (elementFileInputRef.current) elementFileInputRef.current.value = '';
      if (elementCameraInputRef.current) elementCameraInputRef.current.value = '';
    }
  };

  // Assign existing photo to element
  const handleAssignExistingPhoto = async (photoUrl: string) => {
    if (!assigningElement) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await authFetch(getApiUrl('api/photos/assign'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          imageUrl: photoUrl,
          targetId: assigningElement.id,
          targetType: assigningElement.type
        })
      });

      if (res.ok) {
        const label = assigningElement.type === 'container_template' ? 'container template' : assigningElement.type;
        showStatus('success', `Assigned photo successfully to ${label} "${assigningElement.name}"!`);
        setAssigningElement(null);
        setShowExistingSelector(false);
        await refreshAfterPhotoMutation();
      } else {
        showStatus('error', 'Failed to assign existing photo.');
      }
    } catch (err: any) {
      showStatus('error', `Error assigning photo: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`${hideInternalHeader ? '' : 'mt-4 '}font-sans text-cool-gray-100 space-y-4`}>
      {!hideInternalHeader ? (
        <>
          {/* Photo Manager Header Card */}
          <div className="bg-cool-gray-850 rounded-xl border border-cool-gray-750/70 p-5 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-base font-extrabold text-cool-gray-100 flex items-center gap-2">
                  📸 Comprehensive Catalog Photo Library
                </h2>
                <p className="text-xs text-cool-gray-400 mt-1 max-w-2xl">
                  Inspect all uploaded catalog photos on central disk storage. Match redundant file duplicates, identify waste files unattached to any item, clean storage, or easily add photos to blank elements.
                </p>
              </div>
            </div>

            {statusMessage && (
              <div className={`mt-4 p-3.5 rounded-lg border text-xs flex items-center gap-2.5 animate-fadeIn ${
                statusMessage.type === 'success' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-250' : 
                statusMessage.type === 'error' ? 'bg-rose-955/40 border-rose-900 text-rose-200' : 
                'bg-cyan-955/40 border-cyan-800 text-cyan-200'
              }`}>
                {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
                <span className="font-semibold leading-relaxed">{statusMessage.text}</span>
              </div>
            )}
          </div>

          {/* Primary Sub-Tabs Controller */}
          <div className="flex border-b border-cool-gray-700/65 pb-0.5 gap-2">
            <button
              onClick={() => setSubTab('library')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                subTab === 'library'
                  ? 'border-b-2 border-cyan-500 text-cyan-300 bg-cool-gray-800/60'
                  : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850/40'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Active Photo Files ({photos.length})
            </button>
            
            <button
              onClick={() => setSubTab('missing')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                subTab === 'missing'
                  ? 'border-b-2 border-cyan-500 text-cyan-300 bg-cool-gray-800/60'
                  : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850/40'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Missing Photos ({elementsMissingPhotos.length})
            </button>
          </div>
        </>
      ) : statusMessage ? (
        <div className={`p-3.5 rounded-lg border text-xs flex items-center gap-2.5 animate-fadeIn ${
          statusMessage.type === 'success' ? 'bg-emerald-950/40 border-emerald-800 text-emerald-250' : 
          statusMessage.type === 'error' ? 'bg-rose-955/40 border-rose-900 text-rose-200' : 
          'bg-cyan-955/40 border-cyan-800 text-cyan-200'
        }`}>
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span className="font-semibold leading-relaxed">{statusMessage.text}</span>
        </div>
      ) : null}

      {/* SUBTAB 1: ACTIVE PHOTO LIBRARY */}
      {subTab === 'library' && (
        <div className="space-y-4">
          
          {/* Uniform Search & Condensed Filters Bar */}
          <CatalogSearchFilterBar
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search photo files by filename or attachment label..."
            isFiltersOpen={showLibraryFilters}
            onToggleFilters={() => setShowLibraryFilters(prev => !prev)}
            activeFilterCount={(filterType !== 'all' ? 1 : 0) + (sortBy !== 'newest' ? 1 : 0)}
            onResetFilters={() => {
              setSearchTerm('');
              setFilterType('all');
              setSortBy('newest');
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Attachment Status
                </label>
                <select
                  value={filterType}
                  onChange={(e: any) => setFilterType(e.target.value)}
                  className="w-full h-9 py-1 px-2.5 bg-cool-gray-900 border border-cool-gray-750 text-xs rounded-lg text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Photo Files</option>
                  <option value="attached">Attached (In Use)</option>
                  <option value="unattached">Unattached (Unused)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Sort Order
                </label>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="w-full h-9 py-1 px-2.5 bg-cool-gray-900 border border-cool-gray-750 text-xs rounded-lg text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="newest">Modified Date (Newest)</option>
                  <option value="oldest">Modified Date (Oldest)</option>
                  <option value="size_desc">File Size (Largest)</option>
                  <option value="size_asc">File Size (Smallest)</option>
                  <option value="name_asc">Filename (A-Z)</option>
                </select>
              </div>
            </div>
          </CatalogSearchFilterBar>

          {/* Bulk Action Selection Overlay Strip */}
          {selectedCount > 0 && (
            <div className="flex items-center justify-between p-3.5 bg-cyan-950/20 border-2 border-cyan-500/50 rounded-xl text-xs animate-slideDown">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-cyan-600 text-white font-extrabold flex items-center justify-center text-[10px]">
                  {selectedCount}
                </span>
                <span className="font-bold text-cyan-250">
                  selected file{selectedCount === 1 ? '' : 's'} to manage
                </span>
              </div>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-1.5 bg-rose-650 hover:bg-rose-550 text-white text-xs font-black rounded-lg shadow-md transition cursor-pointer flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected Photos ({selectedCount})</span>
              </button>
            </div>
          )}

          {/* Photos Grid Container */}
          {filteredAndSortedPhotos.length === 0 ? (
            <div className="bg-cool-gray-900/40 border border-cool-gray-800 rounded-xl p-12 text-center text-cool-gray-400">
              <ImageIcon className="w-12 h-12 text-cool-gray-650 mx-auto mb-3" />
              <p className="text-sm font-bold">No photo files match your criteria.</p>
              <p className="text-xs text-cool-gray-500 mt-1">Try resetting search string or active status filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              
              {/* Select All Checkbox Card */}
              <div className="col-span-full flex items-center pl-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-cool-gray-400 hover:text-white">
                  <input
                    type="checkbox"
                    checked={selectedCount === filteredAndSortedPhotos.length && filteredAndSortedPhotos.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 bg-cool-gray-950 border-cool-gray-750 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span className="font-bold uppercase tracking-wider text-[10px]">Select All Filtered Files</span>
                </label>
              </div>

              {filteredAndSortedPhotos.map((photo) => {
                const isSelected = !!selectedFilenames[photo.filename];
                const isUnattached = photo.attachments.length === 0;

                return (
                  <div
                    key={photo.filename}
                    className={`group transition-all duration-300 rounded-xl border flex flex-col justify-between overflow-hidden relative shadow-md hover:shadow-xl ${
                      isSelected 
                        ? 'bg-cool-gray-850 border-cyan-500 shadow-[0_0_15px_-3px_rgba(6,182,212,0.15)]' 
                        : 'bg-cool-gray-900/50 hover:bg-cool-gray-850/70 border-cool-gray-800 hover:border-cool-gray-700'
                    }`}
                  >
                    
                    {/* Top corner checkbox & trash */}
                    <div className="absolute top-2.5 left-2.5 z-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(photo.filename)}
                        className="w-4 h-4 rounded text-cyan-500 bg-cool-gray-950/80 border-cool-gray-700/60 focus:ring-cyan-500 cursor-pointer shadow"
                      />
                    </div>

                    <button
                      onClick={() => handleDeletePhoto(photo.filename)}
                      className="absolute top-2.5 right-2.5 z-10 p-1.5 bg-cool-gray-950/80 hover:bg-rose-950/90 border border-cool-gray-750/30 text-cool-gray-400 hover:text-rose-400 rounded-md transition duration-200 opacity-0 group-hover:opacity-100 shadow cursor-pointer"
                      title="Permanently Delete Photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Image visual wrapper */}
                    <div
                      onClick={() => openConnectPhotoModal(photo)}
                      className="relative aspect-video bg-cool-gray-950 overflow-hidden flex items-center justify-center border-b border-cool-gray-800 cursor-pointer"
                      title="Click to connect this photo to an item or container"
                    >
                      <img
                        src={resolveImageUrl(photo.url)}
                        alt={photo.filename}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        referrerPolicy="no-referrer"
                      />
                      
                      {/* Attached/Unattached overlay badge */}
                      <div className="absolute bottom-2 right-2 select-none">
                        {isUnattached ? (
                          <span className="text-[9px] font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded shadow-md backdrop-blur-xs flex items-center gap-0.5">
                            ⚠️ Unattached
                          </span>
                        ) : (
                          <span className="text-[9px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded shadow-md backdrop-blur-xs flex items-center gap-0.5">
                            ✔️ In Use ({photo.attachments.length})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta section */}
                    <div className="p-3.5 space-y-2.5 flex-grow flex flex-col justify-between">
                      <div>
                        <p className="text-xs font-bold text-cool-gray-150 truncate max-w-full font-mono mb-0.5" title={photo.filename}>
                          {photo.filename}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-cool-gray-450 font-semibold">
                          <span>{formatSize(photo.size)}</span>
                          <span>{formatDate(photo.mtime)}</span>
                        </div>
                      </div>

                      {/* Attached elements listing drawer */}
                      <div className="space-y-2 border-t border-cool-gray-800/80 pt-2 flex-grow flex flex-col justify-end">
                        {isUnattached ? (
                          <p className="text-[10px] text-cool-gray-500 italic leading-snug">
                            This image is unassigned. It is taking up space without being referenced by any products, container templates, or custom containers.
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {photo.attachments.map((att) => (
                              <div
                                key={`${att.type}-${att.id}`}
                                className="flex items-center justify-between bg-cool-gray-950 p-1.5 rounded border border-cool-gray-850 gap-2"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {att.type === 'product' ? (
                                    <Package className="w-3 h-3 text-emerald-400 shrink-0" />
                                  ) : att.type === 'container_template' ? (
                                    <Layers className="w-3 h-3 text-purple-400 shrink-0" />
                                  ) : (
                                    <Box className="w-3 h-3 text-cyan-400 shrink-0" />
                                  )}
                                  <span className="text-[10px] font-bold text-cool-gray-250 truncate leading-normal" title={att.name}>
                                    {att.name}
                                  </span>
                                  {att.type === 'container_template' && (
                                    <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-700/40 shrink-0">
                                      Template
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleUnlinkAttachment(photo, att)}
                                  className="text-cool-gray-500 hover:text-rose-400 p-0.5 transition shrink-0 cursor-pointer"
                                  title="Unlink Photo"
                                >
                                  <Unlink className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => openConnectPhotoModal(photo)}
                          className="w-full py-1.5 px-2.5 rounded-lg border border-cool-gray-700 hover:border-cyan-500/70 bg-cool-gray-950/80 hover:bg-cyan-950/30 text-cool-gray-200 hover:text-cyan-300 text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Link className="w-3 h-3" />
                          <span>Connect to Item / Container</span>
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </div>
      )}

      {/* SUBTAB 2: ELEMENTS MISSING PHOTOS */}
      {subTab === 'missing' && (
        <div className="space-y-4">
          
          {/* Missing elements search & condensed filters bar */}
          <CatalogSearchFilterBar
            searchValue={missingSearch}
            onSearchChange={setMissingSearch}
            searchPlaceholder="Search missing elements by name or category..."
            isFiltersOpen={showMissingFilters}
            onToggleFilters={() => setShowMissingFilters(prev => !prev)}
            activeFilterCount={(missingFilter !== 'all' ? 1 : 0) + (missingSortBy !== 'name_asc' ? 1 : 0)}
            onResetFilters={() => {
              setMissingSearch('');
              setMissingFilter('all');
              setMissingSortBy('name_asc');
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Catalog Type
                </label>
                <select
                  value={missingFilter}
                  onChange={(e) => setMissingFilter(e.target.value as any)}
                  className="w-full h-9 py-1 px-2.5 bg-cool-gray-900 border border-cool-gray-750 text-xs rounded-lg text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Missing ({(state.products || []).filter(p => !p.imageUrl).length + (state.containerTemplates || []).filter(t => !t.imageUrl).length + (state.containers || []).filter(c => !c.imageUrl && c.id !== 'staging_loose' && !c.id.endsWith('_loose')).length})</option>
                  <option value="product">Products Only ({(state.products || []).filter(p => !p.imageUrl).length})</option>
                  <option value="container_template">Container Templates Only ({(state.containerTemplates || []).filter(t => !t.imageUrl).length})</option>
                  <option value="container">Containers Only ({(state.containers || []).filter(c => !c.imageUrl && c.id !== 'staging_loose' && !c.id.endsWith('_loose')).length})</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                  Sort Order
                </label>
                <select
                  value={missingSortBy}
                  onChange={(e) => setMissingSortBy(e.target.value as any)}
                  className="w-full h-9 py-1 px-2.5 bg-cool-gray-900 border border-cool-gray-750 text-xs rounded-lg text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="name_asc">Name: A to Z</option>
                  <option value="name_desc">Name: Z to A</option>
                  <option value="type_first">Group by Type</option>
                </select>
              </div>
            </div>
          </CatalogSearchFilterBar>

          {/* Missing list rendering */}
          {elementsMissingPhotos.length === 0 ? (
            <div className="bg-cool-gray-900/40 border border-cool-gray-800 rounded-xl p-12 text-center text-cool-gray-400">
              <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-bold">Incredible! All elements in your catalog have photos attached.</p>
              <p className="text-xs text-cool-gray-500 mt-1">Excellent work compiling high quality catalog assets.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {elementsMissingPhotos.map((elem) => (
                <div
                  key={`${elem.type}-${elem.id}`}
                  className="bg-cool-gray-900/40 hover:bg-cool-gray-850/50 p-4 rounded-xl border border-cool-gray-800/80 flex items-center justify-between gap-4 transition duration-200"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`p-2.5 rounded-lg shrink-0 ${
                      elem.type === 'product'
                        ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40'
                        : elem.type === 'container_template'
                          ? 'bg-purple-950/30 text-purple-400 border border-purple-900/40'
                          : 'bg-cyan-950/30 text-cyan-400 border border-cyan-900/40'
                    }`}>
                      {elem.type === 'product' ? <Package className="w-5 h-5" /> : elem.type === 'container_template' ? <Layers className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-cool-gray-150 truncate leading-normal">
                        {elem.name}
                      </p>
                      {elem.details && (
                        <p className="text-xs text-cool-gray-450 truncate mt-0.5 leading-normal">
                          {elem.details}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setAssigningElement(elem);
                        setShowExistingSelector(true);
                      }}
                      className="px-3 py-1.5 border border-cool-gray-700 hover:border-cyan-500 hover:bg-cyan-950/20 text-cool-gray-300 hover:text-cyan-300 text-xs font-bold rounded-lg transition select-none flex items-center gap-1 cursor-pointer"
                      title="Choose an existing image file to avoid duplicates"
                    >
                      <Link className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Use Existing</span>
                    </button>

                    <button
                      onClick={() => {
                        setAssigningElement(elem);
                        setShowExistingSelector(false);
                        setTimeout(() => elementCameraInputRef.current?.click(), 100);
                      }}
                      className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black rounded-lg shadow-md transition select-none flex items-center gap-1 cursor-pointer"
                      title="Open device camera to take a photo"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Take Photo</span>
                    </button>

                    <button
                      onClick={() => {
                        setAssigningElement(elem);
                        setShowExistingSelector(false);
                        setTimeout(() => elementFileInputRef.current?.click(), 100);
                      }}
                      className="px-3 py-1.5 border border-cool-gray-700 hover:bg-cool-gray-750 text-cool-gray-200 text-xs font-bold rounded-lg transition select-none flex items-center gap-1 cursor-pointer"
                      title="Upload a new photo file from device"
                    >
                      <Upload className="w-3.5 h-3.5 text-purple-400" />
                      <span className="hidden sm:inline">Upload File</span>
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* Invisible Element File input uploader triggers */}
          <input
            ref={elementCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleElementFileUpload}
            className="hidden"
          />

          <input
            ref={elementFileInputRef}
            type="file"
            accept="image/*"
            onChange={handleElementFileUpload}
            className="hidden"
          />

        </div>
      )}

      {/* ASSIGNING DIALOG: POPUP SELECTOR FOR EXISTING PHOTOS */}
      {assigningElement && showExistingSelector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-sans animate-fadeIn"
          onClick={() => {
            setAssigningElement(null);
            setShowExistingSelector(false);
          }}
        >
          <div
            className="w-full max-w-2xl p-6 bg-cool-gray-800 border border-cool-gray-750 rounded-xl shadow-2xl animate-scaleUp max-h-[85vh] flex flex-col justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3.5 border-b border-cool-gray-700/80 mb-4 shrink-0">
              <h4 className="text-sm font-extrabold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                🔗 Assign Existing Photo
              </h4>
              <button
                onClick={() => {
                  setAssigningElement(null);
                  setShowExistingSelector(false);
                }}
                className="text-cool-gray-450 hover:text-white text-xs transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-cool-gray-300 mb-4 leading-relaxed shrink-0">
              Assign one of your existing uploaded photos to the {assigningElement.type === 'container_template' ? 'container template' : assigningElement.type} <span className="font-extrabold text-cyan-300">"{assigningElement.name}"</span>. This reuses files and keeps backups highly optimized without duplicates!
            </p>

            {photos.length === 0 ? (
              <div className="p-8 text-center bg-cool-gray-900 border border-cool-gray-750 rounded-lg shrink-0">
                <p className="text-xs text-cool-gray-400">You haven't uploaded any photos to the library yet.</p>
                <button
                  onClick={() => {
                    setShowExistingSelector(false);
                    setTimeout(() => elementFileInputRef.current?.click(), 100);
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 text-white font-bold text-xs rounded-md shadow"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload Now
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto pr-1 flex-grow mb-4 max-h-[45vh]">
                {photos.map((p) => (
                  <button
                    key={p.filename}
                    onClick={() => handleAssignExistingPhoto(p.url)}
                    className="group border border-cool-gray-700 hover:border-cyan-500 bg-cool-gray-900 hover:bg-cool-gray-850 p-2 rounded-xl text-left flex flex-col justify-between transition gap-2 cursor-pointer focus:outline-none"
                  >
                    <div className="aspect-video w-full rounded overflow-hidden bg-cool-gray-950 relative">
                      <img
                        src={resolveImageUrl(p.url)}
                        alt={p.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-cool-gray-300 truncate max-w-full font-mono mb-0.5" title={p.filename}>
                        {p.filename}
                      </p>
                      <p className="text-[9px] text-cool-gray-500 font-semibold uppercase">
                        {p.attachments.length} attachment{p.attachments.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-cool-gray-700/80 shrink-0">
              <button
                onClick={() => {
                  setAssigningElement(null);
                  setShowExistingSelector(false);
                }}
                className="px-4 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONNECT PHOTO TO ITEM OR CONTAINER MODAL */}
      {connectingPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs font-sans animate-fadeIn"
          onClick={closeConnectPhotoModal}
        >
          <div
            className="w-full max-w-3xl p-5 sm:p-6 bg-cool-gray-800 border border-cool-gray-750 rounded-xl shadow-2xl animate-scaleUp max-h-[88vh] flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-start gap-3 pb-3.5 border-b border-cool-gray-700/80 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-16 h-12 rounded-lg overflow-hidden bg-cool-gray-950 border border-cool-gray-700 shrink-0">
                  <img
                    src={resolveImageUrl(connectingPhoto.url)}
                    alt={connectingPhoto.filename}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-extrabold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Link className="w-4 h-4 shrink-0" />
                    <span>Connect Photo to Item or Container</span>
                  </h4>
                  <p className="text-[11px] text-cool-gray-300 font-mono truncate mt-0.5" title={connectingPhoto.filename}>
                    {connectingPhoto.filename}
                  </p>
                  <p className="text-[10px] text-cool-gray-400 mt-0.5">
                    {formatSize(connectingPhoto.size)} · Currently attached to {connectingPhoto.attachments.length} object{connectingPhoto.attachments.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeConnectPhotoModal}
                className="text-cool-gray-450 hover:text-white text-sm p-1 transition cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Feedback Banner */}
            {connectFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 shrink-0 ${
                  connectFeedback.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-900 text-rose-200'
                }`}
              >
                {connectFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span className="font-semibold">{connectFeedback.text}</span>
              </div>
            )}

            {/* Search & Filters */}
            <div className="space-y-3 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-cool-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={connectSearch}
                  onChange={(e) => setConnectSearch(e.target.value)}
                  placeholder="Search items, container templates, or containers by name..."
                  className="w-full pl-9 pr-8 py-2 bg-cool-gray-900 border border-cool-gray-700 rounded-lg text-xs text-white placeholder-cool-gray-400 focus:outline-none focus:border-cyan-500"
                />
                {connectSearch && (
                  <button
                    type="button"
                    onClick={() => setConnectSearch('')}
                    className="absolute right-2.5 top-2.5 text-cool-gray-400 hover:text-white cursor-pointer"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Object Type Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Object Type
                  </label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
                    {(
                      [
                        { id: 'all', label: 'All' },
                        { id: 'product', label: 'Items' },
                        { id: 'container', label: 'Containers' },
                        { id: 'container_template', label: 'Templates' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setConnectTypeFilter(opt.id)}
                        className={`px-2 py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer truncate ${
                          connectTypeFilter === opt.id
                            ? 'bg-cyan-600 text-white shadow'
                            : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Photo Status Filter */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider block">
                    Photo Status
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-cool-gray-900 border border-cool-gray-750 rounded-lg">
                    {(
                      [
                        { id: 'all', label: `All (${connectPhotoStatusCounts.all})` },
                        { id: 'without_photo', label: `Without (${connectPhotoStatusCounts.withoutPhoto})` },
                        { id: 'with_photo', label: `With Photo (${connectPhotoStatusCounts.withPhoto})` },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setConnectPhotoFilter(opt.id)}
                        className={`px-2 py-1.5 text-[11px] font-bold rounded-md transition cursor-pointer truncate ${
                          connectPhotoFilter === opt.id
                            ? 'bg-cyan-600 text-white shadow'
                            : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-850'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Matching Objects List */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {filteredConnectableObjects.length === 0 ? (
                <div className="py-10 px-4 text-center bg-cool-gray-900/50 border border-cool-gray-750 rounded-lg">
                  <ImageIcon className="w-9 h-9 text-cool-gray-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-cool-gray-300">No items or containers match these filters.</p>
                  <p className="text-[11px] text-cool-gray-500 mt-1">Try adjusting your search or photo status filter.</p>
                </div>
              ) : (
                filteredConnectableObjects.map((obj) => {
                  const objKey = `${obj.type}-${obj.id}`;
                  const isBusy = connectBusyKey === objKey;
                  const isAlreadyConnected = doesImageUrlMatchFilename(obj.imageUrl, connectingPhoto.filename);
                  const hasOtherPhoto = !!obj.imageUrl && !isAlreadyConnected;

                  return (
                    <div
                      key={objKey}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition ${
                        isAlreadyConnected
                          ? 'bg-emerald-950/20 border-emerald-700/60'
                          : 'bg-cool-gray-900/70 border-cool-gray-750 hover:border-cool-gray-650'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-cool-gray-950 border border-cool-gray-800 flex items-center justify-center shrink-0">
                          {obj.imageUrl ? (
                            <img
                              src={resolveImageUrl(obj.imageUrl)}
                              alt={obj.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : obj.type === 'product' ? (
                            <Package className="w-5 h-5 text-emerald-400" />
                          ) : obj.type === 'container_template' ? (
                            <Layers className="w-5 h-5 text-purple-400" />
                          ) : (
                            <Box className="w-5 h-5 text-cyan-400" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-xs font-bold text-cool-gray-100 truncate">
                              {obj.name}
                            </p>
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                                obj.type === 'product'
                                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/40'
                                  : obj.type === 'container_template'
                                    ? 'bg-purple-950/60 text-purple-300 border-purple-700/40'
                                    : 'bg-cyan-950/60 text-cyan-300 border-cyan-700/40'
                              }`}
                            >
                              {obj.type === 'product'
                                ? 'Item'
                                : obj.type === 'container_template'
                                  ? 'Template'
                                  : 'Container'}
                            </span>
                            {obj.isArchived && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-cool-gray-800 text-cool-gray-400 border border-cool-gray-700 shrink-0">
                                Archived
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-cool-gray-400 truncate mt-0.5">
                            {obj.details || (obj.type === 'product' ? 'Product' : 'Container')}
                            {' · '}
                            {isAlreadyConnected ? (
                              <span className="text-emerald-400 font-semibold">Connected to this photo</span>
                            ) : hasOtherPhoto ? (
                              <span className="text-amber-300">Has existing photo</span>
                            ) : (
                              <span className="text-cool-gray-500">No photo</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isAlreadyConnected ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConnectPhotoToTarget(obj, 'unlink')}
                            className="px-3 py-1.5 rounded-lg border border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                            <span>{isBusy ? 'Unlinking...' : 'Unlink'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleConnectPhotoToTarget(obj, 'connect')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                              hasOtherPhoto
                                ? 'border border-amber-600/60 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200'
                                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow'
                            }`}
                          >
                            <Link className="w-3.5 h-3.5" />
                            <span>
                              {isBusy ? 'Saving...' : hasOtherPhoto ? 'Replace Photo' : 'Connect'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-cool-gray-700/80 shrink-0 text-xs text-cool-gray-400">
              <span>
                Showing {filteredConnectableObjects.length} of {allConnectableObjects.length} objects
              </span>
              <button
                type="button"
                onClick={closeConnectPhotoModal}
                className="px-4 py-1.5 bg-cool-gray-700 hover:bg-cool-gray-650 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION OVERLAY */}
      {customConfirm.isOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans animate-fadeIn"
          onClick={() => setCustomConfirm(prev => ({ ...prev, isOpen: false }))}
        >
          <div
            className="w-full max-w-md p-6 bg-cool-gray-800 border border-cool-gray-750 rounded-xl shadow-2xl animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-cool-gray-700/80 mb-4">
              <h4 className="text-sm font-extrabold uppercase tracking-widest text-rose-400 flex items-center gap-2">
                ⚠️ {customConfirm.title}
              </h4>
              <button
                onClick={() => setCustomConfirm(prev => ({ ...prev, isOpen: false }))}
                className="text-cool-gray-450 hover:text-white text-xs transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-cool-gray-200 mb-6 leading-relaxed">
              {customConfirm.message}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-cool-gray-700/80">
              <button
                onClick={() => setCustomConfirm(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-cool-gray-700 hover:bg-cool-gray-650 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (customConfirm.onConfirm) {
                    customConfirm.onConfirm();
                  }
                }}
                className="px-5 py-2 bg-rose-650 hover:bg-rose-550 text-white rounded-lg text-xs font-black transition cursor-pointer"
              >
                {customConfirm.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
