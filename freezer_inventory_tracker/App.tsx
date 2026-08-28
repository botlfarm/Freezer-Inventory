import React, { useState, useMemo } from 'react';
import { useInventory } from './hooks/useInventory';
import { getApiUrl } from './hooks/apiUrl';
import { ModalType, View } from './types';
import { Undo, Redo, Tag, PackagePlus, History, Sparkles, Table, Package, ClipboardList, Sun, Moon, Filter, Plus, Download, ChevronDown, ChevronUp, Eye, AlertTriangle, RefreshCw } from 'lucide-react';
import { FreezerIcon, SearchIcon, GridViewIcon, ListViewIcon } from './components/icons';
import Modal from './components/Modal';
import AddForms from './components/AddForms';
import { ManagementForms } from './components/ManagementForms';
import HistoryModalContent from './components/HistoryModalContent';
import MoveModalContent from './components/MoveModalContent';
import EditNoteModalContent from './components/EditNoteModalContent';
import { CorrectWrongLabelModalContent } from './components/CorrectWrongLabelModalContent';
import { UnifiedInboundMoveForm } from './components/UnifiedInboundMoveForm';
import FreezerView from './views/FreezerView';
import ProductView from './views/ProductView';
import { DisplayCaseView } from './views/DisplayCaseView';
import LibraryView, { ManageLists } from './views/LibraryView';
import HistoryView from './views/HistoryView';
import ReconciliationView from './views/ReconciliationView';
import { DataImportView } from './views/DataImportView';
import { AddToListModalContent } from './components/AddToListModalContent';
import { SelectTagsModalContent } from './components/SelectTagsModalContent';
import { SplitItemModalContent } from './components/SplitItemModalContent';
import { ListThresholdAlertModalContent } from './components/ListThresholdAlertModalContent';
import { OffSiteStorageView } from './views/OffSiteStorageView';
import { AdvancedFilterMenu } from './views/OffSiteSpreadsheet';
import { ButcherRecordsView } from './views/ButcherRecordsView';
import { ProductQuickInfoModal } from './components/ProductQuickInfoModal';
import { ActiveMovementModal } from './views/ActiveMovementModal';
import { useHomeAssistantTheme } from './hooks/useHomeAssistantTheme';

export default function App() {
  useHomeAssistantTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [expandedImage, setExpandedImage] = useState<{ src: string; title: string } | null>(null);
  const headerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const handleResize = () => {
      const height = header.offsetHeight;
      document.documentElement.style.setProperty('--header-height', `${height}px`);
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    observer.observe(header);
    return () => {
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    (window as any).__showImagePreview = (src: string, title: string) => {
      setExpandedImage({ src, title });
    };
    return () => {
      delete (window as any).__showImagePreview;
    };
  }, []);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled((prev) => {
        if (!prev && window.scrollY > 80) return true;
        if (prev && window.scrollY < 20) return false;
        return prev;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Global drag-and-drop auto-scrolling effect
  React.useEffect(() => {
    let scrollInterval: number | null = null;
    let currentDelta = 0;

    const startScrolling = () => {
      if (!scrollInterval) {
        scrollInterval = window.setInterval(() => {
          window.scrollBy({ top: currentDelta, behavior: 'auto' });
        }, 16); // roughly 60fps
      }
    };

    const stopScrolling = () => {
      if (scrollInterval) {
        window.clearInterval(scrollInterval);
        scrollInterval = null;
      }
    };

    const handleDragOver = (e: DragEvent) => {
      const threshold = 120; // Distance from edge (px)
      const maxSpeed = 15;
      const { clientY } = e;
      const { innerHeight } = window;

      if (clientY < threshold) {
        currentDelta = -maxSpeed * (1 - Math.max(0, clientY) / threshold);
        startScrolling();
      } else if (innerHeight - clientY < threshold) {
        currentDelta = maxSpeed * (1 - Math.max(0, (innerHeight - clientY)) / threshold);
        startScrolling();
      } else {
        stopScrolling();
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', stopScrolling);
    window.addEventListener('dragend', stopScrolling);
    
    const handleDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget || (e.relatedTarget as HTMLElement).nodeName === 'HTML') {
        stopScrolling();
      }
    };
    window.addEventListener('dragleave', handleDragLeave);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', stopScrolling);
      window.removeEventListener('dragend', stopScrolling);
      window.removeEventListener('dragleave', handleDragLeave);
      stopScrolling();
    };
  }, []);

  const {
    state,
    dispatch,
    isLoading,
    refreshState,
    undoStack,
    redoStack,
    isPendingSync,
    clientId,
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
  } = useInventory();

  const [isDemoTransitioning, setIsDemoTransitioning] = useState(false);
  const [isPreviewTransitioning, setIsPreviewTransitioning] = useState(false);
  const [readOnlyNoticeModal, setReadOnlyNoticeModal] = useState<{ isOpen: boolean; message?: string }>({ isOpen: false });
  const [actionErrorModal, setActionErrorModal] = useState<{
    isOpen: boolean;
    message?: string;
    details?: string;
    actionType?: string;
  }>({ isOpen: false });

  const handleStartDemo = async () => {
    setIsDemoTransitioning(true);
    try {
      const res = await fetch(getApiUrl('api/demo/start'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        await refreshState();
      } else {
        const errData = await res.json();
        alert(`Failed to start demo: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Network error starting demo: ${err.message}`);
    } finally {
      setIsDemoTransitioning(false);
    }
  };

  const handleEndDemo = async () => {
    setIsDemoTransitioning(true);
    try {
      const res = await fetch(getApiUrl('api/demo/end'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        await refreshState();
      } else {
        const errData = await res.json();
        alert(`Failed to end demo: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Network error ending demo: ${err.message}`);
    } finally {
      setIsDemoTransitioning(false);
    }
  };

  const handleStartPreviewMode = async (filename: string) => {
    setIsPreviewTransitioning(true);
    try {
      const res = await fetch(getApiUrl('api/backups/preview-mode/start'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ filename })
      });
      if (res.ok) {
        await refreshState();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to start live preview mode: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Network error starting live preview mode: ${err.message}`);
    } finally {
      setIsPreviewTransitioning(false);
    }
  };

  const handleEndPreviewMode = async () => {
    setIsPreviewTransitioning(true);
    try {
      const res = await fetch(getApiUrl('api/backups/preview-mode/end'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        await refreshState();
        setReadOnlyNoticeModal({ isOpen: false });
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to exit preview mode: ${errData.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Network error exiting preview mode: ${err.message}`);
    } finally {
      setIsPreviewTransitioning(false);
    }
  };

  React.useEffect(() => {
    (window as any).__startDemoMode = handleStartDemo;
    (window as any).__endDemoMode = handleEndDemo;
    (window as any).__startPreviewMode = handleStartPreviewMode;
    (window as any).__endPreviewMode = handleEndPreviewMode;

    const handleReadOnlyAttempt = (e: any) => {
      setReadOnlyNoticeModal({
        isOpen: true,
        message: e.detail?.message
      });
    };
    const handleActionError = (e: any) => {
      setActionErrorModal({
        isOpen: true,
        message: e.detail?.message || 'Failed to apply change on the server.',
        details: e.detail?.details,
        actionType: e.detail?.actionType
      });
    };
    window.addEventListener('read-only-preview-attempt', handleReadOnlyAttempt);
    window.addEventListener('action-error-occurred', handleActionError);

    return () => {
      delete (window as any).__startDemoMode;
      delete (window as any).__endDemoMode;
      delete (window as any).__startPreviewMode;
      delete (window as any).__endPreviewMode;
      window.removeEventListener('read-only-preview-attempt', handleReadOnlyAttempt);
      window.removeEventListener('action-error-occurred', handleActionError);
    };
  }, [refreshState]);

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [promptQueue, setPromptQueue] = useState<any[]>([]);
  const [quickInfoItem, setQuickInfoItem] = useState<any | null>(null);

  const handleFilterPalletFromModal = (pallet: string) => {
    setCurrentView('offsite');
    setTimeout(() => {
      if ((window as any).__setOffSiteFilters) {
        (window as any).__setOffSiteFilters(pallet, undefined);
      }
    }, 120);
  };

  const handleFilterLocationFromModal = (location: string) => {
    setCurrentView('offsite');
    setTimeout(() => {
      if ((window as any).__setOffSiteFilters) {
        (window as any).__setOffSiteFilters(undefined, location);
      }
    }, 120);
  };

  React.useEffect(() => {
    (window as any).__showProductQuickInfo = (item: any) => {
      setQuickInfoItem(item);
    };
    return () => {
      delete (window as any).__showProductQuickInfo;
    };
  }, []);
  const prevMapsRef = React.useRef<{
    onsite: Record<string, number>;
    offsiteCount: Record<string, number>;
    offsiteWeight: Record<string, number>;
    total: Record<string, number>;
  }>({ onsite: {}, offsiteCount: {}, offsiteWeight: {}, total: {} });
  const isInitialLoadRef = React.useRef<boolean>(true);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isSyncMenuOpen, setIsSyncMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentView, setCurrentView] = useState<View>('product');

  // Off-Site Lifted States & Refs
  const [offsiteSubTab, setOffsiteSubTab] = useState<'sheet' | 'import' | 'hierarchy' | 'history' | 'active-movement' | 'staging-worksheet'>('sheet');

  React.useEffect(() => {
    (window as any).__setOffSiteSubTab = setOffsiteSubTab;
    return () => {
      delete (window as any).__setOffSiteSubTab;
    };
  }, []);
  const [offsiteSearch, setOffsiteSearch] = useState(() => localStorage.getItem("offsite-search") || '');
  const [offsiteSearchFilterOpen, setOffsiteSearchFilterOpen] = useState(false);
  const [offsiteAdvancedFilterOpen, setOffsiteAdvancedFilterOpen] = useState(false);
  const [offsiteDirectEdit, setOffsiteDirectEdit] = useState(false);
  const [offsiteViewOriginalNames, setOffsiteViewOriginalNames] = useState(() => localStorage.getItem("offsite-view-original-names") === "true");
  const [offsiteFilterTags, setOffsiteFilterTags] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("offsite-filter-tags");
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch (e) {}
    }
    return new Set();
  });
  const [offsiteFilterLists, setOffsiteFilterLists] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("offsite-filter-lists");
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch (e) {}
    }
    return new Set();
  });

  React.useEffect(() => {
    localStorage.setItem("offsite-search", offsiteSearch);
  }, [offsiteSearch]);

  React.useEffect(() => {
    localStorage.setItem("offsite-view-original-names", String(offsiteViewOriginalNames));
  }, [offsiteViewOriginalNames]);

  React.useEffect(() => {
    localStorage.setItem("offsite-filter-tags", JSON.stringify(Array.from(offsiteFilterTags)));
  }, [offsiteFilterTags]);

  React.useEffect(() => {
    localStorage.setItem("offsite-filter-lists", JSON.stringify(Array.from(offsiteFilterLists)));
  }, [offsiteFilterLists]);
  const [offsiteViewUngrouped, setOffsiteViewUngrouped] = useState(() => localStorage.getItem("offsite-view-ungrouped") === "true");
  const [offsiteVisibleColumns, setOffsiteVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("offsite-visible-columns");
    if (saved) {
      try { return new Set(JSON.parse(saved)); } catch (e) {}
    }
    return new Set(['box', 'cuts', 'category', 'weight', 'pieces', 'location', 'pallet', 'movedTo', 'flag']);
  });

  const offsiteActionsRef = React.useRef<{ handleNewMovement: () => void; handleDownloadCSV: () => void } | null>(null);

  // Popdown Relocation editing states
  const [popdownNewDestLocId, setPopdownNewDestLocId] = useState('');
  const [popdownNewDestPallet, setPopdownNewDestPallet] = useState('');
  const [isMovementPopdownOpen, setIsMovementPopdownOpen] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempDate, setTempDate] = useState('');

  const activeOrder = useMemo(() => {
    return (state.movementOrders || []).find((o: any) => o.status === 'planning' || o.status === 'finalized');
  }, [state.movementOrders]);

  React.useEffect(() => {
    if (activeOrder) {
      setTempName(activeOrder.name);
      setTempDate(activeOrder.date);
    }
  }, [activeOrder?.id]);

  // Theme state: defaults to 'auto' for direct Home Assistant native CSS variable integration
  const [theme, setTheme] = useState<string>(() => {
    const saved = localStorage.getItem("freezer-theme");
    if (saved === "light") {
      localStorage.setItem("freezer-theme", "auto");
      return "auto";
    }
    return saved || "auto";
  });

  React.useEffect(() => {
    localStorage.setItem("freezer-theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      // Default to Home Assistant Dark theme without light mode overrides
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === "light" ? "dark" : prev === "dark" ? "auto" : "light"));
  };

  const [initialLibraryTab, setInitialLibraryTab] = useState<"products" | "containers" | "freezers" | "lists" | "settings">("products");

  // Centralized Filters State
  const [selectedPrimary, setSelectedPrimary] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [selectedFreezerId, setSelectedFreezerId] = useState<string>('all');
  const [hideZeroQuantity, setHideZeroQuantity] = useState(true);
  const [showZeroQtyWithStock, setShowZeroQtyWithStock] = useState(true);
  const [checkedTagIds, setCheckedTagIds] = useState<string[] | null>(null);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  const allTagIds = useMemo(() => {
    return ['untagged', ...(state.tags || []).map(t => t.id)];
  }, [state.tags]);

  const activeCheckedTags = useMemo(() => {
    if (checkedTagIds === null) {
      return allTagIds;
    }
    return checkedTagIds;
  }, [checkedTagIds, allTagIds]);

  const [isSearchFilterOpen, setIsSearchFilterOpen] = useState(false);

  // Group categories and subcategories together for a single integrated select list
  const groupedCategories = useMemo(() => {
    const list: Array<{ primary: string; subs: string[] }> = [];
    const catSet = new Set(state.products.map(p => p.primaryCategory).filter(Boolean) as string[]);
    const sortedCats = Array.from(catSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    for (const cat of sortedCats) {
      const subs = Array.from(
        new Set(
          state.products
            .filter(p => p.primaryCategory === cat)
            .map(p => p.subCategory)
            .filter(Boolean) as string[]
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
      list.push({ primary: cat, subs });
    }
    return list;
  }, [state.products]);

  const currentCategoryValue = selectedSub 
    ? `sub:${selectedPrimary}:${selectedSub}` 
    : selectedPrimary 
    ? `primary:${selectedPrimary}` 
    : 'all';

  const handleCategorySelectChange = (value: string) => {
    if (value === 'all') {
      setSelectedPrimary(null);
      setSelectedSub(null);
    } else if (value.startsWith('primary:')) {
      const cat = value.substring('primary:'.length);
      setSelectedPrimary(cat);
      setSelectedSub(null);
    } else if (value.startsWith('sub:')) {
      const parts = value.split(':');
      if (parts.length >= 3) {
        const cat = parts[1];
        const sub = parts.slice(2).join(':');
        setSelectedPrimary(cat);
        setSelectedSub(sub);
      }
    }
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedPrimary) count++;
    if (selectedFreezerId && selectedFreezerId !== 'all') count++;
    if (!hideZeroQuantity) count++;
    if (currentView === 'display_case' && !showZeroQtyWithStock) count++;
    if (checkedTagIds !== null && checkedTagIds.length !== allTagIds.length) count++;
    return count;
  }, [selectedPrimary, selectedFreezerId, hideZeroQuantity, showZeroQtyWithStock, currentView, checkedTagIds, allTagIds]);

  const handleSelectPrimary = (cat: string | null) => {
    setSelectedPrimary(cat);
    setSelectedSub(null);
  };

  const primaryCategories = useMemo(() => {
    const categories = new Set(state.products.map(p => p.primaryCategory).filter(Boolean) as string[]);
    return Array.from(categories).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [state.products]);

  const subCategoriesOfPrimary = useMemo(() => {
    if (!selectedPrimary) return [];
    const subs = new Set(
      state.products
        .filter(p => p.primaryCategory === selectedPrimary)
        .map(p => p.subCategory)
        .filter(Boolean) as string[]
    );
    return Array.from(subs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [state.products, selectedPrimary]);

  const filterFreezers = useMemo(() => {
    if (currentView === 'display_case') {
      return state.freezers.filter(f => f.isSpecial).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    }
    return state.freezers.filter(f => !f.isPallet && !f.id.startsWith('pallet-') && !f.isArchived).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }, [state.freezers, currentView]);

  const isDisplay = currentView === 'display_case';

  const [reconcileFreezerId, setReconcileFreezerId] = useState<string | null>(null);
  const [highlightContainerId, setHighlightContainerId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  React.useEffect(() => {
    (window as any).__navigateToLocation = (locationType: 'on-site', targetId: string) => {
      if (locationType === 'on-site') {
        setCurrentView('freezer');
        setHighlightContainerId(targetId);
      }
    };
    return () => {
      delete (window as any).__navigateToLocation;
    };
  }, [setCurrentView, setHighlightContainerId]);

  const prevViewRef = React.useRef(currentView);
  React.useEffect(() => {
    const prevView = prevViewRef.current;
    prevViewRef.current = currentView;
    if (prevView !== currentView) {
      if (!highlightContainerId) {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  }, [currentView, highlightContainerId]);

  const hasStagedItems = useMemo(() => {
    const stagedContainers = state.containers.filter(c => 
      !c.freezerId && 
      c.id !== 'staging_loose' && 
      state.meatCuts.some(mc => mc.containerId === c.id && mc.quantity > 0)
    );
    const looseStagingCuts = state.meatCuts.filter(mc => mc.containerId === 'staging_loose' && mc.quantity > 0);
    return stagedContainers.length > 0 || looseStagingCuts.length > 0;
  }, [state.containers, state.meatCuts]);

  const [isDragOverStagingHeader, setIsDragOverStagingHeader] = useState<boolean>(false);

  // Real-time sync states
  const [syncStatus, setSyncStatus] = useState<'synced' | 'connecting' | 'error' | 'remote_editing'>('synced');
  const [lastSyncBy, setLastSyncBy] = useState<string | null>(null);
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const pendingRefreshRef = React.useRef<boolean>(false);

  const forceReconnect = React.useCallback(() => {
    setReconnectTrigger(prev => prev + 1);
  }, []);

  // Flush deferred background state refresh when focus leaves text input fields
  React.useEffect(() => {
    const handleFocusOut = () => {
      setTimeout(() => {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
          activeEl.tagName === 'INPUT' || 
          activeEl.tagName === 'TEXTAREA' || 
          activeEl.tagName === 'SELECT' || 
          (activeEl as HTMLElement).isContentEditable
        );
        if (!isEditing && pendingRefreshRef.current) {
          pendingRefreshRef.current = false;
          refreshState();
        }
      }, 150);
    };

    window.addEventListener('focusout', handleFocusOut);
    return () => window.removeEventListener('focusout', handleFocusOut);
  }, [refreshState]);

  // Setup EventSource for SSE live-sync
  React.useEffect(() => {
    setSyncStatus('connecting');
    
    // Ensure the stream URL is fully qualified and resolves correctly in all ingress and root environments
    let streamUrl = 'api/inventory/stream';
    const matchIngress = window.location.pathname.match(/^\/api\/hassio_ingress\/[^/]+\/?/);
    if (matchIngress) {
      // Under HA Ingress, construct path relative to the ingress base
      const base = matchIngress[0].endsWith('/') ? matchIngress[0] : `${matchIngress[0]}/`;
      streamUrl = `${base}api/inventory/stream`;
    } else {
      // In standard environments (AI Studio, Cloud Run, Local), use absolute path to avoid relative url parsing bugs
      streamUrl = '/api/inventory/stream';
    }

    const eventSource = new EventSource(`${streamUrl}?clientId=${clientId}`);

    eventSource.onopen = () => {
      setSyncStatus('synced');
    };

    let remoteEditingTimeout: NodeJS.Timeout | null = null;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          if (data.lock !== undefined) {
            updateSingleUserLock(data.lock);
          }
        } else if (data.type === 'single_user_lock_changed') {
          updateSingleUserLock(data.lock);
        } else if (data.type === 'break_in_requested') {
          updateSingleUserLock(data.lock);
        } else if (data.type === 'break_in_cancelled') {
          updateSingleUserLock(data.lock);
        } else if (data.type === 'update') {
          if (!isSingleUserMode) {
            if (remoteEditingTimeout) clearTimeout(remoteEditingTimeout);
            setSyncStatus('synced');
            
            // Solution 1: Check if user is actively typing / focusing an input field
            const activeEl = document.activeElement;
            const isEditing = activeEl && (
              activeEl.tagName === 'INPUT' || 
              activeEl.tagName === 'TEXTAREA' || 
              activeEl.tagName === 'SELECT' || 
              (activeEl as HTMLElement).isContentEditable
            );
            if (isEditing || isPendingSync) {
              pendingRefreshRef.current = true;
            } else {
              pendingRefreshRef.current = false;
              refreshState();
            }
          }
        } else if (data.type === 'editing') {
          if (!isSingleUserMode) {
            setSyncStatus('remote_editing');
            if (remoteEditingTimeout) clearTimeout(remoteEditingTimeout);
            remoteEditingTimeout = setTimeout(() => {
               setSyncStatus(prev => prev === 'remote_editing' ? 'synced' : prev);
            }, 3500);
          }
        }
      } catch (err) {
        console.warn('SSE JSON parse error:', err);
      }
    };

    eventSource.onerror = (e) => {
      console.warn('SSE connection lost or error:', e);
      // Natively EventSource automatically attempts reconnection when disconnected.
      // If readyState is CONNECTING, it is retrying under the hood, so show 'connecting' (amber).
      if (eventSource.readyState === EventSource.CONNECTING) {
        setSyncStatus('connecting');
      } else {
        setSyncStatus('error');
      }
    };

    return () => {
      eventSource.close();
    };
  }, [refreshState, reconnectTrigger]);

  // Reconnect on window/tab focus or transition to visible focus
  React.useEffect(() => {
    const handleFocus = () => {
      if (syncStatus === 'error') {
        forceReconnect();
        refreshState();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        forceReconnect();
        refreshState();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forceReconnect, refreshState, syncStatus]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    forceReconnect();
    await refreshState();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT');
      if (isInputFocused) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // 1. Compute current product quantities list
  const currentQuantityMap = React.useMemo(() => {
    return state.meatCuts.reduce((acc, mc) => {
      acc[mc.productId] = (acc[mc.productId] || 0) + mc.quantity;
      return acc;
    }, {} as Record<string, number>);
  }, [state.meatCuts]);

  // Compute off-site quantity map
  const offSiteQuantityMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    const rawEntries = (state.offSiteEntries || []).filter((e: any) => {
      if (e.archived) return false;
      if (e.box && state.containers?.some((c: any) => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
    const products = state.products || [];

    rawEntries.forEach((e: any) => {
      const cutsStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').trim();
      const origStr = (e.originalCutName || '').trim();
      const normStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || '').trim();

      let matchedProduct = null;
      if (e.productId) {
        matchedProduct = products.find((prod: any) => prod.id === e.productId);
      }
      if (!matchedProduct && normStr) {
        matchedProduct = products.find((prod: any) => prod.name.trim().toLowerCase() === normStr.toLowerCase());
      }
      if (!matchedProduct) {
        const matchNum = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const cutsNum = matchNum(cutsStr);
        const origNum = matchNum(origStr);
        if (cutsNum || origNum) {
          matchedProduct = products.find((prod: any) => 
            prod.productNumbers && prod.productNumbers.some((num: string) => 
              (cutsNum && num.toLowerCase() === cutsNum.toLowerCase()) || 
              (origNum && num.toLowerCase() === origNum.toLowerCase())
            )
          );
        }
      }
      if (!matchedProduct) {
        const cleanName = (str: string) => str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
        const cleanCuts = cleanName(cutsStr);
        const cleanOrig = cleanName(origStr);
        const cleanNorm = cleanName(normStr);
        matchedProduct = products.find((p: any) => {
          const pName = p.name.trim().toLowerCase();
          return pName === cleanCuts || pName === cleanOrig || pName === cleanNorm || pName === cutsStr.toLowerCase() || pName === origStr.toLowerCase() || pName === normStr.toLowerCase();
        });
      }

      if (matchedProduct) {
        map[matchedProduct.id] = (map[matchedProduct.id] || 0) + (e.pieces || 0);
      }
    });
    return map;
  }, [state.offSiteEntries, state.products, state.containers]);

  // Compute off-site weight map
  const offSiteWeightMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    const rawEntries = (state.offSiteEntries || []).filter((e: any) => {
      if (e.archived) return false;
      if (e.box && state.containers?.some((c: any) => c.isBox && c.isArchived && c.name.toLowerCase().trim() === e.box.toLowerCase().trim())) {
        return false;
      }
      return true;
    });
    const products = state.products || [];

    rawEntries.forEach((e: any) => {
      const cutsStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || e.originalCutName) || '').trim();
      const origStr = (e.originalCutName || '').trim();
      const normStr = ((state.products?.find((p: any) => p.id === e.productId)?.name || '') || '').trim();

      let matchedProduct = null;
      if (e.productId) {
        matchedProduct = products.find((prod: any) => prod.id === e.productId);
      }
      if (!matchedProduct && normStr) {
        matchedProduct = products.find((prod: any) => prod.name.trim().toLowerCase() === normStr.toLowerCase());
      }
      if (!matchedProduct) {
        const matchNum = (str: string) => {
          const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
          return m ? m[1] : null;
        };
        const cutsNum = matchNum(cutsStr);
        const origNum = matchNum(origStr);
        if (cutsNum || origNum) {
          matchedProduct = products.find((prod: any) => 
            prod.productNumbers && prod.productNumbers.some((num: string) => 
              (cutsNum && num.toLowerCase() === cutsNum.toLowerCase()) || 
              (origNum && num.toLowerCase() === origNum.toLowerCase())
            )
          );
        }
      }
      if (!matchedProduct) {
        const cleanName = (str: string) => str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
        const cleanCuts = cleanName(cutsStr);
        const cleanOrig = cleanName(origStr);
        const cleanNorm = cleanName(normStr);
        matchedProduct = products.find((p: any) => {
          const pName = p.name.trim().toLowerCase();
          return pName === cleanCuts || pName === cleanOrig || pName === cleanNorm || pName === cutsStr.toLowerCase() || pName === origStr.toLowerCase() || pName === normStr.toLowerCase();
        });
      }

      if (matchedProduct) {
        map[matchedProduct.id] = (map[matchedProduct.id] || 0) + (e.netWeight || 0);
      }
    });
    return map;
  }, [state.offSiteEntries, state.products, state.containers]);

  // Compute total quantity map
  const totalQuantityMap = React.useMemo(() => {
    const map: Record<string, number> = {};
    const products = state.products || [];
    products.forEach((p) => {
      const onsite = currentQuantityMap[p.id] || 0;
      const offsite = offSiteQuantityMap[p.id] || 0;
      map[p.id] = onsite + offsite;
    });
    return map;
  }, [state.products, currentQuantityMap, offSiteQuantityMap]);

  // 2. Automatic Inventory List syncing
  React.useEffect(() => {
    if (isLoading || isInitialLoadRef.current) return;

    const lists = state.customLists || [];
    const products = state.products || [];

    for (const list of lists) {
      if (!list.isInventoryControlled || list.controlType !== 'auto') continue;

      const condition = list.controlCondition || 'min';

      for (const product of products) {
        const threshold = product.listThresholds?.[list.id];
        if (threshold === undefined || threshold === null || threshold < 0) continue;

        const listItem = list.items?.find(item => item.productId === product.id);
        const controlSource = listItem?.controlSource || 'onsite_count';

        let currentQty = currentQuantityMap[product.id] ?? 0;
        if (controlSource === 'offsite_count') {
          currentQty = offSiteQuantityMap[product.id] ?? 0;
        } else if (controlSource === 'offsite_weight') {
          currentQty = offSiteWeightMap[product.id] ?? 0;
        } else if (controlSource === 'total_count') {
          currentQty = totalQuantityMap[product.id] ?? 0;
        }

        const isConditionMet = condition === 'max' ? (currentQty >= threshold) : (currentQty <= threshold);
        const isAlreadyInList = list.items.some(item => item.productId === product.id);

        if (isConditionMet && !isAlreadyInList) {
          console.log(`Auto-adding ${product.name} to ${list.name} (Value: ${currentQty}, Source: ${controlSource}, Threshold: ${threshold})`);
          dispatch({
            type: 'TOGGLE_PRODUCT_ON_LIST',
            payload: { listId: list.id, productId: product.id, forceState: true }
          });
          return; // dispatch triggers state reload, let's process one by one
        } else if (!isConditionMet && isAlreadyInList) {
          console.log(`Auto-removing ${product.name} from ${list.name} (Value: ${currentQty}, Source: ${controlSource}, Threshold: ${threshold})`);
          dispatch({
            type: 'TOGGLE_PRODUCT_ON_LIST',
            payload: { listId: list.id, productId: product.id, forceState: false }
          });
          return; // dispatch triggers state reload, let's process one by one
        }
      }
    }
  }, [isLoading, state.customLists, state.products, currentQuantityMap, offSiteQuantityMap, offSiteWeightMap, totalQuantityMap, dispatch]);

  // 3. Detect prompt-based threshold transitions
  React.useEffect(() => {
    if (isInitialLoadRef.current && state.products.length > 0) {
      prevMapsRef.current = {
        onsite: currentQuantityMap,
        offsiteCount: offSiteQuantityMap,
        offsiteWeight: offSiteWeightMap,
        total: totalQuantityMap
      };
      isInitialLoadRef.current = false;
      return;
    }

    if (isInitialLoadRef.current || isLoading) return;

    const prevMaps = prevMapsRef.current;
    const lists = state.customLists || [];
    const products = state.products || [];

    const newPrompts: any[] = [];

    for (const list of lists) {
      if (!list.isInventoryControlled || list.controlType !== 'prompt') continue;

      const condition = list.controlCondition || 'min';

      for (const product of products) {
        const threshold = product.listThresholds?.[list.id];
        if (threshold === undefined || threshold === null || threshold < 0) continue;

        const listItem = list.items?.find(item => item.productId === product.id);
        const controlSource = listItem?.controlSource || 'onsite_count';

        let prevQty = 0;
        let curQty = 0;

        if (controlSource === 'offsite_count') {
          prevQty = prevMaps.offsiteCount[product.id] ?? 0;
          curQty = offSiteQuantityMap[product.id] ?? 0;
        } else if (controlSource === 'offsite_weight') {
          prevQty = prevMaps.offsiteWeight[product.id] ?? 0;
          curQty = offSiteWeightMap[product.id] ?? 0;
        } else if (controlSource === 'total_count') {
          prevQty = prevMaps.total[product.id] ?? 0;
          curQty = totalQuantityMap[product.id] ?? 0;
        } else {
          prevQty = prevMaps.onsite[product.id] ?? 0;
          curQty = currentQuantityMap[product.id] ?? 0;
        }

        if (prevQty === curQty) continue;

        const prevMet = condition === 'max' ? (prevQty >= threshold) : (prevQty <= threshold);
        const curMet = condition === 'max' ? (curQty >= threshold) : (curQty <= threshold);

        if (prevMet !== curMet) {
          const isAlreadyInList = list.items.some(item => item.productId === product.id);

          if (curMet && !isAlreadyInList) {
            newPrompts.push({
              listId: list.id,
              productId: product.id,
              actionType: 'add',
              currentValue: curQty,
              thresholdValue: threshold,
              controlCondition: condition,
              unitLabel: controlSource === 'offsite_weight' ? 'lbs' : controlSource === 'offsite_count' ? 'offsite' : controlSource === 'total_count' ? 'total' : 'onsite'
            });
          } else if (!curMet && isAlreadyInList) {
            newPrompts.push({
              listId: list.id,
              productId: product.id,
              actionType: 'remove',
              currentValue: curQty,
              thresholdValue: threshold,
              controlCondition: condition,
              unitLabel: controlSource === 'offsite_weight' ? 'lbs' : controlSource === 'offsite_count' ? 'offsite' : controlSource === 'total_count' ? 'total' : 'onsite'
            });
          }
        }
      }
    }

    // Always sync the ref to latest state so we don't double trigger
    prevMapsRef.current = {
      onsite: currentQuantityMap,
      offsiteCount: offSiteQuantityMap,
      offsiteWeight: offSiteWeightMap,
      total: totalQuantityMap
    };

    if (newPrompts.length > 0) {
      setPromptQueue(prev => [...prev, ...newPrompts]);
    }
  }, [state.customLists, state.products, currentQuantityMap, offSiteQuantityMap, offSiteWeightMap, totalQuantityMap, isLoading]);

  // 4. Automatically display prompt alerts sequentially
  React.useEffect(() => {
    if (promptQueue.length > 0 && activeModal === null) {
      const nextAlert = promptQueue[0];
      setActiveModal({
        type: 'LIST_THRESHOLD_ALERT',
        listId: nextAlert.listId,
        productId: nextAlert.productId,
        actionType: nextAlert.actionType,
        currentValue: nextAlert.currentValue,
        thresholdValue: nextAlert.thresholdValue,
        controlCondition: nextAlert.controlCondition
      });
    }
  }, [promptQueue, activeModal]);

  const getModalTitle = (modal: ModalType): string => {
    if (!modal) return '';
    switch (modal.type) {
      case 'ADD_FREEZER': return 'Add New Freezer';
      case 'ADD_CONTAINER': return 'Add New Container';
      case 'ADD_MEAT': return 'Add Meat to Container';
      case 'EDIT_CONTAINER': return `Edit ${state.containers.find(c => c.id === modal.containerId)?.name || 'Container'}`;
      case 'HISTORY': return `History for ${modal.targetName}`;
      case 'MOVE_MEAT': return 'Move Stock to Container';
      case 'MOVE_CONTAINER': return 'Move Container';
      case 'BULK_ADD_MEAT': return 'Stock Intake (Inbound Multi-item)';
      case 'EDIT_PRODUCT': {
          const product = state.products.find(p => p.id === modal.productId);
          return product ? `Edit ${product.name}` : 'Edit Product';
      }
      case 'EDIT_NOTE': return 'Edit Note';
      case 'WRONG_LABEL': return 'Correct Wrong Label';
      case 'RESTOCK_PROMPT': return 'Inventory Restock Alert';
      case 'ADD_TO_LIST': return 'Manage Product Lists';
      case 'SELECT_MEAT_TAGS': return 'Select Item Tags';
      case 'SPLIT_ITEM': return 'Split Packages in Container';
      case 'CHANGE_CONTAINER_FLOW': {
          const container = state.containers.find(c => c.id === modal.containerId);
          return container ? `Change Container of Cuts from "${container.name}"` : 'Change Container of Cuts';
      }
      case 'LIST_THRESHOLD_ALERT': return 'Inventory Automation Alert';
      default: return '';
    }
  };

  const getModalMaxWidth = (modal: ModalType): string => {
    if (!modal) return 'max-w-lg';
    if (modal.type === 'RESTOCK_PROMPT' || modal.type === 'ADD_TO_LIST' || modal.type === 'SELECT_MEAT_TAGS' || modal.type === 'LIST_THRESHOLD_ALERT') return 'max-w-md';
    if (modal.type === 'BULK_ADD_MEAT' || modal.type === 'MOVE_MEAT') {
      return 'max-w-[100%] lg:max-w-[95vw] xl:max-w-7xl'; 
    }
    if (modal.type === 'CHANGE_CONTAINER_FLOW') return 'max-w-2xl';
    return 'max-w-lg';
  };
  
  const handleCloseModal = () => {
      if (activeModal && activeModal.type === 'LIST_THRESHOLD_ALERT') {
        setPromptQueue(prev => prev.slice(1));
      }
      setActiveModal(null);
  };
  
  const handleNavigateToFreezer = (containerId: string) => {
      setCurrentView('freezer');
      setHighlightContainerId(containerId);
  }

  const searchResults = useMemo(() => {
    if (!searchTerm.trim() || currentView !== 'freezer') return null;
    const searchWords = searchTerm.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (searchWords.length === 0) return null;
    
    const matchingFreezerIds = new Set<string>();
    const matchingContainerIds = new Set<string>();
    const matchingMeatCutIds = new Set<string>();
    const matchingProductIds = new Set<string>();

    // 1. Contextual matches for MeatCuts
    (state.meatCuts || []).forEach(mc => {
        const product = (state.products || []).find(p => p.id === mc.productId);
        const container = (state.containers || []).find(c => c.id === mc.containerId);
        const freezer = container?.freezerId ? (state.freezers || []).find(f => f.id === container.freezerId) : null;

        const contextString = [
            product?.name,
            product?.primaryCategory,
            product?.subCategory,
            ...(Array.isArray(product?.productNumbers) ? product.productNumbers : []),
            container?.name,
            freezer?.name,
            mc.notes
        ].filter(Boolean).join(' ').toLowerCase();

        if (searchWords.every(word => contextString.includes(word))) {
            matchingMeatCutIds.add(mc.id);
            if (product) matchingProductIds.add(product.id);
            if (container) matchingContainerIds.add(container.id);
            if (freezer) matchingFreezerIds.add(freezer.id);
        }
    });

    // 2. Contextual matches for Containers (allowing search to find empty containers)
    (state.containers || []).forEach(c => {
        const freezer = c.freezerId ? (state.freezers || []).find(f => f.id === c.freezerId) : null;
        const contextString = [c.name, freezer?.name].filter(Boolean).join(' ').toLowerCase();
        if (searchWords.every(word => contextString.includes(word))) {
            matchingContainerIds.add(c.id);
            if (freezer) matchingFreezerIds.add(freezer.id);
        }
    });

    // 3. Direct matches for Freezers (allowing search for empty freezers)
    (state.freezers || []).forEach(f => {
        if (searchWords.every(word => (f.name || '').toLowerCase().includes(word))) {
            matchingFreezerIds.add(f.id);
        }
    });

    return { 
      freezerIds: matchingFreezerIds, 
      containerIds: matchingContainerIds, 
      meatCutIds: matchingMeatCutIds, 
      productIds: matchingProductIds 
    };
  }, [searchTerm, state.freezers, state.containers, state.meatCuts, state.products, currentView]);


  const renderModalContent = () => {
    if (!activeModal) return null;
    
    switch (activeModal.type) {
      case 'ADD_FREEZER':
        return <AddForms.FreezerForm dispatch={dispatch} onClose={handleCloseModal} />;
      case 'ADD_CONTAINER':
        return <AddForms.ContainerForm 
          dispatch={dispatch} 
          freezerId={activeModal.freezerId} 
          onClose={handleCloseModal} 
          state={state}
          />;
      case 'ADD_MEAT':
        return <AddForms.MeatForm 
          dispatch={dispatch} 
          containerId={activeModal.containerId} 
          onClose={handleCloseModal}
          products={state.products}
          initialProductId={activeModal.productId}
          state={state}
        />;
      case 'BULK_ADD_MEAT':
        return <UnifiedInboundMoveForm dispatch={dispatch} state={state} initialProductId={activeModal.productId} onClose={handleCloseModal} />;
      case 'EDIT_CONTAINER': {
        const container = state.containers.find(c => c.id === activeModal.containerId);
        return container ? <ManagementForms.EditContainerForm dispatch={dispatch} onClose={handleCloseModal} container={container} state={state} /> : null;
      }
      case 'HISTORY':
        const historyItems = state.history
            .filter(h => h.targetId === activeModal.targetId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return <HistoryModalContent history={historyItems} />;
      case 'MOVE_MEAT':
        return <UnifiedInboundMoveForm dispatch={dispatch} state={state} sourceMeatCutId={activeModal.meatCutId} onClose={handleCloseModal} />;
      case 'MOVE_CONTAINER':
        return <MoveModalContent.MoveContainer dispatch={dispatch} containerId={activeModal.containerId} state={state} onClose={handleCloseModal} />;
      case 'CHANGE_CONTAINER_FLOW':
        return <MoveModalContent.ChangeContainerFlow dispatch={dispatch} containerId={activeModal.containerId} state={state} onClose={handleCloseModal} />;
      case 'EDIT_PRODUCT': {
          const product = state.products.find(p => p.id === activeModal.productId);
          return product ? <ManagementForms.ProductForm dispatch={dispatch} onClose={handleCloseModal} existingProduct={product} products={state.products} state={state} /> : null;
      }
      case 'EDIT_NOTE':
        return <EditNoteModalContent dispatch={dispatch} meatCutId={activeModal.meatCutId} initialNotes={activeModal.initialNotes} initialOriginalCutName={activeModal.initialOriginalCutName} onClose={handleCloseModal} />;
      case 'WRONG_LABEL':
        return <CorrectWrongLabelModalContent dispatch={dispatch} state={state} meatCutId={activeModal.meatCutId} onClose={handleCloseModal} />;
      case 'ADD_TO_LIST':
        return <AddToListModalContent dispatch={dispatch} state={state} productId={activeModal.productId} onClose={handleCloseModal} />;
      case 'SELECT_MEAT_TAGS':
        return <SelectTagsModalContent dispatch={dispatch} state={state} meatCutId={activeModal.meatCutId} onClose={handleCloseModal} />;
      case 'SPLIT_ITEM':
        return <SplitItemModalContent dispatch={dispatch} state={state} meatCutId={activeModal.meatCutId} onClose={handleCloseModal} />;
      case 'LIST_THRESHOLD_ALERT':
        return (
          <ListThresholdAlertModalContent
            dispatch={dispatch}
            state={state}
            listId={activeModal.listId}
            productId={activeModal.productId}
            actionType={activeModal.actionType}
            currentValue={activeModal.currentValue}
            thresholdValue={activeModal.thresholdValue}
            controlCondition={activeModal.controlCondition}
            onClose={handleCloseModal}
          />
        );
      default:
        return null;
    }
  };
  
  const startReconciliation = (freezerId: string) => {
      setReconcileFreezerId(freezerId);
      setCurrentView('reconcile');
  }

  const renderCurrentView = () => {
    switch(currentView) {
      case 'freezer':
        return (
          <FreezerView 
            state={state} 
            dispatch={dispatch} 
            openModal={setActiveModal} 
            searchResults={searchResults} 
            startReconciliation={startReconciliation} 
            highlightContainerId={highlightContainerId} 
            setHighlightContainerId={setHighlightContainerId} 
            onFindProduct={(productId) => {
              setSelectedProductId(productId);
              setCurrentView('product');
            }}
            selectedPrimary={selectedPrimary}
            selectedSub={selectedSub}
            selectedFreezerId={selectedFreezerId}
            hideZeroQuantity={hideZeroQuantity}
            activeCheckedTags={activeCheckedTags}
            setSelectedPrimary={handleSelectPrimary}
            setSelectedSub={setSelectedSub}
            onNavigateToOffsiteStaging={() => {
              setCurrentView('offsite');
              setOffsiteSubTab('staging-worksheet');
            }}
          />
        );
      case 'display_case':
        return (
          <DisplayCaseView 
            state={state} 
            dispatch={dispatch} 
            openModal={setActiveModal} 
            searchTerm={searchTerm} 
            onNavigateToContainer={handleNavigateToFreezer}
            onNavigateToStaging={() => {
              setCurrentView('freezer');
            }}
            selectedPrimary={selectedPrimary}
            selectedSub={selectedSub}
            selectedFreezerId={selectedFreezerId}
            hideZeroQuantity={hideZeroQuantity}
            showZeroQtyWithStock={showZeroQtyWithStock}
            activeCheckedTags={activeCheckedTags}
            setSelectedPrimary={handleSelectPrimary}
            setSelectedSub={setSelectedSub}
          />
        );
      case 'product':
        return (
          <ProductView 
            state={state} 
            dispatch={dispatch} 
            openModal={setActiveModal} 
            searchTerm={searchTerm} 
            onNavigateToContainer={handleNavigateToFreezer}
            selectedProductId={selectedProductId}
            onClearSelectedProduct={() => setSelectedProductId(null)}
            selectedPrimary={selectedPrimary}
            selectedSub={selectedSub}
            selectedFreezerId={selectedFreezerId}
            hideZeroQuantity={hideZeroQuantity}
            activeCheckedTags={activeCheckedTags}
            setSelectedPrimary={handleSelectPrimary}
            setSelectedSub={setSelectedSub}
            onNavigateToOffsiteStaging={() => {
              setCurrentView('offsite');
              setOffsiteSubTab('staging-worksheet');
            }}
          />
        );
      case 'library':
        return (
          <LibraryView 
            state={state} 
            dispatch={dispatch} 
            openModal={setActiveModal} 
            navigateToFreezer={handleNavigateToFreezer} 
            initialTab={initialLibraryTab}
            theme={theme}
            onThemeChange={handleThemeChange}
            onNavigateToView={setCurrentView}
          />
        );
      case 'history':
        return <HistoryView state={state} dispatch={dispatch} />;
      case 'reconcile':
        if (!reconcileFreezerId) {
            setCurrentView('freezer'); // Safety check
            return null;
        }
        return <ReconciliationView state={state} dispatch={dispatch} freezerId={reconcileFreezerId} exitReconciliation={() => setCurrentView('freezer')} openModal={setActiveModal} />;
      case 'restock':
        return (
          <div className="flex flex-col h-full animate-fade-in pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] max-w-7xl mx-auto w-full">
            <div className="flex items-center justify-between mb-4 sm:mb-6 mt-1 sm:mt-2 bg-cool-gray-900/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-cool-gray-800 shadow-xl z-20">
              <h1 className="text-xl sm:text-2xl font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2 sm:gap-3">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" /> Checklists & Campaigns
              </h1>
            </div>
            <div className="flex-1 overflow-auto rounded-xl bg-cool-gray-850/50 border border-cool-gray-800 shadow-inner p-3 sm:p-5">
              <ManageLists state={state} dispatch={dispatch} offSiteQuantityMap={offSiteQuantityMap} offSiteWeightMap={offSiteWeightMap} />
            </div>
          </div>
        );
      case 'offsite':
        return (
          <OffSiteStorageView 
            state={state} 
            dispatch={dispatch} 
            products={state.products} 
            activeSubTab={offsiteSubTab}
            setActiveSubTab={setOffsiteSubTab}
            searchTerm={offsiteSearch}
            setSearchTerm={setOffsiteSearch}
            isAdvancedFilterOpen={offsiteAdvancedFilterOpen}
            setIsAdvancedFilterOpen={setOffsiteAdvancedFilterOpen}
            isDirectEdit={offsiteDirectEdit}
            setIsDirectEdit={setOffsiteDirectEdit}
            viewOriginalNames={offsiteViewOriginalNames}
            setViewOriginalNames={setOffsiteViewOriginalNames}
            filterTags={offsiteFilterTags}
            setFilterTags={setOffsiteFilterTags}
            filterLists={offsiteFilterLists}
            setFilterLists={setOffsiteFilterLists}
            viewUngrouped={offsiteViewUngrouped}
            setViewUngrouped={(val: boolean) => {
              setOffsiteViewUngrouped(val);
              localStorage.setItem("offsite-view-ungrouped", val ? "true" : "false");
            }}
            visibleColumns={offsiteVisibleColumns}
            setVisibleColumns={(cols: Set<string>) => {
              setOffsiteVisibleColumns(cols);
              localStorage.setItem("offsite-visible-columns", JSON.stringify(Array.from(cols)));
            }}
            registerActions={(actions: any) => { offsiteActionsRef.current = actions; }}
            isSingleUserMode={isSingleUserMode}
            claimSingleUserMode={claimSingleUserMode}
            releaseSingleUserMode={releaseSingleUserMode}
          />
        );
      case 'butcher_records':
        return <ButcherRecordsView state={state} dispatch={dispatch} />;
      default:
        return null;
    }
  }



  return (
    <div className="min-h-screen bg-cool-gray-900 text-cool-gray-100 font-sans p-1.5 sm:p-5 lg:p-6 lg:pt-5">
      <div className="max-w-[1600px] mx-auto w-full">
        {/* Single-User Mode Break-In Countdown Banner */}
        {breakInCountdown !== null && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg px-4 animate-bounce-short">
            <div className="bg-amber-950/95 border-2 border-amber-500 text-amber-100 p-4 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0">
                  <span className="text-xl">⚠️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    Break-In Requested
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-black uppercase tracking-wider">
                      {breakInCountdown}s Countdown
                    </span>
                  </h4>
                  <p className="text-xs text-amber-200 mt-0.5">
                    <span className="font-semibold text-amber-300">{singleUserLock?.breakInRequest?.requestedByName || 'Another user'}</span> is waiting to edit. Auto-syncing and returning to Multi-User Mode in <span className="font-bold font-mono text-white underline">{breakInCountdown}s</span>...
                  </p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-amber-900/80 h-2 rounded-full overflow-hidden border border-amber-700/50">
                <div 
                  className="bg-amber-400 h-full transition-all duration-1000 ease-linear"
                  style={{ width: `${(breakInCountdown / 5) * 100}%` }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={async () => {
                    await cancelBreakIn();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-700 text-xs font-bold text-amber-200 cursor-pointer transition"
                >
                  Cancel Request
                </button>
                <button
                  onClick={async () => {
                    await releaseSingleUserMode();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 cursor-pointer shadow transition"
                >
                  Sync & Exit Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Persistent Top Banner for Second Users when Single-User Mode is locked by someone else */}
        {singleUserLock && singleUserLock.clientId !== clientId && (
          <div className="sticky top-2 z-40 bg-amber-950/95 border border-amber-500/60 text-amber-100 px-4 py-3 rounded-xl mb-4 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-sm animate-scale-up">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-inner">
                <span className="text-lg">🔒</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-white font-bold text-sm">Single-User Mode Active</strong>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50 uppercase tracking-wider">
                    Locked by {singleUserLock.holderName}
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-0.5 leading-snug">
                  <span className="font-semibold text-white">{singleUserLock.holderName}</span> is currently editing in Solo Mode with zero-lag local caching. Remote database updates are paused until they exit or go idle.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end pt-1 sm:pt-0 border-t sm:border-t-0 border-amber-900/50">
              {singleUserLock.breakInRequest?.requestedByClientId === clientId ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-300 animate-pulse flex items-center gap-1.5 bg-amber-900/80 px-3 py-1.5 rounded-lg border border-amber-700/80">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Break-In Requested...
                  </span>
                  <button
                    onClick={async () => {
                      await cancelBreakIn();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-900/90 hover:bg-amber-800 border border-amber-700/80 text-xs font-bold text-amber-200 cursor-pointer transition shadow"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={async () => {
                    const res = await requestBreakIn();
                    if (!res.success && res.message) {
                      alert(res.message);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 shadow-md transition cursor-pointer flex items-center gap-1.5"
                >
                  <span>⚠️ Request Break-In (5s)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {state.isPreviewMode && (
          <div className="bg-cyan-950/90 border border-cyan-500/40 text-cyan-200 px-4 py-3 rounded-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm animate-scale-up shadow-xl backdrop-blur">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
              </span>
              <span className="truncate">
                <strong className="text-white">👁️ Live Snapshot Preview Active (Read-Only):</strong> Viewing backup <code className="bg-cyan-900/80 border border-cyan-700/60 px-1.5 py-0.5 rounded text-cyan-200 font-mono text-xs font-bold">{state.previewBackupFilename || 'Snapshot'}</code>. All database modifications are disabled.
              </span>
            </div>
            <button
              onClick={handleEndPreviewMode}
              disabled={isPreviewTransitioning}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-cool-gray-950 font-extrabold px-4 py-1.5 rounded-lg text-xs transition duration-150 shadow focus:outline-none cursor-pointer whitespace-nowrap shrink-0"
            >
              {isPreviewTransitioning ? 'Exiting Preview...' : 'Exit Preview Mode'}
            </button>
          </div>
        )}

        {state.isDemoMode && !state.isPreviewMode && (
          <div className="bg-amber-950/80 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm animate-scale-up shadow-lg">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span>
                <strong>Demo Sandbox Playground Active:</strong> You are inside a safe sandboxed environment. All edits are temporary and will be completely discarded when you exit.
              </span>
            </div>
            <button
              onClick={handleEndDemo}
              disabled={isDemoTransitioning}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-cool-gray-950 font-bold px-4 py-1.5 rounded-lg text-xs transition duration-150 shadow focus:outline-none cursor-pointer whitespace-nowrap"
            >
              {isDemoTransitioning ? 'Exiting...' : 'Exit & Discard'}
            </button>
          </div>
        )}

        <header ref={headerRef} id="main-app-header" className="sticky top-0 z-40 bg-cool-gray-900/95 backdrop-blur-sm -mx-3 px-3 sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6 pt-3 pb-3 border-b border-cool-gray-800 transition-all mb-4">
          <div className="flex flex-col gap-3 relative">
            {/* Title / Brand and 3 view tabs right next to it */}
            <div className="flex flex-wrap items-center justify-between gap-3 w-full pr-10 md:pr-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <div className="flex items-center cursor-pointer" onClick={() => setCurrentView('product')} title="Freezer Store Home">
                  <FreezerIcon className="text-cyan-400 transition-all w-7 h-7 sm:w-8 h-8 shrink-0 animate-scale-up" />
                </div>

                {/* View Switches on Top Left Header (Products, Freezer, Display) */}
                {currentView !== 'library' && currentView !== 'history' && currentView !== 'reconcile' && currentView !== 'users' && currentView !== 'offsite' && currentView !== 'butcher_records' && (
                  <div className="flex items-center gap-1.5 ml-1">
                    <div className="flex items-center rounded-lg bg-cool-gray-850 border border-cool-gray-700 p-0.5">
                        <button 
                            onClick={() => setCurrentView('product')}
                            className={`rounded-md font-bold transition cursor-pointer flex items-center justify-center px-2 py-1 gap-1 text-[11px] sm:text-xs ${currentView === 'product' ? 'bg-cyan-600 text-white font-extrabold shadow' : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-750'}`}
                            title="Products View"
                        >
                            <ListViewIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:inline">Products</span>
                        </button>
                        <button 
                            onClick={() => setCurrentView('freezer')}
                            className={`rounded-md font-bold transition cursor-pointer flex items-center justify-center px-2 py-1 gap-1 text-[11px] sm:text-xs ${currentView === 'freezer' ? 'bg-cyan-600 text-white font-extrabold shadow' : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-750'}`}
                            title="Freezer View"
                        >
                            <GridViewIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:inline">Freezer</span>
                        </button>
                        <button 
                            onClick={() => setCurrentView('display_case')}
                            className={`rounded-md font-bold transition cursor-pointer flex items-center justify-center px-2 py-1 gap-1 text-[11px] sm:text-xs ${currentView === 'display_case' ? 'bg-amber-600 text-black shadow' : 'text-cool-gray-400 hover:text-white hover:bg-cool-gray-750'}`}
                            title="Display View"
                        >
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            <span className="hidden sm:inline">Display</span>
                        </button>
                    </div>

                    {/* Combined Search & Filters Toggle Button */}
                    <button
                      onClick={() => {
                        const nextState = !isSearchFilterOpen;
                        setIsSearchFilterOpen(nextState);
                        if (!nextState) setSearchTerm('');
                      }}
                      className={`h-8 px-2 sm:px-2.5 rounded-lg flex items-center justify-center gap-1 border transition focus:outline-none cursor-pointer text-xs font-bold ${
                        isSearchFilterOpen || searchTerm || activeFiltersCount > 0
                          ? 'bg-cyan-950/45 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-950/20' 
                          : 'bg-cool-gray-850 border-cool-gray-700 text-cool-gray-400 hover:text-white hover:border-cool-gray-650'
                      }`}
                      title="Toggle Search and Filters Panel"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor" className="w-4 h-4 hover:scale-105 transition-all text-cyan-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                      </svg>
                      <span className="hidden sm:inline ml-0.5">Filters</span>
                      {(activeFiltersCount > 0 || searchTerm) && (
                        <span className="h-4 px-1 rounded-full bg-cyan-500 text-cool-gray-950 flex items-center justify-center text-[9px] font-black select-none animate-bounce">
                          {activeFiltersCount + (searchTerm ? 1 : 0)}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                {currentView === 'offsite' && (
                  <div className="flex items-center gap-1.5 sm:gap-2.5 ml-1">
                    {/* 4 Main View Sub-Tabs */}
                    <div className="flex items-center rounded-lg bg-cool-gray-850 border border-cool-gray-700 p-0.5" id="offsite-header-subtabs">
                      {(() => {
                        const tabs = [
                          { id: 'sheet', label: 'Workspace', icon: '📋', desc: 'Main CSV spreadsheet with condensed identical items or location hierarchy trees' },
                          { id: 'hierarchy', label: 'Storage Hierarchy', icon: '🌳', desc: 'Interactive location, pallet, box, and meat cuts hierarchical tree explorer' }
                        ];
                        const hasStaged = (state.offSiteEntries || []).some((e: any) => e.staged);
                        if (hasStaged) {
                          tabs.push({ id: 'staging-worksheet', label: 'Staging Worksheet', icon: '📝', desc: 'Configure packaging, assign weights, locations, pallets, and serialize items' });
                        }
                        const hasFinalized = (state.movementOrders || []).some((o: any) => o.status === 'finalized');
                        if (hasFinalized) {
                          tabs.push({ id: 'active-movement', label: 'Movement Scanner', icon: '⚡', desc: 'Execute live movement orders via interactive barcode scan and loading sheets' });
                        }
                        tabs.push({ id: 'history', label: 'Movements', icon: '🚚', desc: 'View historical/executed movement orders and details of what was moved' });
                        return tabs.map(m => {
                          const isActive = offsiteSubTab === m.id;
                          return (
                            <button
                              key={m.id}
                              onClick={() => setOffsiteSubTab(m.id as any)}
                              type="button"
                              className={`px-2 sm:px-3 py-1 text-[11px] sm:text-xs font-bold transition-all rounded-md cursor-pointer flex items-center gap-1 ${
                                isActive
                                  ? 'bg-cyan-400 text-slate-950 shadow-sm font-black'
                                  : 'text-cool-gray-300 hover:text-white hover:bg-cool-gray-800/40'
                              }`}
                              title={m.desc}
                            >
                              <span className="text-[12px] sm:text-sm shrink-0">{m.icon}</span>
                              <span className="hidden sm:inline shrink-0">{m.label}</span>
                            </button>
                          );
                        });
                      })()}
                    </div>

                    {/* Spreadsheet Controls only visible when 'sheet' is selected */}
                    {offsiteSubTab === 'sheet' && (
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Combined Search & Filters Toggle Button */}
                        <button
                          onClick={() => {
                            const nextState = !offsiteSearchFilterOpen;
                            setOffsiteSearchFilterOpen(nextState);
                            if (!nextState) {
                              setOffsiteSearch('');
                              setOffsiteFilterTags(new Set());
                              setOffsiteFilterLists(new Set());
                              setOffsiteAdvancedFilterOpen(false);
                            }
                          }}
                          className={`h-8 px-2 sm:px-2.5 rounded-lg flex items-center justify-center gap-1 border transition focus:outline-none cursor-pointer text-xs font-bold ${
                            offsiteSearchFilterOpen || offsiteSearch || offsiteFilterTags.size > 0 || offsiteFilterLists.size > 0
                              ? 'bg-cyan-950/45 border-cyan-500/50 text-cyan-300 shadow-lg shadow-cyan-950/20' 
                              : 'bg-cool-gray-850 border-cool-gray-700 text-cool-gray-400 hover:text-white hover:border-cool-gray-650'
                          }`}
                          title="Toggle Search and Filters Panel"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.4} stroke="currentColor" className="w-4 h-4 hover:scale-105 transition-all text-cyan-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
                          </svg>
                          <span className="hidden sm:inline ml-0.5">Filters</span>
                          {(offsiteFilterTags.size > 0 || offsiteFilterLists.size > 0 || offsiteSearch) && (
                            <span className="h-4 px-1 rounded-full bg-cyan-500 text-cool-gray-950 flex items-center justify-center text-[9px] font-black select-none animate-bounce">
                              {offsiteFilterTags.size + offsiteFilterLists.size + (offsiteSearch ? 1 : 0)}
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Session Toolbar + Connection State */}
              <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                {/* Active Relocation Popdown */}
                {activeOrder && currentView === 'offsite' && (
                  <div className="relative">
                    <button
                      onClick={() => setIsMovementPopdownOpen(!isMovementPopdownOpen)}
                      className="h-8 px-2 sm:px-2.5 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 bg-indigo-950/45 border border-indigo-500/50 text-indigo-300 hover:text-white hover:border-indigo-400 transition font-bold text-xs select-none cursor-pointer"
                      title="Active Relocation Order details"
                    >
                      <span className="flex h-2 w-2 relative shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                      <span className="hidden sm:inline shrink-0">🚚 {activeOrder.name} ({activeOrder.status === 'planning' ? 'Planning' : 'Finalized'})</span>
                      <span className="sm:hidden text-[10px] font-black shrink-0">🚚 {activeOrder.name.slice(0, 6)}</span>
                      <ChevronDown size={12} className={`transition-transform duration-200 shrink-0 ${isMovementPopdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMovementPopdownOpen && (
                      <ActiveMovementModal 
                        order={activeOrder}
                        state={state}
                        dispatch={dispatch}
                        onClose={() => setIsMovementPopdownOpen(false)}
                      />
                    )}
                  </div>
                )}

                {/* Staging Area Pending Warning Badge */}
                {hasStagedItems && (
                  <button
                    onClick={() => setCurrentView('freezer')}
                    className="flex items-center justify-center bg-amber-955/40 border border-amber-500/25 text-amber-400 hover:bg-amber-955/65 hover:text-amber-300 rounded-lg text-[11px] sm:text-xs font-semibold transition cursor-pointer px-2 py-1 gap-1 animate-pulse"
                    title="Active items or containers are pending sorting in Staging Area. Click to go there."
                  >
                    <Table className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-bold hidden md:inline">Staging Pending</span>
                  </button>
                )}



                {/* Combined Sync, Undo, Redo, and History Dropdown Menu */}
                <div className="relative">
                  <button
                    onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
                    className={`h-8 px-2 sm:px-2.5 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 border transition duration-150 focus:outline-none cursor-pointer text-[11px] sm:text-xs font-bold ${
                      isSingleUserMode
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/30'
                        : singleUserLock && singleUserLock.clientId !== clientId
                        ? 'bg-amber-950/40 text-amber-300 border-amber-500/50'
                        : isPendingSync
                        ? 'bg-amber-950/20 text-amber-400 border-amber-500/25 animate-pulse'
                        : syncStatus === 'remote_editing'
                        ? 'bg-fuchsia-950/20 text-fuchsia-400 border-fuchsia-500/25 animate-pulse'
                        : syncStatus === 'synced'
                        ? 'bg-cyan-950/20 text-cyan-400 border-cyan-500/20'
                        : syncStatus === 'connecting'
                        ? 'bg-amber-950/20 text-amber-400 border-amber-500/25 animate-pulse'
                        : 'bg-rose-950/20 text-rose-400 border-rose-500/20'
                    }`}
                    title={
                      isSingleUserMode
                        ? 'Single-User Mode Active (Zero-Lag Local Storage)'
                        : singleUserLock && singleUserLock.clientId !== clientId
                        ? `Locked in Single-User Mode by ${singleUserLock.holderName}`
                        : `Session Sync State: ${isPendingSync ? 'Saving locally before sync...' : syncStatus === 'remote_editing' ? 'Someone else is actively editing...' : syncStatus === 'synced' ? 'Live connected' : syncStatus === 'connecting' ? 'Connecting...' : 'Disconnected (Click to sync)'}`
                    }
                  >
                    {isSingleUserMode ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-0.5 shrink-0" />
                    ) : singleUserLock && singleUserLock.clientId !== clientId ? (
                      <span className="text-amber-400 text-xs shrink-0">🔒</span>
                    ) : (
                      <svg 
                        className={`w-3.5 h-3.5 flex-shrink-0 ${isRefreshing ? 'animate-spin' : (isPendingSync || syncStatus === 'connecting' || syncStatus === 'remote_editing') ? 'animate-bounce' : ''}`} 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    )}
                    <span className="hidden sm:inline">
                      {isSingleUserMode
                        ? 'Solo Mode'
                        : singleUserLock && singleUserLock.clientId !== clientId
                        ? `Locked (${singleUserLock.holderName})`
                        : isPendingSync
                        ? 'Saving...'
                        : syncStatus === 'remote_editing'
                        ? 'User Editing...'
                        : syncStatus === 'synced'
                        ? 'Live'
                        : syncStatus === 'connecting'
                        ? 'Syncing'
                        : 'Offline'}
                    </span>
                    <svg className="w-2.5 h-2.5 text-cool-gray-400 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {isSyncMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsSyncMenuOpen(false)} />
                      <div id="sync-status-dropdown" className="absolute right-0 mt-2 w-56 sm:w-64 bg-cool-gray-850 rounded-xl border border-cool-gray-700 shadow-2xl p-2 z-50 text-xs animate-scale-up max-h-[85vh] overflow-y-auto">
                        
                        {/* Single-User Mode Control Panel */}
                        <div className="p-2.5 bg-cool-gray-900/80 rounded-lg border border-cool-gray-750 mb-2">
                          <div className="text-[10px] uppercase tracking-wider text-cool-gray-400 font-bold mb-1.5 flex items-center justify-between">
                            <span>Operating Mode</span>
                            {isSingleUserMode && (
                              <span className="text-emerald-400 text-[9px] font-bold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/40">
                                Zero-Lag Active
                              </span>
                            )}
                          </div>

                          {isSingleUserMode ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-emerald-300 font-medium leading-tight">
                                🔒 Single-User Mode is active. Changes save locally with zero lag and auto-sync when idle or switching tabs.
                              </p>
                              <button
                                onClick={async () => {
                                  await releaseSingleUserMode();
                                  setIsSyncMenuOpen(false);
                                }}
                                className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                              >
                                <span>⚡ Exit Solo Mode & Sync</span>
                              </button>
                            </div>
                          ) : singleUserLock && singleUserLock.clientId !== clientId ? (
                            <div className="space-y-2">
                              <p className="text-[11px] text-amber-300 leading-tight">
                                🔒 Locked in Single-User Mode by <span className="font-bold text-white">{singleUserLock.holderName}</span>.
                              </p>
                              <button
                                onClick={async () => {
                                  await requestBreakIn();
                                  setIsSyncMenuOpen(false);
                                }}
                                className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                              >
                                <span>⚠️ Request Break-In (5s)</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[11px] text-cool-gray-400 leading-tight">
                                Live multi-user sync. Switch to Single-User Mode to eliminate refresh lag during fast edits.
                              </p>
                              <button
                                onClick={async () => {
                                  const res = await claimSingleUserMode();
                                  if (!res.success && res.message) {
                                    alert(res.message);
                                  }
                                  setIsSyncMenuOpen(false);
                                }}
                                className="w-full py-1.5 px-2 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/40 text-cyan-200 hover:text-white font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <span>🔒 Enable Single-User Mode</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            handleManualRefresh();
                            setIsSyncMenuOpen(false);
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-cool-gray-300 hover:bg-cool-gray-700 hover:text-white transition font-medium cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <svg 
                              className={`w-3.5 h-3.5 flex-shrink-0 text-cyan-400 ${isRefreshing ? 'animate-spin' : ''}`} 
                              xmlns="http://www.w3.org/2000/svg" 
                              fill="none" 
                              viewBox="0 0 24 24" 
                              stroke="currentColor" 
                              strokeWidth={2.5}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Sync Status
                          </span>
                          <span className={`text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded ${
                            isSingleUserMode
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-850/40'
                              : isPendingSync
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-850/40 animate-pulse'
                              : syncStatus === 'remote_editing'
                              ? 'bg-fuchsia-950/80 text-fuchsia-400 border border-fuchsia-850/40 animate-pulse'
                              : syncStatus === 'synced' 
                              ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-850/40' 
                              : syncStatus === 'connecting'
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-850/40'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-850/40'
                          }`}>
                            {isSingleUserMode ? 'Solo Cached' : isPendingSync ? 'Saving locally' : syncStatus === 'remote_editing' ? 'User Editing' : syncStatus === 'synced' ? 'Synced' : syncStatus === 'connecting' ? 'Connecting' : 'Offline'}
                          </span>
                        </button>

                        <div className="h-px bg-cool-gray-700/60 my-1" />

                        <button
                          onClick={() => {
                            dispatch({ type: 'UNDO' });
                            setIsSyncMenuOpen(false);
                          }}
                          disabled={undoStack.length === 0}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition font-medium ${
                            undoStack.length > 0 
                              ? 'text-cool-gray-200 hover:bg-cool-gray-700 hover:text-white cursor-pointer' 
                              : 'text-cool-gray-600 cursor-not-allowed'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Undo className={`w-3.5 h-3.5 ${undoStack.length > 0 ? 'text-cyan-400' : 'text-cool-gray-600'}`} />
                            Undo Action
                          </span>
                          <span className="text-[10px] text-cool-gray-500 font-mono">
                            {undoStack.length}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            dispatch({ type: 'REDO' });
                            setIsSyncMenuOpen(false);
                          }}
                          disabled={redoStack.length === 0}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition font-medium ${
                            redoStack.length > 0 
                              ? 'text-cool-gray-200 hover:bg-cool-gray-700 hover:text-white cursor-pointer' 
                              : 'text-cool-gray-605 cursor-not-allowed'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Redo className={`w-3.5 h-3.5 ${redoStack.length > 0 ? 'text-cyan-400' : 'text-cool-gray-600'}`} />
                            Redo Action
                          </span>
                          <span className="text-[10px] text-cool-gray-500 font-mono">
                            {redoStack.length}
                          </span>
                        </button>

                        <div className="h-px bg-cool-gray-700/60 my-1" />

                        <button
                          onClick={() => {
                            setCurrentView('history');
                            setIsSyncMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 rounded-lg text-left transition font-medium cursor-pointer ${
                            currentView === 'history' ? 'bg-cyan-600/30 text-white font-semibold' : 'text-cool-gray-300 hover:bg-cool-gray-700 hover:text-white'
                          }`}
                        >
                          <History className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Audit History</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* User dropdown options (with hamburger menu trigger - always rightmost) */}
                <div className="absolute top-0 right-0 md:relative md:top-auto md:right-auto z-50">
                  <button
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="flex items-center justify-center bg-cool-gray-850 hover:bg-cool-gray-750 text-cool-gray-200 rounded-lg border border-cool-gray-700 cursor-pointer transition duration-150 w-8 h-8 relative"
                    title="Menu Options"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4.5 h-4.5 text-cool-gray-300">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                    </svg>
                  </button>

                  {isUserDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsUserDropdownOpen(false)} />
                      <div id="user-hamburger-dropdown" className="absolute right-0 sm:right-0 mt-2 w-56 max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-xl bg-cool-gray-900 border border-cool-gray-700 shadow-2xl py-1.5 z-50 text-xs animate-fade-in origin-top-right">
                        <div className="py-1">
                          {/* Top Action Section */}
                          <div className="px-3.5 py-1 text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider">
                            <span>Operations</span>
                          </div>

                          {['product', 'freezer', 'display_case'].includes(currentView) && (
                            <button
                              onClick={() => {
                                setIsUserDropdownOpen(false);
                                setActiveModal({ type: 'BULK_ADD_MEAT' });
                              }}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left transition font-normal text-emerald-400 hover:bg-emerald-950/40 hover:text-white cursor-pointer select-none"
                            >
                              <PackagePlus className="w-3.5 h-3.5 text-emerald-450" />
                              <span>Inbound Bulk Stock</span>
                            </button>
                          )}

                          {currentView === 'offsite' && (
                            <>
                              <div className="border-t border-cool-gray-800/80 my-1.5"></div>
                              <div className="px-3.5 py-1 text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                                <span>Off-Site Management</span>
                              </div>

                              <button
                                onClick={() => {
                                  setIsUserDropdownOpen(false);
                                  setOffsiteSubTab('import');
                                }}
                                className="flex w-full items-center gap-2 px-4 py-2 text-left transition font-normal text-indigo-300 hover:bg-indigo-950/40 hover:text-white cursor-pointer select-none"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-indigo-400">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                <span>Bulk CSV Intake</span>
                              </button>
                            </>
                          )}

                          <div className="border-t border-cool-gray-800/80 my-1.5"></div>

                          {/* Storage Locations */}
                          <div className="px-3.5 py-1 text-[10px] font-bold text-cool-gray-500 uppercase tracking-wider">
                            <span>Storage Locations</span>
                          </div>

                          <button
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              if (!['product', 'freezer', 'display_case'].includes(currentView)) {
                                setCurrentView('product');
                              }
                            }}
                            className={`flex w-full items-center justify-between px-4 py-2 text-left transition font-normal cursor-pointer ${
                              ['product', 'freezer', 'display_case'].includes(currentView)
                                ? 'bg-cyan-600/10 text-cyan-455'
                                : 'text-cool-gray-300 hover:bg-cool-gray-750 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1M5.25 10.75H21" />
                              </svg>
                              On-Site Warehouses
                            </span>
                            {['product', 'freezer', 'display_case'].includes(currentView) && (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-cyan-400 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              setCurrentView('offsite');
                            }}
                            className={`flex w-full items-center justify-between px-4 py-2 text-left transition font-normal cursor-pointer ${
                              currentView === 'offsite' 
                                ? 'bg-indigo-600/15 text-indigo-400' 
                                : 'text-cool-gray-300 hover:bg-cool-gray-750 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72l1.189-1.19A1.5 1.5 0 0110.125 3h3.75a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .414.336.75.75.75z" />
                              </svg>
                              Off-Site Storage
                            </span>
                            {currentView === 'offsite' && (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-indigo-400 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              setCurrentView('butcher_records');
                            }}
                            className={`flex w-full items-center justify-between px-4 py-2 text-left transition font-normal cursor-pointer ${
                              currentView === 'butcher_records' 
                                ? 'bg-rose-600/15 text-rose-400' 
                                : 'text-cool-gray-300 hover:bg-cool-gray-750 hover:text-white'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25M9 16.5v.75m3-3v3M15 12v5.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              Butcher Records
                            </span>
                            {currentView === 'butcher_records' && (
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-rose-400 shrink-0">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>

                          <div className="border-t border-cool-gray-800 my-1.5"></div>

                          <button
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              setInitialLibraryTab('products');
                              setCurrentView('library');
                            }}
                            className={`flex w-full items-center gap-2 px-4 py-2 text-left transition font-normal cursor-pointer ${currentView === 'library' && initialLibraryTab !== 'lists' ? 'bg-cyan-600 text-white' : 'text-cool-gray-300 hover:bg-cool-gray-750 hover:text-white'}`}
                          >
                              <Tag className="w-3.5 h-3.5 text-cyan-500" /> Catalog & Settings
                          </button>
                          <button
                            onClick={() => {
                              setIsUserDropdownOpen(false);
                              setInitialLibraryTab('lists');
                              setCurrentView('library');
                            }}
                            className={`flex w-full items-center gap-2 px-4 py-2 text-left transition font-normal cursor-pointer ${currentView === 'library' && initialLibraryTab === 'lists' ? 'bg-cyan-600 text-white shadow' : 'text-cool-gray-300 hover:bg-cool-gray-750 hover:text-white'}`}
                          >
                              <ClipboardList className="w-3.5 h-3.5 text-cyan-400" /> Lists
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Search & Filters Row */}
            {currentView !== 'library' && currentView !== 'history' && currentView !== 'reconcile' && currentView !== 'users' && currentView !== 'offsite' && currentView !== 'butcher_records' && isSearchFilterOpen && (
              <div className="mt-2.5 pt-2.5 border-t border-cool-gray-800/80 animate-fade-in w-full text-xs bg-cool-gray-900/60 p-3 rounded-lg border border-cool-gray-800/50">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Compact Search input box */}
                  <div className="relative w-full lg:max-w-[280px] shrink self-center">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <SearchIcon className="h-3.5 w-3.5 text-cyan-400/80" />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search items, freezers, notes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full rounded-md border-0 bg-cool-gray-850 pl-8 pr-7 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-750 placeholder:text-cool-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 py-1.5 text-xs transition duration-150"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')} 
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-cool-gray-400 hover:text-white cursor-pointer font-bold text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter selectors panel */}
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end flex-grow w-full lg:w-auto">
                    
                    {/* Integrated Nested Category / Subcategory Dropdown */}
                    <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-cool-gray-400 mr-0.5">Category:</span>
                      <div className="w-full sm:min-w-[190px]">
                        <select
                          value={currentCategoryValue}
                          onChange={(e) => handleCategorySelectChange(e.target.value)}
                          className={`bg-cool-gray-850 text-xs font-bold rounded border py-1.5 px-3 pr-8 outline-none cursor-pointer focus:ring-1 w-full transition ${
                            isDisplay 
                              ? 'text-amber-400 focus:ring-amber-500 border-amber-600/30 hover:border-amber-500' 
                              : 'text-cyan-400 focus:ring-cyan-500 border-cyan-600/30 hover:border-cyan-500'
                          }`}
                        >
                          <option value="all">All Categories</option>
                          {groupedCategories.map(group => (
                            <React.Fragment key={group.primary}>
                              <option value={`primary:${group.primary}`} className="font-bold text-cool-gray-100 bg-cool-gray-900">
                                {group.primary} (All)
                              </option>
                              {group.subs.map(sub => (
                                <option key={sub} value={`sub:${group.primary}:${sub}`} className="text-cool-gray-300 bg-cool-gray-900">
                                  {group.primary} › {sub}
                                </option>
                              ))}
                            </React.Fragment>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Storage Location Selector */}
                    <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold text-cool-gray-400 mr-0.5">Location:</span>
                      <div className="w-full sm:min-w-[160px]">
                        <select
                          value={selectedFreezerId || 'all'}
                          onChange={(e) => setSelectedFreezerId(e.target.value)}
                          className={`bg-cool-gray-850 text-xs font-bold rounded border py-1.5 px-3 pr-8 outline-none cursor-pointer focus:ring-1 w-full transition ${
                            isDisplay 
                              ? 'text-amber-400 focus:ring-amber-500 border-amber-600/30 hover:border-amber-500' 
                              : 'text-cyan-400 focus:ring-cyan-500 border-cyan-600/30 hover:border-cyan-500'
                          }`}
                        >
                          <option value="all">All {isDisplay ? 'Display Cases' : 'Freezers'}</option>
                          {!isDisplay && <option value="staging">🛒 Staging Area</option>}
                          {filterFreezers.map(f => (
                            <option key={f.id} value={f.id}>{f.name} {f.isSpecial ? '🌟' : ''}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Custom Multiselect Checkbox Tag Filter Dropdown */}
                    {(currentView === 'product' || currentView === 'display_case' || currentView === 'freezer') && (
                      <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto relative">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-cool-gray-400 mr-0.5">Tag Filter:</span>
                        <div className="w-full sm:min-w-[180px] relative">
                          <button
                            type="button"
                            onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                            className={`bg-cool-gray-850 text-xs font-bold rounded border py-1.5 px-3 pr-8 text-left outline-none cursor-pointer focus:ring-1 w-full transition flex items-center justify-between select-none ${
                              isDisplay 
                                ? 'text-amber-400 focus:ring-amber-500 border-amber-600/30 hover:border-amber-500' 
                                : 'text-cyan-400 focus:ring-cyan-500 border-cyan-600/30 hover:border-cyan-500'
                            }`}
                          >
                            <span className="truncate">
                              {activeCheckedTags.length === allTagIds.length ? (
                                'All Tags Included'
                              ) : activeCheckedTags.length === 0 ? (
                                'No Tags'
                              ) : activeCheckedTags.length === 1 ? (
                                (() => {
                                  const singleId = activeCheckedTags[0];
                                  if (singleId === 'untagged') return 'Untagged Items';
                                  const t = (state.tags || []).find(tag => tag.id === singleId);
                                  return t ? t.name : singleId;
                                })()
                              ) : (
                                `${activeCheckedTags.length} Tags Selected`
                              )}
                            </span>
                            <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                              <svg className="h-4 w-4 text-cool-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </span>
                          </button>

                          {isTagDropdownOpen && (
                            <>
                              {/* Click outside backdrop */}
                              <div className="fixed inset-0 z-40" onClick={() => setIsTagDropdownOpen(false)} />
                              
                              {/* Dropdown Menu */}
                              <div className="absolute left-0 mt-2 w-64 rounded-xl bg-cool-gray-900 border border-cool-gray-750 shadow-2xl py-1.5 z-50 text-xs animate-fade-in origin-top-left max-h-80 overflow-y-auto">
                                <div className="px-3 py-1 border-b border-cool-gray-800 flex items-center justify-between gap-2 font-semibold text-[10px] text-cool-gray-400">
                                  <span>TAGS FILTER CONTROLS</span>
                                  <div className="flex gap-2">
                                    <button 
                                      type="button"
                                      onClick={() => setCheckedTagIds(allTagIds)}
                                      className="text-cyan-400 hover:underline cursor-pointer select-none"
                                    >
                                      All
                                    </button>
                                    <span className="text-cool-gray-600">|</span>
                                    <button 
                                      type="button"
                                      onClick={() => setCheckedTagIds([])}
                                      className="text-cyan-400 hover:underline cursor-pointer select-none"
                                    >
                                      None
                                    </button>
                                  </div>
                                </div>
                                <div className="py-1">
                                  {/* Untagged virtual option */}
                                  <label className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-cool-gray-800 transition cursor-pointer select-none">
                                    <input 
                                      type="checkbox"
                                      checked={activeCheckedTags.includes('untagged')}
                                      onChange={() => {
                                        const next = activeCheckedTags.includes('untagged')
                                          ? activeCheckedTags.filter(id => id !== 'untagged')
                                          : [...activeCheckedTags, 'untagged'];
                                        setCheckedTagIds(next);
                                      }}
                                      className={`h-4 w-4 rounded border-cool-gray-500 bg-cool-gray-700 cursor-pointer ${
                                        isDisplay ? 'text-amber-500 focus:ring-amber-500' : 'text-cyan-600 focus:ring-cyan-600'
                                      }`}
                                    />
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
                                      <span className="text-cool-gray-200 font-bold truncate">Untagged Items</span>
                                    </div>
                                  </label>

                                  {/* Dynamic tags from DB */}
                                  {(state.tags || []).map(t => {
                                    const isChecked = activeCheckedTags.includes(t.id);
                                    return (
                                      <label key={t.id} className="flex items-center gap-2.5 px-3.5 py-2 hover:bg-cool-gray-800 transition cursor-pointer select-none">
                                        <input 
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {
                                            const next = isChecked
                                              ? activeCheckedTags.filter(id => id !== t.id)
                                              : [...activeCheckedTags, t.id];
                                            setCheckedTagIds(next);
                                          }}
                                          className={`h-4 w-4 rounded border-cool-gray-500 bg-cool-gray-700 cursor-pointer ${
                                            isDisplay ? 'text-amber-500 focus:ring-amber-500' : 'text-cyan-600 focus:ring-cyan-600'
                                          }`}
                                        />
                                        <div className="flex items-center gap-1.5 overflow-hidden">
                                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color || '#60a5fa' }} />
                                          <span className="text-cool-gray-200 font-bold truncate">
                                            {t.id === 'use-first' ? '🍳 ' : t.id === 'not-for-sale' ? '🛑 ' : '🏷️ '}{t.name}
                                          </span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Other toggle options */}
                    {(currentView === 'product' || currentView === 'display_case' || currentView === 'freezer') && (
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center shrink-0 w-auto">
                          <input
                            id="global-hide-zero-box-compact"
                            type="checkbox"
                            checked={hideZeroQuantity}
                            onChange={(e) => setHideZeroQuantity(e.target.checked)}
                            className={`h-4 w-4 rounded border-cool-gray-500 bg-cool-gray-700 cursor-pointer ${
                              isDisplay ? 'text-amber-500 focus:ring-amber-500' : 'text-cyan-600 focus:ring-cyan-600'
                            }`}
                          />
                          <label htmlFor="global-hide-zero-box-compact" className="ml-2 block text-xs text-cool-gray-300 font-bold tracking-wide cursor-pointer select-none">
                            Hide Zero Qty
                          </label>
                        </div>

                        {currentView === 'display_case' && (
                          <div className="flex items-center shrink-0 w-auto border-l border-cool-gray-750 pl-3">
                            <input
                              id="global-show-restock-with-stock-box"
                              type="checkbox"
                              checked={showZeroQtyWithStock}
                              onChange={(e) => setShowZeroQtyWithStock(e.target.checked)}
                              className="h-4 w-4 rounded border-cool-gray-500 bg-cool-gray-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                            />
                            <label
                              htmlFor="global-show-restock-with-stock-box"
                              className="ml-2 block text-xs text-amber-300 font-extrabold tracking-wide cursor-pointer select-none flex items-center gap-1"
                              title="Show items with 0 display quantity if they have on-site backstock available to restock"
                            >
                              <span>⚡</span> Show 0 Qty w/ On-Site Stock
                            </label>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* Expanded Off-Site Search & Filters Row */}
            {currentView === 'offsite' && offsiteSubTab === 'sheet' && offsiteSearchFilterOpen && (
              <div className="mt-2.5 pt-2.5 border-t border-cool-gray-800/80 animate-fade-in w-full text-xs bg-cool-gray-900/60 p-3 rounded-lg border border-cool-gray-800/50">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Compact Search input box */}
                  <div className="relative w-full lg:max-w-[280px] shrink self-center">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <SearchIcon className="h-3.5 w-3.5 text-cyan-400/80" />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search cuts or boxes..."
                      value={offsiteSearch}
                      onChange={(e) => setOffsiteSearch(e.target.value)}
                      className="block w-full rounded-md border-0 bg-cool-gray-850 pl-8 pr-7 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-750 placeholder:text-cool-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 py-1.5 text-xs transition duration-150"
                    />
                    {offsiteSearch && (
                      <button 
                        onClick={() => setOffsiteSearch('')} 
                        className="absolute inset-y-0 right-0 flex items-center pr-2 text-cool-gray-400 hover:text-white cursor-pointer font-bold text-[10px]"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter selectors panel */}
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end flex-grow w-full lg:w-auto">
                    {/* Advanced Filters Button */}
                    <div className="relative">
                      <button
                        onClick={() => setOffsiteAdvancedFilterOpen(!offsiteAdvancedFilterOpen)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                          offsiteAdvancedFilterOpen || offsiteFilterTags.size > 0 || offsiteFilterLists.size > 0
                            ? 'bg-cyan-950/45 border-cyan-500/50 text-cyan-300 shadow-md'
                            : 'bg-cool-gray-850 border-cool-gray-700 text-cool-gray-400 hover:text-white'
                        }`}
                        title="Toggle tag and list advanced filters"
                      >
                        <Filter size={14} className="text-cyan-400" />
                        <span>Tag & List Filters</span>
                        {(offsiteFilterTags.size > 0 || offsiteFilterLists.size > 0) && (
                          <span className="h-4 px-1 rounded-full bg-cyan-500 text-cool-gray-950 flex items-center justify-center text-[9px] font-black">
                            {offsiteFilterTags.size + offsiteFilterLists.size}
                          </span>
                        )}
                      </button>

                      {offsiteAdvancedFilterOpen && (
                        <AdvancedFilterMenu 
                          tags={state.tags || []}
                          lists={state.customLists || []}
                          selectedTags={offsiteFilterTags}
                          selectedLists={offsiteFilterLists}
                          onChange={(tags, lists) => {
                            setOffsiteFilterTags(tags);
                            setOffsiteFilterLists(lists);
                          }}
                          onClose={() => setOffsiteAdvancedFilterOpen(false)}
                        />
                      )}
                    </div>

                    {/* Column Selector */}
                    <div className="relative group">
                      <button className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-cool-gray-850 border-cool-gray-700 text-cool-gray-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer">
                        <span>Columns</span>
                        <ChevronDown size={14} className="text-cool-gray-500 group-hover:text-cyan-400 transition-colors" />
                      </button>
                      <div className="absolute right-0 mt-1 hidden group-hover:block bg-cool-gray-800 border border-cool-gray-700 rounded-lg shadow-xl p-2 z-50 min-w-[160px] animate-fade-in text-cool-gray-200">
                        <div className="grid grid-cols-1 gap-1">
                          {[
                            { id: 'box', label: 'Box' },
                            { id: 'cuts', label: 'Cuts' },
                            { id: 'category', label: 'Category' },
                            { id: 'weight', label: 'Weight' },
                            { id: 'pieces', label: 'Pieces' },
                            { id: 'location', label: 'Location' },
                            { id: 'pallet', label: 'Pallet' },
                            { id: 'movedTo', label: 'Moved To' },
                            { id: 'flag', label: 'Flag' },
                            { id: 'serial', label: 'Serial' },
                            { id: 'lotNumber', label: 'Lot Number' },
                            { id: 'packDate', label: 'Pack Date' }
                          ].map(col => (
                            <label key={col.id} className="flex items-center gap-2 cursor-pointer hover:bg-cool-gray-750 px-2 py-1 rounded select-none text-xs">
                              <input 
                                type="checkbox"
                                checked={offsiteVisibleColumns.has(col.id)}
                                onChange={(e) => {
                                  const next = new Set(offsiteVisibleColumns);
                                  if (e.target.checked) next.add(col.id);
                                  else next.delete(col.id);
                                  setOffsiteVisibleColumns(next);
                                  localStorage.setItem("offsite-visible-columns", JSON.stringify(Array.from(next)));
                                }}
                                className="rounded bg-cool-gray-950 border-cool-gray-750 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-3.5 h-3.5"
                              />
                              {col.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Ungrouped Toggle */}
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-cool-gray-300 hover:text-white cursor-pointer select-none bg-cool-gray-850 border border-cool-gray-700 px-3 py-1.5 rounded-lg">
                      <input
                        type="checkbox"
                        checked={offsiteViewUngrouped}
                        onChange={e => {
                          setOffsiteViewUngrouped(e.target.checked);
                          localStorage.setItem("offsite-view-ungrouped", e.target.checked ? "true" : "false");
                        }}
                        className="rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-4 h-4"
                      />
                      <span>Ungrouped</span>
                    </label>

                    {/* Direct Edit Toggle */}
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-cool-gray-300 hover:text-white cursor-pointer select-none bg-cool-gray-850 border border-cool-gray-700 px-3 py-1.5 rounded-lg">
                      <input
                        type="checkbox"
                        checked={offsiteDirectEdit}
                        onChange={e => setOffsiteDirectEdit(e.target.checked)}
                        className="rounded bg-cool-gray-900 border-cool-gray-700 text-blue-500 focus:ring-blue-500/50 cursor-pointer w-4 h-4"
                      />
                      <span>Direct Edit</span>
                    </label>

                    {/* View Original Names Toggle */}
                    <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-cool-gray-300 hover:text-white cursor-pointer select-none bg-cool-gray-850 border border-cool-gray-700 px-3 py-1.5 rounded-lg">
                      <input
                        type="checkbox"
                        checked={offsiteViewOriginalNames}
                        onChange={e => setOffsiteViewOriginalNames(e.target.checked)}
                        className="rounded bg-cool-gray-900 border-cool-gray-700 text-blue-500 focus:ring-blue-500/50 cursor-pointer w-4 h-4"
                      />
                      <span>Raw CSV Names</span>
                    </label>
                  </div>
                </div>
              </div>
            )}
             { (currentView === 'library' || currentView === 'history' || currentView === 'reconcile') && <div className="w-full h-4"></div>}
          </div>
        </header>

        <main>
          {renderCurrentView()}
        </main>
      </div>
      
      {/* Primary Modal Frame */}
      <Modal
        isOpen={!!activeModal}
        onClose={handleCloseModal}
        title={getModalTitle(activeModal)}
        maxWidth={getModalMaxWidth(activeModal)}
        fullHeight={activeModal?.type === 'BULK_ADD_MEAT' || activeModal?.type === 'MOVE_MEAT' || activeModal?.type === 'CHANGE_CONTAINER_FLOW'}
      >
        {renderModalContent()}
      </Modal>





      {/* Real-time Inventory Sync Notification Toast */}
      {showSyncToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm bg-cool-gray-850 hover:bg-cool-gray-800 text-cool-gray-100 p-4 rounded-xl border border-cyan-500/30 shadow-2xl flex items-start gap-3 animate-fade-in transition duration-300">
          <div className="p-1.5 rounded-full bg-cyan-500/10 text-cyan-400 mt-0.5 flex-shrink-0 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
          <div className="flex-grow min-w-0">
            <h4 className="text-sm font-semibold text-cyan-300">Inventory Updated Live</h4>
            <p className="text-xs text-cool-gray-400 mt-1 leading-relaxed">
              New stock revisions by <strong className="text-cool-gray-200">@{lastSyncBy}</strong> have been pulled and updated in your view.
            </p>
          </div>
          <button 
            onClick={() => setShowSyncToast(false)} 
            className="text-cool-gray-500 hover:text-white transition duration-150 flex-shrink-0 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      )}

      {/* Global Expanded Image Viewer Lightbox */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-6 animate-fade-in"
          onClick={() => setExpandedImage(null)}
          id="global-image-lightbox"
        >
          {/* Close button top right */}
          <button 
            type="button"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 bg-cool-gray-800/85 hover:bg-cool-gray-700 text-cool-gray-100 hover:text-white p-2.5 rounded-full transition-all duration-200 border border-cool-gray-700 pointer-events-auto shadow-lg flex items-center justify-center cursor-pointer hover:scale-105 active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedImage(null);
            }}
            title="Close image view"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Core Image container */}
          <div 
            className="relative max-w-full max-h-[85vh] flex flex-col items-center pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <img 
              src={expandedImage.src} 
              alt={expandedImage.title}
              className="max-w-full max-h-[75vh] md:max-h-[80vh] object-contain rounded-lg border border-cool-gray-800 shadow-2xl animate-scale-up"
              referrerPolicy="no-referrer"
            />
            {expandedImage.title && (
              <div className="mt-4 px-4 py-1.5 bg-cool-gray-850/95 border border-cool-gray-750 rounded-full text-center text-xs sm:text-sm font-bold text-cool-gray-150 shadow-md">
                {expandedImage.title}
              </div>
            )}
          </div>
        </div>
      )}

      {quickInfoItem && (
        <ProductQuickInfoModal
          quickInfoItem={quickInfoItem}
          onClose={() => setQuickInfoItem(null)}
          state={state}
          dispatch={dispatch}
          onFilterPallets={handleFilterPalletFromModal}
          onFilterLocations={handleFilterLocationFromModal}
        />
      )}

      {readOnlyNoticeModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-cool-gray-850 border border-cyan-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-cool-gray-750 pb-3">
              <div className="p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Live Snapshot Preview Mode</h3>
                <p className="text-xs text-cool-gray-400 font-semibold">Database Modifications Blocked</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-cool-gray-300 leading-relaxed">
              <p>
                You are currently browsing <strong className="text-cyan-300 font-mono">{state.previewBackupFilename || 'a backup snapshot'}</strong> in read-only Live Preview Mode.
              </p>
              <div className="bg-cool-gray-900 border border-cool-gray-750 p-3 rounded-xl text-cool-gray-300 font-medium leading-relaxed">
                {readOnlyNoticeModal.message || 'All additions, quantity adjustments, container moves, and record deletions are disabled to keep this snapshot preview unmodified.'}
              </div>
              <p className="text-cool-gray-400">
                To make changes to your inventory, exit preview mode to return to your live database.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setReadOnlyNoticeModal({ isOpen: false })}
                className="px-4 py-2 rounded-xl bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 text-xs font-bold transition cursor-pointer"
              >
                Got It (Stay in Preview)
              </button>
              <button
                type="button"
                onClick={() => {
                  handleEndPreviewMode();
                  setReadOnlyNoticeModal({ isOpen: false });
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-cool-gray-950 text-xs font-extrabold transition cursor-pointer shadow-lg"
              >
                Exit Preview Mode
              </button>
            </div>
          </div>
        </div>
      )}

      {actionErrorModal.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-cool-gray-850 border border-red-500/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-cool-gray-750 pb-3">
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Action Error</h3>
                <p className="text-xs text-red-400 font-semibold">
                  {actionErrorModal.actionType ? `Action Failed: ${actionErrorModal.actionType}` : 'Server Transaction Interrupted'}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-cool-gray-300 leading-relaxed">
              <div className="bg-red-950/70 border border-red-500/40 text-red-200 p-3.5 rounded-xl text-xs font-semibold leading-relaxed space-y-1">
                <div className="text-red-300 font-bold uppercase tracking-wider text-[10px]">Error Summary</div>
                <div>{actionErrorModal.message || 'Failed to apply change on the server.'}</div>
              </div>

              {actionErrorModal.details && actionErrorModal.details !== actionErrorModal.message && (
                <div className="bg-cool-gray-900 border border-cool-gray-750 p-3 rounded-xl text-cool-gray-300 space-y-1 font-mono text-[11px] overflow-x-auto max-h-40">
                  <div className="text-cool-gray-450 font-sans font-bold uppercase tracking-wider text-[10px]">Technical Details</div>
                  <div className="text-red-300 whitespace-pre-wrap">{actionErrorModal.details}</div>
                </div>
              )}

              <p className="text-cool-gray-400 text-xs">
                Your local client state was safely rolled back to match the database. Click <strong>Refresh Inventory Data</strong> to sync with the server.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-cool-gray-750">
              <button
                type="button"
                onClick={() => setActionErrorModal({ isOpen: false })}
                className="px-4 py-2 rounded-xl bg-cool-gray-750 hover:bg-cool-gray-700 text-cool-gray-200 text-xs font-bold transition cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionErrorModal({ isOpen: false });
                  refreshState(true);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold transition cursor-pointer shadow-lg flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh Inventory Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
