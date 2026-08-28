import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InventoryState, Action, Product, Container } from '../types';
import { getApiUrl } from '../hooks/apiUrl';
import { 
  Image as ImageIcon, Trash2, Search, Filter, ArrowUpDown, Sparkles, 
  Upload, Check, Plus, AlertTriangle, Link, Unlink, RefreshCw, X, ChevronRight, CheckCircle2, Box, Package, Camera
} from 'lucide-react';

interface PhotoAttachment {
  id: string;
  name: string;
  type: 'product' | 'container';
}

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
}

export function PhotoManagerView({ state, dispatch }: PhotoManagerViewProps) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'attached' | 'unattached'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'size_desc' | 'size_asc' | 'name_asc'>('newest');
  
  // Bulk selection
  const [selectedFilenames, setSelectedFilenames] = useState<{ [filename: string]: boolean }>({});
  
  // Tabs inside photo manager
  const [subTab, setSubTab] = useState<'library' | 'missing'>('library');
  const [missingSearch, setMissingSearch] = useState('');
  const [missingFilter, setMissingFilter] = useState<'all' | 'product' | 'container'>('all');

  // Assign photo modal or inline state
  const [assigningElement, setAssigningElement] = useState<{ id: string; name: string; type: 'product' | 'container' } | null>(null);
  const [showExistingSelector, setShowExistingSelector] = useState(false);
  
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
      const res = await fetch(getApiUrl('api/photos'), {
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

  // Elements missing photos
  const elementsMissingPhotos = useMemo(() => {
    const missing: Array<{ id: string; name: string; type: 'product' | 'container'; details?: string }> = [];

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
    if (missingSearch.trim()) {
      const low = missingSearch.toLowerCase();
      return missing.filter(elem => elem.name.toLowerCase().includes(low) || (elem.details && elem.details.toLowerCase().includes(low)));
    }

    return missing;
  }, [state, missingFilter, missingSearch]);

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
          const res = await fetch(getApiUrl('api/photos/delete-bulk'), {
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
            // Trigger reload on hook
            dispatch({ type: 'UNDO' }).then(() => {
              dispatch({ type: 'REDO' });
            });
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
          const res = await fetch(getApiUrl('api/photos/delete-bulk'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ filenames: [filename] })
          });

          if (res.ok) {
            showStatus('success', `Photo "${filename}" deleted successfully.`);
            // Reload parent hook context
            dispatch({ type: 'UNDO' }).then(() => dispatch({ type: 'REDO' }));
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
            payload: { productId: att.id, updates: { imageUrl: undefined } }
          });
        } else {
          await dispatch({
            type: 'EDIT_CONTAINER',
            payload: { containerId: att.id, updates: { imageUrl: undefined } }
          });
        }
        showStatus('success', `Successfully unlinked photo from ${att.type} "${att.name}".`);
      }
    );
  };

  // Auto Deduplication
  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl('api/photos/deduplicate'), {
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
          dispatch({ type: 'UNDO' }).then(() => dispatch({ type: 'REDO' }));
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
      const token = localStorage.getItem('freezerToken');
      const uploadRes = await fetch(getApiUrl('api/upload'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ base64, filename: file.name })
      });

      if (uploadRes.ok) {
        const { imageUrl } = await uploadRes.json();
        // Assign to element
        const assignRes = await fetch(getApiUrl('api/photos/assign'), {
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
          showStatus('success', `Successfully uploaded and assigned photo to ${assigningElement.type} "${assigningElement.name}"!`);
          setAssigningElement(null);
          // Trigger hook context updates
          dispatch({ type: 'UNDO' }).then(() => dispatch({ type: 'REDO' }));
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
    }
  };

  // Assign existing photo to element
  const handleAssignExistingPhoto = async (photoUrl: string) => {
    if (!assigningElement) return;

    setIsLoading(true);
    try {
      const token = localStorage.getItem('freezerToken');
      const res = await fetch(getApiUrl('api/photos/assign'), {
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
        showStatus('success', `Assigned photo successfully to ${assigningElement.type} "${assigningElement.name}"!`);
        setAssigningElement(null);
        setShowExistingSelector(false);
        // Refresh hook context
        dispatch({ type: 'UNDO' }).then(() => dispatch({ type: 'REDO' }));
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
    <div className="mt-4 font-sans text-cool-gray-100 space-y-6">
      
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

        {/* Local Status Message Tray */}
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

      {/* SUBTAB 1: ACTIVE PHOTO LIBRARY */}
      {subTab === 'library' && (
        <div className="space-y-4">
          
          {/* Controls Bar: Search, Filters, Sorting */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-cool-gray-855 p-3.5 rounded-xl border border-cool-gray-750/70">
            <div className="relative w-full md:max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-cool-gray-500" />
              </span>
              <input
                type="text"
                placeholder="Search photo files by filename or attachment label..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-8.5 pl-9 pr-8 bg-cool-gray-950 border border-cool-gray-750 rounded-lg text-xs text-white placeholder-cool-gray-550 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-cool-gray-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              
              {/* Filter selection */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-cool-gray-450 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Status:
                </span>
                <select
                  value={filterType}
                  onChange={(e: any) => setFilterType(e.target.value)}
                  className="h-8.5 py-1 px-2.5 bg-cool-gray-950 border border-cool-gray-750 text-xs rounded-lg text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="all">All Photo Files</option>
                  <option value="attached">Attached (In Use)</option>
                  <option value="unattached">Unattached (Waste)</option>
                </select>
              </div>

              {/* Sorting selection */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-extrabold tracking-wider text-cool-gray-450 flex items-center gap-1">
                  <ArrowUpDown className="w-3 h-3" /> Sort:
                </span>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="h-8.5 py-1 px-2.5 bg-cool-gray-950 border border-cool-gray-750 text-xs rounded-lg text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="newest">Modified Date (Newest)</option>
                  <option value="oldest">Modified Date (Oldest)</option>
                  <option value="size_desc">File Size (Largest)</option>
                  <option value="size_asc">File Size (Smallest)</option>
                  <option value="name_asc">Filename (A-Z)</option>
                </select>
              </div>

            </div>
          </div>

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
                    <div className="relative aspect-video bg-cool-gray-950 overflow-hidden flex items-center justify-center border-b border-cool-gray-800">
                      <img
                        src={photo.url}
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
                      <div className="space-y-1.5 border-t border-cool-gray-800/80 pt-2 flex-grow flex flex-col justify-end">
                        {isUnattached ? (
                          <p className="text-[10px] text-cool-gray-500 italic leading-snug">
                            This image is unassigned. It is taking up space without being referenced by any products or custom containers.
                          </p>
                        ) : (
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {photo.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center justify-between bg-cool-gray-950 p-1.5 rounded border border-cool-gray-850 gap-2"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {att.type === 'product' ? (
                                    <Package className="w-3 h-3 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Box className="w-3 h-3 text-cyan-400 shrink-0" />
                                  )}
                                  <span className="text-[10px] font-bold text-cool-gray-250 truncate leading-normal" title={att.name}>
                                    {att.name}
                                  </span>
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
          
          {/* Missing elements filter row */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-cool-gray-855 p-3.5 rounded-xl border border-cool-gray-750/70">
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-cool-gray-500" />
              </span>
              <input
                type="text"
                placeholder="Search missing elements by name or category..."
                value={missingSearch}
                onChange={(e) => setMissingSearch(e.target.value)}
                className="w-full h-8.5 pl-9 pr-8 bg-cool-gray-950 border border-cool-gray-750 rounded-lg text-xs text-white placeholder-cool-gray-550 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {missingSearch && (
                <button
                  onClick={() => setMissingSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-cool-gray-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 bg-cool-gray-950 p-0.5 rounded-lg border border-cool-gray-850">
              <button
                onClick={() => setMissingFilter('all')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer select-none ${
                  missingFilter === 'all' ? 'bg-cyan-600 text-white font-black' : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                All Missing
              </button>
              <button
                onClick={() => setMissingFilter('product')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer select-none ${
                  missingFilter === 'product' ? 'bg-cyan-600 text-white font-black' : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                Products ({ (state.products || []).filter(p => !p.imageUrl).length })
              </button>
              <button
                onClick={() => setMissingFilter('container')}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition cursor-pointer select-none ${
                  missingFilter === 'container' ? 'bg-cyan-600 text-white font-black' : 'text-cool-gray-400 hover:text-white'
                }`}
              >
                Containers ({ (state.containers || []).filter(c => !c.imageUrl && c.id !== 'staging_loose' && !c.id.endsWith('_loose')).length })
              </button>
            </div>
          </div>

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
                      elem.type === 'product' ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40' : 'bg-cyan-950/30 text-cyan-400 border border-cyan-900/40'
                    }`}>
                      {elem.type === 'product' ? <Package className="w-5 h-5" /> : <Box className="w-5 h-5" />}
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
              Assign one of your existing uploaded photos to the {assigningElement.type} <span className="font-extrabold text-cyan-300">"{assigningElement.name}"</span>. This reuses files and keeps backups highly optimized without duplicates!
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
                        src={p.url}
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
