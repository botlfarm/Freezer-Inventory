import React, { useState, useMemo } from 'react';
import { useInventory } from './hooks/useInventory';
import { getApiUrl } from './hooks/apiUrl';
import { getClientDeviceInfo } from './utils/clientDevice';
import { ModalType, View } from './types';
import { Tag, PackagePlus, History, Sparkles, Table, Package, ClipboardList, Sun, Moon, Filter, Plus, Download, ChevronDown, ChevronUp, Eye, AlertTriangle, RefreshCw, Database, RotateCcw, Users, User, Zap, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
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
import { ConnectedClientsModalContent } from './components/ConnectedClientsModalContent';
import { OffSiteStorageView } from './views/OffSiteStorageView';
import { AdvancedFilterMenu } from './views/OffSiteSpreadsheet';
import { ButcherRecordsView } from './views/ButcherRecordsView';
import { TraceabilityView } from './views/TraceabilityView';
import { ProductQuickInfoModal } from './components/ProductQuickInfoModal';
import { ActiveMovementModal } from './views/ActiveMovementModal';
import { UndoConfirmationModal } from './components/UndoConfirmationModal';
import { SortOrderModal } from './components/SortOrderModal';
import { loadSortOrderConfig, saveSortOrderConfig, sortPrimaryCategories, sortSubCategories, SortMode } from './utils/sortOrder';
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
      const scrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      setIsScrolled((prev) => {
        if (!prev && scrollY > 40) return true;
        if (prev && scrollY < 15) return false;
        return prev;
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
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

  const [currentView, setCurrentView] = useState<View>('product');

  const {
    state,
    dispatch,
    isLoading,
    hasLoadedInitial,
    error,
    refreshState,
    undoStack,
    redoStack,
    undoSnapshots,
    undoSnapshotCount,
    executeUndo,
    isUndoing,
    hasPendingChanges,
    isSaving,
    isPendingSync,
    clientId,
    operatingMode,
    setOperatingMode,
    forcedMultiUser,
    updateForcedMulti,
    isSingleUserMode,
    singleUserLock,
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
  } = useInventory(currentView);

  const [undoModalConfig, setUndoModalConfig] = useState<{
    isOpen: boolean;
    snapshotId?: string | null;
    historyId?: string | null;
  }>({ isOpen: false });

  // Global keyboard shortcut for Undo (Ctrl+Z / Cmd+Z)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        setUndoModalConfig({
          isOpen: true,
          snapshotId: null,
          historyId: null
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
  const [traceabilityInitialSearch, setTraceabilityInitialSearch] = useState<string>('');

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

  const [selectedMovementOrderId, setSelectedMovementOrderId] = useState<string | null>(() => {
    return localStorage.getItem('selected-movement-order-id') || null;
  });

  const activeOrders = useMemo(() => {
    return (state.movementOrders || []).filter((o: any) => o.status === 'planning' || o.status === 'finalized');
  }, [state.movementOrders]);

  const activeOrder = useMemo(() => {
    if (activeOrders.length === 0) return null;
    if (selectedMovementOrderId) {
      const match = activeOrders.find((o: any) => o.id === selectedMovementOrderId);
      if (match) return match;
    }
    return activeOrders[0];
  }, [activeOrders, selectedMovementOrderId]);

  const handleSelectMovementOrder = (orderId: string) => {
    setSelectedMovementOrderId(orderId);
    localStorage.setItem('selected-movement-order-id', orderId);
  };

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

  const sortConfig = useMemo(() => loadSortOrderConfig(state.appConfig), [state.appConfig]);

  const handleToggleSortMode = async (mode: SortMode) => {
    const isDisplay = currentView === 'display_case';
    const updatedConfig = {
      ...sortConfig,
      ...(isDisplay ? { displaySortMode: mode } : { productSortMode: mode })
    };
    await saveSortOrderConfig(updatedConfig);
    const currentConfigs = state.appConfig || [];
    const updatedConfigs = [
      ...currentConfigs.filter(c => c.key !== 'sort-hierarchy-config'),
      { key: 'sort-hierarchy-config', value: JSON.stringify(updatedConfig), updatedAt: new Date().toISOString() }
    ];
    dispatch({
      type: 'REPLACE_STATE',
      payload: {
        ...state,
        appConfig: updatedConfigs
      }
    });
  };

  // Group categories and subcategories together for a single integrated select list
  const groupedCategories = useMemo(() => {
    const sortConfig = loadSortOrderConfig(state.appConfig);
    const activeSortMode = currentView === 'display_case' ? sortConfig.displaySortMode : sortConfig.productSortMode;
    const list: Array<{ primary: string; subs: string[] }> = [];
    const catSet = new Set(state.products.map(p => p.primaryCategory).filter(Boolean) as string[]);
    const sortedCats = sortPrimaryCategories(Array.from(catSet), activeSortMode, sortConfig.customOrder);
    for (const cat of sortedCats) {
      const subs = Array.from(
        new Set(
          state.products
            .filter(p => p.primaryCategory === cat)
            .map(p => p.subCategory)
            .filter(Boolean) as string[]
        )
      );
      const sortedSubs = sortSubCategories(subs, cat, activeSortMode, sortConfig.customOrder);
      list.push({ primary: cat, subs: sortedSubs });
    }
    return list;
  }, [state.products, state.appConfig, currentView]);

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
  const [undoToastMessage, setUndoToastMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reconnectTrigger, setReconnectTrigger] = useState(0);
  const pendingRefreshRef = React.useRef<boolean>(false);
  const isAutoMultiActive = operatingMode === 'auto' && isCollaborativeMode;

  const clientIdRef = React.useRef(clientId);
  const isSingleUserModeRef = React.useRef(isSingleUserMode);
  const isPendingSyncRef = React.useRef(isPendingSync);
  const refreshStateRef = React.useRef(refreshState);
  const updateSingleUserLockRef = React.useRef(updateSingleUserLock);
  const updateForcedMultiRef = React.useRef(updateForcedMulti);
  const activeClientCountRef = React.useRef(activeClientCount);
  const setActiveClientCountRef = React.useRef(setActiveClientCount);
  const setConnectedClientsRef = React.useRef(setConnectedClients);
  const flushAllPendingSyncsRef = React.useRef(flushAllPendingSyncs);
  const setIsCollaborativeModeRef = React.useRef(setIsCollaborativeMode);
  const fetchConnectedClientsRef = React.useRef(fetchConnectedClients);
  const setZoneClientCountsRef = React.useRef(setZoneClientCounts);
  const recalculateCollaborativeModeRef = React.useRef(recalculateCollaborativeMode);
  const activeZoneRef = React.useRef(activeZone);
  const currentViewRef = React.useRef(currentView);

  React.useEffect(() => {
    clientIdRef.current = clientId;
    isSingleUserModeRef.current = isSingleUserMode;
    isPendingSyncRef.current = isPendingSync;
    refreshStateRef.current = refreshState;
    updateSingleUserLockRef.current = updateSingleUserLock;
    updateForcedMultiRef.current = updateForcedMulti;
    activeClientCountRef.current = activeClientCount;
    setActiveClientCountRef.current = setActiveClientCount;
    setConnectedClientsRef.current = setConnectedClients;
    flushAllPendingSyncsRef.current = flushAllPendingSyncs;
    setIsCollaborativeModeRef.current = setIsCollaborativeMode;
    fetchConnectedClientsRef.current = fetchConnectedClients;
    setZoneClientCountsRef.current = setZoneClientCounts;
    recalculateCollaborativeModeRef.current = recalculateCollaborativeMode;
    activeZoneRef.current = activeZone;
    currentViewRef.current = currentView;
  });

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
          refreshStateRef.current();
        }
      }, 150);
    };

    window.addEventListener('focusout', handleFocusOut);
    return () => window.removeEventListener('focusout', handleFocusOut);
  }, []);

  // Setup EventSource for SSE live-sync
  React.useEffect(() => {
    setSyncStatus('connecting');
    
    // Ensure the stream URL is fully qualified and resolves correctly in all ingress and root environments
    const streamUrl = getApiUrl('api/inventory/stream');
    const storedUserName = localStorage.getItem('freezerUserName') || localStorage.getItem('freezer_user') || 'User';
    const deviceInfo = getClientDeviceInfo();
    const params = new URLSearchParams({
      clientId: clientIdRef.current,
      userName: storedUserName,
      clientDevice: deviceInfo.clientDevice,
      clientInfo: deviceInfo.clientInfo,
      clientZone: activeZoneRef.current,
      clientView: currentViewRef.current
    });

    const eventSource = new EventSource(`${streamUrl}?${params.toString()}`);

    eventSource.onopen = () => {
      setSyncStatus('synced');
      fetchConnectedClientsRef.current().catch(() => {});
    };

    let remoteEditingTimeout: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init') {
          if (data.lock !== undefined || data.locks !== undefined) {
            updateSingleUserLockRef.current(data.lock, data.locks);
          }
          if (data.forcedMulti !== undefined || data.forcedMultis !== undefined) {
            updateForcedMultiRef.current(data.forcedMulti, data.forcedMultis);
          }
          if (data.clientCount !== undefined) {
            setActiveClientCountRef.current(data.clientCount);
          }
          if (data.zoneCounts) {
            setZoneClientCountsRef.current(data.zoneCounts);
          }
          if (data.clients && Array.isArray(data.clients)) {
            setConnectedClientsRef.current(data.clients);
          }
          recalculateCollaborativeModeRef.current(data.forcedMulti, data.zoneCounts);
        } else if (data.type === 'operating_mode_changed') {
          if (data.forcedMulti !== undefined || data.forcedMultis !== undefined) {
            updateForcedMultiRef.current(data.forcedMulti, data.forcedMultis);
          }
          if (data.lock !== undefined || data.locks !== undefined) {
            updateSingleUserLockRef.current(data.lock, data.locks);
          }
        } else if (data.type === 'clients_count' || data.type === 'clients_changed') {
          const count = data.count !== undefined ? data.count : data.clientCount;
          if (count !== undefined) {
            setActiveClientCountRef.current(count);
          }
          if (data.zoneCounts) {
            setZoneClientCountsRef.current(data.zoneCounts);
          }
          if (data.clients && Array.isArray(data.clients)) {
            setConnectedClientsRef.current(data.clients);
          }
          recalculateCollaborativeModeRef.current(undefined, data.zoneCounts);
        } else if (data.type === 'single_user_lock_changed') {
          updateSingleUserLockRef.current(data.lock, data.locks);
          if (data.forcedMulti !== undefined || data.forcedMultis !== undefined) {
            updateForcedMultiRef.current(data.forcedMulti, data.forcedMultis);
          }
        } else if (data.type === 'break_in_requested') {
          updateSingleUserLockRef.current(data.lock, data.locks);
        } else if (data.type === 'break_in_cancelled') {
          updateSingleUserLockRef.current(data.lock, data.locks);
        } else if (data.type === 'force_flush') {
          if (!data.targetClientId || data.targetClientId === clientIdRef.current) {
            flushAllPendingSyncsRef.current();
          }
        } else if (data.type === 'update') {
          // If this update was triggered by our own client action, ignore it (we already receive the updated state directly via HTTP response)
          if (data.sourceClientId && data.sourceClientId === clientIdRef.current) {
            return;
          }
          if (data.sourceClientId && data.sourceClientId !== clientIdRef.current) {
            recalculateCollaborativeModeRef.current();
            if (remoteEditingTimeout) clearTimeout(remoteEditingTimeout);
            remoteEditingTimeout = setTimeout(() => {
              recalculateCollaborativeModeRef.current();
            }, 4000);
          }
          if (!isSingleUserModeRef.current) {
            if (remoteEditingTimeout) clearTimeout(remoteEditingTimeout);
            setSyncStatus('synced');
            
            // Check if user is actively typing / focusing an input field
            const activeEl = document.activeElement;
            const isEditing = activeEl && (
              activeEl.tagName === 'INPUT' || 
              activeEl.tagName === 'TEXTAREA' || 
              activeEl.tagName === 'SELECT' || 
              (activeEl as HTMLElement).isContentEditable
            );
            if (isEditing) {
              pendingRefreshRef.current = true;
            } else {
              pendingRefreshRef.current = false;
              refreshStateRef.current();
            }
          }
        } else if (data.type === 'editing') {
          if (data.sourceClientId && data.sourceClientId === clientIdRef.current) {
            return;
          }
          if (data.sourceClientId && data.sourceClientId !== clientIdRef.current) {
            if (activeClientCountRef.current > 1) {
              setIsCollaborativeModeRef.current(true);
            }
          }
          if (!isSingleUserModeRef.current) {
            setSyncStatus('remote_editing');
            if (remoteEditingTimeout) clearTimeout(remoteEditingTimeout);
            remoteEditingTimeout = setTimeout(() => {
               setSyncStatus(prev => prev === 'remote_editing' ? 'synced' : prev);
               if (activeClientCountRef.current <= 1) {
                 setIsCollaborativeModeRef.current(false);
               }
            }, 4000);
          }
        }
      } catch (err) {
        console.warn('SSE JSON parse error:', err);
      }
    };

    eventSource.onerror = (e) => {
      console.warn('SSE connection lost or error:', e);
      if (eventSource.readyState === EventSource.CONNECTING) {
        setSyncStatus('connecting');
      } else {
        setSyncStatus('error');
      }
      if (!reconnectTimeout) {
        reconnectTimeout = setTimeout(() => {
          forceReconnect();
        }, 3000);
      }
    };

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (remoteEditingTimeout) clearTimeout(remoteEditingTimeout);
      eventSource.close();
    };
  }, [reconnectTrigger]);

  // Reconnect on window/tab focus or transition to visible focus
  React.useEffect(() => {
    const handleFocus = () => {
      if (syncStatus === 'error') {
        forceReconnect();
        refreshStateRef.current();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (syncStatus === 'error') {
          forceReconnect();
        }
        refreshStateRef.current();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forceReconnect, syncStatus]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await flushAllPendingSyncs();
      forceReconnect();
      await fetchConnectedClients();
      await refreshState(true);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 600);
    }
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

  // High-performance unified off-site maps (pre-indexed product lookups O(1) instead of O(N*P))
  const { offSiteQuantityMap, offSiteWeightMap } = React.useMemo(() => {
    const qtyMap: Record<string, number> = {};
    const weightMap: Record<string, number> = {};

    const products = state.products || [];
    const offSiteEntries = state.offSiteEntries || [];
    const boxes = state.boxes || [];
    const containers = state.containers || [];

    if (offSiteEntries.length === 0 || products.length === 0) {
      return { offSiteQuantityMap: qtyMap, offSiteWeightMap: weightMap };
    }

    const archivedBoxNames = new Set([
      ...boxes.filter((b: any) => b.isArchived && (b.name || b.id)).map((b: any) => (b.name || b.id).toLowerCase().trim()),
      ...containers.filter((c: any) => c.isBox && c.isArchived && c.name).map((c: any) => c.name.toLowerCase().trim())
    ]);

    const productById = new Map<string, any>();
    const productByName = new Map<string, any>();
    const productByNum = new Map<string, any>();
    const productByCleanName = new Map<string, any>();

    const cleanName = (str: string) => str.replace(/^\d+[a-zA-Z0-9-]*\s+/, '').trim().toLowerCase();
    const matchNum = (str: string) => {
      const m = str.match(/^(\d+[a-zA-Z0-9-]*)/);
      return m ? m[1].toLowerCase() : null;
    };

    products.forEach((p: any) => {
      if (p.id) productById.set(p.id, p);
      const nameLower = (p.name || '').trim().toLowerCase();
      if (nameLower) {
        productByName.set(nameLower, p);
        productByCleanName.set(cleanName(nameLower), p);
      }
      if (Array.isArray(p.productNumbers)) {
        p.productNumbers.forEach((num: any) => {
          if (num) productByNum.set(String(num).trim().toLowerCase(), p);
        });
      }
    });

    const rawEntries = offSiteEntries.filter((e: any) => {
      if (e.archived) return false;
      if (e.box && archivedBoxNames.has(e.box.toLowerCase().trim())) return false;
      return true;
    });

    rawEntries.forEach((e: any) => {
      let matched: any = null;
      if (e.productId) {
        matched = productById.get(e.productId);
      }
      if (!matched && e.originalCutName) {
        const origTrim = e.originalCutName.trim();
        const origLower = origTrim.toLowerCase();
        matched = productByName.get(origLower);
        if (!matched) {
          const num = matchNum(origTrim);
          if (num) matched = productByNum.get(num);
        }
        if (!matched) {
          matched = productByCleanName.get(cleanName(origLower));
        }
      }

      if (matched) {
        qtyMap[matched.id] = (qtyMap[matched.id] || 0) + (e.pieces || 0);
        weightMap[matched.id] = (weightMap[matched.id] || 0) + (e.netWeight || 0);
      }
    });

    return { offSiteQuantityMap: qtyMap, offSiteWeightMap: weightMap };
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
      case 'CONNECTED_CLIENTS': return 'Active Devices & Connected Users';
      case 'SORT_ORDER': return 'Configure Custom Hierarchy Sort Order';
      default: return '';
    }
  };

  const getModalMaxWidth = (modal: ModalType): string => {
    if (!modal) return 'max-w-lg';
    if (modal.type === 'RESTOCK_PROMPT' || modal.type === 'ADD_TO_LIST' || modal.type === 'SELECT_MEAT_TAGS' || modal.type === 'LIST_THRESHOLD_ALERT') return 'max-w-md';
    if (modal.type === 'BULK_ADD_MEAT' || modal.type === 'MOVE_MEAT') {
      return 'max-w-[100%] lg:max-w-[95vw] xl:max-w-7xl'; 
    }
    if (modal.type === 'CHANGE_CONTAINER_FLOW' || modal.type === 'SORT_ORDER') return 'max-w-4xl';
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
      case 'CONNECTED_CLIENTS':
        return (
          <ConnectedClientsModalContent
            currentClientId={clientId}
            clients={connectedClients}
            activeClientCount={activeClientCount}
            zoneCounts={zoneClientCounts}
            activeZone={activeZone}
            operatingMode={operatingMode}
            isCollaborativeMode={isCollaborativeMode}
            onRefresh={fetchConnectedClients}
            onDisconnect={disconnectClient}
            onForceSyncAll={forceSyncAllClients}
            onClose={handleCloseModal}
          />
        );
      case 'SORT_ORDER':
        return (
          <SortOrderModal
            state={state}
            dispatch={dispatch}
            onClose={handleCloseModal}
            initialView={activeModal.initialView}
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
    if (!hasLoadedInitial && (!state.products || state.products.length === 0)) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[360px] w-full py-20 space-y-4" id="initial-loading-view-placeholder">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <p className="text-cool-gray-400 text-sm font-medium animate-pulse">Loading database records...</p>
        </div>
      );
    }

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
            isLoading={isLoading}
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
            isLoading={isLoading}
          />
        );
      case 'history':
        return (
          <HistoryView
            state={state}
            dispatch={dispatch}
            onOpenUndo={(historyId) =>
              setUndoModalConfig({
                isOpen: true,
                historyId: historyId || null,
                snapshotId: null
              })
            }
            undoSnapshots={undoSnapshots}
          />
        );
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
            selectedMovementOrderId={activeOrder?.id || selectedMovementOrderId}
            onSelectActiveOrder={handleSelectMovementOrder}
          />
        );
      case 'butcher_records':
        return <ButcherRecordsView state={state} dispatch={dispatch} />;
      case 'traceability':
        return (
          <TraceabilityView 
            state={state} 
            dispatch={dispatch} 
            onNavigateToView={(view: View, params?: any) => {
              if (params?.search) {
                setSearchTerm(params.search);
              }
              setCurrentView(view);
            }}
            initialSearch={traceabilityInitialSearch}
          />
        );
      default:
        return null;
    }
  }



  return (
    <div className="min-h-screen bg-cool-gray-900 text-cool-gray-100 font-sans p-1.5 sm:p-5 lg:p-6 lg:pt-5">
      <div className="max-w-[1600px] mx-auto w-full">
        {/* Single-User Mode Break-In Countdown Banner */}
        {breakInCountdown !== null && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] w-[calc(100vw-1rem)] max-w-lg px-2 sm:px-4 animate-bounce-short">
            <div className="bg-amber-950/95 border-2 border-amber-500 text-amber-100 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-2.5 sm:gap-3">
              <div className="flex items-start sm:items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                  <span className="text-lg sm:text-xl">⚠️</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span>Break-In Requested</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-black uppercase tracking-wider shrink-0">
                      {breakInCountdown}s Countdown
                    </span>
                  </h4>
                  <p className="text-xs text-amber-200 mt-0.5 leading-snug whitespace-normal break-words">
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

              <div className="flex items-center justify-end gap-2 pt-1 flex-wrap sm:flex-nowrap">
                <button
                  onClick={async () => {
                    await cancelBreakIn();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-700 text-xs font-bold text-amber-200 cursor-pointer transition flex-1 sm:flex-initial text-center justify-center"
                >
                  Cancel Request
                </button>
                <button
                  onClick={async () => {
                    await releaseSingleUserMode();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 cursor-pointer shadow transition flex-1 sm:flex-initial text-center justify-center"
                >
                  Sync & Exit Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Persistent Top Banner for Second Users when Single-User Mode is locked by someone else */}
        {singleUserLock && singleUserLock.clientId !== clientId && (
          <div className={`sticky top-2 z-40 bg-amber-950/95 border border-amber-500/60 text-amber-100 shadow-2xl backdrop-blur-md transition-all duration-200 animate-scale-up w-full max-w-full box-border ${
            isScrolled
              ? 'px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl mb-2.5 flex flex-row items-center justify-between gap-2 text-xs overflow-hidden'
              : 'p-3 sm:p-4 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-sm'
          }`}>
            <div className={`flex items-start sm:items-center min-w-0 w-full sm:w-auto flex-1 ${isScrolled ? 'gap-2 truncate' : 'gap-2.5 sm:gap-3'}`}>
              {isScrolled ? (
                <span className="text-sm shrink-0">🔒</span>
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-inner mt-0.5 sm:mt-0">
                  <span className="text-base sm:text-lg">🔒</span>
                </div>
              )}
              <div className={`min-w-0 flex-1 ${isScrolled ? 'truncate' : ''}`}>
                <div className={`flex items-center gap-1.5 sm:gap-2 ${isScrolled ? 'truncate' : 'flex-wrap'}`}>
                  <strong className={`text-white font-bold ${isScrolled ? 'text-xs truncate' : 'text-xs sm:text-sm'}`}>
                    {singleUserLock.scope === 'offsite'
                      ? 'Off-Site Solo Mode'
                      : singleUserLock.scope === 'onsite'
                      ? 'On-Site Solo Mode'
                      : 'Single-User Mode'}: <span className="font-normal text-amber-200">Locked by {singleUserLock.holderName}</span>
                  </strong>
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50 uppercase tracking-wider shrink-0">
                    Read-Only
                  </span>
                </div>
                {!isScrolled && (
                  <p className="text-xs text-amber-200/90 mt-0.5 leading-snug whitespace-normal break-words">
                    <span className="font-semibold text-white">{singleUserLock.holderName}</span> {
                      singleUserLock.scope === 'offsite'
                        ? 'is currently editing Off-Site Storage/Movements in Solo Mode. On-site retail inventory remains available.'
                        : singleUserLock.scope === 'onsite'
                        ? 'is currently editing On-Site Freezers in Solo Mode. Off-site storage actions remain available.'
                        : 'is currently editing in Solo Mode with zero-lag local caching. Remote database updates are paused until they exit or go idle.'
                    }
                  </p>
                )}
              </div>
            </div>

            <div className={`flex items-center gap-1.5 shrink-0 ${isScrolled ? '' : 'w-full sm:w-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-amber-900/50'}`}>
              {singleUserLock.breakInRequest?.requestedByClientId === clientId ? (
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  <span className={`font-semibold text-amber-300 animate-pulse flex items-center gap-1 bg-amber-900/80 rounded border border-amber-700/80 whitespace-nowrap ${isScrolled ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 sm:px-3 py-1.5'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    Break-In Requested...
                  </span>
                  <button
                    onClick={async () => {
                      await cancelBreakIn();
                    }}
                    className={`rounded-lg bg-amber-900/90 hover:bg-amber-800 border border-amber-700/80 font-bold text-amber-200 cursor-pointer transition shadow whitespace-nowrap ${isScrolled ? 'text-[11px] px-2 py-1' : 'text-xs px-2.5 sm:px-3 py-1.5'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      await forceReleaseSingleUserLock();
                    }}
                    className={`rounded-lg bg-rose-700 hover:bg-rose-600 text-white font-bold cursor-pointer transition shadow whitespace-nowrap ${isScrolled ? 'text-[11px] px-2 py-1' : 'text-xs px-2.5 sm:px-3 py-1.5'}`}
                    title="Immediately release lock and regain full access"
                  >
                    Force Unlock
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                  <button
                    onClick={async () => {
                      const res = await requestBreakIn();
                      if (!res.success && res.message) {
                        alert(res.message);
                      }
                    }}
                    className={`rounded-lg bg-amber-500 hover:bg-amber-400 font-bold text-slate-950 shadow-md transition cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap w-full sm:w-auto ${isScrolled ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3.5 py-1.5 gap-1.5'}`}
                  >
                    <span>⚠️ Request Break-In (5s)</span>
                  </button>
                  <button
                    onClick={async () => {
                      await forceReleaseSingleUserLock();
                    }}
                    className={`rounded-lg bg-amber-900/80 hover:bg-amber-800 border border-amber-700 text-amber-200 font-bold cursor-pointer transition shadow whitespace-nowrap ${isScrolled ? 'text-[11px] px-2 py-1' : 'text-xs px-2.5 py-1.5'}`}
                    title="Force release the lock if the other device is unresponsive or closed"
                  >
                    Force Unlock
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Banner when Current User has Forced Single-User Mode */}
        {operatingMode === 'single' && breakInCountdown === null && (!singleUserLock || singleUserLock.clientId === clientId) && (
          <div className={`sticky top-2 z-40 bg-emerald-950/95 border border-emerald-500/60 text-emerald-100 shadow-2xl backdrop-blur-md transition-all duration-200 animate-scale-up w-full max-w-full box-border ${
            isScrolled
              ? 'px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl mb-2.5 flex flex-row items-center justify-between gap-2 text-xs overflow-hidden'
              : 'p-3 sm:p-4 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-sm'
          }`}>
            <div className={`flex items-start sm:items-center min-w-0 w-full sm:w-auto flex-1 ${isScrolled ? 'gap-2 truncate' : 'gap-2.5 sm:gap-3'}`}>
              {isScrolled ? (
                <span className="text-sm shrink-0">🔒</span>
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center shrink-0 shadow-inner mt-0.5 sm:mt-0">
                  <span className="text-base sm:text-lg">🔒</span>
                </div>
              )}
              <div className={`min-w-0 flex-1 ${isScrolled ? 'truncate' : ''}`}>
                <div className={`flex items-center gap-1.5 sm:gap-2 ${isScrolled ? 'truncate' : 'flex-wrap'}`}>
                  <strong className={`text-white font-bold ${isScrolled ? 'text-xs truncate' : 'text-xs sm:text-sm'}`}>
                    Single-User Mode (Exclusive Lock) Active
                  </strong>
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/50 uppercase tracking-wider shrink-0">
                    Zero-Lag Local
                  </span>
                </div>
                {!isScrolled && (
                  <p className="text-xs text-emerald-200/90 mt-0.5 leading-snug whitespace-normal break-words">
                    Local device caching active with zero network latency. Remote changes from other devices are locked out. Auto-times out after 5 minutes of inactivity.
                  </p>
                )}
              </div>
            </div>

            <div className={`flex items-center gap-2 shrink-0 ${isScrolled ? '' : 'w-full sm:w-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-emerald-900/50'}`}>
              <button
                onClick={async () => {
                  await flushAllPendingSyncs();
                }}
                className={`rounded-lg bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-600/60 font-bold text-emerald-200 cursor-pointer transition shadow whitespace-nowrap flex-1 sm:flex-initial text-center justify-center ${isScrolled ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3 py-1.5'}`}
              >
                Sync Now
              </button>
              <button
                onClick={async () => {
                  await setOperatingMode('auto');
                }}
                className={`rounded-lg bg-emerald-500 hover:bg-emerald-400 font-bold text-slate-950 shadow-md transition cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap flex-1 sm:flex-initial text-center ${isScrolled ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3.5 py-1.5 gap-1.5'}`}
              >
                <span>⚡ <span className={isScrolled ? 'hidden sm:inline' : ''}>Switch to </span>Auto</span>
              </button>
            </div>
          </div>
        )}

        {/* Banner when Current User has Forced Multi-User Mode */}
        {operatingMode === 'multi' && (
          <div className={`sticky top-2 z-40 bg-blue-950/95 border border-blue-500/60 text-blue-100 shadow-2xl backdrop-blur-md transition-all duration-200 animate-scale-up w-full max-w-full box-border ${
            isScrolled
              ? 'px-3 sm:px-4 py-1.5 rounded-lg sm:rounded-xl mb-2.5 flex flex-row items-center justify-between gap-2 text-xs overflow-hidden'
              : 'p-3 sm:p-4 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-sm'
          }`}>
            <div className={`flex items-start sm:items-center min-w-0 w-full sm:w-auto flex-1 ${isScrolled ? 'gap-2 truncate' : 'gap-2.5 sm:gap-3'}`}>
              {isScrolled ? (
                <Users className="w-4 h-4 text-blue-300 shrink-0" />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-blue-500/20 border border-blue-400/50 flex items-center justify-center shrink-0 shadow-inner mt-0.5 sm:mt-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300" />
                </div>
              )}
              <div className={`min-w-0 flex-1 ${isScrolled ? 'truncate' : ''}`}>
                <div className={`flex items-center gap-1.5 sm:gap-2 ${isScrolled ? 'truncate' : 'flex-wrap'}`}>
                  <strong className={`text-white font-bold ${isScrolled ? 'text-xs truncate' : 'text-xs sm:text-sm'}`}>
                    Multi-User Mode (Collaborative Sync) Forced
                  </strong>
                  {forcedMultiUser?.setByName && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/25 text-blue-200 border border-blue-400/40">
                      by {forcedMultiUser.setByName}{forcedMultiUser.setByClientId === clientId ? ' (You)' : ''}
                    </span>
                  )}
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/30 text-blue-300 font-bold border border-blue-500/50 uppercase tracking-wider shrink-0">
                    Live Broadcasts
                  </span>
                </div>
                {!isScrolled && (
                  <p className="text-xs text-blue-200/90 mt-0.5 leading-snug whitespace-normal break-words">
                    Rapid debounced synchronization (1.2s) & SSE broadcast streaming are forced on across devices. Auto-reverts to Auto mode after 5 minutes of inactivity.
                  </p>
                )}
              </div>
            </div>

            <div className={`flex items-center gap-2 shrink-0 ${isScrolled ? '' : 'w-full sm:w-auto justify-end pt-1.5 sm:pt-0 border-t sm:border-t-0 border-blue-900/50'}`}>
              <button
                onClick={async () => {
                  await flushAllPendingSyncs();
                }}
                className={`rounded-lg bg-blue-900/80 hover:bg-blue-800 border border-blue-600/60 font-bold text-blue-200 cursor-pointer transition shadow whitespace-nowrap flex-1 sm:flex-initial text-center justify-center ${isScrolled ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3 py-1.5'}`}
              >
                Sync Now
              </button>
              <button
                onClick={async () => {
                  await setOperatingMode('auto');
                }}
                className={`rounded-lg bg-blue-500 hover:bg-blue-400 font-bold text-slate-950 shadow-md transition cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap flex-1 sm:flex-initial text-center ${isScrolled ? 'text-[11px] px-2.5 py-1' : 'text-xs px-3.5 py-1.5 gap-1.5'}`}
              >
                <span>⚡ <span className={isScrolled ? 'hidden sm:inline' : ''}>Switch to </span>Auto</span>
              </button>
            </div>
          </div>
        )}

        {state.isPreviewMode && (
          <div className="bg-cyan-950/90 border border-cyan-500/40 text-cyan-200 p-3 sm:px-4 sm:py-3 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-sm animate-scale-up shadow-xl backdrop-blur w-full max-w-full box-border">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
              <span className="flex h-2.5 w-2.5 relative shrink-0 mt-1 sm:mt-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
              </span>
              <span className="text-xs sm:text-sm whitespace-normal break-words min-w-0 flex-1">
                <strong className="text-white">👁️ Live Snapshot Preview Active (Read-Only):</strong> Viewing backup <code className="bg-cyan-900/80 border border-cyan-700/60 px-1.5 py-0.5 rounded text-cyan-200 font-mono text-xs font-bold break-all">{state.previewBackupFilename || 'Snapshot'}</code>. All database modifications are disabled.
              </span>
            </div>
            <button
              onClick={handleEndPreviewMode}
              disabled={isPreviewTransitioning}
              className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-cool-gray-950 font-extrabold px-4 py-1.5 rounded-lg text-xs transition duration-150 shadow focus:outline-none cursor-pointer whitespace-nowrap shrink-0 w-full sm:w-auto text-center justify-center"
            >
              {isPreviewTransitioning ? 'Exiting Preview...' : 'Exit Preview Mode'}
            </button>
          </div>
        )}

        {state.isDemoMode && !state.isPreviewMode && (
          <div className="bg-amber-950/80 border border-amber-500/30 text-amber-300 p-3 sm:px-4 sm:py-3 rounded-xl mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-sm animate-scale-up shadow-lg w-full max-w-full box-border">
            <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
              <span className="flex h-2.5 w-2.5 relative shrink-0 mt-1 sm:mt-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-xs sm:text-sm whitespace-normal break-words min-w-0 flex-1">
                <strong>Demo Sandbox Playground Active:</strong> You are inside a safe sandboxed environment. All edits are temporary and will be completely discarded when you exit.
              </span>
            </div>
            <button
              onClick={handleEndDemo}
              disabled={isDemoTransitioning}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-cool-gray-950 font-bold px-4 py-1.5 rounded-lg text-xs transition duration-150 shadow focus:outline-none cursor-pointer whitespace-nowrap shrink-0 w-full sm:w-auto text-center justify-center"
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
                {currentView !== 'library' && currentView !== 'history' && currentView !== 'reconcile' && currentView !== 'users' && currentView !== 'offsite' && currentView !== 'butcher_records' && currentView !== 'traceability' && (
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
                    {/* Off-Site View Sub-Tabs: 3 Primary (Workspace, Storage Hierarchy, Movements) + Dynamic (Movement Scanner, Staging Worksheet) */}
                    <div className="flex items-center rounded-lg bg-cool-gray-850 border border-cool-gray-700 p-0.5" id="offsite-header-subtabs">
                      {(() => {
                        const tabs = [
                          { id: 'sheet', label: 'Workspace', icon: '📋', desc: 'Main CSV spreadsheet with condensed identical items or location hierarchy trees' },
                          { id: 'hierarchy', label: 'Storage Hierarchy', icon: '🌳', desc: 'Interactive location, pallet, box, and meat cuts hierarchical tree explorer' },
                          { id: 'history', label: 'Movements', icon: '🚚', desc: 'View historical/executed movement orders and details of what was moved' }
                        ];
                        const hasFinalized = (state.movementOrders || []).some((o: any) => o.status === 'finalized');
                        if (hasFinalized) {
                          tabs.push({ id: 'active-movement', label: 'Movement Scanner', icon: '⚡', desc: 'Execute live movement orders via interactive barcode scan and loading sheets' });
                        }
                        const hasStaged = (state.offSiteEntries || []).some((e: any) => e.staged);
                        if (hasStaged) {
                          tabs.push({ id: 'staging-worksheet', label: 'Staging Worksheet', icon: '📝', desc: 'Configure packaging, assign weights, locations, pallets, and serialize items' });
                        }
                        return tabs.map(m => {
                          const isActive = offsiteSubTab === m.id;
                          return (
                            <button
                              key={m.id}
                              id={`offsite-subtab-${m.id}`}
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
                      {activeOrders.length > 1 && (
                        <span className="text-[10px] font-black bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.2 rounded-full shrink-0">
                          +{activeOrders.length - 1}
                        </span>
                      )}
                      <ChevronDown size={12} className={`transition-transform duration-200 shrink-0 ${isMovementPopdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMovementPopdownOpen && (
                      <ActiveMovementModal 
                        order={activeOrder}
                        state={state}
                        dispatch={dispatch}
                        onClose={() => setIsMovementPopdownOpen(false)}
                        onSelectOrder={handleSelectMovementOrder}
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



                {/* Combined Sync, Operating Mode, and History Dropdown Menu */}
                <div className="relative">
                  <button
                    onClick={() => setIsSyncMenuOpen(!isSyncMenuOpen)}
                    className={`h-8 px-2 sm:px-2.5 rounded-lg flex items-center justify-center gap-1 sm:gap-1.5 border transition duration-150 focus:outline-none cursor-pointer text-[11px] sm:text-xs font-bold ${
                      operatingMode === 'single' || isSingleUserMode
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/30'
                        : singleUserLock && singleUserLock.clientId !== clientId
                        ? 'bg-amber-950/40 text-amber-300 border-amber-500/50'
                        : operatingMode === 'multi'
                        ? 'bg-blue-950/40 text-blue-300 border-blue-500/50 shadow-md shadow-blue-950/30 ring-1 ring-blue-500/30'
                        : isSaving
                        ? 'bg-amber-950/40 text-amber-300 border-amber-500/50 animate-pulse'
                        : hasPendingChanges
                        ? 'bg-amber-950/20 text-amber-400 border-amber-500/25 animate-pulse'
                        : syncStatus === 'remote_editing'
                        ? 'bg-fuchsia-950/20 text-fuchsia-400 border-fuchsia-500/25 animate-pulse'
                        : syncStatus === 'synced'
                        ? isAutoMultiActive
                          ? 'bg-blue-950/40 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-950/20'
                          : 'bg-cyan-950/20 text-cyan-400 border-cyan-500/20'
                        : syncStatus === 'connecting'
                        ? 'bg-amber-950/20 text-amber-400 border-amber-500/25 animate-pulse'
                        : 'bg-rose-950/20 text-rose-400 border-rose-500/20'
                    }`}
                    title={
                      operatingMode === 'single' || isSingleUserMode
                        ? 'Single-User Mode Active (Zero-Lag Local Storage)'
                        : singleUserLock && singleUserLock.clientId !== clientId
                        ? `Locked in Single-User Mode by ${singleUserLock.holderName}`
                        : operatingMode === 'multi'
                        ? 'Forced Multi-User Mode Active (Collaborative Sync)'
                        : operatingMode === 'auto'
                        ? isAutoMultiActive
                          ? `Auto Mode: Multi-User Active (${activeClientCount} connected) — Live sync enabled`
                          : 'Auto Mode: Single-User Active (Solo) — Zero-lag local buffering'
                        : `Sync, History & Traceability (${isSaving ? 'Saving to server...' : hasPendingChanges ? 'Pending changes syncing...' : syncStatus === 'remote_editing' ? 'Someone else is actively editing...' : syncStatus === 'synced' ? 'Live connected' : syncStatus === 'connecting' ? 'Connecting...' : 'Disconnected (Click to sync)'})`
                    }
                  >
                    {operatingMode === 'single' || isSingleUserMode ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-0.5 shrink-0" />
                    ) : singleUserLock && singleUserLock.clientId !== clientId ? (
                      <span className="text-amber-400 text-xs shrink-0">🔒</span>
                    ) : operatingMode === 'multi' ? (
                      <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : isSaving || isRefreshing ? (
                      <svg 
                        className="w-3.5 h-3.5 flex-shrink-0 animate-spin text-cyan-400" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    ) : (hasPendingChanges || syncStatus === 'connecting' || syncStatus === 'remote_editing') ? (
                      <svg 
                        className="w-3.5 h-3.5 flex-shrink-0 animate-bounce text-amber-400" 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor" 
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                      </svg>
                    ) : isAutoMultiActive || operatingMode === 'multi' ? (
                      <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    )}
                    <span className="hidden sm:inline">
                      {operatingMode === 'single' || isSingleUserMode
                        ? 'Single-User'
                        : singleUserLock && singleUserLock.clientId !== clientId
                        ? `Locked (${singleUserLock.holderName})`
                        : operatingMode === 'multi'
                        ? 'Multi-User'
                        : isSaving
                        ? 'Saving...'
                        : hasPendingChanges
                        ? 'Pending Changes'
                        : syncStatus === 'remote_editing'
                        ? 'User Editing...'
                        : syncStatus === 'synced'
                        ? (isAutoMultiActive ? `Auto: Multi (${activeClientCount})` : 'Auto: Single')
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
                      <div id="sync-status-dropdown" className="absolute right-0 mt-2 w-64 sm:w-72 bg-cool-gray-850 rounded-xl border border-cool-gray-700 shadow-2xl p-2.5 z-50 text-xs animate-scale-up max-h-[85vh] overflow-y-auto">
                        
                        {/* 3-Way Operating Mode Control Panel */}
                        <div className="p-2.5 bg-cool-gray-900/90 rounded-lg border border-cool-gray-750 mb-2.5 shadow-inner">
                          <div className="text-[10px] uppercase tracking-wider text-cool-gray-400 font-bold mb-2 flex items-center justify-between">
                            <span>Operating Mode</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider flex items-center gap-1 ${
                              operatingMode === 'auto'
                                ? isAutoMultiActive
                                  ? 'bg-blue-950/80 text-blue-300 border-blue-800/50'
                                  : 'bg-cyan-950/80 text-cyan-300 border-cyan-800/50'
                                : operatingMode === 'multi'
                                ? 'bg-blue-950/80 text-blue-300 border-blue-800/50'
                                : 'bg-emerald-950/80 text-emerald-300 border-emerald-800/50'
                            }`}>
                              {operatingMode === 'auto' 
                                ? (isAutoMultiActive ? `Auto: Multi (${activeClientCount})` : 'Auto: Single') 
                                : operatingMode === 'multi' 
                                ? 'Forced Multi' 
                                : 'Exclusive Lock'}
                            </span>
                          </div>

                          {/* 3-Mode Tab Buttons */}
                          <div className="grid grid-cols-3 gap-1 bg-cool-gray-800/90 p-1 rounded-lg border border-cool-gray-700/60 mb-2.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await setOperatingMode('auto');
                              }}
                              className={`py-1.5 px-1 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                                operatingMode === 'auto'
                                  ? isAutoMultiActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-cyan-600 text-white shadow-sm'
                                  : 'text-cool-gray-400 hover:text-cool-gray-200 hover:bg-cool-gray-700/50'
                              }`}
                              title="Auto Mode (Default): Runs solo locally with zero lag and seamlessly upgrades to collaborative sync when multiple users are active."
                            >
                              {isAutoMultiActive ? <Users className="w-3 h-3 shrink-0" /> : <Zap className="w-3 h-3 shrink-0" />}
                              <span>Auto</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                await setOperatingMode('multi');
                              }}
                              className={`py-1.5 px-1 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                                operatingMode === 'multi'
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'text-cool-gray-400 hover:text-cool-gray-200 hover:bg-cool-gray-700/50'
                              }`}
                              title="Multi-User Mode: Forces collaborative 1.2s sync and live broadcast updates. Ideal for multi-device testing. Auto-times out after 5m."
                            >
                              <Users className="w-3 h-3 shrink-0" />
                              <span>Multi</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const res = await setOperatingMode('single');
                                if (!res.success && res.message) {
                                  setActionErrorModal({
                                    isOpen: true,
                                    actionType: 'SINGLE_USER_LOCK',
                                    message: res.message
                                  });
                                }
                              }}
                              className={`py-1.5 px-1 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                                operatingMode === 'single'
                                  ? 'bg-emerald-600 text-slate-950 font-black shadow-sm'
                                  : singleUserLock && singleUserLock.clientId !== clientId
                                  ? 'text-amber-400 hover:bg-amber-950/40'
                                  : 'text-cool-gray-400 hover:text-cool-gray-200 hover:bg-cool-gray-700/50'
                              }`}
                              title="Single-User Mode: Claims exclusive database lock for zero lag. Locks other users with break-in option. Auto-times out after 5m."
                            >
                              <User className="w-3 h-3 shrink-0" />
                              <span>Single</span>
                            </button>
                          </div>

                          {/* Mode Description & Contextual Actions */}
                          {operatingMode === 'auto' && (
                            <div className="space-y-2 text-[11px] text-cool-gray-300">
                              <p className="leading-snug">
                                <span className="font-semibold text-cyan-300">⚡ Smart Auto:</span> Default solo performance with zero-lag local memory. Automatically transitions to live collaborative sync when multiple users are active.
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-cool-gray-400 pt-1.5 border-t border-cool-gray-800">
                                <span className="font-medium">Current Status:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSyncMenuOpen(false);
                                    setActiveModal({ type: 'CONNECTED_CLIENTS' });
                                  }}
                                  className={`font-bold flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition hover:scale-105 active:scale-95 ${
                                    isAutoMultiActive 
                                      ? 'bg-blue-950/90 hover:bg-blue-900/90 text-blue-300 border border-blue-800/60 shadow-sm' 
                                      : 'bg-cyan-950/90 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-800/60'
                                  }`}
                                  title="Click to view connected devices & active users"
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isAutoMultiActive ? 'bg-blue-400 animate-ping' : 'bg-cyan-400'}`} />
                                  {isAutoMultiActive 
                                    ? `Multi-User Active (${activeClientCount} Connected) ➔` 
                                    : 'Single-User Active (Solo) ➔'}
                                </button>
                              </div>
                            </div>
                          )}

                          {operatingMode === 'multi' && (
                            <div className="space-y-2 text-[11px]">
                              <p className="text-blue-200 leading-snug">
                                <span className="font-semibold text-blue-300">👥 Forced Multi-User:</span> Real-time 1.2s debounced sync and SSE broadcasts are continuously active for live multi-device testing.
                              </p>
                              <div className="flex items-center justify-between text-[10px] text-cool-gray-400 pt-1 border-t border-cool-gray-800">
                                <span className="font-medium">Active Clients:</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsSyncMenuOpen(false);
                                    setActiveModal({ type: 'CONNECTED_CLIENTS' });
                                  }}
                                  className="font-bold flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/90 hover:bg-blue-900/90 text-blue-300 border border-blue-800/60 cursor-pointer transition hover:scale-105"
                                  title="Click to view connected devices & active users"
                                >
                                  <span>{activeClientCount} Connected ➔</span>
                                </button>
                              </div>
                              <p className="text-[10px] text-cool-gray-400 italic">
                                Automatically reverts to Auto mode after 5 minutes of inactivity.
                              </p>
                              <button
                                type="button"
                                onClick={async () => {
                                  await setOperatingMode('auto');
                                }}
                                className="w-full py-1.5 px-2 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-200 hover:text-white font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <span>⚡ Revert to Auto Mode</span>
                              </button>
                            </div>
                          )}

                          {operatingMode === 'single' && (
                            <div className="space-y-2 text-[11px]">
                              <p className="text-emerald-200 leading-snug">
                                <span className="font-semibold text-emerald-300">🔒 Exclusive Lock Active:</span> Changes save with zero latency locally. Remote edits from other users are locked out.
                              </p>
                              <p className="text-[10px] text-cool-gray-400 italic">
                                Automatically releases and reverts to Auto after 5 minutes of inactivity.
                              </p>
                              <button
                                type="button"
                                onClick={async () => {
                                  await setOperatingMode('auto');
                                }}
                                className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                              >
                                <span>⚡ Release Lock & Return to Auto</span>
                              </button>
                            </div>
                          )}

                          {/* Break-in prompt if another user holds the single-user lock while we are in Auto or Multi */}
                          {operatingMode !== 'single' && singleUserLock && singleUserLock.clientId !== clientId && (
                            <div className="mt-2 pt-2 border-t border-amber-900/60 space-y-1.5">
                              <p className="text-[11px] text-amber-300 leading-snug">
                                🔒 Single-User lock held by <span className="font-bold text-white">{singleUserLock.holderName}</span>.
                              </p>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await requestBreakIn();
                                  }}
                                  className="flex-1 py-1.5 px-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                                >
                                  <span>⚠️ Break-In (5s)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await forceReleaseSingleUserLock();
                                  }}
                                  className="py-1.5 px-2 bg-amber-900/80 hover:bg-amber-800 text-amber-200 border border-amber-700 font-bold rounded-md text-xs transition cursor-pointer flex items-center justify-center shadow"
                                  title="Force unlock if other device is closed"
                                >
                                  Force Unlock
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={async () => {
                            await flushAllPendingSyncs();
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
                            Sync Now
                          </span>
                          <span className={`text-[10px] uppercase font-bold tracking-wide px-1.5 py-0.5 rounded ${
                            operatingMode === 'single' || isSingleUserMode
                              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-850/40'
                              : operatingMode === 'multi'
                              ? 'bg-blue-950/80 text-blue-400 border border-blue-850/40'
                              : isSaving
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-850/40 animate-pulse'
                              : hasPendingChanges
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-850/40 animate-pulse'
                              : isAutoMultiActive
                              ? 'bg-blue-950/80 text-blue-400 border border-blue-850/40'
                              : syncStatus === 'remote_editing'
                              ? 'bg-fuchsia-950/80 text-fuchsia-400 border border-fuchsia-850/40 animate-pulse'
                              : syncStatus === 'synced' 
                              ? 'bg-cyan-950/80 text-cyan-400 border border-cyan-850/40' 
                              : syncStatus === 'connecting'
                              ? 'bg-amber-950/80 text-amber-400 border border-amber-850/40'
                              : 'bg-rose-950/80 text-rose-400 border border-rose-850/40'
                          }`}>
                            {operatingMode === 'single' || isSingleUserMode ? 'Single-User' : operatingMode === 'multi' ? 'Multi-User' : isSaving ? 'Saving...' : hasPendingChanges ? 'Pending Sync' : isAutoMultiActive ? `Auto: Multi (${activeClientCount})` : syncStatus === 'remote_editing' ? 'User Editing' : syncStatus === 'synced' ? 'Auto: Single' : syncStatus === 'connecting' ? 'Connecting' : 'Offline'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setIsSyncMenuOpen(false);
                            setActiveModal({ type: 'CONNECTED_CLIENTS' });
                          }}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-cool-gray-300 hover:bg-cool-gray-700 hover:text-white transition font-medium cursor-pointer"
                        >
                          <span className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Connected Devices</span>
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cool-gray-800 border border-cool-gray-700 text-cool-gray-300">
                            {activeClientCount} {activeClientCount === 1 ? 'Device' : 'Devices'}
                          </span>
                        </button>

                        <div className="h-px bg-cool-gray-700/60 my-1" />

                        {/* Audit & Traceability Section */}
                        <div className="px-3 py-1 text-[10px] font-bold text-cool-gray-400 uppercase tracking-wider">
                          <span>Audit & Traceability</span>
                        </div>

                        <button
                          onClick={() => {
                            setCurrentView('history');
                            setIsSyncMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-left transition font-medium cursor-pointer ${
                            currentView === 'history' 
                              ? 'bg-indigo-600/25 text-indigo-300 font-semibold' 
                              : 'text-cool-gray-300 hover:bg-cool-gray-700 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <History className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Audit History Log</span>
                          </span>
                          {currentView === 'history' && (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-indigo-400 shrink-0">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setCurrentView('traceability');
                            setIsSyncMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 rounded-lg text-left transition font-medium cursor-pointer ${
                            currentView === 'traceability' 
                              ? 'bg-amber-500/25 text-amber-300 font-semibold' 
                              : 'text-cool-gray-300 hover:bg-cool-gray-700 hover:text-white'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5 text-amber-400">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                            </svg>
                            <span>Item Traceability</span>
                          </span>
                          {currentView === 'traceability' && (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3 text-amber-400 shrink-0">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                            </svg>
                          )}
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
            {currentView !== 'library' && currentView !== 'history' && currentView !== 'reconcile' && currentView !== 'users' && currentView !== 'offsite' && currentView !== 'butcher_records' && currentView !== 'traceability' && isSearchFilterOpen && (
              <div className="mt-3 p-3 sm:p-4 bg-cool-gray-900/95 border border-cool-gray-750/90 rounded-xl shadow-xl shadow-black/30 backdrop-blur-md animate-fade-in text-xs space-y-3">
                {/* Top Row: Search & Quick Visibility Toggles */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-cool-gray-800/80">
                  {/* Search Input */}
                  <div className="relative flex-grow max-w-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <SearchIcon className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search items, categories, locations, notes..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="block w-full rounded-lg border-0 bg-cool-gray-850 pl-9 pr-8 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-700 placeholder:text-cool-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 py-1.5 text-xs transition"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')} 
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-cool-gray-400 hover:text-white cursor-pointer font-bold text-xs"
                        title="Clear search input"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Visibility Toggles & Reset Actions */}
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {/* Hide Zero Qty / Hide Empty Toggle */}
                    <label 
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition ${
                        hideZeroQuantity 
                          ? isDisplay ? 'bg-amber-950/40 border-amber-500/40 text-amber-300' : 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                          : 'bg-cool-gray-850 border-cool-gray-750 text-cool-gray-400 hover:text-cool-gray-200'
                      }`}
                      title={currentView === 'freezer' ? "Hide empty containers and empty loose storage locations" : "Hide cuts and products with zero quantity"}
                    >
                      <input
                        type="checkbox"
                        checked={hideZeroQuantity}
                        onChange={(e) => setHideZeroQuantity(e.target.checked)}
                        className={`h-3.5 w-3.5 rounded border-cool-gray-500 bg-cool-gray-700 cursor-pointer ${
                          isDisplay ? 'text-amber-500 focus:ring-amber-500' : 'text-cyan-600 focus:ring-cyan-600'
                        }`}
                      />
                      <span className="font-bold text-xs">{currentView === 'freezer' ? 'Hide Empty' : 'Hide Zero Qty'}</span>
                    </label>

                    {/* Show 0 Qty w/ On-Site Stock for Display View */}
                    {currentView === 'display_case' && (
                      <label className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer select-none transition ${
                        showZeroQtyWithStock 
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-300 shadow-xs' 
                          : 'bg-cool-gray-850 border-cool-gray-750 text-cool-gray-400 hover:text-cool-gray-200'
                      }`}
                      title="Show items with 0 display quantity if they have on-site backstock available to restock">
                        <input
                          type="checkbox"
                          checked={showZeroQtyWithStock}
                          onChange={(e) => setShowZeroQtyWithStock(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-cool-gray-500 bg-cool-gray-700 text-amber-500 focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="font-bold text-xs flex items-center gap-1">
                          <span>⚡</span> Restock Backstock
                        </span>
                      </label>
                    )}

                    {/* Reset All Filters Button */}
                    {(searchTerm || selectedPrimary || (selectedFreezerId && selectedFreezerId !== 'all') || (checkedTagIds !== null && checkedTagIds.length !== allTagIds.length) || !hideZeroQuantity) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedPrimary(null);
                          setSelectedSub(null);
                          setSelectedFreezerId('all');
                          setCheckedTagIds(allTagIds);
                          setHideZeroQuantity(true);
                          if (currentView === 'display_case') setShowZeroQtyWithStock(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-red-400 border border-cool-gray-700 transition flex items-center gap-1 font-bold text-xs cursor-pointer ml-auto sm:ml-0"
                        title="Reset all search and filter values to default"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset All</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Filter Selectors & Sort Controls Grid */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 ${(currentView === 'product' || currentView === 'display_case') ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 pt-0.5`}>
                  {/* 1. Category Selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-cool-gray-400 tracking-wider flex items-center gap-1">
                      <Tag className="w-3 h-3 text-cool-gray-400" /> Category:
                    </label>
                    <select
                      value={currentCategoryValue}
                      onChange={(e) => handleCategorySelectChange(e.target.value)}
                      className={`bg-cool-gray-850 text-xs font-bold rounded-lg border py-2 px-3 outline-none cursor-pointer focus:ring-1 w-full transition ${
                        selectedPrimary 
                          ? isDisplay ? 'text-amber-400 border-amber-500/60 bg-amber-950/20' : 'text-cyan-400 border-cyan-500/60 bg-cyan-950/20'
                          : 'text-cool-gray-300 border-cool-gray-700 hover:border-cool-gray-600'
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

                  {/* 2. Storage Location Selector */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black uppercase text-cool-gray-400 tracking-wider flex items-center gap-1">
                      <FreezerIcon className="w-3 h-3 text-cool-gray-400" /> Location:
                    </label>
                    <select
                      value={selectedFreezerId || 'all'}
                      onChange={(e) => setSelectedFreezerId(e.target.value)}
                      className={`bg-cool-gray-850 text-xs font-bold rounded-lg border py-2 px-3 outline-none cursor-pointer focus:ring-1 w-full transition ${
                        selectedFreezerId && selectedFreezerId !== 'all'
                          ? isDisplay ? 'text-amber-400 border-amber-500/60 bg-amber-950/20' : 'text-cyan-400 border-cyan-500/60 bg-cyan-950/20'
                          : 'text-cool-gray-300 border-cool-gray-700 hover:border-cool-gray-600'
                      }`}
                    >
                      <option value="all">All {isDisplay ? 'Display Cases' : 'Freezers'}</option>
                      {!isDisplay && <option value="staging">🛒 Staging Area</option>}
                      {filterFreezers.map(f => (
                        <option key={f.id} value={f.id}>{f.name} {f.isSpecial ? '🌟' : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Tags Multi-Select Dropdown */}
                  <div className="flex flex-col gap-1 relative">
                    <label className="text-[10px] font-black uppercase text-cool-gray-400 tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3 text-cool-gray-400" /> Tags:
                      </span>
                      {activeCheckedTags.length !== allTagIds.length && (
                        <span className={`text-[9px] font-extrabold ${isDisplay ? 'text-amber-400' : 'text-cyan-400'}`}>
                          {activeCheckedTags.length}/{allTagIds.length} Active
                        </span>
                      )}
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                      className={`bg-cool-gray-850 text-xs font-bold rounded-lg border py-2 px-3 text-left outline-none cursor-pointer focus:ring-1 w-full transition flex items-center justify-between select-none ${
                        activeCheckedTags.length !== allTagIds.length
                          ? isDisplay ? 'text-amber-400 border-amber-500/60 bg-amber-950/20' : 'text-cyan-400 border-cyan-500/60 bg-cyan-950/20'
                          : 'text-cool-gray-300 border-cool-gray-700 hover:border-cool-gray-600'
                      }`}
                    >
                      <span className="truncate">
                        {activeCheckedTags.length === allTagIds.length ? (
                          'All Tags Included'
                        ) : activeCheckedTags.length === 0 ? (
                          'No Tags (Hidden)'
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
                      <ChevronDown className="h-3.5 w-3.5 text-cool-gray-400 shrink-0 ml-1.5" />
                    </button>

                    {isTagDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsTagDropdownOpen(false)} />
                        <div className="absolute left-0 top-full mt-1.5 w-72 rounded-xl bg-cool-gray-900 border border-cool-gray-750 shadow-2xl py-1.5 z-50 text-xs animate-fade-in origin-top-left max-h-80 overflow-y-auto">
                          <div className="px-3 py-1.5 border-b border-cool-gray-800 flex items-center justify-between gap-2 font-semibold text-[10px] text-cool-gray-400">
                            <span>FILTER BY TAGS</span>
                            <div className="flex gap-2">
                              <button 
                                type="button"
                                onClick={() => setCheckedTagIds(allTagIds)}
                                className="text-cyan-400 hover:underline cursor-pointer select-none font-bold"
                              >
                                Select All
                              </button>
                              <span className="text-cool-gray-600">|</span>
                              <button 
                                type="button"
                                onClick={() => setCheckedTagIds([])}
                                className="text-cyan-400 hover:underline cursor-pointer select-none font-bold"
                              >
                                Clear All
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

                            {/* Dynamic tags */}
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

                  {/* 4. Sort By Controls (Only relevant on Product and Display Case views) */}
                  {(currentView === 'product' || currentView === 'display_case') && (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase text-cool-gray-400 tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <ArrowUpDown className="w-3 h-3 text-cool-gray-400" /> Sort Order:
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveModal({ type: 'SORT_ORDER', initialView: isDisplay ? 'display_case' : 'product' })}
                          className={`hover:underline flex items-center gap-0.5 cursor-pointer font-bold ${
                            isDisplay ? 'text-amber-400 hover:text-amber-300' : 'text-cyan-400 hover:text-cyan-300'
                          }`}
                          title="Configure custom ordering for categories, subcategories, and cuts"
                        >
                          <SlidersHorizontal className="w-2.5 h-2.5" /> Configure
                        </button>
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-cool-gray-850 p-1 rounded-lg border border-cool-gray-700 h-[38px] items-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSortMode('alphabetical')}
                          className={`h-full rounded-md font-bold transition cursor-pointer text-xs flex items-center justify-center ${
                            (isDisplay ? sortConfig.displaySortMode : sortConfig.productSortMode) === 'alphabetical'
                              ? isDisplay ? 'bg-amber-600 text-black shadow-xs font-extrabold' : 'bg-cyan-600 text-white shadow-xs font-extrabold'
                              : 'text-cool-gray-400 hover:text-cool-gray-200'
                          }`}
                          title="Sort alphabetically (A-Z)"
                        >
                          A-Z
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleSortMode('custom')}
                          className={`h-full rounded-md font-bold transition cursor-pointer text-xs flex items-center justify-center gap-1 ${
                            (isDisplay ? sortConfig.displaySortMode : sortConfig.productSortMode) === 'custom'
                              ? isDisplay ? 'bg-amber-600 text-black shadow-xs font-extrabold' : 'bg-cyan-600 text-white shadow-xs font-extrabold'
                              : 'text-cool-gray-400 hover:text-cool-gray-200'
                          }`}
                          title="Sort by custom user-defined hierarchy order"
                        >
                          <Sparkles className={`w-3 h-3 ${isDisplay && (sortConfig.displaySortMode === 'custom') ? 'text-black' : isDisplay ? 'text-amber-300' : 'text-cyan-300'}`} />
                          Custom
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Expanded Off-Site Search & Filters Row */}
            {currentView === 'offsite' && offsiteSubTab === 'sheet' && offsiteSearchFilterOpen && (
              <div className="mt-3 p-3 sm:p-4 bg-cool-gray-900/95 border border-cool-gray-750/90 rounded-xl shadow-xl shadow-black/30 backdrop-blur-md animate-fade-in text-xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-cool-gray-800/80">
                  {/* Search input box */}
                  <div className="relative flex-grow max-w-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <SearchIcon className="h-3.5 w-3.5 text-cyan-400" />
                    </div>
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search cuts, box numbers, or notes..."
                      value={offsiteSearch}
                      onChange={(e) => setOffsiteSearch(e.target.value)}
                      className="block w-full rounded-lg border-0 bg-cool-gray-850 pl-9 pr-8 text-cool-gray-100 ring-1 ring-inset ring-cool-gray-750 placeholder:text-cool-gray-500 focus:ring-2 focus:ring-inset focus:ring-cyan-500 py-1.5 text-xs transition"
                    />
                    {offsiteSearch && (
                      <button 
                        onClick={() => setOffsiteSearch('')} 
                        className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-cool-gray-400 hover:text-white cursor-pointer font-bold text-xs"
                        title="Clear search input"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Reset Offsite Filters */}
                  {(offsiteSearch || offsiteFilterTags.size > 0 || offsiteFilterLists.size > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setOffsiteSearch('');
                        setOffsiteFilterTags(new Set());
                        setOffsiteFilterLists(new Set());
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-cool-gray-800 hover:bg-cool-gray-750 text-cool-gray-400 hover:text-red-400 border border-cool-gray-700 transition flex items-center gap-1 font-bold text-xs cursor-pointer ml-auto md:ml-0 shrink-0"
                      title="Reset off-site search and active filters"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Filters</span>
                    </button>
                  )}
                </div>

                {/* Filter selectors panel */}
                <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                  {/* Advanced Filters Button */}
                  <div className="relative">
                    <button
                      onClick={() => setOffsiteAdvancedFilterOpen(!offsiteAdvancedFilterOpen)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                        offsiteAdvancedFilterOpen || offsiteFilterTags.size > 0 || offsiteFilterLists.size > 0
                          ? 'bg-cyan-950/45 border-cyan-500/50 text-cyan-300 shadow-md'
                          : 'bg-cool-gray-850 border-cool-gray-700 text-cool-gray-400 hover:text-white hover:border-cool-gray-600'
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
                    <button className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-cool-gray-850 border-cool-gray-700 text-cool-gray-400 hover:text-white hover:border-cool-gray-600 transition flex items-center gap-1.5 cursor-pointer">
                      <span>Columns</span>
                      <ChevronDown size={14} className="text-cool-gray-500 group-hover:text-cyan-400 transition-colors" />
                    </button>
                    <div className="absolute left-0 mt-1 hidden group-hover:block bg-cool-gray-800 border border-cool-gray-700 rounded-xl shadow-xl p-2 z-50 min-w-[170px] animate-fade-in text-cool-gray-200">
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
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-cool-gray-300 hover:text-white cursor-pointer select-none bg-cool-gray-850 border border-cool-gray-700 hover:border-cool-gray-600 px-3 py-1.5 rounded-lg transition">
                    <input
                      type="checkbox"
                      checked={offsiteViewUngrouped}
                      onChange={e => {
                        setOffsiteViewUngrouped(e.target.checked);
                        localStorage.setItem("offsite-view-ungrouped", e.target.checked ? "true" : "false");
                      }}
                      className="rounded bg-cool-gray-900 border-cool-gray-700 text-cyan-500 focus:ring-cyan-500/50 cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Ungrouped</span>
                  </label>

                  {/* Direct Edit Toggle */}
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-cool-gray-300 hover:text-white cursor-pointer select-none bg-cool-gray-850 border border-cool-gray-700 hover:border-cool-gray-600 px-3 py-1.5 rounded-lg transition">
                    <input
                      type="checkbox"
                      checked={offsiteDirectEdit}
                      onChange={e => setOffsiteDirectEdit(e.target.checked)}
                      className="rounded bg-cool-gray-900 border-cool-gray-700 text-blue-500 focus:ring-blue-500/50 cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Direct Edit</span>
                  </label>

                  {/* View Original Names Toggle */}
                  <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-cool-gray-300 hover:text-white cursor-pointer select-none bg-cool-gray-850 border border-cool-gray-700 hover:border-cool-gray-600 px-3 py-1.5 rounded-lg transition">
                    <input
                      type="checkbox"
                      checked={offsiteViewOriginalNames}
                      onChange={e => setOffsiteViewOriginalNames(e.target.checked)}
                      className="rounded bg-cool-gray-900 border-cool-gray-700 text-blue-500 focus:ring-blue-500/50 cursor-pointer w-3.5 h-3.5"
                    />
                    <span>Raw CSV Names</span>
                  </label>
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

      {/* Initial Database Loading Dialog */}
      {(!hasLoadedInitial || (isLoading && (!state.products || state.products.length === 0))) && (
        <div 
          id="database-loading-dialog" 
          className="fixed inset-0 z-[250] flex items-center justify-center bg-cool-gray-950/80 backdrop-blur-md p-4 animate-fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loading-dialog-title"
        >
          <div className="bg-cool-gray-900 border border-cool-gray-700/80 shadow-2xl rounded-2xl p-6 sm:p-8 max-w-md w-full flex flex-col items-center text-center space-y-5">
            {/* Animated Database / Server Icon */}
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin" />
              <div className="absolute w-14 h-14 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center">
                <Database className="w-7 h-7 text-cyan-400 animate-pulse" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h3 id="loading-dialog-title" className="text-lg sm:text-xl font-bold text-white tracking-wide">
                Loading Database
              </h3>
              <p className="text-sm text-cool-gray-400 max-w-xs mx-auto leading-relaxed">
                Retrieving products, storage freezers, and inventory records...
              </p>
            </div>

            {error ? (
              <div className="w-full space-y-3 pt-1">
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300">
                  {error}
                </div>
                <button
                  type="button"
                  onClick={() => refreshState(true)}
                  className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> Retry Loading
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 px-3.5 py-1.5 rounded-full shadow-inner">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Synchronizing with server...</span>
              </div>
            )}
          </div>
        </div>
      )}





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

      {/* Real-time Undo Notification Toast */}
      {undoToastMessage && (
        <div id="undo-success-toast" className="fixed bottom-6 right-6 z-50 max-w-sm bg-cool-gray-850 hover:bg-cool-gray-800 text-cool-gray-100 p-4 rounded-xl border border-amber-500/40 shadow-2xl flex items-start gap-3 animate-fade-in transition duration-300">
          <div className="p-1.5 rounded-full bg-amber-500/20 text-amber-400 mt-0.5 flex-shrink-0">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="flex-grow min-w-0">
            <h4 className="text-sm font-semibold text-amber-300">Action Undone</h4>
            <p className="text-xs text-cool-gray-300 mt-1 leading-relaxed">
              {undoToastMessage}
            </p>
          </div>
          <button 
            onClick={() => setUndoToastMessage(null)} 
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

      {/* Undo & Rollback Confirmation Modal */}
      <UndoConfirmationModal
        isOpen={undoModalConfig.isOpen}
        onClose={() =>
          setUndoModalConfig({
            isOpen: false,
            snapshotId: null,
            historyId: null
          })
        }
        recentSnapshots={undoSnapshots}
        historyEntries={state.history || []}
        state={state}
        preselectedSnapshotId={undoModalConfig.snapshotId}
        preselectedHistoryId={undoModalConfig.historyId}
        onConfirmUndo={async (snapshotId, historyId) => {
          const res = await executeUndo(snapshotId, historyId);
          if (res.success) {
            setUndoToastMessage(res.undoneDescription ? `Undid: ${res.undoneDescription}` : 'Action reverted successfully.');
            setTimeout(() => setUndoToastMessage(null), 4000);
          }
          return res;
        }}
      />
    </div>
  );
}
